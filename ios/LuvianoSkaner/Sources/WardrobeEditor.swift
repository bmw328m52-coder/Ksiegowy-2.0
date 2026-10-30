import SwiftUI

/// Edytor szafy: duży rysunek wnętrza (stuknij sekcję / strefę) + panel z wymiarami,
/// frontami, sekcjami i strefami. Zmiany na kopii — „Gotowe" zapisuje do skanu.
struct WardrobeEditor: View {
    let wallName: String
    let wallLength: Double
    let conflicts: (ScanWardrobe) -> [(feature: ScanFeature, section: Int?)]
    let onSave: (ScanWardrobe) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var w: ScanWardrobe
    @State private var section: Int? = 0
    @State private var zone: Int?
    @State private var edit: WEdit?
    @State private var confirmDelete = false

    private enum WEdit: Identifiable {
        case dim(String), secWidth(Int), zoneHeight(Int, Int)
        var id: String {
            switch self {
            case .dim(let k): return "d" + k
            case .secWidth(let k): return "s\(k)"
            case .zoneHeight(let k, let j): return "z\(k)-\(j)"
            }
        }
    }

    init(wardrobe: ScanWardrobe, wallName: String, wallLength: Double,
         conflicts: @escaping (ScanWardrobe) -> [(feature: ScanFeature, section: Int?)],
         onSave: @escaping (ScanWardrobe) -> Void, onDelete: @escaping () -> Void) {
        _w = State(initialValue: wardrobe)
        self.wallName = wallName
        self.wallLength = wallLength
        self.conflicts = conflicts
        self.onSave = onSave
        self.onDelete = onDelete
    }

    private static let dims: [(key: String, name: String)] = [
        ("w", "Szerokość"), ("h", "Wysokość"), ("d", "Głębokość"), ("o", "Od lewego narożnika"),
        ("p", "Cokół"), ("t", "Blenda górna"),
    ]

    private func dimValue(_ k: String) -> Double {
        switch k {
        case "w": return w.widthMm
        case "h": return w.heightMm
        case "d": return w.depthMm
        case "o": return w.offsetMm
        case "p": return w.plinthMm
        default: return w.topMm
        }
    }

