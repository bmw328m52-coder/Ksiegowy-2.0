import { createClient } from "@/lib/supabase/server";
import { cleanScan, grayToPdf } from "@/lib/invoices/cleanScan";

export const maxDuration = 60;

/** Czysty skan dokumentu: ?id=<uuid faktury>&format=pdf|png */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const format = url.searchParams.get("format") === "png" ? "png" : "pdf";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Zły identyfikator.", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Brak sesji.", { status: 401 });

  // RLS: widać tylko własne dokumenty.
  const { data: inv } = await supabase.from("invoices").select("file_path, file_mime").eq("id", id).maybeSingle();
  if (!inv?.file_path) return new Response("Nie znaleziono dokumentu.", { status: 404 });
  if (!inv.file_mime?.startsWith("image/")) return new Response("To nie jest zdjęcie.", { status: 415 });

  const { data: blob, error } = await supabase.storage.from("invoices").download(inv.file_path);
  if (error || !blob) return new Response("Nie udało się pobrać pliku.", { status: 502 });

  try {
    const scan = await cleanScan(Buffer.from(await blob.arrayBuffer()));
    const body = format === "png" ? scan.png : grayToPdf(scan.gray, scan.width, scan.height);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": format === "png" ? "image/png" : "application/pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Błąd obróbki.", { status: 500 });
  }
}
