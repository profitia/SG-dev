import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const decisions = await db.decision.findMany({
    orderBy: { number: 'desc' },
    include: {
      nodes: { include: { node: { select: { id: true, title: true } } } },
    },
  })

  return NextResponse.json({ decisions }, { status: 200 })
}
