import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PRIORITY_CONFIG = {
  high: { color: 'text-text-primary', dot: 'bg-accent', label: 'high' },
  medium: { color: 'text-text-secondary', dot: 'bg-text-tertiary', label: 'medium' },
  low: { color: 'text-text-tertiary', dot: 'bg-bg-border', label: 'low' },
} as const

export default async function PrinciplesPage() {
  const principles = await db.canonicalPrinciple.findMany({
    include: {
      nodes: { include: { node: { select: { id: true, title: true } } } },
      decisions: { include: { decision: { select: { id: true, title: true } } } },
      warnings: { where: { resolved: false }, select: { id: true, severity: true, title: true } },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  const highCount = principles.filter((p) => p.priority === 'high').length
  const withViolations = principles.filter((p) => p.warnings.length > 0).length

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-text-primary text-xl font-semibold mb-1">Canonical Principles</h1>
        <p className="text-text-tertiary text-sm">
          Canonical architecture rules that govern all technical decisions in this project
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-bg-surface border border-bg-border rounded-lg px-4 py-3">
          <div className="text-xs text-text-tertiary mb-1">total principles</div>
          <div className="text-text-primary text-xl font-semibold">{principles.length}</div>
        </div>
        <div className="bg-bg-surface border border-bg-border rounded-lg px-4 py-3">
          <div className="text-xs text-accent/70 mb-1">high priority</div>
          <div className="text-text-primary text-xl font-semibold">{highCount}</div>
        </div>
        <div className="bg-bg-surface border border-bg-border rounded-lg px-4 py-3">
          <div className="text-xs text-orange-400/70 mb-1">with active warnings</div>
          <div className="text-text-primary text-xl font-semibold">{withViolations}</div>
        </div>
      </div>

      {/* Principles list */}
      <div className="space-y-4">
        {principles.map((principle, i) => {
          const cfg = PRIORITY_CONFIG[principle.priority as keyof typeof PRIORITY_CONFIG]
          return (
            <div key={principle.id} className="bg-bg-surface border border-bg-border rounded-lg p-5">
              {/* Number + title */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-text-tertiary text-sm font-mono flex-shrink-0 w-5 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <h3 className={`text-sm font-medium ${cfg.color}`}>{principle.title}</h3>
                    <span className="text-2xs text-text-tertiary ml-auto">{cfg.label}</span>
                  </div>

                  {/* Description */}
                  <p className="text-text-secondary text-sm leading-relaxed mb-3">{principle.description}</p>

                  {/* Reason */}
                  {principle.reason && (
                    <div className="bg-bg-elevated rounded px-3 py-2 mb-3">
                      <span className="text-2xs text-text-tertiary uppercase tracking-wide block mb-1">Why</span>
                      <p className="text-text-secondary text-xs leading-relaxed">{principle.reason}</p>
                    </div>
                  )}

                  {/* Relations */}
                  <div className="flex flex-wrap items-center gap-3">
                    {principle.nodes.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xs text-text-tertiary">roadmap:</span>
                        {principle.nodes.map(({ node }) => (
                          <span key={node.id} className="text-2xs text-text-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">
                            {node.title.split('—')[0].trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    {principle.decisions.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xs text-text-tertiary">decisions:</span>
                        {principle.decisions.map(({ decision }) => (
                          <span key={decision.id} className="text-2xs text-text-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">
                            {decision.title.split(' ').slice(0, 3).join(' ')}…
                          </span>
                        ))}
                      </div>
                    )}
                    {principle.warnings.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-2xs text-orange-400">
                          {principle.warnings.length} active warning{principle.warnings.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Source attribution */}
      <div className="mt-8 pt-6 border-t border-bg-border">
        <p className="text-text-tertiary text-xs">
          Source: <span className="text-text-secondary">Strategic Architecture &amp; Conversational Intelligence Blueprint</span>
          <span className="ml-2 text-text-tertiary">&mdash; decomposed into structured operational knowledge</span>
        </p>
      </div>
    </div>
  )
}
