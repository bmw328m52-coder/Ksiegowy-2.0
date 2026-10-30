import Foundation

/// Krzywizny ściany zmierzone dalmierzem: długość na 3 wysokościach (dół / środek / góra —
/// różnica = sąsiednie ściany nie są w pionie) i wysokość w 3 miejscach (lewo / środek / prawo —
/// różnica = krzywa podłoga albo sufit). Format = `curve` w room_scans.types.ts.
struct WallCurve: Codable, Equatable {
    var lengthBottom: Double?
    var lengthMiddle: Double?
    var lengthTop: Double?
    var heightLeft: Double?
    var heightMiddle: Double?
    var heightRight: Double?

    struct Field { let key, group, name: String }

    static let fields = [
        Field(key: "lb", group: "Długość", name: "dół"), Field(key: "lm", group: "Długość", name: "środek"),
        Field(key: "lt", group: "Długość", name: "góra"),
        Field(key: "hl", group: "Wysokość", name: "lewo"), Field(key: "hm", group: "Wysokość", name: "środek"),
        Field(key: "hr", group: "Wysokość", name: "prawo"),
    ]

    subscript(key: String) -> Double? {
        get {
            switch key {
            case "lb": return lengthBottom
            case "lm": return lengthMiddle
            case "lt": return lengthTop
            case "hl": return heightLeft
            case "hm": return heightMiddle
            default: return heightRight
            }
        }
        set {
            switch key {
            case "lb": lengthBottom = newValue
            case "lm": lengthMiddle = newValue
            case "lt": lengthTop = newValue
            case "hl": heightLeft = newValue
            case "hm": heightMiddle = newValue
            default: heightRight = newValue
            }
        }
    }

    var isEmpty: Bool { Self.fields.allSatisfy { self[$0.key] == nil } }

    /// Największa różnica między zmierzonymi wartościami (min. 2 pomiary).
    static func spread(_ v: [Double?]) -> Double? {
        let x = v.compactMap { $0 }
        guard x.count >= 2 else { return nil }
        return x.max()! - x.min()!
    }

    var lengthSpread: Double? { Self.spread([lengthBottom, lengthMiddle, lengthTop]) }
    var heightSpread: Double? { Self.spread([heightLeft, heightMiddle, heightRight]) }

    /// Od tej różnicy (mm) ostrzegamy — szafa / zabudowa wymaga maskownicy albo regulacji.
    static let warnMm = 5.0

    /// „Długość 2302/2305/2310 · różnica 8 mm (góra szersza)".
    var lengthSummary: String? {
        guard let d = lengthSpread else { return nil }
        let vals = [lengthBottom, lengthMiddle, lengthTop].map { $0.map { "\(Int($0.rounded()))" } ?? "—" }.joined(separator: "/")
        var s = "dł. d/ś/g \(vals) · różnica \(Int(d.rounded())) mm"
        if let b = lengthBottom, let t = lengthTop, abs(t - b) >= 1 { s += t > b ? " (góra dłuższa)" : " (dół dłuższy)" }
        return s
    }

    var heightSummary: String? {
        guard let d = heightSpread else { return nil }
        let vals = [heightLeft, heightMiddle, heightRight].map { $0.map { "\(Int($0.rounded()))" } ?? "—" }.joined(separator: "/")
        var s = "wys. l/ś/p \(vals) · różnica \(Int(d.rounded())) mm"
        if let l = heightLeft, let r = heightRight, abs(r - l) >= 1 { s += r > l ? " (prawa wyższa)" : " (lewa wyższa)" }
        return s
    }

    var summary: String? {
        let parts = [lengthSummary, heightSummary].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    var warn: Bool { max(lengthSpread ?? 0, heightSpread ?? 0) >= Self.warnMm }
}

extension PlanModel {
    /// Kąt wewnętrzny w narożniku między ścianą i a następną (stopnie; 90 = prosty, 270 = narożnik wklęsły).
    func cornerAngle(_ i: Int) -> Double? {
        guard walls.indices.contains(i), let j = walls[i].next, walls.indices.contains(j) else { return nil }
        let di = walls[i].dir, dj = walls[j].dir
        let turn = atan2(PlanGeom.cross(di, dj), PlanGeom.dot(di, dj)) * 180 / .pi
        let leftIn = PlanGeom.cross(di, walls[i].inN) > 0
        return 180 - (leftIn ? turn : -turn)
    }

    /// Narożniki odbiegające od 90° / 270° o co najmniej `minDev` stopni.
    func skewedCorners(minDev: Double = 0.5) -> [(wall: Int, angle: Double)] {
        walls.indices.compactMap { i in
            guard let a = cornerAngle(i) else { return nil }
            let dev = min(abs(a - 90), abs(a - 270), abs(a - 180))
            return dev >= minDev && abs(a - 180) >= minDev ? (i, a) : nil
        }
    }
}
