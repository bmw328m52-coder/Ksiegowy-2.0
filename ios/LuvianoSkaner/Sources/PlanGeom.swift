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
    struct Span {
        let t0, t1, bottom, top: Double
        let kind: String
        let id: String
        /// Zmierzone odcinki (ScanOpening.measuredParts).
        let parts: [String]
    }
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
            return Span(t0: t0, t1: t1, bottom: o.sillMm, top: top, kind: o.kind, id: o.id, parts: o.measuredParts ?? [])
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

    /// Odcinek wymiarowy ściany przy otworze (id otworu). Poziomo: przerwa przed otworem
    /// (od narożnika / poprzedniego otworu), szerokość, przerwa za ostatnim otworem.
    /// Pionowo: parapet, wysokość otworu, nadproże (do sufitu).
    enum Segment: Hashable {
        case before(String), width(String), after(String)
        case sill(String), height(String), head(String)

        var opening: String {
            switch self {
            case .before(let id), .width(let id), .after(let id), .sill(let id), .height(let id), .head(let id): return id
            }
        }
        /// Klucz w ScanOpening.measuredParts.
        var part: String {
            switch self {
            case .before: return "before"
            case .width: return "width"
            case .after: return "after"
            case .sill: return "sill"
            case .height: return "height"
            case .head: return "head"
            }
        }
    }

    struct SegmentDim { let a, b: Double; let seg: Segment; let measured: Bool }

    static func openingName(_ kind: String) -> String {
        switch kind {
        case "window": return "Okno"
        case "door": return "Drzwi"
        default: return "Przejście"
        }
    }

    /// Łańcuch wymiarów wzdłuż ściany: narożnik → otwór → … → narożnik.
    static func horizontalSegments(_ spans: [Span], len: Double) -> [SegmentDim] {
        var out: [SegmentDim] = []
        var cursor = 0.0
        for s in spans {
            out.append(SegmentDim(a: cursor, b: s.t0, seg: .before(s.id), measured: s.parts.contains("before")))
            out.append(SegmentDim(a: s.t0, b: s.t1, seg: .width(s.id), measured: s.parts.contains("width")))
            cursor = s.t1
        }
        if let last = spans.last {
            out.append(SegmentDim(a: cursor, b: len, seg: .after(last.id), measured: last.parts.contains("after")))
        }
        return out
    }

    /// Pion otworu: podłoga → parapet → nadproże → sufit.
    static func verticalSegments(_ s: Span, height: Double) -> [SegmentDim] {
        [
            SegmentDim(a: 0, b: s.bottom, seg: .sill(s.id), measured: s.parts.contains("sill")),
            SegmentDim(a: s.bottom, b: s.top, seg: .height(s.id), measured: s.parts.contains("height")),
            SegmentDim(a: s.top, b: height, seg: .head(s.id), measured: s.parts.contains("head")),
        ]
    }

    /// Nazwa odcinka do nagłówka klawiatury, np. „Narożnik → okno".
    static func segmentTitle(_ scan: ScanPayload, wall i: Int, _ seg: Segment) -> String {
        guard scan.walls.indices.contains(i) else { return "" }
        let sp = spans(scan.walls[i], scan.openings)
        guard let j = sp.firstIndex(where: { $0.id == seg.opening }) else { return "" }
        let name = openingName(sp[j].kind)
        switch seg {
        case .before: return "\(j == 0 ? "Narożnik" : openingName(sp[j - 1].kind)) → \(name.lowercased())"
        case .after: return "\(name) → narożnik"
        case .width: return "\(name) — szerokość"
        case .sill: return sp[j].kind == "window" ? "Parapet (od podłogi)" : "\(name) — od podłogi"
        case .height: return "\(name) — wysokość"
        case .head: return "Nadproże (\(name.lowercased()) → sufit)"
        }
    }

    static func segmentValue(_ scan: ScanPayload, wall i: Int, _ seg: Segment) -> Double {
        guard scan.walls.indices.contains(i) else { return 0 }
        let w = scan.walls[i]
        let sp = spans(w, scan.openings)
        guard let s = sp.first(where: { $0.id == seg.opening }) else { return 0 }
        let all = horizontalSegments(sp, len: w.length) + verticalSegments(s, height: w.heightMm)
        return all.first { $0.seg == seg }.map { $0.b - $0.a } ?? 0
    }

    /// Wpisanie zmierzonego odcinka jak w MagicPlan: przerwa przesuwa otwór (szerokość bez zmian),
    /// szerokość ciągnie prawą krawędź, parapet przesuwa otwór w pionie, wysokość/nadproże
    /// zmieniają wysokość otworu. Odcinek, który się przez to zmienił, traci status „zmierzony".
    static func setSegment(_ scan: inout ScanPayload, wall i: Int, _ seg: Segment, to v: Double) {
        guard scan.walls.indices.contains(i), v >= 0 else { return }
        let w = scan.walls[i]
        let sp = spans(w, scan.openings)
        guard let j = sp.firstIndex(where: { $0.id == seg.opening }),
              let k = scan.openings.firstIndex(where: { $0.id == seg.opening }) else { return }
        let s = sp[j], len = w.length, H = w.heightMm
        let width = s.t1 - s.t0
        let nextId = j + 1 < sp.count ? sp[j + 1].id : nil

        func place(_ t0: Double, _ t1: Double) {
            let p = w.a + w.dir * t0, q = w.a + w.dir * t1
            scan.openings[k].x1 = p.x.rounded(); scan.openings[k].y1 = p.y.rounded()
            scan.openings[k].x2 = q.x.rounded(); scan.openings[k].y2 = q.y.rounded()
            scan.openings[k].widthMm = (t1 - t0).rounded()
            scan.openings[k].wallId = w.id
        }

        var lose: [String] = []
        switch seg {
        case .before:
            let prevEnd = j > 0 ? sp[j - 1].t1 : 0
            let t0 = min(max(prevEnd + v, 0), max(len - width, 0))
            place(t0, t0 + width)
            lose = ["after"]
            if let nextId { unlock(&scan, nextId, "before") }
        case .after:
            let t0 = max(len - v - width, 0)
            place(t0, t0 + width)
            lose = ["before"]
        case .width:
            guard v > 10 else { return }
            place(s.t0, min(s.t0 + v, len))
            lose = ["after"]
            if let nextId { unlock(&scan, nextId, "before") }
        case .sill:
            let sill = min(v, H - 10)
            scan.openings[k].sillMm = sill.rounded()
            scan.openings[k].heightMm = min(scan.openings[k].heightMm, H - sill).rounded()
            lose = ["head"]
        case .height:
            guard v > 10 else { return }
            scan.openings[k].heightMm = min(v, H - s.bottom).rounded()
            lose = ["head"]
        case .head:
            scan.openings[k].heightMm = max(H - s.bottom - v, 10).rounded()
            lose = ["height"]
        }
        var parts = Set(scan.openings[k].measuredParts ?? [])
        parts.subtract(lose)
        parts.insert(seg.part)
        scan.openings[k].measuredParts = parts.sorted()
    }

    static func unlock(_ scan: inout ScanPayload, _ opening: String, _ part: String) {
        guard let k = scan.openings.firstIndex(where: { $0.id == opening }) else { return }
        scan.openings[k].measuredParts?.removeAll { $0 == part }
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
        // Koniec ściany się przesuwa → odcinek „ostatni otwór → narożnik" już nie jest zmierzony.
        if let last = spans(w, scan.openings).last { unlock(&scan, last.id, "after") }
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

    /// Obrót całego rzutu o 90° (na ekranie: `clockwise` = w prawo). Punkty instalacji są
    /// przypięte do ścian, więc się nie zmieniają; litery i „lewy narożnik" też zostają.
    static func rotate(_ scan: inout ScanPayload, clockwise: Bool) {
        func r(_ x: Double, _ y: Double) -> V2 { clockwise ? V2(-y, x) : V2(y, -x) }
        for k in scan.walls.indices {
            let w = scan.walls[k]
            scan.walls[k].setA(r(w.x1, w.y1))
            scan.walls[k].setB(r(w.x2, w.y2))
        }
        for k in scan.openings.indices {
            let o = scan.openings[k]
            let a = r(o.x1, o.y1), b = r(o.x2, o.y2)
            (scan.openings[k].x1, scan.openings[k].y1, scan.openings[k].x2, scan.openings[k].y2) = (a.x, a.y, b.x, b.y)
        }
        for k in scan.objects.indices {
            let c = r(scan.objects[k].cx, scan.objects[k].cy)
            (scan.objects[k].cx, scan.objects[k].cy) = (c.x, c.y)
            var deg = scan.objects[k].rotationDeg + (clockwise ? 90 : -90)
            if deg > 180 { deg -= 360 }
            if deg <= -180 { deg += 360 }
            scan.objects[k].rotationDeg = deg
        }
        scan.floor = scan.floor?.map { (q: [Double]) -> [Double] in
            guard q.count >= 2 else { return q }
            let p = r(q[0], q[1])
            return [p.x, p.y]
        }

        // Z powrotem do dodatnich współrzędnych (jak po skanie).
        let pts = scan.walls.flatMap { [$0.a, $0.b] }
        let shift = V2(pts.map(\.x).min() ?? 0, pts.map(\.y).min() ?? 0)
        for k in scan.walls.indices {
            scan.walls[k].setA(scan.walls[k].a - shift)
            scan.walls[k].setB(scan.walls[k].b - shift)
        }
        for k in scan.openings.indices {
            scan.openings[k].x1 -= shift.x; scan.openings[k].y1 -= shift.y
            scan.openings[k].x2 -= shift.x; scan.openings[k].y2 -= shift.y
        }
        for k in scan.objects.indices { scan.objects[k].cx -= shift.x; scan.objects[k].cy -= shift.y }
        scan.floor = scan.floor?.map { $0.count >= 2 ? [$0[0] - shift.x, $0[1] - shift.y] : $0 }
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
