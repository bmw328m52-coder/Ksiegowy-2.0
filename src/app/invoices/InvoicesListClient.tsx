"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate, fmtPLN } from "@/lib/format";
import { OCR_STATUS_LABELS, isOverdueUnpaid } from "@/lib/dao/invoices.types";
import type { InvoicePreviewLine } from "@/lib/dao/cost_lines";

type InvoiceLite = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  amount_gross: string | null;
  ocr_status: keyof typeof OCR_STATUS_LABELS;
  file_mime: string | null;
  funded_by_grant?: boolean;
  amount_net?: string | null;
  amount_vat?: string | null;
  payment_due: string | null;
  payment_status?: string | null;
};

export default function InvoicesListClient({
  invoices,
  categoriesMap,
  thumbsMap,
  assignedIds,
  showAll = false,
  previewLines,
  today,
}: {
  invoices: InvoiceLite[];
  categoriesMap: Record<string, string[]>;
  thumbsMap: Record<string, string | null>;
  /** Faktury w całości przypięte do zleceń — domyślnie schowane, żeby lista była „do ogarnięcia”. */
  assignedIds: string[];
  /** Widok „Po terminie” — pokazuj wszystko, nic nie chowaj. */
  showAll?: boolean;
  previewLines: Record<string, InvoicePreviewLine[]>;
  today: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showAssigned, setShowAssigned] = useState(false);
  const assigned = useMemo(() => new Set(assignedIds), [assignedIds]);
  // Schowane: przypięte w całości do zleceń + zakupy z dotacji PUP (mają swój ekran).
  const isHidden = useMemo(
    () => (inv: InvoiceLite) => assigned.has(inv.id) || inv.funded_by_grant === true,
    [assigned],
  );
  const jobCount = invoices.filter((inv) => assigned.has(inv.id)).length;
  const grantCount = invoices.filter((inv) => inv.funded_by_grant === true && !assigned.has(inv.id)).length;
  const hiddenCount = jobCount + grantCount;
  const hiddenLabel = [jobCount > 0 ? `${jobCount} w zleceniach` : null, grantCount > 0 ? `${grantCount} z dotacji` : null]
    .filter(Boolean)
    .join(", ");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Szukanie przeszukuje wszystko, także przypisane.
    if (!needle) return showAssigned || showAll ? invoices : invoices.filter((inv) => !isHidden(inv));
    return invoices.filter((inv) => {
      const s = (inv.supplier_name ?? "").toLowerCase();
      const n = (inv.invoice_number ?? "").toLowerCase();
      return s.includes(needle) || n.includes(needle);
    });
  }, [invoices, q, showAssigned, showAll, isHidden]);

  if (invoices.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj dostawcy lub numeru…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-9 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Szukaj faktur"
        />
        <SearchIcon />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Wyczyść"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 active:scale-95"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {!q && !showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAssigned((v) => !v)}
          className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-600 active:bg-zinc-50"
        >
          {showAssigned
            ? `Schowaj ogarnięte (${hiddenLabel})`
            : `Pokaż schowane (${hiddenLabel})`}
        </button>
      )}

      {q && (
        <p className="text-xs text-zinc-500">
          Pasuje {filtered.length} z {invoices.length}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          {q ? <>Brak wyników dla &quot;{q}&quot;.</> : "Wszystko ogarnięte — faktury są w zleceniach albo w dotacji 👍"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((inv) => (
            <li key={inv.id}>
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId((cur) => (cur === inv.id ? null : inv.id))}
                  aria-expanded={openId === inv.id}
                  className="block w-full text-left p-3 active:bg-zinc-50"
                >
                  <div className="flex items-start gap-3">
                    <Thumbnail
                      src={thumbsMap[inv.id] ?? null}
                      mime={inv.file_mime}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{inv.supplier_name ?? "—"}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {inv.invoice_number ?? "bez numeru"} • {fmtDate(inv.issue_date)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-medium text-sm">{fmtPLN(inv.amount_gross)}</span>
                          <StatusBadge status={inv.ocr_status} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {isOverdueUnpaid(inv, today) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f4e0d9] text-[#7a2f1e] font-medium">
                              po terminie
                            </span>
                          )}
                          {(categoriesMap[inv.id] ?? []).map((c) => (
                            <span
                              key={c}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <span
                          className={`shrink-0 text-xs text-zinc-400 transition-transform ${openId === inv.id ? "rotate-180" : ""}`}
                          aria-hidden
                        >
                          ▾
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                {openId === inv.id && (
                  <InvoicePreview inv={inv} lines={previewLines[inv.id] ?? []} today={today} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumbnail({ src, mime }: { src: string | null; mime: string | null }) {
  const isImage = (mime ?? "").startsWith("image/");
  if (isImage && src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-12 h-12 rounded-md object-cover bg-zinc-100 shrink-0"
      />
    );
  }
  if (mime === "application/xml") {
    return (
      <div className="w-12 h-12 rounded-md bg-[#282624] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
        KSeF
      </div>
    );
  }
  if (mime === "application/pdf") {
    return (
      <div className="w-12 h-12 rounded-md bg-red-50 border border-red-200 flex items-center justify-center text-red-700 text-[10px] font-bold shrink-0">
        PDF
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-zinc-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
      </svg>
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof OCR_STATUS_LABELS }) {
  const cls: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-600",
    processing: "bg-blue-50 text-blue-700",
    done: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    manual: "bg-amber-50 text-amber-700",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${cls[status] ?? cls.pending}`}>
      {OCR_STATUS_LABELS[status]}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function InvoicePreview({
  inv,
  lines,
  today,
}: {
  inv: InvoiceLite;
  lines: InvoicePreviewLine[];
  today: string;
}) {
  const paid = inv.payment_status === "paid";
  const overdue = isOverdueUnpaid(inv, today);
  const jobs = [...new Set(lines.map((l) => l.job_title ?? "koszt ogólny"))];
  return (
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-2.5 text-xs space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-600">
        {inv.amount_net != null && (
          <span>
            netto <span className="tabular-nums text-zinc-900">{fmtPLN(inv.amount_net)}</span>
            {inv.amount_vat != null && (
              <> · VAT <span className="tabular-nums text-zinc-900">{fmtPLN(inv.amount_vat)}</span></>
            )}
          </span>
        )}
        <span className={paid ? "text-[#3a6b4d]" : overdue ? "text-[#b8523a] font-medium" : ""}>
          {paid ? "✓ zapłacona" : inv.payment_due ? `termin ${fmtDate(inv.payment_due)}` : "niezapłacona"}
        </span>
        {inv.funded_by_grant && <span className="text-[#a06f3f]">z dotacji</span>}
      </div>
      {lines.length > 0 && (
        <p className="text-zinc-600">
          Zlecenie: <span className="text-zinc-900">{jobs.join(", ")}</span>
        </p>
      )}
      {lines.length === 0 ? (
        <p className="text-zinc-500">Brak pozycji.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
              <span className="min-w-0 break-words text-zinc-800">{l.description}</span>
              <span className="shrink-0 tabular-nums text-zinc-900">{fmtPLN(l.amount_gross)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/invoices/${inv.id}`}
        className="flex items-center justify-center rounded-lg bg-[#a06f3f] py-2 text-xs font-semibold text-white active:opacity-90"
      >
        Otwórz fakturę →
      </Link>
    </div>
  );
}
