import Foundation
import RoomPlan
import simd

// Format zgodny z meble-app: src/lib/dao/room_scans.types.ts (klucze snake_case
// powstają przez JSONEncoder.keyEncodingStrategy = .convertToSnakeCase).

struct ScanWall: Codable {
    let id: String
    var x1, y1, x2, y2: Double
    var lengthMm: Double
    var heightMm: Double
    /// Wymiar potwierdzony ręcznie / dalmierzem.
    var measured: Bool?
    /// Ściana do wybudowania — dorysowana na pomiarze, jeszcze jej nie ma.
    var planned: Bool?
    /// Krzywizny zmierzone dalmierzem (długość na 3 wysokościach, wysokość w 3 miejscach).
    var curve: WallCurve?
}

struct ScanOpening: Codable {
    let id: String
    var kind: String
    var wallId: String?
    var x1, y1, x2, y2: Double
    var widthMm: Double
    var heightMm: Double
    var sillMm: Double
    /// Odcinki zmierzone ręcznie / dalmierzem: before, after, width, sill, height, head.
    var measuredParts: [String]?
    /// Parapet wewnętrzny: wysunięcie przed lico ściany i grubość deski (mm).
    var sillDepthMm: Double?
    var sillThicknessMm: Double?
}

struct ScanObject: Codable {
    let id: String
    var category: String
    var cx, cy: Double
    var widthMm: Double
    var depthMm: Double
    var heightMm: Double
    /// Dolna krawędź od podłogi (szafki wiszące > 0).
    var elevationMm: Double
    var rotationDeg: Double
    /// Szafka rozstawiona automatycznie przy tej ścianie (id) — ponowne rozstawienie ją podmienia.
    var autoWall: String? = nil
}

/// Punkt instalacji na ścianie (woda, odpływ, gniazdko…), wskazany ręcznie.
/// Położenie: odległość od początku ściany (lewy narożnik w widoku ściany) i od podłogi.
struct ScanMarker: Codable, Identifiable {
    var id = UUID().uuidString
    var kind: String
    var wallId: String
    var offsetMm: Double
    var heightMm: Double
    var note: String?
    /// Id zdjęć (PhotoStore / bucket scan-photos `{user_id}/{id}.jpg`).
    var photos: [String]?
}

struct ScanPayload: Codable {
    var version = 1
    var scannedAt: String
    var walls: [ScanWall]
    var openings: [ScanOpening]
    var objects: [ScanObject]
    var roomHeightMm: Double?
    /// Ściany tworzą zamknięty obrys (kolejność = obieg pomieszczenia).
    var closed: Bool = false
    /// Obrys podłogi wyliczony przez RoomPlan [[x, y]] (mm) — także gdy ściany się nie domykają.
    var floor: [[Double]]?
    /// Punkty instalacji dodane ręcznie po skanie.
    var markers: [ScanMarker] = []
    /// Lista kontrolna: potwierdzone ręcznie pozycje („room_height", „none:gas" = brak gazu…).
    var checks: [String]? = nil
    /// Elementy na ścianach (grzejnik, rury, skrzynka…).
    var features: [ScanFeature] = []
    /// Szkice szaf przy ścianach (układ wnętrza do ustalenia z klientem).
    var wardrobes: [ScanWardrobe] = []
    /// Notatki z pomiaru (całe pomieszczenie).
    var notes: String? = nil
}

// Odczyt (zapis lokalny i skany z meble-app): pola dodane później mogą nie istnieć w starszych skanach.
extension ScanObject {
    private enum K: String, CodingKey { case id, category, cx, cy, widthMm, depthMm, heightMm, elevationMm, rotationDeg, autoWall }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: K.self)
        id = try c.decode(String.self, forKey: .id)
        category = try c.decode(String.self, forKey: .category)
        cx = try c.decode(Double.self, forKey: .cx)
        cy = try c.decode(Double.self, forKey: .cy)
        widthMm = try c.decode(Double.self, forKey: .widthMm)
        depthMm = try c.decode(Double.self, forKey: .depthMm)
        heightMm = try c.decode(Double.self, forKey: .heightMm)
        elevationMm = try c.decodeIfPresent(Double.self, forKey: .elevationMm) ?? 0
        rotationDeg = try c.decode(Double.self, forKey: .rotationDeg)
        autoWall = try c.decodeIfPresent(String.self, forKey: .autoWall)
    }
}

