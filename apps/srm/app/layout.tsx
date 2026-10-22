import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "../src/modules/xray/supplier-locations.css";
import "@profitia/srm-xray/msr-financial-tables.css";
import { readSrmIdentityRuntime, type SrmIdentityRuntime } from "../src/server/identity-runtime";
import { SrmIdentityProvider } from "./session-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "X-Ray | Supplier Intelligence Dashboard",
  icons: { icon: [{ url: "/spendguru/favicon.svg", type: "image/svg+xml" }] },
  description: "Karta dostawcy SRM",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  let identity: SrmIdentityRuntime | null = null;
  try { identity = readSrmIdentityRuntime(); }
  catch { /* Invalid explicit configuration never renders a legacy application. */ }
  return (
    <html lang="pl">
      <body><SrmIdentityProvider mode={identity?.provider ?? "unavailable"}
        publishableKey={identity?.provider === "clerk" ? identity.publishableKey : undefined}>{children}</SrmIdentityProvider></body>
    </html>
  );
}
