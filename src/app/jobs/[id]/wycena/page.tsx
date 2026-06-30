import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getJob } from "@/lib/dao/jobs";
import { getBriefByJob } from "@/lib/dao/quote_briefs";
import { getBriefSchema, type BriefField } from "@/lib/briefSchema";
import { listCatalog, listMaterialsByJob, type JobMaterial } from "@/lib/dao/material_catalog";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import MaterialsSection from "../MaterialsSection";
import GroupMaterialsPicker from "./GroupMaterialsPicker";
import QtyCalculator from "./QtyCalculator";
import RecalcAutopriceButton from "./RecalcAutopriceButton";
import { suggestedCategoriesFor } from "./groupCategories";
import { MaterialsStoreProvider, WycenaTotals, GroupTotal } from "./MaterialsStore";

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
      v === "korytkowy" || v === "podluzne" || v === "krawedziowe" || v === "wpuszczane"
        ? "mb"
        : v === "mieszane"
          ? "szt / mb"
          : "szt",
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

const SKIP_KEYS = new Set<string>([
  "gas_wall",
  "gas_offset_mm",
  "gas_height_mm",
  "corpus_height_mm",
  "worktop_height_mm",
]);

type SubPrice = { key: string; label: string };
const GROUP_SUBPRICES: Record<string, SubPrice[]> = {
  Fronty: [
    { key: "fronty_lakier", label: "Lakier MDF" },
    { key: "fronty_uchwyty", label: "Uchwyty" },
  ],
  "Okucia i szuflady": [
    { key: "okucia_zawiasy", label: "Zawiasy" },
    { key: "okucia_silowniki", label: "Siłowniki" },
    { key: "okucia_tip_on", label: "Tip-on" },
    { key: "okucia_szuflady", label: "Szuflady" },
    { key: "okucia_magic_corner", label: "Magic corner" },
    { key: "okucia_cargo", label: "Cargo / kosze wysokie" },
    { key: "okucia_nogi", label: "Nogi / nóżki" },
  ],
};

const SKIP_GROUPS = new Set<string>([
  "Pomieszczenie",
  "Ustalenia",
  "Przyłącza i instalacje",
  // Blat zamawiany razem z korpusami — pokazujemy go złączony w „Korpusy i okleina".
  "Blat",
]);

// Grupy, których pozycje (group_key) pokazujemy złączone w innej grupie.
// Klucz docelowy → dodatkowe klucze do dołączenia (wyświetlanie + suma).
const MERGE_INTO: Record<string, string[]> = {
  korpusy_i_okleina: ["blat"],
};

// Nadpisanie etykiety grupy na wycenie (sam brief zostaje bez zmian).
const GROUP_TITLE_OVERRIDE: Record<string, string> = {
  "Korpusy i okleina": "Korpusy, okleina i blat",
};

// Klucze job_materials należące do grupy: albo z GROUP_SUBPRICES, albo slug tytułu
// + ewentualne klucze złączone (MERGE_INTO), by nic nie wypadło z sumy/widoku.
function groupMaterialKeys(title: string): string[] {
  const sub = GROUP_SUBPRICES[title];
  if (sub) return sub.map((s) => s.key);
  const slug = groupSlug(title);
  return [slug, ...(MERGE_INTO[slug] ?? [])];
}

function groupSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ż/g, "z")
    .replace(/ź/g, "z")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

  const [brief, materials, catalog, settings] = await Promise.all([
    getBriefByJob(id),
    listMaterialsByJob(id),
    listCatalog(),
    getUserSettingsOrDefault(),
  ]);

  // Sumy (góra) i listy są teraz liczone po stronie klienta ze wspólnego store,
  // żeby aktualizowały się natychmiast po dodaniu/usunięciu/zmianie ilości.
  const groupedMaterials = groupMaterialsByKey(materials);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Wycena" back={{ href: `/jobs/${id}` }} />

        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="text-sm text-zinc-500 truncate">{job.title}</p>
          <Link
            href={`/jobs/${id}/zakupy`}
            className="shrink-0 text-xs font-medium text-accent px-2 py-1 rounded-md active:bg-accent/10"
          >
            Lista zakupów →
          </Link>
        </div>

        <MaterialsStoreProvider initial={materials}>
          {brief && (
            <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
              <WycenaTotals
                amountGross={Number(job.amount_gross) || 0}
                vatRate={Number(job.vat_rate) || 0}
                isVatPayer={settings.is_vat_payer}
              />
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
            <>
              <RecalcAutopriceButton jobId={id} />
              <WycenaList
                briefId={brief.id}
                jobId={id}
                projectType={brief.project_type}
                data={brief.data}
                catalog={catalog}
                groupedMaterials={groupedMaterials}
              />
            </>
          )}

          <MaterialsSection jobId={id} catalog={catalog} />
        </MaterialsStoreProvider>
      </div>
    </main>
  );
}

