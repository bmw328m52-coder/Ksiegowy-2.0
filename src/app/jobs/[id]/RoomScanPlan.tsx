import type { ScanData } from "@/lib/dao/room_scans.types";
import { planSvg } from "@/lib/scan2d";

export { wallLetter } from "@/lib/scan2d";

/** Rzut 2D w stylu MagicPlan (ta sama geometria co aplikacja iPad). */
export default function RoomScanPlan({ data, name, uid }: { data: ScanData; name?: string; uid: string }) {
  const svg = planSvg(data, { name, uid: uid.replace(/[^a-zA-Z0-9]/g, "") });
  if (!svg) return <p className="text-xs text-zinc-500">Skan nie zawiera ścian.</p>;
  // SVG budujemy sami z liczb skanu; tekst (nazwa) jest escapowany w planSvg.
  return <div className="overflow-hidden rounded-lg border border-[#ededea]" dangerouslySetInnerHTML={{ __html: svg }} />;
}
