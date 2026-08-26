/**
 * app/api/retrieval/graph/route.ts
 * POST /api/retrieval/graph
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  seedRef:       z.string().min(1),
  traversalType: z.enum(['ONTOLOGY_AWARE', 'SUPPLIER_GRAPH', 'BENCHMARK_GRAPH', 'SHOULD_COST_GRAPH', 'SEMANTIC_NEIGHBORHOOD']).default('ONTOLOGY_AWARE'),
  depth:         z.coerce.number().int().min(1).max(3).default(2),
  sessionId:     z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().runGraphRetrieval(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
