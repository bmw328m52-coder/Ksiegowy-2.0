import Foundation

struct ApiError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct JobRow: Decodable, Identifiable, Hashable {
    struct ClientRef: Decodable, Hashable { let name: String }
    let id: String
    let title: String
    let status: String
    let clients: ClientRef?
}

/// Sesja Supabase (GoTrue + PostgREST) na gołym URLSession — bez zewnętrznych paczek.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var isLoggedIn: Bool
    @Published private(set) var email: String?

    private var accessToken: String?
    private var refreshToken: String?
    private var expiresAt: Date = .distantPast

    init() {
        refreshToken = Keychain.get("refresh_token")
        email = Keychain.get("email")
        isLoggedIn = refreshToken != nil
    }

    // MARK: Auth

    func signIn(email: String, password: String) async throws {
        try await token(grant: "password", body: ["email": email, "password": password])
        self.email = email
        Keychain.set(email, for: "email")
    }

    func signOut() {
        accessToken = nil
        refreshToken = nil
        Keychain.set(nil, for: "refresh_token")
        isLoggedIn = false
    }

    private struct TokenResponse: Decodable {
        let access_token: String
        let refresh_token: String
        let expires_in: Double
    }

    private func token(grant: String, body: [String: String]) async throws {
        var req = URLRequest(url: Config.supabaseURL.appending(path: "auth/v1/token").appending(queryItems: [
            URLQueryItem(name: "grant_type", value: grant),
        ]))
        req.httpMethod = "POST"
        req.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            if grant == "refresh_token" { signOut() }
            throw ApiError(message: Self.errorMessage(data, fallback: "Nieprawidłowy e-mail lub hasło."))
        }
        let t = try JSONDecoder().decode(TokenResponse.self, from: data)
        accessToken = t.access_token
        refreshToken = t.refresh_token
        expiresAt = Date().addingTimeInterval(t.expires_in - 60)
        Keychain.set(t.refresh_token, for: "refresh_token")
        isLoggedIn = true
    }

    private func validAccessToken() async throws -> String {
        if let accessToken, Date() < expiresAt { return accessToken }
        guard let refreshToken else {
            signOut()
            throw ApiError(message: "Sesja wygasła — zaloguj się ponownie.")
        }
        try await token(grant: "refresh_token", body: ["refresh_token": refreshToken])
        return accessToken!
    }

    // MARK: REST

    private func rest(_ path: String, query: [URLQueryItem] = [], method: String = "GET", body: Data? = nil,
                      returning: Bool = false) async throws -> Data {
        var req = URLRequest(url: Config.supabaseURL.appending(path: "rest/v1/\(path)").appending(queryItems: query))
        req.httpMethod = method
        req.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await validAccessToken())", forHTTPHeaderField: "Authorization")
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue(returning ? "return=representation" : "return=minimal", forHTTPHeaderField: "Prefer")
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            throw ApiError(message: Self.errorMessage(data, fallback: "Błąd serwera (\(code))."))
        }
        return data
    }

    func openJobs() async throws -> [JobRow] {
        let data = try await rest("jobs", query: [
            URLQueryItem(name: "select", value: "id,title,status,clients(name)"),
            URLQueryItem(name: "status", value: "not.in.(settled,archived,cancelled)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ])
        return try JSONDecoder().decode([JobRow].self, from: data)
    }

    /// Skan zlecenia zapisany w meble-app.
    struct RemoteScan: Decodable, Identifiable {
        let id: String
        let name: String
        let data: ScanPayload
        let createdAt: String
    }

    private static let snake: (JSONEncoder, JSONDecoder) = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return (e, d)
    }()

    func jobScans(jobId: String) async throws -> [RemoteScan] {
        let data = try await rest("room_scans", query: [
            URLQueryItem(name: "select", value: "id,name,data,created_at"),
            URLQueryItem(name: "job_id", value: "eq.\(jobId)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ])
        return try Self.snake.1.decode([RemoteScan].self, from: data)
    }

    /// Wysyła skan do zlecenia. Z `remoteId` aktualizuje istniejący wiersz (gdy w międzyczasie
    /// usunięto go w meble-app — wstawia nowy). Zwraca id wiersza.
    func uploadScan(jobId: String, name: String, scan: ScanPayload, remoteId: String?) async throws -> String {
        struct Row: Decodable { let id: String }
        if let remoteId {
            struct Patch: Encodable { let name: String; let data: ScanPayload }
            let out = try await rest("room_scans", query: [
                URLQueryItem(name: "id", value: "eq.\(remoteId)"),
                URLQueryItem(name: "select", value: "id"),
            ], method: "PATCH", body: try Self.snake.0.encode(Patch(name: name, data: scan)), returning: true)
            if let row = try JSONDecoder().decode([Row].self, from: out).first { return row.id }
        }
        struct Insert: Encodable { let jobId: String; let name: String; let data: ScanPayload }
        let out = try await rest("room_scans", query: [URLQueryItem(name: "select", value: "id")], method: "POST",
                                 body: try Self.snake.0.encode(Insert(jobId: jobId, name: name, data: scan)), returning: true)
        guard let row = try JSONDecoder().decode([Row].self, from: out).first else {
            throw ApiError(message: "Serwer nie zwrócił zapisanego skanu.")
        }
        return row.id
    }

    // MARK: Storage — zdjęcia punktów (bucket scan-photos, ścieżka {user_id}/{id}.jpg)

    /// Id użytkownika z tokenu (claim `sub`) — pierwszy człon ścieżki w Storage (RLS).
    private func userId() async throws -> String {
        let token = try await validAccessToken()
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { throw ApiError(message: "Nieprawidłowy token sesji.") }
        var b64 = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        b64 += String(repeating: "=", count: (4 - b64.count % 4) % 4)
        guard let data = Data(base64Encoded: b64),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = obj["sub"] as? String else { throw ApiError(message: "Nieprawidłowy token sesji.") }
        return sub
    }

    private func storage(_ path: String, method: String, body: Data? = nil, contentType: String? = nil,
                         headers: [String: String] = [:]) async throws -> Data {
        var req = URLRequest(url: Config.supabaseURL.appending(path: "storage/v1/\(path)"))
        req.httpMethod = method
        req.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await validAccessToken())", forHTTPHeaderField: "Authorization")
        if let contentType { req.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = body
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            throw ApiError(message: Self.errorMessage(data, fallback: "Błąd zapisu zdjęć (\(code))."))
        }
        return data
    }

    func uploadPhoto(_ id: String, data: Data) async throws {
        _ = try await storage("object/scan-photos/\(try await userId())/\(id).jpg", method: "POST", body: data,
                              contentType: "image/jpeg", headers: ["x-upsert": "true"])
    }

    func downloadPhoto(_ id: String) async throws -> Data {
        try await storage("object/authenticated/scan-photos/\(try await userId())/\(id).jpg", method: "GET")
    }

    func deletePhotos(_ ids: [String]) async throws {
        guard !ids.isEmpty else { return }
        let uid = try await userId()
        let body = try JSONSerialization.data(withJSONObject: ["prefixes": ids.map { "\(uid)/\($0).jpg" }])
        _ = try await storage("object/scan-photos", method: "DELETE", body: body, contentType: "application/json")
    }

    private static func errorMessage(_ data: Data, fallback: String) -> String {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return fallback }
        for key in ["error_description", "msg", "message"] {
            if let s = obj[key] as? String, !s.isEmpty { return s }
        }
        return fallback
    }
}
