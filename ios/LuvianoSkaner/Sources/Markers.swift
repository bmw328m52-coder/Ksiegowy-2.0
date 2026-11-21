import SwiftUI

/// Rodzaje punktów instalacji. Klucze (`rawValue`) i kody muszą być zgodne
/// z meble-app: src/lib/dao/room_scans.types.ts (SCAN_MARKER_KINDS).
enum MarkerKind: String, CaseIterable, Identifiable {
    case waterCold = "water_cold", waterHot = "water_hot", drain
    case socket, power400 = "power_400", gas, vent, light, lightSwitch = "switch", other
    /// Nie instalacja: pionowa granica na ścianie — odkąd (dokąd) ma stać mebel.
    case furnitureEdge = "furniture_edge"

    var id: String { rawValue }

    /// Rodzaje do wyboru jako punkt instalacji (granica mebla ma własny przycisk w widoku ściany).
    static let installations = allCases.filter { $0 != .furnitureEdge }

    var label: String {
        switch self {
        case .waterCold: return "Woda zimna"
        case .waterHot: return "Woda ciepła"
        case .drain: return "Odpływ"
        case .socket: return "Gniazdko 230 V"
        case .power400: return "Siła 400 V"
        case .gas: return "Gaz"
        case .vent: return "Wentylacja"
        case .light: return "Wypust światła"
        case .lightSwitch: return "Włącznik"
        case .other: return "Inne"
        case .furnitureEdge: return "Początek / koniec mebla"
        }
    }

    var symbol: String {
        switch self {
        case .waterCold, .waterHot: return "drop.fill"
        case .drain: return "arrow.down.to.line"
        case .socket: return "powerplug.fill"
        case .power400: return "bolt.fill"
        case .gas: return "flame.fill"
        case .vent: return "wind"
        case .light: return "lightbulb.fill"
        case .lightSwitch: return "lightswitch.on.fill"
        case .other: return "mappin"
        case .furnitureEdge: return "arrow.left.and.right"
        }
    }

    var color: Color {
        switch self {
        case .waterCold: return Color(red: 0.12, green: 0.45, blue: 0.85)
        case .waterHot: return Color(red: 0.85, green: 0.22, blue: 0.2)
        case .drain: return Color(red: 0.42, green: 0.38, blue: 0.34)
        case .socket: return Color(red: 0.93, green: 0.5, blue: 0.1)
        case .power400: return Color(red: 0.55, green: 0.27, blue: 0.75)
        case .gas: return Color(red: 0.85, green: 0.68, blue: 0.0)
        case .vent: return Color(red: 0.2, green: 0.6, blue: 0.55)
        case .light: return Color(red: 0.75, green: 0.55, blue: 0.1)
        case .lightSwitch: return Color(red: 0.55, green: 0.45, blue: 0.3)
        case .other: return Color(white: 0.4)
        case .furnitureEdge: return Brand.gold
        }
    }

    init(key: String) { self = MarkerKind(rawValue: key) ?? .other }
}

extension ScanMarker {
    var isFurnitureEdge: Bool { kind == MarkerKind.furnitureEdge.rawValue }
}

/// Strefa mebla na ścianie wyznaczona znacznikami „początek / koniec mebla".
enum FurnitureZone {
    /// Położenia znaczników na ścianie, od lewej.
    static func edges(_ scan: ScanPayload, wallId: String) -> [Double] {
        scan.markers.filter { $0.wallId == wallId && $0.isFurnitureEdge }.map(\.offsetMm).sorted()
    }

    /// Dwa znaczniki = od–do. Jeden = od znacznika do dalszego narożnika. Bez znaczników — nil (cała ściana).
    static func range(_ scan: ScanPayload, wallId: String, length: Double) -> (a: Double, b: Double)? {
        let e = edges(scan, wallId: wallId).map { min(max($0, 0), length) }
        guard let first = e.first else { return nil }
        let r: (a: Double, b: Double) = e.count >= 2 ? (a: first, b: e[1]) : first <= length / 2 ? (a: first, b: length) : (a: 0, b: first)
        return r.b - r.a >= 100 ? r : nil
    }
}

