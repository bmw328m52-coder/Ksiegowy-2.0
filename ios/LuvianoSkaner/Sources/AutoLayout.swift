import Foundation

/// Wstępne rozstawienie szafek wzdłuż ścian: zlew przy wodzie/odpływie, zmywarka obok,
/// płyta przy gazie / sile 400 V, reszta wolnego miejsca dzielona na równe moduły ≤ 600 mm
/// (na wymiar — bez dopychania do „katalogowych" szerokości). Szafki górne nad blatem,
/// z przerwą na okap nad płytą. Wszystko oznaczone `autoWall` — ponowne rozstawienie podmienia.
enum AutoLayout {
    struct Options {
        var lower = true
        var upper = true
        /// Zlew, zmywarka i płyta według punktów instalacji na ścianie.
        var appliances = true
        /// Wysokość blatu od podłogi.
        var counterMm = 900.0
        /// Odstęp blat → spód szafek górnych.
        var gapMm = 550.0
        var upperHeightMm = 720.0
        var lowerDepthMm = 560.0
        var upperDepthMm = 350.0
        /// Najszerszy moduł — wolne miejsce dzielone na równe części nie szersze niż to.
        var maxModuleMm = 600.0
    }

    /// Najwęższy moduł; krótszy odcinek zostaje na blendę.
    static let minLower = 150.0
    static let minUpper = 250.0

    private struct Iv { var a, b: Double; var len: Double { b - a } }

    /// Usuwa wcześniej rozstawione automatycznie szafki z podanych ścian.
    static func clear(_ scan: inout ScanPayload, walls: [Int]) {
        let ids = Set(walls.compactMap { scan.walls.indices.contains($0) ? scan.walls[$0].id : nil })
        scan.objects.removeAll { o in o.autoWall.map { ids.contains($0) } ?? false }
    }

    static func autoCount(_ scan: ScanPayload, wall i: Int) -> Int {
        guard scan.walls.indices.contains(i) else { return 0 }
        let id = scan.walls[i].id
        return scan.objects.filter { $0.autoWall == id }.count
    }

    /// Rozstawia szafki na ścianach po kolei (szafki z poprzedniej ściany zajmują narożnik). Zwraca liczbę dodanych.
    @discardableResult
    static func run(_ scan: inout ScanPayload, walls: [Int], _ o: Options) -> Int {
        clear(&scan, walls: walls)
        var added = 0
        for i in walls where scan.walls.indices.contains(i) {
            let m = PlanModel(scan)
            guard m.walls.indices.contains(i) else { continue }
            added += layWall(&scan, m.walls[i], o)
        }
        return added
    }

    private static func layWall(_ scan: inout ScanPayload, _ g: PlanModel.Wall, _ o: Options) -> Int {
        guard g.len > 300 else { return 0 }
        var added = 0
        var hoods: [Iv] = []

        if o.lower {
            let z1 = o.counterMm - 40
            var free = freeIntervals(scan, g, z0: 0, z1: z1, depth: o.lowerDepthMm, lower: true, o: o)

            if o.appliances {
                let onWall = scan.markers.filter { $0.wallId == g.w.id }
                let water = onWall.filter { ["drain", "water_cold", "water_hot"].contains($0.kind) }
                if !water.isEmpty, !scan.objects.contains(where: { $0.category == "sink" }) {
                    let target = water.map(\.offsetMm).reduce(0, +) / Double(water.count)
                    if let r = fit(&free, near: target, widths: [800, 600]) {
                        let (k, s) = r
                        add(&scan, g, "sink", s.a, s.b, z0: 0, h: z1, depth: o.lowerDepthMm)
                        added += 1
                        if !scan.objects.contains(where: { $0.category == "dishwasher" }) {
                            // Zmywarka po tej stronie zlewu, gdzie jest więcej miejsca.
                            let left = free[k].len, right = free[k + 1].len
                            if max(left, right) >= 600 {
                                let d = right >= left ? Iv(a: free[k + 1].a, b: free[k + 1].a + 600)
                                                      : Iv(a: free[k].b - 600, b: free[k].b)
                                add(&scan, g, "dishwasher", d.a, d.b, z0: 0, h: z1, depth: o.lowerDepthMm)
                                added += 1
                                cut(&free, d)
                            }
                        }
                    }
                }
                let hob = onWall.filter { $0.kind == "gas" || $0.kind == "power_400" }
                if let mk = hob.first, !scan.objects.contains(where: { $0.category == "stove" }) {
                    if let s = fit(&free, near: mk.offsetMm, widths: [600])?.1 {
                        add(&scan, g, "stove", s.a, s.b, z0: 0, h: z1, depth: o.lowerDepthMm)
                        hoods.append(s)
                        added += 1
                    }
                }
            }
            for iv in free { added += fill(&scan, g, iv, min: minLower, max: o.maxModuleMm, z0: 0, h: z1, depth: o.lowerDepthMm) }
        }

        // Okap nad płytą postawioną wcześniej ręcznie.
        for ob in scan.objects where ob.category == "stove" && ob.autoWall != g.w.id {
            if let s = span(ob, g, depth: o.lowerDepthMm) { hoods.append(s) }
        }

        if o.upper {
            let z0 = o.counterMm + o.gapMm
            let z1 = min(z0 + o.upperHeightMm, g.w.heightMm)
            if z1 - z0 >= 300 {
                var free = freeIntervals(scan, g, z0: z0, z1: z1, depth: o.upperDepthMm, lower: false, o: o)
                for h in hoods { cut(&free, Iv(a: h.a - 1, b: h.b + 1)) }
                for iv in free { added += fill(&scan, g, iv, min: minUpper, max: o.maxModuleMm, z0: z0, h: z1 - z0, depth: o.upperDepthMm) }
            }
        }
        return added
    }

