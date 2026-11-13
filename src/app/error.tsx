"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col px-4 py-10">
      <div className="w-full max-w-md mx-auto text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--warn-soft)] border border-[var(--warn)] flex items-center justify-center text-[var(--warn)] text-xl">
          !
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Nie udało się wczytać tej strony</h1>
          <p className="text-sm text-[var(--muted)]">
            Najczęściej to chwilowy problem z połączeniem lub z bazą danych. Spróbuj ponownie za moment.
          </p>
          <p className="text-sm text-[var(--muted)]">
            Jeśli właśnie coś zapisywałeś, sprawdź przed ponowną próbą, czy zmiana jest widoczna, żeby nie zapisać jej dwa razy.
          </p>
        </div>
        {error.digest && (
          <p className="text-[12px] text-[var(--muted)]">Kod: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="rounded-lg bg-[var(--accent)] text-[var(--btn-fg)] px-5 min-h-11 py-2 text-sm font-semibold active:opacity-80 inline-flex items-center justify-center"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 min-h-11 py-2 text-sm text-[var(--foreground)] inline-flex items-center justify-center"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}
