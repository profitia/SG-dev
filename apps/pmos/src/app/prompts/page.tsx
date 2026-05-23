import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  completed: { dot: 'bg-green-500', label: 'completed', text: 'text-green-400' },
  running: { dot: 'bg-blue-500 animate-pulse', label: 'running', text: 'text-blue-400' },
  queued: { dot: 'bg-yellow-500', label: 'queued', text: 'text-yellow-400' },
  failed: { dot: 'bg-red-500', label: 'failed', text: 'text-red-400' },
  archived: { dot: 'bg-neutral-600', label: 'archived', text: 'text-neutral-500' },
} as const

function PmosHeaderBadge({ etap, subetap, node, domain, promptType }: {
  etap?: string | null
  subetap?: string | null
  node?: string | null
  domain?: string | null
  promptType?: string | null
}) {
  if (!etap && !node) return null
  return (
    <div className="font-mono text-2xs text-text-tertiary bg-bg-surface border border-bg-border rounded px-3 py-2 mb-3 space-y-0.5">
      {etap && <div><span className="text-accent/60">ETAP</span> {etap}{subetap ? `.${subetap.replace(`${etap}.`, '')}` : ''}</div>}
      {node && <div><span className="text-accent/60">NODE</span> {node}</div>}
      {domain && <div><span className="text-accent/60">DOMAIN</span> {domain}</div>}
      {promptType && <div><span className="text-accent/60">TYPE</span> {promptType}</div>}
    </div>
  )
}

export default async function PromptsPage() {
  const prompts = await db.promptExecution.findMany({
    include: {
      roadmapNode: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const byStatus = {
    completed: prompts.filter((p) => p.status === 'completed').length,
    running: prompts.filter((p) => p.status === 'running').length,
    queued: prompts.filter((p) => p.status === 'queued').length,
    failed: prompts.filter((p) => p.status === 'failed').length,
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-text-primary text-xl font-semibold mb-1">Prompt Executions</h1>
          <p className="text-text-tertiary text-sm">
            Canonical execution memory — every implementation prompt linked to roadmap
          </p>
        </div>
        <Link
          href="/prompts/new"
          className="flex items-center gap-2 px-3 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent/90 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Log execution
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {([
          ['completed', byStatus.completed, 'text-green-400'],
          ['running', byStatus.running, 'text-blue-400'],
          ['queued', byStatus.queued, 'text-yellow-400'],
          ['failed', byStatus.failed, 'text-red-400'],
        ] as const).map(([label, count, color]) => (
          <div key={label} className="bg-bg-surface border border-bg-border rounded-lg px-4 py-3">
            <div className={`text-xs ${color} mb-1`}>{label}</div>
            <div className="text-text-primary text-xl font-semibold">{count}</div>
          </div>
        ))}
      </div>

      {/* PMOS Standard Box */}
      <div className="bg-bg-surface border border-bg-border rounded-lg p-4 mb-8">
        <p className="text-text-tertiary text-xs font-mono mb-2 text-accent/70"># PMOS EXECUTION STANDARD</p>
        <pre className="text-text-secondary text-xs font-mono leading-relaxed whitespace-pre">{`[PMOS]
ETAP: <number>
SUBETAP: <number.number>
NODE: <roadmap node name>
DOMAIN: <domain1,domain2>
TYPE: implementation | refactor | analysis | fix`}</pre>
        <p className="text-text-tertiary text-2xs mt-2">Every implementation prompt must carry this header for execution tracking and roadmap continuity.</p>
      </div>

      {/* Timeline */}
      {prompts.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          No prompt executions yet. Log the first one.
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => {
            const cfg = STATUS_CONFIG[prompt.status]
            return (
              <div key={prompt.id} className="bg-bg-surface border border-bg-border rounded-lg p-5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${cfg.dot}`} />
                    <h3 className="text-text-primary text-sm font-medium">{prompt.title}</h3>
                  </div>
                  <span className={`text-2xs flex-shrink-0 ${cfg.text}`}>{cfg.label}</span>
                </div>

                {/* PMOS header */}
                <div className="pl-4.5">
                  <PmosHeaderBadge
                    etap={prompt.etap}
                    subetap={prompt.subetap}
                    node={prompt.node}
                    domain={prompt.domain}
                    promptType={prompt.promptType}
                  />

                  {/* Summary */}
                  {prompt.executionSummary && (
                    <p className="text-text-secondary text-sm leading-relaxed mb-3">{prompt.executionSummary}</p>
                  )}

                  {/* Architectural impact */}
                  {prompt.architecturalImpact && (
                    <div className="mb-3">
                      <span className="text-2xs text-text-tertiary uppercase tracking-wide">Architectural impact</span>
                      <p className="text-text-secondary text-sm mt-0.5">{prompt.architecturalImpact}</p>
                    </div>
                  )}

                  {/* Changed files */}
                  {prompt.changedFiles.length > 0 && (
                    <div className="mb-3">
                      <span className="text-2xs text-text-tertiary uppercase tracking-wide">Changed files</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {prompt.changedFiles.map((f) => (
                          <span key={f} className="font-mono text-2xs text-text-tertiary bg-bg-elevated px-2 py-0.5 rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next steps */}
                  {prompt.nextSteps && (
                    <div className="mb-3">
                      <span className="text-2xs text-text-tertiary uppercase tracking-wide">Next steps</span>
                      <p className="text-text-secondary text-sm mt-0.5">{prompt.nextSteps}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-4 pt-1">
                    {prompt.roadmapNode && (
                      <span className="text-2xs text-text-tertiary">
                        → {prompt.roadmapNode.title}
                      </span>
                    )}
                    <span className="text-2xs text-text-tertiary ml-auto">
                      {new Date(prompt.createdAt).toLocaleDateString('pl-PL', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
