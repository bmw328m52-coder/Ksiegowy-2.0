import type { ProjectType } from "./dao/job_checklist.types";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "radio"
  | "select";

export type FieldOption = { value: string; label: string };

export type BriefField = {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  unit?: string;
  placeholder?: string;
  help?: string;
};

export type BriefGroup = {
  title: string;
  fields: BriefField[];
};

export type BriefSchema = {
  groups: BriefGroup[];
};

const KITCHEN: BriefSchema = {
  groups: [
    {
      title: "Pomieszczenie",
      fields: [
        { key: "room_layout", label: "Układ", type: "radio", options: [
          { value: "lin", label: "Liniowa" },
          { value: "l", label: "Litera L" },
          { value: "u", label: "Litera U" },
          { value: "wneka", label: "Wnęka / alkowa (środkowa + 2 boczne)" },
          { value: "kwadrat", label: "Kwadrat / prostokąt (4 ściany)" },
        ]},
        { key: "has_island", label: "Wyspa (dodatkowo, niezależnie od układu)", type: "checkbox" },
        { key: "wall_type", label: "Rodzaj ściany", type: "radio", options: [
          { value: "murowana", label: "Murowana" },
          { value: "kg", label: "Karton-gips" },
          { value: "mieszana", label: "Mieszana" },
        ]},
        { key: "window_wall", label: "Okno na ścianie", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
          { value: "d", label: "D" },
        ]},
        { key: "wall_a_mm", label: "Ściana A — długość", type: "number", unit: "mm" },
        { key: "wall_b_mm", label: "Ściana B — długość", type: "number", unit: "mm" },
        { key: "wall_c_mm", label: "Ściana C — długość (U / wnęka / kwadrat, ścianka prawa)", type: "number", unit: "mm" },
        { key: "wall_d_mm", label: "Ściana D — długość (kwadrat, ścianka dolna)", type: "number", unit: "mm" },
        { key: "ceiling_mm", label: "Wysokość pomieszczenia", type: "number", unit: "mm" },
        { key: "window_sill_height_mm", label: "Wysokość okna od podłogi (do parapetu)", type: "number", unit: "mm" },
        { key: "window_sill_thickness_mm", label: "Grubość parapetu", type: "number", unit: "mm" },
        { key: "window_frame_height_mm", label: "Wysokość do otwartego skrzydła (od podłogi)", type: "number", unit: "mm" },
        { key: "window_width_mm", label: "Szerokość wnęki okiennej", type: "number", unit: "mm" },
        { key: "wall_above_window_mm", label: "Wysokość ściany nad oknem", type: "number", unit: "mm", help: "od górnej krawędzi ramy do sufitu" },
        { key: "wall_left_of_window_mm", label: "Ściana od lewej krawędzi okna", type: "number", unit: "mm" },
        { key: "wall_right_of_window_mm", label: "Ściana od prawej krawędzi okna", type: "number", unit: "mm" },
        { key: "vent_room_count", label: "Kratki wentylacji pomieszczenia (sztuk)", type: "number", unit: "szt" },
        { key: "vent_room_notes", label: "Wentylacja pomieszczenia — położenie / wymiary kratek", type: "text", placeholder: "np. nad oknem 14×14, pod sufitem ściana A" },
        { key: "vent_hood_carbon", label: "Kratka wywiewu okapu (gdy filtry węglowe / obieg)", type: "checkbox" },
        { key: "vent_fridge_builtin", label: "Kratki wentylacji lodówki do zabudowy (2 szt — góra + dół cokołu)", type: "checkbox", help: "wymagane przy lodówce do zabudowy — minimum 2 kratki dla cyrkulacji" },
        { key: "vent_fridge_notes", label: "Wentylacja lodówki — uwagi (wymiary, lokalizacja)", type: "text", placeholder: "np. cokół 100×100 + szafka 100×600" },
        { key: "room_notes", label: "Uwagi do pomiaru (kominy, instalacje)", type: "textarea" },
      ],
    },
    {
      title: "Przyłącza i instalacje",
      fields: [
        { key: "plumbing_wall", label: "Woda + kanalizacja — ściana", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
          { value: "d", label: "D" },
        ]},
        { key: "plumbing_offset_mm", label: "Wodno-kan. — odległość od lewego narożnika ściany", type: "number", unit: "mm" },
        { key: "plumbing_height_mm", label: "Wodno-kan. — wysokość od podłogi", type: "number", unit: "mm", help: "wysokość środka pola przyłączy" },
        { key: "plumbing_width_mm", label: "Wodno-kan. — szerokość zajmowanego pola", type: "number", unit: "mm", help: "łączny obszar przyłączy: zimna + ciepła + odpływ" },
        { key: "gas_wall", label: "Gaz — ściana (jeśli)", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
          { value: "d", label: "D" },
        ]},
        { key: "gas_offset_mm", label: "Gaz — odległość od lewego narożnika ściany", type: "number", unit: "mm" },
        { key: "gas_height_mm", label: "Gaz — wysokość od podłogi", type: "number", unit: "mm" },
        { key: "vent_chimney_wall", label: "Komin wentylacyjny — ściana", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
          { value: "d", label: "D" },
        ]},
        { key: "vent_chimney_offset_mm", label: "Komin — odległość od lewego narożnika ściany", type: "number", unit: "mm" },
        { key: "vent_chimney_height_mm", label: "Komin — wysokość wlotu od podłogi", type: "number", unit: "mm" },
        { key: "vent_chimney_width_mm", label: "Komin — szerokość zajmowanego pola", type: "number", unit: "mm", help: "głębokość/szerokość kanału w bryle ściany" },
        { key: "vent_chimney_depth_mm", label: "Komin — głębokość wystawania ze ściany", type: "number", unit: "mm", help: "0 = w licu ściany; >0 = występ" },
        { key: "utilities_notes", label: "Przyłącza — uwagi", type: "textarea", placeholder: "wszystko nietypowe: liczniki, zasuwy, zawory, przyłącza w podłodze" },
      ],
    },
    {
      title: "Korpusy",
      fields: [
        { key: "corpus_color", label: "Kolor korpusu (kod / dekor)", type: "text" },
        { key: "corpus_height_mm", label: "Wysokość korpusu (dolnego)", type: "number", unit: "mm", help: "standard 720; z cokołem 100 i blatem ~38 daje blat ~858 mm" },
        { key: "worktop_height_mm", label: "Wysokość blatu od podłogi (górna krawędź)", type: "number", unit: "mm", help: "nóżki 100 → 860 • nóżki 120 → 880 • nóżki 150 → 910 (korpus 720 + blat 40)" },
      ],
    },
    {
      title: "Fronty",
      fields: [
        { key: "front_material", label: "Materiał frontów", type: "radio", options: [
          { value: "lakier", label: "Lakier MDF" },
          { value: "laminat", label: "Płyta laminowana" },
          { value: "akryl", label: "Akryl" },
          { value: "fornir", label: "Fornir" },
          { value: "frezowany", label: "Frezowany MDF" },
          { value: "drewno", label: "Drewno lite" },
        ]},
        { key: "front_color", label: "Kolor / RAL", type: "text" },
        { key: "front_finish", label: "Wykończenie", type: "radio", options: [
          { value: "mat", label: "Mat" },
          { value: "polmat", label: "Półmat" },
          { value: "polysk", label: "Połysk" },
          { value: "struktura", label: "Struktura" },
        ]},
        { key: "front_opening", label: "Otwieranie", type: "radio", options: [
          { value: "uchwyty", label: "Uchwyty" },
          { value: "bezuchwytowe", label: "Bezuchwytowe (gola / tip-on)" },
          { value: "frezowane", label: "Frezowane wcięcie" },
          { value: "mieszane", label: "Mieszane" },
        ]},
        { key: "handle_model", label: "Model uchwytów (jeśli)", type: "text" },
        { key: "gola_color", label: "Kolor profilu gola (jeśli bezuchwytowe)", type: "text", placeholder: "np. czarny, srebrny, antracyt, w kolorze frontu" },
      ],
    },
    {
      title: "Blat",
      fields: [
        { key: "worktop_material", label: "Materiał blatu", type: "select", options: [
          { value: "laminat", label: "Laminat" },
          { value: "drewno", label: "Drewno" },
          { value: "kompozyt", label: "Kompozyt" },
          { value: "kamien", label: "Kamień / konglomerat" },
          { value: "spiek", label: "Spiek kwarcowy" },
        ]},
        { key: "worktop_color", label: "Kolor / dekor blatu", type: "text" },
        { key: "worktop_thickness_mm", label: "Grubość blatu", type: "number", unit: "mm" },
        { key: "backsplash_type", label: "Wykończenie nad blatem", type: "radio", options: [
          { value: "brak", label: "Brak" },
          { value: "kafelki", label: "Kafelki" },
          { value: "panel", label: "Panel przyblatowy" },
        ]},
        { key: "backsplash_notes", label: "Wykończenie nad blatem — szczegóły", type: "text", placeholder: "kolor / format / materiał" },
        { key: "worktop_joints_count", label: "Łączenia blatu (sztuk)", type: "number", unit: "szt", help: "ilość łączeń na całym blacie (narożniki, doklejki)" },
        { key: "worktop_joint_kit", label: "Zestaw do łączenia + klej", type: "checkbox", help: "klej do blatu + listwa / haki łączeniowe" },
        { key: "worktop_joint_kit_count", label: "Zestaw łączeniowy — sztuk", type: "number", unit: "szt" },
      ],
    },
    {
      title: "Okucia i szuflady",
      fields: [
        { key: "hinges_brand", label: "Zawiasy — producent", type: "select", options: [
          { value: "blum", label: "Blum" },
          { value: "hettich", label: "Hettich" },
          { value: "gtv", label: "GTV" },
          { value: "other", label: "Inny" },
        ]},
        { key: "hinges_mount", label: "Typ montażu zawiasów", type: "radio", options: [
          { value: "nakladany", label: "Nakładane" },
          { value: "wpuszczany", label: "Wpuszczane" },
        ]},
        { key: "hinges_angle", label: "Kąt otwarcia", type: "radio", options: [
          { value: "110", label: "Standard 110°" },
          { value: "155", label: "Szerokokątne 155°" },
          { value: "parallel", label: "Równoległe (do drzwi narożnych)" },
        ]},
        { key: "hinges_damper", label: "Hamulec (cichy domyk)", type: "radio", options: [
          { value: "z", label: "Z hamulcem" },
          { value: "bez", label: "Bez hamulca" },
        ]},
        { key: "hinges_spring", label: "Sprężyna", type: "radio", options: [
          { value: "z", label: "Ze sprężyną" },
          { value: "bez", label: "Bez sprężyny (puste — np. do dociągacza Servo / tip-on)" },
        ]},
        { key: "hinges_count", label: "Zawiasy — sztuk", type: "number", unit: "szt" },
        { key: "drawer_count", label: "Szuflady (sztuk)", type: "number", unit: "szt" },
        { key: "drawer_type", label: "Typ szuflad", type: "text", placeholder: "tandem / legrabox / merivobox" },
        { key: "drawer_tray", label: "Szuflada tackowa (np. pod Termomix)", type: "checkbox" },
        { key: "drawer_tray_notes", label: "Szuflada tackowa — wymiary / pod co", type: "text", placeholder: "np. pod Termomix TM6 — szer. 600" },
        { key: "sink_cabinet_drawer", label: "Szuflada w szafce zlewowej (omijająca syfon)", type: "checkbox" },
        { key: "sink_cabinet_drawer_notes", label: "Szuflada zlewowa — uwagi", type: "text", placeholder: "np. typ U-kształt pod syfon / wkład na chemię" },
        { key: "servo_drive", label: "Servo-Drive (elektryczne otwieranie)", type: "checkbox" },
        { key: "servo_drive_where", label: "Servo-Drive — gdzie zastosować", type: "text", placeholder: "np. szafka zlewowa, kosz na śmieci, szuflady pod blatem" },
        { key: "tip_on", label: "Tip-on (push-to-open)", type: "checkbox" },
        { key: "tip_on_count", label: "Tip-on — sztuk", type: "number", unit: "szt" },
        { key: "tip_on_color", label: "Tip-on — kolor / model", type: "text", placeholder: "np. biały / szary / antracyt" },
        { key: "cargo_count", label: "Cargo / kosze cięgnące", type: "number", unit: "szt" },
        { key: "corner_solution", label: "Rozwiązanie narożnika", type: "text", placeholder: "magic corner, le mans, półka" },
      ],
    },
    {
      title: "AGD do zabudowy",
      fields: [
        { key: "agd_induction", label: "Płyta indukcyjna / gazowa", type: "checkbox" },
        { key: "agd_oven", label: "Piekarnik", type: "checkbox" },
        { key: "agd_oven_model", label: "Piekarnik — model", type: "text", placeholder: "marka / model" },
        { key: "agd_microwave", label: "Mikrofalówka", type: "checkbox" },
        { key: "agd_microwave_model", label: "Mikrofalówka — model", type: "text", placeholder: "marka / model" },
        { key: "agd_coffee", label: "Ekspres do kawy", type: "checkbox" },
        { key: "agd_coffee_type", label: "Ekspres — typ", type: "radio", options: [
          { value: "zabudowa", label: "Do zabudowy" },
          { value: "wolnostojacy", label: "Wolnostojący" },
        ]},
        { key: "agd_coffee_model", label: "Ekspres — model", type: "text", placeholder: "marka / model" },
        { key: "agd_thermomix", label: "Termomix", type: "checkbox" },
        { key: "agd_thermomix_notes", label: "Termomix — model / wymiary", type: "text", placeholder: "TM6 / wymiary" },
        { key: "agd_hood", label: "Okap", type: "checkbox" },
        { key: "agd_hood_mount", label: "Okap — montaż", type: "radio", options: [
          { value: "zabudowa", label: "Do zabudowy" },
          { value: "wolnowiszacy", label: "Wolnowiszący" },
        ]},
        { key: "agd_hood_type", label: "Okap — typ wyciągu", type: "radio", options: [
          { value: "komin", label: "Z odprowadzeniem do komina" },
          { value: "wegiel", label: "Filtry węglowe (obiegowy)" },
        ]},
        { key: "agd_dishwasher", label: "Zmywarka", type: "checkbox" },
        { key: "agd_dishwasher_model", label: "Zmywarka — model", type: "text", placeholder: "Bosch / Siemens / Miele / AEG / Whirlpool / Beko — marka i model" },
        { key: "agd_dishwasher_width", label: "Zmywarka — szerokość", type: "radio", options: [
          { value: "45", label: "45 cm" },
          { value: "60", label: "60 cm" },
        ]},
        { key: "agd_fridge", label: "Lodówka", type: "checkbox" },
        { key: "agd_fridge_type", label: "Lodówka — typ", type: "radio", options: [
          { value: "zabudowa", label: "Do zabudowy" },
          { value: "wolnostojaca", label: "Wolnostojąca" },
        ]},
        { key: "agd_fridge_spec", label: "Lodówka — wymiary i model", type: "text", placeholder: "np. 1772×540×545, Bosch KIR... / Samsung RB..." },
        { key: "agd_sink", label: "Zlewozmywak + bateria", type: "checkbox" },
        { key: "agd_notes", label: "AGD — dodatkowe uwagi", type: "textarea" },
      ],
    },
    {
      title: "Oświetlenie LED",
      fields: [
        { key: "led_under_upper", label: "LED pod szafkami wiszącymi", type: "checkbox" },
        { key: "led_under_color", label: "Kolor listwy LED pod szafkami", type: "text", placeholder: "np. czarny, srebrny, biały, RAL..." },
        { key: "led_inside_upper", label: "LED w szafkach wiszących (półki szklane i witryny)", type: "checkbox" },
        { key: "led_inside_color", label: "Kolor listwy LED w witrynach / szafkach", type: "text", placeholder: "np. czarny, srebrny, biały, RAL..." },
        { key: "glass_color", label: "Kolor szkła (witryny / półki)", type: "text", placeholder: "przezroczyste / dymione / czarne / mleczne" },
        { key: "cabinet_frame_type", label: "Rodzaj ramki witryn", type: "text", placeholder: "aluminiowa / drewniana / w kolorze frontu / bez ramki" },
        { key: "led_plinth", label: "LED w cokole", type: "checkbox" },
        { key: "led_profile", label: "Profil aluminiowy LED", type: "checkbox" },
        { key: "led_profile_cover", label: "Klosz / przesłonka profilu LED", type: "radio", options: [
          { value: "mleczny", label: "Mleczny" },
          { value: "transparentny", label: "Transparentny" },
          { value: "przyciemniony", label: "Przyciemniony / dymiony" },
        ]},
        { key: "led_color_temp", label: "Temperatura barwy", type: "select", options: [
          { value: "warm", label: "Ciepła (3000K)" },
          { value: "neutral", label: "Neutralna (4000K)" },
          { value: "cold", label: "Zimna (6000K)" },
        ]},
        { key: "led_switch", label: "Włącznik LED — lokalizacja / typ", type: "text", placeholder: "czujnik ruchu / dotyk / ścienny / pilot / podblatowy niewidoczny" },
      ],
    },
    {
      title: "Ustalenia",
      fields: [
        { key: "expected_term", label: "Oczekiwany termin realizacji", type: "text" },
        { key: "deposit_pct", label: "Zadatek (% kwoty)", type: "number", unit: "%" },
        { key: "notes", label: "Notatki ogólne", type: "textarea" },
      ],
    },
  ],
};

