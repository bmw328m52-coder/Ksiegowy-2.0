import SwiftUI
import UIKit

/// PDF z pomiaru (A4 poziomo): rzut z wymiarami i zestawieniem, widok każdej ściany
/// z instalacjami, tabela punktów ze zdjęciami i lista kontrolna.
/// Rysunki = te same funkcje co na ekranie (PlanDraw / ElevationDraw).
@MainActor
enum ScanPDF {
    static let page = CGSize(width: 842, height: 595)

    static func make(scan: ScanPayload, roomName: String, client: String, jobTitle: String) throws -> URL {
        let header = Header(room: roomName, client: client, job: jobTitle,
                            date: Date().formatted(.dateTime.day().month(.twoDigits).year()))
        let m = PlanModel(scan)
        var pages: [AnyView] = [AnyView(PlanPage(scan: scan, model: m))]
        for i in m.walls.indices where m.walls[i].w.planned != true {
            pages.append(AnyView(WallPage(scan: scan, model: m, index: i)))
        }
        for w in scan.wardrobes {
            let wi = scan.walls.firstIndex { $0.id == w.wallId } ?? 0
            pages.append(AnyView(WardrobePage(w: w, wall: wi, conflicts: WardrobeGeom.accessConflicts(w, scan))))
        }
        let rows = markerRows(scan)
        let checks = MeasureCheck.items(scan)
        // Tabela punktów po 7 na stronę (ze zdjęciami), lista kontrolna na ostatniej.
        let chunks = stride(from: 0, to: max(rows.count, 1), by: 7).map { Array(rows[min($0, rows.count)..<min($0 + 7, rows.count)]) }
        for (k, chunk) in chunks.enumerated() {
            pages.append(AnyView(MarkersPage(rows: chunk, checks: k == chunks.count - 1 ? checks : nil)))
        }

        let safe = (client.isEmpty ? roomName : "\(client) \(roomName)")
            .components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|")).joined()
        let url = FileManager.default.temporaryDirectory.appending(path: "Pomiar \(safe).pdf")
        var box = CGRect(origin: .zero, size: page)
        guard let pdf = CGContext(url as CFURL, mediaBox: &box, nil) else {
            throw NSError(domain: "pdf", code: 1, userInfo: [NSLocalizedDescriptionKey: "Nie udało się utworzyć PDF"])
        }
        for (n, content) in pages.enumerated() {
            let view = PageFrame(header: header, number: n + 1, total: pages.count) { content }
            let r = ImageRenderer(content: view.frame(width: page.width, height: page.height))
            r.render { _, draw in
                pdf.beginPDFPage(nil)
                draw(pdf)
                pdf.endPDFPage()
            }
        }
        pdf.closePDF()
        return url
    }

    struct Header { let room, client, job, date: String }

    struct MarkerRow { let mk: ScanMarker; let wall: Int }

    static func markerRows(_ scan: ScanPayload) -> [MarkerRow] {
        scan.markers
            .compactMap { mk in scan.walls.firstIndex { $0.id == mk.wallId }.map { MarkerRow(mk: mk, wall: $0) } }
            .sorted { ($0.wall, $0.mk.offsetMm) < ($1.wall, $1.mk.offsetMm) }
    }

    /// Miniatura zdjęcia — pełne 2048 px rozdęłoby PDF.
    static func thumb(_ id: String) -> UIImage? {
        guard let data = PhotoStore.data(id), let img = UIImage(data: data) else { return nil }
        let k = min(1, 360 / max(img.size.width, img.size.height, 1))
        let size = CGSize(width: (img.size.width * k).rounded(), height: (img.size.height * k).rounded())
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: fmt).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
        return small.jpegData(compressionQuality: 0.7).flatMap(UIImage.init(data:))
    }
}

// MARK: - Strony

private struct PageFrame<Content: View>: View {
    let header: ScanPDF.Header
    let number, total: Int
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("LUVIANO").font(.system(size: 15, weight: .semibold)).tracking(3).foregroundStyle(Brand.ink)
                Text("Pomiar").font(.system(size: 11)).foregroundStyle(Brand.gold)
                Spacer()
                Text([header.client, header.job, header.room].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.ink)
                Text(header.date).font(.system(size: 10).monospacedDigit()).foregroundStyle(.secondary)
            }
            .padding(.bottom, 6)
            Rectangle().fill(Brand.gold).frame(height: 1)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.top, 10)
            HStack {
                Text("Wymiary w mm · niebieskie z kłódką = zmierzone dalmierzem, pozostałe ze skanu LiDAR (±2–5 cm)")
                Spacer()
                Text("\(number) / \(total)").monospacedDigit()
            }
            .font(.system(size: 8))
            .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 22)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }
}

