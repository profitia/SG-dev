import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getBenchmarkPreview } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { withCognitionAuth, parseSearchParams, cognitionError, cognitionOk } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  seriesName: z.string().trim().min(1),
  range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']).default('1Y'),
})

export const GET = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const preview = await getBenchmarkPreview(parsed.data.seriesName, parsed.data.range ?? '1Y')
    return cognitionOk(preview)
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }
    return cognitionError('INTERNAL_ERROR', 'Benchmark preview failed.', 500)
  }
})