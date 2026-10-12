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

    init(points: [V2], size: CGSize, margin: Double = 96) {
        let xs = points.map(\.x), ys = points.map(\.y)
        minX = xs.min() ?? 0
        minY = ys.min() ?? 0
        let w = max((xs.max() ?? 1) - minX, 1)
        let h = max((ys.max() ?? 1) - minY, 1)
        scale = max(0.005, min((size.width - 2 * margin) / w, (size.height - 2 * margin) / h))
        ox = (size.width - w * scale) / 2
        oy = (size.height - h * scale) / 2
    }

    func pt(_ p: V2) -> CGPoint { CGPoint(x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale) }
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

/// Rzut 2D w stylu MagicPlan: grube ściany, podłoga w kratkę, wymiary, symbole okien i drzwi.
struct PlanCanvas: View {
    let scan: ScanPayload
    let roomName: String
    var selected: Int?
    var onTapWall: (Int?) -> Void = { _ in }

    var body: some View {
        GeometryReader { geo in
            let model = PlanModel(scan)
            let layout = PlanLayout(points: model.walls.flatMap { [$0.w.a, $0.w.b] } + model.floor, size: geo.size)
            Canvas { ctx, _ in
                PlanDraw.draw(ctx, model, layout, roomName: roomName, selected: selected)
            }
            .contentShape(Rectangle())
            .onTapGesture { loc in onTapWall(PlanDraw.hitWall(loc, model, layout)) }
        }
        .background(PlanStyle.canvas)
    }
}

enum PlanDraw {
    static func draw(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout, roomName: String, selected: Int?) {
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
        for i in m.walls.indices {
            let (o1a, o1b) = m.outer(i, T)
            let (o2a, o2b) = m.outer(i, T * 1.9)
            ctx.fill(Draft.poly([o1a, o1b, o2b, o2a].map(L.pt)), with: .color(PlanStyle.band))
        }
        for (i, g) in m.walls.enumerated() {
            let (oa, ob) = m.outer(i, T)
            ctx.fill(Draft.poly([g.w.a, g.w.b, ob, oa].map(L.pt)), with: .color(selected == i ? PlanStyle.selected : PlanStyle.wall))
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
            Symbols.draw(t, o.category, r, widthMm: o.widthMm)
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
            var row = base + 18
            if !g.spans.isEmpty {
                var cuts = [0.0]
                for s in g.spans { cuts += [s.t0, s.t1] }
                cuts.append(g.len)
                for k in 0..<(cuts.count - 1) where (cuts[k + 1] - cuts[k]) * L.scale > 30 {
                    Draft.dimension(ctx, L.pt(g.at(cuts[k], T * 1.9)) + out * -base, L.pt(g.at(cuts[k + 1], T * 1.9)) + out * -base,
                                    out: out, off: base + 18, text: "\(Int((cuts[k + 1] - cuts[k]).rounded()))",
                                    color: PlanStyle.dim, bg: PlanStyle.canvas)
                }
                row += 26
            }
            let locked = g.w.measured == true
            Draft.dimension(ctx, L.pt(g.at(0)), L.pt(g.at(g.len)), out: out, off: row,
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