private struct PlanPage: View {
    let scan: ScanPayload
    let model: PlanModel

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Canvas { ctx, size in
                let pts = model.walls.flatMap { [$0.w.a, $0.w.b] } + model.floor
                let L = PlanLayout(points: pts, size: size, margin: 70)
                PlanDraw.draw(ctx, model, L, roomName: "", selected: nil)
            }
            .background(PlanStyle.canvas)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 10) {
                PDFSection(title: "Pomieszczenie") {
                    KV("Podłoga", String(format: "%.2f m²", model.areaM2))
                    KV("Ściany", String(format: "%.2f m²", model.wallAreaM2))
                    KV("Obwód", String(format: "%.2f m", model.perimeterM))
                    KV("Kubatura", String(format: "%.1f m³", model.volumeM3))
                    KV("Wysokość", "\(Int(model.roomHeight.rounded())) mm",
                       measured: (scan.checks ?? []).contains("room_height"))
                }
                PDFSection(title: "Ściany") {
                    ForEach(Array(scan.walls.enumerated()), id: \.offset) { i, w in
                        KV("\(wallLetter(i))\(w.planned == true ? " (do wybudowania)" : "")",
                           "\(Int(w.length.rounded())) mm", measured: w.measured == true)
                        if let s = w.curve?.summary {
                            Text(s).font(.system(size: 8).monospacedDigit())
                                .foregroundStyle(w.curve?.warn == true ? Brand.gold : .secondary)
                        }
                    }
                }
                if let n = scan.notes?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty {
                    PDFSection(title: "Notatki z pomiaru") {
                        Text(n).font(.system(size: 10)).foregroundStyle(Brand.ink).lineLimit(14)
                    }
                }
                let skew = model.skewedCorners()
                if !skew.isEmpty {
                    PDFSection(title: "Narożniki ≠ 90° (ze skanu)") {
                        ForEach(skew, id: \.wall) { c in
                            KV("\(wallLetter(c.wall)) / \(wallLetter(model.walls[c.wall].next ?? 0))",
                               String(format: "%.1f°", c.angle).replacingOccurrences(of: ".", with: ","))
                        }
                    }
                }
                let ops = openingRows
                if !ops.isEmpty {
                    PDFSection(title: "Okna i drzwi") {
                        ForEach(ops, id: \.id) { o in
                            KV(o.name, o.value, measured: o.measured)
                        }
                    }
                }
            }
            .frame(width: 230)
        }
    }

    private struct OpRow { let id, name, value: String; let measured: Bool }

    private var openingRows: [OpRow] {
        model.walls.enumerated().flatMap { i, g in
            g.spans.map { s in
                var v = "\(Int((s.t1 - s.t0).rounded())) × \(Int((s.top - s.bottom).rounded()))"
                if s.kind == "window" {
                    v += " · par. \(Int(s.bottom.rounded()))"
                    if let d = s.sillDepth { v += " wys. \(Int(d.rounded()))" }
                    if let t = s.sillThickness { v += " gr. \(Int(t.rounded()))" }
                }
                return OpRow(id: s.id, name: "\(PlanGeom.openingName(s.kind)) \(wallLetter(i))", value: v,
                             measured: s.parts.contains("width"))
            }
        }
    }
}

private struct WallPage: View {
    let scan: ScanPayload
    let model: PlanModel
    let index: Int

