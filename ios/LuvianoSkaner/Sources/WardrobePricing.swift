import SwiftUI

/// Stawki cennika szafek (brutto) — te same co `DEFAULT_RATES` w meble-app `src/lib/cabinetPricing.ts`.
/// Po zalogowaniu podmieniane stawkami zapisanymi w aplikacji (tabela `cabinet_pricing`),
/// trzymane w UserDefaults, żeby cena działała też bez sieci.
struct CabinetRates {
    var marginPct = 100.0
    var boardM2 = 48.0
    var boardExtraPct = 60.0
    var cutMb = 1.8
    var cutMbPerM2 = 5.6
    var edgeMb = 6.15
    var edgeExtraPct = 120.0
    var hdfM2 = 8.49
    var frontM2 = 358.0
    var frontLaminateM2 = 115.0
    var frontExtraPct = 19.0
    var hinge = 14.43
    var drawerSet = 190.0
    var handle = 13.0
    var slideLagunaDoor = 160.0
    var slideLagunaMb = 163.0
    var slideGtvDoor = 125.0
    var slideGtvMb = 104.0
    /// Zapas na skrzynię szafy skrzynkowej (2 boki + wieńce) — kuchenne 60% / 120% zawyżały cenę.
    /// Wnętrze, czyli cały szkielet, zostaje na kuchennych (ta cena zgadzała się z wyceną Zimex).
    var wardrobeBoardExtraPct = 15.0
    var wardrobeEdgeExtraPct = 25.0
    var railMb = 25.0
    var pantograph = 400.0
    var overheadPct = 4.0

    private static let storeKey = "cabinetRates"

    /// Stawki zapisane z serwera (klucze jak w meble-app) nałożone na domyślne.
    static var current: CabinetRates {
        var r = CabinetRates()
        guard let saved = UserDefaults.standard.dictionary(forKey: storeKey) else { return r }
        func v(_ k: String, _ kp: WritableKeyPath<CabinetRates, Double>) {
            if let n = saved[k] as? NSNumber, n.doubleValue >= 0 { r[keyPath: kp] = n.doubleValue }
        }
        v("margin_pct", \.marginPct)
        v("board_m2", \.boardM2)
        v("board_extra_pct", \.boardExtraPct)
        v("cut_mb", \.cutMb)
        v("cut_mb_per_m2", \.cutMbPerM2)
        v("edge_mb", \.edgeMb)
        v("edge_extra_pct", \.edgeExtraPct)
        v("hdf_m2", \.hdfM2)
        v("front_m2", \.frontM2)
        v("front_laminate_m2", \.frontLaminateM2)
        v("front_extra_pct", \.frontExtraPct)
        v("hinge", \.hinge)
        v("drawer_set", \.drawerSet)
        v("handle", \.handle)
        v("slide_laguna_door", \.slideLagunaDoor)
        v("slide_laguna_mb", \.slideLagunaMb)
        v("slide_gtv_door", \.slideGtvDoor)
        v("slide_gtv_mb", \.slideGtvMb)
        v("wardrobe_board_extra_pct", \.wardrobeBoardExtraPct)
        v("wardrobe_edge_extra_pct", \.wardrobeEdgeExtraPct)
        v("rail_mb", \.railMb)
        v("pantograph", \.pantograph)
        v("overhead_pct", \.overheadPct)
        return r
    }

    /// Zapisuje liczby ze stawek pobranych z serwera (jsonb `rates`); nil = wróć do domyślnych.
    static func store(_ rates: [String: Any]?) {
        guard let rates else {
            UserDefaults.standard.removeObject(forKey: storeKey)
            return
        }
        var out: [String: Double] = [:]
        for (k, val) in rates {
            if let n = val as? NSNumber { out[k] = n.doubleValue }
        }
        UserDefaults.standard.set(out, forKey: storeKey)
    }
}

/// System drzwi przesuwnych.
enum SlideSystem: String, CaseIterable, Identifiable {
    case laguna, gtv
    var id: String { rawValue }
    var label: String { self == .laguna ? "Laguna" : "GTV Nova S" }
}

