// Deterministyczne kolorowe avatary dla klientów / nazw — łatwiej rozpoznać na liście.
// Zwraca tło (pastel) + kolor inicjałów.

const PALETTE: { bg: string; fg: string }[] = [
  { bg: "#dde5ef", fg: "#5a7898" }, // info
  { bg: "#e3efe5", fg: "#4f8a64" }, // ok
  { bg: "#f4e0d9", fg: "#b8523a" }, // warn
  { bg: "#f1e5d2", fg: "#a06f3f" }, // accent (gold)
  { bg: "#efe3dd", fg: "#8a5a44" }, // brąz
  { bg: "#e8e3ef", fg: "#6a548f" }, // fiolet
  { bg: "#e3efed", fg: "#3f7a72" }, // teal
  { bg: "#efeadd", fg: "#8a6c1f" }, // ochra
];

export function avatarTone(name: string): { bg: string; fg: string } {
  const seed = (name || "").trim().toLowerCase();
  if (!seed) return PALETTE[3];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export function clientInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
