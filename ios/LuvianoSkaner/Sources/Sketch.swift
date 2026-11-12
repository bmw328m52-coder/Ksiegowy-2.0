import SwiftUI
import PencilKit

/// Kartka: pusty arkusz do odręcznego szkicu (rysik albo palec) — gdy czegoś nie da się
/// zeskanować albo jest zbyt nietypowe. Zapis na iPadzie po każdej kresce; po wysłaniu
/// trafia jako obraz do sekcji „Projekt" zlecenia w meble-app (tabela job_files).
struct SavedSketch: Codable, Identifiable {
    var id = PendingJob.newId()
    var jobId: String
    var name: String
    /// PKDrawing.dataRepresentation()
    var drawing = Data()
    var grid = true
    /// Wiersz job_files i ścieżka obrazu w buckecie job-files po wysłaniu.
    var remoteId: String?
    var remotePath: String?
    /// Wersja na iPadzie = wersja w zleceniu.
    var synced = false
    var updatedAt = Date()

    var pk: PKDrawing { (try? PKDrawing(data: drawing)) ?? PKDrawing() }
}

/// Pliki JSON w Documents/sketches — jak skany, zostają po zamknięciu i aktualizacji aplikacji.
enum SketchStore {
    private static var dir: URL {
        let d = URL.documentsDirectory.appending(path: "sketches", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private static func file(_ id: String) -> URL { dir.appending(path: "\(id).json") }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    static func save(_ s: SavedSketch) {
        guard let data = try? encoder.encode(s) else { return }
        try? data.write(to: file(s.id), options: .atomic)
    }

    static func delete(_ id: String) {
        try? FileManager.default.removeItem(at: file(id))
    }

    static func sketches(jobId: String) -> [SavedSketch] {
        let urls = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return urls
            .filter { $0.pathExtension == "json" }
            .compactMap { try? decoder.decode(SavedSketch.self, from: Data(contentsOf: $0)) }
            .filter { $0.jobId == jobId }
            .sorted { $0.updatedAt > $1.updatedAt }
    }
}

/// Arkusz: stały rozmiar w punktach (proporcje A4 poziomo), kratka co 40 pt, obraz do meble-app.
enum SketchSheet {
    static let size = CGSize(width: 1600, height: 1132)
    static let gridStep: CGFloat = 40
    static var rect: CGRect { CGRect(origin: .zero, size: size) }

    static func gridPath() -> UIBezierPath {
        let path = UIBezierPath()
        var x = gridStep
        while x < size.width {
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: size.height))
            x += gridStep
        }
        var y = gridStep
        while y < size.height {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            y += gridStep
        }
        return path
    }

    static let gridColor = UIColor(red: 0.80, green: 0.84, blue: 0.90, alpha: 1)

    /// Kreski zawsze jak na białym papierze — także gdy iPad jest w trybie ciemnym.
    private static func ink(_ drawing: PKDrawing, scale: CGFloat) -> UIImage {
        var img = UIImage()
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            img = drawing.image(from: rect, scale: scale)
        }
        return img
    }

    /// Kartka jako obraz: białe tło, opcjonalnie kratka, na tym rysunek.
    static func render(_ drawing: PKDrawing, grid: Bool, scale: CGFloat) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        let strokes = ink(drawing, scale: scale)
        return UIGraphicsImageRenderer(size: size, format: format).image { c in
            UIColor.white.setFill()
            c.fill(rect)
            if grid {
                gridColor.setStroke()
                let path = gridPath()
                path.lineWidth = 1
                path.stroke()
            }
            strokes.draw(in: rect)
        }
    }
}

/// Biały arkusz z kratką pod rysunkiem — leży w PKCanvasView i skaluje się razem z nim.
final class PaperView: UIView {
    private let gridLayer = CAShapeLayer()

