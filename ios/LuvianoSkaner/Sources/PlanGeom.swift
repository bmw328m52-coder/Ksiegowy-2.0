import Foundation

typealias V2 = SIMD2<Double>

extension ScanWall {
    var a: V2 { V2(x1, y1) }
    var b: V2 { V2(x2, y2) }
    var length: Double { PlanGeom.len(b - a) }
    var dir: V2 {
        let l = length
        return l > 0 ? (b - a) / l : V2(1, 0)
    }
    mutating func setA(_ p: V2) { x1 = p.x; y1 = p.y }
    mutating func setB(_ p: V2) { x2 = p.x; y2 = p.y }
    func flipped() -> ScanWall {
        var w = self
        (w.x1, w.y1, w.x2, w.y2) = (x2, y2, x1, y1)
        return w
    }
}

/// Geometria rzutu: łańcuch ścian, grubość, otwory, statystyki, edycja wymiaru.
/// Wszystko w mm, układ rzutu (x w prawo, y w głąb).
enum PlanGeom {
    /// Grubość rysowanej ściany (od linii skanu na zewnątrz).
    static let wallT = 100.0

    static func len(_ v: V2) -> Double { (v.x * v.x + v.y * v.y).squareRoot() }
    static func dist(_ a: V2, _ b: V2) -> Double { len(a - b) }
    static func cross(_ a: V2, _ b: V2) -> Double { a.x * b.y - a.y * b.x }
    static func dot(_ a: V2, _ b: V2) -> Double { a.x * b.x + a.y * b.y }

    /// Układa ściany w łańcuch (koniec jednej = początek następnej) i domyka narożniki.
    static func normalize(_ input: [ScanWall]) -> (walls: [ScanWall], closed: Bool) {
        var rest = input
        guard !rest.isEmpty else { return ([], false) }
        let tol = 400.0
        var chain = [rest.removeFirst()]

        func take(near p: V2, atStart: Bool) -> ScanWall? {
            var best: (index: Int, flip: Bool, d: Double)?
            for (i, w) in rest.enumerated() {
                let dA = dist(w.a, p), dB = dist(w.b, p)
                // atStart: szukamy ściany, która ZACZYNA się przy p (doklejamy na końcu łańcucha).
                let d = min(dA, dB)
                let flip = atStart ? dB < dA : dA < dB
                if d < tol, best == nil || d < best!.d { best = (i, flip, d) }
            }
            guard let best else { return nil }
            let w = rest.remove(at: best.index)
            return best.flip ? w.flipped() : w
        }

        while let w = take(near: chain.last!.b, atStart: true) { chain.append(w) }
        while let w = take(near: chain.first!.a, atStart: false) { chain.insert(w, at: 0) }

        let n = chain.count
        let closed = n >= 3 && dist(chain[n - 1].b, chain[0].a) < tol
        for k in 0..<(closed ? n : n - 1) {
            let j = (k + 1) % n
            let m = (chain[k].b + chain[j].a) / 2
            chain[k].setB(m)
            chain[j].setA(m)
        }
        var out = chain + rest
        for k in out.indices { out[k].lengthMm = out[k].length.rounded() }
        return (out, closed)
    }

    /// Otwór na ścianie: wzdłuż t0…t1, w pionie bottom…top (mm).
    struct Span { let t0, t1, bottom, top: Double; let kind: String }
    /// Prostokąt ściany: wzdłuż t0…t1, w pionie z0…z1.
    struct Piece { let t0, t1, z0, z1: Double }

