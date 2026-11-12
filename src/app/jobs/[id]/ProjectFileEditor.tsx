"use client";

import { useEffect, useRef, useState } from "react";
import type { FileMark, JobFile, TextMark } from "@/lib/dao/job_files.types";
import { MarksLayer, markHit } from "./FileMarks";
import { saveJobFileMarksAction } from "./fileActions";
import { clearLocalMarks, writeLocalMarks } from "./fileStore";

type Tool = "pan" | "pen" | "line" | "text" | "erase";
type View = { x: number; y: number; k: number };
type Pt = { x: number; y: number };
type SaveState = "saved" | "saving" | "offline";
type TextDraft = { id: string | null; x: number; y: number; text: string; bg: boolean };

type Gesture =
  | { kind: "pan"; sx: number; sy: number; view: View }
  | { kind: "pinch"; d0: number; mx: number; my: number; view: View }
  | { kind: "draw" }
  | { kind: "tap"; sx: number; sy: number }
  | { kind: "move"; id: string; dx: number; dy: number; moved: boolean }
  | { kind: "erase"; erased: boolean }
  | { kind: "idle" };

const TOOLS: { id: Tool; label: string }[] = [
  { id: "pan", label: "Przesuń" },
  { id: "pen", label: "Pisak" },
  { id: "line", label: "Linia" },
  { id: "text", label: "Tekst" },
  { id: "erase", label: "Gumka" },
];
const COLORS = ["#d92d20", "#1d4ed8", "#111111"];
const SIZES = ["S", "M", "L"];
const UNDO_LIMIT = 60;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const r1 = (v: number) => Math.round(v * 10) / 10;

