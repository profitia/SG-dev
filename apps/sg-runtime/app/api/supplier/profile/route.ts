/**
 * app/api/supplier/profile/route.ts
 * GET /api/supplier/profile
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseSearchParams, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  supplierRef: z.string().min(1),
})

export const GET = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().getSupplierProfile(auth.orgId, auth.requestId, parsed.data.supplierRef)
  return cognitionOk(result)
})
