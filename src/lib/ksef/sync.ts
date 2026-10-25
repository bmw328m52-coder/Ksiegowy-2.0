import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateWithToken, downloadInvoiceXml, listPurchaseInvoices, type KsefInvoiceMetadata } from "./client";
import { parseFa, type FaLine } from "./fa";
import { decryptSecret } from "./secret";
import { suggestedVatDeduction } from "@/lib/dao/cost_lines.types";

export type KsefConnection = {
  user_id: string;
  nip: string;
  token_enc: string;
  sync_from: string;
  synced_until: string | null;
  last_sync_at: string | null;
  last_sync_added: number | null;
  last_error: string | null;
};

export type KsefSyncResult = { added: number; linked: number; skipped: number; more: boolean };

// Jedno przebiegnięcie nie pobiera więcej faktur — reszta przyjdzie w kolejnym
// (cron codziennie albo ponowne kliknięcie), żeby nie przekroczyć czasu funkcji.
const MAX_PER_RUN = 60;

/**
 * Pobiera nowe faktury zakupowe z KSeF i zapisuje je jako faktury + pozycje kosztów.
 * Klient Supabase może być sesyjny (przycisk) albo service-role (cron) — dlatego
 * user_id podawany jawnie.
 */
export async function syncKsef(supabase: SupabaseClient, userId: string): Promise<KsefSyncResult> {
  const { data: conn, error: connErr } = await supabase
    .from("ksef_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<KsefConnection>();
  if (connErr) throw connErr;
  if (!conn) throw new Error("KSeF nie jest podłączony — dodaj token w Ustawieniach.");

  try {
    const result = await runSync(supabase, conn);
    await supabase
      .from("ksef_connections")
      .update({ last_sync_at: new Date().toISOString(), last_sync_added: result.added, last_error: null })
      .eq("user_id", userId);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("ksef_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: msg.slice(0, 500) })
      .eq("user_id", userId);
    throw new Error(msg);
  }
}

async function runSync(supabase: SupabaseClient, conn: KsefConnection): Promise<KsefSyncResult> {
  const accessToken = await authenticateWithToken(decryptSecret(conn.token_enc), conn.nip);
  const from = new Date(conn.synced_until ?? conn.sync_from);
  const { invoices: found, syncedUntil } = await listPurchaseInvoices(accessToken, from);

  // Już zapisane po numerze KSeF
  const known = new Set<string>();
  for (let i = 0; i < found.length; i += 100) {
    const chunk = found.slice(i, i + 100).map((f) => f.ksefNumber);
    const { data, error } = await supabase
      .from("invoices")
      .select("ksef_number")
      .eq("user_id", conn.user_id)
      .in("ksef_number", chunk);
    if (error) throw error;
    for (const r of data ?? []) known.add(r.ksef_number as string);
  }

  const fresh = found
    .filter((f) => !known.has(f.ksefNumber))
    .sort((a, b) => a.permanentStorageDate.localeCompare(b.permanentStorageDate));
  const batch = fresh.slice(0, MAX_PER_RUN);
  const more = fresh.length > batch.length;

  let added = 0;
  let linked = 0;
  for (const meta of batch) {
    if (await linkExistingUpload(supabase, conn.user_id, meta)) {
      linked++;
      continue;
    }
    const xml = await downloadInvoiceXml(accessToken, meta.ksefNumber);
    await saveInvoice(supabase, conn.user_id, meta, xml);
    added++;
  }

  // Znacznik przesuwamy tylko do miejsca, które naprawdę przerobiliśmy.
  const until = more ? batch[batch.length - 1].permanentStorageDate : syncedUntil;
  await supabase.from("ksef_connections").update({ synced_until: until }).eq("user_id", conn.user_id);

  return { added, linked, skipped: found.length - fresh.length, more };
}

/**
 * Faktura mogła zostać wcześniej wgrana ręcznie (zdjęcie/PDF + OCR). Wtedy nie
 * dublujemy — tylko dopisujemy numer KSeF do istniejącego wpisu.
 */
async function linkExistingUpload(
  supabase: SupabaseClient,
  userId: string,
  meta: KsefInvoiceMetadata
): Promise<boolean> {
  const { data } = await supabase
    .from("invoices")
    .select("id")
    .eq("user_id", userId)
    .is("ksef_number", null)
    .eq("supplier_nip", meta.seller.nip)
    .eq("invoice_number", meta.invoiceNumber)
    .limit(1);
  const existing = data?.[0];
  if (!existing) return false;
  await supabase.from("invoices").update({ ksef_number: meta.ksefNumber }).eq("id", existing.id);
  return true;
}

async function saveInvoice(
  supabase: SupabaseClient,
  userId: string,
  meta: KsefInvoiceMetadata,
  xml: string
): Promise<void> {
  const fa = parseFa(xml);
  const supplierName = meta.seller.name ?? fa.sellerName;
  const filePath = `${userId}/ksef/${meta.ksefNumber}.xml`;

  const { error: upErr } = await supabase.storage
    .from("invoices")
    .upload(filePath, Buffer.from(xml, "utf8"), { contentType: "application/xml", upsert: true });
  if (upErr) throw new Error(`Zapis XML faktury ${meta.invoiceNumber}: ${upErr.message}`);

  const net = meta.netAmount;
  const vat = meta.vatAmount;
  const gross = meta.grossAmount;
  const rates = new Set(fa.lines.map((l) => l.vatRate));
  const singleRate = rates.size === 1 ? [...rates][0] : null;

  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      file_path: filePath,
      file_mime: "application/xml",
      ocr_status: "done",
      doc_source: "ksef",
      ksef_number: meta.ksefNumber,
      supplier_name: supplierName,
      supplier_nip: meta.seller.nip,
      invoice_number: meta.invoiceNumber,
      issue_date: meta.issueDate,
      payment_due: fa.paymentDue,
      amount_net: net,
      amount_vat: vat,
      amount_gross: gross,
      vat_rate: singleRate,
      payment_status: fa.paid ? "paid" : "unpaid",
      paid_date: fa.paid ? (fa.paidDate ?? meta.issueDate) : null,
      payment_method: fa.paymentMethod,
      notes: fa.isCorrection ? "Faktura korygująca (KSeF)" : null,
    })
    .select("id")
    .single();
  if (invErr) {
    // Równoległa synchronizacja (cron + przycisk) zdążyła zapisać tę samą fakturę.
    if (invErr.code === "23505") return;
    throw invErr;
  }

  const fallbackCategory = guessCategory(supplierName, fa.lines);
  const linesSum = fa.lines.reduce((a, l) => a + l.gross, 0);
  // Pozycje z XML tylko gdy sumują się do kwoty faktury (korekty, rabaty itp.
  // potrafią to rozjechać) — inaczej jedna pozycja zbiorcza z metadanych.
  const useLines = fa.lines.length > 0 && Math.abs(linesSum - gross) <= 1;

  const rows = (
    useLines
      ? fa.lines.map((l) => ({
          description: describeLine(l),
          amount_net: l.net,
          amount_vat: l.vat,
          amount_gross: l.gross,
          qty: l.qty ?? 1,
          vat_rate: l.vatRate,
          category: guessCategory(supplierName, [l]) ?? fallbackCategory,
        }))
      : [
          {
            description: [supplierName, meta.invoiceNumber].filter(Boolean).join(" — ") || "Faktura z KSeF",
            amount_net: net,
            amount_vat: vat,
            amount_gross: gross,
            qty: 1,
            vat_rate: singleRate,
            category: fallbackCategory,
          },
        ]
  ).map((r) => ({
    ...r,
    category: r.category ?? "inne",
    user_id: userId,
    invoice_id: inv.id,
    cost_date: meta.issueDate,
    vat_deduction: suggestedVatDeduction(r.category ?? "inne"),
  }));

  const { error: lineErr } = await supabase.from("cost_lines").insert(rows);
  if (lineErr) throw lineErr;
}

