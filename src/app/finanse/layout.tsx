import type { ReactNode } from "react";
import FinanceTabs from "@/components/finance/FinanceTabs";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <FinanceTabs />
      {children}
    </>
  );
}