/// Znacznik instalacji: kółko w kolorze rodzaju z ikoną (rzut i widok ściany).
enum MarkerDraw {
    static func badge(_ ctx: GraphicsContext, _ kind: MarkerKind, at c: CGPoint, r: Double, selected: Bool = false) {
        if selected {
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r - 5, y: c.y - r - 5, width: 2 * r + 10, height: 2 * r + 10)),
                     with: .color(PlanStyle.selected.opacity(0.25)))
        }
        let disc = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
        ctx.fill(disc, with: .color(kind.color))
        ctx.stroke(disc, with: .color(.white), lineWidth: 1.5)
        var img = ctx.resolve(Image(systemName: kind.symbol))
        img.shading = .color(.white)
        let s = img.size, k = r * 1.1 / max(s.width, s.height, 1)
        ctx.draw(img, in: CGRect(x: c.x - s.width * k / 2, y: c.y - s.height * k / 2, width: s.width * k, height: s.height * k))
    }
}

/// Dodanie / edycja punktu instalacji: rodzaj, położenie na ścianie (mm), notatka.
struct MarkerSheet: View {
    let wallName: String
    let wallLength: Double
    let isNew: Bool
    let onSave: (ScanMarker) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var marker: ScanMarker
    @State private var offsetText: String
    @State private var heightText: String
    @State private var fromRight = false
    /// Obszar zamiast punktu: pas o zadanej szerokości (np. 500 mm), w którym są zawory i odpływ.
    @State private var isArea: Bool
    @State private var widthText: String
    @EnvironmentObject private var laser: Laser
    @FocusState private var focus: Field?
    /// Pole, do którego trafi następny pomiar z dalmierza (po odległości od narożnika — wysokość).
    @State private var laserTarget: Field = .offset

    private enum Field { case offset, width, height }

    init(marker: ScanMarker, wallName: String, wallLength: Double, isNew: Bool,
         onSave: @escaping (ScanMarker) -> Void, onDelete: @escaping () -> Void) {
        self.wallName = wallName
        self.wallLength = wallLength
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        _marker = State(initialValue: marker)
        let area = (marker.widthMm ?? 0) > 0 && marker.kind != MarkerKind.furnitureEdge.rawValue
        let w = marker.widthMm ?? 500
        // Obszar edytujemy po lewej krawędzi (offsetMm w danych = środek).
        _isArea = State(initialValue: area)
        _widthText = State(initialValue: "\(Int(w.rounded()))")
        _offsetText = State(initialValue: "\(Int((area ? marker.offsetMm - w / 2 : marker.offsetMm).rounded()))")
        _heightText = State(initialValue: "\(Int(marker.heightMm.rounded()))")
    }

    private func num(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }
    private var kind: MarkerKind { MarkerKind(key: marker.kind) }
    private var isEdge: Bool { kind == .furnitureEdge }
    private var valid: Bool {
        guard let o = num(offsetText), let h = num(heightText) else { return false }
        if isArea {
            guard let w = num(widthText), w > 0 else { return false }
            return o >= 0 && o + w <= wallLength + 1 && h >= 0
        }
        return o >= 0 && o <= wallLength + 1 && h >= 0
    }

    /// Środek punktu / obszaru liczony od lewego narożnika, z bieżących pól (w zadanym trybie).
    private func centerMm(area: Bool) -> Double? {
        guard let o = num(offsetText) else { return nil }
        let w = area ? (num(widthText) ?? 0) : 0
        let left = fromRight ? wallLength - o - w : o
        return left + w / 2
    }

    /// Wartość pola „od narożnika" dla środka `c` w danym trybie.
    private func fieldValue(center c: Double, area: Bool) -> Double {
        let w = area ? (num(widthText) ?? 0) : 0
        let left = c - w / 2
        return max(fromRight ? wallLength - left - w : left, 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                if !isEdge {
                Section("Rodzaj") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        ForEach(MarkerKind.installations) { k in
                            Button { marker.kind = k.rawValue } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: k.symbol)
                                        .foregroundStyle(.white)
                                        .frame(width: 28, height: 28)
                                        .background(k.color, in: Circle())
                                    Text(k.label).font(.subheadline).foregroundStyle(.primary)
                                    Spacer(minLength: 0)
                                }
                                .padding(8)
                                .background(k == kind ? k.color.opacity(0.15) : Color(.secondarySystemBackground),
                                            in: RoundedRectangle(cornerRadius: 10))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(k == kind ? k.color : .clear, lineWidth: 1.5))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                }

