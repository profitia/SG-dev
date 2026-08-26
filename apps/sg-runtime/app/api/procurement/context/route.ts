/**
 * app/api/procurement/context/route.ts
 * GET /api/procurement/context
 * Returns procurement cognition context for a commodity.
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseSearchParams, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  commodityRef: z.string().min(1),
  sessionId:    z.string().optional(),
  depth:        z.enum(['shallow', 'deep', 'full']).default('deep'),
})

export const GET = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const svc    = getCognitionService()
  const result = await svc.getProcurementContext(
    auth.orgId, auth.requestId, parsed.data.commodityRef, parsed.data.sessionId, parsed.data.depth
  )
  return cognitionOk(result)
})
