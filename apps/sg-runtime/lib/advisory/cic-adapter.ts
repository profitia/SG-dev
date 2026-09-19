import { computeConversationDecision } from '@profitia/cic-core'
import { computeIntentScore, type IntentCode } from '@profitia/cic-procurement'
import type { Locale } from '@/i18n/routing'
import { getSpendGuruDestination, type SpendGuruDestinationId } from './config'

export interface SpendGuruAdvisoryInput {
  locale: Locale
  messages: readonly { role: 'user' | 'assistant'; content: string }[]
}

export interface SpendGuruAdvisoryResult {
  content: string
  intent: IntentCode
  confidence: number
  recommendation: ReturnType<typeof getSpendGuruDestination> | null
  rationale: { contextLabel: string; summary: string; lead: string } | null
}

export function resolveSpendGuruDestination(intent: IntentCode): SpendGuruDestinationId {
  switch (intent) {
    case 'I2_FORECASTING':
    case 'I8_NEGOTIATIONS':
      return 'benchmark-finder'
    case 'I1_SAVINGS':
      return 'cost-scan'
    case 'I6_EDUCATION':
      return 'contact'
    case 'I3_SUPPLIER_RISK':
    case 'I4_DIGITALIZATION':
    case 'I5_SOURCING':
    case 'I7_EXPLORATORY':
    case 'UNKNOWN':
      return 'category-builder'
  }
}

function compact(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179).trimEnd()}…`
}

export function runSpendGuruAdvisory(input: SpendGuruAdvisoryInput): SpendGuruAdvisoryResult {
  const userMessages = input.messages.filter((message) => message.role === 'user')
  const score = computeIntentScore(
    input.messages,
    { primaryIntent: 'I7_EXPLORATORY', secondaryIntents: [] },
    [],
    { recommendationsShown: [] },
  )
  const decision = computeConversationDecision({
    userTurnCount: userMessages.length,
    intent: score.primary,
    routing: {
      shouldEscalateNow: false,
      shouldShowRecommendation: score.primaryConfidence >= 0.25 || userMessages.length >= 2,
      reason: score.primaryConfidence >= 0.25 ? 'intent_confident' : 'clarification_complete',
    },
    resolveDestination: resolveSpendGuruDestination,
  })

  if (decision.action !== 'recommend' || !decision.destinationId) {
    return {
      content: input.locale === 'pl'
        ? 'Co będzie najważniejszym rezultatem: porównanie ceny, uporządkowanie kategorii czy analiza struktury kosztów?'
        : 'Which outcome matters most: comparing a price, organising a category, or analysing its cost structure?',
      intent: score.primary,
      confidence: score.primaryConfidence,
      recommendation: null,
      rationale: null,
    }
  }

  const latest = userMessages.at(-1)?.content ?? ''
  return {
    content: input.locale === 'pl'
      ? 'Dziękuję — mam wystarczający kontekst, aby wskazać właściwy pierwszy krok.'
      : 'Thank you — I have enough context to suggest the right first step.',
    intent: score.primary,
    confidence: score.primaryConfidence,
    recommendation: getSpendGuruDestination(decision.destinationId, input.locale),
    rationale: {
      contextLabel: input.locale === 'pl' ? 'Rozumiem z tego, co piszesz, że:' : 'From what you have written, I understand that:',
      summary: `„${compact(latest)}”`,
      lead: input.locale === 'pl' ? 'Jako pierwszy krok proponuję:' : 'As a first step, I recommend:',
    },
  }
}
