import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { getSavedBenchmarks, selectBenchmark } from '@/lib/benchmark/service'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { withCognitionAuth, parseJsonBody, cognitionError, cognitionOk } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const CandidateSchema = z.object({
  candidateId: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().nullable(),
  provider: z.object({
    providerCode: z.literal('MACROBOND'),
    displayName: z.string().min(1),
  }),
  providerSeries: z.object({
    provider: z.object({
      providerCode: z.literal('MACROBOND'),
      displayName: z.string().min(1),
    }),
    providerSeriesId: z.string().min(1),
    providerSeriesKey: z.string().nullable().optional(),
  }),
  frequency: z.string().nullable(),
  currency: z.string().nullable(),
  unit: z.string().nullable(),
  source: z.string().nullable(),
  region: z.string().nullable(),
})

const BodySchema = z.object({
  candidate: CandidateSchema,
})

export const GET = withCognitionAuth(async (auth) => {
  try {
    const items = await getSavedBenchmarks(auth.orgId)
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }
    return cognitionError('INTERNAL_ERROR', 'Loading saved benchmarks failed.', 500, auth.requestId)
  }
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)
  }

  try {
    const saved = await selectBenchmark({
      organizationId: auth.orgId,
      userId: auth.userId,
      candidate: parsed.data.candidate,
    })
    return cognitionOk(saved, 201)
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }
    return cognitionError('INTERNAL_ERROR', 'Saving benchmark selection failed.', 500, auth.requestId)
  }
})