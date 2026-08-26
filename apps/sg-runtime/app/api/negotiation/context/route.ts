/**
 * app/api/negotiation/context/route.ts
 * POST /api/negotiation/context
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  supplierRef:   z.string().min(1),
  commodityRefs: z.array(z.string()).min(1).max(10),
  sessionId:     z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().buildNegotiationContext(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
