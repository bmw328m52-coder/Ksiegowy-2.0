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
    /// Otwór, którego pion (parapet / wysokość / nadproże) jest wymiarowany z prawej.
    var selectedOpening: String?
    var onSelectOpening: (String) -> Void = { _ in }
    /// Stuknięcie w odcinek przy otworze — pomiar dalmierzem.
    var onTapSegment: (PlanGeom.Segment) -> Void = { _ in }
    /// Meble/sprzęty stojące przy tej ścianie (włączane w widoku).
    var showObjects = true

    var body: some View {
        GeometryReader { geo in
            let m = PlanModel(scan)
            let g = m.walls.indices.contains(wallIndex) ? m.walls[wallIndex] : nil
            let markers = g.map { w in scan.markers.filter { $0.wallId == w.w.id } } ?? []
            let active = g.flatMap { ElevationDraw.activeSpan($0, selectedOpening) }
            Canvas { ctx, size in
                guard let g, let L = ElevLayout(size, g) else { return }
                ElevationDraw.draw(ctx, L, g, markers: markers, selected: selectedMarker, active: active?.id,
                                   objects: showObjects ? ElevationDraw.objectsOnWall(scan, g) : [])
            }
            .contentShape(Rectangle())
            .onTapGesture { loc in
                guard let g, let L = ElevLayout(geo.size, g) else { return }
                if let d = ElevationDraw.hitDimension(loc, L, g, active: active) {
                    switch d {
                    case .length: onTapLength()
                    case .height: onTapHeight()
                    case .segment(let s): onTapSegment(s)
                    }
                    return
                }
                let hit = markers
                    .map { ($0.id, hypot(L.p($0.offsetMm, $0.heightMm).x - loc.x, L.p($0.offsetMm, $0.heightMm).y - loc.y)) }
                    .filter { $0.1 < 24 }
                    .min { $0.1 < $1.1 }
                if let hit { onTap(0, 0, hit.0); return }
                let (t, z) = L.inv(loc)
                guard t >= 0, t <= L.W, z >= 0, z <= L.H else { return }
                // W otworze nie ma instalacji — stuknięcie wybiera otwór do wymiarowania w pionie.
                if let sp = g.spans.first(where: { t >= $0.t0 && t <= $0.t1 && z >= $0.bottom && z <= $0.top }) {
                    onSelectOpening(sp.id)
                    return
                }
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
    /// Odsunięcia wymiarów (pt): odcinki u góry, długość na dole, wysokość z lewej, pion otworu z prawej.
    static let topOff = 34.0, bottomOff = 44.0, leftOff = 46.0, rightOff = 40.0

    /// Otwór wymiarowany w pionie: zaznaczony, a jak żaden — pierwszy na ścianie.
    static func activeSpan(_ g: PlanModel.Wall, _ id: String?) -> PlanGeom.Span? {
        g.spans.first { $0.id == id } ?? g.spans.first
    }

    static func topSegments(_ g: PlanModel.Wall, _ L: ElevLayout) -> [PlanGeom.SegmentDim] {
        PlanGeom.horizontalSegments(g.spans, len: L.W).filter { ($0.b - $0.a) * L.s > 22 }
    }

    static func sideSegments(_ sp: PlanGeom.Span?, _ L: ElevLayout) -> [PlanGeom.SegmentDim] {
        guard let sp else { return [] }
        return PlanGeom.verticalSegments(sp, height: L.H).filter { ($0.b - $0.a) * L.s > 16 }
    }

    enum Hit { case length, height, segment(PlanGeom.Segment) }

    static func hitDimension(_ q: CGPoint, _ L: ElevLayout, _ g: PlanModel.Wall, active: PlanGeom.Span?) -> Hit? {
        var best: (Hit, Double)?
        // Prostokąt wokół napisu: `along` wzdłuż linii wymiarowej, `across` w poprzek.
        func consider(_ h: Hit, _ c: CGPoint, horizontal: Bool, along: Double) {
            let dx = abs(q.x - c.x), dy = abs(q.y - c.y)
            let (a, b) = horizontal ? (dx, dy) : (dy, dx)
            guard a < along, b < 24 else { return }
            let d = a / along + b / 24
            if best == nil || d < best!.1 { best = (h, d) }
        }
        consider(.length, L.p(L.W / 2, 0) + CGVector(dx: 0, dy: bottomOff), horizontal: true, along: 60)
        consider(.height, L.p(0, L.H / 2) + CGVector(dx: -leftOff, dy: 0), horizontal: false, along: 60)
        for d in topSegments(g, L) {
            consider(.segment(d.seg), L.p((d.a + d.b) / 2, L.H) + CGVector(dx: 0, dy: -topOff),
                     horizontal: true, along: min(50, max(18, (d.b - d.a) * L.s / 2)))
        }
        for d in sideSegments(active, L) {
            consider(.segment(d.seg), L.p(L.W, (d.a + d.b) / 2) + CGVector(dx: rightOff, dy: 0),
                     horizontal: false, along: min(50, max(14, (d.b - d.a) * L.s / 2)))
        }
        return best?.0
    }

    /// Mebel w widoku ściany: wzdłuż t0…t1, w pionie z0…z1.
    struct Front { let t0, t1, z0, z1: Double; let category: String }

    /// Meble przy ścianie: od strony pomieszczenia, najbliższy narożnik ≤ 350 mm od ściany,
    /// rzut na oś ściany zachodzi na ścianę. Bliższe rysowane na wierzchu.
    static func objectsOnWall(_ scan: ScanPayload, _ g: PlanModel.Wall) -> [Front] {
        var out: [(Front, Double)] = []
        for o in scan.objects {
            let cs = PlanEdit.corners(o)
            let ds = cs.map { PlanGeom.dot($0 - g.w.a, g.inN) }
            let ts = cs.map { PlanGeom.dot($0 - g.w.a, g.dir) }
            guard let near = ds.min(), near > -80, near < 350 else { continue }
            let t0 = max(ts.min()!, 0), t1 = min(ts.max()!, g.len)
            guard t1 - t0 > 20 else { continue }
            out.append((Front(t0: t0, t1: t1, z0: o.elevationMm, z1: min(o.elevationMm + o.heightMm, g.w.heightMm),
                              category: o.category), near))
        }
        return out.sorted { $0.1 > $1.1 }.map(\.0)
    }

    static func drawFront(_ ctx: GraphicsContext, _ L: ElevLayout, _ f: Front) {
        let a = L.p(f.t0, f.z1), b = L.p(f.t1, f.z0)
        let r = CGRect(x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y)
        guard r.width > 2, r.height > 2 else { return }
        let ink = GraphicsContext.Shading.color(Color(white: 0.3))
        ctx.fill(Path(r), with: .color(Color(red: 0.93, green: 0.91, blue: 0.88).opacity(0.92)))
        ctx.stroke(Path(r), with: ink, lineWidth: 1.2)
        let inset = r.insetBy(dx: min(4, r.width / 6), dy: min(4, r.height / 6))
        switch f.category {
        case "refrigerator":
            let split = inset.minY + inset.height * 0.38
            ctx.stroke(Path(inset), with: ink, lineWidth: 0.8)
            ctx.stroke(Draft.line(CGPoint(x: inset.minX, y: split), CGPoint(x: inset.maxX, y: split)), with: ink, lineWidth: 0.8)
        case "oven":
            ctx.stroke(Path(inset), with: ink, lineWidth: 0.8)
            ctx.stroke(Path(inset.insetBy(dx: inset.width * 0.12, dy: inset.height * 0.25)), with: ink, lineWidth: 0.8)
        case "dishwasher", "washerDryer":
            ctx.stroke(Draft.line(CGPoint(x: inset.minX, y: inset.minY + 10), CGPoint(x: inset.maxX, y: inset.minY + 10)), with: ink, lineWidth: 0.8)
            if f.category == "washerDryer" {
                let d = min(inset.width, inset.height) * 0.5
                ctx.stroke(Path(ellipseIn: CGRect(x: inset.midX - d / 2, y: inset.midY - d / 2 + 5, width: d, height: d)), with: ink, lineWidth: 0.8)
            }
        case "storage" where f.z0 >= 1000:
            // Szafka wisząca: uchwyt przy dolnej krawędzi.
            ctx.stroke(Draft.line(CGPoint(x: r.midX - 8, y: r.maxY - 8), CGPoint(x: r.midX + 8, y: r.maxY - 8)), with: ink, lineWidth: 1.5)
        case "storage", "stove", "sink":
            // Front szafki: blat u góry + uchwyt.
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY + 6), CGPoint(x: r.maxX, y: r.minY + 6)), with: ink, lineWidth: 0.8)
            ctx.stroke(Draft.line(CGPoint(x: r.midX - 8, y: r.minY + 16), CGPoint(x: r.midX + 8, y: r.minY + 16)), with: ink, lineWidth: 1.5)
        default:
            break
        }
        let name = scanObjectLabels[f.category] ?? f.category
        if r.width > 34, r.height > 26 {
            ctx.draw(Text(name).font(.system(size: 10, weight: .semibold)).foregroundColor(Color(white: 0.25)),
                     at: CGPoint(x: r.midX, y: r.maxY - 22))
            ctx.draw(Text("\(Int((f.t1 - f.t0).rounded()))").font(.system(size: 9).monospacedDigit()).foregroundColor(Color(white: 0.4)),
                     at: CGPoint(x: r.midX, y: r.maxY - 10))
        }
    }

    static func draw(_ ctx: GraphicsContext, _ L: ElevLayout, _ g: PlanModel.Wall, markers: [ScanMarker], selected: String?, active: String?,
                     objects: [Front] = []) {
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
            if sp.id == active, g.spans.count > 1 {
                ctx.stroke(Path(r.insetBy(dx: -4, dy: -4)), with: .color(PlanStyle.selected), lineWidth: 2)
            }
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

        for f in objects { drawFront(ctx, L, f) }

        // Wymiary: odcinki u góry, długość na dole, wysokość z lewej, pion aktywnego otworu z prawej.
        // Niebieskie z kłódką = zmierzone; stuknięcie w liczbę = pomiar dalmierzem.
        let bg = PlanStyle.canvas
        for d in topSegments(g, L) {
            Draft.dimension(ctx, p(d.a, H), p(d.b, H), out: CGVector(dx: 0, dy: -1), off: topOff,
                            text: "\(Int((d.b - d.a).rounded()))", color: d.measured ? PlanStyle.measured : PlanStyle.dim,
                            locked: d.measured, bg: bg)
        }
        let act = g.spans.first { $0.id == active }
        if let act {
            // Przerywane prowadnice od otworu do pionowego wymiaru.
            for z in [act.bottom, act.top] {
                ctx.stroke(Draft.line(p(act.t1, z), p(W, z)), with: .color(PlanStyle.dim.opacity(0.4)),
                           style: StrokeStyle(lineWidth: 0.6, dash: [3, 3]))
            }
        }
        for d in sideSegments(act, L) {
            Draft.dimension(ctx, p(W, d.a), p(W, d.b), out: CGVector(dx: 1, dy: 0), off: rightOff,
                            text: "\(Int((d.b - d.a).rounded()))", color: d.measured ? PlanStyle.measured : PlanStyle.dim,
                            locked: d.measured, bg: bg)
        }
        let locked = g.w.measured == true
        Draft.dimension(ctx, p(0, 0), p(W, 0), out: CGVector(dx: 0, dy: 1), off: bottomOff,
                        text: "\(Int(W.rounded()))", color: locked ? PlanStyle.measured : PlanStyle.wall, locked: locked, bg: bg)
        Draft.dimension(ctx, p(0, 0), p(0, H), out: CGVector(dx: -1, dy: 0), off: leftOff,
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
