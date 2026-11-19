import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listInvoices } from "@/lib/dao/invoices";
import { PageContainer } from "@/components/ui";
import CopyDeck, { type DeckDoc } from "./CopyDeck";
import { pitCostShare } from "@/lib/dao/cost_lines.types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Przepisz do ING" };

type LineRow = {
  invoice_id: string;
  description: string | null;
  vat_rate: string | number | null;
  amount_net: string | number;
  amount_vat: string | number;
  amount_gross: string | number;
  qty: string | number | null;
  vat_deduction: number | null;
  category: string | null;
};

/** Stare wartości angielskie (migracja 0043) i słowa z KSeF -> jedna lista. */
function normPayment(m: string | null): string {
  const v = (m ?? "").toLowerCase();
  if (v === "transfer" || v === "przelew") return "przelew";
  if (v === "cash" || v === "gotówka") return "gotówka";
  if (v === "card" || v === "karta") return "karta";
  if (v === "blik" || v === "mobilna") return "mobilna";
  return "";
}

const MONTHS_PL = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const monthLabel = (m: string) => (m === "brak" ? "Bez daty" : `${MONTHS_PL[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`);

export default async function CopyToIngPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const all = await listInvoices();
  const allPending = all
    .filter(
      (i) =>
        (i.accounting_status === "not_sent" || i.accounting_status === "ready") &&
        !i.ksef_number &&
        i.doc_source !== "ksef" &&
        Number(i.amount_gross) > 0
    )
    .sort((a, b) => (a.issue_date ?? "").localeCompare(b.issue_date ?? ""));

  const monthOf = (i: { issue_date: string | null }) => (i.issue_date ? i.issue_date.slice(0, 7) : "brak");
  const counts = new Map<string, number>();
  for (const i of allPending) counts.set(monthOf(i), (counts.get(monthOf(i)) ?? 0) + 1);
  const months = Array.from(counts.keys()).sort();
  // Domyślnie miesiąc księgowy, który się właśnie zamyka (poprzedni kalendarzowy), jeśli ma dokumenty;
  // inaczej najstarszy z dokumentami. ?m=rrrr-mm wybiera inny.
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const month = m && counts.has(m) ? m : counts.has(prevKey) ? prevKey : (months[0] ?? "");
  const pending = allPending.filter((i) => monthOf(i) === month);

  let docs: DeckDoc[] = [];
  if (pending.length > 0) {
    const supabase = await createClient();
    const [{ data: signed }, { data: lines }] = await Promise.all([
      supabase.storage.from("invoices").createSignedUrls(
        pending.map((i) => i.file_path),
        3600
      ),
      supabase
        .from("cost_lines")
        .select("invoice_id, description, vat_rate, amount_net, amount_vat, amount_gross, qty, vat_deduction, category")
        .in(
          "invoice_id",
          pending.map((i) => i.id)
        ),
    ]);
    const urlByPath = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
    const namesByInvoice = new Map<string, string[]>();
    for (const l of (lines ?? []) as LineRow[]) {
      if (l.description) namesByInvoice.set(l.invoice_id, [...(namesByInvoice.get(l.invoice_id) ?? []), l.description]);
    }
    const linesByInvoice = new Map<string, LineRow[]>();
    for (const l of (lines ?? []) as LineRow[]) {
      linesByInvoice.set(l.invoice_id, [...(linesByInvoice.get(l.invoice_id) ?? []), l]);
    }
    const byInvoice = new Map<string, Map<string, { rate: number | null; net: number; vat: number; gross: number }>>();
    for (const l of (lines ?? []) as LineRow[]) {
      const rate = l.vat_rate === null ? null : Number(l.vat_rate);
      const key = String(rate);
      const m = byInvoice.get(l.invoice_id) ?? new Map();
      const cur = m.get(key) ?? { rate, net: 0, vat: 0, gross: 0 };
      cur.net += Number(l.amount_net) || 0;
      cur.vat += Number(l.amount_vat) || 0;
      cur.gross += Number(l.amount_gross) || 0;
      m.set(key, cur);
      byInvoice.set(l.invoice_id, m);
    }

    docs = pending.map((i) => {
      const raw = i.ocr_raw as {
        document_type?: string;
        buyer_nip?: string | null;
        order_number?: string | null;
        category?: string | null;
        warnings?: string[];
        supplier_address?: { street: string | null; postal_code: string | null; city: string | null } | null;
      } | null;
      return {
        id: i.id,
        url: urlByPath.get(i.file_path) ?? null,
        isPdf: i.file_mime === "application/pdf",
        supplier: i.supplier_name ?? "",
        nip: i.supplier_nip ?? "",
        buyerNip: raw?.buyer_nip ?? "",
        orderNumber: raw?.order_number ?? "",
        street: raw?.supplier_address?.street ?? "",
        postal: raw?.supplier_address?.postal_code ?? "",
        city: raw?.supplier_address?.city ?? "",
        paymentMethod: normPayment(i.payment_method),
        number: i.invoice_number ?? "",
        date: i.issue_date,
        net: i.amount_net === null ? null : Number(i.amount_net),
        vat: i.amount_vat === null ? null : Number(i.amount_vat),
        gross: Number(i.amount_gross) || 0,
        rate: i.vat_rate === null ? null : Number(i.vat_rate),
        kind: raw?.document_type === "paragon" || i.doc_source === "receipt" ? "paragon" : "faktura",
        category: raw?.category ?? null,
        itemName: (() => {
          const names = namesByInvoice.get(i.id) ?? [];
          if (names.length === 1) return names[0].slice(0, 80);
          return raw?.category ? `Zakupy: ${raw.category}` : "Zakupy materiałowe";
        })(),
        vatDeduction: Math.min(...(linesByInvoice.get(i.id) ?? [{ vat_deduction: 100 }]).map((l) => l.vat_deduction ?? 100)),
        pitShare: Math.min(...(linesByInvoice.get(i.id) ?? [{ category: raw?.category ?? null }]).map((l) => pitCostShare(l.category ?? raw?.category ?? null))),
        lines: (linesByInvoice.get(i.id) ?? []).map((l) => ({
          name: (l.description ?? "").slice(0, 200),
          qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
          rate: l.vat_rate === null ? null : Number(l.vat_rate),
          net: Number(l.amount_net) || 0,
          vat: Number(l.amount_vat) || 0,
          gross: Number(l.amount_gross) || 0,
        })),
        breakdown: Array.from(byInvoice.get(i.id)?.values() ?? []).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)),
        warnings: raw?.warnings ?? [],
      };
    });
  }

  return (
    <PageContainer width="wide" className="lv-home">
      <header className="lf-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lv-eyebrow">Księgowość ING</p>
            <h1 className="lv-hello">
              Przepisz do ING
              <span>Jeden dokument na ekran, każde pole kopiujesz jednym dotknięciem</span>
            </h1>
          </div>
          <Link href="/finanse/ksiegowosc" className="lj-back" aria-label="Wróć do księgowości">
            ✕
          </Link>
        </div>
      </header>
      {months.length > 1 && (
        <nav className="flex flex-wrap gap-2 mb-3" aria-label="Miesiąc dokumentów">
          {months.map((mo) => (
            <Link
              key={mo}
              href={`/finanse/ksiegowosc/przepisz?m=${mo}`}
              aria-current={mo === month ? "page" : undefined}
              className={`text-[13px] px-3.5 min-h-[44px] inline-flex items-center rounded-full font-semibold ${
                mo === month ? "bg-[#a06f3f] text-white" : "bg-white border border-[#ededea] text-[#6f6c66]"
              }`}
            >
              {monthLabel(mo)} · {counts.get(mo)}
            </Link>
          ))}
        </nav>
      )}
      <CopyDeck key={month} docs={docs} />
    </PageContainer>
  );
}
