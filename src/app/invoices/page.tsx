import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listInvoices, getSignedThumbnailUrl } from "@/lib/dao/invoices";
import {
  listInvoiceCategoriesMap,
  listAssignedInvoiceIds,
  listInvoicePreviewLines,
  COST_CATEGORIES,
} from "@/lib/dao/cost_lines";
import ExportMonthCard from "./ExportMonthCard";
import KsefSyncCard from "./KsefSyncCard";
import { getKsefStatus } from "@/lib/dao/ksef";
import { createClient } from "@/lib/supabase/server";
import InvoicesListClient from "./InvoicesListClient";
import { FinSegmentedNav, FinEmptyState } from "../finanse/fin-ui";
import { isOverdueUnpaid } from "@/lib/dao/invoices.types";
import {
  PageContainer,


  ButtonLink,
  type SegmentItem,
} from "@/components/ui";

export const dynamic = "force-dynamic";
// Pobieranie z KSeF (akcja serwera z tej strony) potrafi trwać kilkadziesiąt sekund.
export const maxDuration = 300;
export const metadata = { title: "Faktury" };

type Filter = "all" | "todo" | "done" | "overdue";

function needsReview(inv: { ocr_status: string; supplier_name: string | null; amount_gross: string | null }): boolean {
  if (inv.ocr_status === "failed") return true;
  if (inv.ocr_status === "pending" || inv.ocr_status === "processing") return false;
  return !inv.supplier_name || !inv.amount_gross;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; cat?: string }>;
}) {
  const { filter: rawFilter, cat: rawCat } = await searchParams;
  const filter: Filter =
    rawFilter === "todo" || rawFilter === "done" || rawFilter === "overdue" ? rawFilter : "all";
  const today = new Date().toISOString().slice(0, 10);
  const cat =
    rawCat && (COST_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : null;

  const [all, categoriesMap, assignedIds, previewLines, ksef, sales] = await Promise.all([
    listInvoices(),
    listInvoiceCategoriesMap(),
    listAssignedInvoiceIds(),
    listInvoicePreviewLines(),
    getKsefStatus(),
    salesSummary(),
  ]);

  const byStatus = all.filter((inv) => {
    if (filter === "todo") return needsReview(inv);
    if (filter === "overdue") return isOverdueUnpaid(inv, today);
    if (filter === "done")
      return !needsReview(inv) && inv.ocr_status !== "pending" && inv.ocr_status !== "processing";
    return true;
  });

  const invoices = cat
    ? byStatus.filter((inv) => categoriesMap[inv.id]?.includes(cat))
    : byStatus;

  const thumbEntries = await Promise.all(
    invoices.map(async (inv): Promise<readonly [string, string | null]> => {
      if (!inv.file_mime?.startsWith("image/")) return [inv.id, null] as const;
      const url = await getSignedThumbnailUrl(inv.file_path);
      return [inv.id, url] as const;
    })
  );
  const thumbsMap: Record<string, string | null> = Object.fromEntries(thumbEntries);

  const counts = {
    all: all.length,
    todo: all.filter(needsReview).length,
    overdue: all.filter((inv) => isOverdueUnpaid(inv, today)).length,
    done: all.filter((inv) => !needsReview(inv) && inv.ocr_status !== "pending" && inv.ocr_status !== "processing").length,
  };

  const usedCategories = new Set<string>();
  for (const list of Object.values(categoriesMap)) for (const c of list) usedCategories.add(c);
  const availableCats = (COST_CATEGORIES as readonly string[]).filter((c) => usedCategories.has(c));

  const buildHref = (next: { filter?: Filter; cat?: string | null }) => {
    const f = next.filter ?? filter;
    const c = next.cat === undefined ? cat : next.cat;
    const params = new URLSearchParams();
    if (f !== "all") params.set("filter", f);
    if (c) params.set("cat", c);
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };

  const segments: SegmentItem[] = [
    { key: "all", label: "Wszystkie", href: buildHref({ filter: "all" }), count: counts.all },
    {
      key: "todo",
      label: "Do uzupełnienia",
      href: buildHref({ filter: "todo" }),
      count: counts.todo,
      tone: counts.todo > 0 ? "warn" : undefined,
    },
    { key: "done", label: "Gotowe", href: buildHref({ filter: "done" }), count: counts.done },
    ...(counts.overdue > 0 || filter === "overdue"
      ? [
          {
            key: "overdue",
            label: "Po terminie",
            href: buildHref({ filter: "overdue" }),
            count: counts.overdue,
            tone: "warn" as const,
          },
        ]
      : []),
  ];

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Faktury"
        back={{ href: "/finanse" }}
        action={
          <ButtonLink href="/invoices/new" size="sm" icon={<span className="text-[15px] leading-none">+</span>}>
            Dodaj
          </ButtonLink>
        }
      />

      <KsefSyncCard status={ksef} />

      {sales && sales.total > 0 && <SalesLink total={sales.total} unlinked={sales.unlinked} />}

      {all.length > 0 && <GrantLink invoices={all} />}

      {all.length > 0 && (
        <>
          <ExportMonthCard />
          <FinSegmentedNav items={segments} activeKey={filter} />
          {availableCats.length > 0 && (
            <CategoryPills current={cat} available={availableCats} buildHref={buildHref} />
          )}
        </>
      )}

      {all.length === 0 ? (
        <FinEmptyState
          icon={<InvoiceGlyph />}
          title="Brak faktur"
          hint="Wgraj pierwszą fakturę — OCR odczyta dane automatycznie."
          cta={{ href: "/invoices/new", label: "Wgraj fakturę" }}
          tone="accent"
        />
      ) : invoices.length === 0 ? (
        <FinEmptyState
          icon={<InvoiceGlyph />}
          title={
            cat
              ? `Brak faktur w kategorii „${cat}”`
              : filter === "todo"
                ? "Brak faktur do uzupełnienia"
                : filter === "overdue"
                  ? "Nic nie jest po terminie 👍"
                  : "Brak gotowych faktur"
          }
          cta={{ href: "/invoices", label: "Pokaż wszystkie" }}
          tone="neutral"
        />
      ) : (
        <InvoicesListClient
          invoices={invoices}
          categoriesMap={categoriesMap}
          thumbsMap={thumbsMap}
          assignedIds={assignedIds}
          showAll={filter === "overdue"}
          previewLines={previewLines}
          today={today}
        />
      )}
    </PageContainer>
  );
}

