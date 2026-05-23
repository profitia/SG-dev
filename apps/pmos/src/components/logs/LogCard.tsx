'use client'

import { useState } from 'react'
import { ALIGNMENT_LABELS, ALIGNMENT_COLORS } from '@/lib/constants'

type Tag = { tag: { id: string; name: string } }
type NodeRef = { node: { id: string; title: string } }

interface Log {
  id: string
  title: string
  summary: string | null
  prompt: string | null
  changedFiles: string[]
  architecturalImpact: string | null
  blockers: string | null
  nextSteps: string | null
  canonicalAlignment: string
  createdAt: Date
  tags: Tag[]
  nodes: NodeRef[]
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

const ALIGNMENT_CHIP: Record<string, string> = {
  high:   'chip-done',
  medium: 'chip-warn',
  low:    'chip-blocked',
}

export function LogCard({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false)
  const alignmentLabel = ALIGNMENT_LABELS[log.canonicalAlignment] ?? log.canonicalAlignment
  const alignmentChip  = ALIGNMENT_CHIP[log.canonicalAlignment] ?? ''

  const hasDetail = !!(log.summary || log.prompt || log.changedFiles.length > 0 || log.architecturalImpact || log.nextSteps || log.blockers || log.nodes.length > 0)

  return (
    <div className="runtime-card">
      {/* ── TOP META ROW ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5 border-b border-bg-border">
        {/* timestamp */}
        <span className="font-mono text-3xs text-text-tertiary flex-shrink-0">
          {formatDate(log.createdAt)} {formatTime(log.createdAt)}
        </span>

        <span className="text-bg-border mx-1">·</span>

        {/* tags */}
        {log.tags.slice(0, 3).map(({ tag }) => (
          <span key={tag.id} className="chip">#{tag.name}</span>
        ))}
        {log.tags.length > 3 && (
          <span className="chip">+{log.tags.length - 3}</span>
        )}

        {/* alignment */}
        <span className={`chip ${alignmentChip} ml-auto`}>{alignmentLabel}</span>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* expand indicator */}
        {hasDetail && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`flex-shrink-0 mt-1 text-text-tertiary transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {!hasDetail && <span className="w-2.5 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-medium leading-snug">{log.title}</p>
          {!expanded && log.summary && (
            <p className="text-text-secondary text-2xs mt-1 line-clamp-2 leading-relaxed">{log.summary}</p>
          )}
        </div>

        {/* changed files count chip */}
        {log.changedFiles.length > 0 && (
          <span className="chip flex-shrink-0 self-start mt-0.5">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1.5 1.5h4l2 2v4h-6v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {log.changedFiles.length}
          </span>
        )}
      </button>

      {/* ── EXPANDED DETAIL ──────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-bg-border px-4 py-3 space-y-3">
          {log.summary && (
            <Detail label="Summary">
              <p className="prose-runtime">{log.summary}</p>
            </Detail>
          )}

          {log.changedFiles.length > 0 && (
            <Detail label={`Changed files (${log.changedFiles.length})`}>
              <div className="flex flex-wrap gap-1">
                {log.changedFiles.map((f) => (
                  <span key={f} className="chip chip-accent font-mono">{f.split('/').slice(-1)[0]}</span>
                ))}
              </div>
            </Detail>
          )}

          {log.architecturalImpact && (
            <Detail label="Architectural impact">
              <p className="prose-runtime">{log.architecturalImpact}</p>
            </Detail>
          )}

          {log.nextSteps && (
            <Detail label="Next steps">
              <p className="prose-runtime">{log.nextSteps}</p>
            </Detail>
          )}

          {log.blockers && (
            <Detail label="Blockers">
              <p className="text-warn-critical text-2xs leading-relaxed">{log.blockers}</p>
            </Detail>
          )}

          {log.prompt && (
            <Detail label="Prompt">
              <pre className="prose-runtime font-mono text-3xs whitespace-pre-wrap bg-bg-base border border-bg-border rounded p-2.5 leading-relaxed overflow-x-auto">
                {log.prompt}
              </pre>
            </Detail>
          )}

          {log.nodes.length > 0 && (
            <Detail label="Linked nodes">
              <div className="flex flex-wrap gap-1">
                {log.nodes.map(({ node }) => (
                  <span key={node.id} className="chip">{node.title.slice(0, 50)}</span>
                ))}
              </div>
            </Detail>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="section-label">{label}</p>
      {children}
    </div>
  )
}

