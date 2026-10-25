import SwiftUI

enum Brand {
    static let ink = Color(red: 0x28 / 255, green: 0x26 / 255, blue: 0x24 / 255)
    static let gold = Color(red: 0xa0 / 255, green: 0x6f / 255, blue: 0x3f / 255)
    static let ivory = Color(red: 0xfa / 255, green: 0xf8 / 255, blue: 0xf3 / 255)
}

@main
struct LuvianoSkanerApp: App {
    @StateObject private var session = Session()
    @StateObject private var laser = Laser()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isLoggedIn {
                    JobsView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(session)
            .environmentObject(laser)
            .onOpenURL { url in
                // luvianoskaner://job/{id}
                guard url.scheme == "luvianoskaner", url.host == "job", let id = url.pathComponents.dropFirst().first
                else { return }
                session.deepLinkJobId = id
            }
            .tint(Brand.gold)
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var session: Session
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Brand.ivory.ignoresSafeArea()
            VStack(spacing: 18) {
                Text("LUVIANO")
                    .font(.system(size: 34, weight: .light, design: .serif))
                    .tracking(8)
                    .foregroundStyle(Brand.ink)
                Text("Skaner pomieszczeń")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                VStack(spacing: 12) {
                    TextField("E-mail", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Hasło", text: $password)
                        .textContentType(.password)
                }
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 380)
                .padding(.top, 12)

                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button {
                    Task { await login() }
                } label: {
                    Group {
                        if busy { ProgressView().tint(.white) } else { Text("Zaloguj") }
                    }
                    .frame(maxWidth: 380, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.ink)
                .disabled(busy || email.isEmpty || password.isEmpty)

                Text("Te same dane co w meble-app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(24)
        }
    }

    private func login() async {
        busy = true
        defer { busy = false }
        do {
            try await session.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
