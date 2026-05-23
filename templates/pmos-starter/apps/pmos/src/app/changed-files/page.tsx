import { db } from '@/lib/db'
import { ChangedFilesClient } from '@/components/files/ChangedFilesClient'

export const dynamic = 'force-dynamic'

export default async function ChangedFilesPage() {
  const files = await db.changedFile.findMany({
    orderBy: [
      { impactLevel: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      promptExecution: { select: { id: true, title: true, etap: true } },
      executionLog: { select: { id: true, title: true } },
    },
  })

  const criticalCount = files.filter((f) => f.impactLevel === 'critical').length
  const highCount = files.filter((f) => f.impactLevel === 'high').length

  return (
    <div className="min-h-full px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-text-primary text-xl font-semibold mb-1">Changed Files</h1>
          <p className="text-text-tertiary text-sm">
            Structured file-level execution memory — searchable and filterable
          </p>
        </div>
      </div>

      {/* Stats */}
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
            <span className="text-text-primary font-medium">{files.length}</span> total
          </span>
        </div>
      </div>

      <ChangedFilesClient files={files as Parameters<typeof ChangedFilesClient>[0]['files']} />
    </div>
  )
}
