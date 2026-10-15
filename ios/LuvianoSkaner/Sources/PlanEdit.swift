import Foundation

/// Edycja rzutu jak w MagicPlan: przesuwanie narożników i ścian, dorysowanie ściany,
/// podział, otwory, meble/sprzęty i ich odległości od ścian. Wszystko w mm.
enum PlanEdit {
    // MARK: - Zmiana kształtu z zachowaniem otworów i punktów instalacji

    /// Wykonuje `body` (przesuwa końce ścian), potem odkłada otwory i punkty instalacji:
    /// liczone od nieruszonego końca ściany (jak przy zmianie długości). Ściana, której
    /// długość się zmieniła, traci „zmierzony"; obrys RoomPlan idzie za narożnikami.
    static func reshape(_ scan: inout ScanPayload, _ body: (inout ScanPayload) -> Void) {
        struct Old { let a, b: V2; let len: Double; let spans: [PlanGeom.Span] }
        var before: [String: Old] = [:]
        for w in scan.walls { before[w.id] = Old(a: w.a, b: w.b, len: w.length, spans: PlanGeom.spans(w, scan.openings)) }

        body(&scan)

        var corners: [(V2, V2)] = []
        for i in scan.walls.indices {
            let w = scan.walls[i]
            guard let old = before[w.id] else { continue }
            let movedA = PlanGeom.dist(old.a, w.a) > 0.5, movedB = PlanGeom.dist(old.b, w.b) > 0.5
            guard movedA || movedB else { continue }
            if movedA { corners.append((old.a, w.a)) }
            if movedB { corners.append((old.b, w.b)) }
            let len = w.length
            // Ruszył się tylko początek → wszystko trzyma odległość od końca.
            let fromEnd = movedA && !movedB
            for s in old.spans {
                let width = s.t1 - s.t0
                var t0 = fromEnd ? len - (old.len - s.t0) : s.t0
                t0 = min(max(t0, 0), max(len - width, 0))
                place(&scan, s.id, on: w, t0: t0, t1: min(t0 + width, len))
            }
            for k in scan.markers.indices where scan.markers[k].wallId == w.id {
                let o = scan.markers[k].offsetMm
                scan.markers[k].offsetMm = min(max(fromEnd ? len - (old.len - o) : o, 0), len).rounded()
            }
            if abs(len - old.len) > 0.5 { scan.walls[i].measured = nil }
            scan.walls[i].lengthMm = len.rounded()
        }

        if var fl = scan.floor, !corners.isEmpty {
            for k in fl.indices where fl[k].count >= 2 {
                let p = V2(fl[k][0], fl[k][1])
                if let c = corners.min(by: { PlanGeom.dist($0.0, p) < PlanGeom.dist($1.0, p) }), PlanGeom.dist(c.0, p) < 300 {
                    let q = p + (c.1 - c.0)
                    fl[k] = [q.x.rounded(), q.y.rounded()]
                }
            }
            scan.floor = fl
        }
    }

    /// Ustawia otwór na ścianie w odcinku t0…t1 (od początku ściany).
    static func place(_ scan: inout ScanPayload, _ id: String, on w: ScanWall, t0: Double, t1: Double) {
        guard let k = scan.openings.firstIndex(where: { $0.id == id }) else { return }
        let p = w.a + w.dir * t0, q = w.a + w.dir * t1
        scan.openings[k].x1 = p.x.rounded(); scan.openings[k].y1 = p.y.rounded()
        scan.openings[k].x2 = q.x.rounded(); scan.openings[k].y2 = q.y.rounded()
        scan.openings[k].widthMm = (t1 - t0).rounded()
        scan.openings[k].wallId = w.id
    }

    // MARK: - Narożniki i ściany

    /// Końce ścian w punkcie `p` (narożnik).
    static func endpoints(_ scan: ScanPayload, at p: V2) -> [(Int, Bool)] {
        var out: [(Int, Bool)] = []
        for (i, w) in scan.walls.enumerated() {
            if PlanGeom.dist(w.a, p) < 1 { out.append((i, true)) }
            if PlanGeom.dist(w.b, p) < 1 { out.append((i, false)) }
        }
        return out
    }

