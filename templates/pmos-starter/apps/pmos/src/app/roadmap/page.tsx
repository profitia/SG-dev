import { db } from '@/lib/db'
import { RoadmapView } from '@/components/roadmap/RoadmapView'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getRoadmapRoots() {
  return db.roadmapNode.findMany({
    where: { parentId: null },
    orderBy: { sortKey: 'asc' },
    include: {
      children: {
        orderBy: { order: 'asc' },
        include: {
          children: {
            orderBy: { order: 'asc' },
            include: {
              tags: { include: { tag: true } },
              _count: { select: { logs: true, decisions: true } },
            },
          },
          tags: { include: { tag: true } },
          _count: { select: { logs: true, decisions: true } },
        },
      },
      tags: { include: { tag: true } },
      _count: { select: { logs: true, decisions: true } },
    },
  })
}

export default async function RoadmapPage() {
  const nodes = await getRoadmapRoots()

  const totalNodes = nodes.reduce(
    (acc, n) => acc + 1 + n.children.length + n.children.reduce((a, c) => a + c.children.length, 0),
    0
  )
  const doneNodes = nodes.reduce((acc, n) => {
    const all = [n, ...n.children, ...n.children.flatMap((c) => c.children)]
    return acc + all.filter((x) => x.status === 'done').length
  }, 0)

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
        <div className="flex items-baseline gap-3">
          <h1 className="text-text-primary text-sm font-semibold">Roadmap</h1>
          <span className="text-text-tertiary text-2xs font-mono">{doneNodes}/{totalNodes} done</span>
        </div>
        <Link
          href="/roadmap/new"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-accent/10 text-accent text-2xs font-medium hover:bg-accent/20 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add node
        </Link>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-secondary text-sm">No roadmap nodes yet.</p>
            <Link href="/roadmap/new" className="mt-3 text-accent text-2xs hover:underline">
              Create first node
            </Link>
          </div>
        ) : (
          <RoadmapView nodes={nodes as Parameters<typeof RoadmapView>[0]['nodes']} />
        )}
      </div>
    </div>
  )
}
