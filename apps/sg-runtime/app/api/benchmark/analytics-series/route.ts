import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getBenchmarkAnalyticsSeries } from '@/lib/benchmark/service'
import { cognitionError, cognitionOk, parseSearchParams } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  seriesId: z.string().trim().min(1),
  range: z.enum(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']).default('1Y'),
})

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const series = await getBenchmarkAnalyticsSeries(parsed.data.seriesId, parsed.data.range ?? '1Y')
    return cognitionOk(series)
  } catch (error) {
    return cognitionError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Benchmark analytics series failed.',
      500,
    )
  }
}