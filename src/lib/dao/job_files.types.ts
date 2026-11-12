// Pliki projektu przy zleceniu (zrzuty / strony PDF z PRO100) + poprawki z tabletu.
// Współrzędne poprawek są w pikselach obrazu (0..width, 0..height), więc nie zależą
// od powiększenia ani ekranu.

export const JOB_FILES_BUCKET = "job-files";
export const JOB_FILE_EXTS = ["jpg", "png", "webp"] as const;
export type JobFileExt = (typeof JOB_FILE_EXTS)[number];

export type PenMark = { id: string; t: "pen"; c: string; w: number; pts: number[] };
export type LineMark = { id: string; t: "line"; c: string; w: number; x1: number; y1: number; x2: number; y2: number };
/** x,y = lewy górny róg tekstu; s = wysokość pisma; bg = białe tło (zakrywa stary wymiar). */
export type TextMark = { id: string; t: "text"; c: string; s: number; x: number; y: number; text: string; bg: boolean };
export type FileMark = PenMark | LineMark | TextMark;

export type JobFile = {
  id: string;
  user_id: string;
  job_id: string;
  name: string;
  file_path: string;
  width: number;
  height: number;
  marks: FileMark[];
  created_at: string;
  updated_at: string;
};

const MAX_MARKS = 3000;
const MAX_PEN_NUMBERS = 6000;
const COLOR = /^#[0-9a-f]{6}$/i;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Czyści poprawki przychodzące z przeglądarki / localStorage — złe wpisy wypadają. */
export function parseMarks(raw: unknown): FileMark[] {
  if (!Array.isArray(raw)) return [];
  const out: FileMark[] = [];
  for (const m of raw.slice(0, MAX_MARKS)) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.slice(0, 40) : "";
    const c = typeof o.c === "string" && COLOR.test(o.c) ? o.c : "";
    if (!id || !c) continue;
    if (o.t === "pen" && num(o.w) && Array.isArray(o.pts)) {
      const pts = o.pts.slice(0, MAX_PEN_NUMBERS).filter(num).map(r1);
      if (pts.length >= 4 && pts.length % 2 === 0) out.push({ id, t: "pen", c, w: r1(o.w), pts });
    } else if (o.t === "line" && num(o.w) && num(o.x1) && num(o.y1) && num(o.x2) && num(o.y2)) {
      out.push({ id, t: "line", c, w: r1(o.w), x1: r1(o.x1), y1: r1(o.y1), x2: r1(o.x2), y2: r1(o.y2) });
    } else if (o.t === "text" && num(o.s) && num(o.x) && num(o.y) && typeof o.text === "string") {
      const text = o.text.slice(0, 500).trim();
      if (text) out.push({ id, t: "text", c, s: r1(o.s), x: r1(o.x), y: r1(o.y), text, bg: o.bg !== false });
    }
  }
  return out;
}
