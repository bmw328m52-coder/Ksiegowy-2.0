export default function Loading() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-3 animate-pulse">
        <div className="h-7 w-40 rounded-md bg-[var(--surface-2)]" />
        <div className="h-24 rounded-2xl bg-[var(--surface)]" />
        <div className="h-24 rounded-2xl bg-[var(--surface)]" />
        <div className="h-24 rounded-2xl bg-[var(--surface)]" />
      </div>
    </main>
  );
}
