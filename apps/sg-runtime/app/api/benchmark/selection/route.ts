import { createBenchmarkSelectionHandlers } from '@/lib/benchmark/selection-handlers'

export const dynamic = 'force-dynamic'
const handlers = createBenchmarkSelectionHandlers()
export const GET = handlers.GET
export const POST = handlers.POST
