import type { ReactNode } from "react";

/**
 * Spójny kontener treści strony. Ujednolica szerokość i padding wszystkich ekranów,
 * dzięki czemu każda podstrona ma ten sam rytm marginesów na telefonie i desktopie.
 *
 * width:
 *  - "app"   — domyślny, komfortowa szerokość do list/formularzy (max 920px)
 *  - "wide"  — szeroki, do tabel/dashboardów (max 1200px)
 *  - "narrow"— wąski, do formularzy i pojedynczych kart (max 640px)
 */
export default function PageContainer({
  children,
  width = "app",
  className = "",
}: {
  children: ReactNode;
  width?: "app" | "wide" | "narrow";
  className?: string;
}) {
  const max = {
    app: "max-w-[920px]",
    wide: "max-w-[1200px]",
    narrow: "max-w-[640px]",
  }[width];

  return (
    <main className="flex flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
      <div className={`w-full ${max} mx-auto flex flex-col gap-5 ${className}`}>
        {children}
      </div>
    </main>
  );
}
