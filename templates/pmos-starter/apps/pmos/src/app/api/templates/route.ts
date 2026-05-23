import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const templates = await db.promptTemplate.findMany({
    orderBy: [{ templateType: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(templates)
}
