import SwiftUI

/// Szkic szafy przy ścianie — do ustalenia z klientem układu wnętrza na pomiarze.
/// Korpus: cokół, wieniec dolny/górny, przegrody (sekcje), w każdej sekcji strefy od dołu
/// (półki, drążek, szuflady…). Format = `wardrobes` w room_scans.types.ts.
struct ScanWardrobe: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var wallId: String
    /// Lewy bok od lewego narożnika ściany.
    var offsetMm: Double
    var widthMm: Double
    var heightMm: Double
    var depthMm: Double
    /// Cokół pod wieńcem dolnym.
    var plinthMm: Double
    /// Blenda nad wieńcem górnym (do sufitu).
    var topMm: Double
    /// sliding / hinged / none
    var doors: String
    var doorCount: Int
    var sections: [WardrobeSection]
    var note: String?
    /// box_back = skrzynkowa z plecami, box = skrzynkowa bez pleców, frame = sam szkielet (zabudowa wnęki).
    var construction: String?
    /// Pawlacz na całą szerokość nad sekcjami — wysokość w świetle (nil / 0 = brak).
    var pawlaczMm: Double?
    /// Liczba drzwiczek pawlacza (uchylne); nil = jak skrzydeł szafy.
    var pawlaczDoors: Int?
}

struct WardrobeSection: Codable, Equatable {
    /// Szerokość w świetle; nil = równy podział reszty.
    var widthMm: Double?
    /// Strefy od dołu do góry.
    var zones: [WardrobeZone]
}

struct WardrobeZone: Codable, Equatable {
    /// shelves / rail / drawers / shoes / pantograph / empty
    var kind: String
    /// Wysokość w świetle; nil = równy podział reszty sekcji.
    var heightMm: Double?
    /// Liczba przegródek (półki), szuflad, półek na buty.
    var count: Int?
}

enum ZoneKind: String, CaseIterable, Identifiable {
    case shelves, rail, drawers, shoes, pantograph, empty
    var id: String { rawValue }

    var label: String {
        switch self {
        case .shelves: return "Półki"
        case .rail: return "Drążek"
        case .drawers: return "Szuflady"
        case .shoes: return "Na buty"
        case .pantograph: return "Pantograf"
        case .empty: return "Wolne miejsce"
        }
    }

    var symbol: String {
        switch self {
        case .shelves: return "line.3.horizontal"
        case .rail: return "hanger"
        case .drawers: return "tray.2"
        case .shoes: return "shoeprints.fill"
        case .pantograph: return "arrow.down.to.line.compact"
        case .empty: return "square.dashed"
        }
    }

    var hasCount: Bool { self == .shelves || self == .drawers || self == .shoes }

    /// Typowa wysokość strefy w świetle (mm).
    var typicalHeight: Double {
        switch self {
        case .shelves: return 700
        case .rail: return 1000
        case .drawers: return 600
        case .shoes: return 450
        case .pantograph: return 900
        case .empty: return 500
        }
    }

    init(key: String) { self = ZoneKind(rawValue: key) ?? .empty }
}

/// Gotowe układy sekcji (od dołu).
enum WardrobePreset: String, CaseIterable, Identifiable {
    case railShelf, doubleRail, longRail, shelves, drawersRail, drawersShelves, shoesShelves
    var id: String { rawValue }

    var label: String {
        switch self {
        case .railShelf: return "Drążek + półki nad"
        case .doubleRail: return "Dwa drążki (jeden nad drugim)"
        case .longRail: return "Długie ubrania"
        case .shelves: return "Same półki"
        case .drawersRail: return "Szuflady + drążek"
        case .drawersShelves: return "Szuflady + półki"
        case .shoesShelves: return "Buty + półki"
        }
    }

