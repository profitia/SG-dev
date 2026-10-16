import { createReadCurrentForecastCapabilityRouteHandler } from '@/lib/benchmark-forecast/route-handlers/current-capability'

export const dynamic = 'force-dynamic'
export const GET = createReadCurrentForecastCapabilityRouteHandler()
