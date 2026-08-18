export type DashboardShellNotice = {
  title: string
  message: string
}

export type DashboardShellVariantSwitcherItem = {
  id: string
  label: string
  href: string
  active: boolean
}

export type DashboardShellVariantLibrary = {
  kicker: string
  title: string
  currentVariantLabel: string
  currentVariantValue: string
  currentVariantSummary: string
  lifecycleLabel: string
  lifecycleValue: string
  runtimeLabel: string
  runtimeValue: string
  switcherLabel: string
  switcherHint: string
  switcherItems: DashboardShellVariantSwitcherItem[]
}

type DashboardShellProps = {
  children: React.ReactNode
  embedded?: boolean
  notice?: DashboardShellNotice | null
  variantLibrary?: DashboardShellVariantLibrary | null
}

export function DashboardShell({
  children,
  embedded = false,
  notice = null,
  variantLibrary = null,
}: DashboardShellProps) {
  return (
    <main className={`app-shell${embedded ? ' is-embedded' : ''}`}>
      {embedded ? null : (
        <>
          <header className="app-shell-brand">
            <p className="muted app-shell-kicker">
              SpendGuru 2.0
            </p>
            <div className="app-shell-brand-copy">
              <strong className="app-shell-brand-title">Executive Procurement Intelligence Workspace</strong>
              <p className="muted app-shell-brand-text">Dashboard preview module</p>
            </div>
          </header>
          {variantLibrary ? (
            <section className="panel variant-library-panel">
              <div className="variant-library-header">
                <div className="variant-library-copy">
                  <p className="muted app-shell-kicker">{variantLibrary.kicker}</p>
                  <strong className="variant-library-title">{variantLibrary.title}</strong>
                  <p className="muted variant-library-summary">{variantLibrary.currentVariantSummary}</p>
                </div>

                <dl className="variant-library-meta">
                  <div>
                    <dt>{variantLibrary.currentVariantLabel}</dt>
                    <dd>{variantLibrary.currentVariantValue}</dd>
                  </div>
                  <div>
                    <dt>{variantLibrary.lifecycleLabel}</dt>
                    <dd>{variantLibrary.lifecycleValue}</dd>
                  </div>
                  <div>
                    <dt>{variantLibrary.runtimeLabel}</dt>
                    <dd>{variantLibrary.runtimeValue}</dd>
                  </div>
                </dl>
              </div>

              <div className="variant-switcher">
                <span className="variant-switcher-label">{variantLibrary.switcherLabel}</span>
                <div className="variant-switcher-links">
                  {variantLibrary.switcherItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      className={`variant-switcher-link${item.active ? ' is-active' : ''}`}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>

              <p className="muted variant-switcher-hint">{variantLibrary.switcherHint}</p>
            </section>
          ) : null}
          {notice ? (
            <div className="callout variant-notice" role="status" aria-live="polite">
              <strong>{notice.title}</strong>
              <p>{notice.message}</p>
            </div>
          ) : null}
        </>
      )}
      {children}
    </main>
  )
}
