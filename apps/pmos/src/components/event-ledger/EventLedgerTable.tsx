'use client'

import { useMemo, useState } from 'react'

import type { EventLedgerSourceRecord, EventRow } from '@/lib/event-ledger-query'

type EventRowView = Omit<EventRow, 'timestamp'> & {
  timestamp: string
}

type EventLedgerTableProps = {
  events: EventRowView[]
  sourceRecords: Record<string, EventLedgerSourceRecord>
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function pushSection(lines: string[], title: string, body: string[] | string | null) {
  if (Array.isArray(body)) {
    if (body.length === 0) return
    lines.push(`## ${title}`)
    lines.push('')
    for (const item of body) {
      lines.push(`- ${item}`)
    }
    lines.push('')
    return
  }

  if (!body) return

  lines.push(`## ${title}`)
  lines.push('')
  lines.push(body)
  lines.push('')
}

function buildTraceabilityLinks(filesPath: string | null): string[] {
  if (!filesPath) return []

  const markdownPath = filesPath
  const jsonPath = filesPath.endsWith('.md') ? filesPath.replace(/\.md$/, '.json') : null
  const slug = filesPath
    .split('/')
    .pop()
    ?.replace(/\.md$/, '')

  const links = [`- Markdown artifact: ${markdownPath}`]

  if (jsonPath) {
    links.push(`- JSON artifact: ${jsonPath}`)
  }

  if (slug) {
    links.push(`- Execution trail JSONL: apps/pmos/.pmos/conversations/logs/${slug}.execution-trail.jsonl`)
    links.push(`- Execution trail Markdown: apps/pmos/.pmos/conversations/logs/${slug}.execution-trail.md`)
    links.push(`- Closeout evidence: apps/pmos/.pmos/recovery/closeouts/${slug}.closeout.json`)
  }

  return links
}

function buildCanonicalConversationView(selectedRecord: EventLedgerSourceRecord): string | null {
  if (selectedRecord.sourceTable !== 'conversation_artifacts') {
    return null
  }

  const flightRecord = asRecord(selectedRecord.rawJson)
  if (!flightRecord) {
    return null
  }

  const metadata = asRecord(flightRecord.metadata)
  const task = asRecord(flightRecord.task)
  const analysis = asRecord(flightRecord.analysis)
  const findings = asRecord(flightRecord.findings)
  const decisions = asRecord(flightRecord.decisions)
  const actions = asRecord(flightRecord.actions)
  const result = asRecord(flightRecord.result)
  const completionEvidence = asRecord(flightRecord.completionEvidence)
  const record = asRecord(selectedRecord.record)

  const taskId = asString(metadata?.taskId) ?? 'UNKNOWN-TASK'
  const conversationId = asString(metadata?.conversationId)
  const timestamp = asString(metadata?.timestamp)
  const project = asString(metadata?.project)
  const etap = asString(metadata?.etap)
  const scope = asString(metadata?.scope)
  const subetap = asString(metadata?.subetap)
  const conversationType = asString(metadata?.conversationType)
  const importanceLevel = asString(metadata?.importanceLevel)
  const filesPath = asString(record?.filesPath)

  const lines = [`# PMOS Flight Record - ${taskId}`, '']

  if (conversationId) lines.push(`> **Conversation ID:** ${conversationId}`)
  if (timestamp) lines.push(`> **Timestamp:** ${timestamp}`)
  if (project) lines.push(`> **Project:** ${project}`)
  if (etap) lines.push(`> **ETAP:** ${etap}`)
  if (subetap) lines.push(`> **Subetap:** ${subetap}`)
  if (scope) lines.push(`> **Scope:** ${scope}`)
  if (conversationType) lines.push(`> **Conversation Type:** ${conversationType}`)
  if (importanceLevel) lines.push(`> **Importance Level:** ${importanceLevel}`)

  lines.push('')
  lines.push('---')
  lines.push('')

  pushSection(lines, 'Task', asString(task?.originalTaskRequest))

  const analysisParts = [asString(analysis?.executionSummary), asString(analysis?.reasoningSummary)].filter(
    (value): value is string => Boolean(value),
  )
  pushSection(lines, 'Analysis', analysisParts.join('\n\n'))
  pushSection(lines, 'Findings', asStringArray(findings?.findings))
  pushSection(lines, 'Blockers', asStringArray(findings?.blockers))
  pushSection(lines, 'Residual Risks', asStringArray(findings?.residualRisks))
  pushSection(lines, 'Decisions', asStringArray(decisions?.decisions))
  pushSection(lines, 'Actions', asStringArray(actions?.recommendations))
  pushSection(lines, 'Validations Executed', asStringArray(actions?.validationsExecuted))
  pushSection(lines, 'Validations Not Executed', asStringArray(actions?.validationsNotExecuted))
  pushSection(lines, 'Artifacts Created', asStringArray(actions?.artifactsCreated))
  pushSection(lines, 'Artifacts Modified', asStringArray(actions?.artifactsModified))

  const finalStatus = asString(result?.finalStatus)
  if (finalStatus) {
    lines.push('## Result')
    lines.push('')
    lines.push(`Final status: ${finalStatus}`)
    lines.push('')
  }

  const evidenceLines = [
    asString(completionEvidence?.closeoutState) ? `- closeoutState: ${asString(completionEvidence?.closeoutState)}` : null,
    asString(completionEvidence?.pmosSaveStatus) ? `- pmosSaveStatus: ${asString(completionEvidence?.pmosSaveStatus)}` : null,
    asString(completionEvidence?.vectorRebuildStatus) ? `- vectorRebuildStatus: ${asString(completionEvidence?.vectorRebuildStatus)}` : null,
    asString(completionEvidence?.archiveCompletenessStatus)
      ? `- archiveCompletenessStatus: ${asString(completionEvidence?.archiveCompletenessStatus)}`
      : null,
    asString(completionEvidence?.executionTrailStatus)
      ? `- executionTrailStatus: ${asString(completionEvidence?.executionTrailStatus)}`
      : null,
  ].filter((value): value is string => Boolean(value))

  if (evidenceLines.length > 0) {
    lines.push('## Completion Evidence')
    lines.push('')
    lines.push(...evidenceLines)
    lines.push('')
  }

  const traceabilityLinks = buildTraceabilityLinks(filesPath)
  if (traceabilityLinks.length > 0) {
    lines.push('## Traceability Links')
    lines.push('')
    lines.push(...traceabilityLinks)
    lines.push('')
  }

  lines.push('---')

  return lines.join('\n')
}

export function EventLedgerTable({ events, sourceRecords }: EventLedgerTableProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )
  const selectedRecord = selectedEvent ? sourceRecords[selectedEvent.id] ?? null : null
  const canonicalConversationView = selectedRecord ? buildCanonicalConversationView(selectedRecord) : null

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-bg-border bg-bg-surface">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-bg-elevated text-text-secondary">
            <tr className="border-b border-bg-border">
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Event Type</th>
              <th className="px-4 py-3 font-medium">Runtime Context</th>
              <th className="px-4 py-3 font-medium">Task ID</th>
              <th className="px-4 py-3 font-medium">Title</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const selected = event.id === selectedEventId
              return (
                <tr
                  key={event.id}
                  className={`cursor-pointer border-b border-bg-border/80 transition-colors ${
                    selected ? 'bg-accent/10' : 'hover:bg-bg-hover'
                  }`}
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <td className="px-4 py-3 font-mono text-text-secondary">{formatTimestamp(event.timestamp)}</td>
                  <td className="px-4 py-3 font-mono text-text-primary">{event.eventType}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{event.runtimeContext ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{event.taskId ?? '-'}</td>
                  <td className="px-4 py-3 text-text-primary">{event.title}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <aside className="w-[420px] min-w-[420px] border-l border-bg-border bg-bg-base">
        <div className="border-b border-bg-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Event Details</h2>
          <p className="mt-1 text-xs text-text-secondary">Raw PostgreSQL-backed record view</p>
        </div>

        {!selectedEvent || !selectedRecord ? (
          <div className="px-5 py-6 text-sm text-text-secondary">Select an event to inspect its source record.</div>
        ) : (
          <div className="h-[calc(100vh-220px)] overflow-y-auto px-5 py-5 space-y-6">
            <section>
              <h3 className="section-label">Metadata</h3>
              <div className="space-y-2 rounded border border-bg-border bg-bg-surface p-4 text-xs">
                <MetaRow label="Event ID" value={selectedEvent.id} />
                <MetaRow label="Event Type" value={selectedEvent.eventType} />
                <MetaRow label="Timestamp" value={selectedEvent.timestamp} />
                <MetaRow label="Runtime Context" value={selectedEvent.runtimeContext ?? '-'} />
                <MetaRow label="Source Table" value={selectedEvent.sourceTable} />
                <MetaRow label="Task ID" value={selectedEvent.taskId ?? '-'} />
                <MetaRow label="Record ID" value={selectedEvent.rawRecordId} />
                <MetaRow label="Title" value={selectedEvent.title} />
              </div>
            </section>

            <section>
              <h3 className="section-label">Raw Record</h3>
              <pre className="overflow-x-auto rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                {prettyJson(selectedRecord.record)}
              </pre>
            </section>

            {canonicalConversationView && (
              <section>
                <h3 className="section-label">Full Conversation</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                  {canonicalConversationView}
                </pre>
              </section>
            )}

            {selectedRecord.rawJson !== null && (
              <section>
                <h3 className="section-label">Raw JSON</h3>
                <pre className="overflow-x-auto rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                  {prettyJson(selectedRecord.rawJson)}
                </pre>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3">
      <span className="font-mono text-text-tertiary">{label}</span>
      <span className="break-all font-mono text-text-primary">{value}</span>
    </div>
  )
}