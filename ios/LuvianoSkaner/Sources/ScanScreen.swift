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
    @Published var result: ScanPayload?
    @Published var finishing = false

    init() {
        controller.onResult = { [weak self] room in
            let payload = ScanExport.make(from: room)
            DispatchQueue.main.async { self?.result = payload }
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
    @StateObject private var model = ScanModel()

    var body: some View {
        if let result = model.result {
            ScanResultView(job: job, scan: result, onRescan: onRescan, onDone: { dismiss() })
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

struct ScanResultView: View {
    let job: JobRow
    let scan: ScanPayload
    let onRescan: () -> Void
    let onDone: () -> Void

    @EnvironmentObject private var session: Session
    @State private var name = "Kuchnia"
    @State private var show3D = false
    @State private var sending = false
    @State private var sent = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Widok", selection: $show3D) {
                        Text("Rzut 2D").tag(false)
                        Text("Widok 3D").tag(true)
                    }
                    .pickerStyle(.segmented)

                    Group {
                        if show3D {
                            Scan3DView(scan: scan)
                        } else {
                            PlanPreview(scan: scan)
                        }
                    }
                    .frame(height: 460)
                    .background(Brand.ivory)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    TextField("Nazwa pomieszczenia", text: $name)
                        .textFieldStyle(.roundedBorder)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Ściany").font(.headline)
                        ForEach(Array(scan.walls.enumerated()), id: \.offset) { i, w in
                            HStack {
                                Text(wallLetter(i)).bold().frame(width: 28, alignment: .leading)
                                Text("\(Int(w.lengthMm)) mm")
                                Spacer()
                                Text("wys. \(Int(w.heightMm)) mm").foregroundStyle(.secondary)
                            }
                            .font(.subheadline.monospacedDigit())
                        }
                        Text("Okna: \(scan.openings.filter { $0.kind == "window" }.count) · Drzwi: \(scan.openings.filter { $0.kind == "door" }.count) · Sprzęty: \(scan.objects.count)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding(.top, 4)
                    }

                    if let error {
                        Text(error).foregroundStyle(.red).font(.footnote)
                    }

                    if sent {
                        Label("Wysłano do zlecenia", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.headline)
                    }

                    HStack {
                        Button("Skanuj ponownie", action: onRescan)
                            .buttonStyle(.bordered)
                        Spacer()
                        if sent {
                            Button("Gotowe", action: onDone)
                                .buttonStyle(.borderedProminent)
                                .tint(Brand.ink)
                        } else {
                            Button {
                                Task { await send() }
                            } label: {
                                if sending { ProgressView() } else { Text("Wyślij do zlecenia") }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Brand.ink)
                            .disabled(sending || name.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                }
                .padding(20)
            }
            // W 3D przeciąganie obraca model, a nie przewija ekran.
            .scrollDisabled(show3D)
            .navigationTitle(job.clients?.name ?? job.title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func send() async {
        sending = true
        defer { sending = false }
        do {
            try await session.uploadScan(jobId: job.id, name: name.trimmingCharacters(in: .whitespaces), scan: scan)
            sent = true
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

func wallLetter(_ i: Int) -> String {
    i < 26 ? String(UnicodeScalar(65 + i)!) : "W\(i + 1)"
}
