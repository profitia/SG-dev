import { db } from '@/lib/db'
import { NewWarningForm } from '@/components/warnings/NewWarningForm'

export const dynamic = 'force-dynamic'

export default async function NewWarningPage() {
  const nodes = await db.roadmapNode.findMany({
    select: { id: true, title: true },
    orderBy: { order: 'asc' },
  })

  const logs = await db.executionLog.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-text-primary text-xl font-semibold mb-1">New Architecture Warning</h1>
          <p className="text-text-tertiary text-sm">
            Document an architectural risk, boundary violation, or drift signal.
          </p>
        </div>
        <NewWarningForm nodes={nodes} logs={logs} />
      </div>
    </div>
  )
}
