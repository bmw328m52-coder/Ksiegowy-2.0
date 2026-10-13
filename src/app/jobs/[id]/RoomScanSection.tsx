import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import type { RoomScan } from "@/lib/dao/room_scans.types";
import { SCAN_OBJECT_LABELS, SCAN_OPENING_LABELS } from "@/lib/dao/room_scans.types";
import { fmtDate } from "@/lib/format";
import { wallLetter } from "./RoomScanPlan";
import RoomScanViews from "./RoomScanViews";
import { markerKind, planModel, planStats } from "@/lib/scan2d";
import { deleteScanAction } from "./scanActions";
import { scanPhotoUrls } from "@/lib/dao/room_scans";

const mm = (v: number) => `${Math.round(v)} mm`;
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
                    <th className="py-1 font-medium">Wysokość</th>
                  </tr>
                </thead>
                <tbody>
                  {walls.map((w, i) => (
                    <tr key={w.id} className="border-t border-[#f0efec]">
                      <td className="py-1 pr-3 font-semibold">{wallLetter(i)}</td>
                      <td className="py-1 pr-3 tabular-nums">{mm(w.length_mm)}</td>
                      <td className="py-1 tabular-nums">{mm(w.height_mm)}</td>
                    </tr>
                  ))}
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
                          <td className="py-1 tabular-nums">{mm(o.sill_mm)}</td>
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
