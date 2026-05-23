import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const IMPORTANCE_COLORS: Record<string, string> = {
  foundational: 'text-accent bg-accent/10 border-accent/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-text-tertiary bg-bg-surface border-bg-border',
}

const TYPE_COLORS: Record<string, string> = {
  architecture: 'text-purple-400',
  implementation: 'text-blue-400',
  debugging: 'text-red-400',
  philosophy: 'text-emerald-400',
  runtime_analysis: 'text-cyan-400',
  orchestration: 'text-orange-400',
  ux: 'text-pink-400',
  continuity: 'text-yellow-400',
  governance: 'text-indigo-400',
  infrastructure: 'text-teal-400',
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const artifact = await db.conversationArtifact.findUnique({
    where: { id: params.id },
    include: {
      linkedDecisions: { include: { decision: { select: { id: true, title: true, number: true } } } },
      linkedWarnings: { include: { warning: { select: { id: true, title: true, severity: true, resolved: true } } } },
      linkedNodes: { include: { node: { select: { id: true, title: true, status: true } } } },
      linkedLogs: { include: { log: { select: { id: true, title: true, createdAt: true } } } },
      linkedPrinciples: { include: { principle: { select: { id: true, title: true } } } },
      linkedPrompts: { include: { promptExecution: { select: { id: true, title: true, status: true, etap: true } } } },
    },
  })

  if (!artifact) notFound()

  const hasLinks =
    artifact.linkedDecisions.length > 0 ||
    artifact.linkedWarnings.length > 0 ||
    artifact.linkedNodes.length > 0 ||
    artifact.linkedLogs.length > 0 ||
    artifact.linkedPrinciples.length > 0 ||
    artifact.linkedPrompts.length > 0

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/conversations" className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${IMPORTANCE_COLORS[artifact.importanceLevel] ?? IMPORTANCE_COLORS.medium}`}>
                  {artifact.importanceLevel}
                </span>
                <span className={`text-xs font-medium ${TYPE_COLORS[artifact.conversationType] ?? 'text-text-secondary'}`}>
                  {artifact.conversationType.replace('_', ' ')}
                </span>
                {artifact.etap && (
                  <span className="text-xs text-text-tertiary font-mono">{artifact.etap}{artifact.subetap ? ` / ${artifact.subetap}` : ''}</span>
                )}
                <span className="text-text-muted text-xs">#{artifact.chronologyOrder}</span>
              </div>
              <p className="text-text-secondary text-xs mt-0.5">
                {new Date(artifact.timestamp).toLocaleString('pl-PL', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          {artifact.taskId && (
            <span className="text-xs font-mono text-text-tertiary border border-bg-border rounded px-2 py-0.5">
              {artifact.taskId}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-6">

        {/* Summary */}
        <section className="bg-bg-surface border border-bg-border rounded-lg p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Summary</p>
          <p className="text-text-primary text-sm leading-relaxed">{artifact.summary}</p>
        </section>

        {/* Domains + Tags */}
        {(artifact.domains.length > 0 || artifact.tags.length > 0) && (
          <section className="flex flex-wrap gap-3">
            {artifact.domains.map((d) => (
              <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                {d}
              </span>
            ))}
            {artifact.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-bg-surface text-text-secondary border border-bg-border">
                #{t}
              </span>
            ))}
          </section>
        )}

        {/* Linked Entities */}
        {hasLinks && (
          <section>
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Linked Entities</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artifact.linkedDecisions.map(({ decision }) => (
                <Link key={decision.id} href={`/decisions/${decision.id}`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">ADR-{String(decision.number).padStart(3, '0')}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{decision.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedWarnings.map(({ warning }) => (
                <Link key={warning.id} href={`/warnings/${warning.id}`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${warning.severity === 'critical' ? 'bg-red-500' : warning.severity === 'high' ? 'bg-orange-400' : 'bg-yellow-500'}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Warning · {warning.severity}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{warning.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedNodes.map(({ node }) => (
                <Link key={node.id} href={`/roadmap`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Roadmap · {node.status}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{node.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedPrinciples.map(({ principle }) => (
                <Link key={principle.id} href={`/principles`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Principle</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{principle.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedLogs.map(({ log }) => (
                <Link key={log.id} href={`/logs`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Execution Log</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{log.title}</p>
                  </div>
                </Link>
              ))}
              {artifact.linkedPrompts.map(({ promptExecution }) => (
                <Link key={promptExecution.id} href={`/prompts`} className="flex items-start gap-2 p-3 rounded-lg bg-bg-surface border border-bg-border hover:border-bg-hover transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/70 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Prompt · {promptExecution.status}</p>
                    <p className="text-xs text-text-primary group-hover:text-accent transition-colors truncate">{promptExecution.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* User Prompt */}
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">User Prompt</p>
          <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
            <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono break-words">
              {artifact.userPrompt}
            </pre>
          </div>
        </section>

        {/* LLM Response */}
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">LLM Response</p>
          <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
            <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words">
              {artifact.llmResponse}
            </div>
          </div>
        </section>

        {/* Conversation ID */}
        <section className="pb-8">
          <p className="text-xs text-text-muted font-mono">{artifact.conversationId}</p>
        </section>
      </div>
    </div>
  )
}
