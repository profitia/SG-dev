import { createRuntimeBenchmarkSelectionHandlers } from '@/lib/benchmark/runtime-handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const handlers = createRuntimeBenchmarkSelectionHandlers()
export const GET = handlers.GET
export const POST = handlers.POST
