import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadInvoiceXml, listInvoices } from "./client";
import { parseFa } from "./fa";
import type { KsefConnection } from "./sync";
import { createClientRow } from "@/lib/dao/clients";
import { createJob } from "@/lib/dao/jobs";

// Faktury sprzedażowe z KSeF (Artur = wystawca). Zapisujemy je jako osobne
// dokumenty — to one są podstawą PIT/VAT należnego — i próbujemy od razu
// przypiąć do zlecenia (rentowność, oznaczenie „z fakturą").

export type JobCandidate = {
  id: string;
  title: string;
  status: string;
  amount_gross: number | string | null;
  deposit_amount: number | string | null;
  client: { name: string | null; nip: string | null } | null;
};

export type SalesInvoiceLike = {
  buyer_name: string | null;
  buyer_nip: string | null;
  amount_gross: number | string;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9 ]/g, " ");

const tokens = (s: string | null) => new Set(normalize(s ?? "").split(/\s+/).filter((t) => t.length >= 4));

/** Ocena dopasowania faktury do zlecenia: NIP, nazwisko/nazwa klienta, kwota. */
export function scoreJob(inv: SalesInvoiceLike, job: JobCandidate): { score: number; name: boolean; amount: boolean } {
  const nip = !!inv.buyer_nip && !!job.client?.nip && inv.buyer_nip === job.client.nip.replace(/\D/g, "");
  const buyer = tokens(inv.buyer_name);
  const name = nip || [...tokens(job.client?.name ?? null)].some((t) => buyer.has(t));
  const gross = Number(inv.amount_gross);
  const total = Number(job.amount_gross ?? 0);
  const deposit = Number(job.deposit_amount ?? 0);
  const near = (x: number) => x > 0 && Math.abs(x - gross) <= 1;
  // Faktura na całość, na zaliczkę albo na pozostałą kwotę po zaliczce.
  const amount = near(total) || near(deposit) || near(total - deposit);
  return { score: (nip ? 3 : name ? 2 : 0) + (amount ? 2 : 0), name, amount };
}

export async function listJobCandidates(supabase: SupabaseClient, userId: string): Promise<JobCandidate[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, status, amount_gross, deposit_amount, client:clients(name, nip)")
    .eq("user_id", userId)
    .neq("status", "cancelled");
  if (error) throw error;
  return (data ?? []) as unknown as JobCandidate[];
}

