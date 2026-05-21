"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-4xl">📴</div>
        <h1 className="text-xl font-semibold text-[#282624]">
          Brak połączenia z internetem
        </h1>
        <p className="text-sm text-zinc-600">
          Aplikacja może odczytać strony, które już wcześniej otworzyłeś.
          Zapis (np. nowy pomiar, faktura, czas pracy) wymaga sieci — spróbuj
          ponownie gdy wróci zasięg.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-lg bg-accent text-white py-2 text-sm font-medium active:opacity-80"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 py-2 text-sm font-medium text-[#282624]"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}
