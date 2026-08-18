import PageHeader from "@/components/PageHeader";
import { listAllBriefs } from "@/lib/dao/quote_briefs";
import { QUOTE_BRIEF_STATUS_LABELS } from "@/lib/dao/quote_briefs.types";
import { PROJECT_TYPE_LABELS } from "@/lib/dao/job_checklist.types";
import { fmtPLN, fmtDate } from "@/lib/format";
import { PageContainer, Card, Badge, EmptyState } from "@/components/ui";

export const metadata = { title: "Briefy" };

export default async function BriefsPage() {
  const briefs = await listAllBriefs();

  return (
    <PageContainer width="narrow">
      <PageHeader title="Briefy / pomiary" back={{ href: "/jobs" }} />

      {briefs.length === 0 ? (
        <EmptyState
          icon={<BriefGlyph />}
          title="Brak briefów"
          hint="Briefy dodajesz z poziomu klienta — przycisk „+ Nowy brief / pomiar”."
          tone="neutral"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {briefs.map((b) => (
            <li key={b.id}>
              <Card href={`/briefs/${b.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-[#1f1d1b] truncate">{b.title}</p>
                    <p className="text-[11px] text-[#8d8a85] truncate mt-0.5">
                      {PROJECT_TYPE_LABELS[b.project_type]}
                      {b.visit_date && ` · ${fmtDate(b.visit_date)}`}
                      {b.estimated_amount !== null && ` · ${fmtPLN(b.estimated_amount)}`}
                    </p>
                  </div>
                  <Badge tone="neutral">{QUOTE_BRIEF_STATUS_LABELS[b.status]}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function BriefGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}
