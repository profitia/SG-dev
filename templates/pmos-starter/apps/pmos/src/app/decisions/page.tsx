import { db } from '@/lib/db'
import { DecisionList } from '@/components/decisions/DecisionList'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getDecisions() {
  return db.decision.findMany({
    orderBy: { number: 'desc' },
    include: {
      nodes: {
        include: { node: { select: { id: true, title: true } } },
      },
      conversations: {
        include: {
          conversation: {
            select: { id: true, summary: true, conversationType: true, importanceLevel: true, timestamp: true },
          },
        },
        orderBy: { conversation: { timestamp: 'desc' } },
        take: 5,
      },
    },
  })
}

export default async function DecisionsPage() {
  const decisions = await getDecisions()

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-lg font-medium">Decisions</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {decisions.length} ADR records
            </p>
          </div>
          <Link
            href="/decisions/new"
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-accent/10 text-accent text-sm hover:bg-accent/20 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add decision
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-text-secondary text-sm">No architectural decisions recorded yet.</p>
            <Link href="/decisions/new" className="mt-4 text-accent text-sm hover:underline">
              Record first decision
            </Link>
          </div>
        ) : (
          <DecisionList decisions={decisions} />
        )}
      </div>
    </div>
  )
}
