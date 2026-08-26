import OpenAI from 'openai'
import { z } from 'zod'

import type { CategoryComponentSuggestion, CategorySuggestionResult } from '@/lib/category/contracts'
import { CategoryAppError } from '@/lib/category/errors'
import { serverEnv } from '@/lib/env'

const DEFAULT_OPENAI_MODEL = 'gpt-5.6-luna'
const MAX_CATEGORY_NAME_LENGTH = 120
const MAX_CATEGORY_DESCRIPTION_LENGTH = 320
const MAX_COMPONENTS = 8
const MAX_SEARCH_SEEDS = 4
const SERIES_ID_PATTERN = /\b[a-z]{1,10}[a-z0-9]*_[a-z0-9_]+\b|\b[a-z]{2,12}\d{3,}\b/
const PROVIDER_TOKEN_PATTERN = /\b(macrobond|provider series|series id|ticker|ric|isin|sedol|cusip|bloomberg)\b/i

const SuggestionSchema = z.object({
  categoryInterpretation: z.string().trim().min(1).max(240).nullable(),
  components: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    rationale: z.string().trim().min(1).max(220),
    benchmarkNeed: z.string().trim().min(1).max(220),
    searchSeeds: z.array(z.string().trim().min(1).max(80)).max(MAX_SEARCH_SEEDS).nullable(),
  })).min(1).max(MAX_COMPONENTS),
})

type RawCategorySuggestionResult = z.infer<typeof SuggestionSchema>

const suggestionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['categoryInterpretation', 'components'],
  properties: {
    categoryInterpretation: { type: ['string', 'null'] },
    components: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_COMPONENTS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'rationale', 'benchmarkNeed', 'searchSeeds'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          rationale: { type: 'string' },
          benchmarkNeed: { type: 'string' },
          searchSeeds: {
            type: ['array', 'null'],
            maxItems: MAX_SEARCH_SEEDS,
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const

function getOpenAiClient() {
  if (!serverEnv.OPENAI_API_KEY) {
    throw new CategoryAppError(
      'AI_UNAVAILABLE',
      'SpendGuru suggestions are temporarily unavailable. You can still add components manually.',
      503,
    )
  }

  return new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY })
}

function getOpenAiModel() {
  return serverEnv.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeComponentKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function slugifySuggestionId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'component'
}

function assertSuggestionSafe(component: CategoryComponentSuggestion) {
  const values = [
    component.name,
    component.rationale,
    component.benchmarkNeed,
    ...(component.searchSeeds ?? []),
  ]

  for (const value of values) {
    if (SERIES_ID_PATTERN.test(value) || PROVIDER_TOKEN_PATTERN.test(value)) {
      throw new CategoryAppError(
        'AI_UNSAFE_SUGGESTIONS',
        'SpendGuru suggestions included provider-specific identifiers. Please retry with a simpler category description.',
        502,
      )
    }
  }
}

function normalizeSuggestions(result: RawCategorySuggestionResult): CategorySuggestionResult {
  const seen = new Set<string>()
  const components: CategoryComponentSuggestion[] = []

  for (const item of result.components) {
    const name = item.name.trim()
    const key = normalizeComponentKey(name)
    if (!name || seen.has(key)) {
      continue
    }

    const normalized: CategoryComponentSuggestion = {
      id: slugifySuggestionId(item.id || name),
      name,
      rationale: item.rationale.trim(),
      benchmarkNeed: item.benchmarkNeed.trim(),
      searchSeeds: item.searchSeeds
        ? [...new Set(item.searchSeeds.map((seed) => seed.trim()).filter(Boolean))].slice(0, MAX_SEARCH_SEEDS)
        : undefined,
    }

    assertSuggestionSafe(normalized)
    seen.add(key)
    components.push(normalized)

    if (components.length >= 6) {
      break
    }
  }

  if (components.length === 0) {
    throw new CategoryAppError(
      'AI_NO_USEFUL_SUGGESTIONS',
      'SpendGuru could not identify useful components. Try adding more category context.',
      422,
    )
  }

  return {
    categoryInterpretation: normalizeOptionalText(result.categoryInterpretation),
    components,
  }
}

async function requestStructuredOutput(params: {
  categoryName: string
  categoryDescription: string | null
}) {
  const client = getOpenAiClient()
  const response = await client.responses.create({
    model: getOpenAiModel(),
    input: [
      {
        role: 'system',
        content: [{
          type: 'input_text',
          text: [
            'You assist procurement users in identifying important external cost drivers for a purchasing category.',
            'Suggest a concise set of meaningful cost components that could later be linked to real external benchmarks.',
            'Do not invent provider series identifiers, tickers or Macrobond IDs.',
            'Do not select a benchmark.',
            'Focus on economically meaningful external cost drivers.',
            'Avoid duplicates and avoid overly granular components.',
            'Use business-readable procurement language.',
            'Support Polish and English category descriptions.',
            'Return structured output only.',
          ].join(' '),
        }],
      },
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: [
            'Suggest the most useful external cost components for this purchasing category.',
            `Category name: ${params.categoryName}`,
            params.categoryDescription ? `Category description: ${params.categoryDescription}` : 'Category description: <none>',
            'Return 4 to 8 components when useful, but do not invent filler items.',
            'Each component must remain a concept, not a provider series or ticker.',
            'benchmarkNeed should describe the benchmark need in natural language so the user can later search a real benchmark.',
            'searchSeeds should contain short human-readable search terms only.',
          ].join('\n'),
        }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'category_component_suggestions',
        schema: suggestionJsonSchema,
        strict: true,
      },
    },
  })

  return SuggestionSchema.parse(JSON.parse(response.output_text))
}

export async function runCategoryAiSuggestions(params: {
  categoryName: string
  categoryDescription?: string | null
}) {
  const categoryName = params.categoryName.trim().slice(0, MAX_CATEGORY_NAME_LENGTH)
  const categoryDescription = normalizeOptionalText(params.categoryDescription)?.slice(0, MAX_CATEGORY_DESCRIPTION_LENGTH) ?? null

  if (!categoryName) {
    throw new CategoryAppError('VALIDATION_ERROR', 'Category name is required.', 400)
  }

  try {
    const result = await requestStructuredOutput({
      categoryName,
      categoryDescription,
    })

    return normalizeSuggestions(result)
  } catch (error) {
    if (error instanceof CategoryAppError) {
      throw error
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new CategoryAppError(
        'AI_NO_USEFUL_SUGGESTIONS',
        'SpendGuru could not identify useful components. Try adding more category context.',
        422,
      )
    }

    throw new CategoryAppError(
      'AI_UNAVAILABLE',
      'SpendGuru suggestions are temporarily unavailable. You can still add components manually.',
      503,
    )
  }
}