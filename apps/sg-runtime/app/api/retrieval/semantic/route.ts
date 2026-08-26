/**
 * app/api/retrieval/semantic/route.ts
 * POST /api/retrieval/semantic
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  queryText: z.string().min(1),
  scope:     z.enum(['PROCUREMENT', 'SUPPLIER', 'BENCHMARK', 'SHOULD_COST', 'NEGOTIATION', 'GLOBAL']).default('PROCUREMENT'),
  topK:      z.coerce.number().int().min(1).max(50).default(10),
  threshold: z.coerce.number().min(0).max(1).default(0.70),
  sessionId: z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().runSemanticRetrieval(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
