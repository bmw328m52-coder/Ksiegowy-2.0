import { fmtDate, fmtPLN } from "./format";
import { phaseOfStatus, type PhaseContext, type PhaseTask } from "./jobPhases";

export type PhaseCard = { title: string; lead?: string; tasks: PhaseTask[] };

/**
 * Treść karty „Teraz" dla bieżącej fazy zlecenia. Zadania to wyłącznie podpowiedź —
 * nic nie blokuje zmiany etapu. cancelled → null.
 */
export function getPhaseCard(ctx: PhaseContext): PhaseCard | null {
  const phase = phaseOfStatus(ctx.status);
  if (!phase) return null;
  const s = ctx.status;
  const st = (v: boolean): PhaseTask["state"] => (v ? "done" : "todo");

  switch (phase) {
    case "pomiar": {
      return {
        title: "Zmierz pomieszczenie",
        lead: "Skan iPadem i krótki brief po wizycie. Potem wycena policzy się z tych danych.",
        tasks: [
          { key: "inquiry", label: "Zapytanie przyjęte", state: "done" },
          {
            key: "scheduled",
            label: "Pomiar umówiony",
            state: st(s !== "new_inquiry"),
            meta: ctx.startDate ? fmtDate(ctx.startDate) : undefined,
          },
          {
            key: "scan",
            label: "Skan iPadem (LiDAR)",
            state: st(ctx.scanCount > 0),
            meta:
              ctx.scanCount > 0
                ? `${ctx.scanCount} ${ctx.scanCount === 1 ? "skan" : "skanów"}`
                : undefined,
            href: `/jobs/${ctx.jobId}?faza=pomiar#skan`,
            actionLabel: "Skanuj",
          },
          {
            key: "brief",
            label: "Brief: okucia, szuflady, LED",
            state: st(ctx.hasBrief),
            href: `/jobs/${ctx.jobId}/pomiar/edit`,
            actionLabel: "Wypełnij",
          },
        ],
      };
    }
    case "wycena":
      return {
        title: "Policz i wyślij wycenę",
        tasks: [
          {
            key: "scan-price",
            label: "Cena ze skanu",
            state: st(ctx.scanCount > 0),
            meta: ctx.scanCount > 0 ? "gotowa" : undefined,
            href: `/jobs/${ctx.jobId}?faza=pomiar#skan`,
            actionLabel: "Otwórz",
          },
          {
            key: "materials",
            label: "Pozycje, materiały, okucia",
            state: st(ctx.hasMaterials),
            href: `/jobs/${ctx.jobId}/wycena`,
            actionLabel: "Otwórz",
          },
          {
            key: "profit",
            label: "Rentowność i cena końcowa",
            state: st(ctx.hasQuote),
            href: `/calculator?job=${ctx.jobId}`,
            actionLabel: "Sprawdź",
          },
        ],
      };
    case "akceptacja":
      return {
        title: "Czekamy na decyzję klienta",
        tasks: [
          { key: "sent", label: "Wycena wysłana", state: "done" },
          {
            key: "deposit",
            label: "Zaliczka",
            state: st(ctx.depositAmount > 0),
            meta: ctx.depositAmount > 0 ? fmtPLN(ctx.depositAmount) : undefined,
            href: `/jobs/${ctx.jobId}?faza=finanse#plan`,
            actionLabel: "Dodaj",
          },
        ],
      };
    case "produkcja": {
      const inProd = s === "in_production";
      const ordered = s === "materials_ordered" || inProd;
      return {
        title: "Zamów i wyprodukuj",
        lead: ctx.dueDate ? `Termin: ${fmtDate(ctx.dueDate)}.` : undefined,
        tasks: [
          {
            key: "shopping",
            label: "Lista zakupów",
            state: st(ordered),
            href: `/jobs/${ctx.jobId}/zakupy`,
            actionLabel: "Otwórz",
          },
          { key: "ordered", label: "Materiały zamówione", state: st(ordered) },
          {
            key: "production",
            label: "W produkcji",
            state: st(inProd),
            meta: ctx.dueDate ? `termin ${fmtDate(ctx.dueDate)}` : undefined,
          },
        ],
      };
    }
    case "montaz": {
      const closed = s === "settled" || s === "archived";
      const installed = s === "installed" || closed;
      const title =
        s === "ready_to_install"
          ? "Zamontuj u klienta"
          : s === "installed"
            ? "Rozlicz zlecenie"
            : "Zlecenie zamknięte";
      return {
        title,
        tasks: [
          { key: "ready", label: "Gotowe do montażu", state: "done" },
          {
            key: "installed",
            label: "Zamontowane",
            state: st(installed),
            meta: installed && ctx.completedDate ? fmtDate(ctx.completedDate) : undefined,
          },
          {
            key: "invoice",
            label: "Faktura",
            state: st(ctx.invoiced),
            meta: ctx.invoiced && ctx.invoiceNumber ? ctx.invoiceNumber : undefined,
            href: `/jobs/${ctx.jobId}?faza=finanse#faktura`,
            actionLabel: "Wystaw",
          },
          {
            key: "paid",
            label: "Zapłacone",
            state: st(closed),
            meta: closed && ctx.paidDate ? fmtDate(ctx.paidDate) : undefined,
          },
        ],
      };
    }
  }
}
