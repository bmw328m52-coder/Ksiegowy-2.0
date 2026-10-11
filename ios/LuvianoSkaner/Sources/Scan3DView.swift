import SwiftUI
import SceneKit
import UIKit

/// Widok 3D skanu w stylu „domku dla lalek" (obracanie/przybliżanie palcami).
/// Geometria z PlanModel — te same ściany, grubość i otwory co na rzucie 2D.
struct Scan3DView: View {
    @State private var scene: SCNScene
    @State private var camera: SCNNode

    init(scan: ScanPayload) {
        let built = Scan3D.build(scan)
        _scene = State(initialValue: built.scene)
        _camera = State(initialValue: built.camera)
    }

    var body: some View {
        SceneView(scene: scene, pointOfView: camera, options: [.allowsCameraControl, .autoenablesDefaultLighting])
    }
}

enum Scan3D {
    static func build(_ scan: ScanPayload) -> (scene: SCNScene, camera: SCNNode) {
        let m = PlanModel(scan)
        let T = PlanGeom.wallT
        let scene = SCNScene()
        scene.background.contents = UIColor(white: 0.82, alpha: 1)
        let root = scene.rootNode

        let crown = material(UIColor(white: 0.26, alpha: 1))
        let plaster = material(UIColor(white: 0.93, alpha: 1))
        let frameMat = material(UIColor(white: 0.98, alpha: 1))
        let glass = material(UIColor(red: 0.72, green: 0.82, blue: 0.9, alpha: 1))
        glass.transparency = 0.45

        /// Bryła o podstawie `pts` (mm, rzut) od z0 do z1 (mm). Góra = materiał `top`.
        func prism(_ pts: [V2], _ z0: Double, _ z1: Double, top: SCNMaterial, side: SCNMaterial) {
            guard z1 - z0 > 1, pts.count >= 3 else { return }
            let path = UIBezierPath()
            path.move(to: CGPoint(x: pts[0].x / 1000, y: -pts[0].y / 1000))
            for p in pts.dropFirst() { path.addLine(to: CGPoint(x: p.x / 1000, y: -p.y / 1000)) }
            path.close()
            let shape = SCNShape(path: path, extrusionDepth: CGFloat((z1 - z0) / 1000))
            shape.materials = [top, side, side]
            let node = SCNNode(geometry: shape)
            node.eulerAngles.x = -.pi / 2
            node.position.y = Float((z0 + z1) / 2000)
            root.addChildNode(node)
        }

        for (i, g) in m.walls.enumerated() {
            let (oa, ob) = m.outer(i, T)
            func foot(_ t0: Double, _ t1: Double, _ off0: Double = 0, _ off1: Double = T) -> [V2] {
                let q0 = t0 <= 0.5 && off1 == T ? oa : g.at(t0, off1)
                let q1 = t1 >= g.len - 0.5 && off1 == T ? ob : g.at(t1, off1)
                return [g.at(t0, off0), g.at(t1, off0), q1, q0]
            }
            for p in PlanGeom.pieces(len: g.len, height: g.w.heightMm, spans: g.spans) {
                // Korona (ciemna) tylko na pełnej wysokości ściany.
                prism(foot(p.t0, p.t1), p.z0, p.z1, top: p.z1 >= g.w.heightMm - 1 ? crown : plaster, side: plaster)
            }
            for s in g.spans {
                let f = 50.0 // profil ramy, mm
                switch s.kind {
                case "window":
                    prism(foot(s.t0, s.t1, T * 0.3, T * 0.7), s.bottom, s.bottom + f, top: frameMat, side: frameMat)
                    prism(foot(s.t0, s.t1, T * 0.3, T * 0.7), s.top - f, s.top, top: frameMat, side: frameMat)
                    prism(foot(s.t0, s.t0 + f, T * 0.3, T * 0.7), s.bottom, s.top, top: frameMat, side: frameMat)
                    prism(foot(s.t1 - f, s.t1, T * 0.3, T * 0.7), s.bottom, s.top, top: frameMat, side: frameMat)
                    prism(foot((s.t0 + s.t1) / 2 - f / 3, (s.t0 + s.t1) / 2 + f / 3, T * 0.35, T * 0.65), s.bottom, s.top, top: frameMat, side: frameMat)
                    prism(foot(s.t0 + f, s.t1 - f, T * 0.48, T * 0.52), s.bottom + f, s.top - f, top: glass, side: glass)
                    // Parapet wewnętrzny.
                    prism(foot(s.t0 - 30, s.t1 + 30, -60, T * 0.3), s.bottom - 20, s.bottom, top: frameMat, side: frameMat)
                case "door":
                    prism(foot(s.t0, s.t1, -10, T + 10), s.top - f, s.top, top: frameMat, side: frameMat)
                    prism(foot(s.t0, s.t0 + f, -10, T + 10), 0, s.top, top: frameMat, side: frameMat)
                    prism(foot(s.t1 - f, s.t1, -10, T + 10), 0, s.top, top: frameMat, side: frameMat)
                default:
                    break
                }
            }
        }

        // Podłoga — panele.
        if m.floor.count >= 3 {
            let xs = m.floor.map(\.x), ys = m.floor.map(\.y)
            let w = (xs.max()! - xs.min()!) / 1000, d = (ys.max()! - ys.min()!) / 1000
            let wood = material(UIColor.white)
            wood.diffuse.contents = woodTexture()
            wood.diffuse.wrapS = .repeat
            wood.diffuse.wrapT = .repeat
            wood.diffuse.contentsTransform = SCNMatrix4MakeScale(Float(max(w, 0.5) / 1.6), Float(max(d, 0.5) / 1.6), 1)
            prism(m.floor, -20, 0, top: wood, side: material(UIColor(white: 0.6, alpha: 1)))
        }

        for o in scan.objects {
            let box = SCNBox(width: CGFloat(o.widthMm / 1000), height: CGFloat(o.heightMm / 1000),
                             length: CGFloat(o.depthMm / 1000), chamferRadius: 0.004)
            box.materials = [material(objectColor(o.category))]
            let node = SCNNode(geometry: box)
            node.position = SCNVector3(Float(o.cx / 1000), Float((o.elevationMm + o.heightMm / 2) / 1000), Float(o.cy / 1000))
            node.eulerAngles.y = Float(-o.rotationDeg * .pi / 180)
            root.addChildNode(node)
        }

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light!.type = .ambient
        ambient.light!.intensity = 550
        root.addChildNode(ambient)

        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light!.type = .directional
        sun.light!.intensity = 700
        sun.light!.castsShadow = true
        sun.light!.shadowRadius = 6
        sun.light!.shadowSampleCount = 8
        sun.light!.shadowColor = UIColor(white: 0, alpha: 0.25)
        sun.eulerAngles = SCNVector3(-1.1, 0.5, 0)
        root.addChildNode(sun)

        // Kamera z góry, lekko z ukosa — jak domek dla lalek.
        let c = m.center
        let pts = m.floor.isEmpty ? m.walls.flatMap { [$0.w.a, $0.w.b] } : m.floor
        let xs = pts.map(\.x), ys = pts.map(\.y)
        let span = max((xs.max() ?? 0) - (xs.min() ?? 0), (ys.max() ?? 0) - (ys.min() ?? 0), 2500) / 1000
        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera!.fieldOfView = 45
        camera.camera!.zNear = 0.05
        camera.position = SCNVector3(Float(c.x / 1000), Float(span * 1.9), Float(c.y / 1000 + span * 0.75))
        camera.look(at: SCNVector3(Float(c.x / 1000), 0, Float(c.y / 1000)))
        root.addChildNode(camera)

        return (scene, camera)
    }

