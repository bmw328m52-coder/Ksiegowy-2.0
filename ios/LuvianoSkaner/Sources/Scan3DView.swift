import SwiftUI
import SceneKit
import UIKit

/// Widok 3D skanu (obracanie/przybliżanie palcami). Budowany z tego samego
/// rzutu w mm co PlanPreview — ta sama geometria co RoomScan3D.tsx w meble-app.
struct Scan3DView: View {
    @State private var scene: SCNScene
    @State private var camera: SCNNode

    init(scan: ScanPayload) {
        let built = Scan3D.build(scan)
        _scene = State(initialValue: built.scene)
        _camera = State(initialValue: built.camera)
    }

    var body: some View {
        SceneView(
            scene: scene,
            pointOfView: camera,
            options: [.allowsCameraControl, .autoenablesDefaultLighting]
        )
    }
}

enum Scan3D {
    /// Odcinek ściany do narysowania: wzdłuż ściany t0…t1, w pionie z0…z1 (mm).
    struct Piece { let t0, t1, z0, z1: Double }
    /// Otwór na ścianie (mm wzdłuż ściany i od podłogi).
    struct Span { let t0, t1, bottom, top: Double; let kind: String }

    private static let wallThickness = 0.08 // m

    static func build(_ scan: ScanPayload) -> (scene: SCNScene, camera: SCNNode) {
        let scene = SCNScene()
        scene.background.contents = UIColor(Brand.ivory)
        let root = scene.rootNode

        let wallMat = material(UIColor(white: 0.95, alpha: 1))
        let glassMat = material(UIColor(red: 0.45, green: 0.65, blue: 0.95, alpha: 0.35))
        let doorMat = material(UIColor(Brand.gold).withAlphaComponent(0.25))

        for wall in scan.walls {
            let dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1
            let len = (dx * dx + dy * dy).squareRoot()
            guard len > 1 else { continue }
            let (ux, uy) = (dx / len, dy / len)
            let angle = Float(-atan2(uy, ux))
            let spans = openingSpans(wall: wall, ux: ux, uy: uy, len: len, openings: scan.openings)

            func place(_ t0: Double, _ t1: Double, _ z0: Double, _ z1: Double, depth: Double, mat: SCNMaterial) {
                guard t1 - t0 > 1, z1 - z0 > 1 else { return }
                let box = SCNBox(width: CGFloat((t1 - t0) / 1000), height: CGFloat((z1 - z0) / 1000),
                                 length: CGFloat(depth), chamferRadius: 0)
                box.materials = [mat]
                let node = SCNNode(geometry: box)
                let tm = (t0 + t1) / 2
                node.position = SCNVector3(Float((wall.x1 + ux * tm) / 1000),
                                           Float((z0 + z1) / 2000),
                                           Float((wall.y1 + uy * tm) / 1000))
                node.eulerAngles.y = angle
                root.addChildNode(node)
            }

            for p in pieces(len: len, height: wall.heightMm, spans: spans) {
                place(p.t0, p.t1, p.z0, p.z1, depth: wallThickness, mat: wallMat)
            }
            for s in spans where s.kind == "window" {
                place(s.t0, s.t1, s.bottom, s.top, depth: 0.02, mat: glassMat)
            }
            for s in spans where s.kind == "door" {
                place(s.t0, s.t1, s.bottom, s.top, depth: 0.01, mat: doorMat)
            }
        }

        // Podłoga = otoczka wypukła narożników ścian.
        let corners = scan.walls.flatMap { [SIMD2($0.x1, $0.y1), SIMD2($0.x2, $0.y2)] }
        let hull = convexHull(corners)
        if hull.count >= 3 {
            let path = UIBezierPath()
            path.move(to: CGPoint(x: hull[0].x / 1000, y: -hull[0].y / 1000))
            for p in hull.dropFirst() { path.addLine(to: CGPoint(x: p.x / 1000, y: -p.y / 1000)) }
            path.close()
            let shape = SCNShape(path: path, extrusionDepth: 0.02)
            shape.materials = [material(UIColor(red: 0.86, green: 0.82, blue: 0.76, alpha: 1))]
            let floor = SCNNode(geometry: shape)
            floor.eulerAngles.x = -.pi / 2
            floor.position.y = -0.01
            root.addChildNode(floor)
        }

        for o in scan.objects {
            let box = SCNBox(width: CGFloat(o.widthMm / 1000), height: CGFloat(o.heightMm / 1000),
                             length: CGFloat(o.depthMm / 1000), chamferRadius: 0.005)
            box.materials = [material(objectColor(o.category))]
            let node = SCNNode(geometry: box)
            node.position = SCNVector3(Float(o.cx / 1000), Float((o.elevationMm + o.heightMm / 2) / 1000), Float(o.cy / 1000))
            node.eulerAngles.y = Float(-o.rotationDeg * .pi / 180)
            root.addChildNode(node)
        }

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light!.type = .ambient
        ambient.light!.intensity = 450
        root.addChildNode(ambient)

        // Kamera z narożnika, nad pomieszczeniem.
        let xs = corners.map(\.x), ys = corners.map(\.y)
        let cx = ((xs.min() ?? 0) + (xs.max() ?? 0)) / 2000
        let cz = ((ys.min() ?? 0) + (ys.max() ?? 0)) / 2000
        let span = max(((xs.max() ?? 0) - (xs.min() ?? 0)), ((ys.max() ?? 0) - (ys.min() ?? 0)), 2000) / 1000
        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 50
        camera.camera!.zNear = 0.05
        camera.position = SCNVector3(Float(cx - span * 0.75), Float(span * 1.1), Float(cz + span * 1.0))
        camera.look(at: SCNVector3(Float(cx), 0.6, Float(cz)))
        root.addChildNode(camera)

        return (scene, camera)
    }

