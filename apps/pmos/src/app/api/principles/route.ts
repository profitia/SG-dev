import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const principles = await db.canonicalPrinciple.findMany({
    include: {
      nodes: { include: { node: { select: { id: true, title: true } } } },
      decisions: { include: { decision: { select: { id: true, title: true } } } },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(principles)
}
