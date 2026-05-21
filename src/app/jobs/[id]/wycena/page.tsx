import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getJob } from "@/lib/dao/jobs";
import { getBriefByJob } from "@/lib/dao/quote_briefs";
import { getBriefSchema, type BriefField } from "@/lib/briefSchema";
import { listCatalog, listMaterialsByJob, type JobMaterial } from "@/lib/dao/material_catalog";
import { fmtPLN } from "@/lib/format";
import MaterialsSection from "../MaterialsSection";
import PriceInput from "./PriceInput";
import QtyCalculator from "./QtyCalculator";

const PRICE_PREFIX = "__price_";
const QTY_PREFIX = "__qty_";

type QtyConfig = {
  label: string;
  unit: string;
  visibleWhen?: (value: unknown) => boolean;
  unitFor?: (value: unknown) => string;
};

const QTY_CONFIG: Record<string, QtyConfig> = {
  front_material: {
    label: "Lakier MDF — łączna powierzchnia",
    unit: "m²",
    visibleWhen: (v) => v === "lakier",
  },
  front_opening: {
    label: "Otwieranie — ilość",
    unit: "szt",
    unitFor: (v) =>
      v === "bezuchwytowe" ? "mb" : v === "mieszane" ? "szt / mb" : "szt",
  },
  worktop_material: {
    label: "Blat — łączna długość",
    unit: "mb",
  },
  led_under_upper: {
    label: "Pasek LED pod szafkami — długość",
    unit: "mb",
  },
  led_inside_upper: {
    label: "Pasek LED w szafkach — długość",
    unit: "mb",
  },
  led_plinth: {
    label: "Pasek LED w cokole — długość",
    unit: "mb",
  },
  led_profile: {
    label: "Profil LED — długość",
    unit: "mb",
  },
  rod_count: {
    label: "Drążki — łączna długość",
    unit: "mb",
  },
};

const NO_PRICE_KEYS = new Set<string>(["front_finish"]);

const SKIP_KEYS = new Set<string>(["gas_wall", "gas_offset_mm", "gas_height_mm"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  return { title: job ? `Wycena — ${job.title}` : "Wycena" };
}

export default async function WycenaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  const [brief, materials, catalog] = await Promise.all([
    getBriefByJob(id),
    listMaterialsByJob(id),
    listCatalog(),
  ]);

  const itemsTotal = brief ? sumPrices(brief.data) : 0;
  const materialsTotal = sumMaterials(materials);
  const total = itemsTotal + materialsTotal;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Wycena" back={{ href: `/jobs/${id}` }} />

        <p className="text-sm text-zinc-500 mb-4 truncate">{job.title}</p>

        {brief && (
          <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-zinc-500">Pozycje</p>
                <p className="font-medium text-sm tabular-nums">{fmtPLN(itemsTotal)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Materiały</p>
                <p className="font-medium text-sm tabular-nums">{fmtPLN(materialsTotal)}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-baseline justify-between">
              <span className="text-zinc-500 text-sm">Razem brutto</span>
              <span className="font-semibold text-lg tabular-nums">{fmtPLN(total)}</span>
            </div>
          </section>
        )}

        {!brief ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 space-y-3">
            <p>Brak pomiaru. Najpierw wypełnij pomiar, aby wygenerować listę pozycji.</p>
            <Link
              href={`/jobs/${id}/pomiar/edit`}
              className="inline-block rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium active:opacity-80"
            >
              Wypełnij pomiar
            </Link>
          </div>
        ) : (
          <WycenaList
            briefId={brief.id}
            jobId={id}
            projectType={brief.project_type}
            data={brief.data}
          />
        )}

        <MaterialsSection jobId={id} materials={materials} catalog={catalog} />
      </div>
    </main>
  );
}

function sumPrices(data: Record<string, unknown>): number {
  let s = 0;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(PRICE_PREFIX)) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) s += n;
  }
  return s;
}

