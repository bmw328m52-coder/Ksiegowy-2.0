import SwiftUI

func wallLetter(_ i: Int) -> String {
    i < 26 ? String(UnicodeScalar(65 + i)!) : "W\(i + 1)"
}

enum ScanViewMode: String, CaseIterable {
    case plan = "Rzut 2D", threeD = "Widok 3D", wall = "Widok ściany"
}

private enum EditTarget: Identifiable {
    case wallLength(Int), roomHeight
    case marker(ScanMarker, isNew: Bool)
    var id: String {
        switch self {
        case .wallLength(let i): return "w\(i)"
        case .roomHeight: return "h"
        case .marker(let m, _): return "m" + m.id
        }
    }
}

/// Wynik skanu w układzie MagicPlan: duży rysunek + panel boczny.
struct ScanResultView: View {
    let job: JobRow
    /// Tylko zaraz po skanie (z zapisanego skanu nie ma czego powtarzać).
    let onRescan: (() -> Void)?
    let onDone: () -> Void

    @EnvironmentObject private var session: Session
    @State private var saved: SavedScan
    @State private var scan: ScanPayload
    @State private var name: String
    @State private var mode: ScanViewMode = .plan
    @State private var selected: Int?
    @State private var edit: EditTarget?
    @State private var selectedMarker: String?
    @State private var version = 0
    @State private var sending = false
    @State private var error: String?

