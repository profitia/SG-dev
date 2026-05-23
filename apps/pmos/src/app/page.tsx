import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ITEM_DOT: Record<string, string> = {
  prompt:   'bg-accent/70',
  log:      'bg-blue-500/70',
  decision: 'bg-purple-500/70',
  warning:  'bg-orange-400/70',
}

const ITEM_LABEL: Record<string, string> = {
  prompt:   'prompt',
  log:      'log',
  decision: 'decision',
  warning:  'warn',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-500',
  low:      'bg-neutral-600',
}

function RelTime({ date }: { date: Date }) {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return <span>just now</span>
  if (hours < 1) return <span>{mins}m</span>
  if (days < 1) return <span>{hours}h</span>
  if (days < 7) return <span>{days}d</span>
  return <span>{new Date(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
}

export default async function DashboardPage() {
  const [
    promptCount, logCount, warningCount, nodeCount, principleCount,
    recentPrompts, recentLogs, recentWarnings, recentDecisions,
    activeWarnings, doneNodes, totalNodes,
  ] = await Promise.all([
    db.promptExecution.count({ where: { status: 'completed' } }),
    db.executionLog.count(),
    db.architectureWarning.count({ where: { resolved: false } }),
    db.roadmapNode.count(),
    db.canonicalPrinciple.count(),
    db.promptExecution.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, status: true, etap: true, createdAt: true } }),
    db.executionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, title: true, createdAt: true } }),
    db.architectureWarning.findMany({ where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, title: true, severity: true, createdAt: true } }),
    db.decision.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, title: true, createdAt: true } }),
    db.architectureWarning.count({ where: { resolved: false } }),
    db.roadmapNode.count({ where: { status: 'done' } }),
    db.roadmapNode.count(),
  ])

  type ActivityItem =
    | { kind: 'prompt'; id: string; title: string; status: string; etap: string | null; date: Date }
    | { kind: 'log'; id: string; title: string; date: Date }
    | { kind: 'warning'; id: string; title: string; severity: string; date: Date }
    | { kind: 'decision'; id: string; title: string; date: Date }

  const activity: ActivityItem[] = [
    ...recentPrompts.map((p) => ({ kind: 'prompt' as const, id: p.id, title: p.title, status: p.status, etap: p.etap, date: p.createdAt })),
    ...recentLogs.map((l) => ({ kind: 'log' as const, id: l.id, title: l.title, date: l.createdAt })),
    ...recentWarnings.map((w) => ({ kind: 'warning' as const, id: w.id, title: w.title, severity: w.severity, date: w.createdAt })),
    ...recentDecisions.map((d) => ({ kind: 'decision' as const, id: d.id, title: d.title, date: d.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  const completionPct = totalNodes > 0 ? Math.round((doneNodes / totalNodes) * 100) : 0

  return (
    <div className="px-6 py-5 max-w-2xl">
      {/* Quick action */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-text-tertiary text-2xs font-mono tracking-wide">
          {new Date().toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <Link
          href="/prompts/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-2xs font-medium rounded hover:bg-accent-hover transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Log execution
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {([
          { label: 'Nodes',       value: `${doneNodes}/${totalNodes}`, sub: `${completionPct}% done`,      href: '/roadmap',   urgent: false },
          { label: 'Warnings',    value: activeWarnings,                sub: 'active',                     href: '/warnings',  urgent: warningCount > 0 },
          { label: 'Prompts',     value: promptCount,                   sub: 'completed',                  href: '/prompts',   urgent: false },
          { label: 'Principles',  value: principleCount,                sub: 'canonical',                  href: '/principles', urgent: false },
          { label: 'Logs',        value: logCount,                      sub: 'total',                      href: '/logs',      urgent: false },
        ] as const).map(({ label, value, sub, href, urgent }) => (
          <Link
            key={label}
            href={href}
            className="bg-bg-surface border border-bg-border rounded-md px-3 py-2.5 hover:border-bg-hover transition-colors group"
          >
            <div className="text-text-tertiary text-3xs mb-1.5 font-medium uppercase tracking-wider">{label}</div>
            <div className={`text-lg font-semibold leading-tight ${urgent && Number(value) > 0 ? 'text-warn-high' : 'text-text-primary'} group-hover:text-accent transition-colors`}>
              {value}
            </div>
            <div className="text-text-muted text-3xs mt-0.5">{sub}</div>
          </Link>
        ))}
      </div>

      {/* Activity stream */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="section-label">Runtime stream</h2>
          <Link href="/timeline" className="text-2xs text-text-tertiary hover:text-accent transition-colors">
            full timeline →
          </Link>
        </div>

        <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
          {activity.map((item, i) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={`flex items-start gap-3 px-4 py-2.5 group ${i < activity.length - 1 ? 'border-b border-bg-border' : ''}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                item.kind === 'warning'
                  ? SEVERITY_DOT[item.severity] ?? 'bg-orange-400'
                  : ITEM_DOT[item.kind]
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-3xs text-text-tertiary flex-shrink-0">{ITEM_LABEL[item.kind]}</span>
                    <Link
                      href={item.kind === 'prompt' ? '/prompts' : item.kind === 'log' ? '/logs' : item.kind === 'warning' ? '/warnings' : '/decisions'}
                      className="text-text-primary text-2xs truncate hover:text-accent transition-colors"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <time className="text-3xs text-text-tertiary flex-shrink-0 font-mono">
                    <RelTime date={item.date} />
                  </time>
                </div>
                {item.kind === 'prompt' && item.etap && (
                  <span className="text-3xs text-text-tertiary font-mono">ETAP {item.etap}</span>
                )}
              </div>
            </div>
          ))}

          {activity.length === 0 && (
            <div className="px-4 py-8 text-center text-text-tertiary text-2xs">
              No activity yet.{' '}
              <Link href="/prompts/new" className="text-accent hover:underline">Log first execution.</Link>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard reference */}
      <div className="border-t border-bg-border pt-4">
        <h2 className="section-label mb-2.5">Shortcuts</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {[
            ['/', 'search'],
            ['n', 'new log'],
            ['r', 'roadmap'],
            ['t', 'timeline'],
            ['p', 'prompts'],
            ['d', 'decisions'],
            ['w', 'warnings'],
            ['⌘K', 'search'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-3xs text-text-tertiary">
              <kbd className="border border-bg-border rounded px-1 py-0.5 font-mono text-text-secondary">{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

