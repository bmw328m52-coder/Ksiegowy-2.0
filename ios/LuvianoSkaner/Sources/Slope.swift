import SwiftUI

/// Skos dachu nad ścianą: od ściany (na wysokości ścianki kolankowej) sufit wznosi się
/// do pełnej wysokości pomieszczenia. Zasięg w poziomie albo kąt — drugie się wylicza.
/// Format = `slope` w room_scans.types.ts.
struct WallSlope: Codable, Equatable {
    /// Wysokość ścianki kolankowej (od podłogi do początku skosu).
    var kneeMm: Double
    /// Zasięg skosu w poziomie — od ściany do miejsca, gdzie sufit robi się płaski.
    var depthMm: Double?
    /// Kąt skosu do poziomu (°).
    var angleDeg: Double?
    /// Wykryty ze skanu RoomPlan (nie wpisany ręcznie).
    var detected: Bool?

    /// Zasięg w poziomie przy suficie na wysokości `ceiling`.
    func depth(ceiling: Double) -> Double? {
        if let d = depthMm, d > 1 { return d }
        if let a = angleDeg, a > 1, a < 89, ceiling > kneeMm { return (ceiling - kneeMm) / tan(a * .pi / 180) }
        return nil
    }

    func angle(ceiling: Double) -> Double? {
        if let a = angleDeg { return a }
        guard let d = depth(ceiling: ceiling), ceiling > kneeMm else { return nil }
        return atan((ceiling - kneeMm) / d) * 180 / .pi
    }

    /// Wysokość pod skosem w odległości `d` od ściany.
    func height(at d: Double, ceiling: Double) -> Double {
        guard d >= 0, let dep = depth(ceiling: ceiling) else { return ceiling }
        return kneeMm + (ceiling - kneeMm) * min(d / dep, 1)
    }

    /// „kolanko 1100 · 38° · 1650 w poziomie".
    func summary(ceiling: Double) -> String {
        var s = "kolanko \(Int(kneeMm.rounded()))"
        if let a = angle(ceiling: ceiling) { s += " · \(Int(a.rounded()))°" }
        if let d = depth(ceiling: ceiling) { s += " · \(Int(d.rounded())) w poziomie" }
        return s
    }
}

extension PlanModel {
    /// Wysokość sufitu w punkcie rzutu: najniższa ze wszystkich skosów (pełna wysokość, gdy brak).
    func ceiling(at p: V2) -> Double {
        var h = roomHeight
        for g in walls {
            guard let s = g.w.slope else { continue }
            let t = PlanGeom.dot(p - g.w.a, g.dir)
            guard t > -60, t < g.len + 60 else { continue }
            let d = PlanGeom.dot(p - g.w.a, g.inN)
            guard d > -60 else { continue }
            h = min(h, s.height(at: max(d, 0), ceiling: roomHeight))
        }
        return h
    }

    /// Linia sufitu nad ścianą i (t wzdłuż ściany, z = wysokość). Pusta, gdy skos jej nie dotyka.
    func ceilingProfile(_ i: Int, samples: Int = 64) -> [(t: Double, z: Double)] {
        guard walls.indices.contains(i), walls.contains(where: { $0.w.slope != nil }) else { return [] }
        let g = walls[i]
        // Punkt odrobinę w głąb pomieszczenia — ściana prostopadła do skosu dotyka go swoim licem.
        let pts = (0...samples).map { k -> (t: Double, z: Double) in
            let t = g.len * Double(k) / Double(samples)
            return (t, ceiling(at: g.at(t, -1)))
        }
        return pts.contains { $0.z < roomHeight - 5 } ? pts : []
    }

    /// Najniższy sufit nad odcinkiem ściany t0…t1.
    func minCeiling(_ i: Int, _ t0: Double, _ t1: Double) -> Double {
        guard walls.indices.contains(i) else { return roomHeight }
        let g = walls[i]
        let n = max(2, Int((t1 - t0) / 50))
        return (0...n).map { ceiling(at: g.at(t0 + (t1 - t0) * Double($0) / Double(n), -1)) }.min() ?? roomHeight
    }
}

enum SlopeDraw {
    static let ink = Color(red: 0.55, green: 0.42, blue: 0.30)

    /// Rzut: pas skosu (kreskowany) od ściany do linii załamania + opis.
    static func plan(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout) {
        for g in m.walls {
            guard let s = g.w.slope, let d = s.depth(ceiling: m.roomHeight) else { continue }
            let band = Draft.poly([g.at(0, 0), g.at(g.len, 0), g.at(g.len, -d), g.at(0, -d)].map(L.pt))
            var c = ctx
            if m.floor.count >= 3 { c.clip(to: Draft.poly(m.floor.map(L.pt))) }
            c.fill(band, with: .color(ink.opacity(0.07)))
            PlanDraw.hatch(c, band, color: ink.opacity(0.18))
            c.stroke(Draft.line(L.pt(g.at(0, -d)), L.pt(g.at(g.len, -d))), with: .color(ink),
                     style: StrokeStyle(lineWidth: 1.2, dash: [7, 4]))
            let mid = g.at(g.len / 2, -d / 2)
            ctx.draw(Text("skos · \(s.summary(ceiling: m.roomHeight))")
                        .font(.system(size: 10, weight: .semibold)).foregroundColor(ink),
                     at: L.pt(mid))
        }
    }

    /// Widok ściany: obszar nad linią sufitu kreskowany (tam jest skos), linia sufitu + kolanko.
    static func elevation(_ ctx: GraphicsContext, _ L: ElevLayout, _ profile: [(t: Double, z: Double)]) {
        guard profile.count >= 2 else { return }
        let top = profile.map { L.p($0.t, min($0.z, L.H)) }
        let area = Draft.poly(top + [L.p(L.W, L.H), L.p(0, L.H)])
        ctx.fill(area, with: .color(ink.opacity(0.10)))
        PlanDraw.hatch(ctx, area, color: ink.opacity(0.28))
        var line = Path()
        line.addLines(top)
        ctx.stroke(line, with: .color(ink), lineWidth: 2)
        // Najniższy punkt sufitu = kolanko przy ścianie ze skosem.
        if let low = profile.min(by: { $0.z < $1.z }), low.z < L.H - 5 {
            let atStart = low.t < L.W / 2
            let tx = atStart ? 0.0 : L.W
            let q = L.p(tx, low.z)
            ctx.draw(Text("\(Int(low.z.rounded()))").font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundColor(ink),
                     at: CGPoint(x: q.x + (atStart ? 22 : -22), y: q.y - 10))
            let flat = profile.first { $0.z >= L.H - 5 }
            if let flat, profile.count > 2 {
                let mid = L.p((low.t + flat.t) / 2, (low.z + L.H) / 2)
                ctx.draw(Text("skos").font(.system(size: 11, weight: .semibold)).foregroundColor(ink), at: mid)
            } else {
                ctx.draw(Text("skos").font(.system(size: 11, weight: .semibold)).foregroundColor(ink),
                         at: L.p(L.W / 2, (low.z + L.H) / 2))
            }
        }
    }
}