    var zones: [WardrobeZone] {
        switch self {
        case .railShelf:
            return [WardrobeZone(kind: "empty", heightMm: 450), WardrobeZone(kind: "rail", heightMm: 1050),
                    WardrobeZone(kind: "shelves", heightMm: nil, count: 2)]
        case .doubleRail:
            // Koszule / marynarki na dwóch poziomach: dolny drążek ~1000 nad podłogą, górny nad nim.
            return [WardrobeZone(kind: "rail", heightMm: 950), WardrobeZone(kind: "rail", heightMm: nil)]
        case .longRail:
            return [WardrobeZone(kind: "rail", heightMm: 1550), WardrobeZone(kind: "shelves", heightMm: nil, count: 1)]
        case .shelves:
            return [WardrobeZone(kind: "shelves", heightMm: nil, count: 6)]
        case .drawersRail:
            return [WardrobeZone(kind: "drawers", heightMm: 640, count: 3), WardrobeZone(kind: "rail", heightMm: 1000),
                    WardrobeZone(kind: "shelves", heightMm: nil, count: 1)]
        case .drawersShelves:
            return [WardrobeZone(kind: "drawers", heightMm: 640, count: 3), WardrobeZone(kind: "shelves", heightMm: nil, count: 4)]
        case .shoesShelves:
            return [WardrobeZone(kind: "shoes", heightMm: 600, count: 3), WardrobeZone(kind: "shelves", heightMm: nil, count: 4)]
        }
    }
}

extension ScanWardrobe {
    /// Nowa szafa na całą wolną ścianę, sekcje ok. 800–1000 mm na przemian: drążek / półki.
    static func make(wallId: String, offset: Double, width: Double, height: Double) -> ScanWardrobe {
        let n = max(1, Int((width / 900).rounded()))
        let presets: [WardrobePreset] = [.railShelf, .shelves, .drawersRail, .longRail]
        let secs = (0..<n).map { WardrobeSection(widthMm: nil, zones: presets[$0 % presets.count].zones) }
        return ScanWardrobe(wallId: wallId, offsetMm: offset, widthMm: width, heightMm: height, depthMm: 600,
                            plinthMm: 100, topMm: 0, doors: "sliding", doorCount: max(2, min(4, n)), sections: secs, note: nil)
    }

    var kind: String { construction ?? "box_back" }
    var hasPawlacz: Bool { (pawlaczMm ?? 0) > 50 }
    var pawlaczDoorCount: Int { pawlaczDoors ?? max(doorCount, 2) }
    var hasBack: Bool { kind == "box_back" }
    /// Szkielet: bez boków przy ścianach, bez wieńców i pleców — przegrody i półki do ścian.
    var isFrame: Bool { kind == "frame" }

    static let constructions: [(key: String, label: String)] = [
        ("box_back", "Skrzynkowa z plecami"), ("box", "Skrzynkowa bez pleców"), ("frame", "Sam szkielet (wnęka)"),
    ]
    var constructionLabel: String { Self.constructions.first { $0.key == kind }?.label ?? "" }

    var doorsLabel: String {
        switch doors {
        case "sliding": return "Drzwi przesuwne ×\(doorCount)"
        case "hinged": return "Drzwi uchylne ×\(doorCount)"
        default: return "Bez drzwi"
        }
    }
}

// MARK: - Geometria (mm, lokalnie: t od lewego boku, z od podłogi)

enum WardrobeGeom {
    static let board = 18.0

    struct ZoneBox { let kind: ZoneKind; let count: Int; let z0, z1: Double; let index: Int }
    struct SectionBox { let t0, t1, z0, z1: Double; let zones: [ZoneBox]; let index: Int }

    static func innerZ(_ w: ScanWardrobe) -> (Double, Double) {
        (w.plinthMm + board, max(w.heightMm - w.topMm - board, w.plinthMm + board + 1))
    }

    /// Góra sekcji (pod pawlaczem, jeśli jest).
    static func sectionTop(_ w: ScanWardrobe) -> Double {
        let (z0, z1) = innerZ(w)
        return w.hasPawlacz ? max(z1 - (w.pawlaczMm ?? 0) - board, z0 + 100) : z1
    }

    /// Wnętrze pawlacza (od półki nad sekcjami do wieńca górnego).
    static func pawlaczZ(_ w: ScanWardrobe) -> (Double, Double)? {
        guard w.hasPawlacz else { return nil }
        return (sectionTop(w) + board, innerZ(w).1)
    }

