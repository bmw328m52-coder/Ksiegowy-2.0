"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markSentToIngAction } from "../../actions";

export type DeckDoc = {
  id: string;
  url: string | null;
  isPdf: boolean;
  supplier: string;
  nip: string;
  buyerNip: string;
  street: string;
  postal: string;
  city: string;
  number: string;
  date: string | null;
  net: number | null;
  vat: number | null;
  gross: number;
  rate: number | null;
  kind: "paragon" | "faktura";
  category: string | null;
  itemName: string;
  breakdown: { rate: number | null; net: number; vat: number; gross: number }[];
  warnings: string[];
  /** % VAT do odliczenia (100 / 50 / 0) i udział kosztu w PIT (1 albo 0,75 dla paliwa). */
  vatDeduction: number;
  pitShare: number;
};

/** Kwota do wklejenia w polskim formularzu: 1234,50 (bez spacji tysięcy). */
const money = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));
const plDate = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
const rateLabel = (r: number | null) => (r === null ? "" : `${Math.round(r * 100)}%`);

type Field = { key: string; label: string; value: string; hint?: string };

/** Pola w kolejności formularza „Wprowadź dokument” w ING Księgowość. */
function contractorFields(d: DeckDoc): Field[] {
  return [
    { key: "nip", label: "NIP sprzedawcy", value: d.nip, hint: "wyszukiwarka kontrahenta lub pole NIP" },
    { key: "supplier", label: "Nazwa", value: d.supplier },
    { key: "street", label: "Ulica i numer", value: d.street },
    { key: "postal", label: "Kod pocztowy", value: d.postal },
    { key: "city", label: "Miejscowość", value: d.city },
  ];
}
function productFields(d: DeckDoc): Field[] {
  return [{ key: "item", label: "Nazwa produktu", value: d.itemName }];
}
function headerFields(d: DeckDoc): Field[] {
  return [
    { key: "date", label: "Data wystawienia", value: plDate(d.date), hint: "dd.mm.rrrr, daty wykonania i wpływu zwykle te same" },
    { key: "number", label: d.kind === "paragon" ? "Numer (paragonu / wydruku)" : "Numer", value: d.number },
  ];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function CopyDeck({ docs }: { docs: DeckDoc[] }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(false);
  const [pending, startTransition] = useTransition();

  if (docs.length === 0) {
    return (
      <section className="lv-card lc-box">
        <h2 className="lc-h2">Nic do przepisania</h2>
        <p className="ld-empty">Wszystkie dokumenty są już przekazane do ING.</p>
        <Link href="/finanse/ksiegowosc" className="ls-cta">
          Wróć do księgowości
        </Link>
      </section>
    );
  }

  const left = docs.filter((d) => !doneIds.has(d.id));
  if (left.length === 0) {
    return (
      <section className="lv-card lc-box">
        <h2 className="lc-h2">✓ Wszystko przepisane</h2>
        <p className="ld-empty">Przekazano {docs.length} dokumentów do ING.</p>
        <Link href="/finanse/ksiegowosc" className="ls-cta">
          Wróć do księgowości
        </Link>
      </section>
    );
  }
  const idx = Math.min(i, left.length - 1);
  const d = left[idx];

  const copy = async (key: string, value: string) => {
    if (!value) return;
    if (await copyText(value)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    }
  };

  const finish = () =>
    startTransition(async () => {
      await markSentToIngAction([d.id]);
      setDoneIds((prev) => new Set(prev).add(d.id));
      setCopied(null);
    });

  return (
    <div className="lp-wrap">
      <div className="lp-progress">
        <b>
          {idx + 1} z {left.length}
        </b>
        <span>przepisane: {doneIds.size}</span>
        <div className="ls-bar" aria-hidden>
          <div style={{ width: `${(doneIds.size / docs.length) * 100}%` }} />
        </div>
      </div>

      <div className="lp-grid">
        <section className="lv-card lp-doc">
          {d.url ? (
            d.isPdf ? (
              <iframe src={d.url} title="Dokument" className="lp-pdf" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.url} alt="Dokument" className="lp-img" data-zoom={zoom} onClick={() => setZoom((z) => !z)} />
            )
          ) : (
            <p className="ld-empty">Brak podglądu pliku.</p>
          )}
          {!d.isPdf && d.url && <small className="lp-zoomhint">Dotknij zdjęcia, żeby powiększyć</small>}
        </section>

        <section className="lv-card lp-fields">
          <div className="lp-fields-head">
            <span className="ls-badge">{d.kind === "paragon" ? "Paragon" : "Faktura"}</span>
            <Link href={`/invoices/${d.id}`} className="lp-edit">
              Popraw dane
            </Link>
          </div>

          {d.warnings.length > 0 && (
            <ul className="ls-warns">
              {d.warnings.slice(0, 3).map((w, k) => (
                <li key={k}>{w}</li>
              ))}
            </ul>
          )}

          <Accounting d={d} />

          <Step n={1} title="Kontrahent" note="Najpierw wpisz NIP w wyszukiwarce, ING może już znać tego sprzedawcę. Jeśli nie: „Nowy kontrahent”, typ „Firma”, i wklej pola poniżej. Kraj: Polska.">
            <FieldList fields={contractorFields(d)} copied={copied} onCopy={copy} />
          </Step>

          <Step
            n={2}
            title="Produkt"
            note="Ustaw: ceny brutto, „Wprowadź wg: stawek VAT”. Potem wpisz każdą stawkę z kwotami poniżej."
          >
            <FieldList fields={productFields(d)} copied={copied} onCopy={copy} />
            <div className="lp-rates">
              {ratesOf(d).map((r, k) => (
                <div key={k} className="lp-rate-row">
                  <span className="lp-rate-tag">{rateLabel(r.rate) || "stawka?"}</span>
                  <ChipCopy id={`r${k}-rate`} label="stawka" value={rateLabel(r.rate).replace("%", "")} copied={copied} onCopy={copy} />
                  <ChipCopy id={`r${k}-net`} label="netto" value={money(r.net)} copied={copied} onCopy={copy} />
                  <ChipCopy id={`r${k}-vat`} label="VAT" value={money(r.vat)} copied={copied} onCopy={copy} />
                  <ChipCopy id={`r${k}-gross`} label="brutto" value={money(r.gross)} copied={copied} onCopy={copy} />
                </div>
              ))}
              <p className="lp-check">
                Kontrola w ING: netto <b>{money(d.net)}</b> · VAT <b>{money(d.vat)}</b> · brutto <b>{money(d.gross)}</b>
              </p>
            </div>
          </Step>

          <Step n={3} title="Nagłówek">
            <FieldList fields={headerFields(d)} copied={copied} onCopy={copy} />
          </Step>

          <Step
            n={4}
            title="Płatność"
            note={
              d.kind === "paragon"
                ? "Paragon jest zapłacony przy zakupie: zaznacz „Zapłacono w całości”."
                : "Ustaw termin i zapłatę zgodnie z dokumentem."
            }
          >
            <ul className="lp-list">
              <li>
                <div className="min-w-0">
                  <small>Zapłacono · kwota brutto</small>
                  <b>{money(d.gross)}</b>
                </div>
                <button type="button" data-ok={copied === "paid"} onClick={() => copy("paid", money(d.gross))}>
                  {copied === "paid" ? "✓" : "Kopiuj"}
                </button>
              </li>
            </ul>
            {d.kind === "paragon" && (
              <p className="lp-check">
                NIP nabywcy na paragonie: <b>{d.buyerNip || "brak"}</b>
              </p>
            )}
          </Step>

          <div className="lp-actions">
            <button type="button" className="ls-cta" disabled={pending} onClick={finish}>
              {pending ? "Zapisuję…" : "Wpisane w ING, następny →"}
            </button>
            <button type="button" className="ls-cta" data-ghost="true" disabled={left.length < 2} onClick={() => setI((idx + 1) % left.length)}>
              Pomiń
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ratesOf(d: DeckDoc): { rate: number | null; net: number; vat: number; gross: number }[] {
  if (d.breakdown.length > 0) return d.breakdown;
  return [{ rate: d.rate, net: d.net ?? d.gross, vat: d.vat ?? 0, gross: d.gross }];
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="lp-step">
      <h3>
        <span>{n}</span>
        {title}
      </h3>
      {note && <p className="lp-note">{note}</p>}
      {children}
    </div>
  );
}

function FieldList({
  fields,
  copied,
  onCopy,
}: {
  fields: Field[];
  copied: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  return (
    <ul className="lp-list">
      {fields.map((f) => (
        <li key={f.key}>
          <div className="min-w-0">
            <small>
              {f.label}
              {f.hint ? ` · ${f.hint}` : ""}
            </small>
            <b data-empty={!f.value}>{f.value || "brak, uzupełnij w „Popraw dane”"}</b>
          </div>
          <button type="button" disabled={!f.value} data-ok={copied === f.key} onClick={() => onCopy(f.key, f.value)}>
            {copied === f.key ? "✓" : "Kopiuj"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChipCopy({
  id,
  label,
  value,
  copied,
  onCopy,
}: {
  id: string;
  label: string;
  value: string;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
}) {
  return (
    <button type="button" className="lp-chip" data-ok={copied === id} disabled={!value} onClick={() => onCopy(id, value)}>
      <small>{label}</small>
      <b>{copied === id ? "✓" : value || "—"}</b>
    </button>
  );
}

/** Kategorie kosztów z ING Księgowość (lista „Zmień kategorię”) dopasowane do kategorii aplikacji. */
export function ingCategory(category: string | null): string {
  switch (category) {
    case "paliwo":
    case "samochód":
      return "Koszty samochodu - KUP 75%";
    case "płyty/drewno":
    case "okucia":
    case "materiały":
      return "Towary i materiały handlowe";
    case "transport":
      return "Koszty transportu towarów i materiałów";
    case "narzędzia":
    case "biuro":
    case "usługi":
    case "inne":
      return "Pozostałe koszty";
    default:
      return "Pozostałe koszty";
  }
}

/** Podpowiedzi księgowe dla dokumentu: rodzaj w ING, kategoria, odliczenie VAT, udział w kosztach PIT. */
function Accounting({ d }: { d: DeckDoc }) {
  const car = d.category === "paliwo" || d.category === "samochód";
  const noVat = d.kind === "paragon" && !d.buyerNip;
  const vat = noVat ? 0 : d.vatDeduction;
  const rows: [string, string][] = [
    ["Rodzaj dokumentu w ING", noVat ? "Pozostały rozchód (paragon bez NIP nabywcy)" : "Faktura zakupu"],
    ["Kategoria w ING (Zmień kategorię)", ingCategory(d.category)],
    ["VAT do odliczenia", `${vat}%`],
    ["Koszt w PIT", `${Math.round(d.pitShare * 100)}%`],
  ];
  return (
    <div className="lp-step">
      <h3>
        <span>★</span>
        Księgowanie
      </h3>
      <ul className="lp-list">
        {rows.map(([label, value]) => (
          <li key={label}>
            <div className="min-w-0">
              <small>{label}</small>
              <b>{value}</b>
            </div>
          </li>
        ))}
      </ul>
      {car && (
        <p className="lp-note">
          Samochód z umowy użyczenia, bez ewidencji przebiegu: <b>75% w koszty PIT, 50% VAT</b>. W ING wybierz kategorię
          „Koszty samochodu - KUP 75%”, a odliczenie VAT ustaw na 50%, żeby wydatek policzył się tak samo jak w tej aplikacji.
        </p>
      )}
      {noVat && (
        <p className="lp-note">
          Paragon bez NIP nabywcy nie daje prawa do odliczenia VAT. Cała kwota brutto idzie w koszt, jeśli wydatek jest
          firmowy.
        </p>
      )}
    </div>
  );
}
