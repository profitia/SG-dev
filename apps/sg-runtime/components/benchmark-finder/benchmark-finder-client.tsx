'use client'
import {FinderGlyph} from './visual/benchmark-presentation'
import {CanonDropdown} from './visual/magicpath/CanonDropdown'

import './benchmark-finder-visual.css'
import {SpendGuruLogo} from './visual/SpendGuruLogo'
import {BenchmarkPresentation, BenchmarkThemeSwitch} from './visual/benchmark-presentation'

import {createDiscoveryRequester} from './discovery-request'
import { NativeAnalyticsEmbed } from './native-analytics-embed'

import { memo, useDeferredValue, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSg2BrowserPersistencePolicy, useSg2IdentityMode, useSg2SessionCredential } from '@/components/auth/session-boundary'
import { selectLegacySessionStorage, type BrowserPersistencePolicy } from '@/lib/platform/browser-session-storage'

import {
  FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM,
  localizeDashboardPreviewAnalyticsUrl,
  normalizeForecastWarmupExperiment,
} from '@/lib/benchmark/analytics'
import {
  buildMetadataValueRequestKey,
  buildMetadataValuesRequestPath,
  countReadyMetadataPrewarmFacets,
  isDuplicateMetadataValueRequest,
  prepareAdvancedMetadata,
  shouldReuseMetadataValueState,
  shouldUseRemoteMetadataQuery,
} from '@/components/benchmark-finder/metadata-prefetch'
import {
  formatDisplayMeasurement,
  sanitizeUserFacingPublisher,
  sanitizeUserFacingResolvedLabel,
} from '@/lib/benchmark/presentation'
import {
  PORR_DEMO_FORECAST_BENCHMARKS,
  type PorrDemoForecastBenchmarkFamily,
} from '@/lib/benchmark/porr-demo-forecast-portfolio'
import type {
  BenchmarkAiSearchResult,
  BenchmarkCandidate,
  BenchmarkMetadataDefinition,
  BenchmarkMetadataValue,
  BenchmarkPreviewResult,
  BenchmarkRangePreset,
  BenchmarkSearchFilter,
  BenchmarkSearchIntent,
  BenchmarkSemanticContext,
  BenchmarkSemanticEntity,
  SavedBenchmark,
} from '@/lib/benchmark/contracts'

type BenchmarkFinderClientProps = {
  locale: 'pl' | 'en'
  selectionMode?: 'standalone' | 'picker'
  onBenchmarkSelected?: (benchmark: SavedBenchmark) => void
  initialMode?: DiscoveryMode
  initialSearchQuery?: string
  initialAiPrompt?: string
  showPorrDemoPortfolio?: boolean
}

type BenchmarkUiAction = 'search' | 'ai' | 'preview' | 'selection' | 'saved' | 'metadata'

type DiscoveryMode = 'search' | 'ai'
type SearchSurfaceMode = 'simple' | 'advanced'

type MetadataValueState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: BenchmarkMetadataValue[]
  totalCount: number
  filteredCount: number
  query: string
  limited: boolean
  filterSignature: string
}

type MetadataValuesResponse = {
  items: BenchmarkMetadataValue[]
  totalCount: number
  filteredCount: number
  query: string
  limited: boolean
}

type BenchmarkContextResponse = {
  items: Record<string, BenchmarkSemanticContext>
}

type AnalyticsEligibilityResponse = {
  eligible: boolean
  componentCode: string | null
  analyticsUrl: string | null
  forecastPortfolioEnabled: boolean
}

type AnalyticsEligibilityState = AnalyticsEligibilityResponse & {
  status: 'idle' | 'loading' | 'ready'
}

type CandidatePreviewState = {
  expanded: boolean
  range: BenchmarkRangePreset
  previewStatus: 'idle' | 'loading' | 'ready' | 'error'
  preview: BenchmarkPreviewResult | null
  previewError: string | null
  analyticsEligibility: AnalyticsEligibilityState
  analyticsVisible: boolean
}

const MOBILE_ANALYTICS_IFRAME_MIN_HEIGHT = 360
const DESKTOP_ANALYTICS_IFRAME_MIN_HEIGHT = 520
const MOBILE_ANALYTICS_BREAKPOINT = 640
const DEFAULT_ANALYTICS_IFRAME_HEIGHT_STYLE = 'clamp(360px, 56vw, 700px)'

type RecentSearchMode = 'simple' | 'advanced' | 'ai'

type RecentSearchEntry = {
  id: string
  mode: RecentSearchMode
  label: string
  detail: string | null
  query: string
  exactSeriesId: string
  aiPrompt: string
  filters: Record<string, string[]>
  createdAt: string
}

type SearchTiming = {
  searchId: number
  mode: 'simple' | 'advanced' | 'exact'
  submitAt: number
  fetchStartAt: number
  responseAt: number | null
  visibleLogged: boolean
}

type LocaleSwitchSnapshot = {
  targetLocale: 'pl' | 'en'
  expiresAt: number
  mode: DiscoveryMode
  searchSurfaceMode: SearchSurfaceMode
  query: string
  exactSeriesId: string
  aiPrompt: string
  results: BenchmarkCandidate[]
  previewStates: Record<string, CandidatePreviewState>
  aiIntent: BenchmarkSearchIntent | null
  hasSearched: boolean
  visibleResultCount: number
  selectedFilters: Record<string, string[]>
  metadataDefinitions: BenchmarkMetadataDefinition[]
  metadataDefinitionsLoaded: boolean
  metadataValuesByKey: Record<string, MetadataValueState>
  metadataValueSearchByKey: Record<string, string>
  enrichedCandidates: Record<string, BenchmarkCandidate>
}

const LOCALIZED_METADATA_LABELS: Record<'pl' | 'en', Record<string, string>> = {
  pl: {
    Region: 'Region',
    Source: 'Źródło',
    Frequency: 'Częstotliwość',
    Currency: 'Waluta',
    TitleUnit: 'Jednostka',
    Release: 'Publikacja',
    Category: 'Kategoria',
    AlternativeCategory: 'Alternatywna kategoria',
    Class: 'Klasa serii',
    DataType: 'Typ danych',
    PriceType: 'Typ ceny',
    RateType: 'Typ stopy',
    Exchange: 'Giełda',
  },
  en: {},
}

class BenchmarkUiError extends Error {
  code: string | null

  constructor(message: string, code: string | null) {
    super(message)
    this.code = code
  }
}

const RESULT_PREVIEW_LIMIT = 5
const RESULT_BATCH_SIZE = 5
const SEARCH_RESULTS_FETCH_LIMIT = 25
const MAX_METADATA_VISIBLE_ITEMS = 40
const RECENT_SEARCH_LIMIT = 8
const RECENT_SEARCHES_SESSION_KEY = 'benchmark-finder-recent-searches'
const FINDER_LOCALE_SWITCH_STATE_SESSION_KEY = 'benchmark-finder-locale-switch-state'
const REMOTE_METADATA_QUERY_MIN_LENGTH = 2
const FINDER_LOCALE_SWITCH_STATE_TTL_MS = 30_000
const RANGE_PRESETS: BenchmarkRangePreset[] = ['1M', '3M', '6M', '1Y', '5Y']
const GENERIC_TOKENS = new Set(['world', 'close', 'open', 'high', 'low', 'last', 'avg', 'average'])
const GENERIC_COMMODITIES = new Set(['crude oil', 'oil', 'natural gas', 'copper', 'aluminium', 'aluminum', 'inflation'])
const DEFAULT_PREVIEW_RANGE: BenchmarkRangePreset = '1Y'
const DEFAULT_ANALYTICS_ELIGIBILITY_STATE: AnalyticsEligibilityState = {
  status: 'idle',
  eligible: false,
  componentCode: null,
  analyticsUrl: null,
  forecastPortfolioEnabled: false,
}

const PORR_DEMO_FORECAST_FAMILIES: readonly PorrDemoForecastBenchmarkFamily[] = ['oil', 'copper', 'steel']

function createDefaultCandidatePreviewState(): CandidatePreviewState {
  return {
    expanded: false,
    range: DEFAULT_PREVIEW_RANGE,
    previewStatus: 'idle',
    preview: null,
    previewError: null,
    analyticsEligibility: { ...DEFAULT_ANALYTICS_ELIGIBILITY_STATE },
    analyticsVisible: false,
  }
}

function toDisplayUnit(parts: Array<string | null>) {
  const normalized = parts.filter(Boolean) as string[]
  return normalized.length > 0 ? normalized.join(' · ') : null
}

function splitCandidateTokens(value: string) {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

function extractFxPair(token: string | null | undefined) {
  if (!token) {
    return null
  }

  const slashMatch = token.match(/\b[A-Z]{3}\/([A-Z]{3})\b/)
  if (slashMatch) {
    return slashMatch[0]
  }

  const perMatch = token.match(/\b([A-Z]{3})\s+per\s+([A-Z]{3})\b/i)
  if (perMatch) {
    return `${perMatch[1].toUpperCase()}/${perMatch[2].toUpperCase()}`
  }

  return null
}

function createCardView(candidate: Pick<BenchmarkCandidate, 'displayName' | 'description' | 'source' | 'currency' | 'unit' | 'titleUnit' | 'frequency' | 'semanticContext'>) {
  const semantic = candidate.semanticContext
  const visibleSource = sanitizeUserFacingPublisher(semantic?.source?.label ?? candidate.source)
  if (semantic) {
    const title = semantic.primaryTitle?.trim() || candidate.description?.trim() || candidate.displayName
    const subtitle = [semantic.hierarchy[0], visibleSource].filter(Boolean).join(' · ')
    const description = semantic.hierarchy.slice(1).join(' · ') || semantic.fullDescription || candidate.description?.trim() || null
    const metrics = toDisplayUnit([
      candidate.currency && (candidate.titleUnit ?? candidate.unit)
        ? `${candidate.currency} / ${(candidate.titleUnit ?? candidate.unit)?.replace(/^USD\//, '').replace(/^EUR\//, '')}`
        : candidate.titleUnit ?? candidate.unit,
      candidate.frequency,
    ])

    return {
      title,
      subtitle: subtitle || visibleSource,
      description,
      metrics,
    }
  }

  const tokens = splitCandidateTokens(candidate.displayName)
  const filtered = tokens.filter((token) => {
    const lower = token.toLowerCase()
    return !GENERIC_TOKENS.has(lower) && lower !== (candidate.currency ?? '').toLowerCase()
  })
  const fxPair = extractFxPair(candidate.unit) ?? extractFxPair(candidate.titleUnit) ?? filtered.map((token) => extractFxPair(token)).find(Boolean)

  let title = filtered[0] ?? candidate.displayName

  if (fxPair) {
    title = fxPair
  } else if (filtered.length >= 3 && GENERIC_COMMODITIES.has(filtered[1].toLowerCase())) {
    title = `${filtered[2]} ${filtered[1]}`
  } else if (filtered.length >= 2 && GENERIC_COMMODITIES.has(filtered[0].toLowerCase())) {
    title = `${filtered[1]} ${filtered[0]}`
  } else if (filtered.length >= 3 && filtered[2].length > filtered[0].length) {
    title = filtered[2]
  }

  const remaining = filtered.filter((token) => !title.includes(token))
  const subtitle = [remaining[0], visibleSource].filter(Boolean).join(' · ')
  const derivedDescription = remaining.slice(1, 3).join(' · ')
  const metrics = toDisplayUnit([
    candidate.currency && (candidate.titleUnit ?? candidate.unit)
      ? `${candidate.currency} / ${(candidate.titleUnit ?? candidate.unit)?.replace(/^USD\//, '').replace(/^EUR\//, '')}`
      : candidate.titleUnit ?? candidate.unit,
    candidate.frequency,
  ])

  return {
    title,
    subtitle: subtitle || visibleSource,
    description: candidate.description?.trim() || derivedDescription || null,
    metrics,
  }
}

function buildConciseCardMetadata(candidate: Pick<BenchmarkCandidate, 'currency' | 'unit' | 'titleUnit' | 'frequency' | 'region'>) {
  const unit = toDisplayUnit([candidate.titleUnit ?? candidate.unit])
  const currency = candidate.currency?.trim() ?? null
  const region = sanitizeUserFacingResolvedLabel(candidate.region)
  const measurement = unit
    ? (currency && !unit.toUpperCase().includes(currency.toUpperCase()) ? `${currency} ${unit}` : unit)
    : currency

  return [candidate.frequency?.trim() ?? null, measurement, region]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' · ')
}

