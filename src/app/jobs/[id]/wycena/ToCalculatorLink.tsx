"use client";

import Link from "next/link";
import { fmtPLN } from "@/lib/format";
import { useMaterialsStore } from "./MaterialsStore";

// Przycisk „Dalej" pokazuje na żywo sumę wyceny — to ta kwota trafia do kalkulatora
// jako „Koszty brutto" (kalkulator czyta job_materials przy otwarciu).
export default function ToCalculatorLink({ jobId }: { jobId: string }) {
  const { materials } = useMaterialsStore();
  let total = 0;
  let missing = 0;
  for (const m of materials) {
    if (m.unit_price_gross === null) missing += 1;
    else total += m.qty * m.unit_price_gross;
  }

  return (
    <>
      <Link
        href={`/calculator?job=${jobId}`}
        prefetch={false}
        className="mt-6 flex min-h-[54px] items-center justify-between rounded-2xl bg-[var(--accent)] px-5 text-base font-bold text-white active:opacity-90"
      >
        <span className="flex flex-col leading-tight">
          <span>Dalej: cena i rentowność</span>
          {total > 0 && (
            <span className="text-[12.5px] font-medium opacity-90">
              koszty materiałów {fmtPLN(total)} wpiszą się same
            </span>
          )}
        </span>
        <span aria-hidden>→</span>
      </Link>
      <p className="mt-2 text-center text-[12.5px] text-[var(--muted)]">
        {missing > 0
          ? `${missing} poz. bez ceny — nie wliczone do kosztów. `
          : ""}
        Z tych kosztów policzysz cenę dla klienta i marżę.
      </p>
    </>
  );
}
