import SwiftUI
import SceneKit
import simd
import UIKit

/// Ściany w 3D: „Auto" chowa ściany od strony kamery (domek dla lalek), „Pełne" — wszystkie,
/// „Niskie" — wszystkie ścięte przy podłodze (widać cały układ mebli).
enum Walls3D: String, CaseIterable {
    case auto = "Auto"
    case full = "Pełne"
    case low = "Niskie"
}

/// Prośba o ustawienie kamery (licznik — każde stuknięcie to nowa prośba).
struct CamRequest: Equatable {
    var id = 0
    var top = false
}

/// Widok 3D skanu w stylu „domku dla lalek" (obracanie/przybliżanie palcami).
/// Geometria z PlanModel — te same ściany, grubość i otwory co na rzucie 2D.
struct Scan3DView: View {
    let scan: ScanPayload
    @AppStorage("3d.walls") private var wallsRaw = Walls3D.auto.rawValue
    @AppStorage("3d.objects") private var showObjects = true
    @State private var cam = CamRequest()

    var body: some View {
        Scan3DSceneView(scan: scan, walls: Walls3D(rawValue: wallsRaw) ?? .auto, showObjects: showObjects, cam: cam)
            .overlay(alignment: .topTrailing) { controls }
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Picker("Ściany", selection: $wallsRaw) {
                ForEach(Walls3D.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .frame(width: 210)
            Button { showObjects.toggle() } label: {
                Label("Meble", systemImage: showObjects ? "cabinet.fill" : "cabinet")
            }
            .tint(showObjects ? Brand.ink : .secondary)
            Button { cam = CamRequest(id: cam.id + 1, top: false) } label: {
                Label("Widok", systemImage: "cube")
            }
            Button { cam = CamRequest(id: cam.id + 1, top: true) } label: {
                Label("Z góry", systemImage: "square.dashed")
            }
        }
        .buttonStyle(.bordered)
        .tint(Brand.ink)
        .padding(16)
    }
}

struct Scan3DSceneView: UIViewRepresentable {
    let scan: ScanPayload
    let walls: Walls3D
    let showObjects: Bool
    let cam: CamRequest

    func makeCoordinator() -> Scan3DCoordinator { Scan3DCoordinator(Scan3D.build(scan)) }

    func makeUIView(context: Context) -> SCNView {
        let c = context.coordinator
        let v = SCNView(frame: .zero)
        v.scene = c.built.scene
        v.pointOfView = c.built.camera
        v.antialiasingMode = .multisampling4X
        v.autoenablesDefaultLighting = false
        v.allowsCameraControl = true
        v.backgroundColor = Scan3D.bgColor
        let ctl = v.defaultCameraController
        ctl.interactionMode = .orbitTurntable
        ctl.automaticTarget = false
        ctl.target = c.built.target
        ctl.inertiaEnabled = true
        v.delegate = c
        c.view = v
        c.lastCam = cam
        c.apply(walls: walls, objects: showObjects)
        return v
    }

    func updateUIView(_ v: SCNView, context: Context) {
        let c = context.coordinator
        c.apply(walls: walls, objects: showObjects)
        if cam != c.lastCam {
            c.lastCam = cam
            c.moveCamera(top: cam.top)
        }
    }
}

/// Steruje kamerą, światłem i chowaniem ścian. Wszystkie zmiany sceny na wątku głównym.
final class Scan3DCoordinator: NSObject, SCNSceneRendererDelegate {
    let built: Scan3D.Built
    weak var view: SCNView?
    var lastCam = CamRequest()
    private var mode = Walls3D.auto
    private var cut: [Bool]
    private var topView = false
    /// Ostatnia pozycja kamery widziana przez wątek renderu.
    private var renderPos = SCNVector3(0, -999, 0)

    init(_ b: Scan3D.Built) {
        built = b
        cut = Array(repeating: false, count: b.walls.count)
    }

    func apply(walls: Walls3D, objects: Bool) {
        mode = walls
        built.objects.isHidden = !objects
        switch walls {
        case .auto:
            if let p = view?.pointOfView?.presentation.worldPosition { follow(p) }
        case .full, .low:
            for i in built.walls.indices { setCut(i, walls == .low) }
        }
    }

    func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
        guard let p = renderer.pointOfView?.presentation.worldPosition else { return }
        let d = (p.x - renderPos.x) * (p.x - renderPos.x) + (p.y - renderPos.y) * (p.y - renderPos.y)
            + (p.z - renderPos.z) * (p.z - renderPos.z)
        guard d > 0.0004 else { return }
        renderPos = p
        DispatchQueue.main.async { [weak self] in self?.follow(p) }
    }

    /// Światło „zza ramienia" oglądającego + chowanie ścian zasłaniających widok.
    private func follow(_ p: SCNVector3) {
        let t = built.target
        let dx = Double(p.x - t.x), dz = Double(p.z - t.z), dy = Double(p.y - t.y)
        let az = atan2(dx, dz) + 0.6
        let r = built.radius * 2
        built.sun.position = SCNVector3(Float(Double(t.x) + sin(az) * r), Float(r * 1.3), Float(Double(t.z) + cos(az) * r))
        built.sun.look(at: SCNVector3(t.x, 0, t.z))

        guard mode == .auto else { return }
        let elev = atan2(dy, hypot(dx, dz)) * 180 / .pi
        if elev > 74 { topView = true } else if elev < 66 { topView = false }
        for (i, w) in built.walls.enumerated() {
            let side = (Double(p.x) - w.mid.x) * w.out.x + (Double(p.z) - w.mid.y) * w.out.y
            var c = cut[i]
            if topView { c = false } else if side > 0.15 { c = true } else if side < -0.15 { c = false }
            setCut(i, c)
        }
    }

