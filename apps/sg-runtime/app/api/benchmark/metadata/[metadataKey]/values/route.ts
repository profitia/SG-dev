import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getBenchmarkMetadataValues } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { cognitionError, cognitionOk, parseSearchParams, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  filters: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

type Params = {
  params: {
    metadataKey: string
  }
}

export const GET = withCognitionAuth(async (_auth, request: NextRequest, context?: Params) => {
  const metadataKey = context?.params.metadataKey?.trim()
  if (!metadataKey) {
    return cognitionError('VALIDATION_ERROR', 'Metadata key is required.', 400)
  }

  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  let filters: Array<{ metadataKey: string; operator: 'equals'; value?: string; values?: string[] }> = []

  if (parsed.data.filters) {
    try {
      const candidate = JSON.parse(parsed.data.filters) as Array<{ metadataKey: string; operator?: 'equals'; value?: string; values?: string[] }>
      filters = Array.isArray(candidate)
        ? candidate
            .filter((item) => item && typeof item.metadataKey === 'string')
            .map((item) => ({
              metadataKey: item.metadataKey,
              operator: 'equals' as const,
              value: item.value,
              values: item.values,
            }))
        : []
    } catch {
      return cognitionError('VALIDATION_ERROR', 'filters must be valid JSON.', 400)
    }
  }

  try {
    const result = await getBenchmarkMetadataValues(metadataKey, filters, {
      query: parsed.data.q,
      limit: parsed.data.limit,
    })
    return cognitionOk(result)
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }

    return cognitionError('INTERNAL_ERROR', 'Benchmark metadata values could not be loaded.', 500)
  }
})