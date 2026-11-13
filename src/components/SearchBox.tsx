/** Pole wyszukiwania działające bez JavaScriptu: zwykły formularz GET na /szukaj. */
export default function SearchBox({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/szukaj" method="get" role="search" className="premium-search flex w-full items-center gap-2">
      <label htmlFor="global-search" className="sr-only">
        Szukaj zlecenia lub klienta
      </label>
      <input
        id="global-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Szukaj zlecenia, klienta…"
        autoComplete="off"
        className="h-12 min-w-0 flex-1 rounded-xl border border-[#e4e4e7] bg-white px-4 text-[16px] text-[#1f1d1b] placeholder:text-[#8d8a85]"
      />
      <button
        type="submit"
        className="h-12 shrink-0 rounded-xl border border-[#e4e4e7] bg-white px-4 text-sm font-semibold text-[#1f1d1b]"
      >
        Szukaj
      </button>
    </form>
  );
}
