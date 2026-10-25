import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Token KSeF szyfrowany w bazie AES-256-GCM. Klucz wyprowadzany z klucza
// service-role Supabase (żyje tylko po stronie serwera) — bez dodatkowej
// zmiennej środowiskowej do pilnowania. Sam wiersz w bazie jest bezużyteczny.
function key(): Buffer {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY — nie mogę zaszyfrować tokena KSeF.");
  return Buffer.from(hkdfSync("sha256", base, "luviano-ksef", "ksef-token-v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(packed: string): string {
  const [v, iv, tag, enc] = packed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Uszkodzony zapis tokena KSeF.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}