    var showGrid = true {
        didSet { gridLayer.isHidden = !showGrid }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .white
        isUserInteractionEnabled = false
        gridLayer.frame = bounds
        gridLayer.path = SketchSheet.gridPath().cgPath
        gridLayer.strokeColor = SketchSheet.gridColor.cgColor
        gridLayer.fillColor = nil
        gridLayer.lineWidth = 1
        layer.addSublayer(gridLayer)
        layer.borderColor = UIColor(white: 0.7, alpha: 1).cgColor
        layer.borderWidth = 1
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Płótno PencilKit z arkuszem stałej wielkości: dopasowanie do ekranu, szczypanie = powiększenie.
final class SheetCanvasView: PKCanvasView {
    let paper = PaperView(frame: SketchSheet.rect)
    private var laidOut = CGSize.zero
    private var fitted = false

    func setUp() {
        // Arkusz skalowany od lewego górnego rogu — pokrywa się z treścią płótna.
        paper.layer.anchorPoint = .zero
        paper.frame = SketchSheet.rect
        insertSubview(paper, at: 0)
        backgroundColor = .clear
        isOpaque = false
        overrideUserInterfaceStyle = .light
        drawingPolicy = .anyInput
        contentInsetAdjustmentBehavior = .never
        showsVerticalScrollIndicator = false
        showsHorizontalScrollIndicator = false
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { becomeFirstResponder() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 10, bounds.height > 10, bounds.size != laidOut else { return }
        laidOut = bounds.size
        let fit = min(bounds.width / SketchSheet.size.width, bounds.height / SketchSheet.size.height) * 0.96
        minimumZoomScale = fit * 0.7
        maximumZoomScale = max(4, fit * 4)
        if !fitted {
            fitted = true
            zoomScale = fit
            contentSize = CGSize(width: SketchSheet.size.width * fit, height: SketchSheet.size.height * fit)
            place()
            contentOffset = CGPoint(x: -contentInset.left, y: -contentInset.top)
        } else {
            place()
        }
    }

    /// Arkusz pod rysunkiem w aktualnym powiększeniu; mniejszy od ekranu — wyśrodkowany.
    func place() {
        let z = zoomScale
        paper.transform = CGAffineTransform(scaleX: z, y: z)
        sendSubviewToBack(paper)
        let dx = max((bounds.width - SketchSheet.size.width * z) / 2, 0)
        let dy = max((bounds.height - SketchSheet.size.height * z) / 2, 0)
        let inset = UIEdgeInsets(top: dy, left: dx, bottom: dy, right: dx)
        if contentInset != inset { contentInset = inset }
    }
}

/// Cofnij / ponów / przywrócenie paska narzędzi — sterowane z paska SwiftUI.
final class SketchController: ObservableObject {
    weak var canvas: SheetCanvasView?

    func undo() { canvas?.undoManager?.undo() }
    func redo() { canvas?.undoManager?.redo() }
    func focus() { canvas?.becomeFirstResponder() }
}

struct SketchCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    let grid: Bool
    let controller: SketchController

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> SheetCanvasView {
        let v = SheetCanvasView()
        v.setUp()
        v.drawing = drawing
        v.paper.showGrid = grid
        v.delegate = context.coordinator
        let picker = context.coordinator.picker
        picker.colorUserInterfaceStyle = .light
        picker.setVisible(true, forFirstResponder: v)
        picker.addObserver(v)
        controller.canvas = v
        return v
    }

    func updateUIView(_ v: SheetCanvasView, context: Context) {
        context.coordinator.parent = self
        if v.drawing != drawing { v.drawing = drawing }
        if v.paper.showGrid != grid { v.paper.showGrid = grid }
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: SketchCanvas
        let picker = PKToolPicker()

        init(_ parent: SketchCanvas) { self.parent = parent }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            if parent.drawing != canvasView.drawing { parent.drawing = canvasView.drawing }
        }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            (scrollView as? SheetCanvasView)?.place()
        }

        func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
            guard let v = scrollView as? SheetCanvasView else { return }
            v.contentSize = CGSize(width: SketchSheet.size.width * v.zoomScale, height: SketchSheet.size.height * v.zoomScale)
            v.place()
        }
    }
}

/// Ekran kartki: pasek (nazwa, cofnij, kratka, wyczyść, wyślij) + arkusz z narzędziami PencilKit.
struct SketchScreen: View {
    let job: JobRow
    let onDone: () -> Void

    @EnvironmentObject private var session: Session
    @StateObject private var controller = SketchController()
    @State private var sketch: SavedSketch
    @State private var drawing: PKDrawing
    @State private var sending = false
    @State private var error: String?
    @State private var confirmClear = false
    @State private var renaming = false
    @State private var nameDraft = ""

    init(job: JobRow, sketch: SavedSketch, onDone: @escaping () -> Void) {
        self.job = job
        self.onDone = onDone
        _sketch = State(initialValue: sketch)
        _drawing = State(initialValue: sketch.pk)
    }

    private var status: (String, String, Color) {
        sketch.synced ? ("W zleceniu", "checkmark.icloud", Color.green)
            : sketch.remoteId != nil ? ("Zmiany niewysłane", "arrow.triangle.2.circlepath.icloud", Color.orange)
            : ("Niewysłana", "ipad", Color.secondary)
    }