const WARDROBE: BriefSchema = {
  groups: [
    {
      title: "Pomieszczenie",
      fields: [
        { key: "alcove", label: "Wnęka czy wolnostojąca", type: "radio", options: [
          { value: "alcove", label: "Wnęka" },
          { value: "freestanding", label: "Wolnostojąca" },
          { value: "corner", label: "Narożna" },
        ]},
        { key: "room_shape", label: "Kształt pomieszczenia", type: "radio", options: [
          { value: "prosta", label: "Prosta (prostokąt)" },
          { value: "skos_trojkat", label: "Trójkątny skos (wnęka trójkątna)" },
          { value: "skos_kolankowy", label: "Skos z kolankiem (prawa pionowa ~1/3 + skos)" },
          { value: "skos_pionowy", label: "Skos + prosty fragment sufitu" },
        ]},
        { key: "width_mm", label: "Szerokość (podłoga)", type: "number", unit: "mm" },
        { key: "depth_mm", label: "Głębokość szafy (planowana)", type: "number", unit: "mm" },
        { key: "alcove_depth_mm", label: "Głębokość wnęki (pomieszczenia)", type: "number", unit: "mm", help: "wpisz, jeśli szafa we wnęce — pomaga ustalić maksymalną głębokość mebla" },
        { key: "height_mm", label: "Wysokość maks. (przy lewej ścianie)", type: "number", unit: "mm" },
        { key: "knee_wall_height_mm", label: "Wysokość ściany kolankowej (prawa — gdzie zaczyna się skos)", type: "number", unit: "mm", help: "domyślnie ~1/3 całkowitej wysokości" },
        { key: "plinth_height_mm", label: "Wysokość cokołu / listwy przypodłogowej w pomieszczeniu", type: "number", unit: "mm", help: "istniejący cokół na ścianie — żeby ustawić mebel tak, by nie kolidował" },
        { key: "ceiling_flat_mm", label: "Długość prostego sufitu (jeśli skos nie sięga lewej ściany)", type: "number", unit: "mm", help: "wpisz tylko dla wariantu 'skos + prosty fragment sufitu'" },
        { key: "slope_top_height_mm", label: "Wysokość poziomego sufitu (od podłogi)", type: "number", unit: "mm", help: "wpisz tylko dla 'skos + prosty fragment sufitu' — wysokość rogu u góry, gdzie kończy się skos i zaczyna prosty sufit" },
        { key: "slope_floor_run_mm", label: "Szerokość pod skosem (rzut skosu na podłogę od prawej ściany)", type: "number", unit: "mm", help: "wpisz tylko dla 'skos + prosty fragment sufitu' — odległość po podłodze od prawej ściany do pionu pod końcem skosu" },
        { key: "room_notes", label: "Uwagi (skosy, gniazdka, instalacje)", type: "textarea" },
      ],
    },
    {
      title: "Drzwi i fronty",
      fields: [
        { key: "door_type", label: "Typ drzwi", type: "radio", options: [
          { value: "sliding", label: "Przesuwne" },
          { value: "hinged", label: "Skrzydłowe" },
          { value: "openframe", label: "Bez drzwi (otwarte)" },
        ]},
        { key: "door_count", label: "Liczba drzwi / skrzydeł", type: "number", unit: "szt" },
        { key: "door_material", label: "Front — materiał", type: "text", placeholder: "lustro / lakier / okleina" },
        { key: "door_color", label: "Front — kolor", type: "text" },
        { key: "door_system", label: "System przesuwny (jeśli)", type: "text", placeholder: "Komandor / Sevroll / GTV" },
        { key: "handles", label: "Uchwyty", type: "text", placeholder: "model / brak (bezuchwytowe)" },
      ],
    },
    {
      title: "Korpusy i wnętrze",
      fields: [
        { key: "corpus_material", label: "Materiał korpusu", type: "text" },
        { key: "corpus_color", label: "Kolor korpusu", type: "text" },
        { key: "shelves_count", label: "Półki (sztuk)", type: "number", unit: "szt" },
        { key: "drawer_count", label: "Szuflady (sztuk)", type: "number", unit: "szt" },
        { key: "drawer_type", label: "Typ szuflad", type: "radio", options: [
          { value: "skrzynkowe", label: "Skrzynkowe (klasyczne z płyty)" },
          { value: "systemowe", label: "Systemowe (Blum / Hettich / GTV — metalowe boki)" },
        ]},
        { key: "drawer_front_type", label: "Front szuflad", type: "text", placeholder: "pełny / szklany / siatka / itp." },
        { key: "rod_count", label: "Drążki na ubrania (sztuk)", type: "number", unit: "szt" },
        { key: "rod_illuminated", label: "Drążki podświetlane LED", type: "checkbox" },
        { key: "rod_color", label: "Kolor drążków", type: "text", placeholder: "np. chrom / czarny / złoty / w kolorze frontu" },
        { key: "pantograph", label: "Pantograf (drążek opuszczany)", type: "checkbox" },
        { key: "pantograph_count", label: "Pantograf — sztuk", type: "number", unit: "szt" },
        { key: "baskets", label: "Kosze druciane", type: "checkbox" },
        { key: "shoe_rack", label: "Organizer na buty", type: "checkbox" },
        { key: "tie_rack", label: "Wieszak na krawaty/paski", type: "checkbox" },
      ],
    },
    {
      title: "Oświetlenie",
      fields: [
        { key: "led_inside", label: "LED wewnątrz", type: "checkbox" },
        { key: "led_sensor", label: "Czujnik ruchu (LED auto)", type: "checkbox" },
        { key: "led_color_temp", label: "Temperatura barwy", type: "select", options: [
          { value: "warm", label: "Ciepła (3000K)" },
          { value: "neutral", label: "Neutralna (4000K)" },
          { value: "cold", label: "Zimna (6000K)" },
        ]},
      ],
    },
    {
      title: "Ustalenia",
      fields: [
        { key: "expected_term", label: "Oczekiwany termin realizacji", type: "text" },
        { key: "deposit_pct", label: "Zadatek (% kwoty)", type: "number", unit: "%" },
        { key: "notes", label: "Notatki ogólne", type: "textarea" },
      ],
    },
  ],
};

