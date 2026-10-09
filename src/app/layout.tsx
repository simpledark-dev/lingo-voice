import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/web/pwa/ServiceWorkerRegister";
import "./globals.css";
import "./live.css";

const manrope = Manrope({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"], display: "swap", variable: "--lv-font" });

export const metadata: Metadata = {
  title: "Lingo · live practice rooms",
  description: "Live language pronunciation practice rooms: listen, raise your hand, read aloud, get feedback.",
  applicationName: "Lingo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lingo" },
  icons: { icon: "/icons/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0c16",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
