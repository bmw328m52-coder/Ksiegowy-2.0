import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getJob } from "@/lib/dao/jobs";
import { listMaterialsByJob, listCatalog, type JobMaterial } from "@/lib/dao/material_catalog";
import { resolveSupplier, discountFor, SUPPLIER_ORDER, type Supplier } from "@/lib/suppliers";
import { fmtPLN } from "@/lib/format";
import { CopyButton, PrintButton } from "./PurchaseActions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job ? `Lista zakupów — ${job.title}` : "Lista zakupów" };
}

type Line = {
  name: string;
  unit: string;
  qty: number;
  unit_price_gross: number | null;
  notes: string | null;
};

type SupplierGroup = {
  supplier: Supplier;
  /** Rabat dostawcy jako ułamek (0 gdy brak). Ceny w `lines` są katalogowe. */
  discountPct: number;
  lines: Line[];
  /** Suma po rabacie — realny koszt zakupu u tego dostawcy. */
  total: number;
};

export default async function ZakupyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const [materials, catalog] = await Promise.all([
    listMaterialsByJob(id),
    listCatalog(),
  ]);

  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const groups = buildSupplierGroups(materials, catalogById);
  const grandTotal = groups.reduce((acc, g) => acc + g.total, 0);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Lista zakupów" back={{ href: `/jobs/${id}` }} />

        <p className="text-sm text-zinc-500 mb-4 truncate">{job.title}</p>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 space-y-3">
            <p>
              Brak pozycji do zakupu. Najpierw dodaj materiały do wyceny — trafią tu
              automatycznie, pogrupowane wg dostawcy.
            </p>
            <Link
              href={`/jobs/${id}/wycena`}
              className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium active:opacity-80"
            >
              Przejdź do wyceny
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs">Razem do kupienia</p>
                <p className="font-semibold text-lg tabular-nums">{fmtPLN(grandTotal)}</p>
              </div>
              <PrintButton />
            </section>

            {groups.map((g) => (
              <section
                key={g.supplier}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-700">{g.supplier}</h3>
                    {g.discountPct > 0 && (
                      <span className="rounded-full bg-accent/10 text-accent text-[11px] font-medium px-2 py-0.5">
                        rabat −{Math.round(g.discountPct * 100)}%
                      </span>
                    )}
                  </div>
                  <CopyButton text={copyTextFor(job.title, g)} label="Kopiuj listę" />
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {g.lines.map((l, i) => {
                    const net =
                      l.unit_price_gross === null
                        ? null
                        : l.unit_price_gross * (1 - g.discountPct);
                    return (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-zinc-900 break-words">{l.name}</p>
                          <p className="text-xs text-zinc-500 tabular-nums">
                            {fmtQty(l.qty)} {l.unit}
                            {net !== null && ` × ${fmtPLN(net)}`}
                            {g.discountPct > 0 && l.unit_price_gross !== null && (
                              <span className="text-zinc-400">
                                {" "}
                                (kat. {fmtPLN(l.unit_price_gross)})
                              </span>
                            )}
                          </p>
                          {l.notes && (
                            <p className="text-xs text-zinc-400 break-words">{l.notes}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium tabular-nums shrink-0">
                          {net === null ? "—" : fmtPLN(l.qty * net)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700">
                    Razem {g.supplier}
                    {g.discountPct > 0 && (
                      <span className="text-zinc-400 font-normal"> (po rabacie)</span>
                    )}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmtPLN(g.total)}
                  </span>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function buildSupplierGroups(
  materials: JobMaterial[],
  catalogById: Map<string, import("@/lib/dao/material_catalog").MaterialCatalogItem>
): SupplierGroup[] {
  // Agregacja identycznych pozycji (ten sam produkt + jednostka + cena) w obrębie
  // dostawcy — ta sama okucia kupiona w kilku grupach wyceny sumuje ilości.
  const bySupplier = new Map<Supplier, Map<string, Line>>();

  for (const m of materials) {
    const cat = m.catalog_id ? catalogById.get(m.catalog_id) : undefined;
    const supplier = resolveSupplier(cat?.supplier, cat?.category, m.name);

    const dedupeKey = `${m.catalog_id ?? m.name}|${m.unit}|${m.unit_price_gross ?? ""}`;
    const lines = bySupplier.get(supplier) ?? new Map<string, Line>();
    const existing = lines.get(dedupeKey);
    if (existing) {
      existing.qty += m.qty;
      if (!existing.notes && m.notes) existing.notes = m.notes;
    } else {
      lines.set(dedupeKey, {
        name: m.name,
        unit: m.unit,
        qty: m.qty,
        unit_price_gross: m.unit_price_gross,
        notes: m.notes,
      });
    }
    bySupplier.set(supplier, lines);
  }

  const groups: SupplierGroup[] = [];
  for (const supplier of SUPPLIER_ORDER) {
    const lines = bySupplier.get(supplier);
    if (!lines || lines.size === 0) continue;
    const discountPct = discountFor(supplier);
    const arr = Array.from(lines.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    );
    const total = arr.reduce(
      (acc, l) =>
        l.unit_price_gross === null
          ? acc
          : acc + l.qty * l.unit_price_gross * (1 - discountPct),
      0
    );
    groups.push({ supplier, discountPct, lines: arr, total });
  }
  return groups;
}

function fmtQty(qty: number): string {
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
}

function copyTextFor(jobTitle: string, g: SupplierGroup): string {
  const header = `Zamówienie — ${jobTitle} (${g.supplier})`;
  const lines = g.lines.map((l) => {
    const net =
      l.unit_price_gross === null ? null : l.unit_price_gross * (1 - g.discountPct);
    const sum = net === null ? "" : ` = ${fmtPLN(l.qty * net)}`;
    const price = net === null ? "" : ` × ${fmtPLN(net)}`;
    return `• ${l.name} — ${fmtQty(l.qty)} ${l.unit}${price}${sum}`;
  });
  const footer =
    g.discountPct > 0
      ? `Razem (po rabacie −${Math.round(g.discountPct * 100)}%): ${fmtPLN(g.total)}`
      : `Razem: ${fmtPLN(g.total)}`;
  return [header, ...lines, footer].join("\n");
}
