export const UNITS = [
  { code: "szt", label: "szt — sztuka" },
  { code: "kpl", label: "kpl — komplet" },
  { code: "m2", label: "m² — metr kwadratowy" },
  { code: "mb", label: "mb — metr bieżący" },
  { code: "kg", label: "kg — kilogram" },
  { code: "l", label: "l — litr" },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];

export const UNIT_CODES = UNITS.map((u) => u.code) as readonly string[];

export function isUnit(code: string): code is UnitCode {
  return UNIT_CODES.includes(code);
}

export function unitLabel(code: string): string {
  return UNITS.find((u) => u.code === code)?.label ?? code;
}
