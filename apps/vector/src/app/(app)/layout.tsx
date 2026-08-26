import { AppShell } from "@/components/layout/AppShell"

// All app pages are server-rendered on demand — DB queries run at request time,
// not at build time (avoids ECONNREFUSED during static generation on Render)
export const dynamic = "force-dynamic"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
