import SwiftUI

/// Lista kontrolna pomiaru: czego brakuje, zanim wyjdziemy od klienta.
/// Wymiary potwierdzone dalmierzem/ręcznie, odcinki przy otworach, wysokość,
/// instalacje (albo potwierdzone „nie ma"), zdjęcia punktów.
enum MeasureCheck {
    enum Action {
        case wallLength(Int)
        case segment(Int, PlanGeom.Segment)
        case roomHeight
        case addMarker(MarkerKind)
        case marker(String)
    }

    struct Item: Identifiable {
        let id: String
        let group: String
        let title: String
        let detail: String
        let ok: Bool
        let action: Action?
        /// Klucz potwierdzenia „nie ma" (np. none:gas) — dla instalacji.
        let noneKey: String?
    }

    /// Instalacje, o które trzeba zapytać przy każdej kuchni.
    static let installations: [MarkerKind] = [.waterCold, .waterHot, .drain, .socket, .power400, .gas, .vent]

    static func items(_ scan: ScanPayload) -> [Item] {
        var out: [Item] = []
        let checks = Set(scan.checks ?? [])

        // Wymiary ścian.
        for (i, w) in scan.walls.enumerated() where w.planned != true {
            out.append(Item(id: "wall\(w.id)", group: "Wymiary", title: "Ściana \(wallLetter(i))",
                            detail: w.measured == true ? "\(Int(w.length.rounded())) mm · zmierzona"
                                                       : "\(Int(w.length.rounded())) mm ze skanu — potwierdź dalmierzem",
                            ok: w.measured == true, action: .wallLength(i), noneKey: nil))
        }
        out.append(Item(id: "height", group: "Wymiary", title: "Wysokość pomieszczenia",
                        detail: checks.contains("room_height") ? "\(Int(PlanModel(scan).roomHeight.rounded())) mm · zmierzona"
                                                               : "ze skanu — zmierz do sufitu",
                        ok: checks.contains("room_height"), action: .roomHeight, noneKey: nil))

        // Otwory: położenie od narożnika, szerokość, parapet, wysokość.
        for (i, w) in scan.walls.enumerated() where w.planned != true {
            for s in PlanGeom.spans(w, scan.openings) {
                var need: [(PlanGeom.Segment, String)] = [(.before(s.id), "od narożnika"), (.width(s.id), "szerokość")]
                if s.kind == "window" { need.append((.sill(s.id), "parapet")) }
                if s.top < w.heightMm - 1 { need.append((.height(s.id), "wysokość")) }
                let missing = need.filter { !s.parts.contains($0.0.part) }
                out.append(Item(id: "op\(s.id)", group: "Otwory",
                                title: "\(PlanGeom.openingName(s.kind)) · ściana \(wallLetter(i))",
                                detail: missing.isEmpty ? "\(Int((s.t1 - s.t0).rounded())) × \(Int((s.top - s.bottom).rounded())) · zmierzone"
                                                        : "brak: " + missing.map { $0.1 }.joined(separator: ", "),
                                ok: missing.isEmpty, action: missing.first.map { Action.segment(i, $0.0) }, noneKey: nil))
            }
        }

        // Instalacje.
        for k in installations {
            let n = scan.markers.filter { $0.kind == k.rawValue }.count
            let none = checks.contains("none:\(k.rawValue)")
            out.append(Item(id: "inst\(k.rawValue)", group: "Instalacje", title: k.label,
                            detail: n > 0 ? (n == 1 ? "1 punkt" : "\(n) punkty") : none ? "nie ma" : "zaznacz na ścianie albo „Nie ma”",
                            ok: n > 0 || none, action: n > 0 ? nil : Action.addMarker(k), noneKey: n > 0 ? nil : "none:\(k.rawValue)"))
        }

        // Zdjęcia punktów.
        let bare = scan.markers.filter { ($0.photos ?? []).isEmpty }
        if !scan.markers.isEmpty {
            out.append(Item(id: "photos", group: "Zdjęcia", title: "Zdjęcia punktów instalacji",
                            detail: bare.isEmpty ? "wszystkie mają zdjęcie" : "bez zdjęcia: \(bare.count) z \(scan.markers.count)",
                            ok: bare.isEmpty, action: bare.first.map { Action.marker($0.id) }, noneKey: nil))
        }
        return out
    }
}

/// Karta listy kontrolnej w panelu wyniku skanu.
struct ChecklistCard: View {
    let items: [MeasureCheck.Item]
    let onAction: (MeasureCheck.Action) -> Void
    let onToggleNone: (String) -> Void
    @State private var showAll = false

