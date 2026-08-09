"use server";

import { revalidatePath } from "next/cache";
import {
  setInvoiceAccountingStatus,
  setInvoicePayment,
} from "@/lib/dao/invoices";
import type { AccountingStatus, PaymentStatus } from "@/lib/dao/invoices.types";
import {
  createDeadline,
  setDeadlineDone,
  deleteDeadline,
} from "@/lib/dao/deadlines";
import { isDeadlineCategory } from "@/lib/dao/deadlines.types";

const ACCOUNTING_VALUES: AccountingStatus[] = ["not_sent", "ready", "entered", "verified"];

export async function setAccountingStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ACCOUNTING_VALUES.includes(status as AccountingStatus)) return;
  await setInvoiceAccountingStatus(id, status as AccountingStatus);
  revalidatePath("/finanse/ksiegowosc");
  revalidatePath("/finanse");
  revalidatePath(`/invoices/${id}`);
}

export async function setPaymentStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("status") ?? "");
  if (!id || (next !== "paid" && next !== "unpaid")) return;
  const paidDate =
    next === "paid" ? new Date().toISOString().slice(0, 10) : null;
  await setInvoicePayment(id, next as PaymentStatus, paidDate);
  revalidatePath("/finanse/ksiegowosc");
  revalidatePath("/finanse");
  revalidatePath(`/invoices/${id}`);
}

// ------------------------------------------------------------
// Terminy
// ------------------------------------------------------------
export async function createDeadlineAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "inne");
  const due_date = String(formData.get("due_date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!title || !due_date) return;
  await createDeadline({
    title,
    category: isDeadlineCategory(category) ? category : "inne",
    due_date,
    note: note || null,
  });
  revalidatePath("/finanse/terminy");
  revalidatePath("/finanse");
}

export async function toggleDeadlineAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!id) return;
  await setDeadlineDone(id, done);
  revalidatePath("/finanse/terminy");
  revalidatePath("/finanse");
}

export async function deleteDeadlineAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteDeadline(id);
  revalidatePath("/finanse/terminy");
  revalidatePath("/finanse");
}