    static func sections(_ w: ScanWardrobe) -> [SectionBox] {
        let n = max(w.sections.count, 1)
        let inner = w.widthMm - board * Double(n + 1)
        let fixed = w.sections.compactMap(\.widthMm).reduce(0, +)
        let autoN = w.sections.filter { $0.widthMm == nil }.count
        let auto = autoN > 0 ? max((inner - fixed) / Double(autoN), 50) : 0
        let z0 = innerZ(w).0, z1 = sectionTop(w)
        var t = board
        var out: [SectionBox] = []
        for (k, s) in w.sections.enumerated() {
            let sw = s.widthMm ?? auto
            out.append(SectionBox(t0: t, t1: t + sw, z0: z0, z1: z1, zones: zones(s, z0: z0, z1: z1), index: k))
            t += sw + board
        }
        return out
    }

    static func zones(_ s: WardrobeSection, z0: Double, z1: Double) -> [ZoneBox] {
        let n = s.zones.count
        guard n > 0 else { return [] }
        let avail = z1 - z0 - board * Double(n - 1)
        let fixed = s.zones.compactMap(\.heightMm).reduce(0, +)
        let autoN = s.zones.filter { $0.heightMm == nil }.count
        let auto = autoN > 0 ? max((avail - fixed) / Double(autoN), 30) : 0
        var z = z0
        var out: [ZoneBox] = []
        for (k, zn) in s.zones.enumerated() {
            let h = zn.heightMm ?? auto
            out.append(ZoneBox(kind: ZoneKind(key: zn.kind), count: max(zn.count ?? 1, 1), z0: z, z1: min(z + h, z1), index: k))
            z += h + board
        }
        return out
    }

    /// Szerokość sekcji w świetle (do edycji wymiaru).
    static func sectionWidth(_ w: ScanWardrobe, _ k: Int) -> Double {
        let s = sections(w)
        return s.indices.contains(k) ? s[k].t1 - s[k].t0 : 0
    }

    static func zoneHeight(_ w: ScanWardrobe, section k: Int, zone j: Int) -> Double {
        let s = sections(w)
        guard s.indices.contains(k), s[k].zones.indices.contains(j) else { return 0 }
        return s[k].zones[j].z1 - s[k].zones[j].z0
    }

    struct Conflict {
        let feature: ScanFeature
        /// Sekcja (za plecami) albo nil przy boku.
        let section: Int?
        /// back / left / right
        let side: String

        /// Co trzeba przewidzieć w zabudowie.
        func advice(_ w: ScanWardrobe) -> String {
            let name = FeatureKind(key: feature.kind).label.lowercased()
            switch side {
            case "left", "right":
                let s = side == "left" ? "lewym" : "prawym"
                if w.isFrame { return "\(name) przy \(s) boku — szkielet bez boku, dostęp od frontu" }
                return "\(name) przy \(s) boku — otwór rewizyjny / drzwiczki w \(s) boku szafy"
            default:
                let sec = section.map { "sekcja \($0 + 1)" } ?? "za szafą"
                if !w.hasBack { return "\(name) za plecami — \(sec): bez pleców, dostęp przez drzwi i wnętrze" }
                return "\(name) za plecami — \(sec): wyciąć plecy / rewizja, bez stałych półek przed skrzynką"
            }
        }
    }

    /// Elementy z wymaganym dostępem zasłonięte szafą: za plecami (ta sama ściana) albo przy boku
    /// (ściana sąsiednia w zasięgu głębokości, gdy szafa dochodzi do narożnika).
    static func accessConflicts(_ w: ScanWardrobe, _ scan: ScanPayload) -> [Conflict] {
        let secs = sections(w)
        var out: [Conflict] = []
        for f in scan.features where f.access == true && f.wallId == w.wallId {
            let a = f.offsetMm - w.offsetMm, b = a + f.widthMm
            guard b > 0, a < w.widthMm, f.elevationMm < w.heightMm else { continue }
            let mid = (max(a, 0) + min(b, w.widthMm)) / 2
            out.append(Conflict(feature: f, section: secs.first { mid >= $0.t0 - board && mid <= $0.t1 + board }?.index, side: "back"))
        }
        let m = PlanModel(scan)
        guard let i = m.walls.firstIndex(where: { $0.w.id == w.wallId }) else { return out }
        let g = m.walls[i]
        let reach = 80.0 // szafa „dochodzi" do narożnika
        if w.offsetMm < reach, let p = g.prev, m.walls.indices.contains(p) {
            let pw = m.walls[p]
            for f in scan.features where f.access == true && f.wallId == pw.w.id
                && f.offsetMm + f.widthMm > pw.len - w.depthMm - w.offsetMm && f.elevationMm < w.heightMm {
                out.append(Conflict(feature: f, section: nil, side: "left"))
            }
        }
        if w.offsetMm + w.widthMm > g.len - reach, let n = g.next, m.walls.indices.contains(n) {
            let nw = m.walls[n]
            let gap = max(g.len - w.offsetMm - w.widthMm, 0)
            for f in scan.features where f.access == true && f.wallId == nw.w.id
                && f.offsetMm < w.depthMm + gap && f.elevationMm < w.heightMm {
                out.append(Conflict(feature: f, section: nil, side: "right"))
            }
        }
        return out
    }
}

