import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import RightPanel from "@/components/RightPanel";
import ActiveTimerBar from "@/components/ActiveTimerBar";
import ToastContainer from "@/components/ToastContainer";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { PrivateModeProvider } from "@/components/PrivateModeProvider";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://meble-app-three.vercel.app"),
  title: {
    default: "Manager Firmy — LUVIANO",
    template: "%s | Manager Firmy",
  },
  description:
    "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków i terminy VAT.",
  applicationName: "Manager Firmy",
  openGraph: {
    title: "Manager Firmy — LUVIANO",
    description:
      "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków i terminy VAT.",
    siteName: "Manager Firmy",
    locale: "pl_PL",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "LUVIANO" }],
  },
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
  themeColor: "#ffffff",
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
    <html lang="pl" translate="no" className={`notranslate h-full antialiased ${inter.variable}`}>
      <body className="min-h-full text-[#1f1d1b] pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 bg-white">
        <PrivateModeProvider>
          <div className="flex flex-col min-h-full md:max-w-[1500px] md:mx-auto md:p-[18px] md:grid md:gap-[18px] md:items-start md:[grid-template-columns:240px_minmax(0,1fr)] lg:[grid-template-columns:240px_minmax(0,1fr)_300px]">
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
            <div className="flex flex-col min-w-0 md:rounded-[18px] md:bg-white md:border md:border-[#ededea] md:overflow-hidden">
              {children}
            </div>
            <RightPanel />
          </div>
          <ToastContainer />
          <ActiveTimerBar />
          <BottomNav />
          <ServiceWorkerRegistrar />
        </PrivateModeProvider>
      </body>
    </html>
  );
}
