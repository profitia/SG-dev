'use client'

import Link from 'next/link'

const IMPORTANCE_COLORS: Record<string, string> = {
  foundational: 'text-accent border-accent/30 bg-accent/5',
  high: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
  medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
  low: 'text-text-tertiary border-bg-border bg-transparent',
}

const IMPORTANCE_DOT: Record<string, string> = {
  foundational: 'bg-accent',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-text-muted',
}

const TYPE_LABEL: Record<string, string> = {
  implementation: 'impl',
  architecture: 'arch',
  debugging: 'debug',
  philosophy: 'phil',
  runtime_analysis: 'runtime',
  orchestration: 'orch',
  ux: 'ux',
  continuity: 'cont',
  governance: 'gov',
  infrastructure: 'infra',
}

type ConversationItem = {
  id: string
  conversationId: string
  timestamp: Date
  summary: string
  conversationType: string
  importanceLevel: string
  etap: string | null
  subetap: string | null
  taskId: string | null
  chronologyOrder: number
  domains: string[]
  tags: string[]
  linkedDecisions: { decision: { id: string; title: string; number: number } }[]
  linkedWarnings: { warning: { id: string; title: string; severity: string } }[]
  linkedNodes: { node: { id: string; title: string } }[]
  linkedPrinciples: { principle: { id: string; title: string } }[]
}

export function ConversationList({ conversations }: { conversations: ConversationItem[] }) {
  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <ConversationCard key={conv.id} conversation={conv} />
      ))}
    </div>
  )
}

function ConversationCard({ conversation: c }: { conversation: ConversationItem }) {
  const linkCount =
    c.linkedDecisions.length +
    c.linkedWarnings.length +
    c.linkedNodes.length +
    c.linkedPrinciples.length

  const date = new Date(c.timestamp)
  const dateStr = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      href={`/conversations/${c.id}`}
      className="block group"
    >
      <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors">
        {/* Importance dot + chronology */}
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0 w-8">
          <div className={`w-2 h-2 rounded-full ${IMPORTANCE_DOT[c.importanceLevel] ?? 'bg-text-muted'}`} />
          <span className="text-3xs text-text-muted font-mono">#{c.chronologyOrder}</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {/* Importance badge */}
            <span className={`text-2xs font-medium px-1.5 py-0.5 rounded border ${IMPORTANCE_COLORS[c.importanceLevel] ?? IMPORTANCE_COLORS.medium}`}>
              {c.importanceLevel}
            </span>
            {/* Type */}
            <span className="text-2xs text-text-tertiary">
              {TYPE_LABEL[c.conversationType] ?? c.conversationType}
            </span>
            {/* ETAP */}
            {c.etap && (
              <span className="text-2xs text-text-muted font-mono">{c.etap}{c.subetap ? ` / ${c.subetap}` : ''}</span>
            )}
          </div>

          {/* Summary */}
          <p className="text-sm text-text-primary group-hover:text-accent transition-colors leading-snug line-clamp-2">
            {c.summary}
          </p>

          {/* Domains */}
          {c.domains.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {c.domains.map((d) => (
                <span key={d} className="text-2xs text-text-muted bg-bg-elevated border border-bg-border rounded px-1.5 py-0.5">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Linked entities */}
          {linkCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {c.linkedDecisions.slice(0, 2).map((l) => (
                <span key={l.decision.id} className="text-2xs text-purple-400 bg-purple-400/5 border border-purple-400/20 rounded px-1.5 py-0.5">
                  ADR-{String(l.decision.number).padStart(3, '0')}
                </span>
              ))}
              {c.linkedWarnings.slice(0, 2).map((l) => (
                <span key={l.warning.id} className="text-2xs text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded px-1.5 py-0.5">
                  ⚠ {l.warning.title.slice(0, 24)}
                </span>
              ))}
              {c.linkedNodes.slice(0, 1).map((l) => (
                <span key={l.node.id} className="text-2xs text-blue-400 bg-blue-400/5 border border-blue-400/20 rounded px-1.5 py-0.5">
                  ↗ {l.node.title.slice(0, 20)}
                </span>
              ))}
              {linkCount > 3 && (
                <span className="text-2xs text-text-muted">+{linkCount - 3} more</span>
              )}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="text-right flex-shrink-0 pl-2">
          <p className="text-2xs text-text-tertiary">{dateStr}</p>
          <p className="text-2xs text-text-muted">{timeStr}</p>
        </div>
      </div>
    </Link>
  )
}
