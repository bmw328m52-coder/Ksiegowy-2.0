import SwiftUI

/// Widok ściany z przodu (jak „Elevation View" w MagicPlan): okna/drzwi
/// z odległościami od narożników, parapetem i nadprożem, punkty instalacji.
/// Stuknięcie: w punkt → edycja, w ścianę → nowy punkt w tym miejscu (mm).
struct ElevationCanvas: View {
    let scan: ScanPayload
    let wallIndex: Int
    var selectedMarker: String?
    var onTap: (_ t: Double, _ z: Double, _ marker: String?) -> Void = { _, _, _ in }
    /// Stuknięcie w wymiar długości (dół) / wysokości (lewo) — pomiar dalmierzem.
    var onTapLength: () -> Void = {}
    var onTapHeight: () -> Void = {}

    var body: some View {
        GeometryReader { geo in
            let m = PlanModel(scan)
            let g = m.walls.indices.contains(wallIndex) ? m.walls[wallIndex] : nil
            let markers = g.map { w in scan.markers.filter { $0.wallId == w.w.id } } ?? []
            Canvas { ctx, size in
                guard let g, let L = ElevLayout(size, g) else { return }
                ElevationDraw.draw(ctx, L, g, markers: markers, selected: selectedMarker)
            }
            .contentShape(Rectangle())
            .onTapGesture { loc in
                guard let g, let L = ElevLayout(geo.size, g) else { return }
                let midX = L.x0 + L.W * L.s / 2, midY = L.yb - L.H * L.s / 2
                if abs(loc.x - midX) < 60, abs(loc.y - (L.yb + 44)) < 26 { onTapLength(); return }
                if abs(loc.y - midY) < 60, abs(loc.x - (L.x0 - 46)) < 26 { onTapHeight(); return }
                let hit = markers
                    .map { ($0.id, hypot(L.p($0.offsetMm, $0.heightMm).x - loc.x, L.p($0.offsetMm, $0.heightMm).y - loc.y)) }
                    .filter { $0.1 < 24 }
                    .min { $0.1 < $1.1 }
                if let hit { onTap(0, 0, hit.0); return }
                let (t, z) = L.inv(loc)
                guard t >= 0, t <= L.W, z >= 0, z <= L.H else { return }
                onTap((t / 10).rounded() * 10, (z / 10).rounded() * 10, nil)
            }
        }
        .background(PlanStyle.canvas)
    }
}

/// mm ściany (t wzdłuż, z w górę) ↔ punkty ekranu.
struct ElevLayout {
    let W, H, s, x0, yb: Double

    init?(_ size: CGSize, _ g: PlanModel.Wall) {
        W = g.len
        H = g.w.heightMm
        guard W > 1, H > 1 else { return nil }
        let margin = 110.0
        s = min((size.width - 2 * margin) / W, (size.height - 2 * margin) / H)
        x0 = (size.width - W * s) / 2
        yb = (size.height + H * s) / 2
    }

    func p(_ t: Double, _ z: Double) -> CGPoint { CGPoint(x: x0 + t * s, y: yb - z * s) }
    func inv(_ q: CGPoint) -> (Double, Double) { ((q.x - x0) / s, (yb - q.y) / s) }
}

