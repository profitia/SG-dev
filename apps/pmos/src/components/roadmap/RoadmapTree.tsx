'use client'

import { useState } from 'react'
import { RoadmapNode } from '@/components/roadmap/RoadmapNode'
import { STATUS_DOT } from '@/lib/constants'

type Tag = { tag: { id: string; name: string } }
type Count = { logs: number; decisions: number }

type NodeWithChildren = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  order: number
  sortKey: string
  scope: string
  tags: Tag[]
  _count: Count
  children: NodeWithChildren[]
}

interface RoadmapTreeProps {
  node: NodeWithChildren
  depth: number
}

export function RoadmapTree({ node, depth }: RoadmapTreeProps) {
  const defaultExpanded = depth > 0
    ? true
    : node.status === 'in_progress' || node.status === 'blocked'

  const [expanded, setExpanded] = useState(defaultExpanded)

  const hasChildren = node.children.length > 0
  const isDone = node.status === 'done'
  const isStrategic = node.scope === 'strategic_backlog'

  return (
    <div className={`${depth === 0 ? 'mb-0.5' : ''}`}>
      {/* Node row */}
      <div
        className={`
          group relative flex items-center gap-0 rounded transition-colors
          hover:bg-bg-elevated
          ${isDone && depth === 0 ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {/* Hierarchy line — shown for children */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 flex items-center"
            style={{ left: `${(depth - 1) * 16 + 8}px` }}
          >
            <div className="w-px h-full bg-bg-border" />
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`
            relative z-10 flex-shrink-0 w-5 h-7 flex items-center justify-center
            text-text-tertiary hover:text-text-secondary transition-colors
            ${!hasChildren ? 'opacity-0 pointer-events-none' : ''}
          `}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className={`transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M2.5 1.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Status dot */}
        <div className="flex-shrink-0 w-3.5 h-7 flex items-center justify-center">
          <span className={`rounded-full ${
            depth === 0 ? 'w-2 h-2' : 'w-1.5 h-1.5'
          } ${STATUS_DOT[node.status] ?? 'bg-text-tertiary'}`} />
        </div>

        {/* Content */}
        <RoadmapNode node={node} depth={depth} />

        {/* Strategic badge */}
        {isStrategic && depth === 0 && (
          <span className="chip flex-shrink-0 self-center mr-2">strategic</span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          {[...node.children]
            .sort((a, b) => a.order - b.order)
            .map((child) => (
              <RoadmapTree key={child.id} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  )
}

