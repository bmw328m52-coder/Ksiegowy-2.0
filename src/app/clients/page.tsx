import Link from "next/link";
import { listClients } from "@/lib/dao/clients";
import PageHeader from "@/components/PageHeader";
import { avatarTone, clientInitials } from "@/lib/avatar";

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
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader
          title="Klienci"
          back={{ href: "/" }}
          action={
            <Link
              href="/clients/new"
              className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium active:opacity-80"
            >
              + Dodaj
            </Link>
          }
        />

        {all.length > 0 && (
          <form method="GET" action="/clients" className="mb-3 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Szukaj: nazwa, NIP, telefon, e-mail"
              autoComplete="off"
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {q ? (
              <Link
                href="/clients"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 active:bg-zinc-50"
              >
                Wyczyść
              </Link>
            ) : (
              <button
                type="submit"
                className="rounded-lg bg-accent text-white px-3 py-2 text-sm font-medium active:opacity-80"
              >
                Szukaj
              </button>
            )}
          </form>
        )}

        {q && (
          <p className="text-xs text-zinc-500 mb-2">
            Wynik dla „{q}”: {clients.length} z {all.length}
          </p>
        )}

        {all.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 space-y-4">
            <p>Nie masz jeszcze żadnych klientów.</p>
            <Link
              href="/clients/new"
              className="inline-block rounded-lg bg-accent text-white px-4 py-3 text-sm font-medium"
            >
              + Dodaj pierwszego klienta
            </Link>
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 space-y-3">
            <p>Brak wyników dla „{q}”.</p>
            <Link
              href="/clients"
              className="inline-block text-sm text-zinc-600 underline-offset-2 hover:underline"
            >
              Wyczyść filtr
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {clients.map((c) => {
              const tone = avatarTone(c.name);
              return (
                <li key={c.id}>
                  <Link
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[#e6dcc7] bg-white p-3.5 active:bg-[#faf7f2] hover:border-[#c4bbac] transition-colors"
                  >
                    <span
                      className="inline-flex w-11 h-11 rounded-full items-center justify-center text-[14px] font-bold shrink-0"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {clientInitials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] text-[#282624] truncate">{c.name}</p>
                      <p className="text-[11px] text-[#9c9081] truncate mt-0.5">
                        {[c.nip && `NIP ${c.nip}`, c.phone].filter(Boolean).join(" · ") || (c.type === "company" ? "Firma" : "Osoba prywatna")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        c.type === "company"
                          ? "bg-[#a06f3f] text-white"
                          : "bg-[#f1e5d2] text-[#a06f3f]"
                      }`}
                    >
                      {c.type === "company" ? "Firma" : "Osoba"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
