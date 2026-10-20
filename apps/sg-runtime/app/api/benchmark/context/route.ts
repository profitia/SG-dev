import {createDiscoveryHttpHandler} from '@/lib/benchmark/discovery-http'
import {getSg2SelectionRuntime} from '@/lib/platform/private-runtime'
import {type NextRequest} from 'next/server'
import { z } from 'zod'

import { cognitionError, cognitionOk, parseJsonBody, withCognitionAuth } from '@/lib/api/middleware'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { getBenchmarkSemanticContext } from '@/lib/benchmark/service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  seriesIds: z.array(z.string().trim().min(1)).min(1).max(8),
})

const legacyPOST = withCognitionAuth(async (_auth, request) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const items = await getBenchmarkSemanticContext(parsed.data.seriesIds)
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }

    return cognitionError('INTERNAL_ERROR', 'Benchmark context could not be loaded.', 500)
  }
})
export const POST = createDiscoveryHttpHandler('CONTEXT','POST',getSg2SelectionRuntime,(request,context)=>legacyPOST(request as NextRequest))
