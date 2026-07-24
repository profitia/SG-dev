'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { EventLedgerSourceRecord, EventRow, HandoffArtifactRecord } from '@/lib/event-ledger-query'

type EventRowView = Omit<EventRow, 'timestamp'> & {
  timestamp: string
}

type EventLedgerTableProps = {
  events: EventRowView[]
  sourceRecords: Record<string, EventLedgerSourceRecord>
  handoffArtifactsByConversationId: Record<string, HandoffArtifactRecordView>
}

type HandoffArtifactRecordView = Omit<HandoffArtifactRecord, 'createdAt'> & {
  createdAt: string
}

type HandoffPayloadView = {
  resultStatus?: string
  currentState?: string[]
  recommendedNextDecision?: string
  bridgePayloadText?: string
}

type SearchScope =
  | 'taskId'
  | 'runtimeContext'
  | 'rawRecord'
  | 'metadata'
  | 'fullConversation'
  | 'recordId'
  | 'artifactKey'
  | 'eventType'

type SearchScopeState = Record<SearchScope, boolean>

type SearchDocument = Record<SearchScope, string>

const SEARCH_SCOPE_OPTIONS: Array<{ key: SearchScope; label: string }> = [
  { key: 'taskId', label: 'Task ID' },
  { key: 'runtimeContext', label: 'Runtime Context' },
  { key: 'rawRecord', label: 'Raw Record' },
  { key: 'metadata', label: 'Metadata' },
  { key: 'fullConversation', label: 'Full Conversation' },
  { key: 'recordId', label: 'Record ID' },
  { key: 'artifactKey', label: 'Artifact Key' },
  { key: 'eventType', label: 'Event Type' },
]

const EMPTY_SCOPE_STATE: SearchScopeState = {
  taskId: false,
  runtimeContext: false,
  rawRecord: false,
  metadata: false,
  fullConversation: false,
  recordId: false,
  artifactKey: false,
  eventType: false,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''

  try {
    return prettyJson(value)
  } catch {
    return String(value)
  }
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

function collectFieldMatches(value: unknown, matcher: (key: string) => boolean, matches: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectFieldMatches(item, matcher, matches)
    }
    return matches
  }

  if (!value || typeof value !== 'object') {
    return matches
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (matcher(key)) {
      const serialized = stringifyValue(nestedValue)
      if (serialized.length > 0) {
        matches.push(serialized)
      }
    }

    collectFieldMatches(nestedValue, matcher, matches)
  }

  return matches
}

function uniqNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
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

function getConversationSource(selectedRecord: EventLedgerSourceRecord): EventLedgerSourceRecord | EventLedgerSourceRecord['linkedConversation'] {
  return selectedRecord.sourceTable === 'conversation_artifacts' ? selectedRecord : selectedRecord.linkedConversation
}

