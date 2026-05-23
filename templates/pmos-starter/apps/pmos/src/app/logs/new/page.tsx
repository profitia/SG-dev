import { db } from '@/lib/db'
import { NewLogForm } from '@/components/logs/NewLogForm'

export const dynamic = 'force-dynamic'

async function getRoadmapNodes() {
  return db.roadmapNode.findMany({
    orderBy: [{ order: 'asc' }],
    select: { id: true, title: true, parentId: true },
  })
}

async function getTags() {
  return db.tag.findMany({ orderBy: { name: 'asc' } })
}

export default async function NewLogPage() {
  const [nodes, tags] = await Promise.all([getRoadmapNodes(), getTags()])
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <h1 className="text-text-primary text-lg font-medium">New Execution Log</h1>
        <p className="text-text-secondary text-sm mt-0.5">Record a VSC/Copilot execution</p>
      </div>
      <div className="px-8 py-8 max-w-3xl">
        <NewLogForm nodes={nodes} tags={tags} />
      </div>
    </div>
  )
}
