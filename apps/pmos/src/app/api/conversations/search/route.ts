import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/conversations/search?q=...
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ conversations: [] })
  }

  const conversations = await db.conversationArtifact.findMany({
    where: {
      OR: [
        { summary: { contains: q, mode: 'insensitive' } },
        { userPrompt: { contains: q, mode: 'insensitive' } },
        { llmResponse: { contains: q, mode: 'insensitive' } },
        { taskId: { contains: q, mode: 'insensitive' } },
        { etap: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 8,
    select: {
      id: true,
      conversationId: true,
      timestamp: true,
      summary: true,
      conversationType: true,
      importanceLevel: true,
      etap: true,
      taskId: true,
    },
  })

  return NextResponse.json({ conversations })
}
