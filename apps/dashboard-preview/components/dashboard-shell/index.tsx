type DashboardShellProps = {
  children: React.ReactNode
  embedded?: boolean
}

export function DashboardShell({ children, embedded = false }: DashboardShellProps) {
  return (
    <main className={`app-shell${embedded ? ' is-embedded' : ''}`}>
      {embedded ? null : (
        <header className="app-shell-brand">
          <p className="muted app-shell-kicker">
            SpendGuru 2.0
          </p>
          <div className="app-shell-brand-copy">
            <strong className="app-shell-brand-title">Executive Procurement Intelligence Workspace</strong>
            <p className="muted app-shell-brand-text">Dashboard preview module</p>
          </div>
        </header>
      )}
      {children}
    </main>
  )
}
