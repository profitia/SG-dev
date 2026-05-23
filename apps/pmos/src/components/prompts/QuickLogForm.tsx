'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPromptExecution } from '@/lib/actions/prompts'

const STATUS_OPTIONS = ['completed', 'queued', 'running', 'failed', 'archived'] as const

const TYPE_OPTIONS = [
  { value: 'implementation', label: 'Implementation' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'migration', label: 'Migration' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'runtime_analysis', label: 'Runtime Analysis' },
  { value: 'performance', label: 'Performance' },
  { value: 'infra', label: 'Infra' },
  { value: 'warning_resolution', label: 'Warning Resolution' },
]

type Template = {
  id: string
  name: string
  templateType: string
  templateContent: string
}

type Props = {
  nodes: { id: string; title: string; scope: string }[]
  templates: Template[]
}

const inputClass = 'w-full bg-bg-surface border border-bg-border rounded-md px-3 py-2 text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent/60'
const labelClass = 'block text-text-secondary text-xs mb-1.5'

export function QuickLogForm({ nodes, templates }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'quick' | 'advanced'>('quick')
  const [promptContent, setPromptContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  const activeNodes = nodes.filter((n) => n.scope === 'active')
  const backlogNodes = nodes.filter((n) => n.scope === 'strategic_backlog')

  function applyTemplate(templateId: string) {
    const t = templates.find((t) => t.id === templateId)
    if (t) {
      setPromptContent(t.templateContent)
      setSelectedTemplate(templateId)
    }
  }

  async function handleSubmit(form: FormData) {
    // Inject current promptContent into form data
    form.set('promptContent', promptContent || '[quick log — no prompt content]')
    await createPromptExecution(form)
    router.push('/timeline')
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-bg-surface border border-bg-border rounded-md p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${mode === 'quick' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Quick log
        </button>
        <button
          type="button"
          onClick={() => setMode('advanced')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${mode === 'advanced' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Full execution log
        </button>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div>
          <label className={labelClass}>Template <span className="text-text-tertiary">(optional — prefills prompt content)</span></label>
          <select
            value={selectedTemplate}
            onChange={(e) => applyTemplate(e.target.value)}
            className={inputClass}
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ─── QUICK MODE ─────────────────────────── */}
      {/* Title — always visible */}
      <div>
        <label className={labelClass}>Title</label>
        <input
          name="title"
          required
          placeholder="NCIC intent routing — baseline implementation"
          className={inputClass}
        />
      </div>

      {/* Status + node — always visible */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" defaultValue="completed" className={inputClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Roadmap node <span className="text-text-tertiary">(optional)</span></label>
          <select name="roadmapNodeId" className={inputClass}>
            <option value="">None</option>
            {activeNodes.length > 0 && (
              <optgroup label="Active">
                {activeNodes.map((n) => <option key={n.id} value={n.id}>{n.title.split('—')[0].trim()}</option>)}
              </optgroup>
            )}
            {backlogNodes.length > 0 && (
              <optgroup label="Strategic Backlog">
                {backlogNodes.map((n) => <option key={n.id} value={n.id}>{n.title.split('—')[0].trim()}</option>)}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Summary — always visible */}
      <div>
        <label className={labelClass}>
          Summary
          {mode === 'quick' && <span className="text-text-tertiary ml-1">— what was done?</span>}
        </label>
        <textarea
          name="executionSummary"
          rows={mode === 'quick' ? 3 : 4}
          placeholder="What was done, what changed, key decisions…"
          className={`${inputClass} resize-none`}
          required={mode === 'quick'}
        />
      </div>

      {/* Changed files — simple text in quick, structured in advanced */}
      <div>
        <label className={labelClass}>
          Changed files
          {mode === 'quick' && <span className="text-text-tertiary ml-1">(one per line)</span>}
        </label>
        <textarea
          name="changedFiles"
          rows={3}
          placeholder="apps/web/src/lib/ncic/intents.ts&#10;packages/ncic/src/index.ts"
          className={`${inputClass} resize-none font-mono text-xs`}
        />
      </div>

      {/* ─── ADVANCED FIELDS ─────────────────────── */}
      {mode === 'advanced' && (
        <>
          {/* PMOS header */}
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

          <div>
            <label className={labelClass}>Type</label>
            <select name="promptType" defaultValue="implementation" className={inputClass}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Prompt content */}
          <div>
            <label className={labelClass}>Prompt content</label>
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              rows={8}
              placeholder="[PMOS]&#10;ETAP: 5&#10;..."
              className={`${inputClass} resize-none font-mono text-xs`}
            />
          </div>

          {/* Architectural impact */}
          <div>
            <label className={labelClass}>Architectural impact</label>
            <textarea name="architecturalImpact" rows={2} placeholder="How does this change the system architecture?" className={`${inputClass} resize-none`} />
          </div>

          {/* Blockers + Next steps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Blockers <span className="text-text-tertiary">(optional)</span></label>
              <textarea name="blockers" rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Next steps <span className="text-text-tertiary">(optional)</span></label>
              <textarea name="nextSteps" rows={2} className={`${inputClass} resize-none`} />
            </div>
          </div>
        </>
      )}

      {/* Hidden field for quick mode prompt content */}
      {mode === 'quick' && (
        <input type="hidden" name="promptContentHidden" value={promptContent} />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-text-secondary text-sm hover:text-text-primary transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent/90 transition-colors">
          {mode === 'quick' ? 'Log it' : 'Save execution'}
        </button>
      </div>
    </form>
  )
}
