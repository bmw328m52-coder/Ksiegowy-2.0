import PageHeader from "@/components/PageHeader";
import ClientForm from "../ClientForm";
import { createClientAction } from "../actions";

export const metadata = { title: "Nowy klient" };

export default function NewClientPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="w-full max-w-md mx-auto">
        <PageHeader title="Nowy klient" back={{ href: "/clients" }} />
        <ClientForm action={createClientAction} submitLabel="Zapisz klienta" />
      </div>
    </main>
  );
}
