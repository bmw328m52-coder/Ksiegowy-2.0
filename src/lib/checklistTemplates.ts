import type { ProjectType } from "./dao/job_checklist.types";

export type TemplateItem = {
  category: string;
  label: string;
  qty?: number;
  unit?: string;
};

export const CHECKLIST_TEMPLATES: Record<ProjectType, TemplateItem[]> = {
  kitchen: [
    { category: "Pomiar", label: "Pomiar z natury", unit: "usł" },
    { category: "Pomiar", label: "Kontrolny pomiar po wylewce / glazurze", unit: "usł" },
    { category: "Płyty", label: "Płyta korpusowa (LDF/MDF)", unit: "m²" },
    { category: "Płyty", label: "Plecy HDF", unit: "m²" },
    { category: "Fronty", label: "Fronty (lakier / okleina / MDF)", unit: "szt" },
    { category: "Blat", label: "Blat (laminat / drewno / kompozyt)", unit: "mb" },
    { category: "Blat", label: "Listwa przyblatowa / mocowanie", unit: "mb" },
    { category: "Okucia", label: "Zawiasy puszkowe", unit: "szt" },
    { category: "Okucia", label: "Prowadnice szuflad (pełen wysuw)", unit: "kpl" },
    { category: "Okucia", label: "Cargo / kosz wysuwny", unit: "szt" },
    { category: "Okucia", label: "Uchwyty / knopki", unit: "szt" },
    { category: "Okucia", label: "Nóżki cokołowe + cokół", unit: "kpl" },
    { category: "AGD", label: "Płyta indukcyjna / gazowa", unit: "szt" },
    { category: "AGD", label: "Piekarnik", unit: "szt" },
    { category: "AGD", label: "Okap", unit: "szt" },
    { category: "AGD", label: "Zlewozmywak + bateria", unit: "kpl" },
    { category: "AGD", label: "Zmywarka", unit: "szt" },
    { category: "AGD", label: "Lodówka do zabudowy", unit: "szt" },
    { category: "Oświetlenie", label: "Taśma LED + zasilacz", unit: "mb" },
    { category: "Oświetlenie", label: "Profil LED aluminiowy", unit: "mb" },
    { category: "Organizery", label: "Organizer szuflad sztućcowych", unit: "szt" },
    { category: "Organizery", label: "Wkład do szafki narożnej", unit: "szt" },
    { category: "Transport", label: "Transport elementów do klienta", unit: "kurs" },
    { category: "Montaż", label: "Montaż korpusów + frontów", unit: "rbh" },
    { category: "Montaż", label: "Montaż blatu i AGD", unit: "rbh" },
    { category: "Kontrola", label: "Odbiór końcowy z klientem", unit: "usł" },
  ],
  wardrobe: [
    { category: "Pomiar", label: "Pomiar wnęki", unit: "usł" },
    { category: "Płyty", label: "Płyta korpusowa", unit: "m²" },
    { category: "Płyty", label: "Plecy HDF", unit: "m²" },
    { category: "Fronty", label: "Fronty / drzwi przesuwne", unit: "szt" },
    { category: "Fronty", label: "Lustro / dekor", unit: "m²" },
    { category: "Okucia", label: "Prowadnice systemowe (drzwi)", unit: "kpl" },
    { category: "Okucia", label: "Drążek na ubrania", unit: "mb" },
    { category: "Okucia", label: "Zawiasy / prowadnice szuflad", unit: "kpl" },
    { category: "Okucia", label: "Uchwyty", unit: "szt" },
    { category: "Organizery", label: "Półki wsuwane / kosze", unit: "szt" },
    { category: "Organizery", label: "Organizer na buty / krawaty", unit: "szt" },
    { category: "Oświetlenie", label: "LED z czujnikiem ruchu", unit: "mb" },
    { category: "Transport", label: "Transport elementów", unit: "kurs" },
    { category: "Montaż", label: "Montaż korpusu + drzwi", unit: "rbh" },
    { category: "Kontrola", label: "Odbiór z klientem", unit: "usł" },
  ],
  bathroom: [
    { category: "Pomiar", label: "Pomiar z uwzględnieniem instalacji", unit: "usł" },
    { category: "Płyty", label: "Płyta wodoodporna", unit: "m²" },
    { category: "Fronty", label: "Fronty (lakier wodoodporny)", unit: "szt" },
    { category: "Blat", label: "Blat pod umywalkę", unit: "mb" },
    { category: "Okucia", label: "Zawiasy / prowadnice", unit: "kpl" },
    { category: "Okucia", label: "Uchwyty", unit: "szt" },
    { category: "Sanitariaty", label: "Umywalka + bateria", unit: "kpl" },
    { category: "Sanitariaty", label: "Syfon i podłączenia", unit: "kpl" },
    { category: "Oświetlenie", label: "Lustro LED / oświetlenie szafki", unit: "szt" },
    { category: "Organizery", label: "Wkłady na kosmetyki", unit: "szt" },
    { category: "Transport", label: "Transport elementów", unit: "kurs" },
    { category: "Montaż", label: "Montaż szafek + sanitariatów", unit: "rbh" },
    { category: "Kontrola", label: "Próba szczelności + odbiór", unit: "usł" },
  ],
};

export function getTemplateFor(type: ProjectType): TemplateItem[] {
  return CHECKLIST_TEMPLATES[type] ?? [];
}
