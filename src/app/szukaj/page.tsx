import Link from "next/link";
import { listJobs } from "@/lib/dao/jobs";
import { listClients } from "@/lib/dao/clients";
import { jobStatusLabel } from "@/lib/jobStatusView";
import { matchesSearch } from "@/lib/search";
import { PageContainer } from "@/components/ui";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Szukaj" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const [jobs, clients] = q
    ? await Promise.all([listJobs(), listClients()])
    : [[], []];
  const jobHits = jobs.filter((j) => matchesSearch(`${j.title} ${j.client_name} ${j.notes ?? ""}`, q));
  const clientHits = clients.filter((c) =>
    matchesSearch([c.name, c.nip, c.phone, c.email].filter(Boolean).join(" "), q),
  );

  return (
    <PageContainer>
      <header className="pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#1f1d1b]">Szukaj</h1>
        <p className="mt-0.5 text-[12px] text-[#6f6c66]">Zlecenia i klienci</p>
      </header>
      <SearchBox defaultValue={q} autoFocus />
      {!q ? (
        <p className="text-sm text-[#6f6c66]">Wpisz nazwę zlecenia, klienta, numer telefonu lub NIP.</p>
      ) : jobHits.length + clientHits.length === 0 ? (
        <p className="text-sm text-[#6f6c66]">Brak wyników dla „{q}”. Sprawdź pisownię lub wpisz mniej słów.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {jobHits.length > 0 && (
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6f6c66]">
                Zlecenia · {jobHits.length}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-[#ededea] bg-white divide-y divide-[#eeeeed]">
                {jobHits.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="flex min-h-[56px] flex-col justify-center px-4 py-2.5 hover:bg-[#faf9f8]">
                      <span className="text-[15px] font-semibold text-[#1f1d1b] break-words">{j.title}</span>
                      <span className="text-[12px] text-[#6f6c66] break-words">
                        {j.client_name} · {jobStatusLabel(j.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {clientHits.length > 0 && (
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#6f6c66]">
                Klienci · {clientHits.length}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-[#ededea] bg-white divide-y divide-[#eeeeed]">
                {clientHits.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="flex min-h-[56px] flex-col justify-center px-4 py-2.5 hover:bg-[#faf9f8]">
                      <span className="text-[15px] font-semibold text-[#1f1d1b] break-words">{c.name}</span>
                      <span className="text-[12px] text-[#6f6c66] break-words">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "brak danych kontaktowych"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
