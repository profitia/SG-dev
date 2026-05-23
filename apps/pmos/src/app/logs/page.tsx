import { db } from '@/lib/db'
import { LogList } from '@/components/logs/LogList'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getLogs() {
  return db.executionLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tags: { include: { tag: true } },
      nodes: { include: { node: { select: { id: true, title: true } } } },
    },
  })
}

export default async function LogsPage() {
  const logs = await getLogs()

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
        <div className="flex items-baseline gap-3">
          <h1 className="text-text-primary text-sm font-semibold">Execution Logs</h1>
          <span className="text-text-tertiary text-2xs font-mono">{logs.length} total</span>
        </div>
        <Link
          href="/logs/new"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-accent/10 text-accent text-2xs font-medium hover:bg-accent/20 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add log
        </Link>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-text-secondary text-sm">No execution logs yet.</p>
            <Link href="/logs/new" className="mt-3 text-accent text-2xs hover:underline">
              Log first execution
            </Link>
          </div>
        ) : (
          <LogList logs={logs} />
        )}
      </div>
    </div>
  )
}

