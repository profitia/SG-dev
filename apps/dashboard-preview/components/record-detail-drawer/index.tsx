export function RecordDetailDrawerPlaceholder() {
  return (
    <section className="panel" style={{ gridColumn: 'span 4' }}>
      <strong>Record detail placeholder</strong>
      <p className="muted">Full PostgreSQL record fields and fallback-derived metadata will be shown here.</p>
    </section>
  )
}
