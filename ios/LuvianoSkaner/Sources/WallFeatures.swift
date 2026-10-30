import SwiftUI

/// Elementy na ścianie: grzejnik, rury, pion, skrzynka elektryczna, belka…
/// Prostokąt w widoku ściany (od lewego narożnika i od podłogi) z głębokością —
/// odstający (depth > 0) albo w licu ściany (depth = 0). `access` = musi zostać dostęp
/// przez zabudowę (drzwiczki rewizyjne / otwierany front). Klucze = SCAN_FEATURE_KINDS w scan2d.ts.
enum FeatureKind: String, CaseIterable, Identifiable {
    case radiator, pipeV = "pipe_v", pipeH = "pipe_h", fuseBox = "fuse_box", riser, beam, box

    var id: String { rawValue }

    var label: String {
        switch self {
        case .radiator: return "Grzejnik"
        case .pipeV: return "Rura pionowa"
        case .pipeH: return "Rura pozioma"
        case .fuseBox: return "Skrzynka elektryczna"
        case .riser: return "Pion / obudowa pionu"
        case .beam: return "Belka / podciąg"
        case .box: return "Inny element"
        }
    }

    var symbol: String {
        switch self {
        case .radiator: return "heater.vertical"
        case .pipeV: return "arrow.up.and.down"
        case .pipeH: return "arrow.left.and.right"
        case .fuseBox: return "bolt.square"
        case .riser: return "rectangle.portrait"
        case .beam: return "rectangle"
        case .box: return "square.dashed"
        }
    }

    var color: Color {
        switch self {
        case .radiator: return Color(red: 0.85, green: 0.3, blue: 0.25)
        case .pipeV, .pipeH: return Color(red: 0.3, green: 0.5, blue: 0.7)
        case .fuseBox: return Color(red: 0.93, green: 0.5, blue: 0.1)
        case .riser: return Color(red: 0.42, green: 0.38, blue: 0.34)
        case .beam: return Color(white: 0.45)
        case .box: return Color(white: 0.5)
        }
    }

    /// Typowe wymiary na start: szerokość, wysokość, od podłogi, głębokość (0 = w licu), dostęp.
    func defaults(wallH: Double) -> (w: Double, h: Double, z: Double, d: Double, access: Bool) {
        switch self {
        case .radiator: return (600, 600, 150, 100, false)
        case .pipeV: return (50, wallH, 0, 50, false)
        case .pipeH: return (1000, 50, 100, 50, false)
        case .fuseBox: return (300, 450, 1500, 0, true)
        case .riser: return (250, wallH, 0, 250, true)
        case .beam: return (1000, 250, max(wallH - 250, 0), 300, false)
        case .box: return (300, 300, 1000, 100, false)
        }
    }

    init(key: String) { self = FeatureKind(rawValue: key) ?? .box }
}

struct ScanFeature: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var kind: String
    var wallId: String
    /// Lewa krawędź od lewego narożnika ściany (patrząc na nią).
    var offsetMm: Double
    /// Dolna krawędź od podłogi.
    var elevationMm: Double
    var widthMm: Double
    var heightMm: Double
    /// Ile wystaje przed lico ściany; 0 = w licu (np. skrzynka podtynkowa).
    var depthMm: Double
    /// Musi zostać dostęp przez zabudowę.
    var access: Bool?
    var note: String?

    var flush: Bool { depthMm < 1 }
}

extension ScanFeature {
    private enum K: String, CodingKey { case id, kind, wallId, offsetMm, elevationMm, widthMm, heightMm, depthMm, access, note }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: K.self)
        id = try c.decode(String.self, forKey: .id)
        kind = try c.decode(String.self, forKey: .kind)
        wallId = try c.decode(String.self, forKey: .wallId)
        offsetMm = try c.decode(Double.self, forKey: .offsetMm)
        elevationMm = try c.decodeIfPresent(Double.self, forKey: .elevationMm) ?? 0
        widthMm = try c.decode(Double.self, forKey: .widthMm)
        heightMm = try c.decode(Double.self, forKey: .heightMm)
        depthMm = try c.decodeIfPresent(Double.self, forKey: .depthMm) ?? 0
        access = try c.decodeIfPresent(Bool.self, forKey: .access)
        note = try c.decodeIfPresent(String.self, forKey: .note)
    }
}

// MARK: - Rysowanie

