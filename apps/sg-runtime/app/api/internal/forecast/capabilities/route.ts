import { createInternalForecastCapabilitiesRouteHandler } from '@/lib/forecast/interactive-route-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createInternalForecastCapabilitiesRouteHandler()