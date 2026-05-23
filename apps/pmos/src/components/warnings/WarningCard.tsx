'use client'

import Link from 'next/link'
import { resolveArchitectureWarning } from '@/lib/actions/warnings'

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500', label: 'Critical' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-400', label: 'High' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400', label: 'Medium' },
  low: { color: 'text-neutral-400', bg: 'bg-neutral-500/10 border-neutral-500/20', dot: 'bg-neutral-500', label: 'Low' },
} as const

const TYPE_LABELS: Record<string, string> = {
  dashboard_gravity: 'Dashboard Gravity',
  runtime_boundary: 'Runtime Boundary',
  business_logic_leak: 'Business Logic Leak',
  orchestration_drift: 'Orchestration Drift',
  overengineering: 'Overengineering',
  prompt_coupling: 'Prompt Coupling',
  architecture_debt: 'Architecture Debt',
}

type ConvRef = { conversation: { id: string; summary: string; conversationType: string; importanceLevel: string; timestamp: Date } }

type Warning = {
  id: string
  title: string
  description: string
  severity: keyof typeof SEVERITY_CONFIG
  type: string
  affectedArea: string | null
  createdAt: Date
  relatedLog: { id: string; title: string } | null
  relatedRoadmapNode: { id: string; title: string } | null
  conversations?: ConvRef[]
}

export function WarningCard({ warning }: { warning: Warning }) {
  const sev = SEVERITY_CONFIG[warning.severity]

  return (
    <div className={`rounded-lg border p-5 ${sev.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${sev.dot}`} />
          <h3 className="text-text-primary text-sm font-medium leading-snug">{warning.title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-2xs font-medium uppercase tracking-wide ${sev.color}`}>{sev.label}</span>
          <span className="text-text-tertiary text-2xs">·</span>
          <span className="text-text-tertiary text-2xs">{TYPE_LABELS[warning.type] ?? warning.type}</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-text-secondary text-sm leading-relaxed mb-4 pl-4.5">{warning.description}</p>

      {/* Meta */}
      <div className="flex items-center justify-between pl-4.5">
        <div className="flex items-center gap-4 flex-wrap">
          {warning.affectedArea && (
            <span className="font-mono text-2xs text-text-tertiary bg-bg-surface px-2 py-0.5 rounded">
              {warning.affectedArea}
            </span>
          )}
          {warning.relatedRoadmapNode && (
            <span className="text-2xs text-text-tertiary">
              → {warning.relatedRoadmapNode.title}
            </span>
          )}
          {warning.relatedLog && (
            <span className="text-2xs text-text-tertiary">
              log: {warning.relatedLog.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-tertiary text-2xs">
            {new Date(warning.createdAt).toLocaleDateString('pl-PL')}
          </span>
          <Link
            href={`/warnings/${warning.id}`}
            className="text-2xs text-text-tertiary hover:text-accent transition-colors"
          >
            lineage
          </Link>
          <form action={resolveArchitectureWarning.bind(null, warning.id)}>
            <button
              type="submit"
              className="text-2xs text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2"
            >
              resolve
            </button>
          </form>
        </div>
      </div>

      {/* Related Conversations */}
      {warning.conversations && warning.conversations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-current/10 pl-4.5">
          <p className="text-2xs text-text-muted uppercase tracking-wider mb-2">Related Conversations</p>
          <div className="space-y-1">
            {warning.conversations.map(({ conversation }) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="flex items-center gap-1.5 text-2xs text-text-tertiary hover:text-accent transition-colors group"
              >
                <span className="w-1 h-1 rounded-full bg-cyan-400/60 flex-shrink-0" />
                <span className="line-clamp-1 group-hover:underline">{conversation.summary}</span>
                <span className="flex-shrink-0 text-text-muted">({new Date(conversation.timestamp).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })})</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
