import PageHeader from "@/components/PageHeader";
import { PageContainer } from "@/components/ui";
import { listInvoices } from "@/lib/dao/invoices";
import { createClient } from "@/lib/supabase/server";
import GrantPicker, { type GrantRow } from "./GrantPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zakupy z dotacji" };

// Sprzęt/maszyny — podpowiedź, co mogło być kupione z dotacji. Artur decyduje.
const EQUIPMENT =
  /frezark|ukośnic|ukosnic|pilark|pi[łl]a\b|szlifierk|odkurzacz|wkr[eę]tark|wiertark|lamello|ścisk|scisk|st[oó][łl] warsztat|przyssawk|odci[aą]g|szyna prowadz|poziomic|kozio[łl]|laptop|ipad|tablet|szablon|tarcz|frez\b|kaseta z wiert/i;
const GRANT_SUPPLIERS = /pakdrew|bajdrew|ka-?meb/i;

export default async function GrantPage() {
  const supabase = await createClient();
  const [invoices, linesRes] = await Promise.all([
    listInvoices(),
    supabase.from("cost_lines").select("invoice_id, description").not("invoice_id", "is", null),
  ]);

  const descByInvoice = new Map<string, string[]>();
  for (const l of linesRes.data ?? []) {
    const list = descByInvoice.get(l.invoice_id as string) ?? [];
    list.push(l.description as string);
    descByInvoice.set(l.invoice_id as string, list);
  }

  const rows: GrantRow[] = invoices
    .filter((inv) => Number(inv.amount_gross ?? 0) > 0)
    .map((inv) => {
      const lines = descByInvoice.get(inv.id) ?? [];
      return {
        id: inv.id,
        supplier: inv.supplier_name ?? "—",
        number: inv.invoice_number,
        date: inv.issue_date,
        net: Number(inv.amount_net ?? 0),
        vat: Number(inv.amount_vat ?? 0),
        gross: Number(inv.amount_gross ?? 0),
        summary: lines.slice(0, 2).join(" · "),
        suggested:
          GRANT_SUPPLIERS.test(inv.supplier_name ?? "") || lines.some((d) => EQUIPMENT.test(d)),
        checked: inv.funded_by_grant === true,
      };
    })
    .sort((a, b) => Number(b.checked) - Number(a.checked) || Number(b.suggested) - Number(a.suggested) || b.gross - a.gross);

  return (
    <PageContainer width="narrow">
      <PageHeader title="Zakupy z dotacji" back={{ href: "/invoices" }} />
      <p className="text-xs text-[#6f6c66] -mt-1">
        Zaznacz faktury opłacone z dotacji. Nie wejdą do kosztów ani PIT (wydatek z dotacji zwolnionej z
        podatku nie jest kosztem), a ich VAT pokaże się osobno — zwykle trzeba go oddać do PUP, sprawdź umowę.
      </p>
      <GrantPicker rows={rows} />
    </PageContainer>
  );
}
