import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import type { RoomScan, ScanWallCurve } from "@/lib/dao/room_scans.types";
import { SCAN_OBJECT_LABELS, SCAN_OPENING_LABELS } from "@/lib/dao/room_scans.types";
import { fmtDate } from "@/lib/format";
import { wallLetter } from "./RoomScanPlan";
import RoomScanViews from "./RoomScanViews";
import { featureKind, markerKind, planModel, planStats } from "@/lib/scan2d";
import { deleteScanAction } from "./scanActions";
import { scanPhotoUrls } from "@/lib/dao/room_scans";

const mm = (v: number) => `${Math.round(v)} mm`;
/** „dół/środek/góra 2302/2305/2310 · 8 mm" — krzywizny z dalmierza (ScanWall.curve). */
function curveText(c: ScanWallCurve | undefined): { text: string; warn: boolean } | null {
  if (!c) return null;
  const part = (label: string, vs: (number | undefined)[]) => {
    const got = vs.filter((v): v is number => typeof v === "number");
    if (got.length < 2) return null;
    const d = Math.max(...got) - Math.min(...got);
    return { d, text: `${label} ${vs.map((v) => (v === undefined ? "—" : Math.round(v))).join("/")} · ${Math.round(d)} mm` };
  };
  const ps = [
    part("dł. d/ś/g", [c.length_bottom, c.length_middle, c.length_top]),
    part("wys. l/ś/p", [c.height_left, c.height_middle, c.height_right]),
  ].filter((p): p is { d: number; text: string } => p !== null);
  if (ps.length === 0) return null;
  return { text: ps.map((p) => p.text).join(" · "), warn: ps.some((p) => p.d >= 5) };
}

const WARDROBE_ZONE_LABELS: Record<string, string> = {
  shelves: "półki",
  rail: "drążek",
  drawers: "szuflady",
  shoes: "na buty",
  pantograph: "pantograf",
  empty: "wolne",
};

const wallIndex0 = (walls: { id: string }[], id: string) => walls.findIndex((w) => w.id === id);

