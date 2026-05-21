import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { listCatalog } from "@/lib/dao/material_catalog";
import { fmtPLN } from "@/lib/format";
import { deleteCatalogAction } from "./actions";
import AddCatalogForm from "./AddCatalogForm";

export const metadata = { title: "Katalog materiałów" };

export default async function MaterialsPage() {
  const items = await listCatalog();

  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    const key = it.category ?? "Bez kategorii";
    const arr = grouped.get(key) ?? [];
    arr.push(it);
    grouped.set(key, arr);
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Katalog materiałów" back={{ href: "/jobs" }} />

        <AddCatalogForm />

        {items.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-10">
            Katalog jest pusty. Dodaj pierwszy materiał powyżej.
          </p>
        ) : (
          <div className="flex flex-col gap-5 mt-4">
            {Array.from(grouped.entries()).map(([cat, list]) => (
              <section key={cat}>
                <h2 className="text-xs uppercase tracking-wide font-semibold text-zinc-500 mb-2">
                  {cat}
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((it) => {
                    const del = deleteCatalogAction.bind(null, it.id);
                    return (
                      <li
                        key={it.id}
                        className="rounded-xl border border-zinc-200 bg-white p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{it.name}</p>
                          <p className="text-xs text-zinc-500">
                            {it.unit}
                            {it.default_price_gross !== null &&
                              ` • ${fmtPLN(it.default_price_gross)}/${it.unit}`}
                          </p>
                          {it.notes && (
                            <p className="text-xs text-zinc-500 mt-0.5">{it.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Link
                            href={`/materials/${it.id}/edit`}
                            className="text-xs text-zinc-600 px-2 py-1 rounded-md active:bg-zinc-50"
                          >
                            Edytuj
                          </Link>
                          <form action={del}>
                            <ConfirmSubmitButton
                              message={`Usunąć "${it.name}" z katalogu?`}
                              formNoValidate
                              className="text-xs text-red-600 px-2 py-1 rounded-md active:bg-red-50"
                            >
                              Usuń
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
