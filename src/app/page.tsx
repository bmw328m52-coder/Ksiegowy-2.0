import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-7">
        <Image
          src="/brand/logo-luviano.png"
          alt="LUVIANO"
          width={420}
          height={108}
          priority
          className="w-full h-auto max-w-[240px]"
        />

        <div className="w-full flex items-center justify-between text-sm">
          <span className="text-[#6b6661] truncate">{user?.email}</span>
          <form action={signOut}>
            <button className="text-[#6b6661] underline-offset-2 hover:underline">
              Wyloguj
            </button>
          </form>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Manager Firmy</h1>
          <p className="text-sm text-[#6b6661]">
            Centrum zarządzania — faktury, klienci, koszty, podatki.
          </p>
        </div>

        <nav className="w-full grid grid-cols-2 gap-3">
          <Tile href="/clients" label="Klienci" hint="Lista i kontakty" icon={<UsersIcon />} />
          <Tile href="/jobs" label="Zlecenia" hint="Wszystkie zlecenia" icon={<BriefcaseIcon />} />
          <Tile href="/invoices" label="Faktury" hint="OCR + koszty" icon={<ReceiptIcon />} />
          <Tile href="/calculator" label="Kalkulator" hint="Wycena na czysto" icon={<CalcIcon />} />
          <Tile href="/dashboard" label="Dashboard" hint="Podatki i VAT" icon={<ChartIcon />} />
          <Tile href="/settings" label="Ustawienia" hint="Forma, VAT, ZUS" icon={<GearIcon />} />
        </nav>

        <p className="text-xs text-[#6b6661]/70 text-center">
          Etap 5 ✓ Dashboard podatków. Wszystkie podstawowe moduły gotowe.
        </p>
      </div>
    </main>
  );
}

function Tile({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-2xl border border-[#e8e4dd] bg-white p-4 flex flex-col gap-2 transition-all active:scale-[0.98] active:bg-[#faf7f2] shadow-[0_1px_2px_rgba(40,38,36,0.04)] hover:shadow-[0_2px_8px_rgba(40,38,36,0.08)] hover:border-[#d8d2c8]"
    >
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#282624] text-white">
        {icon}
      </span>
      <span className="text-base font-semibold tracking-tight">{label}</span>
      <span className="text-xs text-[#6b6661]">{hint}</span>
    </Link>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function CalcIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
      <path d="M8 16h.01" />
      <path d="M12 16h.01" />
      <path d="M16 16h.01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.07A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
