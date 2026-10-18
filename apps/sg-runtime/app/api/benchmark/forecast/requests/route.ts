import { createRuntimeForecastRequestHandler } from '@/lib/forecast/request-operation-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = createRuntimeForecastRequestHandler()
