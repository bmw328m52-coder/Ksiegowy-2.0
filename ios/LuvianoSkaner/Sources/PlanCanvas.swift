import SwiftUI

let scanObjectLabels: [String: String] = [
    "refrigerator": "Lodówka", "stove": "Kuchenka", "oven": "Piekarnik", "dishwasher": "Zmywarka",
    "sink": "Zlew", "storage": "Szafka", "washerDryer": "Pralka", "table": "Stół", "chair": "Krzesło",
    "sofa": "Sofa", "bed": "Łóżko", "toilet": "WC", "bathtub": "Wanna", "fireplace": "Kominek",
    "television": "TV", "stairs": "Schody",
]

enum PlanStyle {
    static let wall = Color(white: 0.08)
    static let band = Color(white: 0.76)
    static let canvas = Color(red: 0.945, green: 0.945, blue: 0.94)
    static let gridMinor = Color(white: 0.9)
    static let gridMajor = Color(red: 0.96, green: 0.84, blue: 0.76)
    static let dim = Color(white: 0.35)
    static let measured = Color(red: 0.12, green: 0.45, blue: 0.85)
    static let selected = Color(red: 0.12, green: 0.45, blue: 0.85)
}

/// Przeliczenie mm rzutu → punkty ekranu (dopasowanie do widoku).
struct PlanLayout {
    let scale, ox, oy, minX, minY: Double

    /// Dopasowanie do widoku, potem powiększenie `zoom` wokół środka i przesunięcie `pan` (pt).
    init(points: [V2], size: CGSize, margin: Double = 96, zoom: Double = 1, pan: CGSize = .zero) {
        let xs = points.map(\.x), ys = points.map(\.y)
        minX = xs.min() ?? 0
        minY = ys.min() ?? 0
        let w = max((xs.max() ?? 1) - minX, 1)
        let h = max((ys.max() ?? 1) - minY, 1)
        let s0 = max(0.005, min((size.width - 2 * margin) / w, (size.height - 2 * margin) / h))
        let cx = size.width / 2, cy = size.height / 2
        scale = s0 * zoom
        ox = cx + ((size.width - w * s0) / 2 - cx) * zoom + pan.width
        oy = cy + ((size.height - h * s0) / 2 - cy) * zoom + pan.height
    }

    func pt(_ p: V2) -> CGPoint { CGPoint(x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale) }
    func mm(_ q: CGPoint) -> V2 { V2((q.x - ox) / scale + minX, (q.y - oy) / scale + minY) }
}

extension CGPoint {
    static func + (a: CGPoint, b: CGVector) -> CGPoint { CGPoint(x: a.x + b.dx, y: a.y + b.dy) }
}

extension CGVector {
    init(_ v: V2) { self.init(dx: v.x, dy: v.y) }
    static func * (v: CGVector, k: Double) -> CGVector { CGVector(dx: v.dx * k, dy: v.dy * k) }
}

/// Wspólne elementy rysunku technicznego (rzut i widok ściany).
enum Draft {
    static func poly(_ pts: [CGPoint]) -> Path {
        var p = Path()
        p.addLines(pts)
        p.closeSubpath()
        return p
    }

    static func line(_ a: CGPoint, _ b: CGPoint) -> Path {
        var p = Path()
        p.move(to: a)
        p.addLine(to: b)
        return p
    }

    /// Napis obrócony wzdłuż kierunku (zawsze czytelny), z tłem przerywającym linię.
    static func label(_ ctx: GraphicsContext, _ text: Text, at p: CGPoint, dir: CGVector, bg: Color) {
        var a = atan2(dir.dy, dir.dx)
        if a > .pi / 2 + 0.01 { a -= .pi }
        if a < -.pi / 2 + 0.01 { a += .pi }
        var c = ctx
        c.translateBy(x: p.x, y: p.y)
        c.rotate(by: .radians(a))
        let r = c.resolve(text)
        let s = r.measure(in: CGSize(width: 400, height: 60))
        c.fill(Path(CGRect(x: -s.width / 2 - 4, y: -s.height / 2, width: s.width + 8, height: s.height)), with: .color(bg))
        c.draw(r, at: .zero)
    }

