import type { ReactNode } from "react";

export function Money({
  children,
  className = "",
  as: As = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "strong" | "b" | "p";
}) {
  return <As className={`money ${className}`.trim()}>{children}</As>;
}
