import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/conversations?q=...&etap=...&type=...&importance=...&page=1
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim() ?? ''
  const etap = sp.get('etap')?.trim() ?? ''
  const type = sp.get('type')?.trim() ?? ''
  const importance = sp.get('importance')?.trim() ?? ''
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const take = 20
  const skip = (page - 1) * take

  // Build where clause
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
      orderBy: { timestamp: 'desc' },
      skip,
      take,
      include: {
        linkedDecisions: { include: { decision: { select: { id: true, title: true, number: true } } } },
        linkedWarnings: { include: { warning: { select: { id: true, title: true, severity: true } } } },
        linkedNodes: { include: { node: { select: { id: true, title: true, status: true } } } },
        linkedLogs: { include: { log: { select: { id: true, title: true } } } },
        linkedPrinciples: { include: { principle: { select: { id: true, title: true } } } },
        linkedPrompts: { include: { promptExecution: { select: { id: true, title: true, status: true } } } },
      },
    }),
  ])

  return NextResponse.json({ conversations, total, page, pageSize: take })
}

// POST /api/conversations — create from sync script
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      conversation_id,
      timestamp,
      project,
      task_id,
      etap,
      subetap,
      domains,
      conversation_type,
      importance_level,
      user_prompt,
      llm_response,
      summary,
      linked_entities,
      chronology_order,
      tags,
    } = body

    if (!conversation_id || !user_prompt || !summary) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const artifact = await db.conversationArtifact.create({
      data: {
        conversationId: conversation_id,
        timestamp: new Date(timestamp),
        project: project ?? 'project',
        taskId: task_id ?? null,
        etap: etap ?? null,
        subetap: subetap ?? null,
        domains: domains ?? [],
        conversationType: conversation_type ?? 'implementation',
        importanceLevel: importance_level ?? 'medium',
        userPrompt: user_prompt,
        llmResponse: llm_response ?? '',
        summary,
        tags: tags ?? [],
        chronologyOrder: chronology_order ?? 0,
      },
    })

    return NextResponse.json({ id: artifact.id, conversation_id: artifact.conversationId }, { status: 201 })
  } catch (err) {
    console.error('[conversations POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
