import { EventLedgerTable } from '@/components/event-ledger/EventLedgerTable'
import { eventLedgerQuery } from '@/lib/event-ledger-query'

export const dynamic = 'force-dynamic'

export default async function EventLedgerPage() {
  const { events, stats, sourceRecords, handoffArtifactsByConversationId } = await eventLedgerQuery()
  const serializedEvents = events.map((event) => ({
    ...event,
    timestamp: event.timestamp.toISOString(),
  }))
  const serializedSourceRecords = JSON.parse(JSON.stringify(sourceRecords))
  const serializedHandoffArtifactsByConversationId = JSON.parse(JSON.stringify(handoffArtifactsByConversationId))

  return (
    <div className="flex h-full flex-col px-6 py-5">
      <div className="mb-6 flex items-end justify-between gap-6 border-b border-bg-border pb-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">PMOS Event Ledger</h1>
          <p className="mt-1 text-sm text-text-secondary">Database-first event feed from PostgreSQL only.</p>
        </div>
        <div className="text-right font-mono text-xs text-text-secondary">
          <div>{new Date().toISOString()}</div>
          <div className="mt-1 text-text-tertiary">source of truth: PostgreSQL</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-5 gap-3">
        <StatCard label="Events" value={stats.eventCount} />
        <StatCard label="Tasks" value={stats.taskCount} />
        <StatCard label="Conversations" value={stats.conversationCount} />
        <StatCard label="Closeouts" value={stats.closeoutCount} />
        <StatCard label="Execution Trails" value={stats.executionTrailCount} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label mb-0">Event Ledger</h2>
        <span className="font-mono text-xs text-text-tertiary">{serializedEvents.length} rows</span>
      </div>

      <EventLedgerTable
        events={serializedEvents}
        sourceRecords={serializedSourceRecords}
        handoffArtifactsByConversationId={serializedHandoffArtifactsByConversationId}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-bg-border bg-bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-2xl text-text-primary">{value}</div>
    </div>
  )
}