    private func setCut(_ i: Int, _ on: Bool) {
        guard cut[i] != on else { return }
        cut[i] = on
        let n = built.walls[i].full
        n.removeAllActions()
        if on {
            n.runAction(.sequence([.fadeOut(duration: 0.25), .hide()]))
        } else {
            n.isHidden = false
            n.runAction(.fadeIn(duration: 0.25))
        }
    }

    func moveCamera(top: Bool) {
        guard let v = view, let pov = v.pointOfView else { return }
        v.defaultCameraController.stopInertia()
        let pose = top ? built.topPose : built.homePose
        let tmp = SCNNode()
        tmp.position = pose.pos
        tmp.look(at: pose.target, up: top ? SCNVector3(0, 0, -1) : SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.6
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        pov.transform = tmp.transform
        SCNTransaction.commit()
        v.defaultCameraController.target = pose.target
    }
}

enum Scan3D {
    struct WallRig {
        /// Ściana pełnej wysokości (z oknami i drzwiami) — chowana przy przycinaniu.
        let full: SCNNode
        /// Środek ściany i normalna na zewnątrz, w metrach w układzie sceny (x, z).
        let mid: V2
        let out: V2
    }

    struct Pose {
        let pos: SCNVector3
        let target: SCNVector3
    }

    struct Built {
        let scene: SCNScene
        let camera: SCNNode
        let sun: SCNNode
        let objects: SCNNode
        let walls: [WallRig]
        let target: SCNVector3
        let radius: Double
        let homePose: Pose
        let topPose: Pose
    }

    static let bgColor = UIColor(red: 0.95, green: 0.948, blue: 0.94, alpha: 1)
    /// Wysokość ściany ściętej („domek dla lalek").
    static let stubH = 200.0

    // MARK: - Materiały

    private static func rgb(_ r: Double, _ g: Double, _ b: Double) -> UIColor {
        UIColor(red: r, green: g, blue: b, alpha: 1)
    }

    private static func material(_ color: UIColor, rough: Double = 0.9, metal: Double = 0) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = color
        m.lightingModel = .physicallyBased
        m.roughness.contents = rough
        m.metalness.contents = metal
        m.isDoubleSided = true
        return m
    }

    private struct Palette {
        let plaster = Scan3D.material(Scan3D.rgb(0.95, 0.945, 0.93))
        let planned: SCNMaterial = {
            let m = Scan3D.material(Scan3D.rgb(0.78, 0.86, 0.96))
            m.transparency = 0.5
            return m
        }()
        let crown = Scan3D.material(Scan3D.rgb(0.157, 0.149, 0.141), rough: 0.7)
        let base = Scan3D.material(Scan3D.rgb(0.22, 0.21, 0.2), rough: 0.8)
        let skirting = Scan3D.material(Scan3D.rgb(0.97, 0.97, 0.96), rough: 0.5)
        let frame = Scan3D.material(Scan3D.rgb(0.97, 0.97, 0.97), rough: 0.35)
        let glass: SCNMaterial = {
            let m = Scan3D.material(Scan3D.rgb(0.72, 0.84, 0.93), rough: 0.05)
            m.transparency = 0.35
            return m
        }()
        let door = Scan3D.material(Scan3D.rgb(0.55, 0.40, 0.27), rough: 0.6)
        let carcass = Scan3D.material(Scan3D.rgb(0.80, 0.78, 0.75), rough: 0.8)
        let front = Scan3D.material(Scan3D.rgb(0.94, 0.925, 0.90), rough: 0.55)
        let worktop = Scan3D.material(Scan3D.rgb(0.66, 0.51, 0.36), rough: 0.5)
        let plinth = Scan3D.material(Scan3D.rgb(0.25, 0.24, 0.23), rough: 0.8)
        let steel = Scan3D.material(Scan3D.rgb(0.78, 0.78, 0.79), rough: 0.3, metal: 0.9)
        let inox = Scan3D.material(Scan3D.rgb(0.82, 0.82, 0.83), rough: 0.35, metal: 0.6)
        let blackGlass = Scan3D.material(Scan3D.rgb(0.05, 0.05, 0.06), rough: 0.12)
        let ring = Scan3D.material(Scan3D.rgb(0.25, 0.25, 0.27), rough: 0.4)
        let white = Scan3D.material(Scan3D.rgb(0.96, 0.96, 0.96), rough: 0.4)
        let fabric = Scan3D.material(Scan3D.rgb(0.55, 0.56, 0.58), rough: 1)
        let cushion = Scan3D.material(Scan3D.rgb(0.93, 0.92, 0.9), rough: 1)
        let dark = Scan3D.material(Scan3D.rgb(0.08, 0.08, 0.09), rough: 0.3)
        let other = Scan3D.material(Scan3D.rgb(0.86, 0.80, 0.72), rough: 0.8)
    }

    // MARK: - Budowa sceny