export default async function RoomScanSection({ jobId, scans }: { jobId: string; scans: RoomScan[] }) {
  if (scans.length === 0) return null;
  const photoUrls = await scanPhotoUrls(scans);

  return (
    <>
      {scans.map((scan) => {
        const { walls, openings, objects } = scan.data;
        const markers = [...(scan.data.markers ?? [])]
          .filter((mk) => wallIndex0(walls, mk.wall_id) >= 0)
          .sort((a, b) => wallIndex0(walls, a.wall_id) - wallIndex0(walls, b.wall_id) || a.offset_mm - b.offset_mm);
        const wallIndex = new Map(walls.map((w, i) => [w.id, i]));
        const stats = planStats(planModel(scan.data));
        const n2 = (v: number) => v.toFixed(2).replace(".", ",");
        return (
          <section key={scan.id} className="mt-4 rounded-xl border border-[#ededea] bg-white p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-700">Skan LiDAR — {scan.name}</h2>
              <span className="text-[11px] text-zinc-500">{fmtDate(scan.created_at)}</span>
            </div>

            <RoomScanViews id={scan.id} data={scan.data} name={scan.name} />

            <div className="grid grid-cols-4 gap-2 rounded-lg bg-[#f6f5f2] p-2 text-center">
              {[
                [`${n2(stats.areaM2)} m²`, "Podłoga"],
                [`${n2(stats.wallAreaM2)} m²`, "Ściany"],
                [`${n2(stats.perimeterM)} m`, "Obwód"],
                [`${stats.volumeM3.toFixed(1).replace(".", ",")} m³`, "Kubatura"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-sm font-semibold tabular-nums">{v}</div>
                  <div className="text-[10px] text-zinc-500">{l}</div>
                </div>
              ))}
            </div>

            {scan.data.notes?.trim() && (
              <div className="rounded-lg border border-[#ededea] bg-[#fbfaf7] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a06f3f]">Notatki z pomiaru</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{scan.data.notes}</p>
              </div>
            )}

            <p className="text-[11px] text-zinc-500">
              Dokładność skanu ±2–5 cm — wymiary produkcyjne potwierdź dalmierzem.
              {scan.data.room_height_mm ? ` Wysokość pomieszczenia: ${mm(scan.data.room_height_mm)}.` : ""}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-zinc-500 text-left">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Ściana</th>
                    <th className="py-1 pr-3 font-medium">Długość</th>
                    <th className="py-1 pr-3 font-medium">Wysokość</th>
                    <th className="py-1 font-medium">Krzywizny</th>
                  </tr>
                </thead>
                <tbody>
                  {walls.map((w, i) => {
                    const c = curveText(w.curve);
                    return (
                      <tr key={w.id} className="border-t border-[#f0efec]">
                        <td className="py-1 pr-3 font-semibold">{wallLetter(i)}</td>
                        <td className="py-1 pr-3 tabular-nums">{mm(w.length_mm)}</td>
                        <td className="py-1 pr-3 tabular-nums">{mm(w.height_mm)}</td>
                        <td className={`py-1 tabular-nums ${c?.warn ? "text-[#a06f3f] font-medium" : "text-zinc-500"}`}>
                          {c?.text ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {openings.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-500 text-left">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Otwór</th>
                      <th className="py-1 pr-3 font-medium">Ściana</th>
                      <th className="py-1 pr-3 font-medium">Szer. × wys.</th>
                      <th className="py-1 font-medium">Od podłogi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openings.map((o) => {
                      const wi = o.wall_id ? wallIndex.get(o.wall_id) : undefined;
                      return (
                        <tr key={o.id} className="border-t border-[#f0efec]">
                          <td className="py-1 pr-3">{SCAN_OPENING_LABELS[o.kind]}</td>
                          <td className="py-1 pr-3 font-semibold">{wi !== undefined ? wallLetter(wi) : "—"}</td>
                          <td className="py-1 pr-3 tabular-nums">
                            {Math.round(o.width_mm)} × {Math.round(o.height_mm)}
                          </td>
                          <td className="py-1 tabular-nums">
                            {mm(o.sill_mm)}
                            {o.sill_depth_mm !== undefined || o.sill_thickness_mm !== undefined ? (
                              <span className="text-zinc-500">
                                {" "}· parapet{o.sill_depth_mm !== undefined ? ` wysunięcie ${mm(o.sill_depth_mm)}` : ""}
                                {o.sill_thickness_mm !== undefined ? `, grubość ${mm(o.sill_thickness_mm)}` : ""}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(scan.data.wardrobes ?? []).map((wd) => {
              const wi = wallIndex0(walls, wd.wall_id);
              const doors =
                wd.doors === "none" ? "bez drzwi" : `drzwi ${wd.doors === "sliding" ? "przesuwne" : "uchylne"} ×${wd.door_count}`;
              return (
                <div key={wd.id} className="rounded-lg border border-[#ededea] bg-[#fbfaf7] p-3 text-xs">
                  <div className="font-semibold text-zinc-800">
                    Szafa — ściana {wi >= 0 ? wallLetter(wi) : "?"} · {Math.round(wd.width_mm)} × {Math.round(wd.height_mm)} ×{" "}
                    {Math.round(wd.depth_mm)} mm
                  </div>
                  <div className="text-zinc-500">
                    {wd.construction === "frame" ? "sam szkielet" : wd.construction === "box" ? "skrzynkowa bez pleców" : "skrzynkowa z plecami"}{" "}
                    · od lewego narożnika {mm(wd.offset_mm)} · cokół {mm(wd.plinth_mm)} · {doors}
                  </div>
                  <ol className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {wd.sections.map((sec, k) => (
                      <li key={k}>
                        <span className="font-medium">Sekcja {k + 1}</span>
                        {sec.width_mm ? ` (${Math.round(sec.width_mm)} mm)` : ""}:{" "}
                        {[...sec.zones]
                          .reverse()
                          .map((z) => `${WARDROBE_ZONE_LABELS[z.kind] ?? z.kind}${z.count && z.count > 1 ? ` ×${z.count}` : ""}${z.height_mm ? ` ${Math.round(z.height_mm)}` : ""}`)
                          .join(" / ")}
                      </li>
                    ))}
                  </ol>
                  {wd.note && <p className="mt-1 text-zinc-700">{wd.note}</p>}
                  <p className="mt-1 text-[10px] text-zinc-400">Rysunek wnętrza — w PDF z iPada.</p>
                </div>
              );
            })}

            {(scan.data.features ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-500 text-left">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Element na ścianie</th>
                      <th className="py-1 pr-3 font-medium">Ściana</th>
                      <th className="py-1 pr-3 font-medium">Szer. × wys.</th>
                      <th className="py-1 pr-3 font-medium">Od lewej / od podłogi</th>
                      <th className="py-1 font-medium">Wystaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(scan.data.features ?? [])]
                      .sort((a, b) => wallIndex0(walls, a.wall_id) - wallIndex0(walls, b.wall_id) || a.offset_mm - b.offset_mm)
                      .map((f) => {
                        const wi = wallIndex0(walls, f.wall_id);
                        const k = featureKind(f.kind);
                        return (
                          <tr key={f.id} className="border-t border-[#f0efec] align-top">
                            <td className="py-1 pr-3">
                              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: k.color }} />
                              {k.label}
                              {f.access && <span className="ml-1.5 text-[10px] font-bold text-[#ed801a]">DOSTĘP</span>}
                              {f.note && <div className="text-[11px] text-zinc-500">{f.note}</div>}
                            </td>
                            <td className="py-1 pr-3 font-semibold">{wi >= 0 ? wallLetter(wi) : "—"}</td>
                            <td className="py-1 pr-3 tabular-nums">{Math.round(f.width_mm)} × {Math.round(f.height_mm)}</td>
                            <td className="py-1 pr-3 tabular-nums">{mm(f.offset_mm)} / {mm(f.elevation_mm)}</td>
                            <td className="py-1 tabular-nums">{f.depth_mm < 1 ? "w licu" : mm(f.depth_mm)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {markers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-zinc-500 text-left">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Instalacja</th>
                      <th className="py-1 pr-3 font-medium">Ściana</th>
                      <th className="py-1 pr-3 font-medium">Od lewego / prawego</th>
                      <th className="py-1 font-medium">Od podłogi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markers.map((mk) => {
                      const k = markerKind(mk.kind);
                      const wi = wallIndex0(walls, mk.wall_id);
                      return (
                        <tr key={mk.id} className="border-t border-[#f0efec] align-top">
                          <td className="py-1 pr-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
                                style={{ background: k.color }}
                              >
                                {k.code}
                              </span>
                              {k.label}
                            </span>
                            {mk.note && <div className="text-[11px] text-zinc-500">{mk.note}</div>}
                            {(mk.photos?.length ?? 0) > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {mk.photos!.map((p) =>
                                  photoUrls[p] ? (
                                    <a key={p} href={photoUrls[p]} target="_blank" rel="noopener noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element -- podpisany URL Storage, wygasa po 1 h */}
                                      <img
                                        src={photoUrls[p]}
                                        alt={`${k.label} — zdjęcie`}
                                        loading="lazy"
                                        className="h-16 w-16 rounded-md border border-[#ededea] object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <span
                                      key={p}
                                      className="flex h-16 w-16 items-center justify-center rounded-md bg-[#f6f5f2] text-[10px] text-zinc-400"
                                    >
                                      brak
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-1 pr-3 font-semibold">{wallLetter(wi)}</td>
                          <td className="py-1 pr-3 tabular-nums">
                            {Math.round(mk.offset_mm)} / {Math.round(walls[wi].length_mm - mk.offset_mm)}
                          </td>
                          <td className="py-1 tabular-nums">{mm(mk.height_mm)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {objects.length > 0 && (
              <p className="text-xs text-zinc-600">
                <span className="text-zinc-500">Wykryte: </span>
                {objects
                  .map(
                    (o) =>
                      `${SCAN_OBJECT_LABELS[o.category] ?? o.category} ${Math.round(o.width_mm)}×${Math.round(o.depth_mm)}×${Math.round(o.height_mm)}`
                  )
                  .join(" · ")}
              </p>
            )}

            <form action={deleteScanAction} className="flex justify-end">
              <input type="hidden" name="scan_id" value={scan.id} />
              <input type="hidden" name="job_id" value={jobId} />
              <ConfirmSubmitButton message="Usunąć ten skan?" className="text-xs text-zinc-500 hover:text-red-600">
                Usuń skan
              </ConfirmSubmitButton>
            </form>
          </section>
        );
      })}
    </>
  );
}
