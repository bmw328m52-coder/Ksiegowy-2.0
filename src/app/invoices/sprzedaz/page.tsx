import PageHeader from "@/components/PageHeader";
import { PageContainer, EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { listJobCandidates, scoreJob } from "@/lib/ksef/sales";
import SalesInvoiceCard, { type SalesRow } from "./SalesInvoiceCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Faktury sprzedażowe" };

export default async function SalesInvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: invoices, error } = await supabase
    .from("sales_invoices")
    .select("id, ksef_number, invoice_number, invoice_type, issue_date, buyer_name, buyer_nip, amount_net, amount_vat, amount_gross, paid, lines, job_id")
    .order("issue_date", { ascending: false });

  const jobs = user ? await listJobCandidates(supabase, user.id) : [];
  const jobLabel = (j: (typeof jobs)[number]) => `${j.client?.name ?? "—"} · ${j.title}`;

  const rows: SalesRow[] = (invoices ?? []).map((inv) => {
    const ranked = jobs
      .map((j) => ({ j, s: scoreJob(inv, j) }))
      .sort((a, b) => b.s.score - a.s.score || jobLabel(a.j).localeCompare(jobLabel(b.j), "pl"));
    const linked = jobs.find((j) => j.id === inv.job_id);
    return {
      id: inv.id,
      number: inv.invoice_number,
      type: inv.invoice_type,
      date: inv.issue_date,
      buyer: inv.buyer_name ?? "—",
      net: Number(inv.amount_net),
      vat: Number(inv.amount_vat),
      gross: Number(inv.amount_gross),
      paid: inv.paid,
      summary: ((inv.lines as { name: string }[] | null) ?? []).map((l) => l.name).slice(0, 2).join(" · "),
      jobId: inv.job_id,
      jobLabel: linked ? jobLabel(linked) : null,
      options: ranked.map(({ j, s }) => ({ id: j.id, label: jobLabel(j), suggested: s.name })),
    };
  });

  const unlinked = rows.filter((r) => !r.jobId).length;

  return (
    <PageContainer width="narrow">
      <PageHeader title="Faktury sprzedażowe" back={{ href: "/invoices" }} />
      {error ? (
        <EmptyState
          icon={<span className="text-lg">🧾</span>}
          title="Brak tabeli faktur sprzedażowych"
          hint="Wgraj migrację 0051 w Supabase (SQL Editor), potem kliknij „Pobierz z KSeF”."
          tone="neutral"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<span className="text-lg">🧾</span>}
          title="Brak faktur sprzedażowych"
          hint="Kliknij „Pobierz z KSeF” w Fakturach — pobiorą się faktury, które wystawiłeś."
          cta={{ href: "/invoices", label: "Wróć do faktur" }}
          tone="neutral"
        />
      ) : (
        <>
          <p className="text-xs text-[#6f6c66] -mt-1">
            Z tych faktur liczy się PIT i VAT należny. Przypięcie do zlecenia oznacza je jako „z fakturą” i
            liczy rentowność.
            {unlinked > 0 ? ` Do przypisania: ${unlinked}.` : ""}
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id}>
                <SalesInvoiceCard row={r} />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
