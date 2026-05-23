import { db } from '@/lib/db'
import { NewDecisionForm } from '@/components/decisions/NewDecisionForm'

export const dynamic = 'force-dynamic'

async function getRoadmapNodes() {
  return db.roadmapNode.findMany({
    orderBy: { order: 'asc' },
    select: { id: true, title: true },
  })
}

export default async function NewDecisionPage() {
  const nodes = await getRoadmapNodes()
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <h1 className="text-text-primary text-lg font-medium">New Decision</h1>
        <p className="text-text-secondary text-sm mt-0.5">ADR-lite architectural decision record</p>
      </div>
      <div className="px-8 py-8 max-w-2xl">
        <NewDecisionForm nodes={nodes} />
      </div>
    </div>
  )
}