                Section {
                    Picker("Mierzone od", selection: $fromRight) {
                        Text("Lewego narożnika").tag(false)
                        Text("Prawego narożnika").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: fromRight) { old, new in
                        // Ten sam punkt / obszar — przeliczamy wartość na drugi narożnik.
                        guard let o = num(offsetText) else { return }
                        let w = isArea ? (num(widthText) ?? 0) : 0
                        let left = old ? wallLength - o - w : o
                        offsetText = "\(Int(max(new ? wallLength - left - w : left, 0).rounded()))"
                    }
                    if !isEdge {
                        Toggle(isOn: $isArea) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Zaznacz obszar zamiast punktu")
                                Text("Np. pas 500 mm, w którym są zawory i odpływ")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .onChange(of: isArea) { old, new in
                            guard let c = centerMm(area: old) else { return }
                            if new, num(widthText) == nil { widthText = "500" }
                            offsetText = "\(Int(fieldValue(center: c, area: new).rounded()))"
                        }
                    }
                    LaserHint()
                    if isArea {
                        mmField(fromRight ? "Prawa krawędź od prawego narożnika" : "Początek obszaru od lewego narożnika", text: $offsetText, field: .offset)
                        mmField("Szerokość obszaru", text: $widthText, field: .width)
                        HStack(spacing: 8) {
                            ForEach([300, 500, 600, 800, 1000], id: \.self) { v in
                                Button("\(v)") { widthText = "\(v)" }
                                    .buttonStyle(.bordered)
                                    .font(.subheadline.monospacedDigit())
                            }
                        }
                    } else {
                        mmField(fromRight ? "Od prawego narożnika" : "Od lewego narożnika", text: $offsetText, field: .offset)
                    }
                    if !isEdge { mmField(isArea ? "Od podłogi (środek obszaru)" : "Od podłogi (środek punktu)", text: $heightText, field: .height) }
                } header: {
                    Text("Położenie na ścianie \(wallName)")
                } footer: {
                    Text("Długość ściany \(Int(wallLength.rounded())) mm. Wpisz wymiar z miarki lub dalmierza."
                         + (isArea ? " Obszar rysuje się na ścianie jako pas — w jego świetle jest to, co opisujesz." : "")
                         + (isEdge ? " Drugi znacznik na tej samej ścianie wyznacza koniec mebla." : ""))
                }

                if !isEdge {
                    MarkerPhotosSection(photos: Binding(
                        get: { marker.photos ?? [] },
                        set: { marker.photos = $0.isEmpty ? nil : $0 }
                    ))
                }

                Section("Notatka") {
                    TextField(isEdge ? "np. od listwy, do krawędzi ościeżnicy…" : "np. podwójne, do przesunięcia, zawór kulowy…", text: Binding(
                        get: { marker.note ?? "" },
                        set: { marker.note = $0.isEmpty ? nil : $0 }
                    ), axis: .vertical)
                }

                if !isNew {
                    Section {
                        Button(isEdge ? "Usuń znacznik" : "Usuń punkt", role: .destructive) {
                            onDelete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(isEdge ? "Początek / koniec mebla" : isNew ? "Nowy punkt instalacji" : kind.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") {
                        guard let o = num(offsetText), let h = num(heightText) else { return }
                        var m = marker
                        if isArea, let w = num(widthText), w > 0 {
                            let left = fromRight ? wallLength - o - w : o
                            m.offsetMm = (left + w / 2).rounded()
                            m.widthMm = w.rounded()
                        } else {
                            m.offsetMm = (fromRight ? wallLength - o : o).rounded()
                            m.widthMm = nil
                        }
                        m.heightMm = h.rounded()
                        onSave(m)
                        dismiss()
                    }
                    .disabled(!valid)
                }
            }
        }
        .presentationDetents([.large])
        .onChange(of: focus) { _, f in if let f { laserTarget = f } }
        .onChange(of: laser.reading) { _, r in
            guard let r else { return }
            let v = "\(Int(r.mm))"
            switch laserTarget {
            case .offset:
                offsetText = v
                guard !isEdge else { return }
                laserTarget = isArea ? .width : .height
                if focus != nil { focus = laserTarget }
            case .width:
                widthText = v
                laserTarget = .height
                if focus != nil { focus = .height }
            case .height:
                heightText = v
            }
        }
    }

    private func mmField(_ title: String, text: Binding<String>, field: Field) -> some View {
        HStack {
            if laser.isConnected {
                Image(systemName: "scope")
                    .foregroundStyle(laserTarget == field ? Color.green : Color.clear)
            }
            Text(title)
            Spacer()
            TextField("0", text: text)
                .focused($focus, equals: field)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(.body.monospacedDigit())
                .frame(width: 110)
            Text("mm").foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onTapGesture { laserTarget = field }
    }
}
