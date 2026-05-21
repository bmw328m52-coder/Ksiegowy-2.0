"use server";

import { revalidatePath } from "next/cache";
import { parseAmount } from "@/lib/format";
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  createJobMaterial,
  updateJobMaterial,
  deleteJobMaterial,
  getCatalogItem,
  type MaterialCatalogInput,
} from "@/lib/dao/material_catalog";

type Result = { error?: string };

function readCatalogForm(formData: FormData): MaterialCatalogInput | string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Podaj nazwę materiału.";
  const unit = String(formData.get("unit") ?? "").trim() || "szt";
  const category = String(formData.get("category") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const priceRaw = String(formData.get("default_price_gross") ?? "").trim();
  let default_price_gross: number | null = null;
  if (priceRaw) {
    const parsed = parseAmount(priceRaw);
    if (parsed === null || parsed < 0) return "Nieprawidłowa cena.";
    default_price_gross = parsed;
  }

  return { name, unit, category, default_price_gross, notes };
}

export async function createCatalogAction(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readCatalogForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await createCatalogItem(parsed);
    revalidatePath("/materials");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
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
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
}

export async function deleteCatalogAction(id: string) {
  await deleteCatalogItem(id);
  revalidatePath("/materials");
}

// ---------- Materiały na wycenie ----------

export async function addJobMaterialAction(jobId: string, formData: FormData) {
  const catalogIdRaw = String(formData.get("catalog_id") ?? "").trim();
  const qtyRaw = String(formData.get("qty") ?? "1").trim();
  const qty = parseAmount(qtyRaw) ?? 1;
  if (qty <= 0) throw new Error("Ilość musi być większa od zera.");

  if (catalogIdRaw) {
    const item = await getCatalogItem(catalogIdRaw);
    if (!item) throw new Error("Nie znaleziono pozycji w katalogu.");
    await createJobMaterial({
      job_id: jobId,
      catalog_id: item.id,
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
    await createJobMaterial({
      job_id: jobId,
      catalog_id: null,
      name,
      unit,
      qty,
      unit_price_gross,
    });
  }

  revalidatePath(`/jobs/${jobId}/wycena`);
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