    /// Przesuwa narożnik `from` → `to` razem ze wszystkimi ścianami, które się w nim schodzą.
    static func moveCorner(_ scan: inout ScanPayload, from: V2, to: V2) {
        let ends = endpoints(scan, at: from)
        reshape(&scan) { s in
            for (i, isA) in ends { if isA { s.walls[i].setA(to) } else { s.walls[i].setB(to) } }
        }
    }

    /// Przyciąganie narożnika: pełne 5 mm, a gdy sąsiednia ściana jest prawie pionowa/pozioma — do osi.
    static func snapCorner(_ scan: ScanPayload, corner: V2, to raw: V2, tol: Double) -> V2 {
        var q = V2((raw.x / 5).rounded() * 5, (raw.y / 5).rounded() * 5)
        for (i, isA) in endpoints(scan, at: corner) {
            let o = isA ? scan.walls[i].b : scan.walls[i].a
            if abs(q.x - o.x) < tol { q.x = o.x }
            if abs(q.y - o.y) < tol { q.y = o.y }
        }
        return q
    }

    /// Przesuwa ścianę równolegle o `d` mm wzdłuż jej normalnej; sąsiednie ściany się wydłużają.
    static func moveWall(_ scan: inout ScanPayload, _ i: Int, by d: Double) {
        guard scan.walls.indices.contains(i) else { return }
        let w = scan.walls[i]
        let n = V2(-w.dir.y, w.dir.x)
        let endsA = endpoints(scan, at: w.a), endsB = endpoints(scan, at: w.b)
        let na = w.a + n * d, nb = w.b + n * d
        reshape(&scan) { s in
            for (j, isA) in endsA { if isA { s.walls[j].setA(na) } else { s.walls[j].setB(na) } }
            for (j, isA) in endsB { if isA { s.walls[j].setA(nb) } else { s.walls[j].setB(nb) } }
        }
        // Otwory przesuniętej ściany jadą z nią (reshape trzyma je od początku ściany).
    }

    /// Dorysowanie ściany (domyślnie „do wybudowania"). Końce przyciągają się do narożników
    /// i linii ścian; kierunek jak łańcuch (koniec jednej = początek następnej).
    @discardableResult
    static func addWall(_ scan: inout ScanPayload, from p: V2, to q: V2, planned: Bool = true) -> Int? {
        guard PlanGeom.dist(p, q) > 50 else { return nil }
        let h = scan.roomHeightMm ?? scan.walls.map(\.heightMm).max() ?? 2500
        var w = ScanWall(id: UUID().uuidString, x1: p.x, y1: p.y, x2: q.x, y2: q.y,
                         lengthMm: PlanGeom.dist(p, q).rounded(), heightMm: h, measured: nil, planned: planned)
        let startsAtB = scan.walls.contains { PlanGeom.dist($0.b, p) < 1 }
        let endsAtA = scan.walls.contains { PlanGeom.dist($0.a, q) < 1 }
        let startsAtA = scan.walls.contains { PlanGeom.dist($0.a, p) < 1 }
        let endsAtB = scan.walls.contains { PlanGeom.dist($0.b, q) < 1 }
        if !(startsAtB || endsAtA) && (startsAtA || endsAtB) { w = w.flipped() }
        scan.walls.append(w)
        scan.closed = PlanModel(scan).closed
        return scan.walls.count - 1
    }

