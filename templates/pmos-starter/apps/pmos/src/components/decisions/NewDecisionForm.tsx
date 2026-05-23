'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createDecision } from '@/lib/actions/decisions'

interface NewDecisionFormProps {
  nodes: { id: string; title: string }[]
}

export function NewDecisionForm({ nodes }: NewDecisionFormProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [systemsInput, setSystemsInput] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const form = new FormData(e.currentTarget)
    const systems = systemsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    form.set('affectedSystems', JSON.stringify(systems))
    await createDecision(form)
    router.push('/decisions')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Title *</label>
        <input
          name="title"
          required
          placeholder="e.g. JWT sessions over DB sessions"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Decision *</label>
        <textarea
          name="decision"
          required
          rows={3}
          placeholder="What was decided?"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Reason</label>
          <textarea
            name="reason"
            rows={3}
            placeholder="Why was this decision made?"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Impact</label>
          <textarea
            name="impact"
            rows={3}
            placeholder="What is the consequence of this decision?"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Affected Systems (one per line)</label>
        <textarea
          rows={3}
          value={systemsInput}
          onChange={(e) => setSystemsInput(e.target.value)}
          placeholder={'src/lib/auth.ts\nprisma/schema.prisma\npackages/database'}
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none font-mono"
        />
      </div>

      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Linked Roadmap Node</label>
        <select
          name="nodeId"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
        >
          <option value="">— None —</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title.slice(0, 60)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save decision'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
