export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell">
      <div className="app-shell-brand">
        <p className="muted app-shell-kicker">
          SpendGuru 2.0
        </p>
      </div>
      {children}
    </main>
  )
}
