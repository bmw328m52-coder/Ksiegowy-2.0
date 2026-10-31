import SwiftUI

/// Płyta wybrana z wzornika (kod + nazwa — nazwa zapisana, żeby opis działał bez katalogu).
struct WardrobeDecor: Codable, Equatable {
    var code: String
    var name: String
    var label: String { "\(code) \(name)" }
}

/// Kolory okuć: uchwyty / profile drzwi i tory drzwi przesuwnych.
enum HardwareColors {
    static let handles = ["Bez uchwytów (Tip-On / frezowany)", "Srebrny / aluminium", "Inox szczotkowany", "Czarny mat",
                          "Grafit", "Biały", "Złoty szczotkowany", "Szampan", "Miedź / brąz"]
    static let tracks = ["Srebrny anodowany", "Czarny", "Biały", "Szampan / złoty", "Grafit", "Inox szczotkowany"]
}

/// Wzornik Pfleiderer: szukanie po kodzie / nazwie, grupy, domyślnie tylko Kolekcja Express (płyta laminowana).
struct DecorPicker: View {
    let title: String
    let current: String?
    let onPick: (WardrobeDecor?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var group: PfleidererCatalog.Group?
    @AppStorage("decor.expressOnly") private var expressOnly = true

    private var items: [PfleidererCatalog.D] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return PfleidererCatalog.all.filter { d in
            (!expressOnly || d.express) && (group == nil || d.group == group)
                && (q.isEmpty || d.code.lowercased().contains(q) || d.name.lowercased().contains(q))
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Grupa", selection: $group) {
                        Text("Wszystkie").tag(PfleidererCatalog.Group?.none)
                        ForEach(PfleidererCatalog.Group.allCases, id: \.self) { g in Text(g.label).tag(Optional(g)) }
                    }
                    .pickerStyle(.segmented)
                    Toggle("Tylko Kolekcja Express (płyta laminowana)", isOn: $expressOnly)
                        .font(.subheadline)
                }
                Section("\(items.count) dekorów") {
                    ForEach(items) { d in
                        Button {
                            onPick(WardrobeDecor(code: d.code, name: d.name))
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                AsyncImage(url: d.imageURL) { img in img.resizable().scaledToFill() } placeholder: {
                                    Color(white: 0.9)
                                }
                                .frame(width: 48, height: 48)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(white: 0.8), lineWidth: 0.5))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(d.name).foregroundStyle(.primary)
                                    Text(d.code + (d.express ? " · Express" : "")).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if d.code == current { Image(systemName: "checkmark").foregroundStyle(Brand.gold) }
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Kod albo nazwa, np. U11506, dąb, antracyt")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                if current != nil {
                    ToolbarItem(placement: .destructiveAction) {
                        Button("Usuń wybór", role: .destructive) { onPick(nil); dismiss() }
                    }
                }
            }
        }
    }
}

/// Wiersz z miniaturą wybranej płyty.
struct DecorRow: View {
    let title: String
    let decor: WardrobeDecor?
    var placeholder = "Wybierz z wzornika Pfleiderer"

    var body: some View {
        HStack(spacing: 10) {
            AsyncImage(url: PfleidererCatalog.find(decor?.code)?.imageURL) { img in img.resizable().scaledToFill() } placeholder: {
                Color(white: 0.92).overlay(Image(systemName: "square.grid.3x3").font(.caption).foregroundStyle(.secondary))
            }
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 5))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption).foregroundStyle(.secondary)
                Text(decor?.label ?? placeholder).foregroundStyle(decor == nil ? .secondary : .primary).lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
        }
    }
}
