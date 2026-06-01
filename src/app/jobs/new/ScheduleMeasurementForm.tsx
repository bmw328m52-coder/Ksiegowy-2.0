"use client";

import { useActionState, useState } from "react";
import type { ProjectType } from "@/lib/dao/job_checklist.types";

type Result = { error?: string };

type ProjectTypeOption = { value: ProjectType; label: string };

export default function ScheduleMeasurementForm({
  clientId,
  defaultProjectType,
  projectTypeOptions,
  defaultAddress,
  defaultPhone,
  action,
}: {
  clientId: string;
  defaultProjectType?: ProjectType;
  projectTypeOptions: ProjectTypeOption[];
  defaultAddress?: string | null;
  defaultPhone?: string | null;
  action: (prev: Result, formData: FormData) => Promise<Result>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: undefined });
  const [projectType, setProjectType] = useState<ProjectType>(
    defaultProjectType ?? "kitchen"
  );
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#6b6661]">Tytuł zlecenia</span>
        <input
          type="text"
          name="title"
          required
          placeholder="np. Kuchnia — Kowalscy, Wrocław"
          className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#a06f3f]"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#6b6661]">Typ projektu</span>
        <div className="flex gap-2">
          {projectTypeOptions.map((opt) => {
            const active = projectType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProjectType(opt.value)}
                className={[
                  "flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "border-[#a06f3f] bg-[#f1e5d2] text-[#7d5530]"
                    : "border-[#e6dcc7] bg-white text-[#524d48] hover:bg-[#faf7f2]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="project_type" value={projectType} />
      </div>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[12px] font-medium text-[#6b6661]">Data pomiaru</span>
          <input
            type="date"
            name="visit_date"
            required
            defaultValue={todayIso}
            min={todayIso}
            className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#a06f3f]"
          />
        </label>
        <label className="flex w-[110px] flex-col gap-1">
          <span className="text-[12px] font-medium text-[#6b6661]">Godzina</span>
          <input
            type="time"
            name="visit_time"
            className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#a06f3f]"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#6b6661]">Adres pomiaru</span>
        <input
          type="text"
          name="visit_address"
          defaultValue={defaultAddress ?? ""}
          placeholder="ul. Przykładowa 12, Wrocław"
          className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#a06f3f]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#6b6661]">Telefon do klienta</span>
        <input
          type="tel"
          name="visit_phone"
          defaultValue={defaultPhone ?? ""}
          placeholder="+48 ..."
          inputMode="tel"
          className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#a06f3f]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-[#6b6661]">Notatka (opcjonalnie)</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="np. dojazd 2 ścianami, parking od strony podwórka"
          className="rounded-lg border border-[#e6dcc7] bg-white px-3 py-2 text-[14px] focus:outline-none focus:border-[#a06f3f]"
        />
      </label>

      {state.error && (
        <p className="rounded-lg border border-[#f4c8bc] bg-[#fdf2ed] px-3 py-2 text-[12px] text-[#b8523a]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-xl px-4 py-3 text-[14px] font-bold text-white shadow-[0_6px_14px_rgba(160,111,63,.25)] disabled:opacity-60"
        style={{ background: "linear-gradient(160deg, #a06f3f, #7d5530)" }}
      >
        {pending ? "Zapisywanie…" : "Zaplanuj pomiar"}
      </button>
    </form>
  );
}
