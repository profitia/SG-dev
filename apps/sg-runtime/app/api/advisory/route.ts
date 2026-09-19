import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runSpendGuruAdvisory } from '@/lib/advisory/cic-adapter'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  locale: z.enum(['pl', 'en']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })).min(1).max(8),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  return NextResponse.json(runSpendGuruAdvisory(parsed.data))
}
