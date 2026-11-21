import Link from "next/link";
import { Money } from "@/components/Money";
import { CATEGORY_COLORS } from "@/lib/dao/cost_lines.types";
import { MONTH_NAMES_PL, type DashboardData } from "@/lib/dao/dashboard";
import { fmtPLN } from "@/lib/format";

/**
 * Bilans miesiąca w BRUTTO. Zakupy z dotacji (PUP) są wydzielone: wynik „bez dotacji” to
 * prawdziwy wynik firmy, a wiersze „razem” pokazują to samo z zakupami z dotacji.
 */
export function Row({
  label,
  value,
  sub,
  strong,
  tone,
}: {
  label: string;
  value: string;
  sub?: boolean;
  strong?: boolean;
  tone?: "gold" | "neg";
}) {
  return (
    <div className="ld-row" data-sub={sub} data-strong={strong} data-tone={tone}>
      <span>{label}</span>
      <Money>{value}</Money>
    </div>
  );
}

export function balanceOf(t: DashboardData["month"] | DashboardData["ytd"]) {
  const grant = t.grantCostsGross;
  const own = t.costsGross - grant;
  return {
    revenue: t.revenueGross,
    grant,
    own,
    total: t.costsGross,
    profitOwn: t.revenueGross - own,
    profitAll: t.revenueGross - t.costsGross,
  };
}

/**
 * Wiersze bilansu w brutto. Domyślnie wszystko RAZEM (z zakupami z dotacji PUP);
 * `withGrant = false` pomija zakupy z dotacji i pokazuje wynik „bez dotacji”.
 */
export function BalanceRows({
  t,
  period,
  withGrant = true,
}: {
  t: DashboardData["month"] | DashboardData["ytd"];
  period: "month" | "year";
  withGrant?: boolean;
}) {
  const b = balanceOf(t);
  const hasGrant = b.grant > 0;
  const word = period === "month" ? "miesiąca" : "roku";
  const costs = withGrant ? b.total : b.own;
  const profit = withGrant ? b.profitAll : b.profitOwn;
  return (
    <div className="ld-rows">
      <Row label="Przychód brutto" value={fmtPLN(b.revenue)} />
      <Row label={hasGrant && !withGrant ? "Koszty brutto (bez dotacji PUP)" : "Koszty brutto"} value={fmtPLN(costs)} />
      {hasGrant && withGrant && <Row label="w tym zakupy z dotacji PUP" value={fmtPLN(b.grant)} sub />}
      <Row
        label={`Wynik ${word}${hasGrant && !withGrant ? " (bez dotacji PUP)" : ""}`}
        value={fmtPLN(profit)}
        strong
        tone={profit >= 0 ? "gold" : "neg"}
      />
      {hasGrant && (
        <Row
          label={withGrant ? `Wynik ${word} bez dotacji PUP` : `Wynik ${word} z dotacją (razem)`}
          value={fmtPLN(withGrant ? b.profitOwn : b.profitAll)}
          sub
        />
      )}
    </div>
  );
}

/** Przełącznik „Z dotacją PUP / Bez dotacji PUP” — przez adres (?dotacja=bez), działa na stronach serwerowych. */
export function GrantSwitch({
  base,
  params = {},
  without,
}: {
  base: string;
  params?: Record<string, string>;
  without: boolean;
}) {
  const href = (bez: boolean) => {
    const q = new URLSearchParams(params);
    if (bez) q.set("dotacja", "bez");
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const opt = (label: string, bez: boolean) => (
    <Link
      href={href(bez)}
      replace
      scroll={false}
      aria-current={without === bez ? "true" : undefined}
      className="flex-1 text-center text-[13px] font-semibold min-h-[44px] inline-flex items-center justify-center rounded-full px-3 transition-colors"
      style={
        without === bez
          ? { background: "var(--accent)", color: "var(--background)" }
          : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }
      }
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Zakupy z dotacji PUP" className="flex gap-2">
      {opt("Z dotacją PUP", false)}
      {opt("Bez dotacji PUP", true)}
    </nav>
  );
}

export function MonthBalance({
  d,
  showCategories = true,
  withGrant = true,
}: {
  d: DashboardData;
  showCategories?: boolean;
  withGrant?: boolean;
}) {
  return (
    <div className="lv-card ld-box">
      <h3 className="ld-h3">Bilans miesiąca (brutto)</h3>
      <div className="mt-3.5">
        <BalanceRows t={d.month} period="month" withGrant={withGrant} />
      </div>
      {d.monthRevenueSplit && (
        <div className="ld-rows" style={{ marginTop: 10 }}>
          <Row
            label={`przychód z fakturą${d.monthRevenueSplit.invoicedCount > 0 ? ` (${d.monthRevenueSplit.invoicedCount})` : ""}`}
            value={fmtPLN(d.monthRevenueSplit.invoicedGross)}
            sub
          />
          <Row
            label={`przychód bez faktury${d.monthRevenueSplit.uninvoicedCount > 0 ? ` (${d.monthRevenueSplit.uninvoicedCount})` : ""}`}
            value={fmtPLN(d.monthRevenueSplit.uninvoicedGross)}
            sub
          />
        </div>
      )}
      {showCategories && d.costsByCategoryMonth.length > 0 && (
        <div className="ld-cats">
          <h3 className="ld-h3">Na co poszły koszty (wszystkie, także z dotacji)</h3>
          <CategoryBars rows={d.costsByCategoryMonth} />
        </div>
      )}
    </div>
  );
}

export function CategoryBars({ rows }: { rows: { category: string; amountGross: number; share: number }[] }) {
  const max = rows[0]?.amountGross ?? 0;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const color = CATEGORY_COLORS[r.category] ?? "#8d8a85";
        const w = max > 0 ? Math.max(2, (r.amountGross / max) * 100) : 0;
        return (
          <li key={r.category}>
            <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
              <span className="capitalize">{r.category}</span>
              <Money className="tabular-nums text-[var(--muted)]">
                {fmtPLN(r.amountGross)} · {Math.round(r.share * 100)}%
              </Money>
            </div>
            <div className="ld-bar">
              <div style={{ width: `${w}%`, backgroundColor: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { MONTH_NAMES_PL };