    /// Otwory leżące na danej ścianie, rzutowane na jej oś.
    static func spans(_ wall: ScanWall, _ openings: [ScanOpening]) -> [Span] {
        let a = wall.a, u = wall.dir, len = wall.length
        func proj(_ x: Double, _ y: Double) -> Double { dot(V2(x, y) - a, u) }
        return openings.compactMap { (o: ScanOpening) -> Span? in
            if let wid = o.wallId {
                guard wid == wall.id else { return nil }
            } else {
                let m = V2((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2)
                let d = abs(cross(u, m - a))
                let t = proj(m.x, m.y)
                guard d < 200, t > 0, t < len else { return nil }
            }
            let p = proj(o.x1, o.y1), q = proj(o.x2, o.y2)
            let t0 = max(0, min(p, q)), t1 = min(len, max(p, q))
            let top = min(o.sillMm + o.heightMm, wall.heightMm)
            guard t1 - t0 > 1, top > o.sillMm else { return nil }
            return Span(t0: t0, t1: t1, bottom: o.sillMm, top: top, kind: o.kind)
        }
        .sorted { $0.t0 < $1.t0 }
    }

    /// Ściana pocięta na prostokąty omijające otwory.
    static func pieces(len: Double, height: Double, spans: [Span]) -> [Piece] {
        var out: [Piece] = []
        var cursor = 0.0
        for s in spans {
            if s.t0 > cursor { out.append(Piece(t0: cursor, t1: s.t0, z0: 0, z1: height)) }
            let a = max(s.t0, cursor)
            if s.t1 > a {
                if s.bottom > 0 { out.append(Piece(t0: a, t1: s.t1, z0: 0, z1: s.bottom)) }
                if s.top < height { out.append(Piece(t0: a, t1: s.t1, z0: s.top, z1: height)) }
            }
            cursor = max(cursor, s.t1)
        }
        if cursor < len { out.append(Piece(t0: cursor, t1: len, z0: 0, z1: height)) }
        return out
    }

    static func pointInPolygon(_ p: V2, _ poly: [V2]) -> Bool {
        var inside = false
        var j = poly.count - 1
        for i in poly.indices {
            let a = poly[i], b = poly[j]
            if (a.y > p.y) != (b.y > p.y), p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x { inside.toggle() }
            j = i
        }
        return inside
    }

    static func convexHull(_ pts: [V2]) -> [V2] {
        let p = pts.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
        guard p.count >= 3 else { return p }
        func c(_ o: V2, _ a: V2, _ b: V2) -> Double { cross(a - o, b - o) }
        var lower: [V2] = [], upper: [V2] = []
        for q in p {
            while lower.count >= 2 && c(lower[lower.count - 2], lower[lower.count - 1], q) <= 0 { lower.removeLast() }
            lower.append(q)
        }
        for q in p.reversed() {
            while upper.count >= 2 && c(upper[upper.count - 2], upper[upper.count - 1], q) <= 0 { upper.removeLast() }
            upper.append(q)
        }
        return Array(lower.dropLast() + upper.dropLast())
    }

    /// Zmiana długości ściany jak w MagicPlan: przesuwa koniec ściany i kolejne
    /// ściany prostopadłe; pierwsza równoległa ściana „bierze" różnicę.
    static func setLength(_ scan: inout ScanPayload, wall i: Int, to newLen: Double) {
        guard scan.walls.indices.contains(i), newLen > 10 else { return }
        let w = scan.walls[i]
        let u = w.dir
        let d = u * (newLen - w.length)
        let start = w.a
        var corner = w.b
        scan.walls[i].setB(w.b + d)
        var cur = i
        var movedWalls: [String] = []
        var movedCorners: [V2] = [w.b]

        for _ in 0..<scan.walls.count {
            guard let nxt = scan.walls.indices.first(where: { $0 != cur && $0 != i && dist(scan.walls[$0].a, corner) < 1 }) else { break }
            let nw = scan.walls[nxt]
            scan.walls[nxt].setA(nw.a + d)
            let parallel = abs(cross(nw.dir, u)) < 0.26
            if parallel || dist(nw.b, start) < 1 {
                // Przesunął się tylko początek tej ściany — punkty instalacji zostają w miejscu.
                shiftMarkers(&scan, wall: nw.id, by: -dot(d, nw.dir))
                break
            }
            corner = nw.b
            movedCorners.append(nw.b)
            scan.walls[nxt].setB(nw.b + d)
            movedWalls.append(nw.id)
            cur = nxt
        }

        // Obrys RoomPlan idzie za przesuniętymi narożnikami.
        if var fl = scan.floor {
            for k in fl.indices where fl[k].count >= 2 {
                let p = V2(fl[k][0], fl[k][1])
                if movedCorners.contains(where: { dist($0, p) < 300 }) { fl[k] = [p.x + d.x, p.y + d.y] }
            }
            scan.floor = fl
        }
        for k in scan.openings.indices where movedWalls.contains(scan.openings[k].wallId ?? "") {
            scan.openings[k].x1 += d.x; scan.openings[k].y1 += d.y
            scan.openings[k].x2 += d.x; scan.openings[k].y2 += d.y
        }
        for k in scan.walls.indices { scan.walls[k].lengthMm = scan.walls[k].length.rounded() }
        scan.walls[i].lengthMm = newLen.rounded()
        scan.walls[i].measured = true
    }

    static func shiftMarkers(_ scan: inout ScanPayload, wall id: String, by dt: Double) {
        for k in scan.markers.indices where scan.markers[k].wallId == id {
            scan.markers[k].offsetMm = max(0, (scan.markers[k].offsetMm + dt).rounded())
        }
    }

    static func setRoomHeight(_ scan: inout ScanPayload, _ h: Double) {
        guard h > 100 else { return }
        for k in scan.walls.indices { scan.walls[k].heightMm = h.rounded() }
        scan.roomHeightMm = h.rounded()
    }
}

/// Rzut gotowy do rysowania: kierunki, strona wewnętrzna, sąsiedzi, otwory.
struct PlanModel {
    struct Wall {
        let w: ScanWall
        let dir: V2
        /// Normalna do wnętrza pomieszczenia.
        let inN: V2
        let len: Double
        let spans: [PlanGeom.Span]
        let prev: Int?
        let next: Int?
        var out: V2 { -inN }
        func at(_ t: Double, _ off: Double = 0) -> V2 { w.a + dir * t + out * off }
    }

    let walls: [Wall]
    let objects: [ScanObject]
    let markers: [ScanMarker]
    /// Obrys podłogi (zamknięty łańcuch ścian, w innym razie otoczka wypukła).
    let floor: [V2]
    let closed: Bool
    /// Domknięcie otwartego obrysu (rysowane linią przerywaną).
    let gap: (V2, V2)?
    let center: V2
    let roomHeight: Double

