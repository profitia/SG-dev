import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const nodeId = searchParams.get('nodeId')

  const prompts = await db.promptExecution.findMany({
    where: {
      ...(status ? { status: status as 'queued' | 'running' | 'completed' | 'failed' | 'archived' } : {}),
      ...(nodeId ? { roadmapNodeId: nodeId } : {}),
    },
    include: {
      roadmapNode: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(prompts)
}

export async function POST(req: Request) {
  const body = await req.json()

  const prompt = await db.promptExecution.create({
    data: {
      title: body.title,
      etap: body.etap ?? null,
      subetap: body.subetap ?? null,
      node: body.node ?? null,
      domain: body.domain ?? null,
      promptType: body.promptType ?? null,
      promptContent: body.promptContent,
      executionSummary: body.executionSummary ?? null,
      architecturalImpact: body.architecturalImpact ?? null,
      changedFiles: body.changedFiles ?? [],
      blockers: body.blockers ?? null,
      nextSteps: body.nextSteps ?? null,
      status: body.status ?? 'completed',
      roadmapNodeId: body.roadmapNodeId ?? null,
    },
  })

  return NextResponse.json(prompt, { status: 201 })
}
