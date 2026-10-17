import { createRuntimeForecastCurrentHandler } from '@/lib/forecast/current-operation-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createRuntimeForecastCurrentHandler()