function CategoryPills({
  current,
  available,
  buildHref,
}: {
  current: string | null;
  available: string[];
  buildHref: (next: { filter?: Filter; cat?: string | null }) => string;
}) {
  const allActive = current === null;
  const pill = (active: boolean) =>
    `text-[13px] px-4 min-h-[44px] inline-flex items-center rounded-full whitespace-nowrap font-semibold transition-colors ${
      active
        ? "bg-[#a06f3f] text-white"
        : "bg-white border border-[#ededea] text-[#6f6c66] active:bg-[var(--surface-2)] hover:border-[var(--accent)]"
    }`;
  return (
    <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto">
      <div className="flex gap-1.5 w-max pb-1">
        <Link href={buildHref({ cat: null })} className={pill(allActive)}>
          Wszystkie kategorie
        </Link>
        {available.map((c) => (
          <Link key={c} href={buildHref({ cat: c })} className={pill(c === current)}>
            {c}
          </Link>
        ))}
      </div>
    </div>
  );
}

async function salesSummary(): Promise<{ total: number; unlinked: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_invoices").select("job_id");
  if (error) return null;
  return { total: data.length, unlinked: data.filter((r) => !r.job_id).length };
}

function SalesLink({ total, unlinked }: { total: number; unlinked: number }) {
  return (
    <Link
      href="/invoices/sprzedaz"
      className={`flex items-center gap-3 rounded-2xl border p-3.5 active:opacity-80 ${
        unlinked > 0 ? "border-[#e2c79c] bg-[var(--accent-soft)]" : "border-[#ededea] bg-white"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1f1d1b]">Faktury sprzedażowe</p>
        <p className="text-[13px] text-[#6f6c66]">
          {total} z KSeF{unlinked > 0 ? ` · ${unlinked} do przypisania do zlecenia` : " · wszystkie przypięte"}
        </p>
      </div>
      <span className="text-[#a06f3f] text-lg">›</span>
    </Link>
  );
}

function GrantLink({ invoices }: { invoices: { funded_by_grant?: boolean; amount_gross: string | null }[] }) {
  const grant = invoices.filter((i) => i.funded_by_grant === true);
  const sum = grant.reduce((a, i) => a + Number(i.amount_gross ?? 0), 0);
  return (
    <Link
      href="/invoices/dotacja"
      className="flex items-center gap-3 rounded-2xl border border-[#ededea] bg-white p-3.5 active:bg-[var(--surface-2)]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1f1d1b]">Zakupy z dotacji</p>
        <p className="text-[13px] text-[#6f6c66]">
          {grant.length > 0
            ? `${grant.length} faktur · ${sum.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł brutto — poza kosztami`
            : "Zaznacz faktury opłacone z dotacji PUP"}
        </p>
      </div>
      <span className="text-[#a06f3f] text-lg">›</span>
    </Link>
  );
}

function InvoiceGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2v20l3-2 3 2 3-2 3 2V2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
