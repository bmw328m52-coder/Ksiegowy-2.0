"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate, fmtPLN } from "@/lib/format";
import { OCR_STATUS_LABELS } from "@/lib/dao/invoices.types";

type InvoiceLite = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  amount_gross: string | null;
  ocr_status: keyof typeof OCR_STATUS_LABELS;
  file_mime: string | null;
};

export default function InvoicesListClient({
  invoices,
  categoriesMap,
  thumbsMap,
}: {
  invoices: InvoiceLite[];
  categoriesMap: Record<string, string[]>;
  thumbsMap: Record<string, string | null>;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((inv) => {
      const s = (inv.supplier_name ?? "").toLowerCase();
      const n = (inv.invoice_number ?? "").toLowerCase();
      return s.includes(needle) || n.includes(needle);
    });
  }, [invoices, q]);

  if (invoices.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj dostawcy lub numeru…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-9 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#282624]/20"
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

      {q && (
        <p className="text-xs text-zinc-500">
          Pasuje {filtered.length} z {invoices.length}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          Brak wyników dla &quot;{q}&quot;.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
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
                    {categoriesMap[inv.id]?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {categoriesMap[inv.id].map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
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
