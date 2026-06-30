"use server";

import { revalidatePath } from "next/cache";
import { parseAmount } from "@/lib/format";
import { humanizeSupabaseError } from "@/lib/supabaseError";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  syncMercuryCatalog,
  createJobMaterial,
  updateJobMaterial,
  deleteJobMaterial,
  getCatalogItem,
  type MaterialCatalogInput,
  type JobMaterial,
} from "@/lib/dao/material_catalog";
import { MERCURY_STARTER } from "./mercury_starter";

type Result = { error?: string };
type ImportResult = { error?: string; message?: string };

function readCatalogForm(formData: FormData): MaterialCatalogInput | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Podaj nazwę materiału.";
  const unit = String(formData.get("unit") ?? "").trim() || "szt";
  const category = String(formData.get("category") ?? "").trim() || null;
  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const priceRaw = String(formData.get("default_price_gross") ?? "").trim();
  let default_price_gross: number | null = null;
  if (priceRaw) {
    const parsed = parseAmount(priceRaw);
    if (parsed === null || parsed < 0) return "Nieprawidłowa cena.";
    default_price_gross = parsed;
  }

  return { name, unit, category, supplier, default_price_gross, notes };
}

export async function createCatalogAction(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readCatalogForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await createCatalogItem(parsed);
    revalidatePath("/materials");
    return {};
  } catch (e) {
    return { error: humanizeSupabaseError(e) };
  }
}

export async function updateCatalogAction(
  id: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readCatalogForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await updateCatalogItem(id, parsed);
    revalidatePath("/materials");
    return {};
  } catch (e) {
    return { error: humanizeSupabaseError(e) };
  }
}

export async function deleteCatalogAction(id: string) {
  await deleteCatalogItem(id);
  revalidatePath("/materials");
}

export async function syncMercuryCatalogAction(
  _prev: ImportResult,
  _formData: FormData
): Promise<ImportResult> {
  try {
    const items: MaterialCatalogInput[] = MERCURY_STARTER.map((it) => ({
      name: it.name,
      unit: it.unit,
      default_price_gross: it.default_price_gross,
      category: it.category,
      supplier: "Mercury",
      notes: it.notes ?? null,
    }));
    const { inserted, updated, deleted } = await syncMercuryCatalog(items);
    revalidatePath("/materials");
    if (inserted === 0 && updated === 0 && deleted === 0)
      return { message: "Cennik Mercury aktualny — bez zmian." };
    const parts: string[] = [];
    if (inserted) parts.push(`dodano ${inserted}`);
    if (updated) parts.push(`zaktualizowano ${updated}`);
    if (deleted) parts.push(`usunięto ${deleted} nieaktualnych`);
    return { message: `Synchronizacja cennika Mercury: ${parts.join(", ")}.` };
  } catch (e) {
    return { error: humanizeSupabaseError(e) };
  }
}

// ---------- Materiały na wycenie ----------

export async function addJobMaterialAction(
  jobId: string,
  formData: FormData
): Promise<JobMaterial> {
  const catalogIdRaw = String(formData.get("catalog_id") ?? "").trim();
  const qtyRaw = String(formData.get("qty") ?? "1").trim();
  const qty = parseAmount(qtyRaw) ?? 1;
  if (qty <= 0) throw new Error("Ilość musi być większa od zera.");

  const groupKeyRaw = String(formData.get("group_key") ?? "").trim();
  const group_key = groupKeyRaw || null;

  let created: JobMaterial;
  if (catalogIdRaw) {
    const item = await getCatalogItem(catalogIdRaw);
    if (!item) throw new Error("Nie znaleziono pozycji w katalogu.");
    created = await createJobMaterial({
      job_id: jobId,
      catalog_id: item.id,
      group_key,
      name: item.name,
      unit: item.unit,
      qty,
      unit_price_gross: item.default_price_gross,
    });
  } else {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Wybierz pozycję z katalogu lub podaj nazwę.");
    const unit = String(formData.get("unit") ?? "").trim() || "szt";
    const priceRaw = String(formData.get("unit_price_gross") ?? "").trim();
    const unit_price_gross = priceRaw ? parseAmount(priceRaw) : null;
    if (priceRaw && (unit_price_gross === null || unit_price_gross < 0))
      throw new Error("Nieprawidłowa cena.");
    created = await createJobMaterial({
      job_id: jobId,
      catalog_id: null,
      group_key,
      name,
      unit,
      qty,
      unit_price_gross,
    });
  }

  revalidatePath(`/jobs/${jobId}/wycena`);
  return created;
}

export async function updateJobMaterialQtyAction(
  id: string,
  jobId: string,
  formData: FormData
) {
  const qtyRaw = String(formData.get("qty") ?? "").trim();
  const qty = parseAmount(qtyRaw);
  if (qty === null || qty <= 0) throw new Error("Ilość musi być większa od zera.");
  await updateJobMaterial(id, { qty });
  revalidatePath(`/jobs/${jobId}/wycena`);
}

export async function deleteJobMaterialAction(id: string, jobId: string) {
  await deleteJobMaterial(id);
  revalidatePath(`/jobs/${jobId}/wycena`);
}
