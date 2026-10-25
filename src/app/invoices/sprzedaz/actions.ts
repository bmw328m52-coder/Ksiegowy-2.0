"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createJobFromSalesInvoice, linkSalesInvoice } from "@/lib/ksef/sales";

type Result = { error?: string };

function revalidateAll() {
  revalidatePath("/invoices/sprzedaz");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/finanse");
  revalidatePath("/");
}

export async function linkSalesInvoiceAction(invoiceId: string, jobId: string | null): Promise<Result> {
  try {
    const supabase = await createClient();
    await linkSalesInvoice(supabase, invoiceId, jobId);
    revalidateAll();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się przypiąć faktury." };
  }
}

export async function createJobFromSalesInvoiceAction(invoiceId: string): Promise<Result & { jobId?: string }> {
  try {
    const supabase = await createClient();
    const jobId = await createJobFromSalesInvoice(supabase, invoiceId);
    revalidateAll();
    return { jobId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nie udało się utworzyć zlecenia." };
  }
}
