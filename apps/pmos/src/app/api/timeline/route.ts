import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [prompts, logs, decisions, warnings] = await Promise.all([
    db.promptExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        roadmapNode: { select: { id: true, title: true } },
        changedFileEntries: { select: { id: true, path: true, changeType: true, impactLevel: true } },
      },
    }),
    db.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        nodes: { include: { node: { select: { id: true, title: true } } } },
        changedFileEntries: { select: { id: true, path: true, changeType: true, impactLevel: true } },
      },
    }),
    db.decision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, decision: true, createdAt: true },
    }),
    db.architectureWarning.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, severity: true, type: true, createdAt: true },
    }),
  ])

  // Merge and sort by date
  const events = [
    ...prompts.map((p) => ({ type: 'prompt' as const, date: p.createdAt, data: p })),
    ...logs.map((l) => ({ type: 'log' as const, date: l.createdAt, data: l })),
    ...decisions.map((d) => ({ type: 'decision' as const, date: d.createdAt, data: d })),
    ...warnings.map((w) => ({ type: 'warning' as const, date: w.createdAt, data: w })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json(events)
}
