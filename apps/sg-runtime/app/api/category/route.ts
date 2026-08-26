import { type NextRequest } from 'next/server'
import { z } from 'zod'

import type { CategoryStatus } from '@/lib/category/contracts'
import { CategoryAppError } from '@/lib/category/errors'
import { createOrUpdateCategory, listCategories } from '@/lib/category/service'
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

type CategorySummaryResponse = {
  id: string
  name: string
  status: CategoryStatus
  componentCount: number
  updatedAt: string
}

export const GET = withCognitionAuth(async (auth) => {
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

export const POST = withCognitionAuth(async (auth, request: NextRequest) => {
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