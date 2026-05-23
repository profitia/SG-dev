import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ roadmap: [], logs: [], prompts: [], decisions: [], warnings: [], principles: [], files: [], conversations: [] })
  }

  const [roadmap, logs, prompts, decisions, warnings, principles, files, conversations] = await Promise.all([
    db.roadmapNode.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true, status: true, scope: true },
      orderBy: { order: 'asc' },
      take: 5,
    }),
    db.executionLog.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.promptExecution.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { executionSummary: { contains: q, mode: 'insensitive' } },
          { node: { contains: q, mode: 'insensitive' } },
          { domain: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, status: true, etap: true, subetap: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.decision.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { decision: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, decision: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.architectureWarning.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { affectedArea: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, severity: true, resolved: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.canonicalPrinciple.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, priority: true },
      orderBy: { priority: 'asc' },
      take: 5,
    }),
    db.changedFile.findMany({
      where: {
        OR: [
          { path: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, path: true, changeType: true, impactLevel: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.conversationArtifact.findMany({
      where: {
        OR: [
          { summary: { contains: q, mode: 'insensitive' } },
          { userPrompt: { contains: q, mode: 'insensitive' } },
          { taskId: { contains: q, mode: 'insensitive' } },
          { etap: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, summary: true, conversationType: true, importanceLevel: true, etap: true },
      orderBy: { timestamp: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({ roadmap, logs, prompts, decisions, warnings, principles, files, conversations })
}