// MARK: - Rysunek frontu (bez drzwi — widać wnętrze)

enum WardrobeDraw {
    static let wood = Color(red: 0.87, green: 0.80, blue: 0.70)
    static let woodEdge = Color(red: 0.55, green: 0.45, blue: 0.33)
    static let back = Color(red: 0.97, green: 0.95, blue: 0.92)

    /// `p` zamienia mm szafy (t od lewego boku, z od podłogi) na punkty ekranu.
    static func draw(_ ctx: GraphicsContext, _ w: ScanWardrobe, s: Double, p: (Double, Double) -> CGPoint,
                     selectedSection: Int? = nil, selectedZone: Int? = nil, labels: Bool = true) {
        let B = WardrobeGeom.board
        func rect(_ t0: Double, _ t1: Double, _ z0: Double, _ z1: Double) -> CGRect {
            let a = p(t0, z1), b = p(t1, z0)
            return CGRect(x: a.x, y: a.y, width: max(b.x - a.x, 0.5), height: max(b.y - a.y, 0.5))
        }
        func boardRect(_ r: CGRect) {
            ctx.fill(Path(r), with: .color(wood))
            ctx.stroke(Path(r), with: .color(woodEdge), lineWidth: 0.6)
        }
        let (zIn0, zIn1) = WardrobeGeom.innerZ(w)
        if w.hasBack {
            ctx.fill(Path(rect(0, w.widthMm, w.plinthMm, w.heightMm - w.topMm)), with: .color(back))
        } else {
            // Bez pleców — widać ścianę (kreskowanie).
            let r = rect(0, w.widthMm, w.plinthMm, w.heightMm - w.topMm)
            ctx.fill(Path(r), with: .color(Color(white: 0.96)))
            var c = ctx
            c.clip(to: Path(r))
            var x = r.minX - r.height
            while x < r.maxX {
                c.stroke(Draft.line(CGPoint(x: x, y: r.maxY), CGPoint(x: x + r.height, y: r.minY)), with: .color(Color(white: 0.88)), lineWidth: 0.6)
                x += 14
            }
        }
        // Cokół i blenda.
        if w.plinthMm > 1 { boardRect(rect(B, w.widthMm - B, 0, w.plinthMm)) }
        if w.topMm > 1 { boardRect(rect(0, w.widthMm, w.heightMm - w.topMm, w.heightMm)) }
        if w.isFrame {
            // Szkielet: boki i wieńce zastępuje ściana / sufit — linia przerywana.
            for t in [0.0, w.widthMm - B] {
                ctx.stroke(Path(rect(t, t + B, 0, w.heightMm - w.topMm)), with: .color(woodEdge.opacity(0.6)),
                           style: StrokeStyle(lineWidth: 0.8, dash: [4, 3]))
            }
            boardRect(rect(B, w.widthMm - B, zIn0 - B, zIn0))
        } else {
            boardRect(rect(0, B, 0, w.heightMm - w.topMm))
            boardRect(rect(w.widthMm - B, w.widthMm, 0, w.heightMm - w.topMm))
            boardRect(rect(B, w.widthMm - B, zIn0 - B, zIn0))
            boardRect(rect(B, w.widthMm - B, zIn1, zIn1 + B))
        }

        let ink = Color(white: 0.3)
        let secTop = WardrobeGeom.sectionTop(w)
        // Pawlacz: półka na całą szerokość + opis.
        if let pz = WardrobeGeom.pawlaczZ(w) {
            let (pz0, pz1) = pz
            boardRect(rect(B, w.widthMm - B, pz0 - B, pz0))
            let r = rect(B, w.widthMm - B, pz0, pz1)
            if labels, r.width > 60, r.height > 16 {
                ctx.draw(Text("Pawlacz · \(Int((pz1 - pz0).rounded()))").font(.system(size: 10, weight: .medium).monospacedDigit())
                            .foregroundColor(Color(white: 0.25)), at: CGPoint(x: r.midX, y: r.midY))
            }
            if w.doors != "none", w.pawlaczDoorCount > 1 {
                for k in 1..<w.pawlaczDoorCount {
                    let t = w.widthMm * Double(k) / Double(w.pawlaczDoorCount)
                    ctx.stroke(Draft.line(p(t, pz0 - B), p(t, w.heightMm - w.topMm)), with: .color(Brand.gold.opacity(0.7)),
                               style: StrokeStyle(lineWidth: 1.2, dash: [8, 5]))
                }
            }
        }
        for sec in WardrobeGeom.sections(w) {
            if sec.index < w.sections.count - 1 { boardRect(rect(sec.t1, sec.t1 + B, zIn0, secTop)) }
            for zn in sec.zones {
                if zn.index > 0 { boardRect(rect(sec.t0, sec.t1, zn.z0 - B, zn.z0)) }
                let r = rect(sec.t0, sec.t1, zn.z0, zn.z1)
                switch zn.kind {
                case .shelves:
                    for k in 1..<max(zn.count, 1) {
                        let z = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(zn.count) - B / 2
                        boardRect(rect(sec.t0, sec.t1, z, z + B))
                    }
                case .rail, .pantograph:
                    let y = p(0, zn.z1 - 60).y
                    ctx.stroke(Draft.line(CGPoint(x: r.minX + 4, y: y), CGPoint(x: r.maxX - 4, y: y)), with: .color(ink), lineWidth: 2.5)
                    // Wieszaki.
                    let n = max(1, Int(r.width / 22))
                    for k in 0..<n {
                        let x = r.minX + r.width * (Double(k) + 0.5) / Double(n)
                        var h = Path()
                        h.move(to: CGPoint(x: x, y: y))
                        h.addLine(to: CGPoint(x: x - 8, y: y + 9))
                        h.addLine(to: CGPoint(x: x + 8, y: y + 9))
                        h.closeSubpath()
                        ctx.stroke(h, with: .color(ink.opacity(0.45)), lineWidth: 0.7)
                        let len = zn.kind == .pantograph ? 0.55 : 0.75
                        ctx.stroke(Draft.line(CGPoint(x: x, y: y + 9), CGPoint(x: x, y: y + 9 + (r.height - 70 * s) * len)),
                                   with: .color(ink.opacity(0.18)), lineWidth: max(r.width / Double(n) * 0.5, 1))
                    }
                    if zn.kind == .pantograph {
                        ctx.draw(Text("⇣").font(.system(size: 14)).foregroundColor(ink), at: CGPoint(x: r.maxX - 12, y: y + 14))
                    }
                case .drawers:
                    let n = max(zn.count, 1)
                    for k in 0..<n {
                        let fz0 = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(n)
                        let fz1 = zn.z0 + (zn.z1 - zn.z0) * Double(k + 1) / Double(n)
                        let fr = rect(sec.t0 + 4, sec.t1 - 4, fz0 + 3, fz1 - 3)
                        ctx.fill(Path(fr), with: .color(Color.white))
                        ctx.stroke(Path(fr), with: .color(woodEdge), lineWidth: 0.9)
                        ctx.stroke(Draft.line(CGPoint(x: fr.midX - 12, y: fr.minY + 8), CGPoint(x: fr.midX + 12, y: fr.minY + 8)),
                                   with: .color(ink), lineWidth: 1.5)
                    }
                case .shoes:
                    let n = max(zn.count, 1)
                    for k in 0..<n {
                        let za = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(n) + 20
                        let zb = za + min((zn.z1 - zn.z0) / Double(n) * 0.6, 160)
                        ctx.stroke(Draft.line(p(sec.t0 + 10, za), p(sec.t1 - 10, zb)), with: .color(woodEdge), lineWidth: 2)
                    }
                case .empty:
                    ctx.stroke(Path(r.insetBy(dx: 6, dy: 6)), with: .color(ink.opacity(0.25)), style: StrokeStyle(lineWidth: 0.8, dash: [4, 4]))
                }
                if sec.index == selectedSection {
                    let hl = zn.index == selectedZone
                    ctx.fill(Path(r), with: .color(PlanStyle.selected.opacity(hl ? 0.16 : 0.05)))
                    if hl { ctx.stroke(Path(r.insetBy(dx: 1.5, dy: 1.5)), with: .color(PlanStyle.selected), lineWidth: 2) }
                }
                if labels, r.width > 60, r.height > 34 {
                    let h = Int((zn.z1 - zn.z0).rounded())
                    let name = zn.kind.hasCount && zn.count > 1 ? "\(zn.kind.label) ×\(zn.count)" : zn.kind.label
                    let t = Text("\(name) · \(h)").font(.system(size: 10, weight: .medium).monospacedDigit()).foregroundColor(Color(white: 0.25))
                    let res = ctx.resolve(t)
                    let ts = res.measure(in: CGSize(width: 300, height: 30))
                    let c = CGPoint(x: r.midX, y: r.maxY - ts.height / 2 - 5)
                    ctx.fill(Path(roundedRect: CGRect(x: c.x - ts.width / 2 - 4, y: c.y - ts.height / 2 - 1, width: ts.width + 8, height: ts.height + 2), cornerRadius: 4),
                             with: .color(Color.white.opacity(0.85)))
                    ctx.draw(res, at: c)
                }
            }
            if sec.index == selectedSection {
                ctx.stroke(Path(rect(sec.t0, sec.t1, zIn0, zIn1).insetBy(dx: -2, dy: -2)), with: .color(PlanStyle.selected), lineWidth: 2.5)
            }
        }
        // Podział drzwi — linie przerywane na froncie.
        if w.doors != "none", w.doorCount > 1 {
            for k in 1..<w.doorCount {
                let t = w.widthMm * Double(k) / Double(w.doorCount)
                ctx.stroke(Draft.line(p(t, w.plinthMm), p(t, w.hasPawlacz ? secTop : w.heightMm - w.topMm)), with: .color(Brand.gold.opacity(0.7)),
                           style: StrokeStyle(lineWidth: 1.2, dash: [8, 5]))
            }
        }
        ctx.stroke(Path(rect(0, w.widthMm, 0, w.heightMm)), with: .color(woodEdge), lineWidth: 1.4)
    }

