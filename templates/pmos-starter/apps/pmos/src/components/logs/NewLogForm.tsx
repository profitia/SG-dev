'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createExecutionLog } from '@/lib/actions/logs'

interface NewLogFormProps {
  nodes: { id: string; title: string; parentId: string | null }[]
  tags: { id: string; name: string }[]
}

export function NewLogForm({ nodes, tags }: NewLogFormProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [filesInput, setFilesInput] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const form = new FormData(e.currentTarget)
    // Serialize changed files as JSON
    const files = filesInput
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
    form.set('changedFiles', JSON.stringify(files))
    await createExecutionLog(form)
    router.push('/logs')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Title *</label>
        <input
          name="title"
          required
          placeholder="e.g. NextAuth v5 — JWT strategy implementation"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Summary */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Execution Summary</label>
        <textarea
          name="summary"
          rows={4}
          placeholder="What was done in this session? What was the outcome?"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* VSC Prompt */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">VSC / Copilot Prompt</label>
        <textarea
          name="prompt"
          rows={3}
          placeholder="Paste the prompt you sent to Copilot/ChatGPT..."
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none font-mono"
        />
      </div>

      {/* Changed files */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Changed Files (one per line)</label>
        <textarea
          rows={4}
          value={filesInput}
          onChange={(e) => setFilesInput(e.target.value)}
          placeholder={'src/lib/auth.ts\nsrc/middleware.ts\nprisma/schema.prisma'}
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none font-mono"
        />
      </div>

      {/* Architectural impact + blockers */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Architectural Impact</label>
          <textarea
            name="architecturalImpact"
            rows={3}
            placeholder="How does this change the architecture?"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Blockers</label>
          <textarea
            name="blockers"
            rows={3}
            placeholder="Any issues or blockers encountered?"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Next steps */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Next Steps</label>
        <textarea
          name="nextSteps"
          rows={2}
          placeholder="What should be done next?"
          className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
        />
      </div>

      {/* Canonical alignment + linked nodes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Canonical Alignment</label>
          <select
            name="canonicalAlignment"
            defaultValue="medium"
            className="w-full bg-bg-surface border border-bg-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="high">High — strengthens runtime</option>
            <option value="medium">Medium — neutral</option>
            <option value="low">Low — creates drift/debt</option>
          </select>
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
                {n.title.slice(0, 50)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                name="tagIds"
                value={tag.id}
                className="w-3 h-3 rounded border-bg-border accent-accent"
              />
              <span className="text-xs text-text-secondary">#{tag.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save log'}
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