enum ElevationDraw {
    static func draw(_ ctx: GraphicsContext, _ L: ElevLayout, _ g: PlanModel.Wall, markers: [ScanMarker], selected: String?) {
        let (H, W, s) = (L.H, L.W, L.s)
        func p(_ t: Double, _ z: Double) -> CGPoint { L.p(t, z) }
        let ink = GraphicsContext.Shading.color(PlanStyle.wall)

        // Boczne ściany w perspektywie.
        let side = 70.0
        for (edge, dirX) in [(0.0, -1.0), (W, 1.0)] {
            let top = p(edge, H), bot = p(edge, 0)
            let shape = Draft.poly([
                top, bot,
                CGPoint(x: bot.x + dirX * side, y: bot.y + side * 1.4),
                CGPoint(x: top.x + dirX * side, y: top.y - side * 1.4),
            ])
            ctx.fill(shape, with: .color(Color(white: 0.8)))
            ctx.stroke(shape, with: ink, lineWidth: 0.8)
        }

        let wallRect = Path(CGRect(x: L.x0, y: L.yb - H * s, width: W * s, height: H * s))
        ctx.fill(wallRect, with: .color(Color(white: 0.97)))
        ctx.stroke(wallRect, with: ink, lineWidth: 1.2)

        for sp in g.spans {
            let r = CGRect(x: p(sp.t0, 0).x, y: p(0, sp.top).y, width: (sp.t1 - sp.t0) * s, height: (sp.top - sp.bottom) * s)
            ctx.fill(Path(r), with: .color(.white))
            ctx.stroke(Path(r), with: ink, lineWidth: 2)
            switch sp.kind {
            case "window":
                let frame = r.insetBy(dx: 7, dy: 7)
                ctx.stroke(Path(frame), with: ink, lineWidth: 1.2)
                let glass = frame.insetBy(dx: 10, dy: 10)
                ctx.stroke(Path(glass), with: ink, lineWidth: 1.2)
                let c = CGPoint(x: glass.midX, y: glass.midY)
                for k in [-8.0, 0, 8] {
                    ctx.stroke(Draft.line(CGPoint(x: c.x - 18 + k, y: c.y + 18 + k / 2), CGPoint(x: c.x + 14 + k, y: c.y - 14 + k / 2)), with: ink, lineWidth: 1)
                }
                ctx.stroke(Path(roundedRect: CGRect(x: frame.maxX - 8, y: frame.midY - 14, width: 5, height: 26), cornerRadius: 2), with: ink, lineWidth: 1.2)
            case "door":
                let leaf = r.insetBy(dx: 6, dy: 0).offsetBy(dx: 0, dy: 3)
                ctx.stroke(Path(CGRect(x: leaf.minX, y: leaf.minY + 3, width: leaf.width, height: leaf.height - 6)), with: ink, lineWidth: 1)
                ctx.fill(Path(ellipseIn: CGRect(x: leaf.maxX - 16, y: leaf.midY, width: 8, height: 8)), with: ink)
            default:
                break
            }
        }

        // Wymiary: odcinki u góry, długość na dole, wysokość z lewej, pion otworów z prawej.
        let bg = PlanStyle.canvas
        if !g.spans.isEmpty {
            var cuts = [0.0]
            for sp in g.spans { cuts += [sp.t0, sp.t1] }
            cuts.append(W)
            for k in 0..<(cuts.count - 1) where cuts[k + 1] - cuts[k] > 5 {
                Draft.dimension(ctx, p(cuts[k], H), p(cuts[k + 1], H), out: CGVector(dx: 0, dy: -1), off: 34,
                                text: "\(Int((cuts[k + 1] - cuts[k]).rounded()))", color: PlanStyle.dim, bg: bg)
            }
            var zs = Set([0.0, H])
            for sp in g.spans { zs.insert(sp.bottom); zs.insert(sp.top) }
            let zl = zs.sorted()
            for k in 0..<(zl.count - 1) where zl[k + 1] - zl[k] > 5 {
                Draft.dimension(ctx, p(W, zl[k]), p(W, zl[k + 1]), out: CGVector(dx: 1, dy: 0), off: 40,
                                text: "\(Int((zl[k + 1] - zl[k]).rounded()))", color: PlanStyle.dim, bg: bg)
            }
        }
        let locked = g.w.measured == true
        Draft.dimension(ctx, p(0, 0), p(W, 0), out: CGVector(dx: 0, dy: 1), off: 44,
                        text: "\(Int(W.rounded()))", color: locked ? PlanStyle.measured : PlanStyle.wall, locked: locked, bg: bg)
        Draft.dimension(ctx, p(0, 0), p(0, H), out: CGVector(dx: -1, dy: 0), off: 46,
                        text: "\(Int(H.rounded()))", color: PlanStyle.wall, bg: bg)

        // Punkty instalacji: zaznaczony z liniami wymiarowymi od bliższego narożnika i od podłogi.
        for mk in markers where mk.id == selected {
            let c = p(mk.offsetMm, mk.heightMm)
            let fromLeft = mk.offsetMm <= W / 2
            let edge = fromLeft ? 0.0 : W
            let dist = abs(mk.offsetMm - edge)
            let col = PlanStyle.selected
            ctx.stroke(Draft.line(p(edge, mk.heightMm), c), with: .color(col.opacity(0.35)), style: StrokeStyle(lineWidth: 0.8, dash: [4, 3]))
            ctx.stroke(Draft.line(p(mk.offsetMm, 0), c), with: .color(col.opacity(0.35)), style: StrokeStyle(lineWidth: 0.8, dash: [4, 3]))
            if dist > 5 {
                Draft.dimension(ctx, p(min(edge, mk.offsetMm), mk.heightMm), p(max(edge, mk.offsetMm), mk.heightMm),
                                out: CGVector(dx: 0, dy: -1), off: 0, text: "\(Int(dist.rounded()))", color: col, bg: Color(white: 0.97))
            }
            if mk.heightMm > 5 {
                Draft.dimension(ctx, p(mk.offsetMm, 0), p(mk.offsetMm, mk.heightMm), out: CGVector(dx: 1, dy: 0), off: 0,
                                text: "\(Int(mk.heightMm.rounded()))", color: col, bg: Color(white: 0.97))
            }
        }
        for mk in markers {
            let c = p(mk.offsetMm, mk.heightMm)
            MarkerDraw.badge(ctx, MarkerKind(key: mk.kind), at: c, r: 13, selected: mk.id == selected)
            guard mk.id != selected else { continue }
            ctx.draw(Text("\(Int(mk.offsetMm.rounded())) · h \(Int(mk.heightMm.rounded()))")
                        .font(.system(size: 10, weight: .medium).monospacedDigit())
                        .foregroundColor(PlanStyle.dim),
                     at: CGPoint(x: c.x, y: c.y + 24))
        }
    }
}