    init(_ scan: ScanPayload) {
        let ws = scan.walls
        objects = scan.objects
        markers = scan.markers
        var loop: [V2] = []
        if ws.count >= 3 {
            var idx = 0
            var visited = Set<Int>()
            while !visited.contains(idx) {
                visited.insert(idx)
                loop.append(ws[idx].a)
                guard let n = ws.indices.first(where: { PlanGeom.dist(ws[$0].a, ws[idx].b) < 1 }) else { loop = []; break }
                idx = n
            }
            if idx != 0 { loop = [] }
        }
        let isClosed = loop.count >= 3
        // Obrys otwarty (przejście do innego pomieszczenia): bierzemy łańcuch ścian
        // od pierwszej bez poprzedniczki i domykamy go linią „otwarcia".
        var openGap: (V2, V2)?
        if !isClosed, ws.count >= 2 {
            let start = ws.indices.first { i in
                !ws.indices.contains { j in j != i && PlanGeom.dist(ws[j].b, ws[i].a) < 1 }
            } ?? 0
            var idx = start
            var visited = Set<Int>()
            var pts: [V2] = []
            while !visited.contains(idx) {
                visited.insert(idx)
                pts.append(ws[idx].a)
                guard let n = ws.indices.first(where: { $0 != idx && PlanGeom.dist(ws[$0].a, ws[idx].b) < 1 }) else {
                    pts.append(ws[idx].b)
                    break
                }
                idx = n
            }
            if pts.count >= 3 {
                loop = pts
                openGap = (pts[pts.count - 1], pts[0])
            }
        }
        let corners = ws.flatMap { [$0.a, $0.b] }
        let rpFloor = (scan.floor ?? []).compactMap { $0.count >= 2 ? V2($0[0], $0[1]) : nil }
        if !isClosed && rpFloor.count >= 3 { loop = rpFloor; openGap = nil }
        let floorPoly = loop.count >= 3 ? loop : PlanGeom.convexHull(corners)
        let pts = floorPoly.isEmpty ? corners : floorPoly
        let c = pts.isEmpty ? V2(0, 0) : pts.reduce(V2(0, 0), +) / Double(pts.count)
        closed = isClosed
        gap = openGap
        floor = floorPoly
        center = c
        roomHeight = scan.roomHeightMm ?? ws.map(\.heightMm).max() ?? 2500

        walls = ws.map { w in
            let dir = w.dir
            let n = V2(-dir.y, dir.x)
            let mid = (w.a + w.b) / 2
            let inward: V2
            if floorPoly.count >= 3 {
                inward = PlanGeom.pointInPolygon(mid + n * 40, floorPoly) ? n : -n
            } else {
                inward = PlanGeom.dot(c - mid, n) >= 0 ? n : -n
            }
            return Wall(
                w: w, dir: dir, inN: inward, len: w.length,
                spans: PlanGeom.spans(w, scan.openings),
                prev: ws.indices.first { PlanGeom.dist(ws[$0].b, w.a) < 1 && ws[$0].id != w.id },
                next: ws.indices.first { PlanGeom.dist(ws[$0].a, w.b) < 1 && ws[$0].id != w.id }
            )
        }
    }

    /// Zewnętrzna krawędź ściany odsuniętej o `off`, z narożnikami na ucios.
    func outer(_ i: Int, _ off: Double) -> (V2, V2) {
        let g = walls[i]
        var s = g.at(0, off), e = g.at(g.len, off)
        if let p = g.prev, let m = miter(g, walls[p], corner: g.w.a, off) { s = m }
        if let n = g.next, let m = miter(g, walls[n], corner: g.w.b, off) { e = m }
        return (s, e)
    }

    private func miter(_ g: Wall, _ h: Wall, corner: V2, _ off: Double) -> V2? {
        let p1 = g.w.a + g.out * off, p2 = h.w.a + h.out * off
        let den = PlanGeom.cross(g.dir, h.dir)
        guard abs(den) > 0.05 else { return nil }
        let t = PlanGeom.cross(p2 - p1, h.dir) / den
        let r = p1 + g.dir * t
        return PlanGeom.dist(r, corner) < off * 4 ? r : nil
    }

    var areaM2: Double {
        guard floor.count >= 3 else { return 0 }
        var s = 0.0
        for i in floor.indices {
            let a = floor[i], b = floor[(i + 1) % floor.count]
            s += a.x * b.y - b.x * a.y
        }
        return abs(s) / 2 / 1_000_000
    }

    var perimeterM: Double { walls.reduce(0) { $0 + $1.len } / 1000 }

    var wallAreaM2: Double {
        walls.reduce(0) { acc, g in
            acc + g.len * g.w.heightMm - g.spans.reduce(0) { $0 + ($1.t1 - $1.t0) * ($1.top - $1.bottom) }
        } / 1_000_000
    }

    var volumeM3: Double { areaM2 * roomHeight / 1000 }
}