    /// Linia wymiarowa między p1 i p2 odsunięta o `off` punktów w kierunku `out`.
    static func dimension(_ ctx: GraphicsContext, _ p1: CGPoint, _ p2: CGPoint, out: CGVector, off: Double,
                          text: String, color: Color, locked: Bool = false, bg: Color) {
        let q1 = p1 + out * off, q2 = p2 + out * off
        let ext = Color(white: 0.55)
        ctx.stroke(line(p1 + out * 3, q1 + out * 5), with: .color(ext), lineWidth: 0.6)
        ctx.stroke(line(p2 + out * 3, q2 + out * 5), with: .color(ext), lineWidth: 0.6)
        ctx.stroke(line(q1, q2), with: .color(color), lineWidth: 0.9)

        let dx = q2.x - q1.x, dy = q2.y - q1.y
        let l = max((dx * dx + dy * dy).squareRoot(), 1)
        let u = CGVector(dx: dx / l, dy: dy / l)
        let n = CGVector(dx: -u.dy, dy: u.dx)
        let a = 7.0, w = 2.6
        if l > 2 * a + 4 {
            ctx.fill(poly([q1, q1 + u * a + n * w, q1 + u * a + n * -w]), with: .color(color))
            ctx.fill(poly([q2, q2 + u * -a + n * w, q2 + u * -a + n * -w]), with: .color(color))
        }
        var t = Text(text)
        if locked { t = t + Text(" \(Image(systemName: "lock.fill"))").font(.system(size: 8)) }
        label(ctx, t.font(.system(size: 12, weight: .medium).monospacedDigit()).foregroundColor(color),
              at: CGPoint(x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2), dir: u, bg: bg)
    }
}

enum PlanTool { case select, drawWall }

/// Rzut 2D w stylu MagicPlan: grube ściany, podłoga w kratkę, wymiary, symbole okien i drzwi.
/// Dwa palce = powiększenie, przeciąganie pustego miejsca = przesuwanie widoku.
/// Zaznaczona ściana: chwytaki narożników i środka (przesuwanie); zaznaczony mebel/otwór: przeciąganie.
struct PlanCanvas: View {
    @Binding var scan: ScanPayload
    let roomName: String
    @Binding var selected: Int?
    @Binding var selectedObject: String?
    @Binding var selectedOpening: String?
    var tool: PlanTool = .select
    /// Zmiana tego licznika (np. obrót) dopasowuje rzut na nowo.
    var fitToken = 0
    /// Stuknięcie w liczbę długości ściany — wpisanie wymiaru / pomiar dalmierzem (jak w MagicPlan).
    var onTapDimension: (Int) -> Void = { _ in }
    /// Stuknięcie w odcinek przy otworze (narożnik → okno, szerokość okna…).
    var onTapSegment: (Int, PlanGeom.Segment) -> Void = { _, _ in }
    /// Stuknięcie w odległość mebla od ściany / innego mebla (strona 0…3).
    var onTapGap: (String, Int) -> Void = { _, _ in }
    /// Przed zmianą rzutu (zrzut do „Cofnij") i po jej zakończeniu (zapis).
    var onEditBegan: () -> Void = {}
    var onEditEnded: () -> Void = {}
    var onWallDrawn: (Int) -> Void = { _ in }

    @State private var zoom = 1.0
    @State private var pan = CGSize.zero
    @State private var pinchBase: PinchBase?
    /// Granice rzutu zamrożone po pierwszej edycji — rysunek nie „skacze" przy przesuwaniu ścian.
    @State private var frozen: [V2]?
    @State private var drag: DragState?
    @State private var draft: Draft2?

    private struct PinchBase { let zoom: Double; let pan: CGSize }
    struct Draft2 { let a, b: V2 }

    private enum DragKind {
        case pan(CGSize)
        case corner(V2)
        case wall(Int)
        case object(String, V2)
        case opening(String, Int, Double)
        case draw(V2)
        case ignored
    }

    private struct DragState {
        var kind: DragKind
        let base: ScanPayload
        let layout: PlanLayout
    }