export default function ProjectFileEditor({
  file,
  src,
  onMarks,
  onClose,
  onDelete,
}: {
  file: JobFile;
  src: string;
  onMarks: (id: string, marks: FileMark[]) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const W = file.width;
  const H = file.height;
  const longEdge = Math.max(W, H);

  const [marks, setMarks] = useState<FileMark[]>(file.marks);
  const [undo, setUndo] = useState<FileMark[][]>([]);
  const [draft, setDraft] = useState<FileMark | null>(null);
  const [tool, setTool] = useState<Tool>("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(1);
  const [view, setView] = useState<View | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture>({ kind: "idle" });
  const latest = useRef<FileMark[]>(file.marks);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const penWidth = (longEdge / 900) * [1, 2, 4][size];
  const textSize = (longEdge / 90) * [1, 1.5, 2.3][size];

  const fitView = (sw: number, sh: number): View => {
    const k = Math.min(sw / W, sh / H) * 0.98;
    return { x: (sw - W * k) / 2, y: (sh - H * k) / 2, k };
  };

  // Dopasowanie do ekranu przy otwarciu (rozmiar sceny znamy dopiero po ułożeniu).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setView((v) => v ?? fitView(r.width, r.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // --- zapis: od razu lokalnie, po chwili na serwer; bez sieci czeka na powrót zasięgu.
  async function flush() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const sent = latest.current;
    setSaveState("saving");
    const res = await saveJobFileMarksAction(file.id, file.job_id, sent).catch(() => ({ error: "offline" }));
    if (res.error) {
      setSaveState("offline");
      return;
    }
    if (latest.current === sent) {
      clearLocalMarks(file.id);
      setSaveState("saved");
    }
  }

  function persist(next: FileMark[]) {
    latest.current = next;
    writeLocalMarks(file.id, next);
    onMarks(file.id, next);
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 700);
  }

  function commit(next: FileMark[], base: FileMark[] = marks) {
    setUndo((u) => [...u.slice(-(UNDO_LIMIT - 1)), base]);
    setMarks(next);
    persist(next);
  }

  function undoLast() {
    if (undo.length === 0) return;
    const prev = undo[undo.length - 1];
    setUndo(undo.slice(0, -1));
    setMarks(prev);
    persist(prev);
  }

  useEffect(() => {
    const retry = () => {
      if (latest.current !== file.marks) void flush();
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (saveTimer.current) void flush();
    onClose();
  }

  // --- geometria
  const stagePoint = (e: { clientX: number; clientY: number }): Pt => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const toImage = (p: Pt, v: View): Pt => ({ x: (p.x - v.x) / v.k, y: (p.y - v.y) / v.k });
  const clampK = (k: number, v: View) => {
    const r = stageRef.current?.getBoundingClientRect();
    const fit = r ? Math.min(r.width / W, r.height / H) : v.k;
    return Math.max(fit * 0.5, Math.min(Math.max(16, fit * 4), k));
  };
  const hitTol = (v: View) => 14 / v.k;

  function eraseAt(p: Pt, v: View, g: Extract<Gesture, { kind: "erase" }>) {
    for (let i = marks.length - 1; i >= 0; i--) {
      if (!markHit(marks[i], p.x, p.y, hitTol(v))) continue;
      const next = marks.filter((_, j) => j !== i);
      if (g.erased) {
        setMarks(next);
        persist(next);
      } else {
        g.erased = true;
        commit(next);
      }
      return;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!view || textDraft) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const sp = stagePoint(e);
    pointers.current.set(e.pointerId, sp);

    if (pointers.current.size === 2) {
      // Dwa palce zawsze przesuwają/powiększają — przerywają rysowanie.
      const [a, b] = [...pointers.current.values()];
      setDraft(null);
      gesture.current = {
        kind: "pinch",
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        view,
      };
      return;
    }
    if (pointers.current.size > 2) return;

    const p = toImage(sp, view);
    if (tool === "pan") {
      const hit = [...marks].reverse().find((m): m is TextMark => m.t === "text" && markHit(m, p.x, p.y, hitTol(view)));
      gesture.current = hit
        ? { kind: "move", id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y, moved: false }
        : { kind: "pan", sx: sp.x, sy: sp.y, view };
    } else if (tool === "pen") {
      setDraft({ id: newId(), t: "pen", c: color, w: penWidth, pts: [r1(p.x), r1(p.y)] });
      gesture.current = { kind: "draw" };
    } else if (tool === "line") {
      setDraft({ id: newId(), t: "line", c: color, w: penWidth, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      gesture.current = { kind: "draw" };
    } else if (tool === "text") {
      gesture.current = { kind: "tap", sx: sp.x, sy: sp.y };
    } else {
      const g: Gesture = { kind: "erase", erased: false };
      gesture.current = g;
      eraseAt(p, view, g);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!view || !pointers.current.has(e.pointerId)) return;
    const sp = stagePoint(e);
    pointers.current.set(e.pointerId, sp);
    const g = gesture.current;

    if (g.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const k = clampK((g.view.k * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0, g.view);
      const anchor = toImage({ x: g.mx, y: g.my }, g.view);
      setView({ k, x: (a.x + b.x) / 2 - anchor.x * k, y: (a.y + b.y) / 2 - anchor.y * k });
      return;
    }
    if (g.kind === "pan") {
      setView({ ...g.view, x: g.view.x + sp.x - g.sx, y: g.view.y + sp.y - g.sy });
      return;
    }
    const p = toImage(sp, view);
    if (g.kind === "draw") {
      setDraft((d) => {
        if (!d) return d;
        if (d.t === "line") return { ...d, x2: p.x, y2: p.y };
        if (d.t !== "pen") return d;
        const n = d.pts.length;
        if (Math.hypot(p.x - d.pts[n - 2], p.y - d.pts[n - 1]) < 1.5 / view.k) return d;
        return { ...d, pts: [...d.pts, r1(p.x), r1(p.y)] };
      });
    } else if (g.kind === "move") {
      if (!g.moved) {
        g.moved = true;
        setUndo((u) => [...u.slice(-(UNDO_LIMIT - 1)), marks]);
      }
      setMarks((ms) => ms.map((m) => (m.id === g.id && m.t === "text" ? { ...m, x: r1(p.x - g.dx), y: r1(p.y - g.dy) } : m)));
    } else if (g.kind === "erase") {
      eraseAt(p, view, g);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const sp = stagePoint(e);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0) {
      // Po szczypnięciu drugi palec jeszcze leży — nic nim nie robimy do oderwania.
      if (g.kind === "pinch") gesture.current = { kind: "idle" };
      return;
    }
    gesture.current = { kind: "idle" };
    if (!view) return;

    if (g.kind === "draw" && draft) {
      setDraft(null);
      if (draft.t === "pen") {
        const pts = draft.pts.length >= 4 ? draft.pts : [...draft.pts, draft.pts[0] + 0.1, draft.pts[1]];
        commit([...marks, { ...draft, pts }]);
      } else if (draft.t === "line" && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 4 / view.k) {
        commit([...marks, { ...draft, x1: r1(draft.x1), y1: r1(draft.y1), x2: r1(draft.x2), y2: r1(draft.y2) }]);
      }
    } else if (g.kind === "move" && g.moved) {
      persist(marks);
    } else if (g.kind === "tap" && e.type === "pointerup" && Math.hypot(sp.x - g.sx, sp.y - g.sy) < 12) {
      const p = toImage(sp, view);
      const hit = [...marks].reverse().find((m): m is TextMark => m.t === "text" && markHit(m, p.x, p.y, hitTol(view)));
      setTextDraft(
        hit
          ? { id: hit.id, x: hit.x, y: hit.y, text: hit.text, bg: hit.bg }
          : { id: null, x: r1(p.x), y: r1(p.y - textSize / 2), text: "", bg: true },
      );
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!view) return;
    const sp = stagePoint(e);
    const anchor = toImage(sp, view);
    const k = clampK(view.k * Math.exp(-e.deltaY * 0.0015), view);
    setView({ k, x: sp.x - anchor.x * k, y: sp.y - anchor.y * k });
  }

  function saveText() {
    if (!textDraft) return;
    const text = textDraft.text.trim();
    if (textDraft.id) {
      const next = text
        ? marks.map((m) => (m.id === textDraft.id && m.t === "text" ? { ...m, text, bg: textDraft.bg } : m))
        : marks.filter((m) => m.id !== textDraft.id);
      commit(next);
    } else if (text) {
      commit([
        ...marks,
        { id: newId(), t: "text", c: color, s: r1(textSize), x: textDraft.x, y: textDraft.y, text, bg: textDraft.bg },
      ]);
    }
    setTextDraft(null);
  }

  function deleteText() {
    if (textDraft?.id) commit(marks.filter((m) => m.id !== textDraft.id));
    setTextDraft(null);
  }

  function fit() {
    const r = stageRef.current?.getBoundingClientRect();
    if (r) setView(fitView(r.width, r.height));
  }

  const saveLabel =
    saveState === "saved" ? "Zapisano" : saveState === "saving" ? "Zapisuję…" : "Bez sieci — wyślę po połączeniu";
  const barBtn = "rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-[#1f1d1b] text-white select-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-[#282624]">
        <button type="button" onClick={close} className={`${barBtn} bg-white/10 active:bg-white/20`}>
          ← Zamknij
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className={`text-[11px] ${saveState === "offline" ? "text-[#f0b46a]" : "text-white/50"}`}>{saveLabel}</p>
        </div>
        <button type="button" onClick={undoLast} disabled={undo.length === 0} className={`${barBtn} bg-white/10 active:bg-white/20`}>
          Cofnij
        </button>
        <button type="button" onClick={fit} className={`${barBtn} bg-white/10 active:bg-white/20`}>
          Cały
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Usunąć „${file.name}” razem z poprawkami?`)) onDelete(file.id);
          }}
          className={`${barBtn} text-[#ff9a8f] active:bg-white/10`}
        >
          Usuń
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden"
        style={{ touchAction: "none", cursor: tool === "pan" ? "grab" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {view && (
          <div
            className="absolute bg-white"
            style={{ left: view.x, top: view.y, width: W * view.k, height: H * view.k }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={file.name} draggable={false} className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} />
            <MarksLayer
              marks={draft ? [...marks, draft] : marks}
              width={W}
              height={H}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        )}

        {textDraft && (
          <div
            className="absolute left-1/2 top-3 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-white p-3 text-[#1f1d1b] shadow-xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="mb-1.5 text-xs font-semibold text-[#6f6c66]">
              {textDraft.id ? "Popraw tekst" : "Nowy wymiar / notatka"}
            </p>
            <textarea
              autoFocus
              onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
              rows={2}
              value={textDraft.text}
              onChange={(e) => setTextDraft({ ...textDraft, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveText();
                }
              }}
              placeholder="np. 2345"
              className="w-full select-text rounded-lg border border-zinc-300 px-3 py-2 text-base outline-none focus:border-[#a06f3f]"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-[#6f6c66]">
              <input
                type="checkbox"
                checked={textDraft.bg}
                onChange={(e) => setTextDraft({ ...textDraft, bg: e.target.checked })}
              />
              Białe tło (zakrywa stary wymiar)
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={saveText} className="flex-1 rounded-lg bg-[#a06f3f] py-2 text-sm font-semibold text-white active:opacity-80">
                Zapisz
              </button>
              {textDraft.id && (
                <button type="button" onClick={deleteText} className="rounded-lg border border-zinc-200 px-3 text-sm text-red-600 active:bg-zinc-50">
                  Usuń
                </button>
              )}
              <button type="button" onClick={() => setTextDraft(null)} className="rounded-lg border border-zinc-200 px-3 text-sm active:bg-zinc-50">
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-x-auto bg-[#282624] px-3 py-2">
        <div className="flex shrink-0 gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`${barBtn} ${tool === t.id ? "bg-[#a06f3f] text-white" : "bg-white/10 text-white/80 active:bg-white/20"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Kolor ${c}`}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-white" : "border-white/25"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          {SIZES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(i)}
              className={`${barBtn} ${size === i ? "bg-white text-[#1f1d1b]" : "bg-white/10 text-white/80 active:bg-white/20"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
