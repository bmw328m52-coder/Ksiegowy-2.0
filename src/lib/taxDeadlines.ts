export type VatPeriod = "monthly" | "quarterly";

function lastDayOfMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function clampDay(year: number, monthIdx: number, day: number): Date {
  const last = lastDayOfMonth(year, monthIdx);
  return new Date(year, monthIdx, Math.min(day, last));
}

export type VatDeadline = {
  due: Date;
  label: string;
  periodLabel: string;
};

export function vatDeadline(
  year: number,
  monthIdx: number,
  period: VatPeriod
): VatDeadline {
  if (period === "quarterly") {
    const q = Math.floor(monthIdx / 3);
    const qEndMonth = q * 3 + 2;
    const dueYear = qEndMonth === 11 ? year + 1 : year;
    const dueMonth = qEndMonth === 11 ? 0 : qEndMonth + 1;
    return {
      due: clampDay(dueYear, dueMonth, 25),
      label: "JPK_V7K",
      periodLabel: `Q${q + 1} ${year}`,
    };
  }
  const dueYear = monthIdx === 11 ? year + 1 : year;
  const dueMonth = monthIdx === 11 ? 0 : monthIdx + 1;
  return {
    due: clampDay(dueYear, dueMonth, 25),
    label: "JPK_V7M",
    periodLabel: monthLabel(year, monthIdx),
  };
}

export type PitDeadline = {
  due: Date;
  label: string;
  periodLabel: string;
};

export function pitMonthlyDeadline(year: number, monthIdx: number): PitDeadline {
  const dueYear = monthIdx === 11 ? year + 1 : year;
  const dueMonth = monthIdx === 11 ? 0 : monthIdx + 1;
  return {
    due: clampDay(dueYear, dueMonth, 20),
    label: "Zaliczka PIT",
    periodLabel: monthLabel(year, monthIdx),
  };
}

const MONTH_NAMES_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

function monthLabel(year: number, monthIdx: number): string {
  return `${MONTH_NAMES_PL[monthIdx]} ${year}`;
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
