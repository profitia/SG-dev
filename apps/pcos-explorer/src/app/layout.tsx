import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/nav/sidebar";
import { EXPLORER_ORG_ID, EXPLORER_ENV } from "@/lib/org";
import { getNavigationItems } from "@/registry/index";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PCOS Cognition Explorer",
  description:
    "Operational cognition inspection layer for the PCOS Runtime — read-only view of procurement cognition artifacts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = getNavigationItems();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--accent))/0.35,transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(222_18%_7%))]">
          <Sidebar orgId={EXPLORER_ORG_ID} env={EXPLORER_ENV} navItems={navItems} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