function describeLine(l: FaLine): string {
  if (l.qty && l.qty !== 1) {
    const qty = l.qty.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
    return `${l.name} (${qty}${l.unit ? ` ${l.unit}` : ""})`;
  }
  return l.name;
}

// Podpowiedź kategorii po dostawcy i nazwie pozycji — Artur może ją zmienić.
const CATEGORY_RULES: { match: RegExp; category: string }[] = [
  { match: /orlen|\bbp\b|shell|circle\s?k|moya|lotos|amic|olej nap|benzyn|\bpb\s?95|\blpg\b|paliw/i, category: "paliwo" },
  { match: /zimex|p[łl]yt|formatk|hdf|mdf|blat|obrze|okleina|laminat|sklejk|drewn/i, category: "płyty/drewno" },
  { match: /mercury|merkury|blum|hettich|grass|zawias|prowadnic|uchwyt|aventos|legrabox|tandembox|okuci|n[oó][żz]k|cargo/i, category: "okucia" },
  { match: /castorama|leroy|obi\b|bricoman|wkr[eę]t|klej|silikon|tasma|ta[śs]m/i, category: "materiały" },
  { match: /makita|bosch|festool|dewalt|narz[eę]dz|wiert|pi[łl]a/i, category: "narzędzia" },
  { match: /transport|przesy[łl]k|kurier|dostaw|inpost|dpd|\bdhl\b/i, category: "transport" },
  { match: /orange|t-mobile|ksi[eę]gow|biuro|papier|toner|abonament/i, category: "biuro" },
];

function guessCategory(supplier: string | null, lines: FaLine[]): string | null {
  const text = [supplier ?? "", ...lines.map((l) => l.name)].join(" ");
  return CATEGORY_RULES.find((r) => r.match.test(text))?.category ?? null;
}
