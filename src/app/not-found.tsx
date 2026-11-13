import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col px-4 py-10">
      <div className="w-full max-w-md mx-auto text-center space-y-5">
        <p className="text-6xl font-bold text-[var(--muted)] tabular-nums">404</p>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Nie znaleziono</h1>
          <p className="text-sm text-[var(--muted)]">
            Strona albo zasób nie istnieje lub został usunięty.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block rounded-lg bg-[var(--accent)] text-[var(--btn-fg)] px-5 min-h-11 py-2 text-sm font-semibold active:opacity-80 inline-flex items-center justify-center"
        >
          Strona główna
        </Link>
      </div>
    </main>
  );
}
