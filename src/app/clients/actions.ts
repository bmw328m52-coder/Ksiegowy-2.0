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
  try {
    const created = await createClientRow(parsed);
    revalidatePath("/clients");
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
  try {
    await deleteClient(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("violates foreign key")) {
      throw new Error("Nie można usunąć klienta — ma przypisane zlecenia. Usuń je najpierw.");
    }
    throw e;
  }
  revalidatePath("/clients");
  redirect("/clients");
}
