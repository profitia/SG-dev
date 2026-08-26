import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { runBenchmarkAiSearch } from '@/lib/benchmark/ai-search'
import { cognitionError, cognitionOk, parseJsonBody, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  prompt: z.string().trim().min(3).max(500),
})

export const POST = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const payload = await runBenchmarkAiSearch(parsed.data.prompt)
    return cognitionOk(payload)
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }

    return cognitionError(
      'INTERNAL_ERROR',
      'AI-assisted search is temporarily unavailable. You can still search benchmarks manually.',
      500,
    )
  }
})