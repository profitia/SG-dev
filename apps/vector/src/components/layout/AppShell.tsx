import { Sidebar } from "@/components/layout/Sidebar"
import { QuickCapture } from "@/components/dashboard/QuickCapture"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-[220px]">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <QuickCapture />
    </div>
  )
}