/** Przypina fakturę do zlecenia i oznacza zlecenie jako „z fakturą". */
export async function linkSalesInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  jobId: string | null
): Promise<void> {
  const { data: inv, error } = await supabase
    .from("sales_invoices")
    .update({ job_id: jobId, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .select("vat_rate, invoice_number, issue_date")
    .single();
  if (error) throw error;
  if (!jobId) return;
  const patch: Record<string, unknown> = {
    invoiced: true,
    invoice_number: inv.invoice_number,
    invoice_date: inv.issue_date,
  };
  if (inv.vat_rate !== null) patch.vat_rate = inv.vat_rate;
  await supabase.from("jobs").update(patch).eq("id", jobId);
}

export async function syncSales(
  supabase: SupabaseClient,
  conn: KsefConnection,
  accessToken: string,
  maxPerRun: number
): Promise<{ added: number; matched: number; more: boolean } | null> {
  // Bez migracji 0051 po prostu pomijamy sprzedaż.
  const probe = await supabase.from("sales_invoices").select("id").limit(1);
  if (probe.error) return null;

  const from = new Date(conn.sales_synced_until ?? conn.sync_from);
  const { invoices: found, syncedUntil } = await listInvoices(accessToken, "Subject1", from);

  const known = new Set<string>();
  for (let i = 0; i < found.length; i += 100) {
    const { data, error } = await supabase
      .from("sales_invoices")
      .select("ksef_number")
      .eq("user_id", conn.user_id)
      .in("ksef_number", found.slice(i, i + 100).map((f) => f.ksefNumber));
    if (error) throw error;
    for (const r of data ?? []) known.add(r.ksef_number as string);
  }

  const fresh = found
    .filter((f) => !known.has(f.ksefNumber))
    .sort((a, b) => a.permanentStorageDate.localeCompare(b.permanentStorageDate));
  const batch = fresh.slice(0, maxPerRun);
  const more = fresh.length > batch.length;
  const jobs = batch.length > 0 ? await listJobCandidates(supabase, conn.user_id) : [];

  let added = 0;
  let matched = 0;
  for (const meta of batch) {
    const xml = await downloadInvoiceXml(accessToken, meta.ksefNumber);
    const fa = parseFa(xml);
    const filePath = `${conn.user_id}/ksef-sprzedaz/${meta.ksefNumber}.xml`;
    const { error: upErr } = await supabase.storage
      .from("invoices")
      .upload(filePath, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert: true });
    if (upErr) throw new Error(`Zapis XML faktury ${meta.invoiceNumber}: ${upErr.message}`);

    const rates = new Set(fa.lines.map((l) => l.vatRate));
    const buyerId = meta.buyer?.identifier;
    const row = {
      user_id: conn.user_id,
      ksef_number: meta.ksefNumber,
      invoice_number: meta.invoiceNumber,
      invoice_type: meta.invoiceType,
      issue_date: meta.issueDate,
      buyer_name: meta.buyer?.name ?? null,
      buyer_nip: buyerId?.type === "Nip" ? (buyerId.value ?? null) : null,
      amount_net: meta.netAmount,
      amount_vat: meta.vatAmount,
      amount_gross: meta.grossAmount,
      vat_rate: rates.size === 1 ? [...rates][0] : null,
      payment_due: fa.paymentDue,
      paid: fa.paid,
      paid_date: fa.paid ? (fa.paidDate ?? meta.issueDate) : null,
      lines: fa.lines,
      file_path: filePath,
    };
    const { data: inserted, error } = await supabase.from("sales_invoices").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    added++;

    // Automatycznie tylko przy jednoznacznym trafieniu: klient + kwota.
    const scored = jobs
      .map((j) => ({ j, s: scoreJob(row, j) }))
      .filter((x) => x.s.name && x.s.amount)
      .sort((a, b) => b.s.score - a.s.score);
    if (scored.length === 1 || (scored.length > 1 && scored[0].s.score > scored[1].s.score)) {
      await linkSalesInvoice(supabase, inserted.id, scored[0].j.id);
      matched++;
    }
  }

  const until = more ? batch[batch.length - 1].permanentStorageDate : syncedUntil;
  await supabase.from("ksef_connections").update({ sales_synced_until: until }).eq("user_id", conn.user_id);
  return { added, matched, more };
}

/**
 * Faktura bez zlecenia w aplikacji (np. drobny montaż) — zakłada klienta
 * i zlecenie z danych faktury, od razu „z fakturą" i jako wykonane.
 * Tylko z sesji użytkownika (DAO bierze user_id z sesji).
 */
export async function createJobFromSalesInvoice(supabase: SupabaseClient, invoiceId: string): Promise<string> {
  const { data: inv, error } = await supabase.from("sales_invoices").select("*").eq("id", invoiceId).single();
  if (error) throw error;

  let clientId: string | null = null;
  if (inv.buyer_nip) {
    const { data } = await supabase.from("clients").select("id").eq("nip", inv.buyer_nip).limit(1);
    clientId = data?.[0]?.id ?? null;
  }
  if (!clientId && inv.buyer_name) {
    const { data } = await supabase.from("clients").select("id").ilike("name", inv.buyer_name).limit(1);
    clientId = data?.[0]?.id ?? null;
  }
  if (!clientId) {
    const client = await createClientRow({
      type: inv.buyer_nip ? "company" : "individual",
      name: inv.buyer_name ?? "Klient z faktury",
      nip: inv.buyer_nip,
    });
    clientId = client.id;
  }

  const firstLine = (inv.lines as { name: string }[] | null)?.[0]?.name;
  const job = await createJob({
    client_id: clientId,
    title: (firstLine ?? `Faktura ${inv.invoice_number ?? ""}`).slice(0, 120),
    amount_gross: Number(inv.amount_gross),
    vat_rate: inv.vat_rate === null ? 0.23 : Number(inv.vat_rate),
    status: inv.paid ? "settled" : "installed",
    completed_date: inv.issue_date,
    paid_date: inv.paid ? inv.paid_date : null,
    invoiced: true,
    invoice_number: inv.invoice_number,
    invoice_date: inv.issue_date,
  });
  await linkSalesInvoice(supabase, invoiceId, job.id);
  return job.id;
}
