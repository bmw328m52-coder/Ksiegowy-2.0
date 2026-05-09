import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import {
  findInvoiceDuplicates,
  getInvoice,
  getSignedFileUrl,
  OCR_STATUS_LABELS,
} from "@/lib/dao/invoices";
import { listCostLinesByInvoice } from "@/lib/dao/cost_lines";
import { listJobs } from "@/lib/dao/jobs";
import { fmtDate, fmtPLN } from "@/lib/format";
import InvoiceEditForm from "../InvoiceEditForm";
import CostLineCard from "../CostLineCard";
import { deleteInvoiceAction } from "../actions";
import InvoicePhotoViewer from "./InvoicePhotoViewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id);
  const label = inv?.invoice_number || inv?.supplier_name || "Faktura";
  return { title: label };
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { id } = await params;
  const { fresh } = await searchParams;
  const justAdded = fresh === "1";
  const [invoice, costLines, jobs] = await Promise.all([
    getInvoice(id),
    listCostLinesByInvoice(id),
    listJobs(),
  ]);

  if (!invoice) notFound();

  const [fileUrl, duplicates] = await Promise.all([
    getSignedFileUrl(invoice.file_path),
    findInvoiceDuplicates(invoice),
  ]);
  const isImage = (invoice.file_mime ?? "").startsWith("image/");
  const totalLines = costLines.reduce(
    (acc, l) => ({
      net: acc.net + Number(l.amount_net),
      vat: acc.vat + Number(l.amount_vat),
      gross: acc.gross + Number(l.amount_gross),
    }),
    { net: 0, vat: 0, gross: 0 }
  );

  const jobOptions = jobs.map((j) => ({ id: j.id, title: j.title, client_name: j.client_name }));

  const deleteThisInvoice = deleteInvoiceAction.bind(null, invoice.id);

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title="Faktura"
          back={{ href: "/invoices" }}
          action={
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${badgeCls(invoice.ocr_status)}`}
            >
              {OCR_STATUS_LABELS[invoice.ocr_status]}
            </span>
          }
        />

        {justAdded && (
          <section className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-emerald-900">
              ✓ Faktura zapisana
            </p>
            <p className="text-xs text-emerald-800">
              {invoice.ocr_status === "failed"
                ? "OCR nie zadziałał — uzupełnij dane ręcznie poniżej."
                : "Sprawdź dane poniżej. Jeśli masz kolejne — skanuj dalej."}
            </p>
            <div className="flex gap-2">
              <Link
                href="/invoices/new"
                className="flex-1 rounded-md bg-[#282624] text-white text-sm py-2 text-center font-medium active:opacity-80"
              >
                + Skanuj kolejną
              </Link>
              <Link
                href={`/invoices/${invoice.id}`}
                replace
                scroll={false}
                className="flex-1 rounded-md bg-white border border-emerald-200 text-emerald-900 text-sm py-2 text-center font-medium active:bg-emerald-100"
              >
                OK
              </Link>
            </div>
          </section>
        )}

        {invoice.ocr_status === "failed" && (
          <p className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Nie udało się odczytać faktury automatycznie. Wpisz dane ręcznie poniżej.
          </p>
        )}

        {duplicates.length > 0 && (
          <section className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-900">
              ⚠️ Możliwy duplikat ({duplicates.length})
            </p>
            <ul className="space-y-1.5">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/invoices/${d.id}`}
                    className="block rounded-md bg-white border border-amber-200 px-2 py-1.5 active:bg-amber-100"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-900 truncate">
                        {d.supplier_name ?? "—"} · {d.invoice_number ?? "bez nr"}
                      </span>
                      <span className="text-xs tabular-nums text-zinc-700 shrink-0">
                        {fmtPLN(d.amount_gross)}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-800">
                      {fmtDate(d.issue_date)} ·{" "}
                      {d.reason === "nip_number"
                        ? "ten sam NIP + numer"
                        : "ten sam dostawca + kwota + data"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-800">
              Sprawdź czy to rzeczywiście ta sama faktura. Jeśli tak — usuń jedną z kopii.
            </p>
          </section>
        )}

        {fileUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-200 bg-white">
            {isImage ? (
              <InvoicePhotoViewer src={fileUrl} />
            ) : (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 active:bg-zinc-50"
              >
                <div className="w-10 h-12 rounded bg-red-50 border border-red-200 flex items-center justify-center text-red-700 text-xs font-bold">
                  PDF
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Otwórz PDF faktury</p>
                  <p className="text-xs text-zinc-500 truncate">{invoice.file_path.split("/").pop()}</p>
                </div>
              </a>
            )}
          </div>
        )}

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Dane faktury</h2>
          <InvoiceEditForm invoice={invoice} />
        </section>

        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-zinc-700">
              Pozycje kosztów ({costLines.length})
            </h2>
            <span className="text-xs text-zinc-500">
              Suma: <span className="font-medium text-zinc-900">{fmtPLN(totalLines.gross)}</span>
            </span>
          </div>

          {costLines.length === 0 ? (
            <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
              Brak pozycji. {invoice.ocr_status === "done" ? "Claude nie wykrył pozycji — uzupełnij dane faktury." : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {costLines.map((l) => (
                <CostLineCard key={l.id} line={l} invoiceId={invoice.id} jobs={jobOptions} />
              ))}
            </div>
          )}

          {jobOptions.length === 0 && costLines.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Brak zleceń — żeby przypisać koszt do zlecenia,{" "}
              <Link href="/jobs" className="underline">dodaj zlecenie</Link>.
            </p>
          )}
        </section>

        <form action={deleteThisInvoice}>
          <ConfirmSubmitButton
            message="Na pewno usunąć tę fakturę? Plik i wszystkie pozycje kosztowe zostaną usunięte."
            className="w-full rounded-lg border border-red-200 text-red-700 py-2.5 text-sm font-medium active:bg-red-50"
          >
            Usuń fakturę
          </ConfirmSubmitButton>
        </form>
      </div>
    </main>
  );
}

function badgeCls(s: keyof typeof OCR_STATUS_LABELS) {
  const map: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-600",
    processing: "bg-blue-50 text-blue-700",
    done: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    manual: "bg-amber-50 text-amber-700",
  };
  return map[s] ?? map.pending;
}
