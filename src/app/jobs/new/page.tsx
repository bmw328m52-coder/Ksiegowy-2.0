import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import BriefForm from "@/app/briefs/BriefForm";
import { createPomiarAction, createScheduledPomiarAction } from "../actions";
import { getClient, listClients } from "@/lib/dao/clients";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/dao/job_checklist.types";
import ClientPicker from "./ClientPicker";
import ScheduleMeasurementForm from "./ScheduleMeasurementForm";

export const metadata = { title: "Nowe zlecenie" };

type Mode = "now" | "scheduled";

function isMode(v: string | undefined): v is Mode {
  return v === "now" || v === "scheduled";
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string; mode?: string }>;
}) {
  const { clientId, type, mode: rawMode } = await searchParams;
  const mode: Mode | null = isMode(rawMode) ? rawMode : null;

  if (!clientId) {
    const clients = await listClients().catch(() => []);
    const lite = clients.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
    return (
      <main className="flex flex-1 flex-col px-4 py-6">
        <div className="w-full max-w-md mx-auto">
          <PageHeader title="Nowe zlecenie" back={{ href: "/" }} />
          <p className="text-[13px] text-[#6b6661] -mt-2 mb-3 px-1">
            Wybierz klienta lub dodaj nowego — potem wybierzesz tryb pomiaru.
          </p>
          <ClientPicker clients={lite} />
        </div>
      </main>
    );
  }

  const client = await getClient(clientId);
  if (!client) notFound();

  if (!mode) {
    const typeParam = type ? `&type=${encodeURIComponent(type)}` : "";
    return (
      <main className="flex flex-1 flex-col px-4 py-6">
        <div className="w-full max-w-md mx-auto">
          <PageHeader title="Tryb pomiaru" back={{ href: "/jobs/new" }} />
          <p className="text-[13px] text-[#6b6661] -mt-2 mb-4 px-1">
            Klient: <span className="font-medium text-[#282624]">{client.name}</span>
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href={`/jobs/new?clientId=${client.id}&mode=now${typeParam}`}
              className="block rounded-2xl border border-[#e6dcc7] bg-white p-5 hover:border-[#a06f3f] active:bg-[#faf7f2] transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex w-11 h-11 rounded-xl items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(160deg, #a06f3f, #7d5530)" }}
                  aria-hidden
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 14.5 14.5 3.5l6 6L9.5 20.5z" />
                    <path d="M7 11l1.5 1.5M9 9l2 2M11 7l1.5 1.5M13 5l2 2" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#282624]">Pomiar teraz</p>
                  <p className="text-[12px] text-[#6b6661] mt-1 leading-snug">
                    Jestem u klienta — wypełniam wymiary, układ, kolory.
                    Zlecenie trafi od razu do <span className="font-medium">Uzupełnienia</span>.
                  </p>
                </div>
                <span className="text-[#a06f3f] shrink-0">→</span>
              </div>
            </Link>

            <Link
              href={`/jobs/new?clientId=${client.id}&mode=scheduled${typeParam}`}
              className="block rounded-2xl border border-[#e6dcc7] bg-white p-5 hover:border-[#a06f3f] active:bg-[#faf7f2] transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex w-11 h-11 rounded-xl items-center justify-center text-[#a06f3f] bg-[#f1e5d2] shrink-0"
                  aria-hidden
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeWidth="2.4" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[#282624]">Zaplanuj pomiar</p>
                  <p className="text-[12px] text-[#6b6661] mt-1 leading-snug">
                    Umawiam wizytę — wpiszę tytuł, typ i datę.
                    Zlecenie trafi do <span className="font-medium">Umówionych pomiarów</span>.
                  </p>
                </div>
                <span className="text-[#a06f3f] shrink-0">→</span>
              </div>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const defaultType: ProjectType | undefined = PROJECT_TYPES.includes(type as ProjectType)
    ? (type as ProjectType)
    : undefined;
  const chooseHref = `/jobs/new?clientId=${client.id}`;

  if (mode === "scheduled") {
    return (
      <main className="flex flex-1 flex-col px-4 py-6">
        <div className="w-full max-w-md mx-auto">
          <PageHeader title="Zaplanuj pomiar" back={{ href: chooseHref }} />
          <p className="text-[13px] text-[#6b6661] -mt-2 mb-3 px-1">
            Klient: <span className="font-medium text-[#282624]">{client.name}</span>
          </p>
          <ScheduleMeasurementForm
            clientId={client.id}
            defaultProjectType={defaultType}
            projectTypeOptions={PROJECT_TYPES.map((p) => ({
              value: p,
              label: PROJECT_TYPE_LABELS[p],
            }))}
            defaultAddress={client.address}
            defaultPhone={client.phone}
            action={createScheduledPomiarAction}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowy pomiar" back={{ href: chooseHref }} />
        <BriefForm
          action={createPomiarAction}
          clientId={client.id}
          clientName={client.name}
          defaultProjectType={defaultType}
          submitLabel="Zapisz pomiar"
        />
      </div>
    </main>
  );
}
