import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { deflateSync } from "node:zlib";

/**
 * „Czysty skan” paragonu/faktury do wgrania do OCR (np. ING Księgowość):
 * model wskazuje, gdzie na zdjęciu jest dokument i jak go obrócić, a my wycinamy go z tła,
 * zamieniamy na odcienie szarości, rozciągamy kontrast, wyostrzamy i powiększamy do ~300 dpi.
 */

const MODEL = "claude-sonnet-5-5";
const FALLBACK_MODEL = "claude-sonnet-4-6";
const TARGET_LONG_SIDE = 2200;
const MAX_SCALE = 3;

type Locate = { x0: number; y0: number; x1: number; y1: number; rotate: 0 | 90 | 180 | 270 };

const LOCATE_PROMPT = `Na zdjęciu jest dokument (paragon, faktura lub wydruk). Wskaż jego położenie.
Zwróć WYŁĄCZNIE JSON: {"x0":number,"y0":number,"x1":number,"y1":number,"rotate":0|90|180|270}
- x0,y0 = lewy górny róg, x1,y1 = prawy dolny róg prostokąta, który obejmuje CAŁY dokument od górnej do dolnej krawędzi papieru (łącznie z kodem QR / kodem kreskowym na dole i nagłówkiem na górze), bez tła (stołu, podłogi, kartki pod spodem).
- Wartości jako ułamki obrazu 0..1 (x od lewej, y od góry).
- rotate = o ile stopni zgodnie z ruchem wskazówek zegara trzeba obrócić WYCIĘTY dokument, żeby tekst był czytelny w pionie, nagłówek u góry (0, gdy już jest prosto).
Jeśli widać kilka dokumentów, wybierz główny (największy).`;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

async function locate(base64: string): Promise<Locate | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  const request = (model: string) =>
    client.messages.create({
      model,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: LOCATE_PROMPT },
          ],
        },
      ],
    });
  let message;
  try {
    message = await request(MODEL);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404 || status === 400) message = await request(FALLBACK_MODEL);
    else {
      console.warn("cleanScan.locate: błąd API", status, e instanceof Error ? e.message : e);
      return null;
    }
  }
  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  const m = text.text.match(/\{[\s\S]*\}/);
  if (!m) {
    console.warn("cleanScan.locate: brak JSON w odpowiedzi:", text.text.slice(0, 200));
    return null;
  }
  try {
    const j = JSON.parse(m[0]) as Partial<Locate>;
    const x0 = clamp01(Number(j.x0));
    const y0 = clamp01(Number(j.y0));
    const x1 = clamp01(Number(j.x1));
    const y1 = clamp01(Number(j.y1));
    if (!(x1 - x0 > 0.08) || !(y1 - y0 > 0.08)) {
      console.warn("cleanScan.locate: za mały/błędny prostokąt:", m[0]);
      return null;
    }
    const rot = [0, 90, 180, 270].includes(Number(j.rotate)) ? (Number(j.rotate) as Locate["rotate"]) : 0;
    return { x0, y0, x1, y1, rotate: rot };
  } catch {
    return null;
  }
}

export type CleanScan = { gray: Buffer; width: number; height: number; png: Buffer };

/** Wycina dokument z tła i poprawia czytelność. Gdy model nie wskaże dokumentu, zostaje całe zdjęcie. */
export async function cleanScan(input: Buffer): Promise<CleanScan> {
  // Zdjęcie z poprawioną orientacją EXIF; mniejsza wersja idzie do modelu.
  const upright = await sharp(input).rotate().toBuffer();
  const meta = await sharp(upright).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("Nie udało się odczytać obrazu.");

  const preview = await sharp(upright).resize({ width: 1400, height: 1400, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  const b64 = preview.toString("base64");
  // Odpowiedź modelu bywa niestabilna: przy braku prostokąta próbujemy jeszcze raz.
  const box = (await locate(b64)) ?? (await locate(b64));

  let pipeline = sharp(upright);
  if (box) {
    const mx = (box.x1 - box.x0) * 0.02;
    const my = (box.y1 - box.y0) * 0.015;
    const left = Math.floor(clamp01(box.x0 - mx) * W);
    const top = Math.floor(clamp01(box.y0 - my) * H);
    const width = Math.max(32, Math.min(W - left, Math.ceil((clamp01(box.x1 + mx) - clamp01(box.x0 - mx)) * W)));
    const height = Math.max(32, Math.min(H - top, Math.ceil((clamp01(box.y1 + my) - clamp01(box.y0 - my)) * H)));
    pipeline = pipeline.extract({ left, top, width, height });
    if (box.rotate) pipeline = pipeline.rotate(box.rotate);
  }

  const cropped = await pipeline.toBuffer();
  const cm = await sharp(cropped).metadata();
  const cw = cm.width ?? W;
  const ch = cm.height ?? H;
  const scale = Math.min(MAX_SCALE, TARGET_LONG_SIDE / Math.max(cw, ch));

  const enhanced = sharp(cropped)
    .resize({
      width: Math.round(cw * scale),
      height: Math.round(ch * scale),
      kernel: "lanczos3",
    })
    .grayscale()
    .normalise({ lower: 1, upper: 99 })
    .linear(1.15, -12)
    .sharpen({ sigma: 1.1, m1: 1, m2: 2 });

  const { data, info } = await enhanced.clone().raw().toBuffer({ resolveWithObject: true });
  const png = await enhanced.png({ compressionLevel: 9 }).toBuffer();
  return { gray: data, width: info.width, height: info.height, png };
}

/** Jednostronicowy PDF z obrazem w skali szarości (bezstratnie, Flate), strona ≈ 300 dpi. */
export function grayToPdf(gray: Buffer, width: number, height: number): Buffer {
  const pw = ((width * 72) / 300).toFixed(2);
  const ph = ((height * 72) / 300).toFixed(2);
  const imgData = deflateSync(gray, { level: 9 });
  const content = Buffer.from(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`, "latin1");

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
    chunks.push(buf);
    pos += buf.length;
  };
  const obj = (n: number, body: Buffer | string, stream?: Buffer) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n`);
    push(body);
    if (stream) {
      push("\nstream\n");
      push(stream);
      push("\nendstream");
    }
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${imgData.length} >>`,
    imgData,
  );
  obj(5, `<< /Length ${content.length} >>`, content);

  const xrefAt = pos;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return Buffer.concat(chunks);
}
