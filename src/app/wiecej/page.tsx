import Link from "next/link";
import type { Metadata } from "next";
import { PageContainer, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Więcej" };

type Tool = {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: "accent" | "info" | "ok" | "neutral";
};

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TOOLS: Tool[] = [
  {
    href: "/materials",
    label: "Cennik",
    hint: "Materiały, okucia, akcesoria",
    tone: "accent",
    icon: (
      <svg {...iconProps}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
        <path d="M12 22.08V12" />
      </svg>
    ),
  },
  {
    href: "/calculator",
    label: "Kalkulator",
    hint: "Szybka wycena na czysto",
    tone: "info",
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
      </svg>
    ),
  },
  {
    href: "/usluga",
    label: "Stawka /h",
    hint: "Koszt roboczogodziny",
    tone: "ok",
    icon: (
      <svg {...iconProps}>
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
      </svg>
    ),
  },
  {
    href: "/timer",
    label: "Licznik czasu",
    hint: "Rejestr pracy nad zleceniem",
    tone: "info",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2M9 2h6M12 2v3" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Ustawienia",
    hint: "Forma opodatkowania, VAT, ZUS",
    tone: "neutral",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const TONE_BOX = {
  accent: "bg-[#f1e5d2] text-[#a06f3f]",
  info: "bg-[#dde5ef] text-[#5a7898]",
  ok: "bg-[#e3efe5] text-[#4f8a64]",
  neutral: "bg-[#f0f0ee] text-[#6f6c66]",
};

export default function WiecejPage() {
  return (
    <PageContainer>
      <header className="pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1f1d1b]">Więcej</h1>
        <p className="mt-1 text-[13px] text-[#6f6c66]">Narzędzia, cennik i ustawienia firmy</p>
      </header>

      <section>
        <SectionHeading>Narzędzia</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-[#ededea] bg-white p-4 flex items-center gap-3 shadow-[0_1px_2px_rgba(40,38,36,0.04)] transition-all active:scale-[0.98] active:bg-[#f6f6f5] hover:border-[#d8d7d3] hover:shadow-[0_2px_8px_rgba(40,38,36,0.08)]"
            >
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${TONE_BOX[t.tone]}`}
              >
                {t.icon}
              </span>
              <span className="min-w-0 flex flex-col">
                <span className="text-[15px] font-semibold tracking-tight text-[#1f1d1b] truncate">
                  {t.label}
                </span>
                <span className="text-[12px] text-[#6f6c66] truncate">{t.hint}</span>
              </span>
              <span className="ml-auto text-[#c9c7c2] group-hover:text-[#a06f3f] transition-colors">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