enum FeatureDraw {
    static let accessColor = Color(red: 0.93, green: 0.5, blue: 0.1)

    /// Widok ściany: prostokąt elementu z symbolem; zaznaczony — z wymiarami od narożnika i podłogi.
    static func elevation(_ ctx: GraphicsContext, _ L: ElevLayout, _ f: ScanFeature, selected: Bool) {
        let k = FeatureKind(key: f.kind)
        let a = L.p(f.offsetMm, f.elevationMm + f.heightMm), b = L.p(f.offsetMm + f.widthMm, f.elevationMm)
        let r = CGRect(x: a.x, y: a.y, width: max(b.x - a.x, 2), height: max(b.y - a.y, 2))
        let ink = GraphicsContext.Shading.color(Color(white: 0.25))
        if f.flush {
            ctx.fill(Path(r), with: .color(k.color.opacity(0.08)))
            ctx.stroke(Path(r), with: .color(k.color), style: StrokeStyle(lineWidth: 1.4, dash: [5, 3]))
        } else {
            ctx.fill(Path(r), with: .color(k.color.opacity(0.18)))
            ctx.stroke(Path(r), with: .color(k.color), lineWidth: 1.6)
        }
        switch k {
        case .radiator:
            // Żeberka.
            let n = max(2, Int(r.width / 9))
            for i in 1..<n {
                let x = r.minX + r.width * Double(i) / Double(n)
                ctx.stroke(Draft.line(CGPoint(x: x, y: r.minY + 3), CGPoint(x: x, y: r.maxY - 3)), with: .color(k.color.opacity(0.7)), lineWidth: 0.8)
            }
        case .fuseBox:
            let door = r.insetBy(dx: min(5, r.width / 6), dy: min(5, r.height / 6))
            ctx.stroke(Path(door), with: ink, lineWidth: 0.8)
            ctx.fill(Path(CGRect(x: door.maxX - 6, y: door.midY - 6, width: 3, height: 12)), with: ink)
        case .riser, .beam, .box:
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY)), with: .color(k.color.opacity(0.5)), lineWidth: 0.7)
            ctx.stroke(Draft.line(CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.minX, y: r.maxY)), with: .color(k.color.opacity(0.5)), lineWidth: 0.7)
        default:
            break
        }
        if selected {
            ctx.stroke(Path(r.insetBy(dx: -4, dy: -4)), with: .color(PlanStyle.selected), lineWidth: 2.5)
        }
        // Opis: nazwa, wymiar, głębokość / w licu, dostęp.
        var lines = [Text(k.label).font(.system(size: 10, weight: .semibold))]
        lines.append(Text("\(Int(f.widthMm.rounded())) × \(Int(f.heightMm.rounded()))" + (f.flush ? " · w licu" : " · gł. \(Int(f.depthMm.rounded()))"))
            .font(.system(size: 9).monospacedDigit()))
        if f.access == true { lines.append(Text("DOSTĘP").font(.system(size: 9, weight: .bold)).foregroundColor(accessColor)) }
        let big = r.width > 70 && r.height > 40
        var y = big ? r.midY - Double(lines.count - 1) * 6.5 : r.minY - 8 - Double(lines.count - 1) * 13
        for t in lines {
            let res = ctx.resolve(t.foregroundColor(Color(white: 0.2)))
            let s = res.measure(in: CGSize(width: 300, height: 30))
            let c = CGPoint(x: r.midX, y: y)
            if !big {
                ctx.fill(Path(roundedRect: CGRect(x: c.x - s.width / 2 - 3, y: c.y - s.height / 2, width: s.width + 6, height: s.height), cornerRadius: 3),
                         with: .color(Color.white.opacity(0.85)))
            }
            ctx.draw(res, at: c)
            y += 13
        }
        guard selected else { return }
        let col = PlanStyle.selected
        let fromLeft = f.offsetMm + f.widthMm / 2 <= L.W / 2
        let edge = fromLeft ? 0.0 : L.W
        let x = fromLeft ? f.offsetMm : f.offsetMm + f.widthMm
        let zMid = f.elevationMm + f.heightMm / 2
        if abs(x - edge) > 5 {
            Draft.dimension(ctx, L.p(min(edge, x), zMid), L.p(max(edge, x), zMid), out: CGVector(dx: 0, dy: -1), off: 0,
                            text: "\(Int(abs(x - edge).rounded()))", color: col, bg: Color(white: 0.97))
        }
        if f.elevationMm > 5 {
            let tm = f.offsetMm + f.widthMm / 2
            Draft.dimension(ctx, L.p(tm, 0), L.p(tm, f.elevationMm), out: CGVector(dx: 1, dy: 0), off: 0,
                            text: "\(Int(f.elevationMm.rounded()))", color: col, bg: Color(white: 0.97))
        }
    }

    /// Rzut: odstający element jako prostokąt przy wewnętrznej krawędzi ściany; w licu — kolorowa kreska.
    /// Wysoko (belka, element od 1500 mm) — przerywany, jak szafki wiszące.
    static func plan(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout, _ f: ScanFeature) {
        guard let g = m.walls.first(where: { $0.w.id == f.wallId }) else { return }
        let k = FeatureKind(key: f.kind)
        let t0 = min(max(f.offsetMm, 0), g.len), t1 = min(max(f.offsetMm + f.widthMm, 0), g.len)
        guard t1 - t0 > 1 else { return }
        if f.flush {
            ctx.stroke(Draft.line(L.pt(g.at(t0, -3)), L.pt(g.at(t1, -3))), with: .color(k.color), lineWidth: 4)
        } else {
            let shape = Draft.poly([g.at(t0, 0), g.at(t1, 0), g.at(t1, -f.depthMm), g.at(t0, -f.depthMm)].map(L.pt))
            let high = f.elevationMm >= 1500
            ctx.fill(shape, with: .color(k.color.opacity(high ? 0.08 : 0.22)))
            ctx.stroke(shape, with: .color(k.color), style: StrokeStyle(lineWidth: 1.2, dash: high ? [5, 3] : []))
        }
        if f.access == true {
            let c = L.pt(g.at((t0 + t1) / 2, -max(f.depthMm, 0) - 14))
            ctx.draw(Text("dostęp").font(.system(size: 9, weight: .bold)).foregroundColor(accessColor), at: c)
        }
    }

    static func hit(_ q: CGPoint, _ L: ElevLayout, _ fs: [ScanFeature]) -> String? {
        let (t, z) = L.inv(q)
        let tol = 10 / L.s
        return fs.last { t >= $0.offsetMm - tol && t <= $0.offsetMm + $0.widthMm + tol
            && z >= $0.elevationMm - tol && z <= $0.elevationMm + $0.heightMm + tol }?.id
    }
}

