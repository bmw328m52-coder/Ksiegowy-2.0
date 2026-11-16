import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ingestInvoiceFile } from "@/lib/invoices/ingest";

export const maxDuration = 60;

/** Odczyt jednego dokumentu (zdjęcie/PDF). Skaner wywołuje to równolegle dla wielu plików. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Nie udało się odebrać pliku." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Brak pliku." }, { status: 400 });
  }
  const result = await ingestInvoiceFile(file);
  if (result.ok) revalidatePath("/invoices");
  return NextResponse.json(result, { status: result.ok || result.id ? 200 : 422 });
}
