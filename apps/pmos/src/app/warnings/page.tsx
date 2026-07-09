import { db } from '@/lib/db'
import { WarningList } from '@/components/warnings/WarningList'
import Link from 'next/link'
import { buildCanonicalConversationReadModel } from '@/lib/pmos/flight-record-read'

export const dynamic = 'force-dynamic'

export default async function WarningsPage() {
  const warnings = await db.architectureWarning.findMany({
    where: { resolved: false },
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      type: true,
      affectedArea: true,
      resolved: true,
      resolvedAt: true,
      relatedLogId: true,
      relatedPrincipleId: true,
      createdAt: true,
      relatedLog: { select: { id: true, title: true } },
      conversations: {
        include: {
          conversation: {
            select: { id: true, conversationType: true, importanceLevel: true, timestamp: true, flightRecordJson: true },
          },
        },
        orderBy: { conversation: { timestamp: 'desc' } },
        take: 3,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const canonicalWarnings = warnings.map((warning) => ({
    ...warning,
    conversations: warning.conversations.map(({ conversation }) => {
      const canonical = buildCanonicalConversationReadModel(conversation.flightRecordJson)
      return {
        conversation: {
          id: conversation.id,
          summary: canonical.analysis.reasoningSummary ?? 'Canonical flight record unavailable.',
          conversationType: canonical.metadata.conversationType ?? conversation.conversationType ?? 'unknown',
          importanceLevel: canonical.metadata.importanceLevel ?? conversation.importanceLevel ?? 'medium',
          timestamp: canonical.metadata.timestamp ? new Date(canonical.metadata.timestamp) : conversation.timestamp,
        },
      }
    }),
  }))

  const resolved = await db.architectureWarning.count({ where: { resolved: true } })

  const criticalCount = warnings.filter((w) => w.severity === 'critical').length
  const highCount = warnings.filter((w) => w.severity === 'high').length

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-text-primary text-xl font-semibold mb-1">Architecture Warnings</h1>
            <p className="text-text-tertiary text-sm">
              Active risks, boundary violations, and architectural drift signals.
            </p>
          </div>
          <Link
            href="/warnings/new"
            className="px-3 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent/90 transition-colors"
          >
            + Add warning
          </Link>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-8 pb-6 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-text-secondary text-sm">
              <span className="text-text-primary font-medium">{criticalCount}</span> critical
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-text-secondary text-sm">
              <span className="text-text-primary font-medium">{highCount}</span> high
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neutral-500" />
            <span className="text-text-secondary text-sm">
              <span className="text-text-primary font-medium">{resolved}</span> resolved
            </span>
          </div>
        </div>

        {warnings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-tertiary text-sm">No active warnings.</p>
          </div>
        ) : (
          <WarningList warnings={canonicalWarnings} />
        )}
      </div>
    </div>
  )
}