    /// Proceduralne panele (bez plików graficznych).
    private static func woodTexture() -> UIImage {
        let size = CGSize(width: 512, height: 512)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let g = ctx.cgContext
            var rng = SystemRandomNumberGenerator()
            let rows = 8
            let rh = size.height / CGFloat(rows)
            for r in 0..<rows {
                var x: CGFloat = r % 2 == 0 ? 0 : -CGFloat(Int.random(in: 80...240, using: &rng))
                while x < size.width {
                    let len = CGFloat(Int.random(in: 220...380, using: &rng))
                    let tone = CGFloat(Double.random(in: 0.52...0.6, using: &rng))
                    g.setFillColor(UIColor(red: tone + 0.16, green: tone + 0.09, blue: tone - 0.02, alpha: 1).cgColor)
                    g.fill(CGRect(x: x, y: CGFloat(r) * rh, width: len, height: rh))
                    g.setStrokeColor(UIColor(white: 0, alpha: 0.05).cgColor)
                    g.setLineWidth(1)
                    for k in 0..<5 {
                        let y = CGFloat(r) * rh + rh * CGFloat(k + 1) / 6 + CGFloat(Int.random(in: -3...3, using: &rng))
                        g.move(to: CGPoint(x: x, y: y))
                        g.addLine(to: CGPoint(x: x + len, y: y + CGFloat(Int.random(in: -2...2, using: &rng))))
                    }
                    g.strokePath()
                    g.setStrokeColor(UIColor(white: 0, alpha: 0.22).cgColor)
                    g.stroke(CGRect(x: x, y: CGFloat(r) * rh, width: len, height: rh))
                    x += len
                }
            }
        }
    }

    private static func objectColor(_ category: String) -> UIColor {
        switch category {
        case "refrigerator", "stove", "oven", "dishwasher", "washerDryer":
            return UIColor(red: 0.42, green: 0.42, blue: 0.44, alpha: 1)
        case "sink":
            return UIColor(red: 0.78, green: 0.80, blue: 0.82, alpha: 1)
        case "storage":
            return UIColor(red: 0.94, green: 0.93, blue: 0.91, alpha: 1)
        default:
            return UIColor(red: 0.86, green: 0.80, blue: 0.72, alpha: 1)
        }
    }

    private static func material(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = color
        m.lightingModel = .physicallyBased
        m.roughness.contents = 0.9
        m.isDoubleSided = true
        return m
    }
}
