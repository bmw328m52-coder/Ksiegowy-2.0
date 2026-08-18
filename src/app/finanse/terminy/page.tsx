import PageHeader from "@/components/PageHeader";
import { listDeadlines } from "@/lib/dao/deadlines";
import {
  DEADLINE_CATEGORIES,
  DEADLINE_CATEGORY_LABELS,
  DEADLINE_CATEGORY_COLORS,
  type Deadline,
  type DeadlineCategory,
} from "@/lib/dao/deadlines.types";
import { getUserSettingsOrDefault } from "@/lib/dao/user_settings";
import { vatDeadline, pitMonthlyDeadline, zusDeadline, daysUntil } from "@/lib/taxDeadlines";
import { fmtDate } from "@/lib/format";
import {
  createDeadlineAction,
  toggleDeadlineAction,
  deleteDeadlineAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terminy" };

type TaxRow = { label: string; periodLabel: string; due: Date; category: DeadlineCategory };

function taxDeadlines(now: Date, settings: { is_vat_payer: boolean; vat_period: "monthly" | "quarterly" }): TaxRow[] {
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const rows: TaxRow[] = [];
  if (settings.is_vat_payer) {
    const v = vatDeadline(year, monthIdx, settings.vat_period);
    rows.push({ label: v.label, periodLabel: v.periodLabel, due: v.due, category: "vat" });
  }
  const pit = pitMonthlyDeadline(year, monthIdx);
  rows.push({ label: pit.label, periodLabel: pit.periodLabel, due: pit.due, category: "pit" });
  const zus = zusDeadline(year, monthIdx);
  rows.push({ label: zus.label, periodLabel: zus.periodLabel, due: zus.due, category: "zus" });
  return rows.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export default async function TerminyPage() {
  const now = new Date();
  const [deadlines, settings] = await Promise.all([
    listDeadlines(),
    getUserSettingsOrDefault(),
  ]);
  const tax = taxDeadlines(now, settings);
  const today = now.toISOString().slice(0, 10);

  const open = deadlines.filter((d) => !d.done);
  const done = deadlines.filter((d) => d.done);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-4">
        <PageHeader title="Terminy" back={{ href: "/finanse" }} />

        <section className="rounded-2xl border border-[#ededea] bg-white overflow-hidden">
          <header className="px-4 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85]">
              Podatkowe · liczone automatycznie
            </p>
            <h2 className="text-sm font-semibold text-[#1f1d1b]">Bieżący okres</h2>
          </header>
          <ul>
            {tax.map((t, i) => (
              <li
                key={i}
                className="px-4 py-3 border-t border-[#eeeeed] flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <CatDot category={t.category} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1f1d1b]">{t.label}</p>
                    <p className="text-[11px] text-[#8d8a85]">{t.periodLabel}</p>
                  </div>
                </div>
                <DuePill due={t.due} />
              </li>
            ))}
          </ul>
        </section>

        <AddDeadlineForm today={today} />

        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85] px-1">
            Własne terminy {open.length > 0 && `(${open.length})`}
          </p>
          {open.length === 0 ? (
            <p className="text-sm text-[#8d8a85] text-center py-6 rounded-2xl border border-dashed border-[#ededea]">
              Brak własnych terminów. Dodaj np. przegląd auta, składkę, wizytę w urzędzie.
            </p>
          ) : (
            open.map((d) => <DeadlineCard key={d.id} d={d} />)
          )}
        </section>

        {done.length > 0 && (
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[#8d8a85] px-1">
              Wykonane ({done.length})
            </p>
            {done.map((d) => (
              <DeadlineCard key={d.id} d={d} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function DeadlineCard({ d }: { d: Deadline }) {
  const due = new Date(d.due_date + "T00:00:00");
  return (
    <div
      className={`rounded-2xl border border-[#ededea] bg-white p-4 flex items-center gap-3 ${
        d.done ? "opacity-60" : ""
      }`}
    >
      <form action={toggleDeadlineAction}>
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="done" value={(!d.done).toString()} />
        <button
          type="submit"
          aria-label={d.done ? "Cofnij" : "Oznacz wykonane"}
          className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs ${
            d.done
              ? "bg-[#3a6b4d] border-[#3a6b4d] text-white"
              : "border-[#cfc7b8] text-transparent active:bg-[#f0f0ee]"
          }`}
        >
          ✓
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-[#1f1d1b] ${d.done ? "line-through" : ""}`}>
          {d.title}
        </p>
        <p className="text-[11px] text-[#8d8a85] flex items-center gap-1.5">
          <CatDot category={d.category} />
          {DEADLINE_CATEGORY_LABELS[d.category]} · {fmtDate(due)}
        </p>
        {d.note && <p className="text-[11px] text-[#6f6c66] mt-0.5">{d.note}</p>}
      </div>
      {!d.done && <DuePill due={due} />}
      <form action={deleteDeadlineAction}>
        <input type="hidden" name="id" value={d.id} />
        <button
          type="submit"
          aria-label="Usuń"
          className="text-[#c9c0b1] hover:text-[#b8523a] p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function AddDeadlineForm({ today }: { today: string }) {
  return (
    <details className="rounded-2xl border border-[#ededea] bg-white overflow-hidden">
      <summary className="px-4 py-3 text-sm font-semibold text-[#a06f3f] cursor-pointer select-none">
        + Dodaj własny termin
      </summary>
      <form action={createDeadlineAction} className="px-4 pb-4 space-y-3">
        <div>
          <label className="text-[11px] text-[#8d8a85]">Nazwa</label>
          <input
            name="title"
            required
            placeholder="np. Składka zdrowotna, przegląd auta"
            className="w-full rounded-md border border-zinc-300 bg-white text-sm px-3 py-2 mt-0.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-[#8d8a85]">Kategoria</label>
            <select
              name="category"
              defaultValue="inne"
              className="w-full rounded-md border border-zinc-300 bg-white text-sm px-2 py-2 mt-0.5"
            >
              {DEADLINE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DEADLINE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[#8d8a85]">Data</label>
            <input
              type="date"
              name="due_date"
              required
              defaultValue={today}
              className="w-full rounded-md border border-zinc-300 bg-white text-sm px-2 py-2 mt-0.5"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-[#8d8a85]">Notatka (opcjonalnie)</label>
          <input
            name="note"
            className="w-full rounded-md border border-zinc-300 bg-white text-sm px-3 py-2 mt-0.5"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-accent text-white text-sm py-2 font-medium active:opacity-80"
        >
          Zapisz termin
        </button>
      </form>
    </details>
  );
}

function CatDot({ category }: { category: DeadlineCategory }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: DEADLINE_CATEGORY_COLORS[category] }}
    />
  );
}

function DuePill({ due }: { due: Date }) {
  const days = daysUntil(due);
  const overdue = days < 0;
  const urgent = days >= 0 && days <= 7;
  const cls = overdue
    ? "bg-[#f4e0d9] text-[#b8523a] border-[#e6c4b9]"
    : urgent
      ? "bg-[#f1e5d2] text-[#7d5530] border-[#e3d4b6]"
      : "bg-[#f6f6f5] text-[#8d8a85] border-[#ededea]";
  const suffix = overdue
    ? `${Math.abs(days)} dni po`
    : days === 0
      ? "dziś"
      : days === 1
        ? "jutro"
        : `za ${days} dni`;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls} whitespace-nowrap shrink-0`}>
      {suffix}
    </span>
  );
}