function buildCanonicalConversationView(selectedRecord: EventLedgerSourceRecord): string | null {
  const conversationSource = getConversationSource(selectedRecord)

  if (!conversationSource) {
    return null
  }

  const flightRecord = asRecord(conversationSource.rawJson)
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
  const record = asRecord(conversationSource.record)

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

function buildMetadataView(selectedEvent: EventRowView, selectedRecord: EventLedgerSourceRecord): string | null {
  const metadataValues = uniqNonEmpty([
    stringifyValue(collectFieldMatches(selectedRecord.record, (key) => key.toLowerCase() === 'metadata')),
    stringifyValue(collectFieldMatches(selectedRecord.rawJson, (key) => key.toLowerCase() === 'metadata')),
  ])

  if (metadataValues.length === 0) {
    return null
  }

  return metadataValues.join('\n\n')
}

function getConversationId(selectedRecord: EventLedgerSourceRecord): string | null {
  const conversationSource = getConversationSource(selectedRecord)

  if (!conversationSource) {
    return null
  }

  const recordConversationId = asString((conversationSource.record as Record<string, unknown>).conversationId)
  if (recordConversationId) {
    return recordConversationId
  }

  const flightRecord = asRecord(conversationSource.rawJson)
  const metadata = asRecord(flightRecord?.metadata)
  return asString(metadata?.conversationId)
}

function asHandoffPayload(value: unknown): HandoffPayloadView | null {
  const payload = asRecord(value)
  if (!payload) {
    return null
  }

  return {
    resultStatus: asString(payload.resultStatus) ?? undefined,
    currentState: asStringArray(payload.currentState),
    recommendedNextDecision: asString(payload.recommendedNextDecision) ?? undefined,
    bridgePayloadText: asString(payload.bridgePayloadText) ?? undefined,
  }
}

function buildSearchDocument(event: EventRowView, sourceRecord: EventLedgerSourceRecord): SearchDocument {
  const rawRecordText = prettyJson(sourceRecord.record)
  const rawJsonText = sourceRecord.rawJson !== null ? prettyJson(sourceRecord.rawJson) : ''
  const metadataText = uniqNonEmpty([
    ...collectFieldMatches(sourceRecord.record, (key) => key.toLowerCase() === 'metadata'),
    ...collectFieldMatches(sourceRecord.rawJson, (key) => key.toLowerCase() === 'metadata'),
    ...collectFieldMatches(sourceRecord.linkedConversation?.record, (key) => key.toLowerCase() === 'metadata'),
    ...collectFieldMatches(sourceRecord.linkedConversation?.rawJson, (key) => key.toLowerCase() === 'metadata'),
  ]).join('\n\n')

  const runtimeContextText = uniqNonEmpty([
    event.runtimeContext,
    ...collectFieldMatches(sourceRecord.record, (key) => /(runtime|context|snapshot|metadata)/i.test(key)),
    ...collectFieldMatches(sourceRecord.rawJson, (key) => /(runtime|context|snapshot|metadata)/i.test(key)),
    ...collectFieldMatches(sourceRecord.linkedConversation?.record, (key) => /(runtime|context|snapshot|metadata)/i.test(key)),
    ...collectFieldMatches(sourceRecord.linkedConversation?.rawJson, (key) => /(runtime|context|snapshot|metadata)/i.test(key)),
  ]).join('\n\n')

  const fullConversationText = uniqNonEmpty([
    buildCanonicalConversationView(sourceRecord),
    asString((sourceRecord.record as Record<string, unknown>).userPrompt),
    asString((sourceRecord.record as Record<string, unknown>).llmResponse),
    asString((sourceRecord.record as Record<string, unknown>).summary),
    sourceRecord.linkedConversation ? prettyJson(sourceRecord.linkedConversation.record) : null,
    sourceRecord.linkedConversation?.rawJson !== null && sourceRecord.linkedConversation?.rawJson !== undefined
      ? prettyJson(sourceRecord.linkedConversation.rawJson)
      : null,
  ]).join('\n\n')

  return {
    taskId: uniqNonEmpty([
      event.taskId,
      asString((sourceRecord.record as Record<string, unknown>).taskId),
      asString((sourceRecord.linkedConversation?.record as Record<string, unknown> | undefined)?.taskId),
    ]).join('\n'),
    runtimeContext: runtimeContextText,
    rawRecord: uniqNonEmpty([rawRecordText, rawJsonText]).join('\n\n'),
    metadata: metadataText,
    fullConversation: fullConversationText,
    recordId: uniqNonEmpty([event.rawRecordId, asString((sourceRecord.record as Record<string, unknown>).id)]).join('\n'),
    artifactKey: asString((sourceRecord.record as Record<string, unknown>).artifactKey) ?? '',
    eventType: event.eventType,
  }
}

function matchesSearch(document: SearchDocument, query: string, searchEverything: boolean, scopes: SearchScopeState): boolean {
  if (query.length === 0) {
    return true
  }

  const activeScopes = searchEverything
    ? SEARCH_SCOPE_OPTIONS.map((option) => option.key)
    : SEARCH_SCOPE_OPTIONS.filter((option) => scopes[option.key]).map((option) => option.key)

  if (activeScopes.length === 0) {
    return false
  }

  return activeScopes.some((scope) => document[scope].toLowerCase().includes(query))
}

function matchesDateRange(timestamp: string, fromDate: string, toDate: string): boolean {
  const eventTime = new Date(timestamp).getTime()
  if (Number.isNaN(eventTime)) return false

  if (fromDate) {
    const fromTime = new Date(`${fromDate}T00:00:00`).getTime()
    if (!Number.isNaN(fromTime) && eventTime < fromTime) {
      return false
    }
  }

  if (toDate) {
    const toTime = new Date(`${toDate}T23:59:59.999`).getTime()
    if (!Number.isNaN(toTime) && eventTime > toTime) {
      return false
    }
  }

  return true
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim()

  if (normalizedQuery.length === 0) {
    return <>{text}</>
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig'))

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-accent/20 px-0.5 text-text-primary">
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function EventLedgerTable({ events, sourceRecords, handoffArtifactsByConversationId }: EventLedgerTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchEverything, setSearchEverything] = useState(true)
  const [searchScopes, setSearchScopes] = useState<SearchScopeState>(EMPTY_SCOPE_STATE)
  const [taskIdFilter, setTaskIdFilter] = useState('')
  const [runtimeContextFilter, setRuntimeContextFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null)

  const searchDocuments = useMemo(
    () =>
      Object.fromEntries(
        events.map((event) => {
          const sourceRecord = sourceRecords[event.id]
          return [event.id, sourceRecord ? buildSearchDocument(event, sourceRecord) : { ...EMPTY_SCOPE_STATE }]
        }),
      ) as Record<string, SearchDocument>,
    [events, sourceRecords],
  )

  const taskIdOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.taskId).filter((taskId): taskId is string => Boolean(taskId)))).sort(),
    [events],
  )
  const runtimeContextOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.runtimeContext).filter((value): value is string => Boolean(value)))).sort(),
    [events],
  )
  const eventTypeOptions = useMemo(() => Array.from(new Set(events.map((event) => event.eventType))), [events])

  const normalizedSearchQuery = useMemo(() => normalizeSearchValue(searchQuery), [searchQuery])

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (taskIdFilter && event.taskId !== taskIdFilter) {
          return false
        }

        if (runtimeContextFilter && event.runtimeContext !== runtimeContextFilter) {
          return false
        }

        if (eventTypeFilter && event.eventType !== eventTypeFilter) {
          return false
        }

        if (!matchesDateRange(event.timestamp, fromDate, toDate)) {
          return false
        }

        const document = searchDocuments[event.id]
        if (!document) {
          return normalizedSearchQuery.length === 0
        }

        return matchesSearch(document, normalizedSearchQuery, searchEverything, searchScopes)
      }),
    [events, taskIdFilter, runtimeContextFilter, eventTypeFilter, fromDate, toDate, searchDocuments, normalizedSearchQuery, searchEverything, searchScopes],
  )

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventId(null)
      return
    }

    if (!selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(filteredEvents[0].id)
    }
  }, [filteredEvents, selectedEventId])

  const selectedEvent = useMemo(
    () => filteredEvents.find((event) => event.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId],
  )
  const selectedRecord = selectedEvent ? sourceRecords[selectedEvent.id] ?? null : null
  const selectedConversationId = selectedRecord ? getConversationId(selectedRecord) : null
  const selectedHandoffArtifact = selectedConversationId ? handoffArtifactsByConversationId[selectedConversationId] ?? null : null
  const handoffPayload = selectedHandoffArtifact ? asHandoffPayload(selectedHandoffArtifact.payload) : null
  const canonicalConversationView = selectedRecord ? buildCanonicalConversationView(selectedRecord) : null
  const metadataView = selectedEvent && selectedRecord ? buildMetadataView(selectedEvent, selectedRecord) : null

  const rawRecordText = selectedRecord ? prettyJson(selectedRecord.record) : null
  const rawJsonText = selectedRecord?.rawJson !== null && selectedRecord?.rawJson !== undefined ? prettyJson(selectedRecord.rawJson) : null
  const rawHandoffPayloadText = selectedHandoffArtifact?.payload !== null && selectedHandoffArtifact?.payload !== undefined
    ? prettyJson(selectedHandoffArtifact.payload)
    : null

  const clearFilters = () => {
    setSearchQuery('')
    setSearchEverything(true)
    setSearchScopes(EMPTY_SCOPE_STATE)
    setTaskIdFilter('')
    setRuntimeContextFilter('')
    setEventTypeFilter('')
    setFromDate('')
    setToDate('')
  }

  const renderHighlightedValue = (value: string): ReactNode => <HighlightedText text={value} query={searchQuery} />

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-bg-border bg-bg-surface">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-bg-border px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
            <section className="space-y-3">
              <div>
                <label htmlFor="event-ledger-search" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  Global Search
                </label>
                <input
                  id="event-ledger-search"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search events..."
                  className="w-full rounded border border-bg-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                />
              </div>

              <div className="rounded border border-bg-border bg-bg-base p-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Search Scope</div>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={searchEverything}
                    onChange={(event) => {
                      const nextChecked = event.target.checked
                      setSearchEverything(nextChecked)
                      if (nextChecked) {
                        setSearchScopes(EMPTY_SCOPE_STATE)
                      }
                    }}
                    className="h-4 w-4 rounded border-bg-border bg-bg-base"
                  />
                  <span>Everything</span>
                </label>

                {!searchEverything && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SEARCH_SCOPE_OPTIONS.map((option) => (
                      <label key={option.key} className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={searchScopes[option.key]}
                          onChange={(event) =>
                            setSearchScopes((current) => ({
                              ...current,
                              [option.key]: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-bg-border bg-bg-base"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 rounded border border-bg-border bg-bg-base p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Filters</div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="space-y-1 text-sm text-text-secondary">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Task ID</span>
                  <select
                    value={taskIdFilter}
                    onChange={(event) => setTaskIdFilter(event.target.value)}
                    className="w-full rounded border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                  >
                    <option value="">All Task IDs</option>
                    {taskIdOptions.map((taskId) => (
                      <option key={taskId} value={taskId}>
                        {taskId}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm text-text-secondary">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Runtime Context</span>
                  <select
                    value={runtimeContextFilter}
                    onChange={(event) => setRuntimeContextFilter(event.target.value)}
                    className="w-full rounded border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                  >
                    <option value="">All Runtime Contexts</option>
                    {runtimeContextOptions.map((runtimeContext) => (
                      <option key={runtimeContext} value={runtimeContext}>
                        {runtimeContext}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm text-text-secondary">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Event Type</span>
                  <select
                    value={eventTypeFilter}
                    onChange={(event) => setEventTypeFilter(event.target.value)}
                    className="w-full rounded border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                  >
                    <option value="">All Event Types</option>
                    {eventTypeOptions.map((eventType) => (
                      <option key={eventType} value={eventType}>
                        {eventType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm text-text-secondary">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">From Date</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full rounded border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                  />
                </label>

                <label className="space-y-1 text-sm text-text-secondary">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">To Date</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full rounded border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded border border-bg-border px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-text-secondary transition hover:bg-bg-hover hover:text-text-primary"
              >
                Reset Search & Filters
              </button>
            </section>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            <span className="rounded border border-bg-border bg-bg-base px-3 py-1.5 font-mono">Total Events: {events.length}</span>
            <span className="rounded border border-bg-border bg-bg-base px-3 py-1.5 font-mono">Filtered Events: {filteredEvents.length}</span>
          </div>
        </div>

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
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-secondary">
                    No events matched the current search and filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
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
                      <td className="px-4 py-3 font-mono text-text-primary">{renderHighlightedValue(event.eventType)}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{renderHighlightedValue(event.runtimeContext ?? '-')}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{renderHighlightedValue(event.taskId ?? '-')}</td>
                      <td className="px-4 py-3 text-text-primary">{renderHighlightedValue(event.title)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="w-[420px] min-w-[420px] border-l border-bg-border bg-bg-base">
        <div className="border-b border-bg-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Event Details</h2>
              <p className="mt-1 text-xs text-text-secondary">Raw PostgreSQL-backed record view</p>
            </div>
            {handoffPayload?.bridgePayloadText ? <CopyTextButton text={handoffPayload.bridgePayloadText} label="Copy bridge payload" /> : null}
          </div>
        </div>

        {!selectedEvent || !selectedRecord ? (
          <div className="px-5 py-6 text-sm text-text-secondary">Select an event to inspect its source record.</div>
        ) : (
          <div className="h-[calc(100vh-220px)] overflow-y-auto px-5 py-5 space-y-6">
            <section>
              <h3 className="section-label">Metadata</h3>
              <div className="space-y-2 rounded border border-bg-border bg-bg-surface p-4 text-xs">
                <MetaRow label="Event ID" value={selectedEvent.id} query={searchQuery} />
                <MetaRow label="Event Type" value={selectedEvent.eventType} query={searchQuery} />
                <MetaRow label="Timestamp" value={selectedEvent.timestamp} query={searchQuery} />
                <MetaRow label="Runtime Context" value={selectedEvent.runtimeContext ?? '-'} query={searchQuery} />
                <MetaRow label="Source Table" value={selectedEvent.sourceTable} query={searchQuery} />
                <MetaRow label="Task ID" value={selectedEvent.taskId ?? '-'} query={searchQuery} />
                <MetaRow label="Record ID" value={selectedEvent.rawRecordId} query={searchQuery} />
                <MetaRow label="Title" value={selectedEvent.title} query={searchQuery} />
              </div>
            </section>

            {metadataView && (
              <section>
                <h3 className="section-label">Metadata JSON</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                  <HighlightedText text={metadataView} query={searchQuery} />
                </pre>
              </section>
            )}

            <section>
              <h3 className="section-label">Raw Record</h3>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                <HighlightedText text={rawRecordText ?? ''} query={searchQuery} />
              </pre>
            </section>

            {selectedHandoffArtifact ? (
              <section>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="section-label mb-0">GPT HANDOFF</h3>
                </div>

                <div className="space-y-4 rounded border border-bg-border bg-bg-surface p-4">
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Handoff Metadata</p>
                    <div className="space-y-2 text-xs">
                      <MetaRow label="Artifact ID" value={selectedHandoffArtifact.id} query={searchQuery} />
                      <MetaRow label="Created At" value={selectedHandoffArtifact.createdAt} query={searchQuery} />
                      <MetaRow label="Task ID" value={selectedHandoffArtifact.taskId ?? '-'} query={searchQuery} />
                      <MetaRow label="Conversation ID" value={selectedHandoffArtifact.conversationId} query={searchQuery} />
                      <MetaRow label="Status" value={selectedHandoffArtifact.status} query={searchQuery} />
                      <MetaRow label="Version" value={selectedHandoffArtifact.version} query={searchQuery} />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Handoff Summary</p>
                    <div className="space-y-2 rounded border border-bg-border bg-bg-base p-3 text-xs leading-relaxed text-text-primary">
                      <SummaryTextRow label="resultStatus" value={handoffPayload?.resultStatus ?? null} query={searchQuery} />
                      <SummaryListRow label="CURRENT STATE" items={handoffPayload?.currentState ?? []} query={searchQuery} />
                      <SummaryTextRow label="recommendedNextDecision" value={handoffPayload?.recommendedNextDecision ?? null} query={searchQuery} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">GPT Bridge Payload</p>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-base p-4 text-[11px] leading-relaxed text-text-primary">
                      <HighlightedText text={handoffPayload?.bridgePayloadText ?? 'No bridge payload recorded.'} query={searchQuery} />
                    </pre>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Copy Ready Text</p>
                      {selectedHandoffArtifact.copyReadyText ? <CopyTextButton text={selectedHandoffArtifact.copyReadyText} label="Copy ready text" /> : null}
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-base p-4 text-[11px] leading-relaxed text-text-primary">
                      <HighlightedText text={selectedHandoffArtifact.copyReadyText ?? 'No copy ready text recorded.'} query={searchQuery} />
                    </pre>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Raw Handoff Payload</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-base p-4 text-[11px] leading-relaxed text-text-primary">
                      <HighlightedText text={rawHandoffPayloadText ?? 'No handoff payload recorded.'} query={searchQuery} />
                    </pre>
                  </div>
                </div>
              </section>
            ) : selectedConversationId ? (
              <section>
                <h3 className="section-label">GPT HANDOFF</h3>
                <div className="rounded border border-bg-border bg-bg-surface p-4 text-xs leading-relaxed text-text-secondary">
                  No persisted HANDOFF artifact was found in PostgreSQL for conversation {selectedConversationId}.
                </div>
              </section>
            ) : null}

            <section>
              <h3 className="section-label">Full Conversation</h3>
              {canonicalConversationView ? (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                  <HighlightedText text={canonicalConversationView} query={searchQuery} />
                </pre>
              ) : (
                <div className="rounded border border-bg-border bg-bg-surface p-4 text-xs leading-relaxed text-text-secondary">
                  No linked conversation record was found for this event in the current PostgreSQL-backed lookup.
                </div>
              )}
            </section>

            {selectedRecord.rawJson !== null && (
              <section>
                <h3 className="section-label">Raw JSON</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-bg-border bg-bg-surface p-4 text-[11px] leading-relaxed text-text-primary">
                  <HighlightedText text={rawJsonText ?? ''} query={searchQuery} />
                </pre>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

function MetaRow({ label, value, query }: { label: string; value: string; query: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3">
      <span className="font-mono text-text-tertiary">{label}</span>
      <span className="break-all font-mono text-text-primary">
        <HighlightedText text={value} query={query} />
      </span>
    </div>
  )
}

function SummaryTextRow({ label, value, query }: { label: string; value: string | null; query: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-text-tertiary">{label}</p>
      <div className="rounded border border-bg-border bg-bg-surface p-3 text-text-primary">
        <HighlightedText text={value ?? 'Not recorded.'} query={query} />
      </div>
    </div>
  )
}

function SummaryListRow({ label, items, query }: { label: string; items: string[]; query: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-text-tertiary">{label}</p>
      <div className="rounded border border-bg-border bg-bg-surface p-3 text-text-primary">
        {items.length > 0 ? (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={`${label}-${item}`} className="flex gap-2">
                <span className="text-text-tertiary">-</span>
                <span><HighlightedText text={item} query={query} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <span>Not recorded.</span>
        )}
      </div>
    </div>
  )
}

function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-bg-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-bg-hover hover:text-text-primary"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}