// MARK: - Edycja

/// Dodanie / edycja elementu na ścianie: rodzaj, położenie i wymiary (dalmierz), w licu / odstający, dostęp.
struct FeatureSheet: View {
    let wallName: String
    let wallLength: Double
    let wallHeight: Double
    let isNew: Bool
    let onSave: (ScanFeature) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var laser: Laser
    @State private var f: ScanFeature
    @State private var texts: [Field: String] = [:]
    @State private var fromRight = false
    @State private var target: Field = .offset
    @FocusState private var focus: Field?

    enum Field: CaseIterable { case offset, elevation, width, height, depth }

    init(feature: ScanFeature, wallName: String, wallLength: Double, wallHeight: Double, isNew: Bool,
         onSave: @escaping (ScanFeature) -> Void, onDelete: @escaping () -> Void) {
        self.wallName = wallName
        self.wallLength = wallLength
        self.wallHeight = wallHeight
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        _f = State(initialValue: feature)
        _texts = State(initialValue: [
            .offset: "\(Int(feature.offsetMm.rounded()))", .elevation: "\(Int(feature.elevationMm.rounded()))",
            .width: "\(Int(feature.widthMm.rounded()))", .height: "\(Int(feature.heightMm.rounded()))",
            .depth: "\(Int(feature.depthMm.rounded()))",
        ])
    }

    private func num(_ k: Field) -> Double? { Double((texts[k] ?? "").replacingOccurrences(of: ",", with: ".")) }
    private var kind: FeatureKind { FeatureKind(key: f.kind) }
    private var valid: Bool {
        guard let o = num(.offset), let z = num(.elevation), let w = num(.width), let h = num(.height) else { return false }
        return o >= 0 && w > 0 && h > 0 && z >= 0 && (num(.depth) ?? 0) >= 0
    }

