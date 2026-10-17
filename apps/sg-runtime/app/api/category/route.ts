import { createRuntimeCategoryCollectionHandlers } from '@/lib/category/runtime-handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const handlers = createRuntimeCategoryCollectionHandlers()
export const GET = handlers.GET
export const POST = handlers.POST
