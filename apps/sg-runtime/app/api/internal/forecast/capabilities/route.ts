import { createRuntimeForecastReadinessHandler } from '@/lib/forecast/readiness-operation-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createRuntimeForecastReadinessHandler('capabilities')
