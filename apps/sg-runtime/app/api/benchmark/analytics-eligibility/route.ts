import { createRuntimeAnalyticsEligibilityHandler } from '@/lib/benchmark/analytics-eligibility-handlers'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

import {
  FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM,
  resolveBenchmarkAnalyticsEligibility,
} from '@/lib/benchmark/analytics'
import { withCognitionAuth, parseSearchParams, cognitionError, cognitionOk } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  locale: z.enum(['pl', 'en']),
  seriesId: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
  [FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM]: z.enum(['single']).optional(),
})

type AnalyticsEligibilityResolver = typeof resolveBenchmarkAnalyticsEligibility

function createAnalyticsEligibilityRouteHandler(
  resolver: AnalyticsEligibilityResolver = resolveBenchmarkAnalyticsEligibility,
) {
  return async function GET(request: NextRequest) {
    const parsed = parseSearchParams(request, QuerySchema)
    if (!parsed.ok) {
      return cognitionError('VALIDATION_ERROR', parsed.message, 400)
    }

    const eligibility = await resolver(
      parsed.data.locale,
      parsed.data.seriesId,
      parsed.data.displayName,
      parsed.data[FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM] === 'single'
        ? { warmCurrentForecast: true }
        : undefined,
    )
    return cognitionOk(eligibility)
  }
}

const legacyGET = withCognitionAuth(async (_auth, request: NextRequest) => createAnalyticsEligibilityRouteHandler()(request))
const nativeGET = createRuntimeAnalyticsEligibilityHandler()
export const GET = (request: NextRequest) => (process.env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo') === 'legacy_demo' ? legacyGET(request) : nativeGET(request)
