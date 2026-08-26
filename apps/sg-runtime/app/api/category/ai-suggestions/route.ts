import { type NextRequest } from 'next/server'
import { z } from 'zod'

import { runCategoryAiSuggestions } from '@/lib/category/ai-suggestions'
import { CategoryAppError } from '@/lib/category/errors'
import { cognitionError, cognitionOk, parseJsonBody, withCognitionAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  categoryName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(320).optional(),
})

export const POST = withCognitionAuth(async (_auth, request: NextRequest) => {
  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) {
    return cognitionError('VALIDATION_ERROR', parsed.message, 400)
  }

  try {
    const payload = await runCategoryAiSuggestions({
      categoryName: parsed.data.categoryName,
      categoryDescription: parsed.data.description,
    })

    return cognitionOk(payload)
  } catch (error) {
    if (error instanceof CategoryAppError) {
      return cognitionError(error.code, error.message, error.status)
    }

    return cognitionError(
      'INTERNAL_ERROR',
      'SpendGuru suggestions are temporarily unavailable. You can still add components manually.',
      500,
    )
  }
})