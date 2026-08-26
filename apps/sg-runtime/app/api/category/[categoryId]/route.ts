import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { CategoryAppError } from '@/lib/category/errors'
import { createOrUpdateCategory, getCategory } from '@/lib/category/service'
import { cognitionError, cognitionOk, parseJsonBody, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const ComponentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessBenchmarkId: z.string().trim().min(1),
  weightPercent: z.coerce.number().int().min(0).max(100),
})

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  components: z.array(ComponentSchema).max(12),
})

type Params = {
  params: {
    categoryId: string
  }
}

export const GET = withCognitionAuth(async (auth, _request: NextRequest, context?: Params) => {
  const categoryId = context?.params.categoryId
  if (!categoryId) {
    return cognitionError('VALIDATION_ERROR', 'Category ID is required.', 400, auth.requestId)
  }

  try {
    const category = await getCategory(auth.orgId, categoryId)
    return cognitionOk(category)
  } catch (error) {
    if (error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }

    return cognitionError('INTERNAL_ERROR', 'Category could not be loaded.', 500, auth.requestId)
  }
})

export const PATCH = withCognitionAuth(async (auth, request: NextRequest, context?: Params) => {
  const categoryId = context?.params.categoryId
  if (!categoryId) {
    return cognitionError('VALIDATION_ERROR', 'Category ID is required.', 400, auth.requestId)
  }

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)
  }

  try {
    const category = await createOrUpdateCategory({
      organizationId: auth.orgId,
      userId: auth.userId,
      categoryId,
      name: parsed.data.name,
      components: parsed.data.components,
    })

    return cognitionOk(category)
  } catch (error) {
    if (error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }

    return cognitionError('INTERNAL_ERROR', 'Category could not be saved.', 500, auth.requestId)
  }
})