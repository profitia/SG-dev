import { createInternalCurrentForecastPreparationRouteHandler } from '@/lib/forecast/interactive-route-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = createInternalCurrentForecastPreparationRouteHandler()