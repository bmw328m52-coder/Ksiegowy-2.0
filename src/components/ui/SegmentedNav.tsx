import Link from "next/link";

export type SegmentItem = {
  key: string;
  label: string;
  href: string;
  count?: number;
  /** ton kropki/licznika, np. dla „zaległe" */
  tone?: "default" | "warn" | "ok";
};

/**
 * Poziomy pasek filtrów (segmenty/chipy). Zastępuje rozbicie jednego widoku
 * na wiele pozycji w menu — filtrowanie żyje w nagłówku strony.
 * Server-friendly: to zwykłe linki, aktywny wskazuje `activeKey` liczone na stronie.
 */
export default function SegmentedNav({
  items,
  activeKey,
}: {
  items: SegmentItem[];
  activeKey: string;
}) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
      <div className="inline-flex gap-1.5 min-w-full">
        {items.map((it) => {
          const active = it.key === activeKey;
          const countTone =
            it.tone === "warn"
              ? active
                ? "bg-white/25 text-white"
                : "bg-[#f4e0d9] text-[#b8523a]"
              : active
                ? "bg-white/25 text-white"
                : "bg-[#efefee] text-[#8d8a85]";
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-[#1f1d1b] text-white"
                  : "bg-white border border-[#ededea] text-[#6f6c66] hover:border-[#d8d7d3] hover:text-[#1f1d1b]",
              ].join(" ")}
            >
              {it.label}
              {typeof it.count === "number" && (
                <span
                  className={`inline-flex min-w-[18px] justify-center rounded-full px-1 text-[11px] tabular-nums ${countTone}`}
                >
                  {it.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
