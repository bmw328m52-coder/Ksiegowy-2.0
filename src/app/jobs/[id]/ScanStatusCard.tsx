import type { RoomScan } from "@/lib/dao/room_scans.types";
import { scanChecklist } from "@/lib/scanChecklist";
import { fmtDate } from "@/lib/format";

/** Link otwierający aplikację LUVIANO Skaner na iPadzie od razu na tym zleceniu. */
export const skanerUrl = (jobId: string) => `luvianoskaner://job/${jobId}`;

// Krok 1 pomiaru: skan iPadem. Stan ostatniego skanu + lista kontrolna
// (to samo, co pokazuje iPad przed wysłaniem).
export default function ScanStatusCard({ jobId, scans }: { jobId: string; scans: RoomScan[] }) {
  const latest = scans[0];
  const items = latest ? scanChecklist(latest.data) : [];
  const done = items.filter((i) => i.ok).length;
  const missing = items.filter((i) => !i.ok);
  const complete = latest && missing.length === 0;

  return (
    <section className="mt-4 rounded-xl border border-[#ededea] bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-[#8d8a85]">Pomiar · skan iPadem</p>
          {latest ? (
            <p className="text-sm font-medium text-[#1f1d1b] truncate">
              {latest.name} <span className="text-xs font-normal text-[#8d8a85]">· {fmtDate(latest.created_at)}</span>
            </p>
          ) : (
            <p className="text-sm text-[#6f6c66]">Brak skanu</p>
          )}
        </div>
        <a
          href={skanerUrl(jobId)}
          className="shrink-0 rounded-lg text-white text-[13px] font-semibold px-3 py-1.5 bg-[linear-gradient(160deg,#a06f3f,#7d5530)]"
        >
          {latest ? "Edytuj w Skanerze" : "Skanuj iPadem"}
        </a>
      </div>

      {latest ? (
        <>
          <div>
            <div className="flex items-baseline justify-between text-xs">
              <span className={complete ? "text-[#3a6b4d] font-medium" : "text-[#b0702a] font-medium"}>
                {complete ? "✓ Pomiar kompletny" : `Lista kontrolna: brakuje ${missing.length}`}
              </span>
              <span className="tabular-nums text-[#8d8a85]">
                {done}/{items.length}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-[#f0efec] overflow-hidden">
              <div
                className={`h-full ${complete ? "bg-[#3a6b4d]" : "bg-[#d99a4e]"}`}
                style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          {missing.length > 0 && (
            <ul className="space-y-1">
              {missing.slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-[#1f1d1b]">
                    <span className="text-[#d99a4e]">○</span> {i.title}
                  </span>
                  <span className="text-[#8d8a85] text-right">{i.detail}</span>
                </li>
              ))}
              {missing.length > 8 && <li className="text-[11px] text-[#8d8a85]">… i {missing.length - 8} więcej</li>}
            </ul>
          )}
          {scans.length > 1 && (
            <p className="text-[11px] text-[#8d8a85]">Skanów w zleceniu: {scans.length} — lista dotyczy najnowszego.</p>
          )}
        </>
      ) : (
        <p className="text-xs text-[#6f6c66]">
          Na iPadzie: „Skanuj iPadem” otworzy LUVIANO Skaner na tym zleceniu. Wymiary, okna, instalacje i zdjęcia
          trafią tu same po wysłaniu.
        </p>
      )}
    </section>
  );
}
