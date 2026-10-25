import { listEntriesByJob, totalMinutes } from "@/lib/dao/time_entries";
import { listMaterialsByJob } from "@/lib/dao/material_catalog";
import LaborForm from "./LaborForm";

const FUEL_GROUP_KEY = "paliwo";

// Godziny pracy (time_entries) i paliwo/dojazd (pozycja wyceny) wpisywane
// wprost na zleceniu — bez licznika i bez wchodzenia w wycenę.
export default async function LaborSection({ jobId, defaultDate }: { jobId: string; defaultDate: string }) {
  const [entries, materials] = await Promise.all([listEntriesByJob(jobId), listMaterialsByJob(jobId)]);
  const fuel = materials.find((m) => m.group_key === FUEL_GROUP_KEY) ?? null;
  return (
    <LaborForm
      jobId={jobId}
      defaultDate={defaultDate}
      totalMin={totalMinutes(entries)}
      entries={entries
        .filter((e) => e.ended_at || e.duration_minutes)
        .map((e) => ({
          id: e.id,
          date: (e.started_at ?? "").slice(0, 10),
          minutes: e.duration_minutes ?? 0,
          phase: e.phase,
          notes: e.notes,
        }))}
      fuel={fuel ? { id: fuel.id, amount: Number(fuel.unit_price_gross) * Number(fuel.qty ?? 1) } : null}
    />
  );
}