    private func setDim(_ k: String, _ v: Double) {
        let v = max(v.rounded(), 0)
        switch k {
        case "w": if v >= 300 { w.widthMm = v }
        case "h": if v >= 500 { w.heightMm = v }
        case "d": if v >= 100 { w.depthMm = v }
        case "o": w.offsetMm = v
        case "p": w.plinthMm = v
        default: w.topMm = v
        }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                drawing
                Divider()
                ScrollView { panel.padding(20) }
                    .frame(width: 400)
                    .background(Color(.systemGroupedBackground))
            }
            .navigationTitle("Szafa · ściana \(wallName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") {
                        onSave(w)
                        dismiss()
                    }.bold()
                }
            }
            .sheet(item: $edit) { e in
                switch e {
                case .dim(let k):
                    MeasureSheet(title: "Szafa — \(Self.dims.first { $0.key == k }?.name.lowercased() ?? "")", initial: dimValue(k)) { setDim(k, $0) }
                case .secWidth(let k):
                    MeasureSheet(title: "Sekcja \(k + 1) — szerokość w świetle", initial: WardrobeGeom.sectionWidth(w, k)) { v in
                        if w.sections.indices.contains(k), v >= 100 { w.sections[k].widthMm = v.rounded() }
                    }
                case .zoneHeight(let k, let j):
                    MeasureSheet(title: "Sekcja \(k + 1) — wysokość strefy", initial: WardrobeGeom.zoneHeight(w, section: k, zone: j)) { v in
                        if w.sections.indices.contains(k), w.sections[k].zones.indices.contains(j), v >= 50 {
                            w.sections[k].zones[j].heightMm = v.rounded()
                        }
                    }
                }
            }
        }
    }

    // MARK: Rysunek

    private struct Map {
        let s, x0, yb: Double
        func p(_ t: Double, _ z: Double) -> CGPoint { CGPoint(x: x0 + t * s, y: yb - z * s) }
        func inv(_ q: CGPoint) -> (Double, Double) { ((q.x - x0) / s, (yb - q.y) / s) }
    }

    private func map(_ size: CGSize) -> Map {
        let m = 80.0
        let s = max(0.01, min((size.width - 2 * m) / max(w.widthMm, 1), (size.height - 2 * m) / max(w.heightMm, 1)))
        return Map(s: s, x0: (size.width - w.widthMm * s) / 2, yb: (size.height + w.heightMm * s) / 2)
    }

    private var drawing: some View {
        GeometryReader { geo in
            let M = map(geo.size)
            Canvas { ctx, _ in
                WardrobeDraw.draw(ctx, w, s: M.s, p: M.p, selectedSection: section, selectedZone: zone)
                let bg = PlanStyle.canvas
                Draft.dimension(ctx, M.p(0, 0), M.p(w.widthMm, 0), out: CGVector(dx: 0, dy: 1), off: 34,
                                text: "\(Int(w.widthMm.rounded()))", color: PlanStyle.wall, bg: bg)
                Draft.dimension(ctx, M.p(0, 0), M.p(0, w.heightMm), out: CGVector(dx: -1, dy: 0), off: 36,
                                text: "\(Int(w.heightMm.rounded()))", color: PlanStyle.wall, bg: bg)
                for sec in WardrobeGeom.sections(w) where (sec.t1 - sec.t0) * M.s > 30 {
                    Draft.dimension(ctx, M.p(sec.t0, w.heightMm), M.p(sec.t1, w.heightMm), out: CGVector(dx: 0, dy: -1), off: 26,
                                    text: "\(Int((sec.t1 - sec.t0).rounded()))",
                                    color: sec.index == section ? PlanStyle.selected : PlanStyle.dim, bg: bg)
                }
                ctx.draw(Text("Głębokość \(Int(w.depthMm.rounded())) · \(w.doorsLabel)")
                            .font(.footnote).foregroundColor(.secondary),
                         at: CGPoint(x: geo.size.width / 2, y: 24))
            }
            .contentShape(Rectangle())
            .onTapGesture { q in
                let (t, z) = M.inv(q)
                let secs = WardrobeGeom.sections(w)
                guard let sec = secs.first(where: { t >= $0.t0 - 9 && t <= $0.t1 + 9 }) else { section = nil; zone = nil; return }
                section = sec.index
                zone = sec.zones.first { z >= $0.z0 - 9 && z <= $0.z1 + 9 }?.index
            }
        }
        .background(PlanStyle.canvas)
    }

    // MARK: Panel

    private var panel: some View {
        VStack(alignment: .leading, spacing: 18) {
            let cs = conflicts(w)
            if !cs.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Za szafą jest element z wymaganym dostępem", systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(FeatureDraw.accessColor)
                    ForEach(cs, id: \.feature.id) { c in
                        Text("• \(FeatureKind(key: c.feature.kind).label) \(Int(c.feature.widthMm.rounded()))×\(Int(c.feature.heightMm.rounded())), \(Int(c.feature.elevationMm.rounded())) od podłogi"
                             + (c.section.map { " — sekcja \($0 + 1): bez pleców / drzwiczki rewizyjne" } ?? ""))
                            .font(.caption)
                    }
                }
                .padding(12)
                .background(FeatureDraw.accessColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            }

            card("Wymiary") {
                ForEach(Self.dims, id: \.key) { d in
                    Button { edit = .dim(d.key) } label: {
                        HStack {
                            Text(d.name).foregroundStyle(.primary)
                            Spacer()
                            Text("\(Int(dimValue(d.key).rounded())) mm").monospacedDigit().foregroundStyle(.secondary)
                            Image(systemName: "pencil").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                if w.offsetMm + w.widthMm > wallLength + 1 {
                    Text("Szafa wychodzi poza ścianę (\(Int(wallLength.rounded())) mm).").font(.caption).foregroundStyle(.red)
                }
            }

            card("Fronty") {
                Picker("Drzwi", selection: $w.doors) {
                    Text("Przesuwne").tag("sliding")
                    Text("Uchylne").tag("hinged")
                    Text("Bez drzwi").tag("none")
                }
                .pickerStyle(.segmented)
                if w.doors != "none" {
                    Stepper("Skrzydła: \(w.doorCount)", value: $w.doorCount, in: 1...10)
                }
            }

            card("Sekcje") {
                Stepper("Liczba sekcji: \(w.sections.count)", value: Binding(
                    get: { w.sections.count },
                    set: { n in setSectionCount(n) }
                ), in: 1...10)
                Button("Wyrównaj szerokości") {
                    for k in w.sections.indices { w.sections[k].widthMm = nil }
                }
                .font(.subheadline)
                Text("Stuknij sekcję na rysunku, żeby ustawić jej wnętrze.").font(.caption).foregroundStyle(.secondary)
            }

            if let k = section, w.sections.indices.contains(k) { sectionCard(k) }

            card("Notatka") {
                TextField("np. lustro na środkowych drzwiach, oświetlenie LED…", text: Binding(
                    get: { w.note ?? "" }, set: { w.note = $0.isEmpty ? nil : $0 }
                ), axis: .vertical)
                .lineLimit(2...6)
            }

            Button(role: .destructive) { confirmDelete = true } label: {
                Label("Usuń szafę", systemImage: "trash").frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .confirmationDialog("Usunąć szafę?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Usuń", role: .destructive) {
                    onDelete()
                    dismiss()
                }
            }
        }
    }

    private func setSectionCount(_ n: Int) {
        if n > w.sections.count {
            let last = w.sections.last ?? WardrobeSection(widthMm: nil, zones: WardrobePreset.railShelf.zones)
            while w.sections.count < n { w.sections.append(WardrobeSection(widthMm: nil, zones: last.zones)) }
        } else if n < w.sections.count, n >= 1 {
            w.sections.removeLast(w.sections.count - n)
        }
        if let s = section, s >= w.sections.count { section = w.sections.count - 1; zone = nil }
    }

    private func sectionCard(_ k: Int) -> some View {
        let sec = w.sections[k]
        return card("Sekcja \(k + 1)") {
            HStack {
                Button { edit = .secWidth(k) } label: {
                    Label("\(Int(WardrobeGeom.sectionWidth(w, k).rounded())) mm" + (sec.widthMm == nil ? " (auto)" : ""), systemImage: "arrow.left.and.right")
                        .font(.subheadline.monospacedDigit())
                }
                .buttonStyle(.bordered)
                if sec.widthMm != nil {
                    Button("Auto") { w.sections[k].widthMm = nil }.buttonStyle(.bordered).font(.subheadline)
                }
                Spacer()
                Menu {
                    ForEach(WardrobePreset.allCases) { p in
                        Button(p.label) {
                            w.sections[k].zones = p.zones
                            zone = nil
                        }
                    }
                } label: {
                    Label("Układ", systemImage: "square.grid.2x2")
                }
                .buttonStyle(.bordered)
            }

            Text("Strefy od góry").font(.caption).foregroundStyle(.secondary)
            // Na liście od góry — tak jak na rysunku.
            ForEach(Array(sec.zones.indices.reversed()), id: \.self) { j in
                zoneRow(k, j)
            }

            Menu {
                ForEach(ZoneKind.allCases) { z in
                    Button { addZone(k, z) } label: { Label(z.label, systemImage: z.symbol) }
                }
            } label: {
                Label("Dodaj strefę", systemImage: "plus")
            }
            .buttonStyle(.bordered)
            Text("Strefa „auto” wypełnia resztę wysokości. Nowa strefa ląduje na górze.").font(.caption).foregroundStyle(.secondary)
        }
    }

    private func zoneRow(_ k: Int, _ j: Int) -> some View {
        let zn = w.sections[k].zones[j]
        let kind = ZoneKind(key: zn.kind)
        let n = w.sections[k].zones.count
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Menu {
                    ForEach(ZoneKind.allCases) { z in
                        Button { w.sections[k].zones[j].kind = z.rawValue } label: { Label(z.label, systemImage: z.symbol) }
                    }
                } label: {
                    Label(kind.label, systemImage: kind.symbol).font(.subheadline.weight(.medium))
                }
                Spacer()
                Button { edit = .zoneHeight(k, j) } label: {
                    Text("\(Int(WardrobeGeom.zoneHeight(w, section: k, zone: j).rounded()))" + (zn.heightMm == nil ? " auto" : ""))
                        .font(.caption.monospacedDigit())
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            HStack(spacing: 8) {
                if kind.hasCount {
                    Stepper("\(kind == .drawers ? "Szuflady" : kind == .shoes ? "Półki" : "Przegródki"): \(zn.count ?? 1)",
                            value: Binding(get: { zn.count ?? 1 }, set: { w.sections[k].zones[j].count = $0 }), in: 1...12)
                        .font(.caption)
                }
                Spacer()
                if zn.heightMm != nil {
                    Button("auto") { w.sections[k].zones[j].heightMm = nil }.font(.caption)
                }
                Button { move(k, j, 1) } label: { Image(systemName: "arrow.up") }.disabled(j == n - 1)
                Button { move(k, j, -1) } label: { Image(systemName: "arrow.down") }.disabled(j == 0)
                Button(role: .destructive) {
                    w.sections[k].zones.remove(at: j)
                    zone = nil
                } label: { Image(systemName: "trash") }
                .disabled(n <= 1)
            }
            .buttonStyle(.borderless)
        }
        .padding(10)
        .background(section == k && zone == j ? PlanStyle.selected.opacity(0.1) : Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 10))
        .contentShape(Rectangle())
        .onTapGesture { zone = j }
    }

    private func addZone(_ k: Int, _ z: ZoneKind) {
        w.sections[k].zones.append(WardrobeZone(kind: z.rawValue, heightMm: z.typicalHeight, count: z.hasCount ? 3 : nil))
        zone = w.sections[k].zones.count - 1
    }

    private func move(_ k: Int, _ j: Int, _ d: Int) {
        let to = j + d
        guard w.sections[k].zones.indices.contains(to) else { return }
        w.sections[k].zones.swapAt(j, to)
        zone = to
    }

    private func card<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}
