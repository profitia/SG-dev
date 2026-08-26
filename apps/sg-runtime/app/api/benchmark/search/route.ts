import { type NextRequest } from 'next/server'
import { z } from 'zod'

import type { BenchmarkSearchFilter } from '@/lib/benchmark/contracts'
import { searchBenchmarks } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { withCognitionAuth, parseJsonBody, parseSearchParams, cognitionError, cognitionOk } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(30).default(8),
})

const FilterSchema = z.object({
  metadataKey: z.string().trim().min(1).max(120),
  operator: z.literal('equals').default('equals'),
  value: z.string().trim().min(1).optional(),
  values: z.array(z.string().trim().min(1)).max(20).optional(),
})
  .superRefine((value, ctx) => {
    if (!value.value && (!value.values || value.values.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Filter value is required.',
        path: ['value'],
      })
    }
  })

const AdvancedBodySchema = z.object({
  query: z.string().trim().optional(),
  exactSeriesId: z.string().trim().optional(),
  filters: z.array(FilterSchema).max(20).default([]),
  limit: z.coerce.number().int().min(1).max(30).default(8),
}).superRefine((value, ctx) => {
  if (!value.query && !value.exactSeriesId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide query or exactSeriesId.',
      path: ['query'],
    })
  }
})

function logSearchPerf(mode: 'simple' | 'advanced' | 'exact', startedAt: number, filters: BenchmarkSearchFilter[], resultCount: number) {
  console.info(
    `[BENCHMARK_SEARCH_PERF] mode=${mode} backendMs=${Date.now() - startedAt} resultCount=${resultCount} filterCount=${filters.length}`,
  )
}

export const GET = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const startedAt = Date.now()
    const items = await searchBenchmarks({
      query: parsed.data.q,
      limit: parsed.data.limit ?? 8,
    })
    logSearchPerf('simple', startedAt, [], items.length)
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }
    return cognitionError('INTERNAL_ERROR', 'Benchmark search failed.', 500)
  }
})

export const POST = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, AdvancedBodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const startedAt = Date.now()
    const filters: BenchmarkSearchFilter[] = (parsed.data.filters ?? []).map((filter) => ({
      metadataKey: filter.metadataKey,
      operator: 'equals',
      value: filter.value,
      values: filter.values,
    }))
    const items = await searchBenchmarks({
      query: parsed.data.query,
      exactSeriesId: parsed.data.exactSeriesId,
      filters,
      limit: parsed.data.limit ?? 8,
    })
    logSearchPerf(parsed.data.exactSeriesId ? 'exact' : 'advanced', startedAt, filters, items.length)
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status)
    }
    return cognitionError('INTERNAL_ERROR', 'Benchmark search failed.', 500)
  }
})