    /// Punkt rysowanej ściany: narożnik → linia ściany → oś (prosto od `from`) → pełne 5 mm.
    static func snapDraw(_ scan: ScanPayload, _ raw: V2, from: V2?, tol: Double) -> V2 {
        let corners = scan.walls.flatMap { [$0.a, $0.b] }
        if let c = corners.min(by: { PlanGeom.dist($0, raw) < PlanGeom.dist($1, raw) }), PlanGeom.dist(c, raw) < tol * 1.5 {
            return c
        }
        var q = V2((raw.x / 5).rounded() * 5, (raw.y / 5).rounded() * 5)
        if let from {
            let d = q - from
            if abs(d.x) < abs(d.y) * 0.09 { q.x = from.x }
            if abs(d.y) < abs(d.x) * 0.09 { q.y = from.y }
        }
        for w in scan.walls {
            let t = PlanGeom.dot(q - w.a, w.dir)
            guard t > 0, t < w.length else { continue }
            let foot = w.a + w.dir * t
            if PlanGeom.dist(foot, q) < tol { return from == nil ? foot : keepAxis(foot, w, from: from!, q) }
        }
        return q
    }

    /// Koniec dorysowanej ściany na linii innej ściany, z zachowaniem prostego kąta, jeśli był.
    private static func keepAxis(_ foot: V2, _ w: ScanWall, from: V2, _ q: V2) -> V2 {
        if q.x == from.x, abs(w.dir.x) > 0.01 {
            let t = (from.x - w.a.x) / w.dir.x
            return w.a + w.dir * t
        }
        if q.y == from.y, abs(w.dir.y) > 0.01 {
            let t = (from.y - w.a.y) / w.dir.y
            return w.a + w.dir * t
        }
        return foot
    }

    static func deleteWall(_ scan: inout ScanPayload, _ i: Int) {
        guard scan.walls.indices.contains(i) else { return }
        let w = scan.walls[i]
        let ids = Set(PlanGeom.spans(w, scan.openings).map(\.id))
        scan.openings.removeAll { ids.contains($0.id) || $0.wallId == w.id }
        scan.markers.removeAll { $0.wallId == w.id }
        scan.walls.remove(at: i)
        scan.closed = PlanModel(scan).closed
    }

    /// Dzieli ścianę w połowie — nowy narożnik do przeciągnięcia (wnęka, uskok, kominek).
    static func splitWall(_ scan: inout ScanPayload, _ i: Int) {
        guard scan.walls.indices.contains(i) else { return }
        let w = scan.walls[i]
        let t = (w.length / 2).rounded()
        let m = w.a + w.dir * t
        let second = ScanWall(id: UUID().uuidString, x1: m.x, y1: m.y, x2: w.x2, y2: w.y2,
                          lengthMm: (w.length - t).rounded(), heightMm: w.heightMm, measured: nil, planned: w.planned)
        let spans = PlanGeom.spans(w, scan.openings)
        scan.walls[i].setB(m)
        scan.walls[i].lengthMm = t
        scan.walls[i].measured = nil
        scan.walls.insert(second, at: i + 1)
        for s in spans {
            if s.t0 >= t { place(&scan, s.id, on: second, t0: s.t0 - t, t1: s.t1 - t) }
            else { place(&scan, s.id, on: scan.walls[i], t0: s.t0, t1: min(s.t1, t)) }
        }
        for k in scan.markers.indices where scan.markers[k].wallId == w.id && scan.markers[k].offsetMm > t {
            scan.markers[k].wallId = second.id
            scan.markers[k].offsetMm -= t
        }
    }

    // MARK: - Otwory

    /// Nowe okno/drzwi na środku największej wolnej części ściany.
    @discardableResult
    static func addOpening(_ scan: inout ScanPayload, wall i: Int, kind: String) -> String? {
        guard scan.walls.indices.contains(i) else { return nil }
        let w = scan.walls[i]
        let H = w.heightMm
        let (width, sill, height): (Double, Double, Double) = kind == "window"
            ? (1200, 850, min(1400, H - 950)) : (900, 0, min(2050, H - 50))
        var best = (a: 0.0, b: 0.0)
        var cursor = 0.0
        for s in PlanGeom.spans(w, scan.openings) {
            if s.t0 - cursor > best.b - best.a { best = (cursor, s.t0) }
            cursor = max(cursor, s.t1)
        }
        if w.length - cursor > best.b - best.a { best = (cursor, w.length) }
        let free = best.b - best.a
        guard free > 300 else { return nil }
        let wd = min(width, free - 100)
        let t0 = best.a + (free - wd) / 2
        let o = ScanOpening(id: UUID().uuidString, kind: kind, wallId: w.id, x1: 0, y1: 0, x2: 0, y2: 0,
                            widthMm: wd, heightMm: max(height, 300), sillMm: sill)
        scan.openings.append(o)
        place(&scan, o.id, on: w, t0: t0, t1: t0 + wd)
        return o.id
    }

