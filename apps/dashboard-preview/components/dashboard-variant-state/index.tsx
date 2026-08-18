type DashboardVariantStateProps = {
  title: string
  body: string
  metaItems: string[]
  embedded?: boolean
  actionHref?: string
  actionLabel?: string
}

export function DashboardVariantState({
  title,
  body,
  metaItems,
  embedded = false,
  actionHref,
  actionLabel,
}: DashboardVariantStateProps) {
  return (
    <section
      className={`panel chart-panel-full variant-state-panel${embedded ? ' is-embedded' : ''}`}
      style={{ gridColumn: 'span 12', minHeight: embedded ? '240px' : '320px' }}
    >
      <div>
        <p className="muted variant-state-kicker">Dashboard Preview</p>
        <h1 className="variant-state-title">{title}</h1>
        <p className="variant-state-body">{body}</p>
      </div>

      <div className="variant-state-meta">
        {metaItems.map((item) => (
          <span key={item} className="variant-state-meta-item">{item}</span>
        ))}
      </div>

      {actionHref && actionLabel ? (
        <div className="variant-state-actions">
          <a href={actionHref} className="callout-button">{actionLabel}</a>
        </div>
      ) : null}
    </section>
  )
}