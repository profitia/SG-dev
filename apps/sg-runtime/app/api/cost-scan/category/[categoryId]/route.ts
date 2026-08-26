import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { cognitionError, cognitionOk, parseSearchParams, withCognitionAuth } from '@/lib/api/middleware'
import { CategoryAppError } from '@/lib/category/errors'
import { CostScanAppError } from '@/lib/cost-scan/errors'
import { runCategoryCostScan } from '@/lib/cost-scan/service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  range: z.enum(['1M', '3M', '6M', '12M']).default('3M'),
})

type Params = {
  params: {
    categoryId: string
  }
}

export const GET = withCognitionAuth(async (auth, request: NextRequest, context?: Params) => {
  const categoryId = context?.params.categoryId
  if (!categoryId) {
    return cognitionError('VALIDATION_ERROR', 'Category ID is required.', 400, auth.requestId)
  }

  const parsed = parseSearchParams(request, QuerySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)
  }

  try {
    const result = await runCategoryCostScan(auth.orgId, categoryId, parsed.data.range ?? '3M')
    return cognitionOk(result)
  } catch (error) {
    if (error instanceof CostScanAppError || error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }

    return cognitionError('INTERNAL_ERROR', 'Cost Scan could not be loaded.', 500, auth.requestId)
  }
})