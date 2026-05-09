import PageHeader from "@/components/PageHeader";
import UploadForm from "../UploadForm";

export const metadata = { title: "Nowa faktura" };

export default function NewInvoicePage() {
  return (
    <main className="flex flex-1 flex-col px-6 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowa faktura" back={{ href: "/invoices" }} />
        <p className="text-sm text-zinc-600 mb-4">
          Wgraj zdjęcie lub PDF faktury kosztowej. Claude AI automatycznie odczyta sprzedawcę,
          numer, daty i kwoty.
        </p>
        <UploadForm />
      </div>
    </main>
  );
}
