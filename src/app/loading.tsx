export default function Loading() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto space-y-3 animate-pulse">
        <div className="h-7 w-40 rounded-md bg-zinc-200" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
      </div>
    </main>
  );
}
