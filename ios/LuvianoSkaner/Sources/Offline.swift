import Foundation

/// Zlecenie założone na iPadzie bez zasięgu. Id (zlecenia i nowego klienta) nadajemy
/// na iPadzie i z tym samym id wstawiamy potem do meble-app — skany zapisane lokalnie
/// pod `jobId` nie wymagają przepinania po wysłaniu.
struct PendingJob: Codable, Identifiable {
    let id: String
    let title: String
    let clientId: String
    let clientName: String
    /// Klient założony na iPadzie — nie ma go jeszcze w meble-app.
    let newClient: Bool

    var row: JobRow { JobRow(id: id, title: title, status: "to_measure", clients: .init(name: clientName)) }

    /// Postgres zwraca uuid małymi literami — trzymamy tak samo, żeby porównania id działały.
    static func newId() -> String { UUID().uuidString.lowercased() }
}

/// Kolejka zleceń czekających na wysłanie (Documents/pending_jobs.json).
enum PendingJobs {
    private static var url: URL { URL.documentsDirectory.appending(path: "pending_jobs.json") }

    static func load() -> [PendingJob] {
        guard let d = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PendingJob].self, from: d)) ?? []
    }

    private static func save(_ jobs: [PendingJob]) {
        if let d = try? JSONEncoder().encode(jobs) { try? d.write(to: url, options: .atomic) }
    }

    static func add(_ job: PendingJob) { save(load() + [job]) }

    static func remove(_ id: String) { save(load().filter { $0.id != id }) }

    /// Klienci założeni na iPadzie — do wyboru przy kolejnym zleceniu, zanim trafią do meble-app.
    static var newClients: [Session.ClientRow] {
        var seen = Set<String>()
        return load().filter { $0.newClient && seen.insert($0.clientId).inserted }
            .map { Session.ClientRow(id: $0.clientId, name: $0.clientName) }
    }
}

/// Ostatnio pobrana lista klientów — bez zasięgu dalej można wybrać istniejącego.
enum ClientsCache {
    private static var url: URL { URL.documentsDirectory.appending(path: "clients.json") }

    static func load() -> [Session.ClientRow] {
        guard let d = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([Session.ClientRow].self, from: d)) ?? []
    }

    static func save(_ clients: [Session.ClientRow]) {
        if let d = try? JSONEncoder().encode(clients) { try? d.write(to: url, options: .atomic) }
    }
}
