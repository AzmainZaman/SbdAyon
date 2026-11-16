import type { Metadata } from "next";
import "./globals.css";
import { SITE } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${SITE.name} — Shop the world, delivered in Bangladesh`, template: `%s · ${SITE.name}` },
  description: "Pre-order products from the USA, Europe, UAE, China, Malaysia and Thailand. One price in taka, a delivery date before you pay, and tracking until it reaches you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
