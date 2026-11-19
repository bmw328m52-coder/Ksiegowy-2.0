"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
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

type Format = "pdf" | "png" | "orig";

async function fetchClean(d: IngDoc, format: "pdf" | "png"): Promise<File> {
  const res = await fetch(`/api/invoices/clean-scan?id=${d.id}&format=${format}`);
  if (!res.ok) throw new Error(`Obróbka nie wyszła: ${d.supplier}`);
  const blob = await res.blob();
  const base = d.filename.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.${format}`, { type: format === "pdf" ? "application/pdf" : "image/png" });
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

  // Pliki przygotowujemy z góry. iPad (Safari) pozwala na „Udostępnij” tylko tuż po stuknięciu,
  // więc przy kliknięciu nie możemy już niczego pobierać — inaczej: „request is not allowed…”.
  const [format, setFormat] = useState<Format>("pdf");
  const cache = useRef<Map<string, File>>(new Map());
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [fallbacks, setFallbacks] = useState(0);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const queue = docs.filter((d) => selected.has(d.id) && !cache.current.has(`${format}:${d.id}`));
    const worker = async () => {
      for (;;) {
        const d = queue.shift();
        if (!d || cancelled) return;
        const key = `${format}:${d.id}`;
        try {
          cache.current.set(key, format === "orig" ? await fetchFile(d) : await fetchClean(d, format));
        } catch {
          // Obróbka nie wyszła: wgrywamy oryginalne zdjęcie, żeby nic nie zginęło.
          try {
            cache.current.set(key, await fetchFile(d));
            if (format !== "orig" && !cancelled) setFallbacks((n) => n + 1);
          } catch (e) {
            if (!cancelled) setPrefetchError(e instanceof Error ? e.message : "Nie udało się pobrać zdjęć.");
          }
        }
        if (!cancelled) setReady(new Set(cache.current.keys()));
      }
    };
    void Promise.all(Array.from({ length: format === "orig" ? 4 : 3 }, worker));
    return () => {
      cancelled = true;
    };
  }, [docs, selected, format]);
  const readyChosen = chosen.filter((d) => ready.has(`${format}:${d.id}`)).length;
  const allReady = readyChosen === chosen.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const done = (msg: string) => {
    setHow(msg);
    setPhase("saved");
  };

  /** Pobranie plików jeden po drugim (gdy arkusz udostępniania nie działa). */
  const downloadAll = async (files: File[]) => {
    for (const f of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 450));
    }
    done(`Pobrano ${files.length} plików do folderu Pobrane.`);
  };

  const prepare = () => {
    setError(null);
    if (chosen.length === 0) return;
    const files = chosen.map((d) => cache.current.get(`${format}:${d.id}`)).filter((f): f is File => !!f);
    if (files.length !== chosen.length) {
      setError("Zdjęcia jeszcze się pobierają. Poczekaj chwilę i stuknij ponownie.");
      return;
    }

    type DirPicker = () => Promise<{
      getFileHandle: (n: string, o: { create: boolean }) => Promise<{
        createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
      name: string;
    }>;
    const picker = (window as unknown as { showDirectoryPicker?: DirPicker }).showDirectoryPicker;

    const fail = (e: unknown) => {
      setPhase("idle");
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Nie udało się przygotować plików.");
    };

    setPhase("saving");

    if (picker) {
      // Komputer (Chrome/Edge): wszystkie pliki do jednego folderu.
      void (async () => {
        try {
          const dir = await picker();
          for (const f of files) {
            const h = await dir.getFileHandle(f.name, { create: true });
            const w = await h.createWritable();
            await w.write(f);
            await w.close();
          }
          done(`Zapisano ${files.length} plików w folderze „${dir.name}”.`);
        } catch (e) {
          fail(e);
        }
      })();
      return;
    }

    // iPad / telefon: arkusz udostępniania. share() MUSI ruszyć od razu, w obsłudze stuknięcia.
    if (navigator.canShare?.({ files })) {
      navigator
        .share({ files, title: "Dokumenty do ING" })
        .then(() => done("Pliki wysłane przez arkusz udostępniania."))
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return fail(e);
          // Safari odmówił (NotAllowedError) albo za dużo plików: zwykłe pobieranie.
          void downloadAll(files).catch(fail);
        });
      return;
    }
    void downloadAll(files).catch(fail);
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
        <>
        <fieldset className="mt-3">
          <legend className="text-[13px] font-semibold text-[#1f1d1b]">Format plików dla ING</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(
              [
                ["pdf", "PDF · czysty skan (zalecany)"],
                ["png", "PNG · czysty skan"],
                ["orig", "Oryginalne zdjęcia (JPG)"],
              ] as [Format, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFormat(k)}
                aria-pressed={format === k}
                className={`text-[13px] px-3.5 min-h-[44px] rounded-full font-semibold ${
                  format === k ? "bg-[#a06f3f] text-white" : "bg-white border border-[#ededea] text-[#6f6c66]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {format !== "orig" && (
            <p className="mt-1.5 text-[12px] text-[#6f6c66]">
              Paragon wycięty z tła, szary, z podbitym kontrastem i powiększony — ING czyta takie pliki dużo lepiej niż zdjęcia.
              {fallbacks > 0 ? ` Dla ${fallbacks} dok. obróbka się nie udała, pójdzie oryginał.` : ""}
            </p>
          )}
        </fieldset>
        <button
          type="button"
          className="ls-cta lg-btn"
          disabled={chosen.length === 0 || phase === "saving" || !allReady}
          onClick={prepare}
        >
          {phase === "saving"
            ? "Przygotowuję pliki…"
            : !allReady
              ? `${format === "orig" ? "Pobieram zdjęcia" : "Przygotowuję czyste skany"}… ${readyChosen}/${chosen.length}`
              : `Przygotuj ${chosen.length} plików dla ING`}
        </button>
        {prefetchError && <p className="ls-err mt-3">{prefetchError}</p>}
        </>
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
