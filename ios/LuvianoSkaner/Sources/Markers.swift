import SwiftUI

/// Rodzaje punktów instalacji. Klucze (`rawValue`) i kody muszą być zgodne
/// z meble-app: src/lib/dao/room_scans.types.ts (SCAN_MARKER_KINDS).
enum MarkerKind: String, CaseIterable, Identifiable {
    case waterCold = "water_cold", waterHot = "water_hot", drain
    case socket, power400 = "power_400", gas, vent, light, lightSwitch = "switch", other

    var id: String { rawValue }

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
        }
    }

    init(key: String) { self = MarkerKind(rawValue: key) ?? .other }
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
    @EnvironmentObject private var laser: Laser
    @FocusState private var focus: Field?
    /// Pole, do którego trafi następny pomiar z dalmierza (po odległości od narożnika — wysokość).
    @State private var laserTarget: Field = .offset

    private enum Field { case offset, height }

    init(marker: ScanMarker, wallName: String, wallLength: Double, isNew: Bool,
         onSave: @escaping (ScanMarker) -> Void, onDelete: @escaping () -> Void) {
        self.wallName = wallName
        self.wallLength = wallLength
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        _marker = State(initialValue: marker)
        _offsetText = State(initialValue: "\(Int(marker.offsetMm.rounded()))")
        _heightText = State(initialValue: "\(Int(marker.heightMm.rounded()))")
    }

    private func num(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".")) }
    private var kind: MarkerKind { MarkerKind(key: marker.kind) }
    private var valid: Bool {
        guard let o = num(offsetText), let h = num(heightText) else { return false }
        return o >= 0 && o <= wallLength + 1 && h >= 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Rodzaj") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        ForEach(MarkerKind.allCases) { k in
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

                Section {
                    Picker("Mierzone od", selection: $fromRight) {
                        Text("Lewego narożnika").tag(false)
                        Text("Prawego narożnika").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: fromRight) { _, _ in
                        // Ten sam punkt — przeliczamy wartość na drugi narożnik.
                        if let o = num(offsetText) { offsetText = "\(Int((wallLength - o).rounded()))" }
                    }
                    LaserHint()
                    mmField(fromRight ? "Od prawego narożnika" : "Od lewego narożnika", text: $offsetText, field: .offset)
                    mmField("Od podłogi (środek punktu)", text: $heightText, field: .height)
                } header: {
                    Text("Położenie na ścianie \(wallName)")
                } footer: {
                    Text("Długość ściany \(Int(wallLength.rounded())) mm. Wpisz wymiar z miarki lub dalmierza.")
                }

                MarkerPhotosSection(photos: Binding(
                    get: { marker.photos ?? [] },
                    set: { marker.photos = $0.isEmpty ? nil : $0 }
                ))

                Section("Notatka") {
                    TextField("np. podwójne, do przesunięcia, zawór kulowy…", text: Binding(
                        get: { marker.note ?? "" },
                        set: { marker.note = $0.isEmpty ? nil : $0 }
                    ), axis: .vertical)
                }

                if !isNew {
                    Section {
                        Button("Usuń punkt", role: .destructive) {
                            onDelete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(isNew ? "Nowy punkt instalacji" : kind.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") {
                        guard let o = num(offsetText), let h = num(heightText) else { return }
                        var m = marker
                        m.offsetMm = (fromRight ? wallLength - o : o).rounded()
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