/// Klawiatura do wpisania wymiaru (mm). Miejsce na przycisk dalmierza Bosch.
struct MeasureSheet: View {
    let title: String
    let initial: Double
    let onApply: (Double) -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var laser: Laser
    @State private var text = ""
    @State private var fromLaser = false

    private var value: Double? { Double(text.replacingOccurrences(of: ",", with: ".")) }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline)
                    Text("Wpisz wymiar w mm").font(.footnote).foregroundStyle(.secondary)
                }
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill").font(.title2).foregroundStyle(.secondary)
                }
            }

            LaserHint(fromLaser: fromLaser)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(text.isEmpty ? "\(Int(initial.rounded()))" : text)
                    .font(.system(size: 44, weight: .light).monospacedDigit())
                    .foregroundStyle(text.isEmpty ? .secondary : .primary)
                Text("mm").font(.title3).foregroundStyle(.secondary)
            }

            let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"]
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                ForEach(keys, id: \.self) { k in
                    Button {
                        if k == "⌫" { if !text.isEmpty { text.removeLast() } }
                        else if k == "," { if !text.contains(",") { text += text.isEmpty ? "0," : "," } }
                        else if text.count < 7 { text += k }
                        fromLaser = false
                    } label: {
                        Text(k).font(.title2).frame(maxWidth: .infinity, minHeight: 50)
                    }
                    .buttonStyle(.bordered)
                    .tint(.primary)
                }
            }

            Button {
                if let v = value { onApply(v) }
                dismiss()
            } label: {
                Text("Zastosuj").font(.headline).frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.ink)
            .disabled(value == nil)
        }
        .padding(24)
        .presentationDetents([.large])
        .onChange(of: laser.reading) { _, r in
            guard let r else { return }
            text = "\(Int(r.mm))"
            fromLaser = true
        }
    }
}
