/**
 * app/api/hydrate/procurement/route.ts
 * POST /api/hydrate/procurement
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseJsonBody, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  commodityRef:      z.string().min(1),
  sessionId:         z.string().optional(),
  ontologyRunId:     z.string().optional(),
  intelligenceRunId: z.string().optional(),
})

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().hydrateProcurement(auth.orgId, auth.requestId, parsed.data)
  return cognitionOk(result)
})
