"use client";

import type { ReactNode } from "react";

export default function ConfirmSubmitButton({
  message,
  className,
  children,
  formNoValidate,
}: {
  message: string;
  className?: string;
  children: ReactNode;
  formNoValidate?: boolean;
}) {
  return (
    <button
      type="submit"
      formNoValidate={formNoValidate}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </button>
  );
}
