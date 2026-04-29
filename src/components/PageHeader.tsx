import Link from "next/link";

export default function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: { href: string; label?: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="w-full flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[#e8e4dd]">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <Link
            href={back.href}
            aria-label="Wstecz"
            className="rounded-md p-2 -ml-2 hover:bg-[#efeae2] active:bg-[#e8e4dd] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
      </div>
      {action}
    </header>
  );
}
