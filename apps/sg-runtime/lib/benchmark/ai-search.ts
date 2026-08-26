import OpenAI from 'openai'
import { z } from 'zod'

import type { BenchmarkAiSearchResult, BenchmarkCandidate, BenchmarkSearchIntent } from '@/lib/benchmark/contracts'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { searchBenchmarks } from '@/lib/benchmark/service'
import { serverEnv } from '@/lib/env'

const DEFAULT_OPENAI_MODEL = 'gpt-5.6-luna'
const MAX_PROMPT_LENGTH = 500
const SEARCH_QUERY_LIMIT = 5
const SEARCH_RESULTS_PER_QUERY = 6
const FINAL_RESULT_LIMIT = 8
const RANKING_CANDIDATE_LIMIT = 6
const SERIES_ID_PATTERN = /\b[a-z]{1,10}[a-z0-9]*_[a-z0-9_]+\b|\b[a-z]{2,12}\d{3,}\b/

const IntentSchema = z.object({
  concept: z.string().trim().min(1).max(120),
  searchTerms: z.array(z.string().trim().min(1).max(180)).min(1).max(5),
  region: z.string().trim().min(1).max(80).nullable(),
  market: z.string().trim().min(1).max(120).nullable(),
  instrumentType: z.string().trim().min(1).max(120).nullable(),
  currency: z.string().trim().min(1).max(40).nullable(),
  frequency: z.string().trim().min(1).max(40).nullable(),
  useCase: z.string().trim().min(1).max(240).nullable(),
  industryContext: z.string().trim().min(1).max(180).nullable(),
  interpretation: z.string().trim().min(1).max(480),
  confidence: z.number().min(0).max(1),
})

const RankingResponseSchema = z.object({
  matches: z.array(z.object({
    candidateId: z.string().trim().min(1),
    score: z.number().min(0).max(1),
    reason: z.string().trim().min(1).max(220),
  })).max(RANKING_CANDIDATE_LIMIT),
})

const intentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['concept', 'searchTerms', 'region', 'market', 'instrumentType', 'currency', 'frequency', 'useCase', 'industryContext', 'interpretation', 'confidence'],
  properties: {
    concept: { type: 'string' },
    searchTerms: {
      type: 'array',
      minItems: 1,
      maxItems: SEARCH_QUERY_LIMIT,
      items: { type: 'string' },
    },
    region: { type: ['string', 'null'] },
    market: { type: ['string', 'null'] },
    instrumentType: { type: ['string', 'null'] },
    currency: { type: ['string', 'null'] },
    frequency: { type: ['string', 'null'] },
    useCase: { type: ['string', 'null'] },
    industryContext: { type: ['string', 'null'] },
    interpretation: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const

const rankingJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      maxItems: RANKING_CANDIDATE_LIMIT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'score', 'reason'],
        properties: {
          candidateId: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const

function getOpenAiClient() {
  if (!serverEnv.OPENAI_API_KEY) {
    throw new BenchmarkAppError(
      'AI_UNAVAILABLE',
      'AI-assisted search is temporarily unavailable. You can still search benchmarks manually.',
      503,
    )
  }

  return new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY })
}

function getOpenAiModel() {
  return serverEnv.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL
}

