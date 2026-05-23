import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TYPE_DOT: Record<string, string> = {
  prompt:       'bg-accent/70',
  log:          'bg-blue-500/70',
  decision:     'bg-purple-500/70',
  warning:      'bg-orange-400/70',
  conversation: 'bg-cyan-500/70',
}

const TYPE_LABEL_SHORT: Record<string, string> = {
  prompt:       'prompt',
  log:          'log',
  decision:     'decision',
  warning:      'warn',
  conversation: 'memory',
}

const TYPE_LABEL_COLOR: Record<string, string> = {
  prompt:       'text-accent/60',
  log:          'text-blue-400/60',
  decision:     'text-purple-400/60',
  warning:      'text-orange-400/60',
  conversation: 'text-cyan-400/60',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-warn-critical',
  high:     'text-warn-high',
  medium:   'text-warn-medium',
  low:      'text-text-tertiary',
}

const IMPACT_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-500',
  low:      'bg-neutral-500',
}

const IMPORTANCE_DOT: Record<string, string> = {
  foundational: 'bg-accent',
  high:         'bg-orange-400',
  medium:       'bg-yellow-500',
  low:          'bg-neutral-500',
}

function DateStamp({ date }: { date: Date }) {
  return (
    <time className="text-text-tertiary text-3xs flex-shrink-0 font-mono tabular-nums">
      {new Date(date).toLocaleDateString('en', { day: '2-digit', month: 'short' })}
      {' · '}
      {new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </time>
  )
}

const ALL_TYPES = ['prompt', 'log', 'decision', 'warning', 'conversation'] as const
const TYPE_LABELS: Record<string, string> = {
  prompt: 'Prompts', log: 'Logs', decision: 'Decisions', warning: 'Warnings', conversation: 'Memory',
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { type?: string; etap?: string }
}) {
  const filterType = searchParams.type ?? 'all'
  const filterEtap = searchParams.etap ?? ''

  const wantType = (t: string) => filterType === 'all' || filterType === t

  const [prompts, logs, decisions, warnings, conversations] = await Promise.all([
    wantType('prompt')
      ? db.promptExecution.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          where: filterEtap ? { etap: { contains: filterEtap } } : undefined,
          include: {
            roadmapNode: { select: { title: true } },
            changedFileEntries: { select: { path: true, changeType: true, impactLevel: true } },
          },
        })
      : Promise.resolve([]),
    wantType('log')
      ? db.executionLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            nodes: { include: { node: { select: { title: true } } } },
            changedFileEntries: { select: { path: true, changeType: true, impactLevel: true } },
          },
        })
      : Promise.resolve([]),
    wantType('decision')
      ? db.decision.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
      : Promise.resolve([]),
    wantType('warning')
      ? db.architectureWarning.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
    wantType('conversation')
      ? db.conversationArtifact.findMany({
          orderBy: { timestamp: 'desc' },
          take: 40,
          where: filterEtap ? { etap: { contains: filterEtap } } : undefined,
          select: {
            id: true,
            summary: true,
            conversationType: true,
            importanceLevel: true,
            timestamp: true,
            etap: true,
            domains: true,
            taskId: true,
          },
        })
      : Promise.resolve([]),
  ])

  type TimelineItem =
    | { type: 'prompt';       date: Date; data: (typeof prompts)[0] }
    | { type: 'log';          date: Date; data: (typeof logs)[0] }
    | { type: 'decision';     date: Date; data: (typeof decisions)[0] }
    | { type: 'warning';      date: Date; data: (typeof warnings)[0] }
    | { type: 'conversation'; date: Date; data: (typeof conversations)[0] }

  const items: TimelineItem[] = [
    ...prompts.map((p) => ({ type: 'prompt'       as const, date: p.createdAt,  data: p })),
    ...logs.map((l)    => ({ type: 'log'          as const, date: l.createdAt,  data: l })),
    ...decisions.map((d) => ({ type: 'decision'   as const, date: d.createdAt,  data: d })),
    ...warnings.map((w) =>  ({ type: 'warning'    as const, date: w.createdAt,  data: w })),
    ...conversations.map((c) => ({ type: 'conversation' as const, date: c.timestamp, data: c })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const etapParam = filterEtap ? `&etap=${filterEtap}` : ''

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
        <div className="flex items-baseline gap-3">
          <h1 className="text-text-primary text-sm font-semibold">Timeline</h1>
          <span className="text-text-tertiary text-2xs font-mono">{items.length} events</span>
        </div>
        <Link
          href="/prompts/new"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-white text-2xs font-medium rounded hover:bg-accent-hover transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Log execution
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-bg-border bg-bg-base">
        <Link
          href={filterEtap ? `/timeline?etap=${filterEtap}` : '/timeline'}
          className={`px-2.5 py-1 rounded text-2xs font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-accent/15 text-accent'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated'
          }`}
        >
          All
        </Link>
        {ALL_TYPES.map((t) => (
          <Link
            key={t}
            href={`/timeline?type=${t}${etapParam}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition-colors ${
              filterType === t
                ? 'bg-accent/15 text-accent'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[t]}`} />
            {TYPE_LABELS[t]}
          </Link>
        ))}
      </div>

      {/* Timeline feed */}
      <div className="px-6 py-4 max-w-2xl">
        {items.length === 0 ? (
          <div className="text-center py-16 text-text-tertiary text-sm">
            No events yet. Start by logging an execution.
          </div>
        ) : (
          <div>
            {items.map((item, idx) => {
              const thisDate = new Date(item.date).toDateString()
              const prevDate = idx > 0 ? new Date(items[idx - 1].date).toDateString() : null
              const showDateSeparator = thisDate !== prevDate

              return (
                <div key={`${item.type}-${item.date.toISOString()}-${idx}`}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 py-3 my-1">
                      <div className="flex-1 h-px bg-bg-border" />
                      <span className="text-3xs text-text-tertiary font-mono">
                        {new Date(item.date).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <div className="flex-1 h-px bg-bg-border" />
                    </div>
                  )}

                  <div className="flex gap-3 py-2 group">
                    <div className="flex flex-col items-center flex-shrink-0 w-4">
                      <div className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${TYPE_DOT[item.type]}`} />
                      {idx < items.length - 1 && (
                        <div className="w-px flex-1 bg-bg-border mt-1 min-h-[12px]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pb-1">
                      {item.type === 'prompt' && (() => {
                        const p = item.data as (typeof prompts)[0]
                        return (
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={`font-mono text-3xs flex-shrink-0 ${TYPE_LABEL_COLOR['prompt']}`}>{TYPE_LABEL_SHORT['prompt']}</span>
                                <span className="text-text-primary text-2xs font-medium truncate">{p.title}</span>
                              </div>
                              <DateStamp date={p.createdAt} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.etap && <span className="chip">ETAP {p.etap}{p.subetap ? `.${p.subetap.replace(`${p.etap}.`, '')}` : ''}</span>}
                              {p.node && <span className="chip">{p.node}</span>}
                              <span className={`chip ${p.status === 'completed' ? 'chip-done' : p.status === 'failed' ? 'chip-blocked' : ''}`}>{p.status}</span>
                              {p.changedFileEntries.slice(0, 3).map((f, i) => (
                                <span key={i} className="chip font-mono flex items-center gap-1">
                                  <span className={`w-1 h-1 rounded-full ${IMPACT_DOT[f.impactLevel]}`} />
                                  {f.path.split('/').slice(-1)[0]}
                                </span>
                              ))}
                              {p.changedFileEntries.length > 3 && <span className="chip">+{p.changedFileEntries.length - 3}</span>}
                            </div>
                            {p.executionSummary && (
                              <p className="text-text-tertiary text-3xs mt-1.5 leading-relaxed line-clamp-2">{p.executionSummary}</p>
                            )}
                          </div>
                        )
                      })()}

                      {item.type === 'log' && (() => {
                        const l = item.data as (typeof logs)[0]
                        return (
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={`font-mono text-3xs flex-shrink-0 ${TYPE_LABEL_COLOR['log']}`}>{TYPE_LABEL_SHORT['log']}</span>
                                <span className="text-text-primary text-2xs font-medium truncate">{l.title}</span>
                              </div>
                              <DateStamp date={l.createdAt} />
                            </div>
                            {l.nodes.length > 0 && <span className="chip">→ {l.nodes[0].node.title}</span>}
                            {l.summary && <p className="text-text-tertiary text-3xs mt-1 leading-relaxed line-clamp-2">{l.summary}</p>}
                          </div>
                        )
                      })()}

                      {item.type === 'decision' && (() => {
                        const d = item.data as (typeof decisions)[0]
                        return (
                          <Link href={`/decisions/${d.id}`} className="block group/inner">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={`font-mono text-3xs flex-shrink-0 ${TYPE_LABEL_COLOR['decision']}`}>{TYPE_LABEL_SHORT['decision']}</span>
                                <span className="text-text-primary text-2xs font-medium truncate group-hover/inner:text-accent transition-colors">
                                  ADR-{String(d.number).padStart(3, '0')} {d.title}
                                </span>
                              </div>
                              <DateStamp date={d.createdAt} />
                            </div>
                            <p className="text-text-tertiary text-3xs leading-relaxed line-clamp-2">{d.decision}</p>
                          </Link>
                        )
                      })()}

                      {item.type === 'warning' && (() => {
                        const w = item.data as (typeof warnings)[0]
                        return (
                          <Link href={`/warnings/${w.id}`} className="block group/inner">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={`font-mono text-3xs flex-shrink-0 ${TYPE_LABEL_COLOR['warning']}`}>{TYPE_LABEL_SHORT['warning']}</span>
                                <span className={`text-2xs font-medium truncate group-hover/inner:text-orange-300 transition-colors ${SEVERITY_COLOR[w.severity]}`}>{w.title}</span>
                              </div>
                              <DateStamp date={w.createdAt} />
                            </div>
                            <span className={`chip ${w.severity === 'critical' ? 'chip-blocked' : w.severity === 'high' ? 'chip-warn' : ''}`}>{w.severity}</span>
                          </Link>
                        )
                      })()}

                      {item.type === 'conversation' && (() => {
                        const c = item.data as (typeof conversations)[0]
                        return (
                          <Link href={`/conversations/${c.id}`} className="block group/inner">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={`font-mono text-3xs flex-shrink-0 ${TYPE_LABEL_COLOR['conversation']}`}>{TYPE_LABEL_SHORT['conversation']}</span>
                                <span className="text-text-primary text-2xs font-medium truncate group-hover/inner:text-cyan-400 transition-colors">{c.summary}</span>
                              </div>
                              <DateStamp date={c.timestamp} />
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.etap && <span className="chip font-mono">ETAP {c.etap}</span>}
                              <span className="chip">{c.conversationType.replace('_', ' ')}</span>
                              <span className="chip flex items-center gap-1">
                                <span className={`w-1 h-1 rounded-full ${IMPORTANCE_DOT[c.importanceLevel] ?? 'bg-neutral-500'}`} />
                                {c.importanceLevel}
                              </span>
                              {c.domains.slice(0, 2).map((d) => (
                                <span key={d} className="chip">{d}</span>
                              ))}
                            </div>
                          </Link>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
