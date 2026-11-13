// Deterministyczne kolorowe avatary dla klientów / nazw — łatwiej rozpoznać na liście.
// Zwraca tło (pastel) + kolor inicjałów.

const PALETTE: { bg: string; fg: string }[] = Array.from({ length: 8 }, (_, k) => ({
  bg: `var(--av${k + 1}-bg)`,
  fg: `var(--av${k + 1}-fg)`,
}));

export function avatarTone(name: string): { bg: string; fg: string } {
  const seed = (name || "").trim().toLowerCase();
  if (!seed) return PALETTE[3]!;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length]!;
}

export function clientInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  // Pomijamy człony bez litery na początku (np. „(fikcyjna)” → liczy się tylko „Anna”).
  const all = trimmed.split(/\s+/).filter(Boolean);
  const words = all.filter((w) => /^\p{L}/u.test(w));
  const parts = words.length > 0 ? words : all;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