extension ScanPayload {
    private enum K: String, CodingKey { case version, scannedAt, walls, openings, objects, roomHeightMm, closed, floor, markers, checks, features, wardrobes, notes }
    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: K.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        scannedAt = try c.decodeIfPresent(String.self, forKey: .scannedAt) ?? ""
        walls = try c.decode([ScanWall].self, forKey: .walls)
        openings = try c.decodeIfPresent([ScanOpening].self, forKey: .openings) ?? []
        objects = try c.decodeIfPresent([ScanObject].self, forKey: .objects) ?? []
        roomHeightMm = try c.decodeIfPresent(Double.self, forKey: .roomHeightMm)
        closed = try c.decodeIfPresent(Bool.self, forKey: .closed) ?? false
        floor = try c.decodeIfPresent([[Double]].self, forKey: .floor)
        markers = try c.decodeIfPresent([ScanMarker].self, forKey: .markers) ?? []
        checks = try c.decodeIfPresent([String].self, forKey: .checks)
        features = try c.decodeIfPresent([ScanFeature].self, forKey: .features) ?? []
        wardrobes = try c.decodeIfPresent([ScanWardrobe].self, forKey: .wardrobes) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }
}

/// CapturedRoom (metry, 3D) → rzut 2D w mm. Rzut obracamy tak, żeby najdłuższa
/// ściana leżała poziomo, i przesuwamy do (0,0) — czytelniej na ekranie i w PDF.
enum ScanExport {
    private struct Seg { var p1: SIMD2<Double>; var p2: SIMD2<Double> }

