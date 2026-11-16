"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraCapture from "./CameraCapture";

type Summary = {
  id: string;
  docType: "faktura" | "paragon" | "inne";
  supplier_name: string | null;
  supplier_nip: string | null;
  buyer_nip: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  amount_gross: number | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  duplicateOf: string | null;
};

type Item = {
  id: string;
  name: string;
  thumb: string | null;
  file: File;
  status: "queued" | "working" | "done" | "error";
  step?: string;
  result?: Summary;
  error?: string;
  invoiceId?: string;
};

const CONCURRENCY = 3;
const MAX_SIDE = 2200;
// Vercel przyjmuje do ~4,5 MB na żądanie; po kompresji zdjęcie ma zwykle 0,4–1,2 MB.
const MAX_UPLOAD = 4.2 * 1024 * 1024;

/** Zmniejsza zdjęcie (EXIF obrócony, HEIC → JPEG), żeby szybko się wysyłało i czytało. */
async function prepare(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "dokument";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const PLN = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

function fmtNip(n: string | null): string {
  if (!n) return "brak";
  return n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}` : n;
}

export default function BatchScanner() {
  const [items, setItems] = useState<Item[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [shots, setShots] = useState(0);
  const started = useRef<Set<string>>(new Set());
  const counter = useRef(0);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const fresh: Item[] = files.map((f) => {
      counter.current += 1;
      return {
        id: `s${Date.now()}-${counter.current}`,
        name: f.name,
        thumb: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        file: f,
        status: "queued",
      };
    });
    setItems((prev) => [...prev, ...fresh]);
  }, []);

  const run = useCallback(
    async (item: Item) => {
      try {
        patch(item.id, { status: "working", step: "Przygotowuję zdjęcie" });
        const prepared = await prepare(item.file);
        if (prepared.size > MAX_UPLOAD) {
          patch(item.id, {
            status: "error",
            error: "Plik jest za duży (maks. ok. 4 MB). Zrób zdjęcie zamiast PDF albo zmniejsz plik.",
          });
          return;
        }
        patch(item.id, { step: "Czytam dokument (5 do 20 s)" });
        const fd = new FormData();
        fd.append("file", prepared);
        const res = await fetch("/api/invoices/scan", { method: "POST", body: fd });
        let data: ({ ok: true } & Summary) | { ok: false; error: string; id?: string } | null = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (res.redirected || !data) {
          patch(item.id, {
            status: "error",
            error: res.redirected ? "Sesja wygasła. Zaloguj się ponownie." : "Serwer nie odpowiedział. Spróbuj ponownie.",
          });
          return;
        }
        if (data.ok) patch(item.id, { status: "done", result: data, invoiceId: data.id, step: undefined });
        else patch(item.id, { status: "error", error: data.error, invoiceId: data.id });
      } catch {
        patch(item.id, { status: "error", error: "Brak połączenia. Sprawdź internet i spróbuj ponownie." });
      }
    },
    [patch],
  );

  // Pompa kolejki: do CONCURRENCY dokumentów odczytuje się równocześnie.
  useEffect(() => {
    const working = items.filter((i) => i.status === "working").length;
    const slots = CONCURRENCY - working;
    if (slots <= 0) return;
    const next = items.filter((i) => i.status === "queued" && !started.current.has(i.id)).slice(0, slots);
    for (const it of next) {
      started.current.add(it.id);
      void run(it);
    }
  }, [items, run]);

  const retry = (id: string) => {
    started.current.delete(id);
    patch(id, { status: "queued", error: undefined, step: undefined });
  };
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const total = items.length;
  const finished = items.filter((i) => i.status === "done" || i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const busy = items.some((i) => i.status === "queued" || i.status === "working");
  const attention = items.filter((i) => i.status === "done" && (i.result?.warnings.length ?? 0) > 0).length;

  return (
    <>
      {cameraOpen && (
        <CameraCapture
          multi
          shots={shots}
          onClose={() => {
            setCameraOpen(false);
            setShots(0);
          }}
          onCapture={(f) => {
            setShots((n) => n + 1);
            addFiles([f]);
          }}
        />
      )}

      <div className="ls-actions">
        <button type="button" className="ls-primary" onClick={() => setCameraOpen(true)}>
          <span aria-hidden className="ls-ico">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
          <span>
            <b>Skanuj aparatem</b>
            <small>Kilka dokumentów pod rząd, bez wychodzenia z aparatu</small>
          </span>
        </button>

        <label className="ls-secondary">
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(Array.from(e.currentTarget.files ?? []));
              e.currentTarget.value = "";
            }}
          />
          <span aria-hidden className="ls-ico" data-soft="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </span>
          <span>
            <b>Z galerii lub plików</b>
            <small>Zaznacz wiele zdjęć albo PDF naraz</small>
          </span>
        </label>
      </div>

      {total === 0 && (
        <ul className="ls-tips">
          <li>Faktury i paragony, także z NIP nabywcy. Odczytam sprzedawcę, NIP, numer, datę, kwoty i pozycje.</li>
          <li>Dokument połóż płasko, w dobrym świetle, tak żeby w kadrze były NIP i suma.</li>
          <li>Wszystko zapisuje się od razu jako koszt. Błędy i niepewne pola oznaczę, żebyś mógł je poprawić.</li>
        </ul>
      )}

      {total > 0 && (
        <section className="ls-queue" aria-live="polite">
          <div className="ls-progress">
            <div className="ls-progress-text">
              <b>
                {busy ? `Odczytuję: ${finished} z ${total}` : `Gotowe: ${doneCount} z ${total}`}
              </b>
              {!busy && attention > 0 && <span>{attention} do sprawdzenia</span>}
            </div>
            <div className="ls-bar" aria-hidden>
              <div style={{ width: `${total ? (finished / total) * 100 : 0}%` }} />
            </div>
          </div>

          <ul className="ls-list">
            {items.map((it) => (
              <li key={it.id} className="ls-card" data-status={it.status}>
                <div className="ls-thumb">
                  {it.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumb} alt="" />
                  ) : (
                    <span>PDF</span>
                  )}
                </div>
                <div className="ls-body">
                  {it.status === "queued" && <p className="ls-wait">Czeka w kolejce</p>}
                  {it.status === "working" && (
                    <p className="ls-wait">
                      <span className="ls-spin" aria-hidden /> {it.step ?? "Przetwarzam"}
                    </p>
                  )}
                  {it.status === "error" && (
                    <>
                      <p className="ls-err">{it.error}</p>
                      <div className="ls-row-actions">
                        <button type="button" onClick={() => retry(it.id)}>
                          Spróbuj ponownie
                        </button>
                        {it.invoiceId && <Link href={`/invoices/${it.invoiceId}`}>Uzupełnij ręcznie</Link>}
                        <button type="button" data-quiet="true" onClick={() => remove(it.id)}>
                          Usuń z listy
                        </button>
                      </div>
                    </>
                  )}
                  {it.status === "done" && it.result && <Result r={it.result} />}
                </div>
              </li>
            ))}
          </ul>

          {!busy && doneCount > 0 && (
            <div className="ls-footer">
              <Link href="/invoices" className="ls-cta">
                Przejdź do faktur
              </Link>
              <button type="button" className="ls-cta" data-ghost="true" onClick={() => setCameraOpen(true)}>
                Skanuj kolejne
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Result({ r }: { r: Summary }) {
  return (
    <Link href={`/invoices/${r.id}`} className="ls-result">
      <div className="ls-result-top">
        <div className="min-w-0">
          <p className="ls-supplier">{r.supplier_name ?? "Nieznany sprzedawca"}</p>
          <p className="ls-meta">
            <span className="ls-badge">{r.docType === "paragon" ? "Paragon" : r.docType === "faktura" ? "Faktura" : "Dokument"}</span>
            {r.issue_date && <span>{r.issue_date}</span>}
            {r.invoice_number && <span>nr {r.invoice_number}</span>}
          </p>
        </div>
        <b className="ls-amount">{r.amount_gross !== null ? PLN.format(r.amount_gross) : "brak kwoty"}</b>
      </div>
      <p className="ls-nips">
        NIP sprzedawcy <b>{fmtNip(r.supplier_nip)}</b>
        {r.docType === "paragon" && (
          <>
            {" · "}NIP nabywcy <b>{fmtNip(r.buyer_nip)}</b>
          </>
        )}
      </p>
      {r.warnings.length > 0 ? (
        <ul className="ls-warns">
          {r.warnings.map((w, i) => (
            <li key={i} data-dup={w.startsWith("Taki dokument")}>
              {w}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ls-ok">✓ Odczytano pewnie, nic do sprawdzenia</p>
      )}
      <span className="ls-open">Sprawdź i popraw →</span>
    </Link>
  );
}
