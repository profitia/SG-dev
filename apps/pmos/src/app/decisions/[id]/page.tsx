import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const IMPORTANCE_DOT: Record<string, string> = {
  foundational: 'bg-accent',
  high:         'bg-orange-400',
  medium:       'bg-yellow-500',
  low:          'bg-neutral-500',
}

const TYPE_COLOR: Record<string, string> = {
  architecture:    'text-purple-400',
  implementation:  'text-blue-400',
  debugging:       'text-red-400',
  philosophy:      'text-emerald-400',
  runtime_analysis:'text-cyan-400',
  orchestration:   'text-orange-400',
  ux:              'text-pink-400',
  continuity:      'text-yellow-400',
  governance:      'text-indigo-400',
  infrastructure:  'text-teal-400',
}

const IMPORTANCE_COLOR: Record<string, string> = {
  foundational: 'text-accent',
  high:         'text-orange-400',
  medium:       'text-yellow-400',
  low:          'text-text-tertiary',
}

export default async function DecisionDetailPage({ params }: { params: { id: string } }) {
  const decision = await db.decision.findUnique({
    where: { id: params.id },
    include: {
      nodes: {
        include: { node: { select: { id: true, title: true, status: true } } },
      },
      conversations: {
        include: {
          conversation: {
            select: {
              id: true,
              summary: true,
              conversationType: true,
              importanceLevel: true,
              timestamp: true,
              etap: true,
              domains: true,
            },
          },
        },
        orderBy: { conversation: { timestamp: 'desc' } },
      },
    },
  })

  if (!decision) notFound()

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/decisions"
            className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="text-text-muted text-xs font-mono flex-shrink-0">
            ADR-{String(decision.number).padStart(3, '0')}
          </span>
          <span className="text-text-border flex-shrink-0">·</span>
          <h1 className="text-text-primary text-sm font-semibold truncate">{decision.title}</h1>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-6">

        {/* Core Decision */}
        <section className="bg-bg-surface border border-bg-border rounded-lg divide-y divide-bg-border">
          <div className="p-5">
            <p className="text-2xs text-text-muted uppercase tracking-widest mb-2">Decision</p>
            <p className="text-text-primary text-sm leading-relaxed">{decision.decision}</p>
          </div>
          {decision.reason && (
            <div className="p-5">
              <p className="text-2xs text-text-muted uppercase tracking-widest mb-2">Reason</p>
              <p className="text-text-secondary text-sm leading-relaxed">{decision.reason}</p>
            </div>
          )}
          {decision.impact && (
            <div className="p-5">
              <p className="text-2xs text-text-muted uppercase tracking-widest mb-2">Impact</p>
              <p className="text-text-secondary text-sm leading-relaxed">{decision.impact}</p>
            </div>
          )}
          {decision.affectedSystems.length > 0 && (
            <div className="p-5">
              <p className="text-2xs text-text-muted uppercase tracking-widest mb-3">Affected Systems</p>
              <div className="flex flex-wrap gap-1.5">
                {decision.affectedSystems.map((s) => (
                  <span key={s} className="text-xs text-accent/80 bg-accent/5 border border-accent/10 px-2 py-0.5 rounded font-mono">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 py-3">
            <p className="text-text-muted text-2xs font-mono">
              {new Date(decision.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </section>

        {/* Linked Roadmap Nodes */}
        {decision.nodes.length > 0 && (
          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Linked Roadmap Nodes</p>
            <div className="flex flex-wrap gap-2">
              {decision.nodes.map(({ node }) => (
                <Link
                  key={node.id}
                  href="/roadmap"
                  className="flex items-center gap-2 text-xs text-text-secondary bg-bg-surface border border-bg-border px-3 py-1.5 rounded-md hover:border-bg-hover hover:text-text-primary transition-colors"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      node.status === 'done' ? 'bg-green-500' : node.status === 'in_progress' ? 'bg-accent' : 'bg-text-muted'
                    }`}
                  />
                  {node.title}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Reasoning Lineage */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-cyan-400/60">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Reasoning Lineage</p>
            </div>
            <span className="text-2xs text-text-muted bg-bg-surface border border-bg-border rounded-full px-2 py-0.5">
              {decision.conversations.length} conversation{decision.conversations.length !== 1 ? 's' : ''}
            </span>
          </div>

          {decision.conversations.length === 0 ? (
            <div className="border border-dashed border-bg-border rounded-lg px-5 py-10 text-center">
              <p className="text-text-tertiary text-sm mb-1">No reasoning history linked to this decision.</p>
              <p className="text-text-muted text-xs">
                Use the <code className="font-mono bg-bg-elevated px-1 rounded">memory</code> keyword to persist a conversation and link it here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {decision.conversations.map(({ conversation }, idx) => (
                <Link
                  key={conversation.id}
                  href={`/conversations/${conversation.id}`}
                  className="flex items-start gap-3 p-4 rounded-lg bg-bg-surface border border-bg-border hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-colors group"
                >
                  <span className="text-2xs text-text-muted font-mono flex-shrink-0 w-5 text-right mt-0.5">{idx + 1}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary group-hover:text-cyan-400 transition-colors leading-snug line-clamp-2 mb-1.5">
                      {conversation.summary}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-2xs ${TYPE_COLOR[conversation.conversationType] ?? 'text-text-secondary'}`}>
                        {conversation.conversationType.replace('_', ' ')}
                      </span>
                      <span className="text-text-muted text-2xs">·</span>
                      <span className={`text-2xs flex items-center gap-1 ${IMPORTANCE_COLOR[conversation.importanceLevel] ?? 'text-text-tertiary'}`}>
                        <span className={`w-1 h-1 rounded-full ${IMPORTANCE_DOT[conversation.importanceLevel] ?? 'bg-neutral-500'}`} />
                        {conversation.importanceLevel}
                      </span>
                      {conversation.etap && (
                        <>
                          <span className="text-text-muted text-2xs">·</span>
                          <span className="text-2xs text-text-tertiary font-mono">ETAP {conversation.etap}</span>
                        </>
                      )}
                      <span className="text-text-muted text-2xs">·</span>
                      <span className="text-2xs text-text-muted">
                        {new Date(conversation.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {conversation.domains.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {conversation.domains.slice(0, 4).map((d) => (
                          <span key={d} className="text-2xs text-accent/60 bg-accent/5 border border-accent/10 px-1.5 py-0.5 rounded">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-1 text-text-muted group-hover:text-cyan-400 transition-colors">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Footer meta */}
        <div className="pb-8 flex items-center gap-4">
          <Link href="/decisions" className="text-2xs text-text-muted hover:text-text-secondary transition-colors">
            ← All Decisions
          </Link>
          <Link href={`/timeline?type=decision`} className="text-2xs text-text-muted hover:text-text-secondary transition-colors">
            View in Timeline
          </Link>
        </div>
      </div>
    </div>
  )
}
