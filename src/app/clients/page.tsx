import Link from "next/link";
import { listClients } from "@/lib/dao/clients";
import { avatarTone, clientInitials } from "@/lib/avatar";
import { PageContainer, Badge, EmptyState, ButtonLink } from "@/components/ui";

export const metadata = { title: "Klienci" };

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const all = await listClients();
  const needle = normalize(q);
  const clients = needle
    ? all.filter((c) => {
        const hay = [c.name, c.nip, c.phone, c.email]
          .filter(Boolean)
          .map((v) => normalize(String(v)))
          .join(" ");
        return hay.includes(needle);
      })
    : all;

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1f1d1b]">Klienci</h1>
          <p className="mt-0.5 text-[12px] text-[#6f6c66]">
            {q ? `Wynik dla „${q}”` : "Wszyscy"} · {clients.length}
          </p>
        </div>
        <ButtonLink href="/clients/new" size="sm" icon={<span className="text-[15px] leading-none">+</span>}>
          Dodaj
        </ButtonLink>
      </header>

      {all.length > 0 && (
        <form method="GET" action="/clients" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Szukaj: nazwa, NIP, telefon, e-mail"
            autoComplete="off"
            className="flex-1 rounded-xl border border-[#ededea] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a06f3f]/25"
          />
          {q ? (
            <Link
              href="/clients"
              className="rounded-xl border border-[#ededea] bg-white px-3.5 py-2.5 text-sm text-[#6f6c66] active:bg-[#f6f6f5]"
            >
              Wyczyść
            </Link>
          ) : (
            <button
              type="submit"
              className="rounded-xl bg-[#1f1d1b] text-white px-4 py-2.5 text-sm font-semibold active:opacity-80"
            >
              Szukaj
            </button>
          )}
        </form>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={<ClientsGlyph />}
          title="Brak klientów"
          hint="Dodaj pierwszego klienta, aby zacząć."
          cta={{ href: "/clients/new", label: "+ Dodaj klienta" }}
          tone="accent"
        />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<SearchGlyph />}
          title={`Brak wyników dla „${q}”`}
          hint="Spróbuj innej frazy lub wyczyść filtr."
          cta={{ href: "/clients", label: "Wyczyść wyszukiwanie" }}
          tone="neutral"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((c) => {
            const tone = avatarTone(c.name);
            return (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#ededea] bg-white p-3.5 shadow-[0_1px_2px_rgba(40,38,36,0.04)] active:bg-[#f6f6f5] hover:border-[#d8d7d3] hover:shadow-[0_2px_8px_rgba(40,38,36,0.06)] transition-all"
                >
                  <span
                    className="inline-flex w-11 h-11 rounded-full items-center justify-center text-[14px] font-bold shrink-0"
                    style={{ background: tone.bg, color: tone.fg }}
                    aria-hidden
                  >
                    {clientInitials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[14px] text-[#1f1d1b] truncate">{c.name}</p>
                    <p className="text-[11px] text-[#8d8a85] truncate mt-0.5">
                      {[c.nip && `NIP ${c.nip}`, c.phone].filter(Boolean).join(" · ") ||
                        (c.type === "company" ? "Firma" : "Osoba prywatna")}
                    </p>
                  </div>
                  <Badge tone={c.type === "company" ? "accent" : "neutral"}>
                    {c.type === "company" ? "Firma" : "Osoba"}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}

function SearchGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function ClientsGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
