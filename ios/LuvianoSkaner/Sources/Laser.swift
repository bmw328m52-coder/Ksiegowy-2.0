import SwiftUI
import CoreBluetooth

/// Stałe protokołu — poza klasą @MainActor, bo czytają je callbacki CoreBluetooth.
private enum GLM {
    static let service = CBUUID(string: "02A6C0D0-0451-4000-B000-FB3210111989")
    static let characteristic = CBUUID(string: "02A6C0D1-0451-4000-B000-FB3210111989")
    static let autoSync = Data([0xC0, 0x55, 0x02, 0x01, 0x00, 0x1A])
    static let savedKey = "laser.peripheral"
}

/// Dalmierz Bosch GLM 50 C przez Bluetooth LE.
/// Protokół (jak w aplikacji Bosch): usługa 02A6C0D0-…, charakterystyka 02A6C0D1-…;
/// po włączeniu powiadomień zapis `C0 55 02 01 00 1A` włącza wysyłanie każdego pomiaru.
/// Ramka pomiaru: `C0 55 10 06 …`, odległość = float32 LE (metry) od bajtu 7.
@MainActor
final class Laser: NSObject, ObservableObject {
    enum LinkState: Equatable {
        case off, unauthorized, idle, searching, connecting, connected
    }

    struct Reading: Equatable {
        let id = UUID()
        let mm: Double
    }

    @Published private(set) var state: LinkState = .idle
    @Published private(set) var deviceName: String?
    /// Ostatni pomiar — nowy obiekt przy każdym naciśnięciu przycisku na dalmierzu (także ten sam wynik).
    @Published private(set) var reading: Reading?

    private var central: CBCentralManager?
    private var peripheral: CBPeripheral?
    /// Użytkownik chce być połączony — po zgaśnięciu dalmierza łączymy się ponownie, gdy się obudzi.
    private var wanted = UserDefaults.standard.string(forKey: GLM.savedKey) != nil

    var isConnected: Bool { state == .connected }
    var hasSavedDevice: Bool { UserDefaults.standard.string(forKey: GLM.savedKey) != nil }

    /// Start Bluetooth (pierwsze wywołanie pyta o zgodę). Z zapamiętanym dalmierzem łączy się sam.
    func start() {
        if central == nil {
            central = CBCentralManager(delegate: self, queue: nil)
        } else {
            resume()
        }
    }

    /// Szukaj dalmierza (pierwsze sparowanie lub zmiana urządzenia).
    func search() {
        wanted = true
        start()
        guard let central, central.state == .poweredOn else { return }
        state = .searching
        central.scanForPeripherals(withServices: nil)
    }

    func forget() {
        wanted = false
        UserDefaults.standard.removeObject(forKey: GLM.savedKey)
        central?.stopScan()
        if let peripheral { central?.cancelPeripheralConnection(peripheral) }
        peripheral = nil
        deviceName = nil
        state = central?.state == .poweredOn ? .idle : state
    }

    private func resume() {
        guard let central, central.state == .poweredOn, wanted else { return }
        if peripheral?.state == .connected || peripheral?.state == .connecting { return }
        if let s = UserDefaults.standard.string(forKey: GLM.savedKey), let uuid = UUID(uuidString: s),
           let p = central.retrievePeripherals(withIdentifiers: [uuid]).first {
            connect(p)
        } else {
            search()
        }
    }

    private func connect(_ p: CBPeripheral) {
        central?.stopScan()
        peripheral = p
        p.delegate = self
        deviceName = p.name ?? deviceName
        state = .connecting
        // Żądanie połączenia nie wygasa — gdy dalmierz jest wyłączony, połączy się po włączeniu.
        central?.connect(p)
    }

    fileprivate func handle(_ data: Data) {
        let b = [UInt8](data)
        guard b.count >= 11, b[0] == 0xC0, b[1] == 0x55, b[2] == 0x10, b[3] == 0x06 else { return }
        let bits = UInt32(b[7]) | UInt32(b[8]) << 8 | UInt32(b[9]) << 16 | UInt32(b[10]) << 24
        let meters = Double(Float(bitPattern: bits))
        guard meters.isFinite, meters > 0.01, meters < 100 else { return }
        reading = Reading(mm: (meters * 1000).rounded())
    }
}

