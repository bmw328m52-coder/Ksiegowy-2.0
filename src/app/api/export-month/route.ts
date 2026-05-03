import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/dao/invoices.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, monthIdx: number): string {
  const d = new Date(year, monthIdx + 1, 0);
  return `${year}-${pad2(monthIdx + 1)}-${pad2(d.getDate())}`;
}

function safeFilename(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s.\-_]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "plik";
}

function csvEscape(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtAmount(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

function extFromMime(mime: string | null | undefined, fallback: string): string {
  if (!mime) return fallback;
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return mime.split("/")[1] || fallback;
  return fallback;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Brak sesji", { status: 401 });

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return new NextResponse("Niepoprawny rok", { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return new NextResponse("Niepoprawny miesiąc", { status: 400 });
  }

  const monthIdx = month - 1;
  const from = `${year}-${pad2(month)}-01`;
  const to = lastDayOfMonth(year, monthIdx);

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .gte("issue_date", from)
    .lte("issue_date", to)
    .order("issue_date", { ascending: true });
  if (error) return new NextResponse(`Błąd bazy: ${error.message}`, { status: 500 });

  const invoices = (data ?? []) as Invoice[];

  const zip = new JSZip();

  const header = [
    "Numer faktury",
    "Data wystawienia",
    "Termin płatności",
    "Sprzedawca",
    "NIP",
    "Netto",
    "VAT",
    "Brutto",
    "Stawka VAT %",
    "Plik",
    "Notatki",
  ].join(";");
  const rows: string[] = [header];

  const usedNames = new Set<string>();
  for (const inv of invoices) {
    let fileEntry = "";
    if (inv.file_path) {
      const dl = await supabase.storage.from("invoices").download(inv.file_path);
      if (!dl.error && dl.data) {
        const buf = Buffer.from(await dl.data.arrayBuffer());
        const fallback = inv.file_path.split(".").pop() ?? "bin";
        const ext = extFromMime(inv.file_mime, fallback);
        const datePart = inv.issue_date ?? "bez_daty";
        const supplierPart = safeFilename(inv.supplier_name ?? "dostawca");
        const numberPart = safeFilename(inv.invoice_number ?? inv.id.slice(0, 8));
        let base = `${datePart}_${supplierPart}_${numberPart}`;
        let name = `${base}.${ext}`;
        let i = 2;
        while (usedNames.has(name)) {
          name = `${base}_${i}.${ext}`;
          i += 1;
        }
        usedNames.add(name);
        zip.file(`pliki/${name}`, buf);
        fileEntry = `pliki/${name}`;
      }
    }

    const vatPct = inv.vat_rate ? Math.round(Number(inv.vat_rate) * 100).toString() : "";

    rows.push(
      [
        csvEscape(inv.invoice_number),
        csvEscape(inv.issue_date),
        csvEscape(inv.payment_due),
        csvEscape(inv.supplier_name),
        csvEscape(inv.supplier_nip),
        fmtAmount(inv.amount_net),
        fmtAmount(inv.amount_vat),
        fmtAmount(inv.amount_gross),
        vatPct,
        csvEscape(fileEntry),
        csvEscape(inv.notes),
      ].join(";"),
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n");
  zip.file("faktury.csv", csv);

  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;
  for (const inv of invoices) {
    totalNet += Number(inv.amount_net) || 0;
    totalVat += Number(inv.amount_vat) || 0;
    totalGross += Number(inv.amount_gross) || 0;
  }

  const summary = [
    `Eksport faktur kosztowych — ${pad2(month)}/${year}`,
    `Liczba faktur: ${invoices.length}`,
    `Razem netto: ${totalNet.toFixed(2).replace(".", ",")} zł`,
    `Razem VAT: ${totalVat.toFixed(2).replace(".", ",")} zł`,
    `Razem brutto: ${totalGross.toFixed(2).replace(".", ",")} zł`,
    "",
    `Wygenerowano: ${new Date().toISOString()}`,
  ].join("\r\n");
  zip.file("podsumowanie.txt", "\uFEFF" + summary);

  const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = `faktury_${year}_${pad2(month)}.zip`;

  return new NextResponse(new Uint8Array(blob), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
