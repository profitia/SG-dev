import { createInternalProductionForecastRouteHandler } from '@/lib/forecast/route-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createInternalProductionForecastRouteHandler()