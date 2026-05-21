import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listInvoices, getSignedThumbnailUrl } from "@/lib/dao/invoices";
import { listInvoiceCategoriesMap, COST_CATEGORIES } from "@/lib/dao/cost_lines";
import ExportMonthCard from "./ExportMonthCard";
import InvoicesListClient from "./InvoicesListClient";

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

  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title="Faktury"
          back={{ href: "/" }}
          action={
            <Link
              href="/invoices/new"
              className="rounded-lg bg-accent text-white text-sm px-3 py-2 font-medium active:opacity-80"
            >
              + Dodaj
            </Link>
          }
        />

        {all.length > 0 && (
          <>
            <ExportMonthCard />
            <FilterTabs current={filter} counts={counts} buildHref={buildHref} />
            {availableCats.length > 0 && (
              <CategoryPills
                current={cat}
                available={availableCats}
                buildHref={buildHref}
              />
            )}
          </>
        )}

        {all.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center">
            <p className="text-sm text-zinc-600 mb-3">Brak faktur. Dodaj pierwszą.</p>
            <Link
              href="/invoices/new"
              className="inline-block rounded-lg bg-accent text-white text-sm px-4 py-2 font-medium"
            >
              Wgraj fakturę
            </Link>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 space-y-3">
            <p>
              {cat
                ? `Brak faktur w kategorii "${cat}".`
                : filter === "todo"
                  ? "Brak faktur do uzupełnienia."
                  : "Brak gotowych faktur."}
            </p>
            <Link
              href="/invoices"
              className="inline-block text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Pokaż wszystkie
            </Link>
          </div>
        ) : (
          <InvoicesListClient invoices={invoices} categoriesMap={categoriesMap} thumbsMap={thumbsMap} />
        )}
      </div>
    </main>
  );
}

function FilterTabs({
  current,
  counts,
  buildHref,
}: {
  current: Filter;
  counts: { all: number; todo: number; done: number };
  buildHref: (next: { filter?: Filter; cat?: string | null }) => string;
}) {
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Wszystkie", count: counts.all },
    { key: "todo", label: "Do uzupełnienia", count: counts.todo },
    { key: "done", label: "Gotowe", count: counts.done },
  ];
  return (
    <nav className="flex gap-1 mb-3 p-1 rounded-lg bg-zinc-100">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={buildHref({ filter: t.key })}
            className={`flex-1 text-center text-xs py-2 px-2 rounded-md font-medium transition-colors ${
              active
                ? "bg-white text-[#282624] shadow-sm"
                : "text-zinc-600 active:bg-zinc-50"
            }`}
          >
            {t.label} <span className="text-zinc-400">({t.count})</span>
          </Link>
        );
      })}
    </nav>
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
  return (
    <div className="mb-3 -mx-6 px-6 overflow-x-auto">
      <div className="flex gap-1.5 w-max pb-1">
        <Link
          href={buildHref({ cat: null })}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium ${
            allActive ? "bg-accent text-white" : "bg-white border border-zinc-200 text-zinc-600 active:bg-zinc-50"
          }`}
        >
          Wszystkie kategorie
        </Link>
        {available.map((c) => {
          const active = c === current;
          return (
            <Link
              key={c}
              href={buildHref({ cat: c })}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium ${
                active
                  ? "bg-accent text-white"
                  : "bg-white border border-zinc-200 text-zinc-600 active:bg-zinc-50"
              }`}
            >
              {c}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