/// Przybliżona wycena szafy — kopia `wardrobeCost` z meble-app (te same wzory, żeby ceny się zgadzały).
struct WardrobePrice {
    /// Koszt materiału brutto.
    let cost: Double
    /// Same okucia drzwi przesuwnych (rączki, ramiaki / listwy, tory, wózki); 0 przy innych drzwiach.
    let slideHardware: Double
    let marginPct: Double
    var price: Double { cost * (1 + marginPct / 100) }
    /// Cena dla klienta zaokrąglona do 100 zł.
    var rounded: Double { (price / 100).rounded() * 100 }

    static func slide(_ r: CabinetRates, _ system: SlideSystem, doors: Int, widthMm: Double) -> Double {
        let d = Double(max(doors, 0)), m = widthMm / 1000
        return system == .gtv ? d * r.slideGtvDoor + m * r.slideGtvMb : d * r.slideLagunaDoor + m * r.slideLagunaMb
    }

    private static func hingesPerDoor(_ h: Double) -> Double { h < 0.9 ? 2 : h < 1.6 ? 3 : h < 2.0 ? 4 : 5 }

    static func of(_ wd: ScanWardrobe, rates r: CabinetRates, system: SlideSystem, marginPct: Double) -> WardrobePrice {
        let W = wd.widthMm / 1000, D = wd.depthMm / 1000
        let H = max(wd.heightMm - wd.plinthMm - wd.topMm, 300) / 1000
        let sliding = wd.doors == "sliding"
        // Drzwi przesuwne zabierają ok. 100 mm głębokości wnętrza.
        let d = max(D - (sliding ? 0.1 : 0), 0.2)
        let n = Double(max(wd.sections.count, 1))
        let fixed = wd.sections.reduce(0.0) { $0 + ($1.widthMm ?? 0) } / 1000
        let free = Double(wd.sections.filter { $0.widthMm == nil }.count)
        let frame = wd.isFrame
        let paw = wd.hasPawlacz ? (wd.pawlaczMm ?? 0) / 1000 : 0

        // Wnętrze (wspólne dla szkieletu i skrzynkowej): przegrody, cokół, półka pawlacza, półki, szuflady.
        var board = (n - 1) * H * d + W * 0.1 + (paw > 0 ? W * d : 0)
        var edge = (n - 1) * H + (paw > 0 ? W : 0)
        // Skrzynia (tylko skrzynkowa): 2 boki + wieniec górny i dolny.
        let boxBoard = frame ? 0 : 2 * H * d + 2 * W * d
        let boxEdge = frame ? 0 : 2 * H + 2 * W
        var drawers = 0.0, frontM2 = 0.0, hardware = 0.0, handles = 0.0
        for sec in wd.sections {
            let sw: Double = sec.widthMm.map { $0 / 1000 } ?? max(W - fixed, 0) / max(free, 1)
            for z in sec.zones {
                var shelves = 0.0
                switch z.kind {
                case "shelves": shelves = Double(z.count ?? 4)
                case "shoes": shelves = Double(z.count ?? 3)
                case "rail":
                    shelves = 1
                    hardware += sw * r.railMb
                case "pantograph":
                    shelves = 1
                    hardware += r.pantograph
                case "drawers":
                    let c = Double(z.count ?? 3)
                    drawers += c
                    board += c * (max(sw - 0.075, 0) * 0.47 + max(sw - 0.087, 0) * 0.14)
                    edge += c * sw
                    // Czoła szuflad w szafie — z płyty, także za drzwiami przesuwnymi.
                    frontM2 += sw * (z.heightMm.map { $0 / 1000 } ?? c * 0.2)
                    handles += c
                default: break
                }
                board += shelves * sw * d
                edge += shelves * sw
            }
        }
        hardware += drawers * r.drawerSet

        let doorN = Double(max(wd.doorCount, 0))
        let doorH = H - paw
        var fronts = frontM2 * r.frontLaminateM2
        var slideCost = 0.0
        if sliding {
            // Skrzydła na pełną wysokość; wypełnienie z płyty 18 mm (materiał + cięcie, bez oklejania).
            slideCost = slide(r, system, doors: wd.doorCount, widthMm: wd.widthMm)
            hardware += slideCost
            fronts += W * H * 1.2 * (r.boardM2 + r.cutMbPerM2 * r.cutMb)
        } else if wd.doors == "hinged" {
            fronts += W * doorH * (1 + r.frontExtraPct / 100) * r.frontM2
            hardware += doorN * hingesPerDoor(doorH) * r.hinge
            handles += doorN
            if paw > 0 {
                let pd = Double(wd.pawlaczDoorCount)
                fronts += W * paw * r.frontM2
                hardware += pd * 2 * r.hinge
                handles += pd
            }
        }
        hardware += handles * r.handle

        let boardM2 = board * (1 + r.boardExtraPct / 100) + boxBoard * (1 + r.wardrobeBoardExtraPct / 100)
        let hdf = wd.hasBack ? W * H * r.hdfM2 : 0
        let sum = boardM2 * r.boardM2 + boardM2 * r.cutMbPerM2 * r.cutMb
            + (edge * (1 + r.edgeExtraPct / 100) + boxEdge * (1 + r.wardrobeEdgeExtraPct / 100)) * r.edgeMb + hdf + fronts + hardware
        return WardrobePrice(cost: sum * (1 + r.overheadPct / 100), slideHardware: slideCost, marginPct: marginPct)
    }

