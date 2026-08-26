/**
 * app/api/procurement/retrieval/route.ts
 * POST /api/procurement/retrieval
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  queryText:    z.string().min(1),
  commodityRef: z.string().min(1),
  ragType:      z.enum(['PROCUREMENT', 'ONTOLOGY_AWARE', 'CONTEXTUAL', 'INTELLIGENCE_GROUNDED']).default('PROCUREMENT'),
  sessionId:    z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().runProcurementRetrieval(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
