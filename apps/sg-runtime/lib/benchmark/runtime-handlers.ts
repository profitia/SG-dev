import type { NextRequest } from 'next/server'
import { cognitionError } from '@/lib/api/middleware'
import { getSg2SelectionRuntime, type Sg2SelectionRuntime } from '@/lib/platform/private-runtime'
import { createBenchmarkSelectionHandlers } from './selection-handlers'
import { createOperationBenchmarkSelectionHandlers } from './operation-context'

/** The deployed entry and isolated real-DB tests use this same dispatcher.
 * Only the host injects dependencies; HTTP input never selects the provider. */
export function createRuntimeBenchmarkSelectionHandlers(
  resolveRuntime: () => Sg2SelectionRuntime = getSg2SelectionRuntime,
  legacy = createBenchmarkSelectionHandlers(),
) {
  const handle = (method: 'GET' | 'POST') => async (request: NextRequest) => {
    try {
      const runtime = resolveRuntime()
      if (runtime.provider === 'legacy_demo') return await legacy[method](request)
      if (runtime.provider !== 'clerk') throw new TypeError('Unsupported server runtime')
      const response = await createOperationBenchmarkSelectionHandlers(runtime.executor, {
        defaultOrganisationId: runtime.defaultOrganisationId,
      })[method](request)
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Vary', 'Cookie, Authorization')
      return response
    } catch {
      const response = cognitionError('OPERATION_DENIED', 'Operation unavailable', 503)
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Vary', 'Cookie, Authorization')
      return response
    }
  }
  return Object.freeze({ GET: handle('GET'), POST: handle('POST') })
}
