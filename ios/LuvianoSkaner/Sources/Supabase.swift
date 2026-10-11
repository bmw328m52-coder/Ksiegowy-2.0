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

    private func rest(_ path: String, query: [URLQueryItem] = [], method: String = "GET", body: Data? = nil) async throws -> Data {
        var req = URLRequest(url: Config.supabaseURL.appending(path: "rest/v1/\(path)").appending(queryItems: query))
        req.httpMethod = method
        req.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await validAccessToken())", forHTTPHeaderField: "Authorization")
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
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

    func uploadScan(jobId: String, name: String, scan: ScanPayload) async throws {
        struct Insert: Encodable {
            let jobId: String
            let name: String
            let data: ScanPayload
        }
        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        _ = try await rest("room_scans", method: "POST", body: try enc.encode(Insert(jobId: jobId, name: name, data: scan)))
    }

    private static func errorMessage(_ data: Data, fallback: String) -> String {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return fallback }
        for key in ["error_description", "msg", "message"] {
            if let s = obj[key] as? String, !s.isEmpty { return s }
        }
        return fallback
    }
}
