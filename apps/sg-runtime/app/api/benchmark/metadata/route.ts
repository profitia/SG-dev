import {createDiscoveryHttpHandler} from '@/lib/benchmark/discovery-http'
import {getSg2SelectionRuntime} from '@/lib/platform/private-runtime'
import {type NextRequest} from 'next/server'
import { getBenchmarkMetadataDefinitions } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { cognitionError, cognitionOk, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const legacyGET = withCognitionAuth(async () => {
  try {
    const items = await getBenchmarkMetadataDefinitions()
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }

    return cognitionError('INTERNAL_ERROR', 'Benchmark metadata could not be loaded.', 500)
  }
})
export const GET = createDiscoveryHttpHandler('METADATA','GET',getSg2SelectionRuntime,(request,context)=>legacyGET(request as NextRequest))
