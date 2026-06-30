import Image from "next/image";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Zmiana hasła" };

export default function ResetPasswordPage() {
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
          <h1 className="text-xl font-semibold">Ustaw nowe hasło</h1>
          <p className="text-sm text-zinc-500">Wpisz nowe hasło do swojego konta.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
