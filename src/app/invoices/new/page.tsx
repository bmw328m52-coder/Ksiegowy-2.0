import Link from "next/link";
import { PageContainer } from "@/components/ui";
import BatchScanner from "../BatchScanner";

export const metadata = { title: "Skaner dokumentów" };

export default function NewInvoicePage() {
  return (
    <PageContainer className="lv-home">
      <header className="lf-hero">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lv-eyebrow">Faktury i paragony</p>
            <h1 className="lv-hello">
              Skaner dokumentów
              <span>Zrób kilka zdjęć naraz, resztę odczyta aplikacja</span>
            </h1>
          </div>
          <Link href="/invoices" className="lj-back" aria-label="Wstecz do faktur">
            ✕
          </Link>
        </div>
      </header>
      <BatchScanner />
    </PageContainer>
  );
}