    /// Rzut: prostokąt szafy przy ścianie z przekątną i podziałem na sekcje.
    static func plan(_ ctx: GraphicsContext, _ m: PlanModel, _ L: PlanLayout, _ w: ScanWardrobe) {
        guard let g = m.walls.first(where: { $0.w.id == w.wallId }) else { return }
        let t0 = w.offsetMm, t1 = w.offsetMm + w.widthMm
        let shape = Draft.poly([g.at(t0, 0), g.at(t1, 0), g.at(t1, -w.depthMm), g.at(t0, -w.depthMm)].map(L.pt))
        ctx.fill(shape, with: .color(wood.opacity(0.55)))
        ctx.stroke(shape, with: .color(woodEdge), lineWidth: 1.2)
        for sec in WardrobeGeom.sections(w) where sec.index < w.sections.count - 1 {
            let t = t0 + sec.t1 + WardrobeGeom.board / 2
            ctx.stroke(Draft.line(L.pt(g.at(t, 0)), L.pt(g.at(t, -w.depthMm + 40))), with: .color(woodEdge.opacity(0.7)), lineWidth: 0.8)
        }
        // Linia frontu (drzwi).
        if w.doors != "none" {
            ctx.stroke(Draft.line(L.pt(g.at(t0, -w.depthMm + 25)), L.pt(g.at(t1, -w.depthMm + 25))), with: .color(woodEdge), lineWidth: 0.8)
        }
        let c = L.pt(g.at((t0 + t1) / 2, -w.depthMm / 2))
        ctx.draw(Text("Szafa").font(.system(size: 11, weight: .semibold)).foregroundColor(woodEdge), at: c)
    }
}
