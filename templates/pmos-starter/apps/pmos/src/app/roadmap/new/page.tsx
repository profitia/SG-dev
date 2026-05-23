import { db } from '@/lib/db'
import { NewNodeForm } from '@/components/roadmap/NewNodeForm'

export const dynamic = 'force-dynamic'

async function getParentOptions() {
  return db.roadmapNode.findMany({
    where: { parentId: null },
    orderBy: { order: 'asc' },
    select: { id: true, title: true },
  })
}

export default async function NewRoadmapNodePage() {
  const parents = await getParentOptions()
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 bg-bg-base/95 backdrop-blur border-b border-bg-border px-8 py-5">
        <h1 className="text-text-primary text-lg font-medium">New Roadmap Node</h1>
      </div>
      <div className="px-8 py-8 max-w-2xl">
        <NewNodeForm parents={parents} />
      </div>
    </div>
  )
}
