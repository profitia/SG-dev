import { createRuntimeForecastVerificationHandler } from '@/lib/forecast/verification-operation-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createRuntimeForecastVerificationHandler()