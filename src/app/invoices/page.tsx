import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listInvoices, getSignedThumbnailUrl } from "@/lib/dao/invoices";
import { listInvoiceCategoriesMap, COST_CATEGORIES } from "@/lib/dao/cost_lines";
import ExportMonthCard from "./ExportMonthCard";
import InvoicesListClient from "./InvoicesListClient";
import {
  PageContainer,
  SegmentedNav,
  EmptyState,
  ButtonLink,
  type SegmentItem,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Faktury" };

type Filter = "all" | "todo" | "done";

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
    rawFilter === "todo" || rawFilter === "done" ? rawFilter : "all";
  const cat =
    rawCat && (COST_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : null;

  const [all, categoriesMap] = await Promise.all([listInvoices(), listInvoiceCategoriesMap()]);

  const byStatus = all.filter((inv) => {
    if (filter === "todo") return needsReview(inv);
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

      {all.length > 0 && (
        <>
          <ExportMonthCard />
          <SegmentedNav items={segments} activeKey={filter} />
          {availableCats.length > 0 && (
            <CategoryPills current={cat} available={availableCats} buildHref={buildHref} />
          )}
        </>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={<InvoiceGlyph />}
          title="Brak faktur"
          hint="Wgraj pierwszą fakturę — OCR odczyta dane automatycznie."
          cta={{ href: "/invoices/new", label: "Wgraj fakturę" }}
          tone="accent"
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<InvoiceGlyph />}
          title={
            cat
              ? `Brak faktur w kategorii „${cat}”`
              : filter === "todo"
                ? "Brak faktur do uzupełnienia"
                : "Brak gotowych faktur"
          }
          cta={{ href: "/invoices", label: "Pokaż wszystkie" }}
          tone="neutral"
        />
      ) : (
        <InvoicesListClient invoices={invoices} categoriesMap={categoriesMap} thumbsMap={thumbsMap} />
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
    `text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-semibold transition-colors ${
      active
        ? "bg-[#a06f3f] text-white"
        : "bg-white border border-[#ededea] text-[#6f6c66] active:bg-[#f6f6f5] hover:border-[#d8d7d3]"
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

function InvoiceGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2v20l3-2 3 2 3-2 3 2V2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
