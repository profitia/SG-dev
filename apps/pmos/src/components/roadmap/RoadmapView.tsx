'use client'

import { useState, useMemo } from 'react'
import { RoadmapTree } from '@/components/roadmap/RoadmapTree'

type Tag = { tag: { id: string; name: string } }
type Count = { logs: number; decisions: number }

export type NodeWithChildren = {
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

type Mode = 'active' | 'strategic' | 'all'
type StatusFilter = 'all' | 'in_progress' | 'backlog' | 'done' | 'blocked'

const STATUS_LABEL: Record<StatusFilter, string> = {
  all:         'All',
  in_progress: 'Active',
  backlog:     'Backlog',
  done:        'Done',
  blocked:     'Blocked',
}

export function RoadmapView({ nodes }: { nodes: NodeWithChildren[] }) {
  const [mode, setMode] = useState<Mode>('active')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of nodes) {
      for (const t of n.tags) set.add(t.tag.name)
    }
    return Array.from(set).sort()
  }, [nodes])

  const visible = useMemo(() => {
    return nodes
      .filter((n) => {
        if (mode === 'active' && n.scope !== 'active') return false
        if (mode === 'strategic' && n.scope !== 'strategic_backlog') return false
        if (statusFilter !== 'all' && n.status !== statusFilter) return false
        if (tagFilter !== 'all' && !n.tags.some((t) => t.tag.name === tagFilter)) return false
        return true
      })
      .sort((a, b) => {
        if (a.sortKey && b.sortKey) return a.sortKey.localeCompare(b.sortKey)
        return a.order - b.order
      })
  }, [nodes, mode, statusFilter, tagFilter])

  const doneCount    = visible.filter((n) => n.status === 'done').length
  const activeCount  = visible.filter((n) => n.status === 'in_progress').length
  const blockedCount = visible.filter((n) => n.status === 'blocked').length

  const selectClass = 'bg-bg-surface border border-bg-border rounded px-2 py-1 text-text-secondary text-2xs focus:outline-none focus:border-accent/50 cursor-pointer'

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        {/* Mode tabs */}
        <div className="flex items-center gap-0.5 bg-bg-surface border border-bg-border rounded p-0.5">
          {([['active', 'Active'], ['strategic', 'Strategic'], ['all', 'All']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-2xs rounded transition-colors ${
                mode === m
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectClass}>
            {(Object.entries(STATUS_LABEL) as [StatusFilter, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {allTags.length > 0 && (
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={selectClass}>
              <option value="all">All tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* Summary */}
          <div className="flex items-center gap-1.5 font-mono">
            {activeCount > 0 && <span className="chip chip-warn">{activeCount} active</span>}
            {blockedCount > 0 && <span className="chip chip-blocked">{blockedCount} blocked</span>}
            {doneCount > 0 && <span className="chip chip-done">{doneCount} done</span>}
          </div>
        </div>
      </div>

      {/* Nodes */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-text-tertiary text-2xs">
          No nodes match current filters.
        </div>
      ) : (
        <div className="bg-bg-surface border border-bg-border rounded-md overflow-hidden">
          {visible.map((node, i) => (
            <div key={node.id} className={i < visible.length - 1 ? 'border-b border-bg-border' : ''}>
              <RoadmapTree node={node} depth={0} />
            </div>
          ))}
        </div>
      )}

      {/* Strategic backlog callout */}
      {mode === 'active' && nodes.some((n) => n.scope === 'strategic_backlog') && (
        <div className="mt-4 flex items-center gap-2 text-text-tertiary text-2xs">
          <div className="flex-1 h-px bg-bg-border" />
          <button
            onClick={() => setMode('all')}
            className="hover:text-text-secondary transition-colors"
          >
            + {nodes.filter((n) => n.scope === 'strategic_backlog').length} strategic backlog
          </button>
          <div className="flex-1 h-px bg-bg-border" />
        </div>
      )}
    </>
  )
}

