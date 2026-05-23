import { db } from '@/lib/db'
import Link from 'next/link'
import { ConversationList } from '@/components/conversations/ConversationList'
import { ConversationFilters } from '@/components/conversations/ConversationFilters'

export const dynamic = 'force-dynamic'

const IMPORTANCE_ORDER: Record<string, number> = {
  foundational: 0,
  high: 1,
  medium: 2,
  low: 3,
}

async function getConversations(searchParams: Record<string, string | undefined>) {
  const q = searchParams.q?.trim() ?? ''
  const etap = searchParams.etap?.trim() ?? ''
  const type = searchParams.type?.trim() ?? ''
  const importance = searchParams.importance?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const take = 25
  const skip = (page - 1) * take

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (q.length >= 2) {
    where.OR = [
      { userPrompt: { contains: q, mode: 'insensitive' } },
      { llmResponse: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { taskId: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (etap) where.etap = { contains: etap, mode: 'insensitive' }
  if (type) where.conversationType = type
  if (importance) where.importanceLevel = importance

  const [total, conversations] = await Promise.all([
    db.conversationArtifact.count({ where }),
    db.conversationArtifact.findMany({
      where,
      orderBy: [{ timestamp: 'desc' }],
      skip,
      take,
      include: {
        linkedDecisions: { include: { decision: { select: { id: true, title: true, number: true } } } },
        linkedWarnings: { include: { warning: { select: { id: true, title: true, severity: true } } } },
        linkedNodes: { include: { node: { select: { id: true, title: true } } } },
        linkedPrinciples: { include: { principle: { select: { id: true, title: true } } } },
      },
    }),
  ])

  return { conversations, total, page, take }
}

async function getStats() {
  const [total, foundational, high, byType] = await Promise.all([
    db.conversationArtifact.count(),
    db.conversationArtifact.count({ where: { importanceLevel: 'foundational' } }),
    db.conversationArtifact.count({ where: { importanceLevel: 'high' } }),
    db.conversationArtifact.groupBy({ by: ['conversationType'], _count: true }),
  ])
  return { total, foundational, high, byType }
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>
}) {
  const [{ conversations, total, page, take }, stats] = await Promise.all([
    getConversations(searchParams),
    getStats(),
  ])

  const totalPages = Math.ceil(total / take)

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-lg font-medium">Conversations</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {total} cognition artifacts
              {stats.foundational > 0 && (
                <span className="ml-2 text-accent/70">· {stats.foundational} foundational</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-xs">
              trigger: <code className="bg-bg-surface border border-bg-border rounded px-1.5 py-0.5 text-accent font-mono">memory</code>
            </span>
          </div>
        </div>

        {/* Stats bar */}
        {stats.total > 0 && (
          <div className="flex items-center gap-4 mt-4">
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Foundational" value={stats.foundational} accent />
            <StatPill label="High" value={stats.high} />
            {stats.byType.slice(0, 4).map((t) => (
              <StatPill key={t.conversationType} label={t.conversationType.replace('_', ' ')} value={t._count} />
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-8 pt-5">
        <ConversationFilters currentFilters={searchParams} />
      </div>

      {/* Content */}
      <div className="px-8 py-4">
        {conversations.length === 0 ? (
          <EmptyState hasFilters={!!(searchParams.q || searchParams.etap || searchParams.type || searchParams.importance)} />
        ) : (
          <ConversationList conversations={conversations} />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 pb-4">
            {page > 1 && (
              <Link
                href={buildHref(searchParams, page - 1)}
                className="px-3 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-secondary hover:text-text-primary hover:border-bg-hover transition-colors"
              >
                ← Previous
              </Link>
            )}
            <span className="text-text-tertiary text-xs">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildHref(searchParams, page + 1)}
                className="px-3 py-1.5 rounded text-xs bg-bg-surface border border-bg-border text-text-secondary hover:text-text-primary hover:border-bg-hover transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-medium ${accent ? 'text-accent' : 'text-text-tertiary'}`}>{label}</span>
      <span className={`text-xs font-semibold ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</span>
    </div>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-10 h-10 rounded-full bg-bg-surface border border-bg-border flex items-center justify-center mb-4">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-text-muted">
          <path d="M3 3.5h12M3 7.5h8M3 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13 10l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {hasFilters ? (
        <>
          <p className="text-text-secondary text-sm">No conversations match your filters.</p>
          <Link href="/conversations" className="mt-3 text-accent text-sm hover:underline">Clear filters</Link>
        </>
      ) : (
        <>
          <p className="text-text-secondary text-sm">No conversation artifacts yet.</p>
          <p className="text-text-tertiary text-xs mt-1">
            Type <code className="font-mono bg-bg-surface border border-bg-border rounded px-1">memory</code> after an important task to persist it.
          </p>
        </>
      )}
    </div>
  )
}

function buildHref(searchParams: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams()
  if (searchParams.q) params.set('q', searchParams.q)
  if (searchParams.etap) params.set('etap', searchParams.etap)
  if (searchParams.type) params.set('type', searchParams.type)
  if (searchParams.importance) params.set('importance', searchParams.importance)
  params.set('page', String(page))
  return `/conversations?${params.toString()}`
}