function sumMaterials(materials: JobMaterial[]): number {
  return materials.reduce((acc, m) => {
    if (m.unit_price_gross === null) return acc;
    return acc + m.qty * m.unit_price_gross;
  }, 0);
}

function WycenaList({
  briefId,
  jobId,
  projectType,
  data,
}: {
  briefId: string;
  jobId: string;
  projectType: Parameters<typeof getBriefSchema>[0];
  data: Record<string, unknown>;
}) {
  const schema = getBriefSchema(projectType);

  const SKIP_GROUPS = new Set(["Pomieszczenie", "Ustalenia"]);

  const groups = schema.groups
    .filter((g) => !SKIP_GROUPS.has(g.title))
    .map((g) => {
      const items = g.fields
        .filter((f) => !SKIP_KEYS.has(f.key))
        .map((f) => ({ field: f, value: data[f.key] }))
        .filter((r) => {
          if (r.field.type === "checkbox") return r.value === true;
          return r.value !== undefined && r.value !== null && r.value !== "";
        });
      return { title: g.title, items };
    })
    .filter((g) => g.items.length > 0);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
        Pomiar nie zawiera jeszcze pozycji do wyceny.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500">
        Lista wygenerowana z pomiaru ({totalItems} {plPositions(totalItems)}). Wpisz ceny brutto.
      </p>
      {groups.map((g) => (
        <section
          key={g.title}
          className="rounded-xl border border-zinc-200 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-zinc-700 mb-3">{g.title}</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {g.items.map((r) => (
              <Item
                key={r.field.key}
                field={r.field}
                value={r.value}
                briefId={briefId}
                jobId={jobId}
                priceInitial={readPrice(data, r.field.key)}
                qtyInitial={readQty(data, r.field.key)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function readPrice(
  data: Record<string, unknown>,
  fieldKey: string
): number | null {
  const v = data[`${PRICE_PREFIX}${fieldKey}`];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function readQty(
  data: Record<string, unknown>,
  fieldKey: string
): number[] {
  const v = data[`${QTY_PREFIX}${fieldKey}`];
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n));
}

function Item({
  field,
  value,
  briefId,
  jobId,
  priceInitial,
  qtyInitial,
}: {
  field: BriefField;
  value: unknown;
  briefId: string;
  jobId: string;
  priceInitial: number | null;
  qtyInitial: number[];
}) {
  const display = renderValue(field, value);
  const priceable = field.type !== "textarea" && !NO_PRICE_KEYS.has(field.key);
  const qtyCfg = QTY_CONFIG[field.key];
  const showQty =
    qtyCfg && (!qtyCfg.visibleWhen || qtyCfg.visibleWhen(value));
  const qtyUnit = qtyCfg?.unitFor ? qtyCfg.unitFor(value) : qtyCfg?.unit ?? "";

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-zinc-500 text-xs">{field.label}</p>
          {display && (
            <p className="text-zinc-900 font-medium break-words">{display}</p>
          )}
        </div>
        {priceable && (
          <PriceInput
            briefId={briefId}
            jobId={jobId}
            fieldKey={field.key}
            initial={priceInitial}
          />
        )}
      </div>
      {showQty && qtyCfg && (
        <QtyCalculator
          briefId={briefId}
          jobId={jobId}
          fieldKey={field.key}
          label={qtyCfg.label}
          unit={qtyUnit}
          initial={qtyInitial}
        />
      )}
    </li>
  );
}

function renderValue(field: BriefField, value: unknown): string {
  if (field.type === "checkbox") return "";
  if (field.type === "radio" || field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }
  if (field.type === "number") {
    return `${value}${field.unit ? ` ${field.unit}` : ""}`;
  }
  return String(value);
}

function plPositions(n: number): string {
  if (n === 1) return "pozycja";
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return "pozycji";
  if (last >= 2 && last <= 4) return "pozycje";
  return "pozycji";
}
