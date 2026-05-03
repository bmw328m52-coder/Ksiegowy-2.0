import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manager Firmy — LUVIANO",
    short_name: "Manager Firmy",
    description:
      "Centrum zarządzania firmą LUVIANO: faktury, klienci, koszty, kalkulatory podatków, terminy VAT.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#282624",
    lang: "pl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Nowa faktura",
        short_name: "Faktura",
        description: "Zrób zdjęcie faktury kosztowej i odpal OCR",
        url: "/invoices/new",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Bilans miesiąca, VAT, PIT, ZUS",
        url: "/dashboard",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Kalkulator",
        short_name: "Kalkulator",
        description: "Wycena zlecenia z podatkami",
        url: "/calculator",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
