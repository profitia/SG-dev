'use client'

import { useState, useMemo } from 'react'

type ChangedFile = {
  id: string
  path: string
  changeType: string
  impactLevel: string
  notes: string | null
  createdAt: Date
  promptExecution: { id: string; title: string; etap: string | null } | null
  executionLog: { id: string; title: string } | null
}

const IMPACT_CONFIG = {
  critical: { dot: 'bg-red-500', text: 'text-red-400', label: 'critical' },
  high:     { dot: 'bg-orange-400', text: 'text-orange-400', label: 'high' },
  medium:   { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'medium' },
  low:      { dot: 'bg-neutral-600', text: 'text-neutral-500', label: 'low' },
} as const

const CHANGE_TYPE_LABEL: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  renamed: 'renamed',
  migrated: 'migrated',
}

export function ChangedFilesClient({ files }: { files: ChangedFile[] }) {
  const [query, setQuery] = useState('')
  const [impact, setImpact] = useState<string>('all')
  const [changeType, setChangeType] = useState<string>('all')

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (impact !== 'all' && f.impactLevel !== impact) return false
      if (changeType !== 'all' && f.changeType !== changeType) return false
      if (query.trim().length >= 2) {
        const q = query.toLowerCase()
        return (
          f.path.toLowerCase().includes(q) ||
          (f.notes ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [files, query, impact, changeType])

  const inputClass = 'bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent/60'
  const selectClass = `${inputClass} cursor-pointer`

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search path or notes…"
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select value={impact} onChange={(e) => setImpact(e.target.value)} className={selectClass}>
          <option value="all">All impact</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={changeType} onChange={(e) => setChangeType(e.target.value)} className={selectClass}>
          <option value="all">All types</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="renamed">Renamed</option>
          <option value="migrated">Migrated</option>
        </select>
        <span className="text-text-tertiary text-sm flex-shrink-0">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* File list */}
      <div className="space-y-px">
        {filtered.map((f) => {
          const imp = IMPACT_CONFIG[f.impactLevel as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.low
          const filename = f.path.split('/').slice(-1)[0]
          const dir = f.path.split('/').slice(0, -1).join('/')

          return (
            <div key={f.id} className="flex items-start gap-3 py-2.5 border-b border-bg-border/50 group">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${imp.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-text-primary text-sm">{filename}</span>
                  {dir && <span className="font-mono text-text-tertiary text-2xs">{dir}/</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-2xs font-mono ${imp.text}`}>{imp.label}</span>
                  <span className="text-2xs text-text-tertiary">{CHANGE_TYPE_LABEL[f.changeType] ?? f.changeType}</span>
                  {f.notes && <span className="text-2xs text-text-tertiary truncate max-w-64">{f.notes}</span>}
                  {f.promptExecution && (
                    <span className="text-2xs text-accent/60 font-mono">
                      → {f.promptExecution.etap ? `ETAP ${f.promptExecution.etap} · ` : ''}{f.promptExecution.title.slice(0, 40)}
                    </span>
                  )}
                  {f.executionLog && (
                    <span className="text-2xs text-blue-400/60 font-mono">→ log: {f.executionLog.title.slice(0, 40)}</span>
                  )}
                </div>
              </div>
              <time className="text-2xs text-text-tertiary flex-shrink-0 mt-0.5">
                {new Date(f.createdAt).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })}
              </time>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-tertiary text-sm">
            No files match your filters.
          </div>
        )}
      </div>
    </div>
  )
}
