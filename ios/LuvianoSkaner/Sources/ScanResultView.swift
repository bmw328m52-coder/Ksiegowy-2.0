import SwiftUI

func wallLetter(_ i: Int) -> String {
    i < 26 ? String(UnicodeScalar(65 + i)!) : "W\(i + 1)"
}

enum ScanViewMode: String, CaseIterable {
    case plan = "Rzut 2D", threeD = "Widok 3D", wall = "Widok ściany"
}

private enum EditTarget: Identifiable {
    case wallLength(Int), roomHeight
    case segment(Int, PlanGeom.Segment)
    case marker(ScanMarker, isNew: Bool)
    /// Odległość mebla od przeszkody (strona 0…3) / wymiar mebla (w, d, h, e).
    case objectGap(String, Int)
    case objectSize(String, String)
    /// Krzywizna ściany: klucz pola WallCurve (lb, lm, lt, hl, hm, hr).
    case curve(Int, String)
    case autoLayout
    var id: String {
        switch self {
        case .wallLength(let i): return "w\(i)"
        case .segment(let i, let s): return "s\(i)\(s.part)\(s.opening)"
        case .roomHeight: return "h"
        case .marker(let m, _): return "m" + m.id
        case .objectGap(let o, let k): return "g\(k)" + o
        case .objectSize(let o, let f): return "o" + f + o
        case .curve(let i, let k): return "c\(i)" + k
        case .autoLayout: return "auto"
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
    @State private var selectedOpening: String?
    @State private var selectedObject: String?
    @State private var tool: PlanTool = .select
    @State private var fitToken = 0
    /// Meble w widoku ściany — wybór zapamiętany na iPadzie.
    @AppStorage("elev.showObjects") private var showObjects = true
    /// Rodzaj punktu wybrany z listy kontrolnej — następne stuknięcie w ścianę go dodaje.
    @State private var pendingKind: MarkerKind?
    @State private var confirmSend = false
    @State private var undoStack: [ScanPayload] = []
    @State private var redoStack: [ScanPayload] = []
    @State private var version = 0
    @State private var sending = false
    @State private var error: String?
    @State private var notes: String
    @State private var pdf: PDFFile?
    @State private var makingPDF = false

    struct PDFFile: Identifiable { let url: URL; var id: String { url.path } }

    init(job: JobRow, saved: SavedScan, onRescan: (() -> Void)? = nil, onDone: @escaping () -> Void) {
        self.job = job
        self.onRescan = onRescan
        self.onDone = onDone
        _saved = State(initialValue: saved)
        _scan = State(initialValue: saved.scan)
        _name = State(initialValue: saved.name)
        _notes = State(initialValue: saved.scan.notes ?? "")
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
                ToolbarItem(placement: .topBarTrailing) { LaserButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { makePDF() } label: {
                        if makingPDF { ProgressView() } else { Label("PDF", systemImage: "doc.richtext") }
                    }
                    .labelStyle(.titleAndIcon)
                    .disabled(makingPDF || scan.walls.isEmpty)
                    .sheet(item: $pdf) { f in ShareSheet(url: f.url) }
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
            .onChange(of: notes) { _, _ in persist() }
            .sheet(item: $edit) { target in
                switch target {
                case .wallLength(let i):
                    MeasureSheet(title: "Ściana \(wallLetter(i))", initial: scan.walls[i].length) { v in
                        apply { PlanGeom.setLength(&$0, wall: i, to: v) }
                    }
                case .segment(let i, let seg):
                    MeasureSheet(title: "Ściana \(wallLetter(i)) · \(PlanGeom.segmentTitle(scan, wall: i, seg))",
                                 initial: PlanGeom.segmentValue(scan, wall: i, seg)) { v in
                        apply { PlanGeom.setSegment(&$0, wall: i, seg, to: v) }
                    }
                case .objectGap(let id, let side):
                    MeasureSheet(title: "\(objectLabel(id)) — odległość",
                                 initial: PlanEdit.gaps(scan, id).first { $0.side == side }?.dist ?? 0) { v in
                        apply { PlanEdit.setGap(&$0, id, side: side, to: v) }
                    }
                case .objectSize(let id, let f):
                    MeasureSheet(title: "\(objectLabel(id)) — \(Self.fieldName(f))",
                                 initial: objectValue(id, f)) { v in
                        apply { s in
                            guard let k = s.objects.firstIndex(where: { $0.id == id }), v > 0 else { return }
                            switch f {
                            case "w": s.objects[k].widthMm = v.rounded()
                            case "d": s.objects[k].depthMm = v.rounded()
                            case "h": s.objects[k].heightMm = v.rounded()
                            default: s.objects[k].elevationMm = v.rounded()
                            }
                        }
                    }
                case .curve(let i, let key):
                    let f = WallCurve.fields.first { $0.key == key }
                    MeasureSheet(title: "Ściana \(wallLetter(i)) · \(f?.group ?? "") — \(f?.name ?? "")",
                                 initial: curveValue(i, key)) { v in
                        apply { s in
                            guard s.walls.indices.contains(i), v > 0 else { return }
                            var c = s.walls[i].curve ?? WallCurve()
                            c[key] = v.rounded()
                            s.walls[i].curve = c
                        }
                    }
                case .roomHeight:
                    MeasureSheet(title: "Wysokość pomieszczenia", initial: PlanModel(scan).roomHeight) { v in
                        apply { s in
                            PlanGeom.setRoomHeight(&s, v)
                            if !(s.checks ?? []).contains("room_height") { s.checks = (s.checks ?? []) + ["room_height"] }
                        }
                    }
                case .autoLayout:
                    AutoLayoutSheet(wallCount: scan.walls.count, initialWalls: defaultAutoWalls(),
                                    autoCounts: scan.walls.indices.map { AutoLayout.autoCount(scan, wall: $0) },
                                    onRun: { ws, o in
                                        apply { _ = AutoLayout.run(&$0, walls: ws.sorted(), o) }
                                        selectedObject = nil
                                    },
                                    onClear: { ws in apply { AutoLayout.clear(&$0, walls: Array(ws)) } })
                case .marker(let mk, let isNew):
                    let wi = scan.walls.firstIndex { $0.id == mk.wallId } ?? 0
                    MarkerSheet(marker: mk, wallName: wallLetter(wi), wallLength: scan.walls[wi].length, isNew: isNew,
                                onSave: { saveMarker($0) },
                                onDelete: { deleteMarker(mk.id) })
                }
            }
        }
    }

    /// Zmiana rzutu z zapisem do „Cofnij".
    private func apply(_ f: (inout ScanPayload) -> Void) {
        snapshot()
        f(&scan)
        fixSelection()
        changed()
    }

    private func snapshot() {
        undoStack.append(scan)
        if undoStack.count > 50 { undoStack.removeFirst() }
        redoStack.removeAll()
    }

    private func undo() {
        guard let prev = undoStack.popLast() else { return }
        redoStack.append(scan)
        scan = prev
        fixSelection()
        changed()
    }

    private func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(scan)
        scan = next
        fixSelection()
        changed()
    }

    /// Po cofnięciu / usunięciu zaznaczenie może wskazywać na coś, czego już nie ma.
    private func fixSelection() {
        if let i = selected, !scan.walls.indices.contains(i) { selected = nil }
        if let id = selectedObject, !scan.objects.contains(where: { $0.id == id }) { selectedObject = nil }
        if let id = selectedOpening, !scan.openings.contains(where: { $0.id == id }) { selectedOpening = nil }
    }

    struct ObjField { let key, name: String }
    static let objectFields = [ObjField(key: "w", name: "Szerokość"), ObjField(key: "d", name: "Głębokość"),
                               ObjField(key: "h", name: "Wysokość"), ObjField(key: "e", name: "Od podłogi")]

    static func fieldName(_ f: String) -> String {
        objectFields.first { $0.key == f }?.name.lowercased() ?? ""
    }

    private func objectLabel(_ id: String) -> String {
        let c = scan.objects.first { $0.id == id }?.category ?? ""
        return scanObjectLabels[c] ?? "Obiekt"
    }

    private func objectValue(_ id: String, _ f: String) -> Double {
        guard let o = scan.objects.first(where: { $0.id == id }) else { return 0 }
        switch f {
        case "w": return o.widthMm
        case "d": return o.depthMm
        case "h": return o.heightMm
        default: return o.elevationMm
        }
    }

    /// Pomiar krzywizny albo — gdy go jeszcze nie ma — wymiar ściany jako punkt wyjścia.
    private func curveValue(_ i: Int, _ key: String) -> Double {
        guard scan.walls.indices.contains(i) else { return 0 }
        let w = scan.walls[i]
        return w.curve?[key] ?? (key.hasPrefix("l") ? w.length : w.heightMm)
    }

    private func clearCurve(_ i: Int, _ key: String) {
        apply { s in
            guard s.walls.indices.contains(i), var c = s.walls[i].curve else { return }
            c[key] = nil
            s.walls[i].curve = c.isEmpty ? nil : c
        }
    }

    private func curveSection(_ i: Int) -> some View {
        let c = scan.walls.indices.contains(i) ? scan.walls[i].curve : nil
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Krzywizny — dalmierz").font(.subheadline.weight(.medium))
                Spacer()
                if let c, c.warn {
                    Label("ponad \(Int(WallCurve.warnMm)) mm", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(Brand.gold)
                }
            }
            ForEach(["Długość", "Wysokość"], id: \.self) { group in
                HStack(spacing: 6) {
                    Text(group).font(.caption).foregroundStyle(.secondary).frame(width: 62, alignment: .leading)
                    ForEach(WallCurve.fields.filter { $0.group == group }, id: \.key) { f in
                        let v = c?[f.key]
                        Button { edit = .curve(i, f.key) } label: {
                            VStack(spacing: 0) {
                                Text(f.name).font(.caption2).foregroundStyle(.secondary)
                                Text(v.map { "\(Int($0.rounded()))" } ?? "—")
                                    .font(.caption.monospacedDigit().weight(.medium))
                                    .foregroundStyle(v == nil ? Color.secondary : PlanStyle.measured)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .contextMenu {
                            if v != nil {
                                Button("Usuń pomiar", role: .destructive) { clearCurve(i, f.key) }
                            }
                        }
                    }
                }
            }
            if let s = c?.summary {
                Text(s).font(.caption.monospacedDigit()).foregroundStyle(c?.warn == true ? Brand.gold : .secondary)
            } else {
                Text("Długość: strzel dalmierzem przy podłodze, w połowie i pod sufitem — różnica = krzywe sąsiednie ściany. Wysokość: lewo / środek / prawo — krzywa podłoga lub sufit.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func saveMarker(_ mk: ScanMarker) {
        snapshot()
        if let k = scan.markers.firstIndex(where: { $0.id == mk.id }) {
            scan.markers[k] = mk
        } else {
            scan.markers.append(mk)
        }
        selectedMarker = mk.id
        changed()
    }

    private func deleteMarker(_ id: String) {
        snapshot()
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
        // Notatki żyją poza „Cofnij" — zawsze bierzemy to, co wpisane.
        scan.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
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
                    PlanCanvas(scan: $scan, roomName: name, selected: $selected,
                               selectedObject: $selectedObject, selectedOpening: $selectedOpening,
                               tool: tool, fitToken: fitToken,
                               onTapDimension: { i in
                                   selected = i
                                   edit = .wallLength(i)
                               },
                               onTapSegment: { i, seg in
                                   selected = i
                                   selectedOpening = seg.opening
                                   edit = .segment(i, seg)
                               },
                               onTapGap: { id, side in edit = .objectGap(id, side) },
                               onEditBegan: { snapshot() },
                               onEditEnded: { changed() },
                               onWallDrawn: { i in
                                   selected = i
                                   selectedObject = nil
                                   selectedOpening = nil
                                   tool = .select
                               })
                        .overlay(alignment: .topTrailing) { planTools }
                        .overlay(alignment: .bottomTrailing) {
                            if let id = selectedObject, tool == .select {
                                Button(role: .destructive) { deleteObject(id) } label: {
                                    Label("Usuń \(objectLabel(id).lowercased())", systemImage: "trash")
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.red)
                                .padding(16)
                            }
                        }
                        .overlay(alignment: .top) {
                            if tool == .drawWall {
                                Text("Przeciągnij palcem od punktu do punktu — przyciąga do narożników, ścian i pionu/poziomu")
                                    .font(.footnote)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(.thinMaterial, in: Capsule())
                                    .padding(.top, 70)
                            }
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
        snapshot()
        withAnimation(.easeInOut(duration: 0.2)) {
            PlanGeom.rotate(&scan, clockwise: clockwise)
        }
        fitToken += 1
        changed()
    }

    private var planTools: some View {
        HStack(spacing: 8) {
            Button { undo() } label: { Image(systemName: "arrow.uturn.backward") }
                .disabled(undoStack.isEmpty)
            Button { redo() } label: { Image(systemName: "arrow.uturn.forward") }
                .disabled(redoStack.isEmpty)
            Button {
                tool = tool == .drawWall ? .select : .drawWall
                if tool == .drawWall { selectedObject = nil; selectedOpening = nil }
            } label: {
                Label(tool == .drawWall ? "Gotowe" : "Ściana", systemImage: tool == .drawWall ? "checkmark" : "plus")
            }
            .tint(tool == .drawWall ? PlanStyle.selected : Brand.ink)
            Menu {
                Button { edit = .autoLayout } label: { Label("Rozstaw szafki automatycznie…", systemImage: "wand.and.stars") }
                Divider()
                ForEach(PlanEdit.objectKinds, id: \.category) { k in
                    Button(k.label) { addObject(k) }
                }
            } label: {
                Label("Mebel", systemImage: "plus.square")
            }
            Button { rotate(clockwise: false) } label: { Image(systemName: "rotate.left") }
            Button { rotate(clockwise: true) } label: { Image(systemName: "rotate.right") }
        }
        .buttonStyle(.bordered)
        .padding(16)
    }

    /// Usunięcie mebla — z „Cofnij", więc bez dodatkowego pytania.
    private func deleteObject(_ id: String) {
        apply { s in s.objects.removeAll { $0.id == id } }
        selectedObject = nil
    }

    private func makePDF() {
        makingPDF = true
        // Klatka na pokazanie kółka — renderowanie stron idzie na wątku głównym.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(50))
            defer { makingPDF = false }
            do {
                let url = try ScanPDF.make(scan: scan, roomName: name, client: job.clients?.name ?? "", jobTitle: job.title)
                pdf = PDFFile(url: url)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func addObject(_ k: PlanEdit.ObjectKind) {
        tool = .select
        var id = ""
        apply { id = PlanEdit.addObject(&$0, k, at: PlanModel($0).center) }
        selected = nil
        selectedOpening = nil
        selectedObject = id
    }

    private var wallView: some View {
        let i = min(selected ?? 0, max(scan.walls.count - 1, 0))
        return ElevationCanvas(
            scan: scan, wallIndex: i, selectedMarker: selectedMarker,
            onTap: { t, z, hit in
                if let hit, let mk = scan.markers.first(where: { $0.id == hit }) {
                    if selectedMarker == hit { edit = .marker(mk, isNew: false) } else { selectedMarker = hit }
                } else if scan.walls.indices.contains(i) {
                    selectedMarker = nil
                    let last = pendingKind ?? scan.markers.last.map { MarkerKind(key: $0.kind) } ?? .socket
                    pendingKind = nil
                    edit = .marker(ScanMarker(kind: last.rawValue, wallId: scan.walls[i].id, offsetMm: t, heightMm: z), isNew: true)
                }
            },
            onTapLength: {
                if scan.walls.indices.contains(i) { edit = .wallLength(i) }
            },
            onTapHeight: { edit = .roomHeight },
            selectedOpening: selectedOpening,
            onSelectOpening: { selectedOpening = $0 },
            onTapSegment: { seg in
                guard scan.walls.indices.contains(i) else { return }
                selectedOpening = seg.opening
                edit = .segment(i, seg)
            },
            showObjects: showObjects
        )
            .overlay(alignment: .bottom) {
                Text(pendingKind.map { "Stuknij w ścianę tam, gdzie jest: \($0.label)" }
                     ?? "Stuknij wymiar → pomiar · okno → jego pion · ścianę → punkt instalacji")
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
                    Toggle(isOn: $showObjects) { Label("Meble", systemImage: "cabinet") }
                        .toggleStyle(.button)
                        .tint(Brand.ink)
                    Button { step(1) } label: { Image(systemName: "arrow.right") }
                }
                .buttonStyle(.bordered)
                .padding(16)
            }
            .overlay(alignment: .top) {
                if scan.walls.indices.contains(i), let c = scan.walls[i].curve, let s = c.summary {
                    Button { selected = i; mode = .plan } label: {
                        Label(s, systemImage: c.warn ? "exclamationmark.triangle.fill" : "ruler")
                            .font(.footnote.monospacedDigit())
                            .foregroundStyle(c.warn ? Brand.gold : .secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(.thinMaterial, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 66)
                }
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

            if mode == .plan { selectionCard }

            HStack(spacing: 0) {
                stat(String(format: "%.2f m²", m.areaM2), "Podłoga")
                stat(String(format: "%.2f m²", m.wallAreaM2), "Ściany")
                stat(String(format: "%.2f m", m.perimeterM), "Obwód")
                stat(String(format: "%.1f m³", m.volumeM3), "Kubatura")
            }
            .padding(.vertical, 10)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 6) {
                Text("Notatki z pomiaru").font(.footnote).foregroundStyle(.secondary)
                TextField("Ustalenia z klientem, uwagi do montażu, krzywe ściany…", text: $notes, axis: .vertical)
                    .lineLimit(3...10)
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
            }

            ChecklistCard(items: checkItems, onAction: checkAction, onToggleNone: toggleNone)

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
                    Link(destination: Config.pomiarURL(jobId: job.id)) {
                        Label("Wybory w meble-app", systemImage: "list.bullet.clipboard")
                    }
                    .buttonStyle(.bordered)
                    Button("Gotowe", action: onDone).buttonStyle(.borderedProminent).tint(Brand.ink)
                } else {
                    Button {
                        if checkItems.contains(where: { !$0.ok }) { confirmSend = true } else { Task { await send() } }
                    } label: {
                        if sending { ProgressView() } else { Text(saved.remoteId == nil ? "Wyślij do zlecenia" : "Zaktualizuj w zleceniu") }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.ink)
                    .disabled(sending || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .confirmationDialog("Pomiar niekompletny", isPresented: $confirmSend, titleVisibility: .visible) {
                        Button("Wyślij mimo to") { Task { await send() } }
                        Button("Uzupełnię", role: .cancel) {}
                    } message: {
                        Text(missingSummary())
                    }
                }
            }
        }
        .padding(20)
    }

    private var checkItems: [MeasureCheck.Item] { MeasureCheck.items(scan) }

    private func missingSummary() -> String {
        let miss = checkItems.filter { !$0.ok }
        let names = miss.prefix(4).map(\.title).joined(separator: ", ")
        return "Na liście kontrolnej brakuje \(miss.count) pozycji: \(names)\(miss.count > 4 ? "…" : "")."
    }

    private func checkAction(_ a: MeasureCheck.Action) {
        switch a {
        case .wallLength(let i):
            selected = i
            edit = .wallLength(i)
        case .segment(let i, let seg):
            selected = i
            selectedOpening = seg.opening
            edit = .segment(i, seg)
        case .roomHeight:
            edit = .roomHeight
        case .addMarker(let k):
            pendingKind = k
            selected = selected ?? 0
            mode = .wall
        case .marker(let id):
            guard let mk = scan.markers.first(where: { $0.id == id }),
                  let wi = scan.walls.firstIndex(where: { $0.id == mk.wallId }) else { return }
            selected = wi
            selectedMarker = id
            mode = .wall
            edit = .marker(mk, isNew: false)
        }
    }

    private func toggleNone(_ key: String) {
        apply { s in
            var c = s.checks ?? []
            if let k = c.firstIndex(of: key) { c.remove(at: k) } else { c.append(key) }
            s.checks = c.isEmpty ? nil : c
        }
    }

    /// Ściany do rozstawienia: zaznaczona, a jak żadnej — te z wodą / gazem / siłą.
    private func defaultAutoWalls() -> Set<Int> {
        if let i = selected, scan.walls.indices.contains(i) { return [i] }
        let kinds: Set<String> = ["water_cold", "water_hot", "drain", "gas", "power_400"]
        let ids = Set(scan.markers.filter { kinds.contains($0.kind) }.map(\.wallId))
        let ws = Set(scan.walls.indices.filter { ids.contains(scan.walls[$0].id) })
        return ws.isEmpty ? (scan.walls.isEmpty ? [] : [0]) : ws
    }

    /// Karta zaznaczonego elementu rzutu: ściana (otwory, podział, „do wybudowania") albo mebel.
    @ViewBuilder
    private var selectionCard: some View {
        if let id = selectedObject, let o = scan.objects.first(where: { $0.id == id }) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Menu {
                        ForEach(PlanEdit.objectKinds, id: \.category) { k in
                            Button(k.label) {
                                apply { s in
                                    if let i = s.objects.firstIndex(where: { $0.id == id }) { s.objects[i].category = k.category }
                                }
                            }
                        }
                    } label: {
                        Label(scanObjectLabels[o.category] ?? o.category, systemImage: "chevron.up.chevron.down")
                            .font(.headline)
                    }
                    Spacer()
                    Button { apply { PlanEdit.rotateObject(&$0, id) } } label: { Image(systemName: "rotate.right") }
                        .buttonStyle(.bordered)
                }
                ForEach(Self.objectFields, id: \.key) { f in
                    Button { edit = .objectSize(id, f.key) } label: {
                        HStack {
                            Text(f.name).foregroundStyle(.primary)
                            Spacer()
                            Text("\(Int(objectValue(id, f.key).rounded())) mm").monospacedDigit().foregroundStyle(.secondary)
                            Image(systemName: "pencil").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                Text("Przeciągnij mebel na rzucie (przyciąga do ścian i sąsiadów) · stuknij niebieską odległość, żeby ją wpisać")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button(role: .destructive) { deleteObject(id) } label: {
                    Label("Usuń mebel", systemImage: "trash").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
            .padding(14)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        } else if let i = selected, scan.walls.indices.contains(i) {
            let w = scan.walls[i]
            let spans = PlanGeom.spans(w, scan.openings)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ściana \(wallLetter(i))").font(.headline)
                    Text("\(Int(w.length.rounded())) mm").monospacedDigit().foregroundStyle(.secondary)
                    Spacer()
                    Button { edit = .autoLayout } label: { Label("Szafki", systemImage: "wand.and.stars") }
                        .buttonStyle(.bordered)
                    Button { apply { PlanEdit.splitWall(&$0, i) } } label: { Label("Podziel", systemImage: "scissors") }
                        .buttonStyle(.bordered)
                    Button(role: .destructive) {
                        apply { PlanEdit.deleteWall(&$0, i) }
                        selected = nil
                    } label: { Image(systemName: "trash") }
                        .buttonStyle(.bordered)
                }
                Toggle("Do wybudowania (jeszcze jej nie ma)", isOn: Binding(
                    get: { scan.walls.indices.contains(i) && scan.walls[i].planned == true },
                    set: { v in apply { s in if s.walls.indices.contains(i) { s.walls[i].planned = v ? true : nil } } }
                ))
                .font(.subheadline)
                curveSection(i)
                HStack {
                    Button {
                        var id: String?
                        apply { id = PlanEdit.addOpening(&$0, wall: i, kind: "window") }
                        selectedOpening = id
                    } label: { Label("Okno", systemImage: "plus") }
                    Button {
                        var id: String?
                        apply { id = PlanEdit.addOpening(&$0, wall: i, kind: "door") }
                        selectedOpening = id
                    } label: { Label("Drzwi", systemImage: "plus") }
                    Button {
                        var id: String?
                        apply { id = PlanEdit.addOpening(&$0, wall: i, kind: "opening") }
                        selectedOpening = id
                    } label: { Label("Przejście", systemImage: "plus") }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                ForEach(spans, id: \.id) { sp in
                    HStack {
                        Text(PlanGeom.openingName(sp.kind)).font(.subheadline)
                        Text("\(Int((sp.t1 - sp.t0).rounded())) × \(Int((sp.top - sp.bottom).rounded()))")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button(role: .destructive) {
                            apply { PlanEdit.deleteOpening(&$0, sp.id) }
                        } label: { Image(systemName: "trash") }
                            .buttonStyle(.borderless)
                    }
                    .padding(.vertical, 4)
                    .padding(.horizontal, 8)
                    .background(selectedOpening == sp.id ? PlanStyle.selected.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                    .contentShape(Rectangle())
                    .onTapGesture { selectedOpening = sp.id }
                }
                Text("Przeciągnij kółko = narożnik, niebieski uchwyt = cała ściana, zaznaczony otwór = wzdłuż ściany")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(14)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
        }
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
                    if let n = row.mk.photos?.count, n > 0 {
                        Label("\(n)", systemImage: "camera.fill")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
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
            if let c = w.curve, c.warn {
                Image(systemName: "exclamationmark.triangle.fill").font(.caption2).foregroundStyle(Brand.gold)
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
            // Najpierw nowe zdjęcia — skan w zleceniu nie może wskazywać na brakujące pliki.
            let wanted = scan.photoIds
            var uploaded = Set(saved.uploadedPhotos ?? [])
            for id in wanted where !uploaded.contains(id) {
                guard let data = PhotoStore.data(id) else { continue }
                try await session.uploadPhoto(id, data: data)
                uploaded.insert(id)
            }
            let id = try await session.uploadScan(jobId: job.id, name: name.trimmingCharacters(in: .whitespaces),
                                                  scan: scan, remoteId: saved.remoteId)
            // Zdjęcia usunięte z punktów — sprzątamy w Storage (błąd nie blokuje wysłania).
            let stale = uploaded.subtracting(wanted)
            if (try? await session.deletePhotos(Array(stale))) != nil { uploaded.subtract(stale) }
            saved.uploadedPhotos = Array(uploaded)
            saved.remoteId = id
            saved.synced = true
            ScanStore.save(saved)
            // Etap zlecenia — błąd nie cofa wysłanego skanu.
            try? await session.markMeasuring(jobId: job.id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
