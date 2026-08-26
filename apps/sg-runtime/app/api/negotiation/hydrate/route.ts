/**
 * app/api/negotiation/hydrate/route.ts
 * POST /api/negotiation/hydrate
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  contextId:       z.string().min(1),
  supplierRef:     z.string().min(1),
  hydrationSource: z.enum(['ONTOLOGY', 'INTELLIGENCE', 'MEMORY', 'GRAPH', 'SEMANTIC']),
  sourceRef:       z.string().min(1),
  hydrationData:   z.record(z.unknown()),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().hydrateNegotiationContext(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
