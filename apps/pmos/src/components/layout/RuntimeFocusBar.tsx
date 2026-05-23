import { db } from '@/lib/db'

const WARN_COLOR: Record<string, string> = {
  critical: 'text-warn-critical',
  high:     'text-warn-high',
  medium:   'text-warn-medium',
  low:      'text-text-tertiary',
}

const WARN_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-500',
  low:      'bg-neutral-600',
}

function formatRelTime(date: Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'just now'
  if (hours < 1) return `${mins}m`
  if (days < 1) return `${hours}h`
  if (days < 7) return `${days}d`
  return new Date(date).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

export async function RuntimeFocusBar() {
  const [activeEtap, lastLog, activeWarnings, totalWarnings] = await Promise.all([
    db.roadmapNode.findFirst({
      where: { parentId: null, status: 'in_progress', scope: 'active' },
      orderBy: { sortKey: 'asc' },
      include: {
        children: {
          orderBy: { order: 'asc' },
          where: { status: { in: ['in_progress', 'backlog'] } },
          take: 3,
        },
      },
    }),
    db.executionLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, title: true },
    }),
    db.architectureWarning.findMany({
      where: { resolved: false },
      select: { id: true, title: true, severity: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    }),
    db.architectureWarning.count({ where: { resolved: false } }),
  ])

  const activeChild = activeEtap?.children.find((c) => c.status === 'in_progress')
  const nextChild   = activeEtap?.children.find((c) => c.status === 'backlog')

  // Strip "ETAP N — " prefix for brevity
  const etapShort = activeEtap?.title
    ? activeEtap.title.replace(/^ETAP\s*\d+\s*[—–-]\s*/i, '')
    : null
  const etapNum = activeEtap?.sortKey ?? null

  const criticalCount = activeWarnings.filter((w) => w.severity === 'critical').length
  const highCount     = activeWarnings.filter((w) => w.severity === 'high').length

  return (
    <div className="sticky top-0 z-20 bg-bg-base border-b border-bg-border">
      {/* Primary bar */}
      <div className="flex items-center gap-0 px-6 py-2.5 min-h-[42px]">
        {/* ETAP */}
        <div className="flex items-center gap-2 pr-4 border-r border-bg-border mr-4 min-w-0">
          <span className="font-mono text-2xs text-text-tertiary flex-shrink-0">ETAP</span>
          {activeEtap ? (
            <span className="text-2xs font-medium text-text-primary truncate max-w-[140px]" title={activeEtap.title}>
              {etapNum ? etapNum.replace(/^0+/, '') + ' — ' : ''}{etapShort}
            </span>
          ) : (
            <span className="text-2xs text-text-tertiary">—</span>
          )}
        </div>

        {/* Active node */}
        {activeChild && (
          <div className="flex items-center gap-2 pr-4 border-r border-bg-border mr-4 min-w-0 max-w-[200px]">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 flex-shrink-0" />
            <span className="text-2xs text-text-secondary truncate" title={activeChild.title}>
              {activeChild.title}
            </span>
          </div>
        )}

        {/* Warnings pill */}
        {totalWarnings > 0 && (
          <div className="flex items-center gap-1.5 pr-4 border-r border-bg-border mr-4 flex-shrink-0">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-warn-critical text-2xs font-mono">
                <span className="w-1 h-1 rounded-full bg-red-500" />
                {criticalCount} crit
              </span>
            )}
            {highCount > 0 && (
              <span className="flex items-center gap-1 text-warn-high text-2xs font-mono">
                <span className="w-1 h-1 rounded-full bg-orange-400" />
                {highCount} high
              </span>
            )}
            {(criticalCount === 0 && highCount === 0) && (
              <span className="text-2xs text-text-tertiary font-mono">{totalWarnings} warn</span>
            )}
          </div>
        )}

        {/* Next step */}
        {nextChild && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xs text-text-tertiary flex-shrink-0">next →</span>
            <span className="text-2xs text-text-secondary truncate" title={nextChild.title}>{nextChild.title}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last sync */}
        {lastLog && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
            <span className="text-2xs text-text-tertiary font-mono">
              {formatRelTime(lastLog.createdAt)}
            </span>
          </div>
        )}
      </div>

      {/* Warning chips row — shown only if there are active warnings */}
      {activeWarnings.length > 0 && (
        <div className="flex items-center gap-1.5 px-6 pb-2 overflow-x-auto">
          {activeWarnings.map((w) => (
            <span
              key={w.id}
              className={`flex items-center gap-1 chip flex-shrink-0 ${WARN_COLOR[w.severity]}`}
              style={{ borderColor: 'var(--bg-border)' }}
            >
              <span className={`w-1 h-1 rounded-full ${WARN_DOT[w.severity]}`} />
              {w.title}
            </span>
          ))}
          {totalWarnings > activeWarnings.length && (
            <span className="chip text-text-tertiary flex-shrink-0">
              +{totalWarnings - activeWarnings.length} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
