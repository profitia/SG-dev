import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@profitia/srm-xray/msr-financial-tables.css";

export const metadata: Metadata = {
  title: "X-Ray | Supplier Intelligence Dashboard",
  icons: { icon: [{ url: "/spendguru/favicon.svg", type: "image/svg+xml" }] },
  description: "Karta dostawcy SRM",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
