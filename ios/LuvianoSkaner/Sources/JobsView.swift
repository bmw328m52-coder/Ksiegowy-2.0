import SwiftUI
import RoomPlan

struct JobsView: View {
    @EnvironmentObject private var session: Session
    @State private var jobs: [JobRow] = []
    @State private var query = ""
    @State private var loading = false
    @State private var error: String?
    @State private var path: [JobRow] = []

    private var filtered: [JobRow] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return jobs }
        return jobs.filter {
            $0.title.lowercased().contains(q) || ($0.clients?.name.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if !RoomCaptureSession.isSupported {
                    Text("To urządzenie nie ma LiDAR-a — skanowanie niedostępne.")
                        .foregroundStyle(.red)
                }
                if let error {
                    Text(error).foregroundStyle(.red)
                }
                Section("Wybierz zlecenie") {
                    ForEach(filtered) { job in
                        NavigationLink(value: job) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(job.clients?.name ?? "Bez klienta")
                                    .font(.headline)
                                    .foregroundStyle(Brand.ink)
                                Text(job.title)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    if !loading && jobs.isEmpty && error == nil {
                        Text("Brak otwartych zleceń. Dodaj zlecenie w meble-app.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .overlay { if loading && jobs.isEmpty { ProgressView() } }
            .searchable(text: $query, prompt: "Klient lub zlecenie")
            .navigationTitle("LUVIANO Skaner")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let email = session.email { Text(email) }
                        Button("Wyloguj", role: .destructive) { session.signOut() }
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                }
            }
            .navigationDestination(for: JobRow.self) { JobScansView(job: $0) }
            .refreshable { await load() }
            .task {
                await load()
                await openDeepLink()
            }
            .onChange(of: session.deepLinkJobId) { Task { await openDeepLink() } }
        }
    }

    /// Otwiera zlecenie wskazane linkiem z meble-app.
    private func openDeepLink() async {
        guard let id = session.deepLinkJobId else { return }
        session.deepLinkJobId = nil
        var job = jobs.first { $0.id == id }
        if job == nil { job = try? await session.job(id: id) }
        if let job { path = [job] } else { error = "Nie znaleziono zlecenia z linku." }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            jobs = try await session.openJobs()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
