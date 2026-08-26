/**
 * app/api/procurement/intelligence/route.ts
 * GET /api/procurement/intelligence
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseSearchParams, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  commodityRef: z.string().min(1),
  entityType:   z.enum(['COMMODITY', 'SUPPLIER', 'BENCHMARK']).default('COMMODITY'),
})

export const GET = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().getProcurementIntelligence(
    auth.orgId, auth.requestId, parsed.data.commodityRef, parsed.data.entityType
  )
  return cognitionOk(result)
})
