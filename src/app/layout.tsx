import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ToastContainer from "@/components/ToastContainer";

export const metadata: Metadata = {
  title: {
    default: "Manager Firmy — LUVIANO",
    template: "%s | Manager Firmy",
  },
  description:
    "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków i terminy VAT.",
  applicationName: "Manager Firmy",
  appleWebApp: {
    capable: true,
    title: "Manager Firmy",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#282624",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" translate="no" className="notranslate h-full antialiased">
      <body
        className="min-h-full flex flex-col text-[#282624]"
        style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        {children}
        <ToastContainer />
        <BottomNav />
      </body>
    </html>
  );
}
