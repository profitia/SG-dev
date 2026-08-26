/**
 * app/api/retrieval/contextual/route.ts
 * POST /api/retrieval/contextual
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  entityRef:   z.string().min(1),
  entityType:  z.enum(['COMMODITY', 'SUPPLIER', 'BENCHMARK']),
  contextType: z.enum(['PROCUREMENT', 'NEGOTIATION', 'SUPPLIER', 'INTELLIGENCE', 'BENCHMARK', 'SHOULD_COST']),
  sessionId:   z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().runContextualRetrieval(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
