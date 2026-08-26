import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { resolveBenchmarkAnalyticsEligibility } from '@/lib/benchmark/analytics'
import { withCognitionAuth, parseSearchParams, cognitionError, cognitionOk } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  locale: z.enum(['pl', 'en']),
  seriesId: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
})

export const GET = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  const eligibility = await resolveBenchmarkAnalyticsEligibility(
    parsed.data.locale,
    parsed.data.seriesId,
    parsed.data.displayName,
  )
  return cognitionOk(eligibility)
})