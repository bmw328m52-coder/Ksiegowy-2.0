"use server";

import { revalidatePath } from "next/cache";
import {
  deleteBinding,
  upsertBinding,
  type SlotKey,
} from "@/lib/dao/calculator_bindings";

const SLOT_KEYS: SlotKey[] = [
  "hdf_m2",
  "okleina_2mm_mb",
  "okleina_04mm_mb",
  "zawias_szt",
  "prowadnica_komplet",
  "noga_szt",
];

function parseSlot(raw: FormDataEntryValue | null): SlotKey | null {
  const v = String(raw ?? "");
  return (SLOT_KEYS as string[]).includes(v) ? (v as SlotKey) : null;
}

export async function setBindingAction(formData: FormData): Promise<void> {
  const slot = parseSlot(formData.get("slot"));
  if (!slot) throw new Error("Nieprawidłowy slot.");
  const catalogId = String(formData.get("catalog_id") ?? "").trim();

  if (!catalogId) {
    await deleteBinding(slot);
  } else {
    await upsertBinding(slot, catalogId);
  }

  revalidatePath("/calculator/moduly/settings");
  revalidatePath("/calculator/moduly");
}