function createCandidateFromSaved(saved: SavedBenchmark): BenchmarkCandidate {
  return {
    candidateId: `saved:${saved.selectionId}`,
    displayName: saved.displayName,
    description: null,
    provider: saved.provider,
    providerSeries: saved.providerSeries,
    frequency: saved.frequency,
    currency: saved.currency,
    unit: saved.unit,
    source: saved.source,
    region: null,
    titleUnit: saved.unit,
  }
}

function buildRecentSearchId(entry: Pick<RecentSearchEntry, 'mode' | 'query' | 'exactSeriesId' | 'aiPrompt' | 'filters'>) {
  const normalizedFilters = Object.entries(entry.filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => [key, [...values].sort()])

  return JSON.stringify({
    mode: entry.mode,
    query: entry.query.trim(),
    exactSeriesId: entry.exactSeriesId.trim(),
    aiPrompt: entry.aiPrompt.trim(),
    filters: normalizedFilters,
  })
}

function cloneRecentFilters(filters: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, values]) => [key, [...values]]),
  )
}

function browserSessionStorage(policy: BrowserPersistencePolicy) {
  return selectLegacySessionStorage(policy, () => typeof window === 'undefined' ? null : window.sessionStorage)
}

function loadRecentSearchesFromSession(policy: BrowserPersistencePolicy) {
  const storage = browserSessionStorage(policy)
  if (!storage) {
    return [] as RecentSearchEntry[]
  }

  try {
    const raw = storage.getItem(RECENT_SEARCHES_SESSION_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((entry): entry is RecentSearchEntry => {
        if (!entry || typeof entry !== 'object') {
          return false
        }

        const candidate = entry as Record<string, unknown>
        return typeof candidate.id === 'string'
          && typeof candidate.mode === 'string'
          && typeof candidate.label === 'string'
          && typeof candidate.query === 'string'
          && typeof candidate.exactSeriesId === 'string'
          && typeof candidate.aiPrompt === 'string'
          && typeof candidate.createdAt === 'string'
          && candidate.filters !== null
          && typeof candidate.filters === 'object'
      })
      .slice(0, RECENT_SEARCH_LIMIT)
  } catch {
    return []
  }
}

function saveRecentSearchesToSession(entries: RecentSearchEntry[], policy: BrowserPersistencePolicy) {
  const storage = browserSessionStorage(policy)
  if (!storage) {
    return
  }

  try { storage.setItem(RECENT_SEARCHES_SESSION_KEY, JSON.stringify(entries)) } catch { /* In-memory state remains usable. */ }
}

function readLocaleSwitchSnapshot(expectedLocale: 'pl' | 'en', policy: BrowserPersistencePolicy) {
  const storage = browserSessionStorage(policy)
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(FINDER_LOCALE_SWITCH_STATE_SESSION_KEY)
    if (!raw) return null
    const snapshot = JSON.parse(raw) as LocaleSwitchSnapshot
    if (snapshot.targetLocale !== expectedLocale || snapshot.expiresAt < Date.now()) {
      storage.removeItem(FINDER_LOCALE_SWITCH_STATE_SESSION_KEY)
      return null
    }

    return snapshot
  } catch {
    try { storage.removeItem(FINDER_LOCALE_SWITCH_STATE_SESSION_KEY) } catch { /* Storage may be unavailable. */ }
    return null
  }
}

function saveLocaleSwitchSnapshot(snapshot: LocaleSwitchSnapshot, policy: BrowserPersistencePolicy) {
  const storage = browserSessionStorage(policy)
  if (!storage) {
    return
  }

  try { storage.setItem(FINDER_LOCALE_SWITCH_STATE_SESSION_KEY, JSON.stringify(snapshot)) } catch { /* No private fallback store. */ }
}

function formatPercent(locale: 'pl' | 'en', value: number) {
  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value)

  return `${formatted}%`
}

function formatLatestValue(locale: 'pl' | 'en', preview: BenchmarkPreviewResult) {
  if (preview.latestValue === null) {
    return ' - '
  }

  const number = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(preview.latestValue)
  const suffix = formatDisplayMeasurement(preview.currency, preview.unit)
  return suffix ? `${number} ${suffix}` : number
}

function getChangeMetricTone(value: number | undefined) {
  if (typeof value !== 'number') {
    return 'text-slate-400'
  }

  if (value > 0) {
    return 'text-emerald-600'
  }

  if (value < 0) {
    return 'text-rose-600'
  }

  return 'text-slate-500'
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new BenchmarkUiError(payload.error ?? 'Request failed.', payload.code ?? null)
  }
  return payload as T
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function resolveErrorMessage(action: BenchmarkUiAction, locale: 'pl' | 'en', error: unknown, t: ReturnType<typeof useTranslations<'BenchmarkFinder'>>) {
  if (error instanceof BenchmarkUiError) {
    if (error.code === 'AI_UNAVAILABLE') {
      return t('errors.aiUnavailable')
    }
    if (error.code === 'AI_NEEDS_CLARIFICATION') {
      return t('errors.aiNeedsClarification')
    }
    if (action === 'search') {
      return t('errors.searchUnavailable')
    }
    if (action === 'ai') {
      return t('errors.aiUnavailable')
    }
    if (action === 'preview') {
      return t('errors.previewUnavailable')
    }
    if (action === 'selection') {
      return t('errors.selectionUnavailable')
    }
    if (action === 'saved') {
      return t('errors.savedUnavailable')
    }
    if (action === 'metadata') {
      return t('errors.metadataUnavailable')
    }
  }

  if (error instanceof Error && error.message) {
    return locale === 'pl' ? 'Wystąpił nieoczekiwany błąd.' : 'An unexpected error occurred.'
  }

  return locale === 'pl' ? 'Wystąpił nieoczekiwany błąd.' : 'An unexpected error occurred.'
}

function buildActiveFilters(selectedFilters: Record<string, string[]>, definitions: BenchmarkMetadataDefinition[], valuesByKey: Record<string, MetadataValueState>) {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]))
  return Object.entries(selectedFilters).flatMap(([key, values]) => {
    const definition = byKey.get(key)
    const valueMap = new Map((valuesByKey[key]?.items ?? []).map((item) => [item.value, item.label]))
    return values.map((value) => ({
      key,
      value,
      label: definition ? `${definition.label}: ${valueMap.get(value) ?? value}` : value,
    }))
  })
}

function buildSearchFilters(selectedFilters: Record<string, string[]>): BenchmarkSearchFilter[] {
  return Object.entries(selectedFilters)
    .filter(([, values]) => values.length > 0)
    .map(([metadataKey, values]) => ({
      metadataKey,
      operator: 'equals' as const,
      values,
    }))
}

function localizeMetadataDefinitions(definitions: BenchmarkMetadataDefinition[], locale: 'pl' | 'en') {
  const labels = LOCALIZED_METADATA_LABELS[locale]
  return definitions.map((definition) => ({
    ...definition,
    label: labels[definition.key] ?? definition.label,
  }))
}

function buildFilterParam(filters: BenchmarkSearchFilter[]) {
  return JSON.stringify(filters)
}

function filterMetadataItems(items: BenchmarkMetadataValue[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
  }

  return items
    .filter((item) => item.label.toLowerCase().includes(normalizedQuery) || item.value.toLowerCase().includes(normalizedQuery))
    .map((item) => {
      const normalizedLabel = item.label.toLowerCase()
      const normalizedValue = item.value.toLowerCase()
      const labelIndex = normalizedLabel.indexOf(normalizedQuery)
      const valueIndex = normalizedValue.indexOf(normalizedQuery)
      const wordStartMatch = normalizedLabel.split(/[^\p{L}\p{N}]+/u).some((token) => token.startsWith(normalizedQuery))

      let rank = 5
      if (labelIndex === 0) {
        rank = 0
      } else if (wordStartMatch) {
        rank = 1
      } else if (valueIndex === 0) {
        rank = 2
      } else if (labelIndex >= 0) {
        rank = 3
      } else if (valueIndex >= 0) {
        rank = 4
      }

      return {
        item,
        rank,
        labelIndex: labelIndex === -1 ? Number.MAX_SAFE_INTEGER : labelIndex,
        valueIndex: valueIndex === -1 ? Number.MAX_SAFE_INTEGER : valueIndex,
      }
    })
    .sort((left, right) => left.rank - right.rank
      || left.labelIndex - right.labelIndex
      || left.valueIndex - right.valueIndex
      || left.item.label.length - right.item.label.length
      || left.item.label.localeCompare(right.item.label, undefined, { sensitivity: 'base' })
      || left.item.value.localeCompare(right.item.value, undefined, { sensitivity: 'base' }))
    .map((entry) => entry.item)
}

function resolveSelectedMetadataItems(selectedValues: string[], items: BenchmarkMetadataValue[]) {
  const byValue = new Map(items.map((item) => [item.value, item]))
  return selectedValues.map((value) => byValue.get(value) ?? { value, label: value })
}

function buildVisibleMetadataItems(items: BenchmarkMetadataValue[], query: string, selectedValues: string[]) {
  const selectedItems = resolveSelectedMetadataItems(selectedValues, items)
  const selectedSet = new Set(selectedValues)
  const filteredItems = filterMetadataItems(items, query)
  const visibleItems: BenchmarkMetadataValue[] = []
  const seenValues = new Set<string>()
  let visibleMatchCount = 0

  for (const item of selectedItems) {
    if (seenValues.has(item.value)) {
      continue
    }
    seenValues.add(item.value)
    visibleItems.push(item)
  }

  for (const item of filteredItems) {
    if (selectedSet.has(item.value) || seenValues.has(item.value)) {
      continue
    }
    if (visibleMatchCount >= MAX_METADATA_VISIBLE_ITEMS) {
      break
    }
    seenValues.add(item.value)
    visibleItems.push(item)
    visibleMatchCount += 1
  }

  return {
    filteredItems,
    selectedItems,
    visibleItems,
    visibleMatchCount,
  }
}

type MetadataValueSelectorProps = {
  definition: BenchmarkMetadataDefinition
  t: ReturnType<typeof useTranslations<'BenchmarkFinder'>>
  valueState: MetadataValueState
  selectedValues: string[]
  isOpen: boolean
  searchQuery: string
  remoteFiltering: boolean
  onSearchQueryChange: (value: string) => void
  onSelectionChange: (values: string[]) => void
  onOpenChange: (nextOpen: boolean) => void
  onLoadValues: (nextSearchQuery?: string) => void
}

