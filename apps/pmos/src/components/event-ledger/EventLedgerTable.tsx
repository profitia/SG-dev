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

export function EventLedgerTable({ events, sourceRecords }: EventLedgerTableProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )
  const selectedRecord = selectedEvent ? sourceRecords[selectedEvent.id] ?? null : null

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