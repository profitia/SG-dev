'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createRoadmapNode } from '@/lib/actions/roadmap'

interface NewNodeFormProps {
  parents: { id: string; title: string }[]
}

export function NewNodeForm({ parents }: NewNodeFormProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const form = new FormData(e.currentTarget)
    await createRoadmapNode(form)
    router.push('/roadmap')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Title *</label>
        <input
          name="title"
          required
          placeholder="e.g. ETAP 7 — AI Coach v2"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Description</label>
        <textarea
          name="description"
          rows={3}
          placeholder="What does this etap contain?"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Status</label>
          <select
            name="status"
            defaultValue="backlog"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Priority</label>
          <select
            name="priority"
            defaultValue="medium"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Parent (optional)</label>
          <select
            name="parentId"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="">— Root node —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {pending ? 'Creating...' : 'Create node'}
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
