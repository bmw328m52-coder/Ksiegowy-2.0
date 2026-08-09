import Link from "next/link";
import { Money } from "@/components/Money";
import { fmtPLN } from "@/lib/format";
import type { AttentionItem, AttentionSeverity } from "@/lib/dao/finance";

const TONE: Record<AttentionSeverity, { box: string; dot: string; label: string }> = {
  high: { box: "border-[#e6c4b9] bg-[#f9ece7]", dot: "bg-[#b8523a]", label: "text-[#7a2f1e]" },
  medium: { box: "border-[#e3d4b6] bg-[#f6efe1]", dot: "bg-[#a06f3f]", label: "text-[#5a3d1f]" },
  low: { box: "border-[#e8e4dd] bg-white", dot: "bg-[#9c9081]", label: "text-[#3a3633]" },
};

export default function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[#dbe7de] bg-[#eef5ef] px-4 py-5 text-center">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-semibold text-[#3a6b4d] mt-1">Wszystko pod kontrolą</p>
        <p className="text-[12px] text-[#6f8574] mt-0.5">
          Brak dokumentów i terminów wymagających reakcji.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e8e4dd] bg-white overflow-hidden">
      <header className="px-4 pt-4 pb-2 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#9c9081]">
            Kontrola
          </p>
          <h2 className="text-sm font-semibold text-[#282624]">Wymaga uwagi</h2>
        </div>
        <span className="text-[11px] font-semibold text-[#b8523a] bg-[#f9ece7] rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </header>
      <ul>
        {items.map((it, i) => {
          const tone = TONE[it.severity];
          return (
            <li key={`${it.kind}-${i}`} className="border-t border-[#f1ede5] first:border-t-0">
              <Link
                href={it.href}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[#faf7f2] active:bg-[#f5f0e8] transition-colors"
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${tone.label}`}>{it.title}</p>
                  <p className="text-[11px] text-[#9c9081] mt-0.5">{it.hint}</p>
                </div>
                {it.amount !== null && (
                  <Money className="text-sm font-semibold tabular-nums text-[#3a3633] shrink-0">
                    {fmtPLN(it.amount)}
                  </Money>
                )}
                <svg
                  className="mt-1 shrink-0 text-[#c9c0b1]"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