    /// Wolne odcinki ściany w paśmie wysokości z0…z1 — bez otworów i stojących tam mebli.
    private static func freeIntervals(_ scan: ScanPayload, _ g: PlanModel.Wall, z0: Double, z1: Double,
                                       depth: Double, lower: Bool, o: Options) -> [Iv] {
        var blocked: [Iv] = []
        for s in g.spans {
            // Pod oknem z parapetem przy blacie szafki stoją (parapet tuż nad / pod blatem).
            let bottom = lower && s.kind == "window" && s.bottom >= o.counterMm - 200 ? z1 : s.bottom
            if bottom < z1 && s.top > z0 { blocked.append(Iv(a: s.t0, b: s.t1)) }
        }
        // Elementy na ścianie: odstające blokują; w licu — tylko gdy trzeba zostawić dostęp.
        for f in scan.features where f.wallId == g.w.id && (!f.flush || f.access == true)
            && f.elevationMm < z1 && f.elevationMm + f.heightMm > z0 {
            blocked.append(Iv(a: max(f.offsetMm, 0), b: min(f.offsetMm + f.widthMm, g.len)))
        }
        for ob in scan.objects where ob.elevationMm < z1 && ob.elevationMm + ob.heightMm > z0 {
            if let s = span(ob, g, depth: depth) { blocked.append(s) }
        }
        blocked.sort { $0.a < $1.a }
        var out: [Iv] = []
        var cursor = 0.0
        for b in blocked {
            if b.a > cursor { out.append(Iv(a: cursor, b: b.a)) }
            cursor = max(cursor, b.b)
        }
        if cursor < g.len { out.append(Iv(a: cursor, b: g.len)) }
        return out.filter { $0.len >= 1 }
    }

    /// Odcinek ściany zajęty przez mebel stojący w pasie `depth` od ściany.
    private static func span(_ ob: ScanObject, _ g: PlanModel.Wall, depth: Double) -> Iv? {
        let cs = PlanEdit.corners(ob)
        let ds = cs.map { PlanGeom.dot($0 - g.w.a, g.inN) }
        let ts = cs.map { PlanGeom.dot($0 - g.w.a, g.dir) }
        guard let near = ds.min(), let far = ds.max(), near < depth - 5, far > 5 else { return nil }
        let a = max(ts.min()!, 0), b = min(ts.max()!, g.len)
        return b - a > 5 ? Iv(a: a, b: b) : nil
    }

    /// Wstawia sprzęt jak najbliżej `near` w wolnym odcinku; dzieli ten odcinek na lewy (k) i prawy (k+1).
    private static func fit(_ free: inout [Iv], near t: Double, widths: [Double]) -> (Int, Iv)? {
        for w in widths {
            let cands = free.indices.filter { free[$0].len >= w }
            guard let k = cands.min(by: { dist(free[$0], t) < dist(free[$1], t) }), dist(free[k], t) < 600 else { continue }
            let iv = free[k]
            var a = min(max(t - w / 2, iv.a), iv.b - w)
            // Bez wąskich resztek przy narożniku / sąsiedzie — sprzęt dosuwamy.
            if a - iv.a < minLower { a = iv.a }
            if iv.b - (a + w) < minLower { a = iv.b - w }
            let s = Iv(a: a, b: a + w)
            free.replaceSubrange(k...k, with: [Iv(a: iv.a, b: s.a), Iv(a: s.b, b: iv.b)])
            return (k, s)
        }
        return nil
    }

    private static func dist(_ iv: Iv, _ t: Double) -> Double { t < iv.a ? iv.a - t : t > iv.b ? t - iv.b : 0 }

    private static func cut(_ free: inout [Iv], _ c: Iv) {
        free = free.flatMap { iv -> [Iv] in
            guard c.b > iv.a, c.a < iv.b else { return [iv] }
            return [Iv(a: iv.a, b: max(iv.a, c.a)), Iv(a: min(iv.b, c.b), b: iv.b)].filter { $0.len >= 1 }
        }
    }

    /// Dzieli odcinek na równe moduły ≤ max; ostatni bierze resztę z zaokrąglenia.
    private static func fill(_ scan: inout ScanPayload, _ g: PlanModel.Wall, _ iv: Iv, min: Double, max: Double,
                             z0: Double, h: Double, depth: Double) -> Int {
        let L = iv.len.rounded(.down)
        guard L >= min else { return 0 }
        let n = Swift.max(1, Int((L / max - 0.001).rounded(.up)))
        let w = (L / Double(n)).rounded(.down)
        var a = iv.a
        for k in 0..<n {
            let b = k == n - 1 ? iv.a + L : a + w
            add(&scan, g, "storage", a, b, z0: z0, h: h, depth: depth)
            a = b
        }
        return n
    }

    private static func add(_ scan: inout ScanPayload, _ g: PlanModel.Wall, _ cat: String, _ t0: Double, _ t1: Double,
                            z0: Double, h: Double, depth: Double) {
        let c = g.w.a + g.dir * ((t0 + t1) / 2) + g.inN * (depth / 2)
        let deg = atan2(g.dir.y, g.dir.x) * 180 / .pi
        scan.objects.append(ScanObject(id: UUID().uuidString, category: cat, cx: c.x.rounded(), cy: c.y.rounded(),
                                       widthMm: (t1 - t0).rounded(), depthMm: depth, heightMm: h.rounded(),
                                       elevationMm: z0.rounded(), rotationDeg: deg, autoWall: g.w.id))
    }
}
