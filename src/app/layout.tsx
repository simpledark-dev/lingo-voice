import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./live.css";

export const metadata: Metadata = {
  title: "Lingo · live practice rooms",
  description: "Live language pronunciation practice rooms: listen, raise your hand, read aloud, get feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
