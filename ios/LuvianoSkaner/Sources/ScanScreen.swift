import SwiftUI
import RoomPlan
import AVFoundation

/// Latarka iPada w trakcie skanu (ARKit trzyma kamerę, ale lampę da się włączyć osobno).
enum Torch {
    private static var device: AVCaptureDevice? {
        AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
    }
    static var available: Bool { device?.hasTorch ?? false }

    @discardableResult
    static func set(_ on: Bool) -> Bool {
        guard let d = device, d.hasTorch else { return false }
        do {
            try d.lockForConfiguration()
            defer { d.unlockForConfiguration() }
            if on { try d.setTorchModeOn(level: min(0.8, AVCaptureDevice.maxAvailableTorchLevel)) } else { d.torchMode = .off }
            return true
        } catch { return false }
    }
}

/// UIKit-owy kontroler RoomPlan (RoomCaptureViewDelegate wymaga NSCoding — daje to UIViewController).
final class RoomCaptureViewController: UIViewController, RoomCaptureViewDelegate {
    var onResult: ((CapturedRoom) -> Void)?
    private var captureView: RoomCaptureView!

    override func viewDidLoad() {
        super.viewDidLoad()
        captureView = RoomCaptureView(frame: view.bounds)
        captureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        captureView.delegate = self
        view.addSubview(captureView)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        captureView.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        Torch.set(false)
        captureView.captureSession.stop()
    }

    func finish() {
        Torch.set(false)
        captureView.captureSession.stop()
    }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        onResult?(processedResult)
    }
}

private struct CaptureContainer: UIViewControllerRepresentable {
    let controller: RoomCaptureViewController
    func makeUIViewController(context: Context) -> RoomCaptureViewController { controller }
    func updateUIViewController(_ vc: RoomCaptureViewController, context: Context) {}
}

final class ScanModel: ObservableObject {
    let controller = RoomCaptureViewController()
    @Published var result: SavedScan?
    @Published var finishing = false
    @Published var torch = false

    init(jobId: String) {
        controller.onResult = { [weak self] room in
            let payload = ScanExport.make(from: room)
            DispatchQueue.main.async {
                // Od razu na dysk — skan jest bezpieczny, zanim cokolwiek się w nim zmieni.
                let saved = SavedScan(jobId: jobId, name: "Kuchnia", scan: payload)
                ScanStore.save(saved)
                self?.result = saved
            }
        }
    }
}

struct ScanScreen: View {
    let job: JobRow
    @State private var attempt = 0

    var body: some View {
        // Nowe .id = nowy ScanModel i świeża sesja RoomPlan przy "Skanuj ponownie".
        ScanFlow(job: job, onRescan: { attempt += 1 }).id(attempt)
    }
}

private struct ScanFlow: View {
    let job: JobRow
    let onRescan: () -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model: ScanModel

    init(job: JobRow, onRescan: @escaping () -> Void) {
        self.job = job
        self.onRescan = onRescan
        _model = StateObject(wrappedValue: ScanModel(jobId: job.id))
    }

    var body: some View {
        if let result = model.result {
            ScanResultView(job: job, saved: result, onRescan: onRescan, onDone: { dismiss() })
        } else {
            ZStack(alignment: .bottom) {
                CaptureContainer(controller: model.controller)
                    .ignoresSafeArea()

                HStack(spacing: 16) {
                    Button("Anuluj") { dismiss() }
                        .buttonStyle(.bordered)
                        .tint(.white)
                    if Torch.available {
                        Button {
                            if Torch.set(!model.torch) { model.torch.toggle() }
                        } label: {
                            Label(model.torch ? "Lampa wł." : "Lampa", systemImage: model.torch ? "flashlight.on.fill" : "flashlight.off.fill")
                                .frame(minHeight: 36)
                        }
                        .buttonStyle(.bordered)
                        .tint(model.torch ? .yellow : .white)
                        .disabled(model.finishing)
                    }
                    Button {
                        model.finishing = true
                        model.controller.finish()
                    } label: {
                        Text(model.finishing ? "Przetwarzanie…" : "Zakończ skan")
                            .frame(minWidth: 180, minHeight: 36)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.gold)
                    .disabled(model.finishing)
                }
                .padding(.bottom, 28)
            }
            .overlay(alignment: .top) {
                VStack(spacing: 6) {
                    Text("\(job.clients?.name ?? "") — \(job.title)")
                        .font(.footnote.weight(.semibold))
                    Text("Jedno pomieszczenie na skan · drzwi do innych zamknięte · powoli wzdłuż ścian, narożniki z bliska")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                .padding(.top, 12)
            }
        }
    }
}