    var body: some View {
        VStack(spacing: 0) {
            bar
            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
            SketchCanvas(drawing: $drawing, grid: sketch.grid, controller: controller)
                .background(Color(white: 0.86))
                .overlay {
                    if sending {
                        ZStack {
                            Color.black.opacity(0.15)
                            ProgressView("Wysyłam do zlecenia…")
                                .padding(20)
                                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
        }
        .background(Color(.systemBackground))
        .onChange(of: drawing) { _, d in
            sketch.drawing = d.dataRepresentation()
            touch()
        }
        .alert("Nazwa kartki", isPresented: $renaming) {
            TextField("np. Wnęka pod skosem", text: $nameDraft)
            Button("Zapisz") {
                let n = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                if !n.isEmpty, n != sketch.name {
                    sketch.name = n
                    touch()
                }
                refocus()
            }
            Button("Anuluj", role: .cancel) { refocus() }
        }
        .alert("Wyczyścić całą kartkę?", isPresented: $confirmClear) {
            Button("Wyczyść", role: .destructive) {
                drawing = PKDrawing()
                refocus()
            }
            Button("Anuluj", role: .cancel) { refocus() }
        } message: {
            Text("Rysunek zniknie z tej kartki.")
        }
    }

    private var bar: some View {
        HStack(spacing: 10) {
            Button("Zamknij") { close() }
            Button {
                nameDraft = sketch.name
                renaming = true
            } label: {
                Label(sketch.name, systemImage: "pencil").lineLimit(1)
            }
            .tint(Brand.ink)
            Label(status.0, systemImage: status.1)
                .font(.caption)
                .foregroundStyle(status.2)
                .lineLimit(1)
            Spacer(minLength: 0)
            Button { controller.undo() } label: { Image(systemName: "arrow.uturn.backward") }
            Button { controller.redo() } label: { Image(systemName: "arrow.uturn.forward") }
            Button { controller.focus() } label: { Image(systemName: "pencil.tip.crop.circle") }
            Toggle(isOn: Binding(get: { sketch.grid }, set: { sketch.grid = $0; touch() })) {
                Label("Kratka", systemImage: "squareshape.split.3x3")
            }
            .toggleStyle(.button)
            .tint(Brand.ink)
            Button(role: .destructive) { confirmClear = true } label: { Image(systemName: "trash") }
                .disabled(drawing.strokes.isEmpty)
            Button { send() } label: {
                Label(sketch.remoteId == nil ? "Wyślij" : "Zaktualizuj", systemImage: "paperplane.fill")
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.ink)
            .disabled(sending || sketch.synced || drawing.strokes.isEmpty)
        }
        .buttonStyle(.bordered)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    /// Zmiana na kartce: zapis na iPadzie, wersja w zleceniu przestaje być aktualna.
    private func touch() {
        sketch.synced = false
        sketch.updatedAt = Date()
        SketchStore.save(sketch)
    }

    /// Okno z pytaniem zabiera płótnu fokus — bez niego pasek narzędzi PencilKit znika.
    private func refocus() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { controller.focus() }
    }

    private func close() {
        // Pusta, nigdy niewysłana kartka nie zostaje na liście.
        if drawing.strokes.isEmpty, sketch.remoteId == nil { SketchStore.delete(sketch.id) }
        onDone()
    }

    private func send() {
        let image = SketchSheet.render(drawing, grid: sketch.grid, scale: 2)
        guard let jpeg = image.jpegData(compressionQuality: 0.85), let cg = image.cgImage else {
            error = "Nie udało się przygotować obrazu kartki."
            return
        }
        sending = true
        error = nil
        Task { @MainActor in
            defer { sending = false }
            do {
                let r = try await session.uploadSketch(jobId: job.id, name: sketch.name, jpeg: jpeg,
                                                       width: cg.width, height: cg.height,
                                                       remoteId: sketch.remoteId, remotePath: sketch.remotePath)
                sketch.remoteId = r.id
                sketch.remotePath = r.path
                sketch.synced = true
                SketchStore.save(sketch)
            } catch {
                self.error = "Kartka jest zapisana na iPadzie, ale nie udało się jej wysłać: \(error.localizedDescription)"
            }
        }
    }
}

/// Miniatura kartki na liście zlecenia.
struct SketchThumb: View {
    let sketch: SavedSketch

    var body: some View {
        Image(uiImage: SketchSheet.render(sketch.pk, grid: false, scale: 0.12))
            .resizable()
            .scaledToFit()
    }
}