    static func zl(_ v: Double) -> String {
        Int(v.rounded()).formatted(.number.grouping(.automatic).locale(Locale(identifier: "pl_PL"))) + " zł"
    }
}

/// Karta „Przybliżona cena" w edytorze szafy — przelicza się przy każdej zmianie szkicu.
struct WardrobePriceCard: View {
    let wardrobe: ScanWardrobe
    /// Wybór systemu drzwi i marża są wspólne dla całej aplikacji (zostają na następną szafę).
    @AppStorage("slideSystem") private var systemKey = SlideSystem.laguna.rawValue
    /// -1 = marża z cennika.
    @AppStorage("wardrobeMarginPct") private var marginOverride = -1.0

    var body: some View {
        let rates = CabinetRates.current
        let system = SlideSystem(rawValue: systemKey) ?? .laguna
        let margin = marginOverride >= 0 ? marginOverride : rates.marginPct
        let p = WardrobePrice.of(wardrobe, rates: rates, system: system, marginPct: margin)
        VStack(alignment: .leading, spacing: 10) {
            Text("PRZYBLIŻONA CENA").font(.caption.weight(.semibold)).foregroundStyle(Brand.gold)
            Text("ok. " + WardrobePrice.zl(p.rounded)).font(.title.weight(.semibold)).monospacedDigit()
            Text("brutto · materiał \(WardrobePrice.zl(p.cost)) · marża \(Int(margin.rounded()))%")
                .font(.caption).foregroundStyle(.secondary)

            if wardrobe.doors == "sliding" {
                Picker("System drzwi", selection: $systemKey) {
                    ForEach(SlideSystem.allCases) { s in Text(s.label).tag(s.rawValue) }
                }
                .pickerStyle(.segmented)
                HStack {
                    Text("Okucia drzwi ×\(wardrobe.doorCount)")
                    Spacer()
                    Text(WardrobePrice.zl(p.slideHardware)).monospacedDigit()
                }
                .font(.subheadline)
                Text("Para drzwi na 3 m: Laguna \(WardrobePrice.zl(WardrobePrice.slide(rates, .laguna, doors: 2, widthMm: 3000))), GTV \(WardrobePrice.zl(WardrobePrice.slide(rates, .gtv, doors: 2, widthMm: 3000))). Wypełnienie z płyty — lustro / szkło osobno.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                Text("Marża").font(.subheadline)
                Spacer()
                ForEach([80.0, 100.0, 120.0], id: \.self) { m in
                    Button("\(Int(m))%") { marginOverride = m }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .tint(margin == m ? Brand.gold : .secondary)
                }
                Stepper("", value: Binding(get: { margin }, set: { marginOverride = min(max($0, 0), 300) }), in: 0...300, step: 5)
                    .labelsHidden()
            }
            if marginOverride >= 0, marginOverride != rates.marginPct {
                Button("Wróć do marży z cennika (\(Int(rates.marginPct.rounded()))%)") { marginOverride = -1 }
                    .font(.caption)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.gold.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}
