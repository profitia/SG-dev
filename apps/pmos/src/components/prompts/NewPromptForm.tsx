'use client'

import { useRouter } from 'next/navigation'
import { createPromptExecution } from '@/lib/actions/prompts'

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'archived', label: 'Archived' },
]

const TYPE_OPTIONS = [
  { value: 'implementation', label: 'Implementation' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'fix', label: 'Fix' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'seed', label: 'Seed / Data' },
]

type Props = {
  nodes: { id: string; title: string; scope: string }[]
  logs: { id: string; title: string }[]
}

const inputClass = 'w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent/60'
const labelClass = 'block text-text-secondary text-xs mb-1.5'

export function NewPromptForm({ nodes, logs }: Props) {
  const router = useRouter()

  async function handleSubmit(form: FormData) {
    await createPromptExecution(form)
    router.push('/prompts')
  }

  const activeNodes = nodes.filter((n) => n.scope === 'active')
  const backlogNodes = nodes.filter((n) => n.scope === 'strategic_backlog')

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* PMOS Header preview */}
      <div className="bg-bg-surface border border-bg-border rounded-lg p-4">
        <p className="text-2xs text-accent/60 font-mono mb-2"># PMOS HEADER (auto-generated from fields below)</p>
        <pre className="text-text-tertiary text-xs font-mono">{`[PMOS]
ETAP: <etap>
SUBETAP: <subetap>
NODE: <node>
DOMAIN: <domain>
TYPE: <type>`}</pre>
      </div>

      {/* Title */}
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required placeholder="NCIC Intent Recognition — baseline implementation" className={inputClass} />
      </div>

      {/* PMOS header fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>ETAP</label>
          <input name="etap" placeholder="5" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>SUBETAP</label>
          <input name="subetap" placeholder="5.2" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>NODE</label>
          <input name="node" placeholder="NCIC Intent Recognition" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>DOMAIN</label>
          <input name="domain" placeholder="runtime,intents,memory" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type</label>
          <select name="promptType" defaultValue="implementation" className={inputClass}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue="completed" className={inputClass}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Prompt content */}
      <div>
        <label className={labelClass}>Prompt content</label>
        <textarea name="promptContent" required rows={6} placeholder={`[PMOS]\nETAP: 5\nSUBETAP: 5.2\nNODE: NCIC Intent Recognition\nDOMAIN: runtime,intents\nTYPE: implementation\n\nImplement...`} className={`${inputClass} resize-none font-mono text-xs`} />
      </div>

      {/* Execution summary */}
      <div>
        <label className={labelClass}>Execution summary</label>
        <textarea name="executionSummary" rows={3} placeholder="What was done, what changed, what decisions were made…" className={`${inputClass} resize-none`} />
      </div>

      {/* Architectural impact */}
      <div>
        <label className={labelClass}>Architectural impact</label>
        <textarea name="architecturalImpact" rows={2} placeholder="How does this change the system architecture?" className={`${inputClass} resize-none`} />
      </div>

      {/* Changed files */}
      <div>
        <label className={labelClass}>Changed files <span className="text-text-tertiary">(one per line)</span></label>
        <textarea name="changedFiles" rows={4} placeholder="apps/web/src/lib/ncic/intents.ts&#10;packages/ncic/src/index.ts" className={`${inputClass} resize-none font-mono text-xs`} />
      </div>

      {/* Blockers + Next steps */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Blockers <span className="text-text-tertiary">(optional)</span></label>
          <textarea name="blockers" rows={2} placeholder="What is blocking progress?" className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className={labelClass}>Next steps <span className="text-text-tertiary">(optional)</span></label>
          <textarea name="nextSteps" rows={2} placeholder="What should happen next?" className={`${inputClass} resize-none`} />
        </div>
      </div>

      {/* Roadmap node link */}
      <div>
        <label className={labelClass}>Linked roadmap node <span className="text-text-tertiary">(optional)</span></label>
        <select name="roadmapNodeId" className={inputClass}>
          <option value="">None</option>
          {activeNodes.length > 0 && (
            <optgroup label="Active Roadmap">
              {activeNodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </optgroup>
          )}
          {backlogNodes.length > 0 && (
            <optgroup label="Strategic Backlog">
              {backlogNodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </optgroup>
          )}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent/90 transition-colors">
          Save execution
        </button>
      </div>
    </form>
  )
}
