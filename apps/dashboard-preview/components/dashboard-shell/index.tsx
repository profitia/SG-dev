export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <p className="muted" style={{ margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
          SpendGuru 2.0
        </p>
      </div>
      {children}
    </main>
  )
}