    /// Przesunięcie otworu wzdłuż ściany (przeciąganie na rzucie).
    static func slideOpening(_ scan: inout ScanPayload, _ id: String, wall i: Int, t0: Double) {
        guard scan.walls.indices.contains(i) else { return }
        let w = scan.walls[i]
        let sp = PlanGeom.spans(w, scan.openings)
        guard let j = sp.firstIndex(where: { $0.id == id }) else { return }
        let width = sp[j].t1 - sp[j].t0
        let t = min(max((t0 / 5).rounded() * 5, 0), max(w.length - width, 0))
        place(&scan, id, on: w, t0: t, t1: t + width)
        if let k = scan.openings.firstIndex(where: { $0.id == id }) {
            scan.openings[k].measuredParts?.removeAll { $0 == "before" || $0 == "after" }
        }
        if j + 1 < sp.count { PlanGeom.unlock(&scan, sp[j + 1].id, "before") }
    }

    static func deleteOpening(_ scan: inout ScanPayload, _ id: String) {
        scan.openings.removeAll { $0.id == id }
    }

    // MARK: - Meble i sprzęty

    struct ObjectKind { let category, label: String; let w, d, h, elev: Double }
    static let objectKinds: [ObjectKind] = [
        .init(category: "storage", label: "Szafka", w: 600, d: 560, h: 850, elev: 0),
        .init(category: "refrigerator", label: "Lodówka", w: 600, d: 650, h: 1850, elev: 0),
        .init(category: "stove", label: "Kuchenka", w: 600, d: 600, h: 850, elev: 0),
        .init(category: "oven", label: "Piekarnik", w: 600, d: 560, h: 600, elev: 0),
        .init(category: "dishwasher", label: "Zmywarka", w: 600, d: 560, h: 820, elev: 0),
        .init(category: "sink", label: "Zlew", w: 800, d: 500, h: 200, elev: 700),
        .init(category: "washerDryer", label: "Pralka", w: 600, d: 600, h: 850, elev: 0),
        .init(category: "table", label: "Stół", w: 1400, d: 800, h: 750, elev: 0),
        .init(category: "chair", label: "Krzesło", w: 450, d: 450, h: 900, elev: 0),
        .init(category: "sofa", label: "Sofa", w: 2000, d: 900, h: 850, elev: 0),
    ]

    @discardableResult
    static func addObject(_ scan: inout ScanPayload, _ k: ObjectKind, at c: V2) -> String {
        let o = ScanObject(id: UUID().uuidString, category: k.category, cx: c.x.rounded(), cy: c.y.rounded(),
                           widthMm: k.w, depthMm: k.d, heightMm: k.h, elevationMm: k.elev, rotationDeg: 0)
        scan.objects.append(o)
        return o.id
    }

    /// Osie obiektu: u = wzdłuż szerokości, v = wzdłuż głębokości (jak na rysunku).
    static func axes(_ o: ScanObject) -> (V2, V2) {
        let r = o.rotationDeg * .pi / 180
        return (V2(cos(r), sin(r)), V2(-sin(r), cos(r)))
    }

    static func corners(_ o: ScanObject) -> [V2] {
        let (u, v) = axes(o)
        let c = V2(o.cx, o.cy), hw = o.widthMm / 2, hd = o.depthMm / 2
        return [c - u * hw - v * hd, c + u * hw - v * hd, c + u * hw + v * hd, c - u * hw + v * hd]
    }

