'use client'

import { useRouter } from 'next/navigation'
import { createArchitectureWarning } from '@/lib/actions/warnings'

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const TYPE_OPTIONS = [
  { value: 'dashboard_gravity', label: 'Dashboard Gravity' },
  { value: 'runtime_boundary', label: 'Runtime Boundary' },
  { value: 'business_logic_leak', label: 'Business Logic Leak' },
  { value: 'orchestration_drift', label: 'Orchestration Drift' },
  { value: 'overengineering', label: 'Overengineering' },
  { value: 'prompt_coupling', label: 'Prompt Coupling' },
  { value: 'architecture_debt', label: 'Architecture Debt' },
]

type Props = {
  nodes: { id: string; title: string }[]
  logs: { id: string; title: string }[]
}

export function NewWarningForm({ nodes, logs }: Props) {
  const router = useRouter()

  async function handleSubmit(form: FormData) {
    await createArchitectureWarning(form)
    router.push('/warnings')
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Title</label>
        <input
          name="title"
          required
          placeholder="Dashboard Gravity Risk — ETAP 4"
          className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent/60"
        />
      </div>

      {/* Severity + Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Severity</label>
          <select
            name="severity"
            defaultValue="medium"
            className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/60"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Type</label>
          <select
            name="type"
            required
            className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/60"
          >
            <option value="">Select type…</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Description</label>
        <textarea
          name="description"
          required
          rows={5}
          placeholder="Describe the architectural risk, what it affects, and why it matters…"
          className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent/60 resize-none"
        />
      </div>

      {/* Affected area */}
      <div>
        <label className="block text-text-secondary text-xs mb-1.5">Affected area <span className="text-text-tertiary">(optional)</span></label>
        <input
          name="affectedArea"
          placeholder="apps/web/src/lib/actions, packages/ncic, …"
          className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent/60"
        />
      </div>

      {/* Links */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Related roadmap node <span className="text-text-tertiary">(optional)</span></label>
          <select
            name="relatedRoadmapNodeId"
            className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/60"
          >
            <option value="">None</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1.5">Related log <span className="text-text-tertiary">(optional)</span></label>
          <select
            name="relatedLogId"
            className="w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/60"
          >
            <option value="">None</option>
            {logs.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent/90 transition-colors"
        >
          Save warning
        </button>
      </div>
    </form>
  )
}