extension Laser: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ c: CBCentralManager) {
        let s = c.state
        Task { @MainActor in
            switch s {
            case .poweredOn:
                state = .idle
                resume()
            case .unauthorized:
                state = .unauthorized
            default:
                state = .off
            }
        }
    }

    nonisolated func centralManager(_ c: CBCentralManager, didDiscover p: CBPeripheral,
                                    advertisementData ad: [String: Any], rssi: NSNumber) {
        let name = (ad[CBAdvertisementDataLocalNameKey] as? String) ?? p.name ?? ""
        let services = ad[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []
        guard name.uppercased().contains("GLM") || services.contains(GLM.service) else { return }
        Task { @MainActor in
            guard state == .searching else { return }
            deviceName = name.isEmpty ? "Bosch GLM" : name
            connect(p)
        }
    }

    nonisolated func centralManager(_ c: CBCentralManager, didConnect p: CBPeripheral) {
        Task { @MainActor in
            UserDefaults.standard.set(p.identifier.uuidString, forKey: GLM.savedKey)
            p.discoverServices([GLM.service])
        }
    }

    nonisolated func centralManager(_ c: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) {
        Task { @MainActor in
            state = .idle
            if wanted { connect(p) }
        }
    }

    nonisolated func centralManager(_ c: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        Task { @MainActor in
            guard wanted, peripheral?.identifier == p.identifier else {
                state = .idle
                return
            }
            // Dalmierz zgasł (auto-wyłączenie) — czekamy na niego.
            connect(p)
        }
    }
}

extension Laser: CBPeripheralDelegate {
    nonisolated func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        guard let s = p.services?.first(where: { $0.uuid == GLM.service }) else { return }
        p.discoverCharacteristics([GLM.characteristic], for: s)
    }

    nonisolated func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        guard let ch = s.characteristics?.first(where: { $0.uuid == GLM.characteristic }) else { return }
        p.setNotifyValue(true, for: ch)
    }

    nonisolated func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor ch: CBCharacteristic, error: Error?) {
        guard ch.isNotifying else { return }
        let type: CBCharacteristicWriteType = ch.properties.contains(.write) ? .withResponse : .withoutResponse
        p.writeValue(GLM.autoSync, for: ch, type: type)
        Task { @MainActor in state = .connected }
    }

    nonisolated func peripheral(_ p: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
        guard let data = ch.value else { return }
        Task { @MainActor in handle(data) }
    }
}

/// Status dalmierza w pasku narzędzi; stuknięcie — połącz / rozłącz.
struct LaserButton: View {
    @EnvironmentObject private var laser: Laser
    @State private var menu = false

    var body: some View {
        Button { menu = true } label: {
            Label(title, systemImage: "scope")
                .labelStyle(.titleAndIcon)
                .font(.footnote)
                .foregroundStyle(laser.isConnected ? Color.green : Color.secondary)
        }
        .confirmationDialog("Dalmierz Bosch GLM 50 C", isPresented: $menu, titleVisibility: .visible) {
            if laser.state == .searching || laser.state == .connecting || laser.isConnected {
                Button("Rozłącz i zapomnij", role: .destructive) { laser.forget() }
            } else {
                Button("Połącz") { laser.search() }
            }
        } message: {
            Text("Włącz Bluetooth na dalmierzu (ikona w menu GLM). Każdy pomiar przyciskiem na dalmierzu trafia do aktywnego pola wymiaru.")
        }
        .onAppear { laser.start() }
    }

    private var title: String {
        switch laser.state {
        case .connected: return laser.deviceName ?? "Dalmierz"
        case .connecting: return "Czekam na dalmierz…"
        case .searching: return "Szukam dalmierza…"
        case .unauthorized: return "Brak zgody Bluetooth"
        case .off: return "Bluetooth wyłączony"
        case .idle: return "Dalmierz"
        }
    }
}

/// Podpowiedź w polu wymiaru: stan dalmierza / „wynik z dalmierza".
struct LaserHint: View {
    var fromLaser = false
    @EnvironmentObject private var laser: Laser

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: fromLaser ? "checkmark.circle.fill" : "scope")
            Text(text)
            Spacer(minLength: 0)
            if !laser.isConnected && laser.state != .connecting && laser.state != .searching {
                Button("Połącz") { laser.search() }.buttonStyle(.bordered).controlSize(.small)
            }
        }
        .font(.footnote)
        .foregroundStyle(laser.isConnected ? Color.green : Color.secondary)
        .padding(10)
        .background((laser.isConnected ? Color.green : Color.secondary).opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .onAppear { laser.start() }
    }

    private var text: String {
        if fromLaser { return "Wynik z dalmierza — sprawdź i zastosuj" }
        switch laser.state {
        case .connected: return "Dalmierz połączony — zmierz przyciskiem na GLM"
        case .connecting: return "Czekam na dalmierz — włącz go"
        case .searching: return "Szukam dalmierza…"
        case .unauthorized: return "Brak zgody na Bluetooth (Ustawienia → LUVIANO Skaner)"
        case .off: return "Bluetooth na iPadzie wyłączony"
        case .idle: return "Dalmierz niepołączony"
        }
    }
}