    static func make(from room: CapturedRoom) -> ScanPayload {
        let floorY = room.walls.map { Double($0.transform.columns.3.y - $0.dimensions.y / 2) }.min() ?? 0

        // Kąt najdłuższej ściany — wyrównujemy do osi X.
        let longest = room.walls.max { $0.dimensions.x < $1.dimensions.x }
        let theta = longest.map { yaw($0.transform) } ?? 0
        let (cosT, sinT) = (cos(-theta), sin(-theta))
        func rot(_ p: SIMD2<Double>) -> SIMD2<Double> {
            SIMD2(p.x * cosT - p.y * sinT, p.x * sinT + p.y * cosT)
        }

        func segment(_ s: CapturedRoom.Surface) -> Seg {
            let c = center(s.transform)
            let a = axis(s.transform)
            let half = Double(s.dimensions.x) / 2
            return Seg(p1: rot(c - a * half) * 1000, p2: rot(c + a * half) * 1000)
        }

        var wallSegs = room.walls.map { ($0, segment($0)) }
        let openingSurfaces: [(CapturedRoom.Surface, String)] =
            room.doors.map { ($0, "door") } + room.windows.map { ($0, "window") } + room.openings.map { ($0, "opening") }
        var openingSegs = openingSurfaces.map { ($0.0, $0.1, segment($0.0)) }
        var objectCenters = room.objects.map { rot(center($0.transform)) * 1000 }

        // Obrys podłogi z RoomPlan (największa podłoga): narożniki w układzie lokalnym powierzchni.
        func polyArea(_ p: [SIMD2<Double>]) -> Double {
            guard p.count >= 3 else { return 0 }
            var a = 0.0
            for i in p.indices { let q = p[(i + 1) % p.count]; a += p[i].x * q.y - q.x * p[i].y }
            return abs(a) / 2
        }
        var floorPts: [SIMD2<Double>] = room.floors
            .map { f in
                f.polygonCorners.map { c -> SIMD2<Double> in
                    let w = f.transform * SIMD4<Float>(c.x, c.y, c.z, 1)
                    return rot(SIMD2(Double(w.x), Double(w.z))) * 1000
                }
            }
            .max { polyArea($0) < polyArea($1) } ?? []

        // Przesunięcie do (0,0).
        let allX = wallSegs.flatMap { [$0.1.p1.x, $0.1.p2.x] } + objectCenters.map(\.x)
        let allY = wallSegs.flatMap { [$0.1.p1.y, $0.1.p2.y] } + objectCenters.map(\.y)
        let shift = SIMD2(allX.min() ?? 0, allY.min() ?? 0)
        wallSegs = wallSegs.map { ($0.0, Seg(p1: $0.1.p1 - shift, p2: $0.1.p2 - shift)) }
        openingSegs = openingSegs.map { ($0.0, $0.1, Seg(p1: $0.2.p1 - shift, p2: $0.2.p2 - shift)) }
        objectCenters = objectCenters.map { $0 - shift }
        floorPts = floorPts.map { $0 - shift }

        let walls = wallSegs.map { w, s in
            ScanWall(
                id: w.identifier.uuidString,
                x1: r(s.p1.x), y1: r(s.p1.y), x2: r(s.p2.x), y2: r(s.p2.y),
                lengthMm: r(Double(w.dimensions.x) * 1000),
                heightMm: r(Double(w.dimensions.y) * 1000)
            )
        }

        let openings = openingSegs.map { o, kind, s in
            let bottom = Double(o.transform.columns.3.y - o.dimensions.y / 2) - floorY
            return ScanOpening(
                id: o.identifier.uuidString,
                kind: kind,
                wallId: o.parentIdentifier?.uuidString,
                x1: r(s.p1.x), y1: r(s.p1.y), x2: r(s.p2.x), y2: r(s.p2.y),
                widthMm: r(Double(o.dimensions.x) * 1000),
                heightMm: r(Double(o.dimensions.y) * 1000),
                sillMm: r(max(0, bottom * 1000))
            )
        }

        let objects = zip(room.objects, objectCenters).map { o, c in
            let bottom = Double(o.transform.columns.3.y - o.dimensions.y / 2) - floorY
            return ScanObject(
                id: o.identifier.uuidString,
                category: String(describing: o.category),
                cx: r(c.x), cy: r(c.y),
                widthMm: r(Double(o.dimensions.x) * 1000),
                depthMm: r(Double(o.dimensions.z) * 1000),
                heightMm: r(Double(o.dimensions.y) * 1000),
                elevationMm: r(max(0, bottom * 1000)),
                rotationDeg: r((yaw(o.transform) - theta) * 180 / .pi)
            )
        }

        let chain = PlanGeom.normalize(walls)
        return ScanPayload(
            scannedAt: ISO8601DateFormatter().string(from: Date()),
            walls: chain.walls,
            openings: openings,
            objects: objects,
            roomHeightMm: room.walls.map { Double($0.dimensions.y) * 1000 }.max().map(r),
            closed: chain.closed,
            floor: floorPts.count >= 3 ? floorPts.map { [r($0.x), r($0.y)] } : nil
        )
    }

    // Rzut z góry: x → x, z → y (w SVG oś y rośnie w dół, więc bez lustrzanego odbicia).
    private static func center(_ t: simd_float4x4) -> SIMD2<Double> {
        SIMD2(Double(t.columns.3.x), Double(t.columns.3.z))
    }

    private static func axis(_ t: simd_float4x4) -> SIMD2<Double> {
        let v = SIMD2(Double(t.columns.0.x), Double(t.columns.0.z))
        let len = (v.x * v.x + v.y * v.y).squareRoot()
        return len > 0 ? v / len : SIMD2(1, 0)
    }

    private static func yaw(_ t: simd_float4x4) -> Double {
        let a = axis(t)
        return atan2(a.y, a.x)
    }

    private static func r(_ v: Double) -> Double { v.rounded() }
}
