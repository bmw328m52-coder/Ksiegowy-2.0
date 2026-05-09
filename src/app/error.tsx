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
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-700 text-xl">
          !
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Coś poszło nie tak</h1>
          <p className="text-sm text-zinc-500">
            Spróbuj ponownie. Jeśli błąd się powtarza — odśwież stronę.
          </p>
        </div>
        {error.digest && (
          <p className="text-[11px] text-zinc-400">Kod: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="rounded-lg bg-[#282624] text-white px-4 py-2 text-sm font-medium active:opacity-80"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 active:bg-zinc-50"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </main>
  );
}
