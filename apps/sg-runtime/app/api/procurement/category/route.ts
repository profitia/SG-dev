/**
 * app/api/procurement/category/route.ts
 * GET /api/procurement/category
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { withCognitionAuth, parseSearchParams, cognitionOk, cognitionError } from '@/lib/api/middleware'
import { getCognitionService } from '@/lib/api/cognition-service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const GET = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)

  const result = await getCognitionService().getProcurementCategories(auth.orgId, auth.requestId, parsed.data.limit)
  return cognitionOk(result)
})