    private func binding(_ k: Field) -> Binding<String> {
        Binding(get: { texts[k] ?? "" }, set: { texts[k] = $0 })
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Rodzaj") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2), spacing: 8) {
                        ForEach(FeatureKind.allCases) { k in
                            Button { pick(k) } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: k.symbol)
                                        .foregroundStyle(.white)
                                        .frame(width: 28, height: 28)
                                        .background(k.color, in: RoundedRectangle(cornerRadius: 6))
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
                        // Ta sama krawędź elementu liczona od drugiego narożnika: lewa ↔ prawa.
                        if let o = num(.offset), let w = num(.width) { texts[.offset] = "\(Int((wallLength - o - w).rounded()))" }
                    }
                    LaserHint()
                    mmField(fromRight ? "Prawa krawędź od prawego narożnika" : "Lewa krawędź od lewego narożnika", .offset)
                    mmField("Dół od podłogi", .elevation)
                    mmField("Szerokość", .width)
                    mmField("Wysokość", .height)
                } header: {
                    Text("Położenie i wymiary — ściana \(wallName)")
                } footer: {
                    Text("Ściana \(Int(wallLength.rounded())) × \(Int(wallHeight.rounded())) mm.")
                }

                Section {
                    Toggle("W licu ściany (nie wystaje)", isOn: Binding(
                        get: { (num(.depth) ?? 0) < 1 },
                        set: { v in texts[.depth] = v ? "0" : "\(Int(kind.defaults(wallH: wallHeight).d > 0 ? kind.defaults(wallH: wallHeight).d : 100))" }
                    ))
                    if (num(.depth) ?? 0) >= 1 {
                        mmField("Wystaje przed ścianę", .depth)
                    }
                    Toggle(isOn: Binding(get: { f.access == true }, set: { f.access = $0 ? true : nil })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Wymagany dostęp")
                            Text("Zabudowa musi mieć drzwiczki / otwierany front w tym miejscu")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Notatka") {
                    TextField("np. zawory przy grzejniku, licznik, rewizja…", text: Binding(
                        get: { f.note ?? "" }, set: { f.note = $0.isEmpty ? nil : $0 }
                    ), axis: .vertical)
                }

                if !isNew {
                    Section {
                        Button("Usuń element", role: .destructive) {
                            onDelete()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(isNew ? "Nowy element na ścianie" : kind.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") { save() }.disabled(!valid)
                }
            }
        }
        .presentationDetents([.large])
        .onChange(of: focus) { _, v in if let v { target = v } }
        .onChange(of: laser.reading) { _, r in
            guard let r else { return }
            texts[target] = "\(Int(r.mm))"
            // Kolejny pomiar trafia do następnego pola.
            let order: [Field] = (num(.depth) ?? 0) >= 1 ? Field.allCases : [.offset, .elevation, .width, .height]
            if let i = order.firstIndex(of: target), i + 1 < order.count {
                target = order[i + 1]
                if focus != nil { focus = target }
            }
        }
    }

    /// Zmiana rodzaju nowego elementu podstawia typowe wymiary (miejsce zostaje).
    private func pick(_ k: FeatureKind) {
        f.kind = k.rawValue
        guard isNew else { return }
        let d = k.defaults(wallH: wallHeight)
        texts[.width] = "\(Int(d.w))"
        texts[.height] = "\(Int(d.h))"
        texts[.elevation] = "\(Int(d.z))"
        texts[.depth] = "\(Int(d.d))"
        f.access = d.access ? true : nil
    }

    private func save() {
        guard let o = num(.offset), let z = num(.elevation), let w = num(.width), let h = num(.height) else { return }
        var out = f
        out.widthMm = w.rounded()
        out.heightMm = h.rounded()
        out.offsetMm = (fromRight ? wallLength - o - w : o).rounded()
        out.elevationMm = z.rounded()
        out.depthMm = max(num(.depth) ?? 0, 0).rounded()
        onSave(out)
        dismiss()
    }

    private func mmField(_ title: String, _ k: Field) -> some View {
        HStack {
            if laser.isConnected {
                Image(systemName: "scope").foregroundStyle(target == k ? Color.green : Color.clear)
            }
            Text(title)
            Spacer()
            TextField("0", text: binding(k))
                .focused($focus, equals: k)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .font(.body.monospacedDigit())
                .frame(width: 110)
            Text("mm").foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onTapGesture { target = k }
    }
}
