import SwiftUI
import RoomPlan

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
        captureView.captureSession.stop()
    }

    func finish() {
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
                Text("\(job.clients?.name ?? "") — \(job.title)")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 12)
            }
        }
    }
}
