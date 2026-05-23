import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const resolved = searchParams.get('resolved') === 'true'

  const warnings = await db.architectureWarning.findMany({
    where: { resolved },
    include: {
      relatedLog: { select: { id: true, title: true } },
      relatedRoadmapNode: { select: { id: true, title: true } },
    },
    orderBy: [
      { severity: 'asc' }, // critical first (alphabetical: critical < high < low < medium)
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json({ warnings })
}

export async function POST(req: Request) {
  const body = await req.json()

  const warning = await db.architectureWarning.create({
    data: {
      title: body.title,
      description: body.description,
      severity: body.severity ?? 'medium',
      type: body.type,
      affectedArea: body.affectedArea ?? null,
      relatedLogId: body.relatedLogId ?? null,
      relatedRoadmapNodeId: body.relatedRoadmapNodeId ?? null,
    },
  })

  return NextResponse.json({ warning }, { status: 201 })
}