    var body: some View {
        let done = items.filter(\.ok).count
        let shown = showAll ? items : items.filter { !$0.ok }
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: done == items.count ? "checkmark.seal.fill" : "checklist")
                    .foregroundStyle(done == items.count ? .green : .orange)
                Text("Lista kontrolna").font(.headline)
                Spacer()
                Text("\(done)/\(items.count)").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(done), total: Double(max(items.count, 1)))
                .tint(done == items.count ? .green : .orange)
            if shown.isEmpty {
                Text("Pomiar kompletny — wszystko zmierzone i zaznaczone.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ForEach(groups(shown), id: \.name) { gr in
                Text(gr.name).font(.caption.weight(.semibold)).foregroundStyle(.secondary).padding(.top, 4)
                ForEach(gr.rows) { row($0) }
            }
            Button(showAll ? "Pokaż tylko braki" : "Pokaż wszystko") { showAll.toggle() }
                .font(.footnote)
                .padding(.top, 2)
        }
        .padding(14)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    struct Group { let name: String; let rows: [MeasureCheck.Item] }

    private func groups(_ rows: [MeasureCheck.Item]) -> [Group] {
        var order: [String] = []
        var by: [String: [MeasureCheck.Item]] = [:]
        for r in rows {
            if by[r.group] == nil { order.append(r.group) }
            by[r.group, default: []].append(r)
        }
        return order.map { Group(name: $0, rows: by[$0]!) }
    }

    private func row(_ it: MeasureCheck.Item) -> some View {
        HStack(spacing: 10) {
            Image(systemName: it.ok ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(it.ok ? Color.green : Color.orange)
            VStack(alignment: .leading, spacing: 1) {
                Text(it.title).font(.subheadline)
                Text(it.detail).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            Spacer()
            if let key = it.noneKey {
                Button(it.ok ? "Cofnij" : "Nie ma") { onToggleNone(key) }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            if let a = it.action {
                Button { onAction(a) } label: {
                    Text(label(a))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .tint(it.ok ? Brand.ink : .orange)
            }
        }
        .padding(.vertical, 3)
    }

    private func label(_ a: MeasureCheck.Action) -> String {
        switch a {
        case .wallLength, .segment, .roomHeight: return "Zmierz"
        case .addMarker: return "Dodaj"
        case .marker: return "Zdjęcie"
        }
    }
}

/// Ustawienia automatycznego rozstawienia szafek.
struct AutoLayoutSheet: View {
    let wallCount: Int
    let initialWalls: Set<Int>
    let autoCounts: [Int]
    let onRun: (Set<Int>, AutoLayout.Options) -> Void
    let onClear: (Set<Int>) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var walls: Set<Int> = []
    @State private var opt = AutoLayout.Options()
    @AppStorage("auto.counter") private var counter = 900.0
    @AppStorage("auto.gap") private var gap = 550.0
    @AppStorage("auto.upperH") private var upperH = 720.0
    @AppStorage("auto.lowerD") private var lowerD = 560.0
    @AppStorage("auto.upperD") private var upperD = 350.0
    @AppStorage("auto.maxW") private var maxW = 600.0

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(0..<wallCount, id: \.self) { i in
                        Toggle(isOn: Binding(get: { walls.contains(i) },
                                             set: { if $0 { walls.insert(i) } else { walls.remove(i) } })) {
                            HStack {
                                Text("Ściana \(wallLetter(i))")
                                if autoCounts[i] > 0 {
                                    Text("· \(autoCounts[i]) szafek (podmienię)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                } header: { Text("Ściany z zabudową") } footer: {
                    Text("Ściany rozstawiam po kolei — szafki z pierwszej zajmują narożnik, druga zaczyna się za nimi. Ręcznie postawione meble i sprzęty (lodówka, piekarnik…) zostają i są omijane.")
                }
                Section("Co rozstawić") {
                    Toggle("Szafki dolne", isOn: $opt.lower)
                    Toggle("Szafki górne", isOn: $opt.upper)
                    Toggle("Zlew + zmywarka przy wodzie, płyta przy gazie / 400 V", isOn: $opt.appliances)
                }
                Section {
                    num("Wysokość blatu", $counter)
                    num("Blat → szafki górne", $gap)
                    num("Wysokość szafek górnych", $upperH)
                    num("Głębokość dolnych", $lowerD)
                    num("Głębokość górnych", $upperD)
                    num("Najszerszy moduł", $maxW)
                } header: { Text("Wymiary (mm)") } footer: {
                    Text("Wolne miejsce dzielę na równe moduły nie szersze niż „najszerszy moduł” — na wymiar, do mm. Resztki poniżej 15 cm (dół) / 25 cm (góra) zostają na blendę. Nad płytą zostawiam miejsce na okap.")
                }
                let anyAuto = walls.contains { autoCounts.indices.contains($0) && autoCounts[$0] > 0 }
                if anyAuto {
                    Section {
                        Button("Usuń automatyczne szafki z zaznaczonych ścian", role: .destructive) {
                            onClear(walls)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("Rozstaw szafki")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Anuluj") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Rozstaw") {
                        var o = opt
                        o.counterMm = counter; o.gapMm = gap; o.upperHeightMm = upperH
                        o.lowerDepthMm = lowerD; o.upperDepthMm = upperD; o.maxModuleMm = max(maxW, 300)
                        onRun(walls, o)
                        dismiss()
                    }
                    .disabled(walls.isEmpty || (!opt.lower && !opt.upper))
                }
            }
            .onAppear { walls = initialWalls }
        }
    }

    private func num(_ title: String, _ v: Binding<Double>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("", value: v, format: .number.grouping(.never))
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 90)
                .textFieldStyle(.roundedBorder)
        }
    }
}