    var body: some View {
        let g = model.walls[index]
        let markers = scan.markers.filter { $0.wallId == g.w.id }
        let features = scan.features.filter { $0.wallId == g.w.id }.sorted { $0.offsetMm < $1.offsetMm }
        VStack(alignment: .leading, spacing: 8) {
            Text("Ściana \(wallLetter(index)) — \(Int(g.len.rounded())) × \(Int(g.w.heightMm.rounded())) mm")
                .font(.system(size: 14, weight: .semibold))
            if let c = g.w.curve, let s = c.summary {
                Text("Krzywizny: " + s)
                    .font(.system(size: 10, weight: .medium).monospacedDigit())
                    .foregroundStyle(c.warn ? Brand.gold : Brand.ink)
            }
            Canvas { ctx, size in
                guard let L = ElevLayout(size, g) else { return }
                ElevationDraw.draw(ctx, L, g, markers: markers, selected: nil,
                                   active: ElevationDraw.activeSpan(g, nil)?.id,
                                   objects: ElevationDraw.objectsOnWall(scan, g),
                                   features: features)
            }
            .background(PlanStyle.canvas)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            ForEach(features) { f in
                let k = FeatureKind(key: f.kind)
                Text("\(k.label): \(Int(f.widthMm.rounded()))×\(Int(f.heightMm.rounded())) mm, \(Int(f.offsetMm.rounded())) od lewej, \(Int(f.elevationMm.rounded())) od podłogi, "
                     + (f.flush ? "w licu ściany" : "wystaje \(Int(f.depthMm.rounded())) mm")
                     + (f.access == true ? " — WYMAGANY DOSTĘP" : "") + (f.note.map { " · \($0)" } ?? ""))
                    .font(.system(size: 9, weight: f.access == true ? .semibold : .regular).monospacedDigit())
                    .foregroundStyle(f.access == true ? FeatureDraw.accessColor : Brand.ink)
                    .lineLimit(1)
            }
            if !markers.isEmpty {
                Text(markers.sorted { $0.offsetMm < $1.offsetMm }.map {
                    "\(MarkerKind(key: $0.kind).label) \(Int($0.offsetMm.rounded()))/\(Int($0.heightMm.rounded()))"
                }.joined(separator: "  ·  "))
                .font(.system(size: 9).monospacedDigit())
                .foregroundStyle(.secondary)
                .lineLimit(2)
            }
        }
    }
}

private struct MarkersPage: View {
    let rows: [ScanPDF.MarkerRow]
    let checks: [MeasureCheck.Item]?

    var body: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Instalacje").font(.system(size: 14, weight: .semibold))
                Text("Położenie: od lewego narożnika ściany (patrząc na nią) / od podłogi")
                    .font(.system(size: 9)).foregroundStyle(.secondary)
                if rows.isEmpty {
                    Text("Brak zaznaczonych punktów.").font(.system(size: 11)).foregroundStyle(.secondary)
                }
                ForEach(rows, id: \.mk.id) { r in
                    let k = MarkerKind(key: r.mk.kind)
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: k.symbol)
                            .font(.system(size: 9))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(k.color, in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(k.label).font(.system(size: 11, weight: .medium))
                            Text("Ściana \(wallLetter(r.wall)) · \(Int(r.mk.offsetMm.rounded())) od lewej · \(Int(r.mk.heightMm.rounded())) od podłogi")
                                .font(.system(size: 10).monospacedDigit())
                                .foregroundStyle(.secondary)
                            if let n = r.mk.note, !n.isEmpty {
                                Text(n).font(.system(size: 10)).lineLimit(2)
                            }
                        }
                        .frame(width: 200, alignment: .leading)
                        HStack(spacing: 4) {
                            ForEach((r.mk.photos ?? []).prefix(4), id: \.self) { id in
                                if let img = ScanPDF.thumb(id) {
                                    Image(uiImage: img)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 64, height: 48)
                                        .clipShape(RoundedRectangle(cornerRadius: 3))
                                }
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 4)
                    Divider()
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)

            if let checks {
                VStack(alignment: .leading, spacing: 4) {
                    let miss = checks.filter { !$0.ok }
                    Text("Lista kontrolna").font(.system(size: 14, weight: .semibold))
                    Text(miss.isEmpty ? "Pomiar kompletny" : "Do uzupełnienia: \(miss.count) z \(checks.count)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(miss.isEmpty ? Color.green : Brand.gold)
                        .padding(.bottom, 4)
                    // Najpierw braki; strona mieści ~30 pozycji.
                    let shown = Array((miss + checks.filter(\.ok)).prefix(30))
                    ForEach(shown) { c in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: c.ok ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 9))
                                .foregroundStyle(c.ok ? Color.green : Color.secondary)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(c.title).font(.system(size: 9, weight: .medium))
                                Text(c.detail).font(.system(size: 8)).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if checks.count > shown.count {
                        Text("…i \(checks.count - shown.count) zaliczonych").font(.system(size: 8)).foregroundStyle(.secondary)
                    }
                }
                .frame(width: 250, alignment: .topLeading)
            }
        }
    }
}