    var body: some View {
        GeometryReader { geo in
            let model = PlanModel(scan)
            let fit = frozen ?? model.walls.flatMap { [$0.w.a, $0.w.b] } + model.floor
            let layout = PlanLayout(points: fit, size: geo.size, zoom: zoom, pan: pan)
            let gaps = selectedObject.map { PlanEdit.gaps(scan, $0) } ?? []
            Canvas { ctx, _ in
                PlanDraw.draw(ctx, model, layout, roomName: roomName, selected: selected,
                              selectedObject: selectedObject, selectedOpening: selectedOpening,
                              gaps: gaps, draft: draft.map { ($0.a, $0.b) }, handles: tool == .select)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 6)
                    .onChanged { v in dragChanged(v, layout, fit) }
                    .onEnded { _ in dragEnded() }
            )
            .simultaneousGesture(
                MagnifyGesture()
                    .onChanged { v in pinch(v, geo.size) }
                    .onEnded { _ in pinchBase = nil }
            )
            .simultaneousGesture(
                SpatialTapGesture().onEnded { v in tap(v.location, model, layout, gaps) }
            )
            .overlay(alignment: .topLeading) {
                if zoom != 1 || pan != .zero || frozen != nil {
                    Button { refit() } label: { Label("Dopasuj", systemImage: "arrow.up.left.and.down.right.magnifyingglass") }
                        .buttonStyle(.bordered)
                        .padding(16)
                }
            }
        }
        .background(PlanStyle.canvas)
        .onChange(of: fitToken) { _, _ in refit() }
    }

    private func refit() {
        withAnimation(.easeInOut(duration: 0.2)) {
            zoom = 1
            pan = .zero
            frozen = nil
        }
    }

    private func tap(_ loc: CGPoint, _ model: PlanModel, _ L: PlanLayout, _ gaps: [PlanEdit.Gap]) {
        guard tool == .select else { return }
        switch PlanDraw.hitDimension(loc, model, L) {
        case .length(let i): onTapDimension(i); return
        case .segment(let i, let s): onTapSegment(i, s); return
        case nil: break
        }
        if let id = selectedObject, let g = gaps.first(where: { g in
            let c = L.pt((g.from + g.to) / 2)
            return hypot(c.x - loc.x, c.y - loc.y) < 24
        }) {
            onTapGap(id, g.side)
            return
        }
        let p = L.mm(loc)
        if let o = scan.objects.last(where: { PlanEdit.contains($0, p, margin: 8 / L.scale) }) {
            selectedObject = o.id
            selectedOpening = nil
            selected = nil
            return
        }
        if let hit = PlanDraw.hitOpening(loc, model, L) {
            selected = hit.wall
            selectedOpening = hit.id
            selectedObject = nil
            return
        }
        selectedObject = nil
        selectedOpening = nil
        selected = PlanDraw.hitWall(loc, model, L)
    }

    private func dragChanged(_ v: DragGesture.Value, _ layout: PlanLayout, _ fit: [V2]) {
        if pinchBase != nil { return }
        if drag == nil {
            let kind = startKind(v.startLocation, layout)
            switch kind {
            case .pan, .ignored: break
            case .draw: frozen = fit
            default:
                frozen = fit
                onEditBegan()
            }
            drag = DragState(kind: kind, base: scan, layout: layout)
        }
        guard let st = drag else { return }
        let L = st.layout
        let dm = V2(v.translation.width, v.translation.height) / L.scale
        let tol = 12 / L.scale
        switch st.kind {
        case .pan(let p0):
            pan = CGSize(width: p0.width + v.translation.width, height: p0.height + v.translation.height)
        case .corner(let c):
            var s = st.base
            PlanEdit.moveCorner(&s, from: c, to: PlanEdit.snapCorner(st.base, corner: c, to: c + dm, tol: tol))
            scan = s
        case .wall(let i):
            guard st.base.walls.indices.contains(i) else { return }
            let w = st.base.walls[i]
            let d = (PlanGeom.dot(dm, V2(-w.dir.y, w.dir.x)) / 5).rounded() * 5
            var s = st.base
            PlanEdit.moveWall(&s, i, by: d)
            scan = s
        case .object(let id, let c0):
            var s = st.base
            PlanEdit.moveObject(&s, id, to: c0 + dm, tol: 15 / L.scale)
            scan = s
        case .opening(let id, let i, let t0):
            guard st.base.walls.indices.contains(i) else { return }
            var s = st.base
            PlanEdit.slideOpening(&s, id, wall: i, t0: t0 + PlanGeom.dot(dm, st.base.walls[i].dir))
            scan = s
        case .draw(let a):
            draft = Draft2(a: a, b: PlanEdit.snapDraw(st.base, a + dm, from: a, tol: tol))
        case .ignored:
            break
        }
    }

    private func dragEnded() {
        defer { drag = nil; draft = nil }
        guard let st = drag else { return }
        switch st.kind {
        case .pan, .ignored:
            break
        case .draw:
            guard let d = draft, PlanGeom.dist(d.a, d.b) > 50 else { return }
            onEditBegan()
            if let i = PlanEdit.addWall(&scan, from: d.a, to: d.b) {
                onWallDrawn(i)
                onEditEnded()
            }
        default:
            onEditEnded()
        }
    }

    /// Co przeciągamy: w trybie rysowania — nową ścianę; inaczej zaznaczony element pod palcem, albo widok.
    private func startKind(_ loc: CGPoint, _ L: PlanLayout) -> DragKind {
        if tool == .drawWall {
            return .draw(PlanEdit.snapDraw(scan, L.mm(loc), from: nil, tol: 12 / L.scale))
        }
        func near(_ p: V2, _ r: Double) -> Bool { hypot(L.pt(p).x - loc.x, L.pt(p).y - loc.y) < r }
        let p = L.mm(loc)
        if let id = selectedOpening, let i = selected, scan.walls.indices.contains(i),
           let s = PlanGeom.spans(scan.walls[i], scan.openings).first(where: { $0.id == id }) {
            let w = scan.walls[i]
            let t = PlanGeom.dot(p - w.a, w.dir)
            let off = abs(PlanGeom.cross(w.dir, p - w.a)) * L.scale
            if t > s.t0 - 20 / L.scale, t < s.t1 + 20 / L.scale, off < 40 { return .opening(id, i, s.t0) }
        }
        if let i = selected, scan.walls.indices.contains(i) {
            let w = scan.walls[i]
            if near(w.a, 30) { return .corner(w.a) }
            if near(w.b, 30) { return .corner(w.b) }
            let m = PlanModel(scan)
            if m.walls.indices.contains(i) {
                let h = PlanDraw.wallHandle(m.walls[i], L)
                if hypot(h.x - loc.x, h.y - loc.y) < 30 { return .wall(i) }
            }
            if PlanDraw.segDist(loc, L.pt(w.a), L.pt(w.b)) < 22 { return .wall(i) }
        }
        if let id = selectedObject, let o = scan.objects.first(where: { $0.id == id }),
           PlanEdit.contains(o, p, margin: 15 / L.scale) {
            return .object(id, V2(o.cx, o.cy))
        }
        return .pan(pan)
    }

    private func pinch(_ v: MagnifyGesture.Value, _ size: CGSize) {
        if pinchBase == nil {
            pinchBase = PinchBase(zoom: zoom, pan: pan)
            // Drugi palec w trakcie przeciągania elementu — cofamy ruch, liczy się powiększenie.
            if let st = drag {
                if case .pan = st.kind {} else { scan = st.base }
                drag?.kind = .ignored
                draft = nil
            }
        }
        guard let b = pinchBase else { return }
        let z = min(max(b.zoom * v.magnification, 0.5), 14)
        let k = z / b.zoom
        let a = v.startLocation, c = CGPoint(x: size.width / 2, y: size.height / 2)
        zoom = z
        pan = CGSize(width: a.x + (c.x + b.pan.width - a.x) * k - c.x,
                     height: a.y + (c.y + b.pan.height - a.y) * k - c.y)
    }
}

