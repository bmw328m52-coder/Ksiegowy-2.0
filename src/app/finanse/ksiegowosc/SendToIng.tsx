"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markSentToIngAction } from "../actions";

export type IngDoc = {
  id: string;
  filename: string;
  url: string;
  supplier: string;
  date: string | null;
  gross: number;
  kind: "paragon" | "faktura" | "inne";
  buyerNip: boolean;
};

const PLN = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

type Phase = "idle" | "saving" | "saved" | "marked";

async function fetchFile(d: IngDoc): Promise<File> {
  const res = await fetch(d.url);
  if (!res.ok) throw new Error(`Nie udało się pobrać: ${d.supplier}`);
  const blob = await res.blob();
  return new File([blob], d.filename, { type: blob.type || "image/jpeg" });
}

/**
 * Jedna paczka plików dla ING Księgowość (skanowanie OCR przyjmuje wiele plików naraz: PDF/JPG/PNG/TIFF).
 * Komputer: zapis wszystkich plików do wybranego folderu jednym kliknięciem. iPad: arkusz udostępniania.
 * Inaczej: kolejne pobrania.
 */
export default function SendToIng({ docs }: { docs: IngDoc[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(docs.map((d) => d.id)));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [how, setHow] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const chosen = docs.filter((d) => selected.has(d.id));
  const sum = chosen.reduce((a, d) => a + d.gross, 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const prepare = async () => {
    setError(null);
    if (chosen.length === 0) return;
    setPhase("saving");
    try {
      type DirPicker = () => Promise<{
        getFileHandle: (n: string, o: { create: boolean }) => Promise<{
          createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
        }>;
        name: string;
      }>;
      const picker = (window as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker;

      if (picker) {
        // Komputer (Chrome/Edge): wszystkie pliki do jednego folderu.
        const dir = await picker();
        for (const d of chosen) {
          const f = await fetchFile(d);
          const h = await dir.getFileHandle(f.name, { create: true });
          const w = await h.createWritable();
          await w.write(f);
          await w.close();
        }
        setHow(`Zapisano ${chosen.length} plików w folderze „${dir.name}”.`);
      } else {
        const files: File[] = [];
        for (const d of chosen) files.push(await fetchFile(d));
        if (navigator.canShare?.({ files })) {
          // iPad / telefon: arkusz udostępniania (Zapisz w Plikach, AirDrop na komputer).
          await navigator.share({ files, title: "Dokumenty do ING" });
          setHow("Pliki wysłane przez arkusz udostępniania.");
        } else {
          for (const f of files) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(f);
            a.download = f.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            await new Promise((r) => setTimeout(r, 450));
          }
          setHow(`Pobrano ${files.length} plików do folderu Pobrane.`);
        }
      }
      setPhase("saved");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setPhase("idle");
      if (!aborted) setError(e instanceof Error ? e.message : "Nie udało się przygotować plików.");
    }
  };

  const mark = () =>
    startTransition(async () => {
      await markSentToIngAction(chosen.map((d) => d.id));
      setPhase("marked");
    });

  if (docs.length === 0) {
    return (
      <section className="lv-card lc-box">
        <h2 className="lc-h2">Do wgrania do ING</h2>
        <p className="ld-empty">Wszystkie zeskanowane dokumenty są już przekazane. Faktury z KSeF wpadają do ING same.</p>
      </section>
    );
  }

  return (
    <section className="lv-card lc-box lg-box">
      <div className="lg-head">
        <div>
          <h2 className="lc-h2">Do wgrania do ING</h2>
          <p className="lg-sub">
            Paragony i dokumenty ze skanera. Faktury z KSeF są już w ING i tu ich nie ma.
          </p>
        </div>
        <div className="lg-sum">
          <b>{chosen.length}</b> z {docs.length}
          <small>{PLN.format(sum)} brutto</small>
        </div>
      </div>

      <ul className="lg-list">
        {docs.map((d) => (
          <li key={d.id}>
            <label>
              <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
              <span className="lg-main">
                <b>{d.supplier}</b>
                <small>
                  {d.kind === "paragon" ? "Paragon" : d.kind === "faktura" ? "Faktura" : "Dokument"}
                  {d.date ? ` · ${d.date}` : ""}
                  {d.kind === "paragon" && !d.buyerNip ? " · bez NIP nabywcy" : ""}
                </small>
              </span>
              <span className="lg-amt">{PLN.format(d.gross)}</span>
            </label>
            <Link href={`/invoices/${d.id}`} className="lg-open" aria-label="Otwórz dokument">
              →
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/finanse/ksiegowosc/przepisz" className="ls-cta lg-btn" data-ghost="true">
        Wpisuję ręcznie: tryb przepisywania pól
      </Link>

      {phase !== "saved" && phase !== "marked" && (
        <button type="button" className="ls-cta lg-btn" disabled={chosen.length === 0 || phase === "saving"} onClick={prepare}>
          {phase === "saving" ? "Przygotowuję pliki…" : `Przygotuj ${chosen.length} plików dla ING`}
        </button>
      )}

      {error && <p className="ls-err mt-3">{error}</p>}

      {phase === "saved" && (
        <div className="lg-steps">
          <p className="lg-ok">✓ {how}</p>
          <ol>
            <li>
              W ING Księgowość otwórz <b>Skanowanie dokumentów (OCR)</b>.
            </li>
            <li>
              Kliknij „wybierz plik z dysku”, zaznacz wszystkie pliki (Ctrl+A) i potwierdź. Albo przeciągnij je na ramkę.
            </li>
            <li>Gdy ING skończy odczyt, sprawdź je w „Weryfikuj”.</li>
          </ol>
          <button type="button" className="ls-cta" disabled={pending} onClick={mark}>
            {pending ? "Zapisuję…" : "Wgrane do ING, oznacz jako przekazane"}
          </button>
        </div>
      )}

      {phase === "marked" && <p className="lg-ok">✓ Oznaczone jako przekazane do ING.</p>}
    </section>
  );
}