const MetadataValueSelector = memo(function MetadataValueSelector({
  definition,
  t,
  valueState,
  selectedValues,
  isOpen,
  searchQuery,
  remoteFiltering,
  onSearchQueryChange,
  onSelectionChange,
  onOpenChange,
  onLoadValues,
}: MetadataValueSelectorProps) {
  const containerRef = useRef<HTMLLabelElement | null>(null)
  const deferredQuery = useDeferredValue(searchQuery)
  const { filteredItems, selectedItems, visibleItems, visibleMatchCount } = buildVisibleMetadataItems(valueState.items, deferredQuery, selectedValues)
  const hiddenMatchCount = Math.max(filteredItems.length - visibleMatchCount, 0)
  const requiresLongerQuery = remoteFiltering && deferredQuery.trim().length < REMOTE_METADATA_QUERY_MIN_LENGTH

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onOpenChange])

  function openSelector() {
    onOpenChange(true)
    onLoadValues(searchQuery)
  }

  function syncSelectionUi(nextValues: string[]) {
    const nextSelectedItems = resolveSelectedMetadataItems(nextValues, valueState.items)
    onSearchQueryChange(nextSelectedItems[0]?.label ?? '')
    onOpenChange(false)
  }

  function toggleValue(nextValue: string) {
    if (definition.allowMultipleValues) {
      const nextValues = selectedValues.includes(nextValue)
        ? selectedValues.filter((value) => value !== nextValue)
        : [...selectedValues, nextValue]
      onSelectionChange(nextValues)
      syncSelectionUi(nextValues)
      return
    }

    onSelectionChange(selectedValues[0] === nextValue ? [] : [nextValue])
    syncSelectionUi(selectedValues[0] === nextValue ? [] : [nextValue])
  }

  return (
    <label ref={containerRef} className="bf-metadata-selector" data-testid={`benchmark-metadata-selector-${definition.key}`}>
      <span className="mb-2 block">{definition.label}</span>
      <input
        value={searchQuery}
        onFocus={openSelector}
        onChange={(event) => {
          if (!isOpen) {
            onOpenChange(true)
          }
          onSearchQueryChange(event.target.value)
          onLoadValues(event.target.value)
        }}
        className="mb-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        placeholder={t('advanced.valueSearchPlaceholder')}
      />

      {selectedItems.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <button
              key={item.value}
              type="button"
              className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              onClick={() => {
                const nextValues = selectedValues.filter((value) => value !== item.value)
                onSelectionChange(nextValues)
                if (nextValues.length === 0) {
                  onSearchQueryChange('')
                }
              }}
            >
              {item.label} ×
            </button>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="bf-metadata-popup srm-dropdown-popup">
          {requiresLongerQuery ? (
            <p className="px-2 py-3 text-sm text-slate-600">{t('advanced.typeToSearchValues', { count: REMOTE_METADATA_QUERY_MIN_LENGTH })}</p>
          ) : valueState.status === 'loading' ? (
            <p className="px-2 py-3 text-sm text-slate-600">{t('advanced.loadingValues')}</p>
          ) : valueState.status === 'error' ? (
            <button
              type="button"
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-sm font-medium text-rose-700"
              onClick={openSelector}
            >
              {t('advanced.retryValues')}
            </button>
          ) : (
            <div className="space-y-2">
              {!definition.allowMultipleValues ? (
                <button
                  type="button"
                  className="srm-dropdown-option" data-empty="true"
                  onClick={() => {
                    onSelectionChange([])
                    onSearchQueryChange('')
                    onOpenChange(false)
                  }}
                >
                  {t('advanced.anyValue')}
                </button>
              ) : null}

              {visibleItems.length > 0 ? (
                <div
                  className="bf-metadata-options srm-dropdown-list"
                  data-testid={`benchmark-metadata-options-${definition.key}`}
                  data-visible-count={visibleItems.length}
                  data-total-count={valueState.items.length}
                >
                  {visibleItems.map((item) => {
                    const isSelected = selectedValues.includes(item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className="bf-metadata-option srm-dropdown-option" aria-pressed={isSelected} data-active={isSelected}
                        onClick={() => toggleValue(item.value)}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <span className="shrink-0 text-xs font-medium">{isSelected ? '✓' : definition.allowMultipleValues ? '+' : ''}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-2 py-3 text-sm text-slate-600">{t('advanced.noMatchingValues')}</p>
              )}

              {remoteFiltering && valueState.limited ? (
                <p className="px-2 text-xs text-slate-500">
                  {t('advanced.showingFilteredValues', { count: visibleItems.length, total: valueState.filteredCount })}
                </p>
              ) : hiddenMatchCount > 0 ? (
                <p className="px-2 text-xs text-slate-500">
                  {t('advanced.showingFilteredValues', { count: visibleMatchCount, total: filteredItems.length })}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

    </label>
  )
})

function renderMetadataValue(value: string | string[]) {
  return Array.isArray(value) ? value.join(', ') : value
}

function formatSemanticDate(locale: 'pl' | 'en', value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function buildBusinessMetadataRows(candidate: BenchmarkCandidate, locale: 'pl' | 'en', t: ReturnType<typeof useTranslations<'BenchmarkFinder'>>) {
  const semantic = candidate.semanticContext
  if (!semantic) {
    return [] as Array<{ label: string; value: string | null }>
  }

  const hierarchy = semantic.hierarchy.join(' · ')
  const alternativeCategories = semantic.alternativeCategories
    .map((item) => sanitizeUserFacingResolvedLabel(item.label))
    .filter(Boolean)
    .join(', ')

  return [
    { label: t('results.primarySeries'), value: sanitizeUserFacingResolvedLabel(semantic.primaryTitle) },
    { label: t('results.source'), value: sanitizeUserFacingPublisher(semantic.source?.label ?? candidate.source) },
    { label: t('results.release'), value: sanitizeUserFacingResolvedLabel(semantic.release?.label) },
    { label: t('results.category'), value: sanitizeUserFacingResolvedLabel(semantic.category?.label) },
    { label: t('results.concept'), value: sanitizeUserFacingResolvedLabel(semantic.concept?.label) },
    { label: t('results.seriesPath'), value: sanitizeUserFacingResolvedLabel(hierarchy || semantic.fullDescription) },
    { label: t('results.alternativeCategories'), value: alternativeCategories || null },
    { label: t('results.releaseCalendar'), value: formatSemanticDate(locale, semantic.release?.nextReleaseAt ?? null) },
  ].filter((row) => row.value)
}

function renderSemanticLink(label: string, href: string | null) {
  if (!href) {
    return null
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-teal-700 underline decoration-teal-200 underline-offset-2 hover:text-teal-900">
      {label}
    </a>
  )
}

export function BenchmarkFinderClient({
  locale,
  selectionMode = 'standalone',
  onBenchmarkSelected,
  initialMode,
  initialSearchQuery = '',
  initialAiPrompt = '',
  showPorrDemoPortfolio = false,
}: BenchmarkFinderClientProps) {
  const persistence = useSg2BrowserPersistencePolicy()
  const identityMode = useSg2IdentityMode()
  const sessionCredential=useSg2SessionCredential()
  const discoveryPresentationRef=useRef({identityMode,sessionCredential})
  discoveryPresentationRef.current={identityMode,sessionCredential}
  const discoveryRequestRef=useRef<ReturnType<typeof createDiscoveryRequester>|null>(null)
  const discoveryActiveRef=useRef(true)
  useEffect(()=>{discoveryActiveRef.current=true;return()=>{
    discoveryActiveRef.current=false;discoveryRequestRef.current?.close();discoveryRequestRef.current=null
  }},[])
  const discoveryFetch=(input:string,init?:RequestInit)=>{
    if(!discoveryActiveRef.current)return Promise.reject(Error('Session unavailable'))
    if(!discoveryRequestRef.current)discoveryRequestRef.current=createDiscoveryRequester({
      mode:()=>discoveryPresentationRef.current.identityMode,
      getToken:async()=>discoveryPresentationRef.current.sessionCredential?.()??null,
      origin:()=>window.location.origin,fetch:(...args)=>fetch(...args),newKey:()=> 'finder_'+crypto.randomUUID(),
    })
    return discoveryRequestRef.current(input,init)
  }
  const t = useTranslations('BenchmarkFinder')
  const router = useRouter()
  const searchParams = useSearchParams()
  const alternateLocale = locale === 'en' ? 'pl' : 'en'
  const forecastWarmupExperiment = normalizeForecastWarmupExperiment(
    searchParams.get(FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM),
  )
  const isPickerMode = selectionMode === 'picker' && typeof onBenchmarkSelected === 'function'
  const initialLocaleSwitchSnapshotRef = useRef<LocaleSwitchSnapshot | null>(readLocaleSwitchSnapshot(locale, persistence))
  const localeSnapshotHandledRef = useRef(!initialLocaleSwitchSnapshotRef.current)
  const initialLocaleSwitchSnapshot = initialLocaleSwitchSnapshotRef.current
  const [mode, setMode] = useState<DiscoveryMode>(initialLocaleSwitchSnapshot?.mode ?? initialMode ?? (initialAiPrompt.trim() ? 'ai' : 'search'))
  const [searchSurfaceMode, setSearchSurfaceMode] = useState<SearchSurfaceMode>(initialLocaleSwitchSnapshot?.searchSurfaceMode ?? 'simple')
  const [onlyForecast,setOnlyForecast]=useState(false)
  const [resultSort,setResultSort]=useState('relevance')
  const [query, setQuery] = useState(initialLocaleSwitchSnapshot?.query ?? initialSearchQuery)
  const [exactSeriesId, setExactSeriesId] = useState(initialLocaleSwitchSnapshot?.exactSeriesId ?? '')
  const [aiPrompt, setAiPrompt] = useState(initialLocaleSwitchSnapshot?.aiPrompt ?? initialAiPrompt)
  const [results, setResults] = useState<BenchmarkCandidate[]>(initialLocaleSwitchSnapshot?.results ?? [])
  const [saved, setSaved] = useState<SavedBenchmark[]>([])
  const [previewStates, setPreviewStates] = useState<Record<string, CandidatePreviewState>>(initialLocaleSwitchSnapshot?.previewStates ?? {})
  const [analyticsFrameHeights, setAnalyticsFrameHeights] = useState<Record<string, number>>({})
  const [aiIntent, setAiIntent] = useState<BenchmarkSearchIntent | null>(initialLocaleSwitchSnapshot?.aiIntent ?? null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(initialLocaleSwitchSnapshot?.hasSearched ?? false)
  const [visibleResultCount, setVisibleResultCount] = useState(initialLocaleSwitchSnapshot?.visibleResultCount ?? RESULT_PREVIEW_LIMIT)
  const [metadataDefinitions, setMetadataDefinitions] = useState<BenchmarkMetadataDefinition[]>(initialLocaleSwitchSnapshot?.metadataDefinitions ?? [])
  const [metadataDefinitionsLoaded, setMetadataDefinitionsLoaded] = useState(initialLocaleSwitchSnapshot?.metadataDefinitionsLoaded ?? false)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(initialLocaleSwitchSnapshot?.selectedFilters ?? {})
  const [metadataValuesByKey, setMetadataValuesByKey] = useState<Record<string, MetadataValueState>>(initialLocaleSwitchSnapshot?.metadataValuesByKey ?? {})
  const [metadataValueSearchByKey, setMetadataValueSearchByKey] = useState<Record<string, string>>(initialLocaleSwitchSnapshot?.metadataValueSearchByKey ?? {})
  const [openMetadataKey, setOpenMetadataKey] = useState<string | null>(null)
  const [enrichedCandidates, setEnrichedCandidates] = useState<Record<string, BenchmarkCandidate>>(initialLocaleSwitchSnapshot?.enrichedCandidates ?? {})
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([])
  const [pendingPortfolioSeriesId, setPendingPortfolioSeriesId] = useState<string | null>(null)
  const [isSearching, startSearchTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [isLoadingSaved, startSavedTransition] = useTransition()
  const searchTimingRef = useRef<SearchTiming | null>(null)
  const searchCounterRef = useRef(0)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const advancedInputRef = useRef<HTMLInputElement | null>(null)
  const advancedOpenStartedAtRef = useRef<number | null>(null)
  const advancedOpenLoggedRef = useRef(false)
  const metadataAbortControllersRef = useRef<Record<string, AbortController>>({})
  const searchAbortControllerRef = useRef<AbortController | null>(null)
  const previewAbortControllersRef = useRef<Record<string, AbortController>>({})
  const analyticsEligibilityAbortControllersRef = useRef<Record<string, AbortController>>({})
  const semanticContextAbortControllerRef = useRef<AbortController | null>(null)
  const activeSearchRequestRef = useRef(0)
  const activePreviewRequestsRef = useRef<Record<string, number>>({})
  const activeAnalyticsEligibilityRequestsRef = useRef<Record<string, number>>({})
  const analyticsEligibilityCacheRef = useRef<Record<string, AnalyticsEligibilityResponse>>({})
  const metadataDefinitionsRequestRef = useRef<Promise<BenchmarkMetadataDefinition[]> | null>(null)
  const metadataPreparationPromiseRef = useRef<Promise<void> | null>(null)
  const metadataValueRequestKeysRef = useRef<Record<string, string>>({})
  const localizedMetadataDefinitions = localizeMetadataDefinitions(metadataDefinitions, locale)
  const featuredDefinitions = localizedMetadataDefinitions.filter((definition) => definition.featured)
  const hasExplicitInitialState = Boolean(initialMode || initialSearchQuery.trim() || initialAiPrompt.trim())
  const activeFilterChips = buildActiveFilters(selectedFilters, localizedMetadataDefinitions, metadataValuesByKey)
  const prewarmedFacetsReady = countReadyMetadataPrewarmFacets(metadataValuesByKey)

  function pushRecentSearch(entry: Omit<RecentSearchEntry, 'id' | 'createdAt'>) {
    const recentEntry: RecentSearchEntry = {
      ...entry,
      id: buildRecentSearchId(entry),
      createdAt: new Date().toISOString(),
    }

    setRecentSearches((current) => {
      const next = [recentEntry, ...current.filter((item) => item.id !== recentEntry.id)].slice(0, RECENT_SEARCH_LIMIT)
      saveRecentSearchesToSession(next, persistence)
      return next
    })
  }

  function clearRecentSearches() {
    setRecentSearches([])
    saveRecentSearchesToSession([], persistence)
  }

  function handleMetadataSelectorOpenChange(metadataKey: string, nextOpen: boolean) {
    setOpenMetadataKey((current) => {
      if (nextOpen) {
        return metadataKey
      }

      return current === metadataKey ? null : current
    })
  }

  async function loadSavedBenchmarks() {
    setSavedError(null)
    const payload = await readJson<{ items: SavedBenchmark[] }>(await fetch('/api/benchmark/selection', { cache: 'no-store' }))
    setSaved(payload.items)
  }

  async function loadMetadataDefinitions(): Promise<BenchmarkMetadataDefinition[]> {
    if (metadataDefinitionsLoaded) {
      return metadataDefinitions
    }

    if (metadataDefinitionsRequestRef.current) {
      return metadataDefinitionsRequestRef.current
    }

    const request = (async () => {
      setMetadataError(null)
      const payload = await readJson<{ items: BenchmarkMetadataDefinition[] }>(await discoveryFetch('/api/benchmark/metadata', { cache: 'no-store' }))
      setMetadataDefinitions(payload.items)
      setMetadataDefinitionsLoaded(true)
      return payload.items
    })()

    metadataDefinitionsRequestRef.current = request

    try {
      return await request
    } finally {
      if (metadataDefinitionsRequestRef.current === request) {
        metadataDefinitionsRequestRef.current = null
      }
    }
  }

  async function loadMetadataValues(metadataKey: string, nextSearchQuery?: string, options?: { suppressGlobalError?: boolean }) {
    const remoteFiltering = shouldUseRemoteMetadataQuery(metadataKey)
    const normalizedQuery = (nextSearchQuery ?? metadataValueSearchByKey[metadataKey] ?? '').trim()
    const filters = buildSearchFilters(selectedFilters).filter((filter) => filter.metadataKey !== metadataKey)
    const filterSignature = buildFilterParam(filters)
    const current = metadataValuesByKey[metadataKey]

    if (remoteFiltering && normalizedQuery.length < REMOTE_METADATA_QUERY_MIN_LENGTH) {
      setMetadataValuesByKey((previous) => ({
        ...previous,
        [metadataKey]: {
          status: 'idle',
          items: previous[metadataKey]?.items ?? [],
          totalCount: previous[metadataKey]?.totalCount ?? 0,
          filteredCount: previous[metadataKey]?.filteredCount ?? 0,
          query: normalizedQuery,
          limited: false,
          filterSignature,
        },
      }))
      return
    }

    if (shouldReuseMetadataValueState(current, filterSignature, normalizedQuery)) {
      console.info(`[METADATA_PERF] key=${metadataKey} cacheHit=true values=${current.items.length}`)
      return
    }

    const requestKey = buildMetadataValueRequestKey(metadataKey, filterSignature, normalizedQuery)
    if (isDuplicateMetadataValueRequest(metadataValueRequestKeysRef.current[metadataKey], requestKey)) {
      return
    }

    setMetadataError(null)
    metadataAbortControllersRef.current[metadataKey]?.abort()
    const controller = new AbortController()
    metadataAbortControllersRef.current[metadataKey] = controller
    metadataValueRequestKeysRef.current[metadataKey] = requestKey
    const startedAt = performance.now()

    setMetadataValuesByKey((previous) => ({
      ...previous,
      [metadataKey]: {
        status: 'loading',
        items: previous[metadataKey]?.items ?? [],
        totalCount: previous[metadataKey]?.totalCount ?? 0,
        filteredCount: previous[metadataKey]?.filteredCount ?? 0,
        query: normalizedQuery,
        limited: previous[metadataKey]?.limited ?? false,
        filterSignature,
      },
    }))

    try {
      const payload = await readJson<MetadataValuesResponse>(await discoveryFetch(buildMetadataValuesRequestPath({
        metadataKey,
        filterSignature,
        remoteFiltering,
        query: normalizedQuery,
        limit: MAX_METADATA_VISIBLE_ITEMS,
      }), {
        cache: 'no-store',
        signal: controller.signal,
      }))
      if (controller.signal.aborted) {
        return
      }

      setMetadataValuesByKey((previous) => ({
        ...previous,
        [metadataKey]: {
          status: 'ready',
          items: payload.items,
          totalCount: payload.totalCount,
          filteredCount: payload.filteredCount,
          query: payload.query,
          limited: payload.limited,
          filterSignature,
        },
      }))
      console.info(`[METADATA_PERF] key=${metadataKey} fetchMs=${Math.round(performance.now() - startedAt)} values=${payload.items.length} total=${payload.totalCount} filtered=${payload.filteredCount} cacheHit=false renderedLimit=${MAX_METADATA_VISIBLE_ITEMS} remote=${remoteFiltering}`)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      setMetadataValuesByKey((previous) => ({
        ...previous,
        [metadataKey]: {
          status: 'error',
          items: previous[metadataKey]?.items ?? [],
          totalCount: previous[metadataKey]?.totalCount ?? 0,
          filteredCount: previous[metadataKey]?.filteredCount ?? 0,
          query: normalizedQuery,
          limited: previous[metadataKey]?.limited ?? false,
          filterSignature,
        },
      }))
        if (!options?.suppressGlobalError) {
          setMetadataError(resolveErrorMessage('metadata', locale, error, t))
        }
    } finally {
      if (metadataAbortControllersRef.current[metadataKey] === controller) {
        delete metadataAbortControllersRef.current[metadataKey]
      }
      if (metadataValueRequestKeysRef.current[metadataKey] === requestKey) {
        delete metadataValueRequestKeysRef.current[metadataKey]
      }
    }
  }

  function prepareMetadataInBackground() {
    if (metadataPreparationPromiseRef.current) {
      return metadataPreparationPromiseRef.current
    }

    const request = prepareAdvancedMetadata({
      metadataDefinitionsLoaded,
      metadataDefinitions,
      loadMetadataDefinitions,
      prewarmMetadataValue: (metadataKey) => loadMetadataValues(metadataKey, undefined, { suppressGlobalError: true }),
    })
      .then((result) => {
        console.info(
          `[METADATA_PREFETCH] definitionsLoaded=true prewarmedFacetsReady=${result.prewarmedKeys.length} prewarmTargets=${result.prewarmKeys.length} prewarmFailures=${result.failedKeys.length}`,
        )
      })
      .catch((error: unknown) => {
        console.warn('[METADATA_PREFETCH_FAILED]', error)
      })
      .finally(() => {
        if (metadataPreparationPromiseRef.current === request) {
          metadataPreparationPromiseRef.current = null
        }
      })

    metadataPreparationPromiseRef.current = request
    return request
  }

  function queueMetadataValueLoad(metadataKey: string, nextSearchQuery?: string) {
    startSearchTransition(() => {
      loadMetadataValues(metadataKey, nextSearchQuery).catch(() => undefined)
    })
  }

  function openSearchSurface(nextSurfaceMode: SearchSurfaceMode) {
    setMode('search')
    setSearchSurfaceMode(nextSurfaceMode)
  }

  function switchLocale(nextLocale: 'pl' | 'en') {
    if (nextLocale === locale) {
      return
    }

    saveLocaleSwitchSnapshot({
      targetLocale: nextLocale,
      expiresAt: Date.now() + FINDER_LOCALE_SWITCH_STATE_TTL_MS,
      mode,
      searchSurfaceMode,
      query,
      exactSeriesId,
      aiPrompt,
      results,
      previewStates,
      aiIntent,
      hasSearched,
      visibleResultCount,
      selectedFilters,
      metadataDefinitions,
      metadataDefinitionsLoaded,
      metadataValuesByKey,
      metadataValueSearchByKey,
      enrichedCandidates,
    }, persistence)

    const nextPath = forecastWarmupExperiment
      ? `/${nextLocale}/benchmark-finder?${FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM}=${encodeURIComponent(forecastWarmupExperiment)}`
      : `/${nextLocale}/benchmark-finder`

    router.push(nextPath)
  }

  function openAdvancedSearchSurface() {
    advancedOpenStartedAtRef.current = performance.now()
    advancedOpenLoggedRef.current = false
    openSearchSurface('advanced')
  }

  function getCandidatePreviewState(seriesId: string, source?: Record<string, CandidatePreviewState>) {
    return source?.[seriesId] ?? previewStates[seriesId] ?? createDefaultCandidatePreviewState()
  }

  function setCandidatePreviewState(seriesId: string, updater: (state: CandidatePreviewState) => CandidatePreviewState) {
    setPreviewStates((current) => ({
      ...current,
      [seriesId]: updater(current[seriesId] ?? createDefaultCandidatePreviewState()),
    }))
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (identityMode !== 'legacy_demo') return

    const handleAnalyticsResize = (event: MessageEvent) => {
      const payload = event.data
      if (
        !payload
        || typeof payload !== 'object'
        || payload.type !== 'sg-dashboard-preview:resize'
        || typeof payload.seriesId !== 'string'
        || typeof payload.height !== 'number'
      ) {
        return
      }
      const seriesId = payload.seriesId
      const minAnalyticsHeight = window.innerWidth < MOBILE_ANALYTICS_BREAKPOINT
        ? MOBILE_ANALYTICS_IFRAME_MIN_HEIGHT
        : DESKTOP_ANALYTICS_IFRAME_MIN_HEIGHT
      const nextHeight = Math.max(minAnalyticsHeight, Math.ceil(payload.height))
      setAnalyticsFrameHeights((current) => (current[seriesId] === nextHeight ? current : { ...current, [seriesId]: nextHeight }))
    }

    window.addEventListener('message', handleAnalyticsResize)
    return () => {
      window.removeEventListener('message', handleAnalyticsResize)
    }
  }, [identityMode])

  function abortSearchRequest() {
    activeSearchRequestRef.current += 1
    searchAbortControllerRef.current?.abort()
    searchAbortControllerRef.current = null
  }

  function abortPreviewRequest(seriesId?: string) {
    if (seriesId) {
      activePreviewRequestsRef.current[seriesId] = (activePreviewRequestsRef.current[seriesId] ?? 0) + 1
      previewAbortControllersRef.current[seriesId]?.abort()
      delete previewAbortControllersRef.current[seriesId]
      return
    }

    for (const key of Object.keys(previewAbortControllersRef.current)) {
      previewAbortControllersRef.current[key]?.abort()
    }
    previewAbortControllersRef.current = {}
    activePreviewRequestsRef.current = {}
  }

  function abortAnalyticsEligibilityRequest(seriesId?: string) {
    if (seriesId) {
      activeAnalyticsEligibilityRequestsRef.current[seriesId] = (activeAnalyticsEligibilityRequestsRef.current[seriesId] ?? 0) + 1
      analyticsEligibilityAbortControllersRef.current[seriesId]?.abort()
      delete analyticsEligibilityAbortControllersRef.current[seriesId]
      return
    }

    for (const key of Object.keys(analyticsEligibilityAbortControllersRef.current)) {
      analyticsEligibilityAbortControllersRef.current[key]?.abort()
    }
    analyticsEligibilityAbortControllersRef.current = {}
    activeAnalyticsEligibilityRequestsRef.current = {}
  }

  function abortSemanticContextRequest() {
    semanticContextAbortControllerRef.current?.abort()
    semanticContextAbortControllerRef.current = null
  }

  function collapsePreview(seriesId: string) {
    abortPreviewRequest(seriesId)
    abortAnalyticsEligibilityRequest(seriesId)
    setCandidatePreviewState(seriesId, (current) => ({
      ...current,
      expanded: false,
    }))
  }

  function resetVisibleSearchState() {
    abortPreviewRequest()
    abortAnalyticsEligibilityRequest()
    abortSemanticContextRequest()
    setResults([])
    setHasSearched(false)
    setVisibleResultCount(RESULT_PREVIEW_LIMIT)
    setPreviewStates({})
    setAnalyticsFrameHeights({})
  }

  function beginSearchRequest() {
    abortSearchRequest()
    const requestId = activeSearchRequestRef.current
    const controller = new AbortController()
    searchAbortControllerRef.current = controller
    resetVisibleSearchState()
    return { requestId, controller }
  }

  function isActiveSearchRequest(requestId: number, controller: AbortController) {
    return activeSearchRequestRef.current === requestId && searchAbortControllerRef.current === controller && !controller.signal.aborted
  }

  function beginPreviewRequest(seriesId: string) {
    abortPreviewRequest(seriesId)
    const requestId = (activePreviewRequestsRef.current[seriesId] ?? 0) + 1
    activePreviewRequestsRef.current[seriesId] = requestId
    const controller = new AbortController()
    previewAbortControllersRef.current[seriesId] = controller
    return { requestId, controller }
  }

  function isActivePreviewRequest(seriesId: string, requestId: number, controller: AbortController) {
    return activePreviewRequestsRef.current[seriesId] === requestId
      && previewAbortControllersRef.current[seriesId] === controller
      && !controller.signal.aborted
  }

  function clearSearchState() {
    abortSearchRequest()
    abortPreviewRequest()
    abortAnalyticsEligibilityRequest()
    abortSemanticContextRequest()
    setQuery('')
    setExactSeriesId('')
    setAiPrompt('')
    setAiIntent(null)
    setResults([])
    setHasSearched(false)
    setSearchError(null)
    setPreviewError(null)
    setNotice(null)
    setVisibleResultCount(RESULT_PREVIEW_LIMIT)
    setPreviewStates({})
    setAnalyticsFrameHeights({})
    setSelectedFilters({})
    setMetadataValueSearchByKey({})
    setOpenMetadataKey(null)
    setEnrichedCandidates({})
  }

  function beginSearchTiming(modeValue: 'simple' | 'advanced' | 'exact') {
    const now = performance.now()
    searchCounterRef.current += 1
    searchTimingRef.current = {
      searchId: searchCounterRef.current,
      mode: modeValue,
      submitAt: now,
      fetchStartAt: now,
      responseAt: null,
      visibleLogged: false,
    }
    return searchCounterRef.current
  }

  function markSearchResponse(searchId: number) {
    const current = searchTimingRef.current
    if (!current || current.searchId !== searchId) {
      return
    }

    current.responseAt = performance.now()
    searchTimingRef.current = current
  }

  async function runSearch(nextQuery = query) {
    const normalizedQuery = nextQuery.trim()
    setSearchError(null)
    setPreviewError(null)
    setMetadataError(null)
    setNotice(null)
    setAiIntent(null)
    setMode('search')
    setSearchSurfaceMode('simple')

    if (!normalizedQuery) {
      setQuery('')
      setResults([])
      setPreviewStates({})
      setHasSearched(false)
      setVisibleResultCount(RESULT_PREVIEW_LIMIT)
      return
    }

    const { requestId, controller } = beginSearchRequest()
    const searchId = beginSearchTiming('simple')
    try {
      const params = new URLSearchParams({ q: normalizedQuery, limit: String(SEARCH_RESULTS_FETCH_LIMIT) })
      const payload = await readJson<{ items: BenchmarkCandidate[] }>(await discoveryFetch(`/api/benchmark/search?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }))

      if (!isActiveSearchRequest(requestId, controller)) {
        return
      }

      markSearchResponse(searchId)
      setQuery(normalizedQuery)
      setResults(payload.items)
      setHasSearched(true)
      setVisibleResultCount(RESULT_PREVIEW_LIMIT)
      pushRecentSearch({
        mode: 'simple',
        label: normalizedQuery,
        detail: null,
        query: normalizedQuery,
        exactSeriesId: '',
        aiPrompt: '',
        filters: {},
      })
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return
      }

      throw error
    } finally {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null
      }
    }
  }

  async function runAdvancedSearch(nextState?: {
    query?: string
    exactSeriesId?: string
    filters?: Record<string, string[]>
  }) {
    setSearchError(null)
    setPreviewError(null)
    setMetadataError(null)
    setNotice(null)
    setAiIntent(null)
    setMode('search')
    setSearchSurfaceMode('advanced')

    const nextFilters = cloneRecentFilters(nextState?.filters ?? selectedFilters)
    const normalizedQuery = (nextState?.query ?? query).trim()
    const normalizedExactSeriesId = (nextState?.exactSeriesId ?? exactSeriesId).trim()
    const filters = buildSearchFilters(nextFilters)

    if (!normalizedQuery && !normalizedExactSeriesId) {
      setSearchError(t('errors.advancedInputRequired'))
      return []
    }

    const { requestId, controller } = beginSearchRequest()
    const searchId = beginSearchTiming(normalizedExactSeriesId ? 'exact' : 'advanced')
    try {
      const payload = await readJson<{ items: BenchmarkCandidate[] }>(await discoveryFetch('/api/benchmark/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: normalizedQuery || undefined,
          exactSeriesId: normalizedExactSeriesId || undefined,
          filters,
          limit: SEARCH_RESULTS_FETCH_LIMIT,
        }),
        signal: controller.signal,
      }))

      if (!isActiveSearchRequest(requestId, controller)) {
        return
      }

      markSearchResponse(searchId)
      setQuery(normalizedQuery)
      setExactSeriesId(normalizedExactSeriesId)
      setSelectedFilters(nextFilters)
      setResults(payload.items)
      setHasSearched(true)
      setVisibleResultCount(RESULT_PREVIEW_LIMIT)
      pushRecentSearch({
        mode: 'advanced',
        label: normalizedExactSeriesId || normalizedQuery,
        detail: normalizedExactSeriesId && normalizedQuery
          ? normalizedQuery
          : filters.length > 0
            ? `${filters.length} filters`
            : null,
        query: normalizedQuery,
        exactSeriesId: normalizedExactSeriesId,
        aiPrompt: '',
        filters: nextFilters,
      })

      if (normalizedExactSeriesId && payload.items.length === 0) {
        setSearchError(t('errors.exactNotFound'))
      }

      return payload.items
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return []
      }

      throw error
    } finally {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null
      }
    }
  }

  async function openPorrDemoPortfolioBenchmark(seriesId: string) {
    setPendingPortfolioSeriesId(seriesId)
    const items = await runAdvancedSearch({ query: '', exactSeriesId: seriesId, filters: {} })
    if (!(items ?? []).some((item) => item.providerSeries.providerSeriesId === seriesId)) {
      setPendingPortfolioSeriesId(null)
    }
  }

  async function runAiSearch(nextPrompt = aiPrompt) {
    const normalizedPrompt = nextPrompt.trim()
    setSearchError(null)
    setPreviewError(null)
    setMetadataError(null)
    setNotice(null)
    setMode('ai')

    if (!normalizedPrompt) {
      setAiPrompt('')
      setAiIntent(null)
      setResults([])
      setPreviewStates({})
      setHasSearched(false)
      setVisibleResultCount(RESULT_PREVIEW_LIMIT)
      return
    }

    const { requestId, controller } = beginSearchRequest()

    try {
      const payload = await readJson<BenchmarkAiSearchResult>(await discoveryFetch('/api/benchmark/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: normalizedPrompt }),
        signal: controller.signal,
      }))

      if (!isActiveSearchRequest(requestId, controller)) {
        return
      }

      setAiPrompt(normalizedPrompt)
      setAiIntent(payload.intent)
      setResults(payload.candidates)
      setHasSearched(true)
      setVisibleResultCount(RESULT_PREVIEW_LIMIT)
      pushRecentSearch({
        mode: 'ai',
        label: normalizedPrompt,
        detail: payload.intent.interpretation,
        query: '',
        exactSeriesId: '',
        aiPrompt: normalizedPrompt,
        filters: {},
      })
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return
      }

      throw error
    } finally {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null
      }
    }
  }

  async function ensureAnalyticsEligibility(candidate: BenchmarkCandidate) {
    const seriesId = candidate.providerSeries.providerSeriesId
    const currentState = getCandidatePreviewState(seriesId)
    if (currentState.analyticsEligibility.status === 'loading' || currentState.analyticsEligibility.status === 'ready') {
      return
    }

    const cacheKey = `${locale}:${seriesId}:${forecastWarmupExperiment ?? 'off'}`
    const cachedEligibility = analyticsEligibilityCacheRef.current[cacheKey]
    if (cachedEligibility) {
      setCandidatePreviewState(seriesId, (state) => ({
        ...state,
        analyticsEligibility: { status: 'ready', ...cachedEligibility },
      }))
      return
    }

    abortAnalyticsEligibilityRequest(seriesId)
    const requestId = (activeAnalyticsEligibilityRequestsRef.current[seriesId] ?? 0) + 1
    activeAnalyticsEligibilityRequestsRef.current[seriesId] = requestId
    const controller = new AbortController()
    analyticsEligibilityAbortControllersRef.current[seriesId] = controller

    setCandidatePreviewState(seriesId, (state) => ({
      ...state,
      analyticsEligibility: {
        status: 'loading',
        eligible: false,
        componentCode: null,
        analyticsUrl: null,
        forecastPortfolioEnabled: false,
      },
    }))

    const params = new URLSearchParams({
      locale,
      seriesId,
      displayName: candidate.displayName,
    })
    if (forecastWarmupExperiment) {
      params.set(FORECAST_WARMUP_EXPERIMENT_SEARCH_PARAM, forecastWarmupExperiment)
    }

    try {
      const payload = await readJson<AnalyticsEligibilityResponse>(await fetch(`/api/benchmark/analytics-eligibility?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }))

      if (activeAnalyticsEligibilityRequestsRef.current[seriesId] !== requestId
        || analyticsEligibilityAbortControllersRef.current[seriesId] !== controller
        || controller.signal.aborted) {
        return
      }

      analyticsEligibilityCacheRef.current[cacheKey] = payload
      setCandidatePreviewState(seriesId, (state) => ({
        ...state,
        analyticsEligibility: { status: 'ready', ...payload },
      }))
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return
      }

      if (activeAnalyticsEligibilityRequestsRef.current[seriesId] !== requestId
        || analyticsEligibilityAbortControllersRef.current[seriesId] !== controller) {
        return
      }

      const payload = {
        eligible: false,
        componentCode: null,
        analyticsUrl: null,
        forecastPortfolioEnabled: false,
      }
      analyticsEligibilityCacheRef.current[cacheKey] = payload
      setCandidatePreviewState(seriesId, (state) => ({
        ...state,
        analyticsEligibility: { status: 'ready', ...payload },
      }))
    } finally {
      if (analyticsEligibilityAbortControllersRef.current[seriesId] === controller) {
        delete analyticsEligibilityAbortControllersRef.current[seriesId]
      }
    }
  }

  async function loadPreview(candidate: BenchmarkCandidate, nextRange: BenchmarkRangePreset) {
    const seriesId = candidate.providerSeries.providerSeriesId
    const currentState = getCandidatePreviewState(seriesId)
    if (currentState.previewStatus === 'loading') {
      return
    }

    if (currentState.previewStatus === 'ready' && currentState.preview && currentState.range === nextRange) {
      return
    }

    const { requestId, controller } = beginPreviewRequest(seriesId)

    setCandidatePreviewState(seriesId, (current) => ({
      ...current,
      range: nextRange,
      previewStatus: 'loading',
      preview: current.range === nextRange ? current.preview : null,
      previewError: null,
    }))

    try {
      const params = new URLSearchParams({
        seriesName: seriesId,
        range: nextRange,
      })
      const payload = await readJson<BenchmarkPreviewResult>(await fetch(`/api/benchmark/preview?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      }))

      if (!isActivePreviewRequest(seriesId, requestId, controller)) {
        return
      }

      setCandidatePreviewState(seriesId, (current) => ({
        ...current,
        range: nextRange,
        previewStatus: 'ready',
        preview: payload,
        previewError: null,
      }))
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return
      }

      setCandidatePreviewState(seriesId, (current) => ({
        ...current,
        range: nextRange,
        previewStatus: 'error',
        preview: null,
        previewError: resolveErrorMessage('preview', locale, error, t),
      }))
    } finally {
      if (previewAbortControllersRef.current[seriesId] === controller) {
        delete previewAbortControllersRef.current[seriesId]
      }
    }
  }

  function togglePreviewCard(candidate: BenchmarkCandidate) {
    const seriesId = candidate.providerSeries.providerSeriesId
    const current = getCandidatePreviewState(seriesId)
    if (current.expanded) {
      collapsePreview(seriesId)
      return
    }

    setCandidatePreviewState(seriesId, (state) => ({
      ...state,
      expanded: true,
      analyticsVisible: true,
      previewError: null,
    }))

    startSearchTransition(() => {
      ensureAnalyticsEligibility(candidate).catch(() => undefined)
      loadPreview(candidate, current.range).catch(() => undefined)
    })
  }

  async function saveCandidate(candidate: BenchmarkCandidate) {
    setSearchError(null)
    setPreviewError(null)
    setNotice(null)

    const alreadySaved = saved.some((item) => item.providerSeries.providerSeriesId === candidate.providerSeries.providerSeriesId)
    if (alreadySaved) {
      setNotice(t('selection.alreadyAdded'))
      const existing = saved.find((item) => item.providerSeries.providerSeriesId === candidate.providerSeries.providerSeriesId)
      return existing ?? null
    }

    const payload = await readJson<SavedBenchmark>(await fetch('/api/benchmark/selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate }),
    }))
    setNotice(t('selection.savedSuccess'))
    setSaved((current) => [payload, ...current.filter((item) => item.selectionId !== payload.selectionId)])
    return payload
  }

  async function handleBenchmarkUse(candidate: BenchmarkCandidate) {
    if (isPickerMode) {
      const existing = saved.find((item) => item.providerSeries.providerSeriesId === candidate.providerSeries.providerSeriesId)
      if (existing) {
        onBenchmarkSelected(existing)
        return
      }

      const payload = await saveCandidate(candidate)
      if (payload) {
        onBenchmarkSelected(payload)
      }
      return
    }

    await saveCandidate(candidate)
  }

  async function handleStartBuildingCategory(candidate: BenchmarkCandidate) {
    const existing = saved.find((item) => item.providerSeries.providerSeriesId === candidate.providerSeries.providerSeriesId)
    const payload = existing ?? await saveCandidate(candidate)
    if (!payload) {
      return
    }

    router.push(`/${locale}/category-builder?seedBenchmarkId=${encodeURIComponent(payload.businessBenchmarkId)}`)
  }

  async function ensureSemanticContext(candidates: BenchmarkCandidate[]) {
    const pendingSeriesIds = [...new Set(candidates
      .map((candidate) => candidate.providerSeries.providerSeriesId)
      .filter((seriesId) => {
        const enriched = enrichedCandidates[seriesId]
        return !enriched?.semanticContext
      }))]

    if (pendingSeriesIds.length === 0) {
      return
    }

    semanticContextAbortControllerRef.current?.abort()
    const controller = new AbortController()
    semanticContextAbortControllerRef.current = controller

    const payload = await readJson<BenchmarkContextResponse>(await discoveryFetch('/api/benchmark/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesIds: pendingSeriesIds }),
      signal: controller.signal,
    }))

    if (controller.signal.aborted || semanticContextAbortControllerRef.current !== controller) {
      return
    }

    setEnrichedCandidates((current) => {
      const next = { ...current }
      for (const candidate of candidates) {
        const seriesId = candidate.providerSeries.providerSeriesId
        const semanticContext = payload.items[seriesId]
        if (!semanticContext) {
          continue
        }

        next[seriesId] = {
          ...(current[seriesId] ?? candidate),
          semanticContext,
        }
      }
      return next
    })

    if (semanticContextAbortControllerRef.current === controller) {
      semanticContextAbortControllerRef.current = null
    }
  }

  useEffect(() => {
    setRecentSearches(loadRecentSearchesFromSession(persistence))
  }, [persistence])

  useEffect(() => {
    void prepareMetadataInBackground()
  }, [locale])

  useEffect(() => {
    startSavedTransition(() => {
      loadSavedBenchmarks().catch((loadError: unknown) => setSavedError(resolveErrorMessage('saved', locale, loadError, t)))
    })
  }, [locale, t])

  useEffect(() => {
    if (mode === 'search' && searchSurfaceMode === 'advanced') {
      startSearchTransition(() => {
        loadMetadataDefinitions().catch((error: unknown) => setMetadataError(resolveErrorMessage('metadata', locale, error, t)))
      })
    }
  }, [locale, mode, searchSurfaceMode, t])

  useEffect(() => {
    return () => {
      abortSearchRequest()
      abortPreviewRequest()
      abortAnalyticsEligibilityRequest()
      abortSemanticContextRequest()
      Object.values(metadataAbortControllersRef.current).forEach((controller) => controller.abort())
    }
  }, [])

  useEffect(() => {
    if (!localeSnapshotHandledRef.current) {
      localeSnapshotHandledRef.current = true
      return
    }

    if (!hasExplicitInitialState) {
      return
    }

    setMode(initialMode ?? (initialAiPrompt.trim() ? 'ai' : 'search'))
    setSearchSurfaceMode('simple')
    setQuery(initialSearchQuery)
    setExactSeriesId('')
    setAiPrompt(initialAiPrompt)
    setResults([])
    setPreviewStates({})
    setAiIntent(null)
    setSearchError(null)
    setPreviewError(null)
    setMetadataError(null)
    setNotice(null)
    setHasSearched(false)
    setVisibleResultCount(RESULT_PREVIEW_LIMIT)
    setSelectedFilters({})
    setMetadataValueSearchByKey({})
    setOpenMetadataKey(null)
    setEnrichedCandidates({})
  }, [hasExplicitInitialState, initialAiPrompt, initialMode, initialSearchQuery])

  useEffect(() => {
    const timing = searchTimingRef.current
    if (!timing || timing.visibleLogged || timing.responseAt === null || isSearching || !hasSearched) {
      return
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const visibleAt = performance.now()
        const firstCardVisible = Boolean(resultsRef.current?.querySelector('[data-testid="benchmark-result-card"]'))
        console.info(
          `[BENCHMARK_SEARCH_UI_PERF] mode=${timing.mode} clickToResponseMs=${Math.round(timing.responseAt! - timing.submitAt)} responseToVisibleMs=${Math.round(visibleAt - timing.responseAt!)} clickToVisibleMs=${Math.round(visibleAt - timing.submitAt)} firstCardVisible=${firstCardVisible} resultCount=${results.length}`,
        )
        timing.visibleLogged = true
        searchTimingRef.current = timing
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [hasSearched, isSearching, results])

  useEffect(() => {
    if (mode !== 'search' || searchSurfaceMode !== 'advanced' || advancedOpenLoggedRef.current) {
      return
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const startedAt = advancedOpenStartedAtRef.current
        if (startedAt === null) {
          return
        }

        const interactiveAt = performance.now()
        console.info(
          `[ADVANCED_PERF] interactiveMs=${Math.round(interactiveAt - startedAt)} definitionsLoaded=${metadataDefinitionsLoaded} prewarmedFacetsReady=${prewarmedFacetsReady} featuredFilters=${featuredDefinitions.length} searchInputReady=${Boolean(advancedInputRef.current)}`,
        )
        advancedOpenLoggedRef.current = true
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [featuredDefinitions.length, metadataDefinitionsLoaded, mode, prewarmedFacetsReady, searchSurfaceMode])

  const visibleResults = results.slice(0, visibleResultCount)
  const hasPreviewState = Object.keys(previewStates).length > 0
  const missingVisibleSemanticSeriesIds = visibleResults
    .map((candidate) => candidate.providerSeries.providerSeriesId)
    .filter((seriesId) => !enrichedCandidates[seriesId]?.semanticContext)
  const missingVisibleSemanticKey = missingVisibleSemanticSeriesIds.join('|')
  const interpretationTags = aiIntent
    ? [aiIntent.concept, aiIntent.region, aiIntent.instrumentType, aiIntent.useCase, aiIntent.industryContext, aiIntent.currency]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []

  useEffect(() => {
    if (!pendingPortfolioSeriesId) {
      return
    }

    const candidate = results.find((item) => item.providerSeries.providerSeriesId === pendingPortfolioSeriesId)
    if (!candidate) {
      return
    }

    const seriesId = pendingPortfolioSeriesId
    setCandidatePreviewState(seriesId, (state) => ({
      ...state,
      expanded: true,
      analyticsVisible: true,
      previewError: null,
    }))
    startSearchTransition(() => {
      ensureAnalyticsEligibility(candidate).catch(() => undefined)
      loadPreview(candidate, DEFAULT_PREVIEW_RANGE).catch(() => undefined)
    })
    setPendingPortfolioSeriesId(null)

    window.requestAnimationFrame(() => {
      const card = Array.from(resultsRef.current?.querySelectorAll<HTMLElement>('[data-series-id]') ?? [])
        .find((item) => item.dataset.seriesId === seriesId)
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [pendingPortfolioSeriesId, results])

  useEffect(() => {
    if (!missingVisibleSemanticKey) {
      return
    }

    ensureSemanticContext(visibleResults).catch((error: unknown) => {
      if (isAbortError(error)) {
        return
      }

      setMetadataError(resolveErrorMessage('metadata', locale, error, t))
    })
  }, [locale, missingVisibleSemanticKey, t])

  useEffect(() => {
    if (!hasSearched || visibleResults.length === 0) {
      return
    }

    for (const candidate of visibleResults) {
      const state = previewStates[candidate.providerSeries.providerSeriesId] ?? createDefaultCandidatePreviewState()
      if (state.previewStatus !== 'idle') {
        continue
      }

      loadPreview(candidate, state.range).catch(() => undefined)
    }
  }, [hasSearched, previewStates, visibleResults])

  const presentedResults = visibleResults.filter(candidate=>!onlyForecast||PORR_DEMO_FORECAST_BENCHMARKS.some(item=>item.seriesId===candidate.providerSeries.providerSeriesId)||previewStates[candidate.providerSeries.providerSeriesId]?.analyticsEligibility.forecastPortfolioEnabled).sort((a,b)=>resultSort==='name'?a.displayName.localeCompare(b.displayName,locale):0)

  return (
    <BenchmarkPresentation compact={isPickerMode}><main className={`bf-page min-h-screen${isPickerMode ? ' bf-visual-picker' : ''}`} data-testid="benchmark-finder-page">
      <div className={`bf-brandbar bf-topbar${isPickerMode ? ' is-picker' : ''}`}>
          {!isPickerMode && <div className="bf-brand"><span><SpendGuruLogo width={148} /></span><span>Market Intelligence</span></div>}
          <div className="bf-header-actions"><BenchmarkThemeSwitch/>            <div className="bf-languages">
              <button
                type="button"
                className={`rounded-full px-4 py-2 transition ${locale === 'pl' ? 'bg-slate-100 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => switchLocale('pl')}
                aria-pressed={locale === 'pl'}
              >
                PL
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 transition ${locale === 'en' ? 'bg-slate-100 text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => switchLocale('en')}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
            </div>
          </div>
        </div>
        <div className="bf-workspace"><div className="bf-content-region"><div className="bf-content bf-main">
        {!isPickerMode && <header className="bf-page-heading bf-page-title">
          <div>
            <p className="bf-eyebrow">{locale === 'pl' ? 'RYNKI · CENY · PROGNOZY' : 'MARKETS · PRICES · FORECASTS'}</p>
            <h1>Benchmark Finder<span>.</span></h1>
            <p>{locale === 'pl' ? 'Znajdź właściwy punkt odniesienia dla Twojej kategorii.' : 'Find the right benchmark for your category.'}</p>
          </div>
          <span className="bf-page-index bf-heading-index" aria-hidden="true">01 <span>/ {locale === 'pl' ? 'Odkrywanie rynku' : 'Market discovery'}</span></span>
        </header>}
        <section className="bf-search-panel">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="bf-search-title text-base font-semibold text-slate-950">{t('mode.search')}</h2>
            </div>


          </div>

          <div className="bf-search-top">
            <div className="bf-tabs" data-testid="benchmark-search-surface-mode">
              <button
                type="button"
                data-library-component="SRM-C08"
                onClick={() => openSearchSurface('simple')}
                aria-pressed={mode === 'search' && searchSurfaceMode === 'simple'}
              >
                {t('search.simpleTab')}
              </button>
              <button
                type="button"
                data-library-component="SRM-C08"
                onClick={openAdvancedSearchSurface}
                aria-pressed={mode === 'search' && searchSurfaceMode === 'advanced'}
              >
                <FinderGlyph kind="filter"/>{t('search.advancedTab')}
              </button>
            </div>

            <div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
                <button
                  type="button"
                  className="inline-flex cursor-not-allowed items-baseline gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-slate-400"
                  disabled
                  aria-disabled="true"
                  data-testid="benchmark-mode-ai"
                >
                  <FinderGlyph kind="spark"/><span>{t('mode.ai')}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-rose-600">{t('mode.comingSoon')}</span>
                </button>
              </div>
            </div>
          </div>

          {mode === 'search' ? (
            <>
              {searchSurfaceMode === 'simple' ? (
                <form
                  className="bf-simple-row"
                  onSubmit={(event) => {
                    event.preventDefault()
                    startSearchTransition(() => {
                      runSearch().catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('search', locale, searchFailure, t)))
                    })
                  }}
                >
                  <label className="bf-query-label"><span>{locale === 'pl' ? 'Nazwa, surowiec lub słowo kluczowe' : 'Name, commodity or keyword'}</span><div className="bf-search-input"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder={t('search.placeholder')}
                    data-testid="benchmark-search-input"
                  /></div></label>
                  <div className="bf-form-actions"><button
                    data-library-component="SRM-C01"
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isSearching || !query.trim()}
                    data-testid="benchmark-search-submit"
                  >
                    {isSearching ? t('common.loading') : t('search.submit')}<FinderGlyph kind="arrow"/>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    data-library-component="SRM-C03"
                    onClick={clearSearchState}
                    disabled={!query && !aiPrompt && results.length === 0 && !hasPreviewState}
                  >
                    {t('search.clear')}
                  </button></div>
                </form>
              ) : (
                <form
                  className="bf-advanced-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    startSearchTransition(() => {
                      runAdvancedSearch().catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('search', locale, searchFailure, t)))
                    })
                  }}
                >
                  <div className="bf-search-grid">
                    <label className="text-sm font-medium text-slate-800">
                      <span className="mb-2 block">{t('advanced.searchTextLabel')}</span>
                      <input
                        ref={advancedInputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder={t('advanced.searchTextPlaceholder')}
                        data-testid="benchmark-advanced-search-input"
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-800">
                      <span className="mb-2 block">{t('advanced.exactSeriesIdLabel')}</span>
                      <input
                        value={exactSeriesId}
                        onChange={(event) => setExactSeriesId(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder={t('advanced.exactSeriesIdPlaceholder')}
                      />
                    </label>
                  </div>

                  <div className="bf-filter-grid">
                    {featuredDefinitions.map((definition) => {
                      const valueState = metadataValuesByKey[definition.key] ?? { status: 'idle', items: [], totalCount: 0, filteredCount: 0, query: '', limited: false, filterSignature: '' }
                      const selected = selectedFilters[definition.key] ?? []

                      return (
                        <MetadataValueSelector
                          key={definition.key}
                          definition={definition}
                          t={t}
                          valueState={valueState}
                          selectedValues={selected}
                          isOpen={openMetadataKey === definition.key}
                          searchQuery={metadataValueSearchByKey[definition.key] ?? ''}
                          remoteFiltering={shouldUseRemoteMetadataQuery(definition.key)}
                          onSearchQueryChange={(value) => {
                            setMetadataValueSearchByKey((current) => ({ ...current, [definition.key]: value }))
                          }}
                          onSelectionChange={(nextValues) => {
                            setSelectedFilters((current) => ({ ...current, [definition.key]: nextValues }))
                          }}
                          onOpenChange={(nextOpen) => handleMetadataSelectorOpenChange(definition.key, nextOpen)}
                          onLoadValues={(nextSearchQuery) => queueMetadataValueLoad(definition.key, nextSearchQuery)}
                        />
                      )
                    })}
                  </div>

                  <div className="bf-form-actions bf-advanced-actions">
                    <button
                      data-library-component="SRM-C01"
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      disabled={isSearching}
                    >
                      {isSearching ? t('common.loading') : t('advanced.submit')}<FinderGlyph kind="arrow"/>
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      data-library-component="SRM-C03"
                      onClick={clearSearchState}
                    >
                      {t('search.clear')}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                startSearchTransition(() => {
                  runAiSearch().catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('ai', locale, searchFailure, t)))
                })
              }}
            >
              <label className="block text-sm font-medium text-slate-800" htmlFor="benchmark-ai-input">{t('ai.label')}</label>
              <textarea
                id="benchmark-ai-input"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder={t('ai.placeholder')}
                data-testid="benchmark-ai-input"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSearching || !aiPrompt.trim()}
                  data-testid="benchmark-ai-submit"
                >
                  {isSearching ? t('common.loading') : t('ai.submit')}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={clearSearchState}
                  disabled={!query && !aiPrompt && results.length === 0 && !hasPreviewState}
                >
                  {t('search.clear')}
                </button>
              </div>
            </form>
          )}

          {searchError ? (
            <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{searchError}</div>
          ) : null}

          {metadataError ? (
            <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-100 px-4 py-3 text-sm text-amber-900">{metadataError}</div>
          ) : null}

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
          ) : null}

          {aiIntent ? (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5" data-testid="benchmark-ai-interpretation">
              <p className="text-sm font-semibold text-slate-700">{t('ai.interpretationTitle')}</p>
              <p className="mt-2 text-sm text-slate-600">{aiIntent.interpretation}</p>
              {interpretationTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
                  {interpretationTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium">{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {(mode === 'search' && activeFilterChips.length > 0) ? (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-600">{t('advanced.activeFiltersTitle')}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {activeFilterChips.map((chip) => (
                  <button
                    key={`${chip.key}:${chip.value}`}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 font-medium text-slate-700"
                    onClick={() => {
                      setSelectedFilters((current) => ({
                        ...current,
                        [chip.key]: (current[chip.key] ?? []).filter((value) => value !== chip.value),
                      }))
                    }}
                  >
                    {chip.label} ×
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {showPorrDemoPortfolio ? (
          <section
            className="bf-shelf"
            aria-labelledby="porr-demo-forecast-portfolio-title"
            data-testid="porr-demo-forecast-portfolio"
          >
            <div className="bf-shelf-title">
              <h2 id="porr-demo-forecast-portfolio-title" className="text-lg font-semibold text-slate-950">
                {t('portfolio.title')}
              </h2>
              <p>{locale === 'pl' ? 'Historia i prognoza w jednym widoku' : 'History and forecast in one view'}</p>
            </div>

            <div className="bf-shelf-grid">
              {PORR_DEMO_FORECAST_FAMILIES.map((family) => (
                <article key={family}><div className="bf-shelf-heading">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t(`portfolio.families.${family}`)}
                  </h3><span>{locale === 'pl' ? ({oil:'Rynki energii',copper:'Metale przemysłowe',steel:'Materiały i półprodukty'})[family] : ({oil:'Energy markets',copper:'Industrial metals',steel:'Materials and components'})[family]}</span></div>
                  <div className="bf-shortcuts">
                    {PORR_DEMO_FORECAST_BENCHMARKS
                      .filter((benchmark) => benchmark.family === family)
                      .map((benchmark) => {
                        const isPending = pendingPortfolioSeriesId === benchmark.seriesId && isSearching

                        return (
                          <button
                            key={benchmark.seriesId}
                            type="button"
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-left text-sm font-medium leading-5 text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-wait disabled:opacity-60"
                            disabled={isSearching}
                            aria-label={t('portfolio.openBenchmark', { benchmark: benchmark.label[locale] })}
                            onClick={() => {
                              startSearchTransition(() => {
                                openPorrDemoPortfolioBenchmark(benchmark.seriesId)
                                  .catch((searchFailure: unknown) => {
                                    setPendingPortfolioSeriesId(null)
                                    setSearchError(resolveErrorMessage('search', locale, searchFailure, t))
                                  })
                              })
                            }}
                          >
                            {isPending ? t('common.loading') : benchmark.label[locale]}<FinderGlyph kind="arrow"/>
                          </button>
                        )
                      })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bf-results-panel bf-results">
          <div className="bf-results-head">
            <div>
              <h2>{t('results.title')}{hasSearched && <span>{results.length}</span>}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {hasSearched ? t('results.count', { count: results.length }) : mode === 'ai' ? t('results.aiSubtitle') : t('results.subtitle')}
              </p>
            </div>
            <div className="bf-result-tools"><label className="bf-forecast-filter"><input type="checkbox" checked={onlyForecast} onChange={event=>setOnlyForecast(event.target.checked)}/>{locale==='pl'?'Z prognozą':'With forecast'}</label><label className="bf-sort"><span>{locale==='pl'?'Sortuj':'Sort'}</span><CanonDropdown aria-label={locale==='pl'?'Sortowanie wyników':'Sort results'} value={resultSort} onChange={event=>setResultSort(event.target.value)}><option value="relevance">{locale==='pl'?'Dopasowanie':'Relevance'}</option><option value="name">{locale==='pl'?'Nazwa A–Z':'Name A–Z'}</option></CanonDropdown></label>{isSearching&&<span role="status">{t('common.loading')}</span>}</div>
          </div>

          <div ref={resultsRef} className="bf-results-list">
            {!hasSearched ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">{t('results.initialEmpty')}</div>
            ) : null}

            {hasSearched && !isSearching && results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                <p>{t('errors.noResults')}</p>
                {activeFilterChips.length > 0 ? <p className="mt-2 text-xs text-slate-400">{t('advanced.noResultsHint')}</p> : null}
              </div>
            ) : null}

            {hasSearched && !isSearching && results.length > 0 && onlyForecast && presentedResults.length === 0 ? <p className="bf-empty-filter" role="status">{locale === 'pl' ? 'Brak benchmarków z prognozą w wyświetlonej części wyników. Można wyłączyć filtr lub pokazać więcej wyników.' : 'No benchmarks with forecasts in the displayed results. Clear the filter or show more results.'}</p> : null}
            {presentedResults.map((candidate) => {
              const seriesId = candidate.providerSeries.providerSeriesId
              const enrichedCandidate = enrichedCandidates[seriesId] ?? candidate
              const card = createCardView(enrichedCandidate)
              const conciseMetadata = buildConciseCardMetadata(enrichedCandidate)
              const previewState = previewStates[seriesId] ?? createDefaultCandidatePreviewState()
              const analyticsFrameHeight = analyticsFrameHeights[seriesId] ?? null
              const isActive = previewState.expanded

              return (
                <article
                  key={candidate.candidateId}
                  data-testid="benchmark-result-card"
                  data-series-id={seriesId}
                  className={`bf-candidate${isActive ? ' is-open' : ''}`}
                >
                  <div className="bf-card-overview bf-candidate-toggle">
                    <div className="bf-candidate-copy">
                      <div className="bf-category-line"><span>{card.subtitle}</span>{PORR_DEMO_FORECAST_BENCHMARKS.some(item=>item.seriesId===seriesId) && <span className="bf-forecast-badge"><i/>{locale === 'pl' ? 'Prognoza' : 'Forecast'}</span>}</div>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-950">{card.title}</h3>

                      {candidate.exactMatch ? <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{t('results.exactMatch')}</p> : null}
                      {card.description ? <p className="mt-2 text-sm text-slate-500">{card.description}</p> : null}
                      {candidate.aiReason ? <p className="mt-2 text-sm text-slate-600">{t('results.whyThisMatch', { value: candidate.aiReason })}</p> : null}

                      {conciseMetadata ? <p className="bf-metadata">{conciseMetadata}</p> : null}
                    </div>

                    <div className="bf-card-values bf-candidate-value">
                      <div className="flex items-start justify-between gap-3 xl:w-full xl:justify-end">
                        <div className="bf-latest">
                          {previewState.previewStatus === 'ready' && previewState.preview ? (
                            <p className="bf-price" data-testid="benchmark-preview-latest-value">{previewState.preview.latestValue === null ? '—' : new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {maximumFractionDigits:3}).format(previewState.preview.latestValue)} <span>{formatDisplayMeasurement(previewState.preview.currency, previewState.preview.unit)}</span></p>
                          ) : previewState.previewStatus === 'error' ? (
                            <p className="text-sm text-slate-500">{t('results.previewUnavailable')}</p>
                          ) : (
                            <div className="h-10 w-32 animate-pulse rounded bg-slate-200 xl:ml-auto" />
                          )}
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{t('preview.latestValue')}</p>
                        </div>

                        <button
                          type="button"
                          aria-label={isActive ? t('actions.collapseAnalytics') : t('actions.expandAnalytics')}
                          title={isActive ? t('actions.collapseAnalytics') : t('actions.expandAnalytics')}
                          aria-expanded={isActive}
                          className="bf-expand-control"
                          onClick={() => togglePreviewCard(candidate)}
                        >
                          <span className="bf-expand-icon"><FinderGlyph kind="chevron"/></span>
                        </button>
                      </div>

                      <div className="bf-changes">
                        {(['1M', '3M', '1Y'] as const).map((metricKey) => (
                          <div key={metricKey} className="flex items-center gap-1.5">
                            <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{metricKey}</span>
                            {previewState.previewStatus === 'ready' && previewState.preview ? (
                              <span className={`font-semibold ${getChangeMetricTone(previewState.preview.changeMetrics[metricKey])}`}>
                                {previewState.preview.changeMetrics[metricKey] === undefined
                                  ? ' - '
                                  : formatPercent(locale, previewState.preview.changeMetrics[metricKey] as number)}
                              </span>
                            ) : previewState.previewStatus === 'error' ? (
                              <span className="text-slate-400"> - </span>
                            ) : (
                              <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="bf-detail">
                      {previewState.analyticsEligibility.status === 'ready' && previewState.analyticsEligibility.eligible && previewState.analyticsEligibility.analyticsUrl ? (
                        <>
                          <NativeAnalyticsEmbed
                            locale={locale}
                            key={localizeDashboardPreviewAnalyticsUrl(previewState.analyticsEligibility.analyticsUrl, locale)}
                            title={`${previewState.preview?.displayName ?? candidate.displayName} analytics`}
                            src={localizeDashboardPreviewAnalyticsUrl(previewState.analyticsEligibility.analyticsUrl, locale)}
                            className="w-full border-0 bg-transparent"
                            style={{ height: analyticsFrameHeight ? `${analyticsFrameHeight}px` : DEFAULT_ANALYTICS_IFRAME_HEIGHT_STYLE }}
                            loading="lazy"
                            data-testid="benchmark-analytics-embed"
                          />
                        </>
                      ) : previewState.analyticsEligibility.status === 'loading' ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">{t('common.loading')}</div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">{t('results.analyticsUnavailable')}</div>
                      )}

                      <div className="bf-detail-actions">
                        {isPickerMode ? (
                          <button
                            data-library-component="SRM-C01"
                            type="button"
                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            disabled={isSaving}
                            onClick={() => {
                              startSaveTransition(() => {
                                handleBenchmarkUse(candidate).catch((saveFailure: unknown) => setSearchError(resolveErrorMessage('selection', locale, saveFailure, t)))
                              })
                            }}
                          >
                            {isSaving ? t('common.loading') : t('actions.useBenchmark')}
                          </button>
                        ) : (
                          <button
                            data-library-component="SRM-C01"
                            type="button"
                            className="rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                            onClick={() => {
                              startSaveTransition(() => {
                                handleStartBuildingCategory(candidate).catch((saveFailure: unknown) => setSearchError(resolveErrorMessage('selection', locale, saveFailure, t)))
                              })
                            }}
                          >
                            {t('actions.startBuildingCategory')}
                          </button>
                        )}

                        {!isPickerMode ? (
                          <button
                            data-library-component="SRM-C02"
                            type="button"
                            disabled
                            title={t('actions.comingSoon')}
                            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-400"
                          >
                            {t('actions.addToCompare')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}

            {results.length > RESULT_PREVIEW_LIMIT ? (
              <div className="bf-more">
                {visibleResultCount < results.length ? (
                  <button
                    data-library-component="SRM-C02"
                    type="button"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => setVisibleResultCount((current) => Math.min(current + RESULT_BATCH_SIZE, results.length))}
                  >
                    {t('results.showMore')}
                  </button>
                ) : null}
                {visibleResultCount > RESULT_PREVIEW_LIMIT ? (
                  <button
                    data-library-component="SRM-C02"
                    type="button"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => setVisibleResultCount(RESULT_PREVIEW_LIMIT)}
                  >
                    {t('results.showLess')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="bf-recent-panel bf-recents">
          <div className="bf-recents-head">
            <div>
              <h2><FinderGlyph kind="clock"/>{t('recent.title')}</h2>
            </div>
            {recentSearches.length > 0 ? (
              <button
                type="button"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
                onClick={clearRecentSearches}
              >
                {t('recent.clear')}
              </button>
            ) : null}
          </div>

          {recentSearches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">{t('recent.empty')}</div>
          ) : (
            <div className="bf-recents-list">
              {recentSearches.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-slate-100"
                  onClick={() => {
                    if (entry.mode === 'ai') {
                      setAiPrompt(entry.aiPrompt)
                      startSearchTransition(() => {
                        runAiSearch(entry.aiPrompt).catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('ai', locale, searchFailure, t)))
                      })
                      return
                    }

                    if (entry.mode === 'advanced') {
                      startSearchTransition(() => {
                        runAdvancedSearch({
                          query: entry.query,
                          exactSeriesId: entry.exactSeriesId,
                          filters: cloneRecentFilters(entry.filters),
                        }).catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('search', locale, searchFailure, t)))
                      })
                      return
                    }

                    setQuery(entry.query)
                    startSearchTransition(() => {
                      runSearch(entry.query).catch((searchFailure: unknown) => setSearchError(resolveErrorMessage('search', locale, searchFailure, t)))
                    })
                  }}
                >
                  <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{entry.label}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {entry.mode === 'ai' ? t('mode.ai') : entry.mode === 'advanced' ? t('search.advancedTab') : t('search.simpleTab')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(entry.createdAt))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div></div></div>
    </main></BenchmarkPresentation>
  )
}