function normalizeOptionalText(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeIntent(intent: BenchmarkSearchIntent): BenchmarkSearchIntent {
  return {
    ...intent,
    concept: intent.concept.trim(),
    searchTerms: [...new Set(intent.searchTerms.map((term) => term.trim()).filter(Boolean))].slice(0, SEARCH_QUERY_LIMIT),
    region: normalizeOptionalText(intent.region),
    market: normalizeOptionalText(intent.market),
    instrumentType: normalizeOptionalText(intent.instrumentType),
    currency: normalizeOptionalText(intent.currency),
    frequency: normalizeOptionalText(intent.frequency),
    useCase: normalizeOptionalText(intent.useCase),
    industryContext: normalizeOptionalText(intent.industryContext),
    interpretation: intent.interpretation.trim(),
  }
}

function assertIntentSafe(intent: BenchmarkSearchIntent) {
  const values = [
    intent.concept,
    ...intent.searchTerms,
    intent.region,
    intent.market,
    intent.instrumentType,
    intent.currency,
    intent.frequency,
    intent.useCase,
    intent.industryContext,
    intent.interpretation,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  const containsSeriesLikeIdentifier = values.some((value) => SERIES_ID_PATTERN.test(value))
  if (containsSeriesLikeIdentifier) {
    throw new BenchmarkAppError(
      'AI_UNSAFE_INTENT',
      'AI interpretation included provider-specific identifiers. Please describe the benchmark need without a ticker or series code.',
      502,
    )
  }
}

function buildIntentPrompt(prompt: string) {
  return [
    'Interpret the procurement benchmark request and return only structured search intent.',
    'Focus on useful market or macroeconomic benchmark terminology for a live external data search.',
    'searchTerms must contain practical provider search phrases, not explanations.',
    'If the request is ambiguous, choose the most useful benchmark proxies and explain that briefly in interpretation.',
    '',
    `User request: ${prompt}`,
  ].join('\n')
}

function collectIntentText(intent: BenchmarkSearchIntent) {
  return [intent.concept, ...intent.searchTerms, intent.market, intent.instrumentType, intent.useCase, intent.industryContext]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase()
}

function seedHeuristicQueries(intent: BenchmarkSearchIntent) {
  const text = collectIntentText(intent)
  const queries: string[] = []
  const push = (value: string) => {
    if (!queries.includes(value)) {
      queries.push(value)
    }
  }

  if (/(brent|crude oil|dated brent|north sea)/i.test(text)) {
    push('Brent')
  }
  if (/\bwti\b/i.test(text)) {
    push('WTI')
  }
  if (/\bcopper\b/i.test(text)) {
    push('Copper')
    push('LME Copper')
  }
  if (/(aluminium|aluminum)/i.test(text)) {
    push('Aluminium')
  }
  if (/(eur\s*\/\s*usd|eur per usd|euro.*us dollar|exchange rate)/i.test(text)) {
    push('EUR/USD')
  }
  if (/(natural gas|gas)/i.test(text)) {
    push('Natural Gas')
  }
  if (/(electricity|power|baseload)/i.test(text)) {
    push('Electricity')
    push('Power')
  }

  return queries
}

function buildRankingPrompt(prompt: string, intent: BenchmarkSearchIntent, candidates: BenchmarkCandidate[]) {
  return JSON.stringify({
    userPrompt: prompt,
    intent,
    candidates: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      displayName: candidate.displayName,
      source: candidate.source,
      frequency: candidate.frequency,
      currency: candidate.currency,
      unit: candidate.unit,
      region: candidate.region,
    })),
  })
}

async function requestStructuredOutput<T>(params: {
  name: string
  schema: Record<string, unknown>
  systemPrompt: string
  userPrompt: string
  validator: z.ZodType<T>
}) {
  const client = getOpenAiClient()
  const response = await client.responses.create({
    model: getOpenAiModel(),
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: params.systemPrompt }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: params.userPrompt }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: params.name,
        schema: params.schema,
        strict: true,
      },
    },
  })

  const parsed = JSON.parse(response.output_text)
  return params.validator.parse(parsed)
}

async function interpretPrompt(prompt: string) {
  let rawIntent: BenchmarkSearchIntent

  try {
    rawIntent = await requestStructuredOutput({
      name: 'benchmark_search_intent',
      schema: intentJsonSchema,
      validator: IntentSchema,
      systemPrompt: [
        'You interpret procurement users\' benchmark needs.',
        'Your task is to translate natural-language intent into search criteria for an external financial or economic data provider.',
        'Do not invent provider series, tickers or identifiers.',
        'Do not claim that a benchmark exists.',
        'Return only structured search intent.',
        'Prefer terminology useful for market or macroeconomic benchmark search.',
        'Interpret user language in Polish or English.',
      ].join(' '),
      userPrompt: buildIntentPrompt(prompt),
    })
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      throw error
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new BenchmarkAppError(
        'AI_NEEDS_CLARIFICATION',
        'Please describe the benchmark need more precisely so SpendGuru can search live Macrobond data.',
        422,
      )
    }

    throw new BenchmarkAppError(
      'AI_UNAVAILABLE',
      'AI-assisted search is temporarily unavailable. You can still search benchmarks manually.',
      503,
    )
  }

  const intent = normalizeIntent(rawIntent)
  if (intent.searchTerms.length === 0 || intent.confidence < 0.15) {
    throw new BenchmarkAppError(
      'AI_NEEDS_CLARIFICATION',
      'Please describe the benchmark need more precisely so SpendGuru can search live Macrobond data.',
      422,
    )
  }

  assertIntentSafe(intent)
  return intent
}

