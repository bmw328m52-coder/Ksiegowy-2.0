import { redirect } from "next/navigation";

// Klienci są teraz zakładką w jednym ekranie „Zlecenia i klienci”.
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(`/jobs?v=klienci${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}