    static func build(_ scan: ScanPayload) -> Built {
        let m = PlanModel(scan)
        let T = PlanGeom.wallT
        let P = Palette()
        let scene = SCNScene()
        let env = environmentImage()
        scene.background.contents = env
        scene.lightingEnvironment.contents = env
        scene.lightingEnvironment.intensity = 0.55
        let root = scene.rootNode

        /// Bryła o podstawie `pts` (mm, rzut) od z0 do z1 (mm). Góra = materiał `top`.
        @discardableResult
        func prism(_ parent: SCNNode, _ pts: [V2], _ z0: Double, _ z1: Double, top: SCNMaterial, side: SCNMaterial) -> SCNNode? {
            guard z1 - z0 > 0.5, pts.count >= 3 else { return nil }
            let path = UIBezierPath()
            path.move(to: CGPoint(x: pts[0].x / 1000, y: -pts[0].y / 1000))
            for p in pts.dropFirst() { path.addLine(to: CGPoint(x: p.x / 1000, y: -p.y / 1000)) }
            path.close()
            let shape = SCNShape(path: path, extrusionDepth: CGFloat((z1 - z0) / 1000))
            shape.materials = [top, side, side]
            let node = SCNNode(geometry: shape)
            node.eulerAngles.x = -.pi / 2
            node.position.y = Float((z0 + z1) / 2000)
            parent.addChildNode(node)
            return node
        }

        /// Podstawa fragmentu ściany i (wzdłuż t0…t1, w grubości off0…off1, mm). Narożniki z ucięciem pod kątem.
        func foot(_ i: Int, _ t0: Double, _ t1: Double, _ off0: Double = 0, _ off1: Double = T) -> [V2] {
            let g = m.walls[i]
            let (oa, ob) = m.outer(i, off1)
            let q0 = t0 <= 0.5 ? oa : g.at(t0, off1)
            let q1 = t1 >= g.len - 0.5 ? ob : g.at(t1, off1)
            return [g.at(t0, off0), g.at(t1, off0), q1, q0]
        }

        // Cokół modelu — ciemna podstawa pod podłogą i ścianami.
        let baseZ = -150.0
        prism(root, m.floor, baseZ, -20, top: P.base, side: P.base)

        var rigs: [WallRig] = []
        for (i, g) in m.walls.enumerated() {
            let wallNode = SCNNode()
            root.addChildNode(wallNode)
            let full = SCNNode()
            wallNode.addChildNode(full)
            let planned = g.w.planned == true
            let skin = planned ? P.planned : P.plaster

            prism(wallNode, foot(i, 0, g.len), baseZ, 0, top: P.base, side: P.base)
            // Pod skosem ściana jest niższa: kawałki dzielimy na pasy i przycinamy do linii sufitu.
            let prof = m.ceilingProfile(i)
            var pieces = PlanGeom.pieces(len: g.len, height: g.w.heightMm, spans: g.spans)
            if !prof.isEmpty {
                let step = g.len / Double(prof.count - 1)
                pieces = pieces.flatMap { p -> [PlanGeom.Piece] in
                    let n = max(1, Int(((p.t1 - p.t0) / step).rounded(.up)))
                    return (0..<n).compactMap { k in
                        let a = p.t0 + (p.t1 - p.t0) * Double(k) / Double(n)
                        let b = p.t0 + (p.t1 - p.t0) * Double(k + 1) / Double(n)
                        let top = prof.filter { $0.t >= a - step && $0.t <= b + step }.map(\.z).max() ?? p.z1
                        let z1 = min(p.z1, top)
                        return z1 - p.z0 > 1 ? PlanGeom.Piece(t0: a, t1: b, z0: p.z0, z1: z1) : nil
                    }
                }
            }
            for p in pieces {
                // Korona (ciemna) tylko na pełnej wysokości ściany — jak przekrój w makiecie.
                let n = prism(full, foot(i, p.t0, p.t1), p.z0, p.z1, top: p.z1 >= g.w.heightMm - 1 ? P.crown : skin, side: skin)
                if planned { n?.castsShadow = false }
                // Ściana ścięta: zostaje zawsze, odrobinę grubsza, by nie migotała z pełną.
                if p.z0 < stubH {
                    prism(wallNode, foot(i, p.t0, p.t1, -1, T + 1), p.z0, min(p.z1, stubH), top: P.crown, side: skin)
                }
                // Listwa przypodłogowa po stronie pomieszczenia.
                if p.z0 < 1, !planned {
                    prism(wallNode, foot(i, p.t0, p.t1, -14, 0), 0, 70, top: P.skirting, side: P.skirting)
                }
            }

            for s in g.spans {
                let f = 50.0 // profil ramy, mm
                switch s.kind {
                case "window":
                    let (a, b) = (T * 0.3, T * 0.7)
                    prism(full, foot(i, s.t0, s.t1, a, b), s.bottom, s.bottom + f, top: P.frame, side: P.frame)
                    prism(full, foot(i, s.t0, s.t1, a, b), s.top - f, s.top, top: P.frame, side: P.frame)
                    prism(full, foot(i, s.t0, s.t0 + f, a, b), s.bottom, s.top, top: P.frame, side: P.frame)
                    prism(full, foot(i, s.t1 - f, s.t1, a, b), s.bottom, s.top, top: P.frame, side: P.frame)
                    let mid = (s.t0 + s.t1) / 2
                    prism(full, foot(i, mid - f / 3, mid + f / 3, T * 0.35, T * 0.65), s.bottom, s.top, top: P.frame, side: P.frame)
                    if let pane = prism(full, foot(i, s.t0 + f, s.t1 - f, T * 0.48, T * 0.52), s.bottom + f, s.top - f, top: P.glass, side: P.glass) {
                        pane.castsShadow = false
                    }
                    // Parapet wewnętrzny.
                    let sd = s.sillDepth ?? 60, st = s.sillThickness ?? 20
                    prism(full, foot(i, s.t0 - 30, s.t1 + 30, -sd, a), s.bottom - st, s.bottom, top: P.frame, side: P.frame)
                case "door":
                    prism(full, foot(i, s.t0, s.t1, -10, T + 10), s.top - f, s.top, top: P.frame, side: P.frame)
                    prism(full, foot(i, s.t0, s.t0 + f, -10, T + 10), 0, s.top, top: P.frame, side: P.frame)
                    prism(full, foot(i, s.t1 - f, s.t1, -10, T + 10), 0, s.top, top: P.frame, side: P.frame)
                    // Skrzydło uchylone do wnętrza, zawias przy początku otworu (jak łuk na rzucie).
                    let leafW = s.t1 - s.t0 - 2 * f
                    if leafW > 200 {
                        let ang = 70.0 * .pi / 180
                        let hinge = g.at(s.t0 + f, -5)
                        let d = g.dir * cos(ang) + g.inN * sin(ang)
                        let n = V2(-d.y, d.x)
                        let th = 40.0
                        prism(full, [hinge, hinge + d * leafW, hinge + d * leafW + n * th, hinge + n * th],
                              5, s.top - f - 3, top: P.door, side: P.door)
                    }
                default:
                    break
                }
            }

            // Elementy na ścianie: odstające jako bryły, w licu — cienka płytka.
            for f in scan.features where f.wallId == g.w.id {
                let t0 = max(f.offsetMm, 0), t1 = min(f.offsetMm + f.widthMm, g.len)
                guard t1 - t0 > 1 else { continue }
                let col = UIColor(FeatureKind(key: f.kind).color)
                let mat = material(col.withAlphaComponent(1), rough: 0.6)
                prism(full, foot(i, t0, t1, -max(f.depthMm, 3), 0), f.elevationMm, f.elevationMm + f.heightMm, top: mat, side: mat)
            }

            // Płaszczyzna skosu: od ściany na wysokości kolanka do linii płaskiego sufitu.
            if let sl = g.w.slope, let d = sl.depth(ceiling: m.roomHeight) {
                let q = [g.at(0, 0), g.at(g.len, 0), g.at(g.len, -d), g.at(0, -d)]
                let z = [sl.kneeMm, sl.kneeMm, m.roomHeight, m.roomHeight]
                let verts = zip(q, z).map { SCNVector3(Float($0.x / 1000), Float($1 / 1000), Float($0.y / 1000)) }
                let e1 = simd_float3(verts[1].x - verts[0].x, verts[1].y - verts[0].y, verts[1].z - verts[0].z)
                let e2 = simd_float3(verts[3].x - verts[0].x, verts[3].y - verts[0].y, verts[3].z - verts[0].z)
                var nv = simd_normalize(simd_cross(e1, e2))
                if nv.y > 0 { nv = -nv } // do wnętrza (w dół)
                let normals = Array(repeating: SCNVector3(nv.x, nv.y, nv.z), count: 4)
                let geo = SCNGeometry(sources: [SCNGeometrySource(vertices: verts), SCNGeometrySource(normals: normals)],
                                      elements: [SCNGeometryElement(indices: [Int32(0), 1, 2, 0, 2, 3], primitiveType: .triangles)])
                let mat = material(rgb(0.93, 0.90, 0.86), rough: 0.9)
                mat.isDoubleSided = true
                mat.transparency = 0.55
                geo.materials = [mat]
                let node = SCNNode(geometry: geo)
                node.castsShadow = false
                full.addChildNode(node)
            }

            let c = g.at(g.len / 2, T / 2)
            rigs.append(WallRig(full: full, mid: V2(c.x / 1000, c.y / 1000), out: g.out))
        }

        // Podłoga — panele.
        if m.floor.count >= 3 {
            let xs = m.floor.map(\.x), ys = m.floor.map(\.y)
            let w = (xs.max()! - xs.min()!) / 1000, d = (ys.max()! - ys.min()!) / 1000
            let wood = material(.white, rough: 0.55)
            wood.diffuse.contents = woodTexture()
            wood.diffuse.wrapS = .repeat
            wood.diffuse.wrapT = .repeat
            wood.diffuse.mipFilter = .linear
            wood.diffuse.contentsTransform = SCNMatrix4MakeScale(Float(max(w, 0.5) / 2.4), Float(max(d, 0.5) / 2.4), 1)
            prism(root, m.floor, -20, 0, top: wood, side: P.base)
        }

        // Meble i AGD.
        let objects = SCNNode()
        root.addChildNode(objects)
        for o in scan.objects {
            objects.addChildNode(objectNode(o, walls: m.walls, P))
        }

        // Szafy — korpus z wnętrzem (bez drzwi, żeby było widać układ).
        let board = material(rgb(0.87, 0.80, 0.70), rough: 0.7)
        let backMat = material(rgb(0.95, 0.93, 0.90), rough: 0.9)
        let metal = material(rgb(0.75, 0.75, 0.76), rough: 0.3, metal: 0.8)
        let frontMat = material(rgb(0.97, 0.96, 0.94), rough: 0.5)
        for w in scan.wardrobes {
            guard let i = m.walls.firstIndex(where: { $0.w.id == w.wallId }) else { continue }
            let g = m.walls[i]
            let B = WardrobeGeom.board
            /// Płyta: wzdłuż t0…t1 (od lewego boku szafy), w głąb d0…d1 (od ściany), w pionie z0…z1.
            func slab(_ t0: Double, _ t1: Double, _ d0: Double, _ d1: Double, _ z0: Double, _ z1: Double, _ mat: SCNMaterial) {
                let a = w.offsetMm + t0, b = w.offsetMm + t1
                prism(objects, [g.at(a, -d0), g.at(b, -d0), g.at(b, -d1), g.at(a, -d1)], z0, z1, top: mat, side: mat)
            }
            let D = w.depthMm, top = w.heightMm - w.topMm
            let (zIn0, zIn1) = WardrobeGeom.innerZ(w)
            if w.hasBack { slab(0, w.widthMm, 0, 8, w.plinthMm, top, backMat) }
            slab(B, w.widthMm - B, 0, D, zIn0 - B, zIn0, board)
            if !w.isFrame {
                slab(0, B, 0, D, 0, top, board)
                slab(w.widthMm - B, w.widthMm, 0, D, 0, top, board)
                slab(B, w.widthMm - B, 0, D, zIn1, zIn1 + B, board)
            }
            if w.plinthMm > 1 { slab(B, w.widthMm - B, D - 60, D - 42, 0, w.plinthMm, board) }
            if w.topMm > 1 { slab(0, w.widthMm, D - 18, D, top, w.heightMm, board) }
            let secTop = WardrobeGeom.sectionTop(w)
            if let pz = WardrobeGeom.pawlaczZ(w) { slab(B, w.widthMm - B, 8, D, pz.0 - B, pz.0, board) }
            for sec in WardrobeGeom.sections(w) {
                if sec.index < w.sections.count - 1 { slab(sec.t1, sec.t1 + B, 8, D, zIn0, secTop, board) }
                for zn in sec.zones {
                    if zn.index > 0 { slab(sec.t0, sec.t1, 8, D - 20, zn.z0 - B, zn.z0, board) }
                    switch zn.kind {
                    case .shelves:
                        for k in 1..<max(zn.count, 1) {
                            let z = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(zn.count) - B / 2
                            slab(sec.t0, sec.t1, 8, D - 20, z, z + B, board)
                        }
                    case .rail, .pantograph:
                        slab(sec.t0, sec.t1, D / 2 - 12, D / 2 + 12, zn.z1 - 72, zn.z1 - 48, metal)
                    case .drawers:
                        let n = max(zn.count, 1)
                        for k in 0..<n {
                            let fz0 = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(n) + 3
                            let fz1 = zn.z0 + (zn.z1 - zn.z0) * Double(k + 1) / Double(n) - 3
                            slab(sec.t0 + 3, sec.t1 - 3, D - 38, D - 20, fz0, fz1, frontMat)
                        }
                    case .shoes:
                        let n = max(zn.count, 1)
                        for k in 0..<n {
                            let z = zn.z0 + (zn.z1 - zn.z0) * Double(k) / Double(n) + 40
                            slab(sec.t0, sec.t1, 60, D - 60, z, z + B, board)
                        }
                    case .empty:
                        break
                    }
                }
            }
        }

        // Punkty instalacji — kolorowe „pinezki" z krążkiem na wewnętrznej powierzchni ściany.
        for mk in scan.markers {
            guard let g = m.walls.first(where: { $0.w.id == mk.wallId }) else { continue }
            let t = min(max(mk.offsetMm, 0), g.len)
            let color = UIColor(MarkerKind(key: mk.kind).color)
            let pin = material(color, rough: 0.4)
            pin.emission.contents = color
            pin.emission.intensity = 0.35
            let p = g.at(t, -30)
            let ball = SCNNode(geometry: SCNSphere(radius: 0.035))
            ball.geometry?.materials = [pin]
            ball.position = SCNVector3(Float(p.x / 1000), Float(mk.heightMm / 1000), Float(p.y / 1000))
            root.addChildNode(ball)

            let plate = material(color, rough: 0.6)
            plate.transparency = 0.45
            let q = g.at(t, -2)
            let disc = SCNNode(geometry: SCNCylinder(radius: 0.065, height: 0.003))
            disc.geometry?.materials = [plate]
            disc.castsShadow = false
            disc.position = SCNVector3(Float(q.x / 1000), Float(mk.heightMm / 1000), Float(q.y / 1000))
            let look = q + g.inN * 1000
            disc.look(at: SCNVector3(Float(look.x / 1000), Float(mk.heightMm / 1000), Float(look.y / 1000)),
                      up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
            root.addChildNode(disc)
        }

        // Wymiary sceny.
        let pts = m.floor.isEmpty ? m.walls.flatMap { [$0.w.a, $0.w.b] } : m.floor
        let xs = pts.map(\.x), ys = pts.map(\.y)
        let span = max((xs.max() ?? 0) - (xs.min() ?? 0), (ys.max() ?? 0) - (ys.min() ?? 0), 2500) / 1000
        let height = (m.walls.map(\.w.heightMm).max() ?? 2500) / 1000
        let radius = max(span * 0.62, height)
        let cx = ((xs.max() ?? 0) + (xs.min() ?? 0)) / 2000, cz = ((ys.max() ?? 0) + (ys.min() ?? 0)) / 2000

        // Cienie na „stole", na którym stoi makieta.
        let ground = SCNFloor()
        ground.reflectivity = 0
        let shadowMat = SCNMaterial()
        shadowMat.lightingModel = .shadowOnly
        ground.materials = [shadowMat]
        let groundNode = SCNNode(geometry: ground)
        groundNode.position.y = Float(baseZ / 1000)
        root.addChildNode(groundNode)

        // Światło: słońce z cieniem (podąża za kamerą) + miękkie wypełnienie + otoczenie z gradientu.
        let sun = SCNNode()
        let sl = SCNLight()
        sl.type = .directional
        sl.intensity = 800
        sl.color = UIColor(red: 1, green: 0.97, blue: 0.92, alpha: 1)
        sl.castsShadow = true
        sl.shadowMapSize = CGSize(width: 4096, height: 4096)
        sl.shadowSampleCount = 16
        sl.shadowRadius = 4
        sl.shadowColor = UIColor(white: 0, alpha: 0.32)
        sl.automaticallyAdjustsShadowProjection = true
        sl.maximumShadowDistance = CGFloat(radius * 6 + 5)
        sun.light = sl
        root.addChildNode(sun)

        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light!.type = .directional
        fill.light!.intensity = 160
        fill.light!.color = UIColor(red: 0.9, green: 0.94, blue: 1, alpha: 1)
        fill.eulerAngles = SCNVector3(-0.5, .pi * 0.8, 0)
        root.addChildNode(fill)

        // Kamera — z ukosa, z góry, cały pokój w kadrze.
        let fov = 40.0
        let target = SCNVector3(Float(cx), Float(min(height * 0.3, 0.9)), Float(cz))
        let dist = radius / sin(fov / 2 * .pi / 180) * 0.95
        let el = 47.0 * .pi / 180, az = 28.0 * .pi / 180
        let home = Pose(pos: SCNVector3(Float(cx + sin(az) * cos(el) * dist), Float(Double(target.y) + sin(el) * dist),
                                        Float(cz + cos(az) * cos(el) * dist)),
                        target: target)
        let top = Pose(pos: SCNVector3(Float(cx), Float(dist * 1.05), Float(cz + 0.02)),
                       target: SCNVector3(Float(cx), 0, Float(cz)))

        let camera = SCNNode()
        let cam = SCNCamera()
        cam.fieldOfView = CGFloat(fov)
        cam.zNear = 0.05
        cam.zFar = 200
        cam.screenSpaceAmbientOcclusionIntensity = 0.9
        cam.screenSpaceAmbientOcclusionRadius = 0.25
        camera.camera = cam
        camera.position = home.pos
        camera.look(at: home.target)
        root.addChildNode(camera)

        let built = Built(scene: scene, camera: camera, sun: sun, objects: objects, walls: rigs,
                          target: target, radius: radius, homePose: home, topPose: top)
        // Początkowe ustawienie słońca (potem podąża za kamerą).
        let a0 = az + 0.6
        sun.position = SCNVector3(Float(cx + sin(a0) * radius * 2), Float(radius * 2.6), Float(cz + cos(a0) * radius * 2))
        sun.look(at: SCNVector3(Float(cx), 0, Float(cz)))
        return built
    }

    // MARK: - Meble

    /// Odległość punktu od odcinka (mm).
    private static func segDist(_ p: V2, _ a: V2, _ b: V2) -> Double {
        let ab = b - a
        let l2 = PlanGeom.dot(ab, ab)
        let t = l2 > 0 ? min(max(PlanGeom.dot(p - a, ab) / l2, 0), 1) : 0
        return PlanGeom.dist(p, a + ab * t)
    }

    /// Mebel w układzie lokalnym: x wzdłuż szerokości, y w górę od spodu, z w głąb — front w +z (od ściany).
    private static func objectNode(_ o: ScanObject, walls: [PlanModel.Wall], _ P: Palette) -> SCNNode {
        let node = SCNNode()
        let r = o.rotationDeg * .pi / 180
        // Front = strona dalsza od najbliższej ściany.
        let c = V2(o.cx, o.cy), n = V2(-sin(r), cos(r))
        func wallDist(_ p: V2) -> Double { walls.map { segDist(p, $0.w.a, $0.w.b) }.min() ?? .infinity }
        let flip = wallDist(c + n * (o.depthMm / 2)) < wallDist(c - n * (o.depthMm / 2))
        node.position = SCNVector3(Float(o.cx / 1000), Float(o.elevationMm / 1000), Float(o.cy / 1000))
        node.eulerAngles.y = Float(-r + (flip ? .pi : 0))

        let W = o.widthMm / 1000, D = o.depthMm / 1000, H = o.heightMm / 1000
        let x0 = -W / 2, x1 = W / 2, zb = -D / 2, zf = D / 2

        func box(_ ax: Double, _ bx: Double, _ ay: Double, _ by: Double, _ az: Double, _ bz: Double,
                 _ mat: SCNMaterial, chamfer: Double = 0.001) {
            guard bx - ax > 0.0005, by - ay > 0.0005, bz - az > 0.0005 else { return }
            let g = SCNBox(width: CGFloat(bx - ax), height: CGFloat(by - ay), length: CGFloat(bz - az),
                           chamferRadius: CGFloat(min(chamfer, (bx - ax) / 2, (by - ay) / 2, (bz - az) / 2)))
            g.materials = [mat]
            let b = SCNNode(geometry: g)
            b.position = SCNVector3(Float((ax + bx) / 2), Float((ay + by) / 2), Float((az + bz) / 2))
            node.addChildNode(b)
        }
        /// Front (drzwi/szuflada) z 2 mm szczeliną, opcjonalny uchwyt.
        enum Handle { case none, top, bottom, side }
        func front(_ ax: Double, _ bx: Double, _ ay: Double, _ by: Double, _ mat: SCNMaterial, handle: Handle) {
            let g = 0.002
            box(ax + g, bx - g, ay + g, by - g, zf - 0.018, zf, mat, chamfer: 0.0015)
            let hw = min(0.16, (bx - ax) * 0.5), mx = (ax + bx) / 2
            switch handle {
            case .none: break
            case .top: box(mx - hw / 2, mx + hw / 2, by - 0.05, by - 0.038, zf, zf + 0.025, P.steel, chamfer: 0.005)
            case .bottom: box(mx - hw / 2, mx + hw / 2, ay + 0.038, ay + 0.05, zf, zf + 0.025, P.steel, chamfer: 0.005)
            case .side:
                let hh = min(0.3, (by - ay) * 0.4), my = (ay + by) / 2
                box(bx - 0.06, bx - 0.048, my - hh / 2, my + hh / 2, zf, zf + 0.025, P.steel, chamfer: 0.005)
            }
        }
        /// Rząd drzwi (1 lub 2 skrzydła).
        func doors(_ ay: Double, _ by: Double, handle: Handle, mat: SCNMaterial? = nil) {
            let m = mat ?? P.front
            if W > 0.65 {
                front(x0, 0, ay, by, m, handle: handle)
                front(0, x1, ay, by, m, handle: handle)
            } else {
                front(x0, x1, ay, by, m, handle: handle)
            }
        }

        let elevated = o.elevationMm >= 300
        let counterLike = !elevated && o.heightMm >= 600 && o.heightMm <= 1100
        let kitchen = ["storage", "sink", "stove", "dishwasher", "oven", "washerDryer"].contains(o.category)

        if kitchen && counterLike {
            // Szafka dolna: cokół, korpus, blat 38 mm z nawisem, fronty.
            let top = 0.038, plinth = 0.1
            box(x0, x1, H - top, H, zb, zf + 0.02, P.worktop, chamfer: 0.002)
            box(x0 + 0.002, x1 - 0.002, 0, plinth, zb, zf - 0.06, P.plinth)
            box(x0, x1, plinth, H - top, zb, zf - 0.018, P.carcass)
            let fy0 = plinth, fy1 = H - top
            switch o.category {
            case "sink":
                doors(fy0, fy1, handle: .top)
                // Komora zlewu + bateria.
                let bw = min(W - 0.12, 0.76), bd = min(D - 0.16, 0.42), bz = zb + (D - bd) / 2 + 0.03
                box(-bw / 2, bw / 2, H, H + 0.002, bz - bd / 2, bz + bd / 2, P.steel)
                box(-bw / 2 + 0.03, bw / 2 - 0.03, H + 0.002, H + 0.003, bz - bd / 2 + 0.03, bz + bd / 2 - 0.03, P.ring)
                let tapZ = bz - bd / 2 - 0.035
                let tap = SCNNode(geometry: SCNCylinder(radius: 0.016, height: 0.3))
                tap.geometry?.materials = [P.steel]
                tap.position = SCNVector3(0, Float(H + 0.15), Float(tapZ))
                node.addChildNode(tap)
                box(-0.012, 0.012, H + 0.27, H + 0.3, tapZ, tapZ + 0.2, P.steel, chamfer: 0.01)
            case "stove":
                // Piekarnik pod płytą + szuflada.
                let ovenTop = fy1 - 0.02, ovenBot = max(fy0 + 0.14, ovenTop - 0.6)
                front(x0, x1, fy0, ovenBot, P.front, handle: .top)
                box(x0 + 0.004, x1 - 0.004, ovenBot + 0.002, ovenTop, zf - 0.02, zf, P.blackGlass, chamfer: 0.002)
                box(-W * 0.35, W * 0.35, ovenTop - 0.05, ovenTop - 0.038, zf, zf + 0.03, P.steel, chamfer: 0.005)
                box(x0, x1, fy1 - 0.02, fy1, zf - 0.02, zf, P.front)
                // Płyta indukcyjna z polami.
                let hw = min(W - 0.02, 0.58), hd = min(D - 0.04, 0.51)
                box(-hw / 2, hw / 2, H, H + 0.006, zb + 0.03, zb + 0.03 + hd, P.blackGlass, chamfer: 0.002)
                let hz = zb + 0.03 + hd / 2
                for (dx, dz, rad) in [(-0.14, -0.1, 0.09), (0.14, -0.1, 0.07), (-0.14, 0.12, 0.07), (0.14, 0.12, 0.1)] {
                    let ring = SCNNode(geometry: SCNTube(innerRadius: CGFloat(rad - 0.004), outerRadius: CGFloat(rad), height: 0.001))
                    ring.geometry?.materials = [P.ring]
                    ring.position = SCNVector3(Float(dx * hw / 0.58), Float(H + 0.0065), Float(hz + dz * hd / 0.51))
                    node.addChildNode(ring)
                }
            case "dishwasher":
                front(x0, x1, fy0, fy1, P.front, handle: .top)
            case "oven":
                front(x0, x1, fy0, fy1 - 0.6, P.front, handle: .top)
                box(x0 + 0.004, x1 - 0.004, fy1 - 0.598, fy1, zf - 0.02, zf, P.blackGlass, chamfer: 0.002)
                box(-W * 0.35, W * 0.35, fy1 - 0.06, fy1 - 0.048, zf, zf + 0.03, P.steel, chamfer: 0.005)
            case "washerDryer":
                box(x0 + 0.002, x1 - 0.002, fy0, fy1, zf - 0.018, zf, P.white, chamfer: 0.004)
                let door = SCNNode(geometry: SCNCylinder(radius: CGFloat(min(W, fy1 - fy0) * 0.3), height: 0.02))
                door.geometry?.materials = [P.blackGlass]
                door.eulerAngles.x = .pi / 2
                door.position = SCNVector3(0, Float((fy0 + fy1) / 2 - 0.03), Float(zf + 0.008))
                node.addChildNode(door)
            default:
                // Szuflada u góry + drzwi pod nią.
                let dh = 0.14
                if fy1 - fy0 > 0.45 {
                    front(x0, x1, fy1 - dh, fy1, P.front, handle: .top)
                    doors(fy0, fy1 - dh, handle: .top)
                } else {
                    doors(fy0, fy1, handle: .top)
                }
            }
        } else if o.category == "storage" && elevated {
            // Szafka wisząca.
            box(x0, x1, 0, H, zb, zf - 0.018, P.carcass)
            doors(0, H, handle: .bottom)
        } else if o.category == "storage" && o.heightMm > 1100 {
            // Słupek / szafa: cokół + dwa fronty jeden nad drugim.
            let plinth = 0.1
            box(x0 + 0.002, x1 - 0.002, 0, plinth, zb, zf - 0.06, P.plinth)
            box(x0, x1, plinth, H, zb, zf - 0.018, P.carcass)
            let split = plinth + (H - plinth) * 0.55
            doors(plinth, split, handle: .side)
            doors(split, H, handle: .side)
        } else {
            switch o.category {
            case "refrigerator":
                box(x0, x1, 0, H, zb, zf - 0.02, P.inox, chamfer: 0.008)
                let split = H * 0.62
                box(x0 + 0.003, x1 - 0.003, 0.01, split - 0.004, zf - 0.02, zf, P.inox, chamfer: 0.006)
                box(x0 + 0.003, x1 - 0.003, split + 0.004, H - 0.003, zf - 0.02, zf, P.inox, chamfer: 0.006)
                box(x1 - 0.07, x1 - 0.055, split - 0.45, split - 0.08, zf, zf + 0.035, P.steel, chamfer: 0.005)
                box(x1 - 0.07, x1 - 0.055, split + 0.08, min(H - 0.08, split + 0.4), zf, zf + 0.035, P.steel, chamfer: 0.005)
            case "sink":
                // Sam zlew (wykryty przez RoomPlan) — komora na wysokości blatu.
                box(x0, x1, H - 0.02, H, zb, zf, P.steel, chamfer: 0.004)
                box(x0 + 0.03, x1 - 0.03, H, H + 0.001, zb + 0.03, zf - 0.03, P.ring)
            case "stove", "oven", "dishwasher", "washerDryer":
                box(x0, x1, 0, H, zb, zf - 0.02, o.category == "washerDryer" ? P.white : P.inox, chamfer: 0.006)
                box(x0 + 0.01, x1 - 0.01, H * 0.2, H * 0.85, zf - 0.02, zf, P.blackGlass, chamfer: 0.004)
                if o.category == "stove" { box(x0, x1, H, H + 0.006, zb, zf, P.blackGlass, chamfer: 0.002) }
            case "table":
                let tt = 0.03, leg = 0.05, ins = 0.05
                box(x0, x1, H - tt, H, zb, zf, P.worktop, chamfer: 0.004)
                for (lx, lz) in [(x0 + ins, zb + ins), (x1 - ins - leg, zb + ins), (x0 + ins, zf - ins - leg), (x1 - ins - leg, zf - ins - leg)] {
                    box(lx, lx + leg, 0, H - tt, lz, lz + leg, P.worktop)
                }
            case "chair":
                let seat = min(0.46, H * 0.5), leg = 0.035
                box(x0, x1, seat - 0.04, seat, zb, zf, P.worktop, chamfer: 0.006)
                for (lx, lz) in [(x0, zb), (x1 - leg, zb), (x0, zf - leg), (x1 - leg, zf - leg)] {
                    box(lx, lx + leg, 0, seat - 0.04, lz, lz + leg, P.worktop)
                }
                box(x0, x1, seat, H, zb, zb + 0.035, P.worktop, chamfer: 0.006)
            case "sofa":
                let seat = min(0.42, H * 0.5), arm = min(0.16, W * 0.12)
                box(x0, x1, 0.05, seat - 0.1, zb, zf, P.fabric, chamfer: 0.02)
                box(x0 + arm, x1 - arm, seat - 0.1, seat, zb + 0.2, zf, P.fabric, chamfer: 0.04)
                box(x0, x1, 0.05, H, zb, zb + 0.2, P.fabric, chamfer: 0.04)
                box(x0, x0 + arm, 0.05, seat + 0.18, zb, zf, P.fabric, chamfer: 0.04)
                box(x1 - arm, x1, 0.05, seat + 0.18, zb, zf, P.fabric, chamfer: 0.04)
            case "bed":
                let frame = min(0.3, H * 0.5)
                box(x0, x1, 0, frame, zb, zf, P.worktop, chamfer: 0.01)
                box(x0 + 0.03, x1 - 0.03, frame, frame + 0.2, zb + 0.05, zf - 0.03, P.cushion, chamfer: 0.04)
                box(x0, x1, 0, max(H, frame + 0.5), zb, zb + 0.05, P.worktop, chamfer: 0.01)
            case "television":
                box(x0, x1, 0, H, zb, zf, P.dark, chamfer: 0.004)
            case "toilet", "bathtub":
                box(x0, x1, 0, H, zb, zf, P.white, chamfer: min(0.05, min(W, D) / 4))
            default:
                box(x0, x1, 0, H, zb, zf, P.other, chamfer: 0.01)
            }
        }
        return node
    }

    // MARK: - Tekstury

    /// Otoczenie: jasny gradient (niebo → horyzont → „stół"), też jako źródło miękkiego światła.
    private static func environmentImage() -> UIImage {
        let size = CGSize(width: 64, height: 256)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let colors = [rgb(0.99, 0.985, 0.975).cgColor, rgb(0.95, 0.948, 0.94).cgColor, rgb(0.86, 0.85, 0.83).cgColor]
            let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 0.5, 1])!
            ctx.cgContext.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
    }

    /// Proceduralne panele dębowe (bez plików graficznych), bezszwowe w poziomie. Kafel = 2,4 m.
    private static func woodTexture() -> UIImage {
        let size = CGSize(width: 1024, height: 1024)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let g = ctx.cgContext
            var rng = SystemRandomNumberGenerator()
            let rows = 12 // deska ≈ 200 mm
            let rh = size.height / CGFloat(rows)
            for r in 0..<rows {
                let y0 = CGFloat(r) * rh
                var x = -CGFloat(Int.random(in: 0...400, using: &rng))
                while x < size.width {
                    let len = CGFloat(Int.random(in: 420...640, using: &rng))
                    let tone = CGFloat(Double.random(in: 0.56...0.66, using: &rng))
                    let color = UIColor(red: tone + 0.17, green: tone + 0.07, blue: tone - 0.07, alpha: 1)
                    for shift in [0, size.width] {
                        let rect = CGRect(x: x - shift, y: y0, width: len, height: rh)
                        g.setFillColor(color.cgColor)
                        g.fill(rect)
                        // Słoje.
                        g.setStrokeColor(UIColor(red: 0.35, green: 0.22, blue: 0.1, alpha: 0.07).cgColor)
                        g.setLineWidth(1.2)
                        for k in 0..<7 {
                            let yy = y0 + rh * CGFloat(k + 1) / 8
                            g.move(to: CGPoint(x: rect.minX, y: yy))
                            g.addCurve(to: CGPoint(x: rect.maxX, y: yy + CGFloat(Int.random(in: -4...4, using: &rng))),
                                       control1: CGPoint(x: rect.minX + len * 0.3, y: yy + CGFloat(Int.random(in: -6...6, using: &rng))),
                                       control2: CGPoint(x: rect.minX + len * 0.7, y: yy + CGFloat(Int.random(in: -6...6, using: &rng))))
                        }
                        g.strokePath()
                        // Fazy między deskami.
                        g.setStrokeColor(UIColor(red: 0.2, green: 0.12, blue: 0.05, alpha: 0.28).cgColor)
                        g.setLineWidth(1.5)
                        g.stroke(rect)
                    }
                    x += len
                }
            }
        }
    }
}