    /// Otwory leżące na danej ścianie, rzutowane na jej oś.
    static func openingSpans(wall: ScanWall, ux: Double, uy: Double, len: Double, openings: [ScanOpening]) -> [Span] {
        openings.compactMap { (o: ScanOpening) -> Span? in
            func proj(_ x: Double, _ y: Double) -> Double { (x - wall.x1) * ux + (y - wall.y1) * uy }
            if let wid = o.wallId {
                guard wid == wall.id else { return nil }
            } else {
                // Bez rodzica — bierzemy, jeśli środek otworu leży na tej ścianie.
                let mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2
                let dist = abs((mx - wall.x1) * -uy + (my - wall.y1) * ux)
                let t = proj(mx, my)
                guard dist < 200, t > 0, t < len else { return nil }
            }
            let a = proj(o.x1, o.y1), b = proj(o.x2, o.y2)
            let t0 = max(0, min(a, b)), t1 = min(len, max(a, b))
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

    private static func convexHull(_ pts: [SIMD2<Double>]) -> [SIMD2<Double>] {
        let p = pts.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
        guard p.count >= 3 else { return p }
        func cross(_ o: SIMD2<Double>, _ a: SIMD2<Double>, _ b: SIMD2<Double>) -> Double {
            (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
        }
        var lower: [SIMD2<Double>] = [], upper: [SIMD2<Double>] = []
        for q in p {
            while lower.count >= 2 && cross(lower[lower.count - 2], lower[lower.count - 1], q) <= 0 { lower.removeLast() }
            lower.append(q)
        }
        for q in p.reversed() {
            while upper.count >= 2 && cross(upper[upper.count - 2], upper[upper.count - 1], q) <= 0 { upper.removeLast() }
            upper.append(q)
        }
        return Array(lower.dropLast() + upper.dropLast())
    }

    private static func objectColor(_ category: String) -> UIColor {
        switch category {
        case "refrigerator", "stove", "oven", "dishwasher", "washerDryer":
            return UIColor(red: 0.42, green: 0.42, blue: 0.44, alpha: 1)
        case "sink":
            return UIColor(red: 0.78, green: 0.80, blue: 0.82, alpha: 1)
        case "storage":
            return UIColor(red: 0.80, green: 0.66, blue: 0.50, alpha: 1)
        default:
            return UIColor(red: 0.90, green: 0.86, blue: 0.80, alpha: 1)
        }
    }

    private static func material(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = color
        m.lightingModel = .physicallyBased
        m.roughness.contents = 0.85
        if color.cgColor.alpha < 1 { m.transparency = color.cgColor.alpha; m.diffuse.contents = color.withAlphaComponent(1) }
        return m
    }
}
