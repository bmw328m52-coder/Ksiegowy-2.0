// Wspólna definicja układów pomieszczenia — używana przez edytowalny
// KitchenLayoutDiagram i tylko-do-odczytu RoomMiniDiagram, żeby enum układów
// i reguły widoczności ścian nie rozjeżdżały się między diagramami.

export const ROOM_LAYOUTS = ["lin", "l", "u", "wneka", "kwadrat", "kwadrat_pol"] as const;
export type RoomLayout = (typeof ROOM_LAYOUTS)[number];

export const ROOM_LAYOUT_LABELS: Record<RoomLayout, string> = {
  lin: "Liniowa",
  l: "Litera L",
  u: "Litera U",
  wneka: "Wnęka / alkowa",
  kwadrat: "Kwadrat / prostokąt",
  kwadrat_pol: "Kwadrat — D do połowy",
};

export function isRoomLayout(v: unknown): v is RoomLayout {
  return typeof v === "string" && (ROOM_LAYOUTS as readonly string[]).includes(v);
}

export function parseRoomLayout(v: unknown): RoomLayout | null {
  return isRoomLayout(v) ? v : null;
}

/** Które ściany są widoczne dla danego układu. */
export function wallVisibility(layout: RoomLayout) {
  return {
    showB: layout !== "lin",
    showC: layout === "u" || layout === "wneka" || layout === "kwadrat" || layout === "kwadrat_pol",
    showD: layout === "kwadrat" || layout === "kwadrat_pol",
    halfD: layout === "kwadrat_pol",
  };
}
