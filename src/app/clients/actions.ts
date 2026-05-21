"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClientRow,
  updateClient,
  deleteClient,
  type ClientInput,
  type ClientType,
} from "@/lib/dao/clients";
import { listJobsByClient, deleteJob } from "@/lib/dao/jobs";

type Result = { error?: string };

function readClientForm(formData: FormData): ClientInput | string {
  const type = String(formData.get("type") ?? "") as ClientType;
  if (type !== "company" && type !== "individual") return "Wybierz typ klienta.";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Podaj nazwę klienta.";

  const nip = type === "company" ? String(formData.get("nip") ?? "").trim() || null : null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  return { type, name, nip, address, email, phone, notes };
}

export async function createClientAction(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = readClientForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  const next = String(formData.get("next") ?? "");
  try {
    const created = await createClientRow(parsed);
    revalidatePath("/clients");
    if (next === "job") redirect(`/jobs/new?clientId=${created.id}`);
    redirect(`/clients/${created.id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function updateClientAction(
  id: string,
  _prev: Result,
  formData: FormData
): Promise<Result> {
  const parsed = readClientForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  try {
    await updateClient(id, parsed);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    return { error: e instanceof Error ? e.message : "Nieznany błąd." };
  }
  return {};
}

export async function deleteClientAction(id: string) {
  const jobs = await listJobsByClient(id);
  for (const j of jobs) {
    await deleteJob(j.id);
  }
  await deleteClient(id);
  revalidatePath("/clients");
  revalidatePath("/jobs");
  redirect("/clients");
}
