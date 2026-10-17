import { createRuntimeCategoryDetailHandlers } from '@/lib/category/runtime-handlers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const handlers = createRuntimeCategoryDetailHandlers()
export const GET = handlers.GET
export const PATCH = handlers.PATCH
