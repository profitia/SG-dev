'use client'

import { useState } from 'react'
import Link from 'next/link'

type NodeRef = { node: { id: string; title: string } }
type ConvRef = { conversation: { id: string; summary: string; conversationType: string; importanceLevel: string; timestamp: Date } }

interface Decision {
  id: string
  number: number
  title: string
  decision: string
  reason: string | null
  impact: string | null
  affectedSystems: string[]
  createdAt: Date
  nodes: NodeRef[]
  conversations?: ConvRef[]
}

interface DecisionListProps {
  decisions: Decision[]
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function DecisionCard({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-bg-border rounded-lg bg-bg-surface hover:border-bg-border/80 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left"
      >
        {/* Number */}
        <div className="flex-shrink-0 w-12 pt-0.5">
          <span className="text-text-tertiary text-xs font-mono">#{decision.number}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <span className="text-text-primary text-sm font-medium leading-snug flex-1">
              {decision.title}
            </span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-text-tertiary text-xs">{formatDate(decision.createdAt)}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          {!expanded && (
            <p className="text-text-secondary text-xs mt-1 line-clamp-1 leading-relaxed">
              {decision.decision}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-bg-border px-5 py-4 space-y-4">
          <Section label="Decision">
            <p className="text-text-primary text-sm leading-relaxed">{decision.decision}</p>
          </Section>

          {decision.reason && (
            <Section label="Reason">
              <p className="text-text-secondary text-sm leading-relaxed">{decision.reason}</p>
            </Section>
          )}

          {decision.impact && (
            <Section label="Impact">
              <p className="text-text-secondary text-sm leading-relaxed">{decision.impact}</p>
            </Section>
          )}

          {decision.affectedSystems.length > 0 && (
            <Section label="Affected Systems">
              <div className="flex flex-wrap gap-1.5">
                {decision.affectedSystems.map((s) => (
                  <span
                    key={s}
                    className="text-2xs text-accent/80 bg-accent/5 border border-accent/10 px-2 py-0.5 rounded font-mono"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {decision.nodes.length > 0 && (
            <Section label="Linked Roadmap Nodes">
              <div className="flex flex-wrap gap-2">
                {decision.nodes.map(({ node }) => (
                  <span
                    key={node.id}
                    className="text-xs text-text-secondary bg-bg-elevated border border-bg-border px-2 py-0.5 rounded"
                  >
                    {node.title.slice(0, 50)}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <div className="pt-2 flex items-center gap-4">
            <Link
              href={`/decisions/${decision.id}`}
              className="text-2xs text-text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              View reasoning lineage
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {decision.conversations && decision.conversations.length > 0 && (
            <Section label="Related Conversations">
              <div className="space-y-1.5">
                {decision.conversations.map(({ conversation }) => (
                  <Link
                    key={conversation.id}
                    href={`/conversations/${conversation.id}`}
                    className="flex items-start gap-2 p-2 rounded hover:bg-bg-elevated transition-colors group"
                  >
                    <span className="w-1 h-1 rounded-full bg-cyan-400/70 mt-1.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-text-secondary group-hover:text-accent transition-colors line-clamp-1">
                        {conversation.summary}
                      </p>
                      <p className="text-2xs text-text-muted mt-0.5">
                        {conversation.conversationType.replace('_', ' ')} · {conversation.importanceLevel} · {new Date(conversation.timestamp).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-text-tertiary text-2xs uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  )
}

export function DecisionList({ decisions }: DecisionListProps) {
  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <DecisionCard key={d.id} decision={d} />
      ))}
    </div>
  )
}
