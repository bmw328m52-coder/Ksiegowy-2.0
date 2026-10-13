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
        // Bez Bluetooth jeszcze gotowego: skan ruszy w centralManagerDidUpdateState → resume().
        guard central != nil else { return start() }
        resume()
    }

    private func scan() {
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
            scan()
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

    /// Ostatnie zdarzenia i surowe ramki (hex) — podgląd „Diagnostyka" przy dalmierzu.
    @Published private(set) var log: [String] = []

    fileprivate func note(_ line: String) {
        let t = Date().formatted(date: .omitted, time: .standard)
        log.append("\(t)  \(line)")
        if log.count > 40 { log.removeFirst(log.count - 40) }
    }

    /// Ramka MT: `C0 55 10 <typ> 00 <licznik×2> <v1 f32> <v2 f32> <v3 f32> <crc>`, wartości w metrach.
    /// Typ 06 = zwykły pomiar (v1); w trybach pole/objętość/pośredni zmierzony odcinek siedzi w v2.
    fileprivate func handle(_ data: Data, from ch: CBUUID) {
        let b = [UInt8](data)
        note("\(ch.uuidString.prefix(8)) ← " + b.map { String(format: "%02X", $0) }.joined(separator: " "))
        var i = 0
        while i + 11 <= b.count {
            defer { i += 1 }
            guard b[i] == 0xC0, b[i + 1] == 0x55, b[i + 2] == 0x10 else { continue }
            func f(_ k: Int) -> Double? {
                guard i + k + 4 <= b.count else { return nil }
                let bits = UInt32(b[i + k]) | UInt32(b[i + k + 1]) << 8 | UInt32(b[i + k + 2]) << 16 | UInt32(b[i + k + 3]) << 24
                let v = Double(Float(bitPattern: bits))
                return v.isFinite && v > 0.01 && v < 200 ? v : nil
            }
            let type = b[i + 3]
            if type == 0x21 { continue } // kątomierz
            let primary: Set<UInt8> = [0x06, 0x0A, 0x2A, 0x2E, 0x36]
            guard let meters = primary.contains(type) ? (f(7) ?? f(11)) : (f(11) ?? f(7)) else { continue }
            let mm = (meters * 1000).rounded()
            note("Pomiar \(Int(mm)) mm (typ \(String(format: "%02X", type)))")
            reading = Reading(mm: mm)
            return
        }
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
            p.discoverServices(nil)
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
    // Różne modele GLM mają różne charakterystyki (D1/D2…) — subskrybujemy wszystko, co umie powiadamiać.
    nonisolated func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        let list = p.services ?? []
        Task { @MainActor in note("Usługi: " + list.map { $0.uuid.uuidString.prefix(8) }.joined(separator: ", ")) }
        for s in list { p.discoverCharacteristics(nil, for: s) }
    }

    nonisolated func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        for ch in s.characteristics ?? [] {
            let props = ch.properties
            let desc = "\(ch.uuid.uuidString.prefix(8)) [\(props.contains(.notify) ? "N" : "")\(props.contains(.indicate) ? "I" : "")\(props.contains(.write) ? "W" : "")\(props.contains(.writeWithoutResponse) ? "w" : "")]"
            Task { @MainActor in note("  " + desc) }
            if props.contains(.notify) || props.contains(.indicate) { p.setNotifyValue(true, for: ch) }
        }
    }

    nonisolated func peripheral(_ p: CBPeripheral, didUpdateNotificationStateFor ch: CBCharacteristic, error: Error?) {
        let id = ch.uuid.uuidString.prefix(8)
        let err = error?.localizedDescription
        Task { @MainActor in note("Subskrypcja \(id): " + (err ?? (ch.isNotifying ? "OK" : "wył."))) }
        guard ch.isNotifying else { return }
        // Komenda auto-sync na kanał poleceń (D1; gdy go brak — ten, który umie i pisać, i powiadamiać).
        let isCommand = ch.uuid == GLM.characteristic
            || (ch.service?.characteristics?.contains { $0.uuid == GLM.characteristic } != true
                && (ch.properties.contains(.write) || ch.properties.contains(.writeWithoutResponse)))
        guard isCommand else { return }
        let type: CBCharacteristicWriteType = ch.properties.contains(.write) ? .withResponse : .withoutResponse
        p.writeValue(GLM.autoSync, for: ch, type: type)
        Task { @MainActor in
            note("Auto-sync → \(id)")
            state = .connected
        }
    }

    nonisolated func peripheral(_ p: CBPeripheral, didWriteValueFor ch: CBCharacteristic, error: Error?) {
        let err = error?.localizedDescription
        Task { @MainActor in note("Zapis \(ch.uuid.uuidString.prefix(8)): " + (err ?? "OK")) }
    }

    nonisolated func peripheral(_ p: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
        guard let data = ch.value else { return }
        let id = ch.uuid
        Task { @MainActor in handle(data, from: id) }
    }
}

/// Status dalmierza w pasku narzędzi; stuknięcie — połącz / rozłącz.
struct LaserButton: View {
    @EnvironmentObject private var laser: Laser
    @State private var menu = false
    @State private var diagnostics = false

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
            Button("Diagnostyka") { diagnostics = true }
        } message: {
            Text("Włącz Bluetooth na dalmierzu (ikona w menu GLM). Każdy pomiar przyciskiem na dalmierzu trafia do aktywnego pola wymiaru.")
        }
        .sheet(isPresented: $diagnostics) { LaserLogView() }
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

/// Surowe dane z dalmierza — do ustalenia formatu ramek, gdy pomiar nie wpada.
struct LaserLogView: View {
    @EnvironmentObject private var laser: Laser
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(laser.log.isEmpty ? "Brak danych — połącz dalmierz i zrób pomiar." : laser.log.joined(separator: "
"))
                    .font(.system(size: 12, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle("Diagnostyka dalmierza")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Zamknij") { dismiss() } } }
        }
    }
}
