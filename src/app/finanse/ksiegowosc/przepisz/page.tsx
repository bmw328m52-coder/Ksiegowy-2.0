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

export default async function CopyToIngPage() {
  const all = await listInvoices();
  const pending = all
    .filter(
      (i) =>
        (i.accounting_status === "not_sent" || i.accounting_status === "ready") &&
        !i.ksef_number &&
        i.doc_source !== "ksef" &&
        Number(i.amount_gross) > 0
    )
    .sort((a, b) => (a.issue_date ?? "").localeCompare(b.issue_date ?? ""));

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
        .select("invoice_id, description, vat_rate, amount_net, amount_vat, amount_gross, vat_deduction, category")
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
      <CopyDeck docs={docs} />
    </PageContainer>
  );
}
