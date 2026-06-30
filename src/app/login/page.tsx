import Image from "next/image";
import LoginForm from "./LoginForm";

export const metadata = { title: "Logowanie" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <Image
          src="/brand/logo-luviano.png"
          alt="LUVIANO"
          width={420}
          height={108}
          priority
          className="w-full h-auto max-w-[220px]"
        />
        <div className="text-center">
          <h1 className="text-xl font-semibold">Manager Firmy</h1>
          <p className="text-sm text-zinc-500">Zaloguj się, aby kontynuować.</p>
        </div>
        {error === "link" && (
          <p className="w-full text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-center">
            Link wygasł lub jest nieprawidłowy. Poproś o nowy link do zmiany hasła.
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
