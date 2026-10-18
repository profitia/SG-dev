import { NextRequest, type NextResponse } from 'next/server'
import { z } from 'zod'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import { cognitionError, cognitionOk, privateApiResponse } from '@/lib/api/middleware'
import { getSg2SelectionRuntime, validateNativeDashboardBinding, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { MARKET_ANALYTICS_PROJECTION, marketAnalyticsResourceId } from '@/lib/platform/market-preview'
import { buildDashboardPreviewAnalyticsUrl } from './analytics'
import { createRuntimeBenchmarkAnalyticsHandler } from './analytics-handlers'

const selection = z.object({ locale: z.enum(['pl', 'en']),
  seriesId: z.string().trim().min(1).max(256).regex(/^[a-z0-9_./-]+$/i),
  displayName: z.string().trim().min(1).max(4096).optional(), organisationId: z.string().uuid().optional(),
}).strict()
const refuse = (status: number) => privateApiResponse(cognitionError(status === 400 ? 'VALIDATION_ERROR' : 'OPERATION_DENIED', 'Analytics is unavailable.', status))

/** Reuses the existing native read/audit pipeline. This only advertises a
 * scoped view; it never schedules preparation or assumes child UI readiness. */
export function createRuntimeAnalyticsEligibilityHandler(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (request.method !== 'GET') {
      const response = refuse(405)
      response.headers.set('Allow', 'GET')
      return response
    }
    const query = new URL(request.url).searchParams
    if ([...new Set(query.keys())].some(key => query.getAll(key).length !== 1)) return refuse(400)
    const parsed = selection.safeParse(Object.fromEntries(query))
    if (!parsed.success) return refuse(400)
    try {
      const runtime = resolveRuntime()
      if (runtime.provider !== 'clerk' || !runtime.marketRead?.analytics || !runtime.dashboardEmbed) return refuse(503)
      const binding = validateNativeDashboardBinding(runtime.dashboardEmbed)
      const sourceUrl = new URL('/api/benchmark/analytics-series', request.url)
      sourceUrl.searchParams.set('seriesId', parsed.data.seriesId); sourceUrl.searchParams.set('range', '1Y')
      if (parsed.data.organisationId) sourceUrl.searchParams.set('organisationId', parsed.data.organisationId)
      const response = await createRuntimeBenchmarkAnalyticsHandler(() => runtime)(
        new NextRequest(sourceUrl, { method: 'GET', headers: request.headers, signal: request.signal }))
      if (response.status !== 200) return refuse([400, 401, 403, 404, 409, 413, 429, 503].includes(response.status) ? response.status : 503)
      if (response.headers.get('x-profitia-operation-contract') !== `${OPERATION_CONTRACT.id}@${OPERATION_CONTRACT.version}`
        || response.headers.get('x-profitia-application') !== binding.applicationId
        || response.headers.get('x-profitia-environment') !== binding.environment
        || response.headers.get('x-profitia-market-projection') !== MARKET_ANALYTICS_PROJECTION
        || response.headers.get('x-profitia-market-resource') !== marketAnalyticsResourceId(parsed.data.seriesId)) return refuse(503)
      const body = await response.json()
      if (body?.providerSeries?.providerSeriesId !== parsed.data.seriesId || body.range !== '1Y') return refuse(503)
      const url = new URL(buildDashboardPreviewAnalyticsUrl(parsed.data.locale, parsed.data.seriesId, parsed.data.displayName,
        { warmCurrentForecast: false, forecastPortfolioEnabled: true, preparedReadsOnly: true }, binding.origin))
      // Routing context, not authority: every downstream read must revalidate
      // this organisation with the current authenticated account and profile.
      url.searchParams.set('organisationId', parsed.data.organisationId ?? runtime.defaultOrganisationId)
      return privateApiResponse(cognitionOk({ eligible: true, componentCode: null, analyticsUrl: url.toString(), forecastPortfolioEnabled: true }))
    } catch { return refuse(503) }
  }
}
