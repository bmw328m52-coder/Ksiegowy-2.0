import SwiftUI
import RoomPlan

/// Ostatnio pobrana lista zleceń — u klienta bez zasięgu dalej można wybrać zlecenie i skanować.
enum JobsCache {
    private struct File: Codable { let at: Date; let jobs: [JobRow] }
    private static var url: URL { URL.documentsDirectory.appending(path: "jobs.json") }

    static func load() -> (at: Date, jobs: [JobRow])? {
        guard let d = try? Data(contentsOf: url), let f = try? JSONDecoder().decode(File.self, from: d) else { return nil }
        return (f.at, f.jobs)
    }

    static func save(_ jobs: [JobRow]) {
        if let d = try? JSONEncoder().encode(File(at: Date(), jobs: jobs)) { try? d.write(to: url, options: .atomic) }
    }
}

struct JobsView: View {
    @EnvironmentObject private var session: Session
    @State private var jobs: [JobRow] = JobsCache.load()?.jobs ?? []
    @State private var newJob = false
    @State private var query = ""
    @State private var loading = false
    @State private var error: String?
    @State private var path: [JobRow] = []
    /// Zlecenia założone na iPadzie, których nie ma jeszcze w meble-app.
    @State private var pendingIds = Set(PendingJobs.load().map(\.id))

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
                                if pendingIds.contains(job.id) {
                                    Label("Na iPadzie — czeka na wysłanie", systemImage: "ipad")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
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
                ToolbarItem(placement: .topBarLeading) {
                    Button { newJob = true } label: { Label("Nowe zlecenie", systemImage: "plus") }
                        .labelStyle(.titleAndIcon)
                }
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
            .sheet(isPresented: $newJob) {
                NewJobSheet { job in
                    jobs.insert(job, at: 0)
                    JobsCache.save(jobs)
                    pendingIds.insert(job.id)
                    path = [job]
                    // Z zasięgiem trafia do meble-app od razu; bez — przy następnym odświeżeniu / wysłaniu skanu.
                    Task {
                        if (try? await session.syncPending()) != nil { pendingIds = Set(PendingJobs.load().map(\.id)) }
                    }
                }
            }
            .refreshable { await load() }
            .task {
                await load()
                await openDeepLink()
                await session.refreshCabinetRates()
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
            // Najpierw zlecenia założone bez zasięgu — błąd wysyłki nie blokuje listy.
            var syncError: String?
            do { try await session.syncPending() } catch { syncError = error.localizedDescription }
            let remote = try await session.openJobs()
            let waiting = PendingJobs.load().map(\.row).filter { p in !remote.contains { $0.id == p.id } }
            jobs = waiting + remote
            pendingIds = Set(waiting.map(\.id))
            JobsCache.save(jobs)
            error = waiting.isEmpty ? nil
                : "Nie udało się wysłać zleceń założonych na iPadzie (\(waiting.count)): \(syncError ?? "spróbuj ponownie")."
        } catch {
            pendingIds = Set(PendingJobs.load().map(\.id))
            if let c = JobsCache.load(), !c.jobs.isEmpty {
                jobs = c.jobs
                self.error = "Brak połączenia — lista z \(c.at.formatted(date: .abbreviated, time: .shortened)). Skanuj i zakładaj zlecenia normalnie, wyślą się po powrocie zasięgu."
            } else {
                self.error = error.localizedDescription
            }
        }
    }
}

/// Nowe zlecenie z iPada: istniejący klient albo nowy (osoba prywatna) + tytuł.
/// Działa bez zasięgu — zlecenie trafia do kolejki `PendingJobs`.
struct NewJobSheet: View {
    let onCreated: (JobRow) -> Void

    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @State private var clients: [Session.ClientRow] = PendingJobs.newClients + ClientsCache.load()
    @State private var clientId: String?
    @State private var newName = ""
    @State private var query = ""
    @State private var title = "Kuchnia"
    @State private var offline = false

    private static let titles = ["Kuchnia", "Szafa", "Garderoba", "Łazienka", "Zabudowa", "Meble"]

    private var filtered: [Session.ClientRow] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? clients : clients.filter { $0.name.lowercased().contains(q) }
    }

    private var newClient: String? {
        let n = newName.trimmingCharacters(in: .whitespaces)
        return clientId == nil && !n.isEmpty ? n : nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Zlecenie") {
                    TextField("Tytuł", text: $title)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(Self.titles, id: \.self) { t in
                                Button(t) { title = t }
                                    .buttonStyle(.bordered)
                                    .tint(title == t ? Brand.gold : Brand.ink)
                            }
                        }
                    }
                }
                Section("Nowy klient") {
                    TextField("Imię i nazwisko / firma", text: $newName)
                        .onChange(of: newName) { _, v in if !v.isEmpty { clientId = nil } }
                }
                Section("…albo istniejący klient") {
                    TextField("Szukaj", text: $query)
                    ForEach(filtered.prefix(30)) { c in
                        Button {
                            clientId = c.id
                            newName = ""
                        } label: {
                            HStack {
                                Text(c.name).foregroundStyle(Brand.ink)
                                Spacer()
                                if clientId == c.id { Image(systemName: "checkmark").foregroundStyle(Brand.gold) }
                            }
                        }
                    }
                }
                if offline {
                    Text("Brak połączenia — zlecenie zapisze się na iPadzie i samo wyśle do meble-app po powrocie zasięgu.")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                }
            }
            .navigationTitle("Nowe zlecenie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button { create() } label: { Text("Utwórz").bold() }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || (clientId == nil && newClient == nil))
                }
            }
            .task {
                do {
                    let fresh = try await session.clients()
                    ClientsCache.save(fresh)
                    clients = PendingJobs.newClients.filter { p in !fresh.contains { $0.id == p.id } } + fresh
                } catch {
                    offline = true
                }
            }
        }
    }

    private func create() {
        let existing = clients.first { $0.id == clientId }
        guard let name = newClient ?? existing?.name else { return }
        let stillLocal = PendingJobs.newClients.contains { $0.id == existing?.id }
        let job = PendingJob(id: PendingJob.newId(), title: title.trimmingCharacters(in: .whitespaces),
                             clientId: existing?.id ?? PendingJob.newId(), clientName: name,
                             newClient: existing == nil || stillLocal)
        PendingJobs.add(job)
        dismiss()
        onCreated(job.row)
    }
}