function groupMaterialsByKey(materials: JobMaterial[]): Map<string | null, JobMaterial[]> {
  const map = new Map<string | null, JobMaterial[]>();
  for (const m of materials) {
    const key = m.group_key ?? null;
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

function WycenaList({
  briefId,
  jobId,
  projectType,
  data,
  catalog,
  groupedMaterials,
}: {
  briefId: string;
  jobId: string;
  projectType: Parameters<typeof getBriefSchema>[0];
  data: Record<string, unknown>;
  catalog: import("@/lib/dao/material_catalog").MaterialCatalogItem[];
  groupedMaterials: Map<string | null, JobMaterial[]>;
}) {
  const schema = getBriefSchema(projectType);

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
      // Grupę pokazujemy też, gdy nie ma już wypełnionych pól briefu, ale wiszą
      // w niej dodane materiały — inaczej znikłyby z UI, zostając w sumie wyceny.
      const hasMaterials = groupMaterialKeys(g.title).some(
        (k) => (groupedMaterials.get(k)?.length ?? 0) > 0
      );
      return { title: g.title, items, hasMaterials };
    })
    .filter((g) => g.items.length > 0 || g.hasMaterials);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
        Pomiar nie zawiera jeszcze pozycji do wyceny.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500">
        Lista wygenerowana z pomiaru. Do każdej grupy dodaj pozycje z cennika — cena policzy się sama.
      </p>
      {groups.map((g) => {
        const slug = groupSlug(g.title);
        const subprices = GROUP_SUBPRICES[g.title];
        const displayTitle = GROUP_TITLE_OVERRIDE[g.title] ?? g.title;
        const mergeKeys = MERGE_INTO[slug] ?? [];
        const mergedCategories = Array.from(
          new Set([slug, ...mergeKeys].flatMap((k) => suggestedCategoriesFor(k)))
        );
        return (
          <section
            key={g.title}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">{displayTitle}</h3>
            <ul className="flex flex-col gap-2 text-sm mb-3">
              {g.items.map((r) => (
                <InfoRow key={r.field.key} field={r.field} value={r.value} />
              ))}
            </ul>
            {g.items.map((r) => {
              const cfg = QTY_CONFIG[r.field.key];
              if (!cfg) return null;
              if (cfg.visibleWhen && !cfg.visibleWhen(r.value)) return null;
              const unit = cfg.unitFor ? cfg.unitFor(r.value) : cfg.unit;
              return (
                <QtyCalculator
                  key={r.field.key}
                  briefId={briefId}
                  jobId={jobId}
                  fieldKey={r.field.key}
                  label={cfg.label}
                  unit={unit}
                  initial={readQty(data, r.field.key)}
                />
              );
            })}
            <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-3">
              {subprices ? (
                <>
                  {subprices.map((sp) => (
                    <div key={sp.key} className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-zinc-600">{sp.label}</span>
                      <GroupMaterialsPicker
                        jobId={jobId}
                        groupKey={sp.key}
                        groupLabel={`${g.title} — ${sp.label}`}
                        displayKeys={[sp.key]}
                        catalog={catalog}
                        suggestedCategories={suggestedCategoriesFor(sp.key)}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
                    <span className="text-xs font-medium text-zinc-700">Razem grupa</span>
                    <GroupTotal keys={subprices.map((sp) => sp.key)} />
                  </div>
                </>
              ) : (
                <GroupMaterialsPicker
                  jobId={jobId}
                  groupKey={slug}
                  groupLabel={displayTitle}
                  displayKeys={[slug, ...mergeKeys]}
                  catalog={catalog}
                  suggestedCategories={mergedCategories}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
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

const HINGE_TYPE_LABELS: Record<string, string> = {
  "110_z": "110° z hamulcem",
  "110_bez": "110° bez hamulca",
  "155_z": "155° z hamulcem",
  "155_bez": "155° bez hamulca",
  rownolegle_z: "Równoległe z hamulcem",
  rownolegle_bez: "Równoległe bez hamulca",
  // stare wpisy — zgodność wsteczna z briefami sprzed rozbicia na hamulec
  "110": "110°",
  "155": "155°",
  rownolegle: "Równoległe",
};

// Wspólny render dla lift_breakdown / hinges_breakdown (JSON: [{type, count}]).
function renderBreakdownRow(
  label: string,
  value: string,
  typeLabels?: Record<string, string>
) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const total = parsed.reduce((sum, e) => {
      const raw = (e as { count?: unknown })?.count;
      const c = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(c) ? sum + c : sum;
    }, 0);
    return (
      <li className="flex flex-col gap-1">
        <span className="text-zinc-500 text-xs">{label}</span>
        <ul className="flex flex-col gap-0.5">
          {parsed.map((e, i) => {
            const type =
              typeof (e as { type?: unknown })?.type === "string"
                ? (e as { type: string }).type
                : "";
            const count = (e as { count?: unknown })?.count;
            return (
              <li key={i} className="text-zinc-900 text-sm">
                <span className="text-zinc-500">{typeLabels?.[type] ?? (type || "—")}: </span>
                {String(count)} szt
              </li>
            );
          })}
          {total > 0 && (
            <li className="text-zinc-500 text-xs">
              Łącznie: <span className="text-zinc-900 font-medium">{total} szt</span>
            </li>
          )}
        </ul>
      </li>
    );
  } catch {
    return null;
  }
}

function InfoRow({ field, value }: { field: BriefField; value: unknown }) {
  if (field.type === "checkbox") {
    return (
      <li className="flex items-center gap-2">
        <span className="text-zinc-900">{field.label}</span>
      </li>
    );
  }
  if (field.key === "lift_breakdown" && typeof value === "string") {
    const row = renderBreakdownRow(field.label, value);
    if (row) return row;
  }
  if (field.key === "hinges_breakdown" && typeof value === "string") {
    const row = renderBreakdownRow(field.label, value, HINGE_TYPE_LABELS);
    if (row) return row;
  }
  if (field.key === "corpus_list") {
    const entries = parseCorpusList(value);
    if (entries.length > 0) {
      return (
        <li className="flex flex-col gap-1.5">
          <span className="text-zinc-500 text-xs">{field.label}</span>
          <ul className="flex flex-col gap-1.5">
            {entries.map((e, i) => (
              <li
                key={i}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5"
              >
                {e.label && (
                  <span className="block text-[11px] text-zinc-500 font-medium">
                    {e.label}
                  </span>
                )}
                <span className="block text-zinc-900 font-medium text-sm break-words">
                  {e.color || "—"}
                </span>
                {e.edgeColor && (
                  <span className="block text-zinc-600 text-xs break-words">
                    Okleina: {e.edgeColor}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </li>
      );
    }
  }
  const display = renderValue(field, value);
  return (
    <li className="flex flex-col">
      <span className="text-zinc-500 text-xs">{field.label}</span>
      {display && (
        <span className="text-zinc-900 font-medium break-words">{display}</span>
      )}
    </li>
  );
}

type CorpusEntry = { label: string; color: string; edgeColor: string };

function parseCorpusList(value: unknown): CorpusEntry[] {
  if (typeof value !== "string" || value === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e): CorpusEntry => {
        const o = (e ?? {}) as Record<string, unknown>;
        return {
          label: typeof o.label === "string" ? o.label : "",
          color: typeof o.color === "string" ? o.color : "",
          edgeColor: typeof o.edgeColor === "string" ? o.edgeColor : "",
        };
      })
      .filter((e) => e.label || e.color || e.edgeColor);
  } catch {
    return [];
  }
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
