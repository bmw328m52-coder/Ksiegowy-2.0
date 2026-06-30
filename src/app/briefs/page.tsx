import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { listAllBriefs } from "@/lib/dao/quote_briefs";
import { QUOTE_BRIEF_STATUS_LABELS } from "@/lib/dao/quote_briefs.types";
import { PROJECT_TYPE_LABELS } from "@/lib/dao/job_checklist.types";
import { fmtPLN, fmtDate } from "@/lib/format";

export const metadata = { title: "Briefy" };

export default async function BriefsPage() {
  const briefs = await listAllBriefs();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Briefy / pomiary" back={{ href: "/" }} />

        {briefs.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-12">
            Brak briefów. Dodaj brief z poziomu klienta — przycisk „+ Nowy brief / pomiar”.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {briefs.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/briefs/${b.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-3 active:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{b.title}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {PROJECT_TYPE_LABELS[b.project_type]}
                        {b.visit_date && ` • ${fmtDate(b.visit_date)}`}
                        {b.estimated_amount !== null && ` • ${fmtPLN(b.estimated_amount)}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5">
                      {QUOTE_BRIEF_STATUS_LABELS[b.status]}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
