"use client";

import { assignInvoiceToJobAction } from "../actions";

type JobOption = { id: string; title: string; client_name: string };

// Jedno kliknięcie zamiast przypinania każdej pozycji z osobna (faktury z KSeF
// od Zimexu/Mercury mają po kilkadziesiąt linii, zwykle wszystkie pod jedno zlecenie).
export default function AssignInvoiceJob({
  invoiceId,
  jobs,
  currentJobId,
}: {
  invoiceId: string;
  jobs: JobOption[];
  /** Wspólne zlecenie wszystkich pozycji; "" = koszt ogólny, null = pozycje rozbite na różne. */
  currentJobId: string | null;
}) {
  return (
    <form
      action={assignInvoiceToJobAction}
      className="mb-3 flex flex-col gap-1.5 rounded-xl border border-[#e2c79c] bg-[var(--accent-soft)] p-3"
    >
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <label className="text-[13px] font-semibold text-[#7d5530]">Cała faktura → zlecenie</label>
      <select
        name="job_id"
        key={currentJobId ?? "mixed"}
        defaultValue={currentJobId === null ? "__mixed__" : currentJobId || "__none__"}
        onChange={(e) => {
          if (e.currentTarget.value !== "__mixed__") e.currentTarget.form?.requestSubmit();
        }}
        className="w-full rounded-md border border-zinc-300 bg-white text-zinc-900 px-2 min-h-[44px] text-sm focus:outline-none focus:border-accent"
      >
        {currentJobId === null && <option value="__mixed__">— pozycje w różnych zleceniach —</option>}
        <option value="__none__">— koszt ogólny —</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title} ({j.client_name})
          </option>
        ))}
      </select>
      <p className="text-[12px] text-[var(--accent)]">
        Przypisuje wszystkie pozycje naraz. Pojedyncze pozycje możesz potem przepiąć niżej.
      </p>
    </form>
  );
}
