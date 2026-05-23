import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs = await db.executionLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tags: { include: { tag: true } },
      nodes: { include: { node: { select: { id: true, title: true } } } },
    },
  })

  return NextResponse.json({ logs }, { status: 200 })
}