private struct WardrobePage: View {
    let w: ScanWardrobe
    let wall: Int
    let conflicts: [(feature: ScanFeature, section: Int?)]

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Szafa — ściana \(wallLetter(wall)) · \(Int(w.widthMm.rounded())) × \(Int(w.heightMm.rounded())) × \(Int(w.depthMm.rounded())) mm")
                    .font(.system(size: 14, weight: .semibold))
                Canvas { ctx, size in
                    let m = 54.0
                    let SW = Double(size.width), SH = Double(size.height)
                    let s: Double = max(0.01, min((SW - 2 * m) / max(w.widthMm, 1), (SH - 2 * m) / max(w.heightMm, 1)))
                    let x0: Double = (SW - w.widthMm * s) / 2
                    let yb: Double = (SH + w.heightMm * s) / 2
                    let p: (Double, Double) -> CGPoint = { CGPoint(x: x0 + $0 * s, y: yb - $1 * s) }
                    WardrobeDraw.draw(ctx, w, s: s, p: p)
                    Draft.dimension(ctx, p(0, 0), p(w.widthMm, 0), out: CGVector(dx: 0, dy: 1), off: 26,
                                    text: "\(Int(w.widthMm.rounded()))", color: PlanStyle.wall, bg: .white)
                    Draft.dimension(ctx, p(0, 0), p(0, w.heightMm), out: CGVector(dx: -1, dy: 0), off: 28,
                                    text: "\(Int(w.heightMm.rounded()))", color: PlanStyle.wall, bg: .white)
                    for sec in WardrobeGeom.sections(w) where (sec.t1 - sec.t0) * s > 26 {
                        Draft.dimension(ctx, p(sec.t0, w.heightMm), p(sec.t1, w.heightMm), out: CGVector(dx: 0, dy: -1), off: 18,
                                        text: "\(Int((sec.t1 - sec.t0).rounded()))", color: PlanStyle.dim, bg: .white)
                    }
                }
                .background(Color(white: 0.985))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 10) {
                PDFSection(title: "Korpus") {
                    KV("Od lewego narożnika", "\(Int(w.offsetMm.rounded())) mm")
                    KV("Cokół", "\(Int(w.plinthMm.rounded())) mm")
                    KV("Blenda górna", "\(Int(w.topMm.rounded())) mm")
                    KV("Fronty", w.doorsLabel)
                }
                ForEach(WardrobeGeom.sections(w), id: \.index) { sec in
                    PDFSection(title: "Sekcja \(sec.index + 1) · \(Int((sec.t1 - sec.t0).rounded())) mm") {
                        ForEach(sec.zones.reversed(), id: \.index) { zn in
                            KV(zn.kind.hasCount && zn.count > 1 ? "\(zn.kind.label) ×\(zn.count)" : zn.kind.label,
                               "\(Int((zn.z1 - zn.z0).rounded())) mm")
                        }
                    }
                }
                if !conflicts.isEmpty {
                    PDFSection(title: "Wymagany dostęp") {
                        ForEach(conflicts, id: \.feature.id) { c in
                            Text("\(FeatureKind(key: c.feature.kind).label)" + (c.section.map { " — sekcja \($0 + 1)" } ?? ""))
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(FeatureDraw.accessColor)
                        }
                    }
                }
                if let n = w.note, !n.isEmpty {
                    PDFSection(title: "Uwagi") { Text(n).font(.system(size: 10)) }
                }
            }
            .frame(width: 220)
        }
    }
}

// MARK: - Drobne elementy

private struct PDFSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased())
                .font(.system(size: 8, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Brand.gold)
            content
        }
    }
}

private struct KV: View {
    let k, v: String
    var measured = false
    init(_ k: String, _ v: String, measured: Bool = false) { self.k = k; self.v = v; self.measured = measured }

    var body: some View {
        HStack(spacing: 4) {
            Text(k).foregroundStyle(Brand.ink)
            Spacer(minLength: 6)
            Text(v).monospacedDigit().foregroundStyle(measured ? PlanStyle.measured : Brand.ink)
            if measured { Image(systemName: "lock.fill").font(.system(size: 6)).foregroundStyle(PlanStyle.measured) }
        }
        .font(.system(size: 10))
    }
}

/// Arkusz udostępniania (Mail, WhatsApp, Pliki, AirDrop, drukowanie).
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
