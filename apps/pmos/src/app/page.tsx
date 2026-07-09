import { EventLedgerTable } from '@/components/event-ledger/EventLedgerTable'
import { eventLedgerQuery } from '@/lib/event-ledger-query'

export const dynamic = 'force-dynamic'

export default async function EventLedgerPage() {
  try {
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
  } catch (error) {
    const message = getRuntimeErrorMessage(error)
    const digest = getErrorDigest(error)

    console.error('PMOS Event Ledger runtime failure', error)

    return (
      <div className="flex h-full flex-col px-6 py-5">
        <div className="mb-6 flex items-end justify-between gap-6 border-b border-bg-border pb-5">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">PMOS Event Ledger</h1>
            <p className="mt-1 text-sm text-text-secondary">Runtime diagnostics for the PostgreSQL-backed event feed.</p>
          </div>
          <div className="text-right font-mono text-xs text-text-secondary">
            <div>{new Date().toISOString()}</div>
            <div className="mt-1 text-text-tertiary">runtime guard active</div>
          </div>
        </div>

        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-text-primary">
          <h2 className="text-base font-semibold text-text-primary">PMOS could not load Event Ledger data.</h2>
          <p className="mt-2 text-text-secondary">{message}</p>
          <p className="mt-3 text-text-secondary">
            Verify the Render service environment first: <span className="font-mono">DATABASE_URL</span> must be present and non-empty, and the PMOS database must be reachable from the deployed runtime.
          </p>
          {digest ? (
            <p className="mt-3 font-mono text-xs text-text-tertiary">Digest: {digest}</p>
          ) : null}
        </div>
      </div>
    )
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-bg-border bg-bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</div>
      <div className="mt-1 font-mono text-2xl text-text-primary">{value}</div>
    </div>
  )
}

function getRuntimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('You must provide a nonempty URL')) {
      return 'PMOS cannot connect to PostgreSQL because DATABASE_URL is missing or empty in the runtime environment.'
    }

    return error.message
  }

  return 'Unknown server-side failure while loading Event Ledger data.'
}

function getErrorDigest(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const digest = (error as { digest?: unknown }).digest
  return typeof digest === 'string' && digest.length > 0 ? digest : null
}