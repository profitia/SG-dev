import { createInternalForecastExecutionLedgerRouteHandler } from '@/lib/forecast/route-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = createInternalForecastExecutionLedgerRouteHandler()