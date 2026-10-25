import SwiftUI
import RoomPlan

/// Skany zlecenia: zapisane na iPadzie + wysłane do meble-app. Każdy można otworzyć i edytować dalej.
struct JobScansView: View {
    let job: JobRow

    @EnvironmentObject private var session: Session
    @State private var local: [SavedScan] = []
    @State private var remote: [Session.RemoteScan] = []
    @State private var loading = false
    @State private var error: String?
    @State private var opened: SavedScan?
    @State private var newScan = false

    /// Skany z meble-app, których nie ma jeszcze na tym iPadzie.
    private var remoteOnly: [Session.RemoteScan] {
        let have = Set(local.compactMap(\.remoteId))
        return remote.filter { !have.contains($0.id) }
    }

    var body: some View {
        List {
            if let error {
                Text(error).foregroundStyle(.red).font(.footnote)
            }

            Section {
                Button {
                    newScan = true
                } label: {
                    Label("Nowy skan", systemImage: "viewfinder")
                        .font(.headline)
                        .padding(.vertical, 6)
                }
                .disabled(!RoomCaptureSession.isSupported)
            }

            Section("Na iPadzie") {
                if local.isEmpty {
                    Text("Brak zapisanych skanów.").foregroundStyle(.secondary)
                }
                ForEach(local) { s in
                    Button { opened = s } label: {
                        row(name: s.name, scan: s.scan, detail: s.updatedAt.formatted(date: .abbreviated, time: .shortened),
                            status: s.synced ? ("W zleceniu", "checkmark.icloud", Color.green)
                                : s.remoteId != nil ? ("Zmiany niewysłane", "arrow.triangle.2.circlepath.icloud", Color.orange)
                                : ("Niewysłany", "ipad", Color.secondary))
                    }
                    .swipeActions {
                        Button("Usuń z iPada", role: .destructive) {
                            ScanStore.delete(s.id)
                            reloadLocal()
                        }
                    }
                }
            }

            if !remoteOnly.isEmpty {
                Section {
                    ForEach(remoteOnly) { r in
                        Button { openRemote(r) } label: {
                            row(name: r.name, scan: r.data, detail: Self.date(r.createdAt),
                                status: ("W zleceniu", "icloud.and.arrow.down", Color.secondary))
                        }
                    }
                } header: {
                    Text("W zleceniu (meble-app)")
                } footer: {
                    Text("Stuknij, żeby pobrać skan na iPada i edytować dalej. Wysłanie zaktualizuje ten sam skan w zleceniu.")
                }
            }
        }
        .overlay { if loading && local.isEmpty && remote.isEmpty { ProgressView() } }
        .navigationTitle(job.clients?.name ?? job.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Link(destination: Config.pomiarURL(jobId: job.id)) {
                    Label("Wybory w meble-app", systemImage: "list.bullet.clipboard")
                        .labelStyle(.titleAndIcon)
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .fullScreenCover(item: $opened, onDismiss: { Task { await load() } }) { s in
            ScanResultView(job: job, saved: s, onDone: { opened = nil })
        }
        .fullScreenCover(isPresented: $newScan, onDismiss: { Task { await load() } }) {
            ScanScreen(job: job)
        }
    }

    private func row(name: String, scan: ScanPayload, detail: String, status: (String, String, Color)) -> some View {
        let m = PlanModel(scan)
        return HStack(spacing: 14) {
            ScanThumb(model: m)
                .frame(width: 96, height: 72)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 3) {
                Text(name).font(.headline).foregroundStyle(Brand.ink)
                Text(String(format: "%.2f m² · %d ścian · %d punktów", m.areaM2, scan.walls.count, scan.markers.count))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Label(status.0, systemImage: status.1)
                .font(.caption)
                .foregroundStyle(status.2)
        }
        .padding(.vertical, 4)
    }

    private func reloadLocal() { local = ScanStore.scans(jobId: job.id) }

    private func load() async {
        reloadLocal()
        ScanStore.prunePhotos()
        loading = true
        defer { loading = false }
        do {
            remote = try await session.jobScans(jobId: job.id)
            error = nil
        } catch {
            self.error = "Nie udało się pobrać skanów z meble-app: \(error.localizedDescription)"
        }
    }

    private func openRemote(_ r: Session.RemoteScan) {
        let s = SavedScan(jobId: job.id, name: r.name, scan: r.data, remoteId: r.id, synced: true,
                          uploadedPhotos: r.data.photoIds)
        ScanStore.save(s)
        reloadLocal()
        opened = s
    }

    private static func date(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return d?.formatted(date: .abbreviated, time: .shortened) ?? ""
    }
}

/// Miniatura rzutu: podłoga + ściany.
struct ScanThumb: View {
    let model: PlanModel

    var body: some View {
        Canvas { ctx, size in
            let pts = model.walls.flatMap { [$0.w.a, $0.w.b] } + model.floor
            guard !pts.isEmpty else { return }
            let L = PlanLayout(points: pts, size: size, margin: 8)
            if model.floor.count >= 3 {
                ctx.fill(Draft.poly(model.floor.map(L.pt)), with: .color(.white))
            }
            for g in model.walls {
                ctx.stroke(Draft.line(L.pt(g.w.a), L.pt(g.w.b)), with: .color(PlanStyle.wall), lineWidth: 2)
            }
        }
    }
}
