"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initial: string;
  name: string;
  email?: string;
  signOutAction: () => Promise<void>;
};

export default function UserAvatarMenu({ initial, name, email, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px] active:opacity-90 hover:shadow-md transition-shadow"
        style={{ background: "linear-gradient(160deg, #57534e, #3a3633)" }}
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#e6dcc7] bg-white shadow-[0_10px_24px_rgba(40,38,36,0.12)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#f0ece5]">
            <p className="text-[13px] font-semibold text-[#282624] truncate">{name}</p>
            {email && (
              <p className="text-[11px] text-[#9c9081] truncate mt-0.5">{email}</p>
            )}
          </div>
          <a
            href="/settings"
            className="block px-4 py-2.5 text-[13px] text-[#282624] hover:bg-[#faf7f2] active:bg-[#f5f3ef]"
          >
            Ustawienia
          </a>
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-[#faf7f2] active:bg-[#f5f3ef] border-t border-[#f0ece5]"
            >
              Wyloguj
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
