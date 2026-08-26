import { getBenchmarkMetadataDefinitions } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { cognitionError, cognitionOk, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

export const GET = withCognitionAuth(async () => {
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