function buildSearchQueries(intent: BenchmarkSearchIntent, originalPrompt: string) {
  const queries: string[] = []

  const push = (value: string | null | undefined) => {
    if (!value) {
      return
    }

    const normalized = value.trim()
    if (!normalized) {
      return
    }

    if (!queries.includes(normalized)) {
      queries.push(normalized)
    }
  }

  seedHeuristicQueries(intent).forEach(push)
  intent.searchTerms.forEach(push)
  push(intent.concept)
  push(intent.region && intent.concept ? `${intent.region} ${intent.concept}` : null)
  push(intent.instrumentType && intent.concept ? `${intent.concept} ${intent.instrumentType}` : null)
  push(intent.market && intent.concept ? `${intent.market} ${intent.concept}` : null)
  push(intent.currency && intent.concept ? `${intent.concept} ${intent.currency}` : null)

  if (queries.length === 0) {
    push(originalPrompt)
  }

  return queries.slice(0, SEARCH_QUERY_LIMIT)
}

async function searchCandidatesForIntent(intent: BenchmarkSearchIntent, originalPrompt: string) {
  const queries = buildSearchQueries(intent, originalPrompt)
  const candidatesBySeries = new Map<string, BenchmarkCandidate>()

  for (const query of queries) {
    const items = await searchBenchmarks({
      query,
      limit: SEARCH_RESULTS_PER_QUERY,
    })
    for (const item of items) {
      const seriesId = item.providerSeries.providerSeriesId
      if (!candidatesBySeries.has(seriesId)) {
        candidatesBySeries.set(seriesId, item)
      }
    }

    if (candidatesBySeries.size >= FINAL_RESULT_LIMIT) {
      break
    }
  }

  return Array.from(candidatesBySeries.values()).slice(0, FINAL_RESULT_LIMIT)
}

async function rerankCandidates(params: {
  prompt: string
  intent: BenchmarkSearchIntent
  candidates: BenchmarkCandidate[]
}) {
  if (params.candidates.length === 0 || !serverEnv.OPENAI_API_KEY) {
    return params.candidates
  }

  try {
    const ranked = await requestStructuredOutput({
      name: 'benchmark_candidate_ranking',
      schema: rankingJsonSchema,
      validator: RankingResponseSchema,
      systemPrompt: [
        'Rank only the provided benchmark candidates for the user\'s intent.',
        'Never invent a candidate or identifier.',
        'Return only candidateIds that were provided.',
        'Explain the practical match in one short sentence.',
      ].join(' '),
      userPrompt: buildRankingPrompt(params.prompt, params.intent, params.candidates.slice(0, RANKING_CANDIDATE_LIMIT)),
    })

    const knownCandidateIds = new Set(params.candidates.map((candidate) => candidate.candidateId))
    const annotations = new Map<string, { score: number; reason: string; recommendedRank: number }>()

    ranked.matches
      .filter((match) => knownCandidateIds.has(match.candidateId))
      .sort((left, right) => right.score - left.score)
      .forEach((match, index) => {
        annotations.set(match.candidateId, {
          score: match.score,
          reason: match.reason,
          recommendedRank: index + 1,
        })
      })

    return [...params.candidates]
      .map((candidate) => {
        const annotation = annotations.get(candidate.candidateId)
        if (!annotation) {
          return candidate
        }

        return {
          ...candidate,
          aiScore: annotation.score,
          aiReason: annotation.reason,
          recommendedRank: annotation.recommendedRank,
        }
      })
      .sort((left, right) => {
        const leftRank = left.recommendedRank ?? Number.MAX_SAFE_INTEGER
        const rightRank = right.recommendedRank ?? Number.MAX_SAFE_INTEGER
        if (leftRank !== rightRank) {
          return leftRank - rightRank
        }
        return (right.aiScore ?? -1) - (left.aiScore ?? -1)
      })
  } catch {
    return params.candidates
  }
}

export async function runBenchmarkAiSearch(prompt: string): Promise<BenchmarkAiSearchResult> {
  const normalizedPrompt = prompt.trim()
  if (normalizedPrompt.length < 3) {
    throw new BenchmarkAppError('VALIDATION_ERROR', 'Prompt must be at least 3 characters long.', 400)
  }

  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new BenchmarkAppError('VALIDATION_ERROR', `Prompt must be at most ${MAX_PROMPT_LENGTH} characters long.`, 400)
  }

  const intent = await interpretPrompt(normalizedPrompt)
  const liveCandidates = await searchCandidatesForIntent(intent, normalizedPrompt)
  const candidates = await rerankCandidates({
    prompt: normalizedPrompt,
    intent,
    candidates: liveCandidates,
  })

  return {
    intent,
    candidates,
  }
}