    static func contains(_ o: ScanObject, _ p: V2, margin: Double = 0) -> Bool {
        let (u, v) = axes(o)
        let d = p - V2(o.cx, o.cy)
        return abs(PlanGeom.dot(d, u)) <= o.widthMm / 2 + margin && abs(PlanGeom.dot(d, v)) <= o.depthMm / 2 + margin
    }

    /// Odległość od krawędzi obiektu do najbliższej przeszkody (ściana / inny obiekt).
    struct Gap { let side: Int; let from, to: V2; let dist: Double; let dir: V2 }

    /// Odległości w 4 strony (0: +szer., 1: −szer., 2: +głęb., 3: −głęb.), mierzone od środka krawędzi.
    static func gaps(_ scan: ScanPayload, _ id: String) -> [Gap] {
        guard let o = scan.objects.first(where: { $0.id == id }) else { return [] }
        let (u, v) = axes(o)
        let c = V2(o.cx, o.cy)
        let dirs: [(V2, Double)] = [(u, o.widthMm / 2), (-u, o.widthMm / 2), (v, o.depthMm / 2), (-v, o.depthMm / 2)]
        var out: [Gap] = []
        for (side, (d, half)) in dirs.enumerated() {
            let from = c + d * half
            var best = Double.infinity
            for w in scan.walls {
                if let t = raySeg(from, d, w.a, w.b), t < best { best = t }
            }
            for other in scan.objects where other.id != id {
                if let t = rayBox(from, d, other), t < best { best = t }
            }
            guard best.isFinite, best < 20000 else { continue }
            out.append(Gap(side: side, from: from, to: from + d * best, dist: best, dir: d))
        }
        return out
    }

    /// Ustawia odległość obiektu od przeszkody po danej stronie.
    static func setGap(_ scan: inout ScanPayload, _ id: String, side: Int, to v: Double) {
        guard let g = gaps(scan, id).first(where: { $0.side == side }),
              let k = scan.objects.firstIndex(where: { $0.id == id }) else { return }
        let move = g.dir * (g.dist - v)
        scan.objects[k].cx = (scan.objects[k].cx + move.x).rounded()
        scan.objects[k].cy = (scan.objects[k].cy + move.y).rounded()
    }

    /// Przesunięcie obiektu z przyciąganiem do ściany, gdy krawędź jest blisko (≤ tol mm).
    static func moveObject(_ scan: inout ScanPayload, _ id: String, to c: V2, tol: Double) {
        guard let k = scan.objects.firstIndex(where: { $0.id == id }) else { return }
        scan.objects[k].cx = (c.x / 5).rounded() * 5
        scan.objects[k].cy = (c.y / 5).rounded() * 5
        for g in gaps(scan, id) where g.dist < tol {
            scan.objects[k].cx = (scan.objects[k].cx + g.dir.x * g.dist).rounded()
            scan.objects[k].cy = (scan.objects[k].cy + g.dir.y * g.dist).rounded()
        }
    }

    static func rotateObject(_ scan: inout ScanPayload, _ id: String) {
        guard let k = scan.objects.firstIndex(where: { $0.id == id }) else { return }
        var deg = scan.objects[k].rotationDeg + 90
        if deg > 180 { deg -= 360 }
        scan.objects[k].rotationDeg = deg
    }

    private static func raySeg(_ p: V2, _ d: V2, _ a: V2, _ b: V2) -> Double? {
        let e = b - a
        let den = PlanGeom.cross(d, e)
        guard abs(den) > 1e-9 else { return nil }
        let t = PlanGeom.cross(a - p, e) / den
        let s = PlanGeom.cross(a - p, d) / den
        return t > -1 && s >= 0 && s <= 1 ? max(t, 0) : nil
    }

    private static func rayBox(_ p: V2, _ d: V2, _ o: ScanObject) -> Double? {
        let cs = corners(o)
        var best: Double?
        for k in 0..<4 {
            if let t = raySeg(p, d, cs[k], cs[(k + 1) % 4]), t > 0.5, best == nil || t < best! { best = t }
        }
        return best
    }
}