    init(job: JobRow, saved: SavedScan, onRescan: (() -> Void)? = nil, onDone: @escaping () -> Void) {
        self.job = job
        self.onRescan = onRescan
        self.onDone = onDone
        _saved = State(initialValue: saved)
        _scan = State(initialValue: saved.scan)
        _name = State(initialValue: saved.name)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geo in
                if geo.size.width > 900 {
                    HStack(spacing: 0) {
                        canvas
                        Divider()
                        ScrollView { panel }
                            .frame(width: 390)
                            .background(Color(.systemGroupedBackground))
                    }
                } else {
                    VStack(spacing: 0) {
                        canvas
                        Divider()
                        ScrollView { panel }
                            .frame(height: geo.size.height * 0.45)
                            .background(Color(.systemGroupedBackground))
                    }
                }
            }
            .navigationTitle(job.clients?.name ?? job.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { onDone() } label: { Label("Skany", systemImage: "chevron.left").labelStyle(.titleAndIcon) }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Label(saved.synced ? "W zleceniu" : "Zapisano na iPadzie",
                          systemImage: saved.synced ? "checkmark.icloud" : "ipad")
                        .labelStyle(.titleAndIcon)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .onChange(of: name) { _, _ in persist() }
            .sheet(item: $edit) { target in
                switch target {
                case .wallLength(let i):
                    MeasureSheet(title: "Ściana \(wallLetter(i))", initial: scan.walls[i].length) { v in
                        PlanGeom.setLength(&scan, wall: i, to: v)
                        changed()
                    }
                case .roomHeight:
                    MeasureSheet(title: "Wysokość pomieszczenia", initial: PlanModel(scan).roomHeight) { v in
                        PlanGeom.setRoomHeight(&scan, v)
                        changed()
                    }
                case .marker(let mk, let isNew):
                    let wi = scan.walls.firstIndex { $0.id == mk.wallId } ?? 0
                    MarkerSheet(marker: mk, wallName: wallLetter(wi), wallLength: scan.walls[wi].length, isNew: isNew,
                                onSave: { saveMarker($0) },
                                onDelete: { deleteMarker(mk.id) })
                }
            }
        }
    }

    private func saveMarker(_ mk: ScanMarker) {
        if let k = scan.markers.firstIndex(where: { $0.id == mk.id }) {
            scan.markers[k] = mk
        } else {
            scan.markers.append(mk)
        }
        selectedMarker = mk.id
        changed()
    }

    private func deleteMarker(_ id: String) {
        scan.markers.removeAll { $0.id == id }
        if selectedMarker == id { selectedMarker = nil }
        changed()
    }

    private func changed() {
        version += 1
        persist()
    }

    /// Zapis na iPadzie po każdej zmianie — wyjście ze skanu niczego nie gubi.
    private func persist() {
        saved.scan = scan
        saved.name = name
        saved.synced = false
        saved.updatedAt = Date()
        ScanStore.save(saved)
    }

    private var canvas: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                switch mode {
                case .plan:
                    PlanCanvas(scan: scan, roomName: name, selected: selected) { selected = $0 }
                        .overlay(alignment: .topTrailing) {
                            HStack(spacing: 8) {
                                Button { rotate(clockwise: false) } label: { Image(systemName: "rotate.left") }
                                Button { rotate(clockwise: true) } label: { Image(systemName: "rotate.right") }
                            }
                            .buttonStyle(.bordered)
                            .padding(16)
                        }
                case .threeD:
                    Scan3DView(scan: scan).id(version)
                case .wall:
                    wallView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Picker("Widok", selection: $mode) {
                ForEach(ScanViewMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 380)
            .padding(16)
        }
    }

    private func rotate(clockwise: Bool) {
        withAnimation(.easeInOut(duration: 0.2)) {
            PlanGeom.rotate(&scan, clockwise: clockwise)
        }
        changed()
    }

    private var wallView: some View {
        let i = min(selected ?? 0, max(scan.walls.count - 1, 0))
        return ElevationCanvas(scan: scan, wallIndex: i, selectedMarker: selectedMarker) { t, z, hit in
            if let hit, let mk = scan.markers.first(where: { $0.id == hit }) {
                if selectedMarker == hit { edit = .marker(mk, isNew: false) } else { selectedMarker = hit }
            } else if scan.walls.indices.contains(i) {
                selectedMarker = nil
                let last = scan.markers.last.map { MarkerKind(key: $0.kind) } ?? .socket
                edit = .marker(ScanMarker(kind: last.rawValue, wallId: scan.walls[i].id, offsetMm: t, heightMm: z), isNew: true)
            }
        }
            .overlay(alignment: .bottom) {
                Text("Stuknij na ścianie, żeby dodać punkt instalacji · stuknij punkt dwa razy, żeby go edytować")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.thinMaterial, in: Capsule())
                    .padding(.bottom, 70)
            }
            .overlay(alignment: .top) {
                HStack {
                    Button { step(-1) } label: { Image(systemName: "arrow.left") }
                    Spacer()
                    Text("Ściana \(wallLetter(i))").font(.headline)
                    Spacer()
                    Button { step(1) } label: { Image(systemName: "arrow.right") }
                }
                .buttonStyle(.bordered)
                .padding(16)
            }
    }

    private func step(_ d: Int) {
        let n = scan.walls.count
        guard n > 0 else { return }
        selected = ((selected ?? 0) + d + n) % n
    }

    private var panel: some View {
        let m = PlanModel(scan)
        let windows = scan.openings.filter { $0.kind == "window" }.count
        let doors = scan.openings.filter { $0.kind == "door" }.count
        return VStack(alignment: .leading, spacing: 18) {
            HStack {
                TextField("Nazwa pomieszczenia", text: $name)
                    .font(.title3.weight(.semibold))
                    .textFieldStyle(.roundedBorder)
                Menu {
                    ForEach(["Kuchnia", "Kuchnia z jadalnią", "Salon z aneksem", "Jadalnia", "Spiżarnia",
                             "Pralnia", "Garderoba", "Łazienka", "Przedpokój", "Sypialnia"], id: \.self) { t in
                        Button(t) { name = t }
                    }
                } label: {
                    Image(systemName: "list.bullet").padding(10)
                }
                .buttonStyle(.bordered)
            }

            HStack(spacing: 0) {
                stat(String(format: "%.2f m²", m.areaM2), "Podłoga")
                stat(String(format: "%.2f m²", m.wallAreaM2), "Ściany")
                stat(String(format: "%.2f m", m.perimeterM), "Obwód")
                stat(String(format: "%.1f m³", m.volumeM3), "Kubatura")
            }
            .padding(.vertical, 10)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

            Button { edit = .roomHeight } label: {
                HStack {
                    Text("Wysokość pomieszczenia").foregroundStyle(.primary)
                    Spacer()
                    Text("\(Int(m.roomHeight.rounded())) mm").monospacedDigit().foregroundStyle(.secondary)
                    Image(systemName: "pencil").foregroundStyle(.secondary)
                }
                .padding(14)
                .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 0) {
                Text("Ściany — „Wymiar” wpisuje pomiar z dalmierza")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 6)
                ForEach(Array(scan.walls.enumerated()), id: \.offset) { i, w in
                    wallRow(i, w)
                }
            }

            markersSection

            Text("Okna: \(windows) · Drzwi: \(doors) · Sprzęty: \(scan.objects.count)")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let error {
                Text(error).foregroundStyle(.red).font(.footnote)
            }
            if saved.synced {
                Label("Aktualne w zleceniu", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.headline)
            } else if saved.remoteId != nil {
                Text("Zmiany od ostatniego wysłania są tylko na iPadzie.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            HStack {
                if let onRescan {
                    Button("Skanuj ponownie", action: onRescan).buttonStyle(.bordered)
                }
                Spacer()
                if saved.synced {
                    Button("Gotowe", action: onDone).buttonStyle(.borderedProminent).tint(Brand.ink)
                } else {
                    Button {
                        Task { await send() }
                    } label: {
                        if sending { ProgressView() } else { Text(saved.remoteId == nil ? "Wyślij do zlecenia" : "Zaktualizuj w zleceniu") }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.ink)
                    .disabled(sending || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .padding(20)
    }

    private var markersSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Instalacje").font(.footnote).foregroundStyle(.secondary)
                Spacer()
                Button {
                    selected = selected ?? 0
                    mode = .wall
                } label: {
                    Label("Dodaj punkt", systemImage: "plus")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(scan.walls.isEmpty)
            }
            if scan.markers.isEmpty {
                Text("Woda, odpływ, gniazdka, gaz, wentylacja — dodaj w widoku ściany.")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            }
            ForEach(markerRows, id: \.mk.id) { row in
                let k = MarkerKind(key: row.mk.kind)
                HStack(spacing: 10) {
                    Image(systemName: k.symbol)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(k.color, in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(k.label).font(.subheadline)
                        Text("Ściana \(wallLetter(row.wall)) · \(Int(row.mk.offsetMm.rounded())) od lewej · \(Int(row.mk.heightMm.rounded())) od podłogi")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                        if let note = row.mk.note {
                            Text(note).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 10)
                .background(selectedMarker == row.mk.id ? PlanStyle.selected.opacity(0.1) : Color(.systemBackground),
                            in: RoundedRectangle(cornerRadius: 10))
                .contentShape(Rectangle())
                .onTapGesture {
                    selected = row.wall
                    selectedMarker = row.mk.id
                    if mode == .wall { edit = .marker(row.mk, isNew: false) } else { mode = .wall }
                }
            }
        }
    }

    /// Punkty posortowane po ścianie i odległości (kolejność obchodu pomieszczenia).
    private var markerRows: [(mk: ScanMarker, wall: Int)] {
        scan.markers
            .compactMap { mk in scan.walls.firstIndex { $0.id == mk.wallId }.map { (mk: mk, wall: $0) } }
            .sorted { ($0.wall, $0.mk.offsetMm) < ($1.wall, $1.mk.offsetMm) }
    }

    private func wallRow(_ i: Int, _ w: ScanWall) -> some View {
        let locked = w.measured == true
        return HStack {
            Text(wallLetter(i)).bold().frame(width: 26, alignment: .leading)
            Text("\(Int(w.length.rounded())) mm")
                .foregroundStyle(locked ? PlanStyle.measured : Color.primary)
            if locked {
                Image(systemName: "lock.fill").font(.caption2).foregroundStyle(PlanStyle.measured)
            }
            Spacer()
            Button("Wymiar") {
                selected = i
                edit = .wallLength(i)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            Button {
                selected = i
                mode = .wall
            } label: {
                Image(systemName: "rectangle.portrait")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .font(.subheadline.monospacedDigit())
        .padding(.vertical, 7)
        .padding(.horizontal, 10)
        .background(selected == i ? PlanStyle.selected.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
        .contentShape(Rectangle())
        .onTapGesture { selected = i }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func send() async {
        sending = true
        defer { sending = false }
        do {
            let id = try await session.uploadScan(jobId: job.id, name: name.trimmingCharacters(in: .whitespaces),
                                                  scan: scan, remoteId: saved.remoteId)
            saved.remoteId = id
            saved.synced = true
            ScanStore.save(saved)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
