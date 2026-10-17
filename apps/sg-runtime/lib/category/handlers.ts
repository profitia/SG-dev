import { type NextRequest } from 'next/server'
import { z } from 'zod'
import type { CategoryStatus } from '@/lib/category/contracts'
import { CategoryAppError } from '@/lib/category/errors'
import { createOrUpdateCategory, listCategories, getCategory } from '@/lib/category/service'
import { cognitionError, cognitionOk, parseJsonBody, withCognitionAuth } from '@/lib/api/middleware'

const ComponentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessBenchmarkId: z.string().trim().min(1),
  weightPercent: z.coerce.number().int().min(0).max(100),
})

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  components: z.array(ComponentSchema).max(12),
})

type CategorySummaryResponse = {
  id: string
  name: string
  status: CategoryStatus
  componentCount: number
  updatedAt: string
}

export type CategoryRouteContext = { params: { categoryId: string } }

/** Original legacy validation and business response semantics. Private callers
 * use the separate native dispatcher and never derive an actor here. */
export function createLegacyCategoryCollectionHandlers() {
const GET = withCognitionAuth(async (auth) => {
  try {
    const items: CategorySummaryResponse[] = await listCategories(auth.orgId)
    return cognitionOk({ items })
  } catch (error) {
    if (error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }

    return cognitionError('INTERNAL_ERROR', 'Categories could not be loaded.', 500, auth.requestId)
  }
})

const POST = withCognitionAuth(async (auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400, auth.requestId)
  }

  try {
    const category = await createOrUpdateCategory({
      organizationId: auth.orgId,
      userId: auth.userId,
      name: parsed.data.name,
      components: parsed.data.components,
    })

    return cognitionOk(category, 201)
  } catch (error) {
    if (error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status, auth.requestId)
    }

    return cognitionError('INTERNAL_ERROR', 'Category could not be saved.', 500, auth.requestId)
  }
})
return Object.freeze({ GET, POST })
}

export function createLegacyCategoryDetailHandlers() {
const GET = withCognitionAuth(async (auth, _request: NextRequest, context?: CategoryRouteContext) => {
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

const PATCH = withCognitionAuth(async (auth, request: NextRequest, context?: CategoryRouteContext) => {
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
return Object.freeze({ GET, PATCH })
}
