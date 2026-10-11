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
    default: "LUVIANO app",
    template: "%s | LUVIANO app",
  },
  description:
    "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków i terminy VAT.",
  applicationName: "LUVIANO app",
  openGraph: {
    title: "LUVIANO app",
    description:
      "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków i terminy VAT.",
    siteName: "LUVIANO app",
    locale: "pl_PL",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "LUVIANO" }],
  },
  appleWebApp: {
    capable: true,
    title: "LUVIANO app",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f1",
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
      <body className="min-h-full text-[#1f1d1b] pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 bg-[#f2f2f1]">
        <PrivateModeProvider>
          <div className="flex flex-col min-h-full md:max-w-[1500px] md:mx-auto md:p-[18px] md:grid md:gap-[18px] md:items-start md:[grid-template-columns:240px_minmax(0,1fr)] lg:[grid-template-columns:240px_minmax(0,1fr)_300px]">
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
            <div className="flex flex-col min-w-0">
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
