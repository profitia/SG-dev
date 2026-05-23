'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

const CONVERSATION_TYPES = [
  { value: '', label: 'All types' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'runtime_analysis', label: 'Runtime Analysis' },
  { value: 'orchestration', label: 'Orchestration' },
  { value: 'ux', label: 'UX' },
  { value: 'continuity', label: 'Continuity' },
  { value: 'governance', label: 'Governance' },
  { value: 'infrastructure', label: 'Infrastructure' },
]

const IMPORTANCE_LEVELS = [
  { value: '', label: 'All levels' },
  { value: 'foundational', label: 'Foundational' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function ConversationFilters({
  currentFilters,
}: {
  currentFilters: Record<string, string | undefined>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams()
      const keys = ['q', 'etap', 'type', 'importance']
      keys.forEach((k) => {
        const current = k === key ? value : (currentFilters[k] ?? '')
        if (current) params.set(k, current)
      })
      // Reset page on filter change
      startTransition(() => {
        router.push(`/conversations${params.toString() ? `?${params.toString()}` : ''}`)
      })
    },
    [router, currentFilters]
  )

  const hasFilters = !!(currentFilters.q || currentFilters.etap || currentFilters.type || currentFilters.importance)

  return (
    <div className={`flex flex-wrap items-center gap-2 mb-4 ${isPending ? 'opacity-60' : ''}`}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search conversations..."
        defaultValue={currentFilters.q ?? ''}
        onChange={(e) => {
          const val = e.target.value
          if (val.length === 0 || val.length >= 2) updateFilter('q', val)
        }}
        className="px-3 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors w-52"
      />

      {/* ETAP */}
      <input
        type="text"
        placeholder="ETAP filter..."
        defaultValue={currentFilters.etap ?? ''}
        onChange={(e) => updateFilter('etap', e.target.value)}
        className="px-3 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors w-32"
      />

      {/* Type */}
      <select
        value={currentFilters.type ?? ''}
        onChange={(e) => updateFilter('type', e.target.value)}
        className="px-2 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
      >
        {CONVERSATION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Importance */}
      <select
        value={currentFilters.importance ?? ''}
        onChange={(e) => updateFilter('importance', e.target.value)}
        className="px-2 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
      >
        {IMPORTANCE_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => router.push('/conversations')}
          className="px-2.5 py-1.5 rounded text-xs text-text-tertiary border border-bg-border hover:text-text-primary hover:border-bg-hover transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