enum PlanDraw {
    static func draw(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout, roomName: String, selected: Int?,
                     selectedObject: String? = nil, selectedOpening: String? = nil,
                     gaps: [PlanEdit.Gap] = [], draft: (V2, V2)? = nil, handles: Bool = false) {
        let T = PlanGeom.wallT

        // Podłoga w kratkę (10 cm, co 50 cm mocniej).
        if m.floor.count >= 3 {
            let floorPath = Draft.poly(m.floor.map(L.pt))
            ctx.fill(floorPath, with: .color(.white))
            var g = ctx
            g.clip(to: floorPath)
            let xs = m.floor.map(\.x), ys = m.floor.map(\.y)
            let (x0, x1, y0, y1) = (xs.min()!, xs.max()!, ys.min()!, ys.max()!)
            if L.scale * 100 > 4 {
                var x = (x0 / 100).rounded(.down) * 100
                while x <= x1 {
                    let major = Int((x / 100).rounded()) % 5 == 0
                    g.stroke(Draft.line(L.pt(V2(x, y0)), L.pt(V2(x, y1))), with: .color(major ? PlanStyle.gridMajor : PlanStyle.gridMinor), lineWidth: 0.6)
                    x += 100
                }
                var y = (y0 / 100).rounded(.down) * 100
                while y <= y1 {
                    let major = Int((y / 100).rounded()) % 5 == 0
                    g.stroke(Draft.line(L.pt(V2(x0, y)), L.pt(V2(x1, y))), with: .color(major ? PlanStyle.gridMajor : PlanStyle.gridMinor), lineWidth: 0.6)
                    y += 100
                }
            }
        }

        // Obrys z RoomPlan tam, gdzie brakuje ścian (pod ścianami — widać tylko w lukach).
        if !m.closed && m.gap == nil && m.floor.count >= 3 {
            ctx.stroke(Draft.poly(m.floor.map(L.pt)), with: .color(Color(white: 0.5)),
                       style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        }

        // Szary pas zewnętrzny + czarna ściana (narożniki na ucios).
        for i in m.walls.indices where m.walls[i].w.planned != true {
            let (o1a, o1b) = m.outer(i, T)
            let (o2a, o2b) = m.outer(i, T * 1.9)
            ctx.fill(Draft.poly([o1a, o1b, o2b, o2a].map(L.pt)), with: .color(PlanStyle.band))
        }
        for (i, g) in m.walls.enumerated() {
            let (oa, ob) = m.outer(i, T)
            let shape = Draft.poly([g.w.a, g.w.b, ob, oa].map(L.pt))
            let ink = selected == i ? PlanStyle.selected : PlanStyle.wall
            if g.w.planned == true {
                // Do wybudowania: kreskowanie zamiast pełnej ściany.
                ctx.fill(shape, with: .color(.white))
                hatch(ctx, shape, color: ink)
                ctx.stroke(shape, with: .color(ink), lineWidth: 1.2)
            } else {
                ctx.fill(shape, with: .color(ink))
            }
        }

        // Otwory: przerwa w ścianie + symbol.
        for g in m.walls {
            for s in g.spans {
                let gap = Draft.poly([g.at(s.t0, -2), g.at(s.t1, -2), g.at(s.t1, T * 1.9 + 2), g.at(s.t0, T * 1.9 + 2)].map(L.pt))
                ctx.fill(gap, with: .color(.white))
                let ink = GraphicsContext.Shading.color(PlanStyle.wall)
                switch s.kind {
                case "window":
                    ctx.stroke(Draft.poly([g.at(s.t0, 0), g.at(s.t1, 0), g.at(s.t1, T), g.at(s.t0, T)].map(L.pt)), with: ink, lineWidth: 1)
                    ctx.stroke(Draft.line(L.pt(g.at(s.t0, T * 0.4)), L.pt(g.at(s.t1, T * 0.4))), with: ink, lineWidth: 0.8)
                    ctx.stroke(Draft.line(L.pt(g.at(s.t0, T * 0.6)), L.pt(g.at(s.t1, T * 0.6))), with: ink, lineWidth: 0.8)
                case "door":
                    let w = s.t1 - s.t0
                    let hinge = g.at(s.t0)
                    let leaf = hinge + g.inN * w
                    ctx.stroke(Draft.line(L.pt(hinge), L.pt(leaf)), with: ink, lineWidth: 1.4)
                    var arc = Path()
                    arc.move(to: L.pt(leaf))
                    for k in 1...24 {
                        let f = Double(k) / 24 * .pi / 2
                        arc.addLine(to: L.pt(hinge + g.inN * (w * cos(f)) + g.dir * (w * sin(f))))
                    }
                    ctx.stroke(arc, with: ink, lineWidth: 0.9)
                    ctx.stroke(Draft.line(L.pt(g.at(s.t0, 0)), L.pt(g.at(s.t0, T))), with: ink, lineWidth: 1)
                    ctx.stroke(Draft.line(L.pt(g.at(s.t1, 0)), L.pt(g.at(s.t1, T))), with: ink, lineWidth: 1)
                default:
                    break
                }
            }
        }

        // Sprzęty / meble jako symbole architektoniczne.
        for o in m.objects {
            var t = ctx
            let c = L.pt(V2(o.cx, o.cy))
            t.translateBy(x: c.x, y: c.y)
            t.rotate(by: .degrees(o.rotationDeg))
            let r = CGRect(x: -o.widthMm * L.scale / 2, y: -o.depthMm * L.scale / 2, width: o.widthMm * L.scale, height: o.depthMm * L.scale)
            if o.category == "storage", o.elevationMm >= 1000 {
                // Szafka wisząca — jak na rysunku technicznym: linia przerywana, z przekątną.
                t.fill(Path(r), with: .color(Color.white.opacity(0.35)))
                t.stroke(Path(r), with: .color(Color(white: 0.35)), style: StrokeStyle(lineWidth: 1, dash: [5, 3]))
                t.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY)),
                         with: .color(Color(white: 0.55)), style: StrokeStyle(lineWidth: 0.7, dash: [5, 3]))
            } else {
                Symbols.draw(t, o.category, r, widthMm: o.widthMm)
            }
            if o.id == selectedObject {
                t.stroke(Path(r.insetBy(dx: -3, dy: -3)), with: .color(PlanStyle.selected), lineWidth: 2)
            }
        }
        for g in m.walls {
            for s in g.spans where s.id == selectedOpening {
                let r = Draft.poly([g.at(s.t0, -6), g.at(s.t1, -6), g.at(s.t1, T + 6), g.at(s.t0, T + 6)].map(L.pt))
                ctx.stroke(r, with: .color(PlanStyle.selected), lineWidth: 2.5)
            }
        }

        // Punkty instalacji przy wewnętrznej krawędzi ściany.
        for mk in m.markers {
            guard let g = m.walls.first(where: { $0.w.id == mk.wallId }) else { continue }
            let c = L.pt(g.at(min(max(mk.offsetMm, 0), g.len))) + CGVector(g.inN) * 13
            MarkerDraw.badge(ctx, MarkerKind(key: mk.kind), at: c, r: 9)
        }

        // Otwarte przejście — domknięcie obrysu linią przerywaną.
        if let gap = m.gap {
            ctx.stroke(Draft.line(L.pt(gap.0), L.pt(gap.1)), with: .color(Color(white: 0.5)),
                       style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        }

        // Wymiary: odcinki przy otworach + długość wewnętrzna ściany.
        for (i, g) in m.walls.enumerated() {
            let out = CGVector(g.out)
            let base = T * 1.9 * L.scale
            for d in segments(g, L) {
                Draft.dimension(ctx, L.pt(g.at(d.a, T * 1.9)) + out * -base, L.pt(g.at(d.b, T * 1.9)) + out * -base,
                                out: out, off: base + 18, text: "\(Int((d.b - d.a).rounded()))",
                                color: d.measured ? PlanStyle.measured : PlanStyle.dim, locked: d.measured, bg: PlanStyle.canvas)
            }
            let locked = g.w.measured == true
            Draft.dimension(ctx, L.pt(g.at(0)), L.pt(g.at(g.len)), out: out, off: lengthRow(g, L),
                            text: "\(Int(g.len.rounded()))", color: locked ? PlanStyle.measured : PlanStyle.wall,
                            locked: locked, bg: PlanStyle.canvas)

            // Litera tylko przy zaznaczonej ścianie (jak w MagicPlan — czysty rzut).
            guard selected == i else { continue }
            let mid = L.pt(g.at(g.len / 2)) + CGVector(g.inN) * 20
            let badge = Path(ellipseIn: CGRect(x: mid.x - 10, y: mid.y - 10, width: 20, height: 20))
            ctx.fill(badge, with: .color(PlanStyle.selected))
            ctx.draw(Text(wallLetter(i)).font(.system(size: 11, weight: .bold)).foregroundColor(.white), at: mid)
        }

        // Nazwa i powierzchnia na środku.
        if m.floor.count >= 3 {
            let c = L.pt(m.center)
            ctx.draw(Text(roomName).font(.system(size: 15, weight: .semibold)).foregroundColor(PlanStyle.wall), at: CGPoint(x: c.x, y: c.y - 9))
            ctx.draw(Text(String(format: "%.2f m²", m.areaM2)).font(.system(size: 12).monospacedDigit()).foregroundColor(Color(white: 0.4)), at: CGPoint(x: c.x, y: c.y + 10))
        }

        drawEditing(ctx, m, L, selected: selected, gaps: gaps, draft: draft, handles: handles)
    }

    /// Kreskowanie 45° wewnątrz kształtu.
    static func hatch(_ ctx: GraphicsContext, _ shape: Path, color: Color) {
        var c = ctx
        c.clip(to: shape)
        let b = shape.boundingRect
        var x = b.minX - b.height
        while x < b.maxX {
            c.stroke(Draft.line(CGPoint(x: x, y: b.maxY), CGPoint(x: x + b.height, y: b.minY)), with: .color(color), lineWidth: 0.8)
            x += 6
        }
    }

    /// Nakładki edycji: odległości mebla, chwytaki zaznaczonej ściany, rysowana ściana.
    static func drawEditing(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout, selected: Int?,
                            gaps: [PlanEdit.Gap], draft: (V2, V2)?, handles: Bool) {
        let blue = PlanStyle.selected
        for g in gaps where g.dist >= 1 {
            let a = L.pt(g.from), b = L.pt(g.to)
            ctx.stroke(Draft.line(a, b), with: .color(blue.opacity(0.5)), style: StrokeStyle(lineWidth: 0.8, dash: [4, 3]))
            Draft.dimension(ctx, a, b, out: CGVector(dx: -g.dir.y, dy: g.dir.x), off: 0,
                            text: "\(Int(g.dist.rounded()))", color: blue, bg: .white)
        }
        if handles, let i = selected, m.walls.indices.contains(i) {
            let g = m.walls[i]
            for p in [g.w.a, g.w.b] {
                let c = L.pt(p)
                let r = CGRect(x: c.x - 10, y: c.y - 10, width: 20, height: 20)
                ctx.fill(Path(ellipseIn: r), with: .color(.white))
                ctx.stroke(Path(ellipseIn: r), with: .color(blue), lineWidth: 2.5)
            }
            let h = wallHandle(g, L)
            var t = ctx
            t.translateBy(x: h.x, y: h.y)
            t.rotate(by: .radians(atan2(g.dir.y, g.dir.x)))
            let pill = Path(roundedRect: CGRect(x: -16, y: -9, width: 32, height: 18), cornerRadius: 9)
            t.fill(pill, with: .color(blue))
            t.draw(Text(Image(systemName: "arrow.up.and.down")).font(.system(size: 10, weight: .bold)).foregroundColor(.white), at: .zero)
        }
        if let dr = draft {
            let (a, b) = dr
            let d = b - a
            let l = PlanGeom.len(d)
            guard l > 1 else { return }
            let u = d / l, n = V2(-u.y, u.x) * PlanGeom.wallT
            let shape = Draft.poly([a, b, b + n, a + n].map(L.pt))
            ctx.fill(shape, with: .color(blue.opacity(0.15)))
            hatch(ctx, shape, color: blue)
            ctx.stroke(shape, with: .color(blue), lineWidth: 1.5)
            for p in [a, b] {
                let c = L.pt(p)
                ctx.fill(Path(ellipseIn: CGRect(x: c.x - 6, y: c.y - 6, width: 12, height: 12)), with: .color(blue))
            }
            Draft.dimension(ctx, L.pt(a), L.pt(b), out: CGVector(-V2(-u.y, u.x)), off: 26,
                            text: "\(Int(l.rounded()))", color: blue, bg: PlanStyle.canvas)
        }
    }

    /// Chwytak do przesuwania zaznaczonej ściany — od środka do wnętrza pomieszczenia.
    static func wallHandle(_ g: PlanModel.Wall, _ L: PlanLayout) -> CGPoint {
        L.pt(g.at(g.len / 2)) + CGVector(g.inN) * 34
    }

    /// Otwór pod palcem (na linii ściany, w granicach otworu).
    static func hitOpening(_ p: CGPoint, _ m: PlanModel, _ L: PlanLayout) -> (wall: Int, id: String)? {
        for (i, g) in m.walls.enumerated() {
            for s in g.spans {
                let a = L.pt(g.at(s.t0, PlanGeom.wallT / 2)), b = L.pt(g.at(s.t1, PlanGeom.wallT / 2))
                if segDist(p, a, b) < 20 { return (i, s.id) }
            }
        }
        return nil
    }

    /// Odsunięcie wymiaru długości od ściany (pt) — to samo co przy rysowaniu.
    static func lengthRow(_ g: PlanModel.Wall, _ L: PlanLayout) -> Double {
        PlanGeom.wallT * 1.9 * L.scale + 18 + (g.spans.isEmpty ? 0 : 26)
    }

    /// Odcinki przy otworach, które mieszczą się na rysunku.
    static func segments(_ g: PlanModel.Wall, _ L: PlanLayout) -> [PlanGeom.SegmentDim] {
        PlanGeom.horizontalSegments(g.spans, len: g.len).filter { ($0.b - $0.a) * L.scale > 30 }
    }

    enum Hit { case length(Int), segment(Int, PlanGeom.Segment) }

    /// Liczba wymiaru pod palcem: długość ściany albo odcinek przy otworze.
    static func hitDimension(_ p: CGPoint, _ m: PlanModel, _ L: PlanLayout) -> Hit? {
        var best: (Hit, Double)?
        func consider(_ h: Hit, _ c: CGPoint, _ r: Double) {
            let d = Double(hypot(p.x - c.x, p.y - c.y))
            if d < r, best == nil || d < best!.1 { best = (h, d) }
        }
        for (i, g) in m.walls.enumerated() {
            consider(.length(i), L.pt(g.at(g.len / 2)) + CGVector(g.out) * lengthRow(g, L), 34)
            for d in segments(g, L) {
                consider(.segment(i, d.seg), L.pt(g.at((d.a + d.b) / 2, PlanGeom.wallT * 1.9)) + CGVector(g.out) * 18, 24)
            }
        }
        return best?.0
    }

    /// Ściana pod palcem (linia ściany lub jej wymiar), w punktach ekranu.
    static func hitWall(_ p: CGPoint, _ m: PlanModel, _ L: PlanLayout) -> Int? {
        var best: (Int, Double)?
        for (i, g) in m.walls.enumerated() {
            let a = L.pt(g.at(0)), b = L.pt(g.at(g.len))
            for off in [0.0, 30.0, 55.0] {
                let o = CGVector(g.out) * off
                let d = segDist(p, a + o, b + o)
                if d < 26, best == nil || d < best!.1 { best = (i, d) }
            }
        }
        return best?.0
    }

    static func segDist(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> Double {
        let dx = b.x - a.x, dy = b.y - a.y
        let l2 = dx * dx + dy * dy
        let t = l2 > 0 ? max(0, min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
        let x = a.x + t * dx - p.x, y = a.y + t * dy - p.y
        return (x * x + y * y).squareRoot()
    }
}

/// Symbole mebli/sprzętów w lokalnym układzie (środek = 0,0; szerokość wzdłuż x).
enum Symbols {
    static func draw(_ ctx: GraphicsContext, _ category: String, _ r: CGRect, widthMm: Double) {
        let ink = GraphicsContext.Shading.color(PlanStyle.wall)
        let thin = 0.8
        let outline = Path(r)
        ctx.fill(outline, with: .color(.white))
        ctx.stroke(outline, with: ink, lineWidth: 1)
        let s = min(r.width, r.height)

        switch category {
        case "storage":
            // Szafka: przekątna + linia frontu.
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY)), with: ink, lineWidth: thin)
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.maxY - s * 0.12), CGPoint(x: r.maxX, y: r.maxY - s * 0.12)), with: ink, lineWidth: thin)
        case "refrigerator":
            ctx.stroke(Path(r.insetBy(dx: s * 0.08, dy: s * 0.08)), with: ink, lineWidth: thin)
            ctx.draw(Text("LOD").font(.system(size: max(7, min(11, s * 0.22)), weight: .semibold)).foregroundColor(PlanStyle.wall), at: .zero)
        case "stove":
            let rr = s * 0.17
            for (dx, dy) in [(-1.0, -1.0), (1, -1), (-1, 1), (1, 1)] {
                let c = CGPoint(x: dx * r.width / 4, y: dy * r.height / 4)
                ctx.stroke(Path(ellipseIn: CGRect(x: c.x - rr, y: c.y - rr, width: rr * 2, height: rr * 2)), with: ink, lineWidth: thin)
            }
        case "oven":
            ctx.stroke(Path(r.insetBy(dx: s * 0.12, dy: s * 0.12)), with: ink, lineWidth: thin)
        case "dishwasher":
            ctx.stroke(Path(r.insetBy(dx: s * 0.1, dy: s * 0.1)), with: ink, lineWidth: thin)
            ctx.draw(Text("ZM").font(.system(size: max(7, min(10, s * 0.22)), weight: .semibold)).foregroundColor(PlanStyle.wall), at: .zero)
        case "sink":
            let basin = r.insetBy(dx: r.width * 0.14, dy: r.height * 0.18)
            ctx.stroke(Path(roundedRect: basin, cornerRadius: s * 0.12), with: ink, lineWidth: thin)
            ctx.stroke(Path(ellipseIn: CGRect(x: -2.5, y: -2.5, width: 5, height: 5)), with: ink, lineWidth: thin)
        case "washerDryer":
            let rr = s * 0.32
            ctx.stroke(Path(ellipseIn: CGRect(x: -rr, y: -rr, width: rr * 2, height: rr * 2)), with: ink, lineWidth: thin)
        case "sofa":
            let inner = CGRect(x: r.minX + r.width * 0.1, y: r.minY + r.height * 0.28, width: r.width * 0.8, height: r.height * 0.72)
            ctx.stroke(Path(inner), with: ink, lineWidth: thin)
            let seats = max(1, Int((widthMm / 700).rounded()))
            for k in stride(from: 1, to: seats, by: 1) {
                let x = inner.minX + inner.width * Double(k) / Double(seats)
                ctx.stroke(Draft.line(CGPoint(x: x, y: inner.minY), CGPoint(x: x, y: inner.maxY)), with: ink, lineWidth: thin)
            }
        case "bed":
            let pw = r.width * 0.38, ph = r.height * 0.14
            for dx in [-1.0, 1.0] {
                let p = CGRect(x: dx * r.width / 4 - pw / 2, y: r.minY + r.height * 0.05, width: pw, height: ph)
                ctx.stroke(Path(roundedRect: p, cornerRadius: 3), with: ink, lineWidth: thin)
            }
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY + r.height * 0.25), CGPoint(x: r.maxX, y: r.minY + r.height * 0.25)), with: ink, lineWidth: thin)
        case "chair":
            ctx.stroke(Draft.line(CGPoint(x: r.minX, y: r.minY + r.height * 0.2), CGPoint(x: r.maxX, y: r.minY + r.height * 0.2)), with: ink, lineWidth: thin)
        case "toilet":
            ctx.stroke(Path(ellipseIn: r.insetBy(dx: r.width * 0.15, dy: r.height * 0.1).offsetBy(dx: 0, dy: r.height * 0.1)), with: ink, lineWidth: thin)
        case "bathtub":
            ctx.stroke(Path(roundedRect: r.insetBy(dx: s * 0.12, dy: s * 0.12), cornerRadius: s * 0.2), with: ink, lineWidth: thin)
        default:
            break
        }
    }

}
