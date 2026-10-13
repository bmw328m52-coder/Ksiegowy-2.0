import Foundation

/// Skan zapisany na iPadzie (jak projekt w MagicPlan): zapis po każdej zmianie,
/// można wrócić i edytować dalej. `remoteId` = wiersz room_scans po wysłaniu.
struct SavedScan: Codable, Identifiable {
    var id = UUID().uuidString
    var jobId: String
    var name: String
    var scan: ScanPayload
    var remoteId: String?
    /// Wersja na iPadzie = wersja w zleceniu.
    var synced = false
    var updatedAt = Date()
    /// Zdjęcia, które są już w meble-app (Storage) — wysyłamy tylko nowe, usuwamy niepotrzebne.
    var uploadedPhotos: [String]?
}

extension ScanPayload {
    var photoIds: [String] { markers.flatMap { $0.photos ?? [] } }
}

/// Pliki JSON w Documents/scans — zostają po zamknięciu aplikacji i po aktualizacji przez Sideloadly.
enum ScanStore {
    private static var dir: URL {
        let d = URL.documentsDirectory.appending(path: "scans", directoryHint: .isDirectory)
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

    static func save(_ s: SavedScan) {
        guard let data = try? encoder.encode(s) else { return }
        try? data.write(to: file(s.id), options: .atomic)
    }

    static func delete(_ id: String) {
        try? FileManager.default.removeItem(at: file(id))
    }

    static func all() -> [SavedScan] {
        let urls = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return urls
            .filter { $0.pathExtension == "json" }
            .compactMap { try? decoder.decode(SavedScan.self, from: Data(contentsOf: $0)) }
    }

    static func scans(jobId: String) -> [SavedScan] {
        all().filter { $0.jobId == jobId }.sorted { $0.updatedAt > $1.updatedAt }
    }

    /// Sprząta zdjęcia po usuniętych punktach / skanach.
    static func prunePhotos() {
        PhotoStore.prune(keeping: Set(all().flatMap(\.scan.photoIds)))
    }
}
