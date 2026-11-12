import { jobFileUrls, listJobFiles } from "@/lib/dao/job_files";
import ProjectFiles from "./ProjectFiles";

// „Projekt" — rzuty z PRO100 przy zleceniu, do oglądania i poprawiania na tablecie.
export default async function ProjectFilesSection({ jobId }: { jobId: string }) {
  const files = await listJobFiles(jobId);

  return (
    <section className="mt-4 rounded-xl border border-[#ededea] bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">Projekt</p>
        {files && files.length > 0 && (
          <span className="text-[11px] text-[#8d8a85]">dotknij, żeby powiększyć i poprawić</span>
        )}
      </div>
      {files === null ? (
        <p className="text-xs text-[#8d8a85]">
          Brak tabeli na pliki projektu — wgraj migrację <code>0053_job_files.sql</code> w Supabase.
        </p>
      ) : (
        <ProjectFiles jobId={jobId} initial={files} urls={await jobFileUrls(files)} />
      )}
    </section>
  );
}
