import type { NextRequest } from 'next/server'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { CATEGORY_HEADERS } from './operation-contract'
import { createLegacyCategoryCollectionHandlers, createLegacyCategoryDetailHandlers, type CategoryRouteContext } from './handlers'
import { createOperationCategoryCollectionHandlers, createOperationCategoryDetailHandlers } from './operation-handlers'
const unavailable = () => Response.json({ error: 'Operation unavailable' }, { status: 503, headers: CATEGORY_HEADERS })

export function createRuntimeCategoryCollectionHandlers(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime,
  legacy = createLegacyCategoryCollectionHandlers()) {
  const handle = (method: 'GET' | 'POST') => async (request: NextRequest): Promise<Response> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy[method](request)
      if (runtime.provider !== 'clerk' || !runtime.category) return unavailable()
      return await createOperationCategoryCollectionHandlers(runtime.category.executor, runtime.defaultOrganisationId)[method](request)
    } catch { return unavailable() }
  }
  return Object.freeze({ GET: handle('GET'), POST: handle('POST') })
}
export function createRuntimeCategoryDetailHandlers(resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime,
  legacy = createLegacyCategoryDetailHandlers()) {
  const handle = (method: 'GET' | 'PATCH') => async (request: NextRequest, route?: CategoryRouteContext): Promise<Response> => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy[method](request, route)
      if (runtime.provider !== 'clerk' || !runtime.category) return unavailable()
      return await createOperationCategoryDetailHandlers(runtime.category.executor, runtime.defaultOrganisationId)[method](request, route)
    } catch { return unavailable() }
  }
  return Object.freeze({ GET: handle('GET'), PATCH: handle('PATCH') })
}
