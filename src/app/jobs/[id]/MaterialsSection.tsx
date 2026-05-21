"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JobMaterial, MaterialCatalogItem } from "@/lib/dao/material_catalog";
import {
  addJobMaterialAction,
  deleteJobMaterialAction,
  updateJobMaterialQtyAction,
} from "@/app/materials/actions";

const inputCls =
  "rounded-md border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:border-accent w-full";

export default function MaterialsSection({
  jobId,
  materials,
  catalog,
}: {
  jobId: string;
  materials: JobMaterial[];
  catalog: MaterialCatalogItem[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-700">Materiały do wyceny</h2>
        <Link href="/materials" className="text-xs text-zinc-500 underline-offset-2 hover:underline">
          Katalog →
        </Link>
      </div>

      {materials.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-3">
          Brak materiałów. Dodaj pierwszy z katalogu poniżej.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 mb-3">
          {materials.map((m) => (
            <MaterialRow key={m.id} m={m} jobId={jobId} />
          ))}
        </ul>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-md bg-accent text-white py-2 text-sm font-medium active:opacity-80"
        >
          + Dodaj materiał
        </button>
      ) : (
        <AddMaterialForm
          jobId={jobId}
          catalog={catalog}
          onDone={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function MaterialRow({ m, jobId }: { m: JobMaterial; jobId: string }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <li className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{m.name}</p>
          {!editing ? (
            <p className="text-xs text-zinc-500">
              {formatQty(m.qty)} {m.unit}
            </p>
          ) : (
            <form
              action={async (formData) => {
                await updateJobMaterialQtyAction(m.id, jobId, formData);
                setEditing(false);
                startTransition(() => router.refresh());
              }}
              className="mt-1 flex items-center gap-2"
            >
              <input
                name="qty"
                inputMode="decimal"
                defaultValue={formatQty(m.qty)}
                className={inputCls}
                style={{ width: "80px" }}
              />
              <span className="text-xs text-zinc-500">{m.unit}</span>
              <button
                type="submit"
                className="text-xs bg-accent text-white px-2 py-1 rounded-md"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-zinc-500 px-2 py-1"
              >
                Anuluj
              </button>
            </form>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-600 px-2 py-1 rounded-md active:bg-zinc-100"
            >
              Edytuj
            </button>
            <form
              action={async () => {
                await deleteJobMaterialAction(m.id, jobId);
                startTransition(() => router.refresh());
              }}
            >
              <button
                type="submit"
                className="text-xs text-red-600 px-2 py-1 rounded-md active:bg-red-50"
              >
                Usuń
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

function AddMaterialForm({
  jobId,
  catalog,
  onDone,
}: {
  jobId: string;
  catalog: MaterialCatalogItem[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<"catalog" | "manual">("catalog");
  const [error, setError] = useState<string | undefined>();

  return (
    <form
      action={async (formData) => {
        setError(undefined);
        try {
          await addJobMaterialAction(jobId, formData);
          onDone();
          startTransition(() => router.refresh());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Nieznany błąd.");
        }
      }}
      className="flex flex-col gap-2 border border-zinc-200 rounded-md p-3 bg-zinc-50"
    >
      <div className="flex gap-1 p-1 rounded-md bg-white border border-zinc-200 text-xs">
        <button
          type="button"
          onClick={() => setMode("catalog")}
          className={`flex-1 py-1.5 rounded ${mode === "catalog" ? "bg-accent text-white" : "text-zinc-600"}`}
        >
          Z katalogu
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 py-1.5 rounded ${mode === "manual" ? "bg-accent text-white" : "text-zinc-600"}`}
        >
          Ręcznie
        </button>
      </div>

      {mode === "catalog" ? (
        catalog.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">
            Katalog jest pusty.{" "}
            <Link href="/materials" className="underline">
              Dodaj pozycje
            </Link>
            .
          </p>
        ) : (
          <select name="catalog_id" required className={inputCls} defaultValue="">
            <option value="" disabled>
              — wybierz materiał —
            </option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category ? `[${c.category}] ` : ""}
                {c.name} ({c.unit})
              </option>
            ))}
          </select>
        )
      ) : (
        <>
          <input name="name" required placeholder="Nazwa materiału" className={inputCls} />
          <input name="unit" defaultValue="szt" placeholder="Jednostka" className={inputCls} />
        </>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <input
          name="qty"
          inputMode="decimal"
          defaultValue="1"
          placeholder="Ilość"
          required
          className={inputCls}
        />
        <span className="text-xs text-zinc-500">ilość</span>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-accent text-white py-2 text-sm font-medium"
        >
          Dodaj
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-600"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toString().replace(".", ",");
}