const BATHROOM: BriefSchema = {
  groups: [
    {
      title: "Pomieszczenie",
      fields: [
        { key: "room_layout", label: "Układ", type: "radio", options: [
          { value: "lin", label: "Prosta ściana" },
          { value: "l", label: "Litera L (długa + krótka)" },
          { value: "u", label: "Litera U (3 ściany)" },
          { value: "wneka", label: "Wnęka (środkowa + 2 boczne ~600 mm)" },
        ]},
        { key: "wall_a_mm", label: "Ściana A — długość", type: "number", unit: "mm" },
        { key: "wall_b_mm", label: "Ściana B — długość", type: "number", unit: "mm" },
        { key: "wall_c_mm", label: "Ściana C — długość (U lub wnęka, ścianka prawa)", type: "number", unit: "mm" },
        { key: "ceiling_mm", label: "Wysokość", type: "number", unit: "mm" },
        { key: "plumbing_notes", label: "Instalacje — ogólne uwagi", type: "textarea" },
      ],
    },
    {
      title: "Przyłącza wodno-kan.",
      fields: [
        { key: "plumbing_wall", label: "Woda + kanalizacja — ściana", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ]},
        { key: "plumbing_offset_mm", label: "Wodno-kan. — odległość od lewego narożnika ściany", type: "number", unit: "mm" },
        { key: "plumbing_height_mm", label: "Wodno-kan. — wysokość od podłogi", type: "number", unit: "mm" },
        { key: "plumbing_width_mm", label: "Wodno-kan. — szerokość zajmowanego pola", type: "number", unit: "mm", help: "łączny obszar przyłączy: zimna + ciepła + odpływ" },
        { key: "washer_wall", label: "Pralka — przyłącza (ściana)", type: "radio", options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ]},
        { key: "washer_offset_mm", label: "Pralka — odległość od lewego narożnika", type: "number", unit: "mm" },
        { key: "washer_height_mm", label: "Pralka — wysokość przyłączy", type: "number", unit: "mm" },
        { key: "utilities_notes", label: "Przyłącza — uwagi", type: "textarea" },
      ],
    },
    {
      title: "Szafki i fronty",
      fields: [
        { key: "corpus_material", label: "Materiał korpusu (wodoodporny)", type: "text" },
        { key: "corpus_color", label: "Kolor korpusu", type: "text" },
        { key: "front_material", label: "Front — materiał", type: "text", placeholder: "lakier wodoodporny / MDF / drewno" },
        { key: "front_color", label: "Front — kolor", type: "text" },
        { key: "front_opening", label: "Otwieranie", type: "radio", options: [
          { value: "uchwyty", label: "Uchwyty" },
          { value: "bezuchwytowe", label: "Bezuchwytowe" },
        ]},
        { key: "drawer_count", label: "Szuflady (sztuk)", type: "number", unit: "szt" },
      ],
    },
    {
      title: "Blat / umywalka",
      fields: [
        { key: "worktop_material", label: "Materiał blatu", type: "text" },
        { key: "worktop_length_m", label: "Długość blatu", type: "number", unit: "mb" },
        { key: "sink_type", label: "Umywalka", type: "radio", options: [
          { value: "nablat", label: "Nablatowa" },
          { value: "podblat", label: "Podblatowa" },
          { value: "wpuszczana", label: "Wpuszczana" },
          { value: "wisaca", label: "Wisząca (osobna)" },
        ]},
        { key: "sink_count", label: "Ile umywalek", type: "number", unit: "szt" },
        { key: "sink_width_mm", label: "Umywalka — szerokość (W)", type: "number", unit: "mm" },
        { key: "sink_depth_mm", label: "Umywalka — głębokość (D)", type: "number", unit: "mm" },
        { key: "sink_height_mm", label: "Umywalka — wysokość/grubość (H)", type: "number", unit: "mm" },
        { key: "sink_model", label: "Umywalka — model / producent", type: "text", placeholder: "np. Cersanit Caspia 60" },
        { key: "sink_cabinet_under", label: "Szafka pod umywalkę", type: "checkbox" },
        { key: "sink_cabinet_notes", label: "Szafka pod umywalkę — uwagi", type: "text", placeholder: "np. 2 szuflady, wycięcie pod syfon" },
        { key: "tap_supplier", label: "Bateria — kto kupuje", type: "radio", options: [
          { value: "client", label: "Klient" },
          { value: "us", label: "My" },
        ]},
      ],
    },
    {
      title: "Oświetlenie i dodatki",
      fields: [
        { key: "led_mirror", label: "Lustro LED", type: "checkbox" },
        { key: "led_cabinet", label: "LED w szafce / pod szafką", type: "checkbox" },
        { key: "led_color_temp", label: "Temperatura barwy", type: "select", options: [
          { value: "warm", label: "Ciepła (3000K)" },
          { value: "neutral", label: "Neutralna (4000K)" },
          { value: "cold", label: "Zimna (6000K)" },
        ]},
        { key: "mirror_size", label: "Lustro — wymiary", type: "text" },
        { key: "extras_notes", label: "Dodatkowe wyposażenie / uwagi", type: "textarea" },
      ],
    },
    {
      title: "Ustalenia",
      fields: [
        { key: "expected_term", label: "Oczekiwany termin realizacji", type: "text" },
        { key: "deposit_pct", label: "Zadatek (% kwoty)", type: "number", unit: "%" },
        { key: "notes", label: "Notatki ogólne", type: "textarea" },
      ],
    },
  ],
};

export const BRIEF_SCHEMAS: Record<ProjectType, BriefSchema> = {
  kitchen: KITCHEN,
  wardrobe: WARDROBE,
  bathroom: BATHROOM,
};

export function getBriefSchema(type: ProjectType): BriefSchema {
  return BRIEF_SCHEMAS[type];
}
