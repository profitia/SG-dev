'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { BenchmarkFinderClient } from '@/components/benchmark-finder/benchmark-finder-client'
import { sanitizeUserFacingPublisher } from '@/lib/benchmark/presentation'
import type { SavedBenchmark } from '@/lib/benchmark/contracts'
import type { CategoryComponentSuggestion, CategoryRecord, CategoryStatus, CategorySummary } from '@/lib/category/contracts'

type CategoryBuilderClientProps = {
  locale: 'pl' | 'en'
}

type DraftComponent = {
  id: string
  name: string
  weightPercent: number
  benchmark: SavedBenchmark
}

type DraftCategory = {
  id: string | null
  name: string
  status: CategoryStatus
  components: DraftComponent[]
  createdAt: string | null
  updatedAt: string | null
}

type FinderPrefill = {
  mode: 'search' | 'ai'
  query: string
  aiPrompt: string
}

class CategoryUiError extends Error {
  code: string | null

  constructor(message: string, code: string | null) {
    super(message)
    this.code = code
  }
}

function createEmptyDraft(): DraftCategory {
  return {
    id: null,
    name: '',
    status: 'DRAFT',
    components: [],
    createdAt: null,
    updatedAt: null,
  }
}

function sumComponentWeights(components: DraftComponent[]) {
  return components.reduce((total, component) => total + component.weightPercent, 0)
}

function deriveDraftStatus(componentCount: number, allocatedPercent: number): CategoryStatus {
  return componentCount >= 2 && allocatedPercent === 100 ? 'READY' : 'DRAFT'
}

function getMaximumAvailableWeight(components: DraftComponent[], componentId: string) {
  const otherAllocated = components
    .filter((component) => component.id !== componentId)
    .reduce((total, component) => total + component.weightPercent, 0)

  return Math.max(0, 100 - otherAllocated)
}

function normalizeComponentKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toDraftCategory(category: CategoryRecord): DraftCategory {
  return {
    id: category.id,
    name: category.name,
    status: category.status,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    components: category.components.map((component) => ({
      id: component.id,
      name: component.name,
      weightPercent: component.weightPercent,
      benchmark: {
        selectionId: `category:${component.id}`,
        businessBenchmarkId: component.benchmark.businessBenchmarkId,
        organizationId: category.organizationId,
        displayName: component.benchmark.displayName,
        provider: component.benchmark.provider,
        providerSeries: component.benchmark.providerSeries,
        frequency: component.benchmark.frequency,
        currency: component.benchmark.currency,
        unit: component.benchmark.unit,
        source: component.benchmark.source,
        selectedAt: category.updatedAt,
      },
    })),
  }
}

function createCardTitle(displayName: string, currency: string | null, unit: string | null) {
  const tokens = displayName.split(',').map((token) => token.trim()).filter(Boolean)
  const generic = new Set(['world', 'close', 'open', 'high', 'low', 'last', 'avg', 'average'])
  const filtered = tokens.filter((token) => {
    const lower = token.toLowerCase()
    return !generic.has(lower) && lower !== (currency ?? '').toLowerCase()
  })
  const fxToken = [unit, ...filtered].find((token) => typeof token === 'string' && /\b[A-Z]{3}\/[A-Z]{3}\b/.test(token))
  if (fxToken) {
    return fxToken.match(/\b[A-Z]{3}\/[A-Z]{3}\b/)?.[0] ?? fxToken
  }
  return filtered[0] ?? displayName
}

function suggestComponentName(benchmark: SavedBenchmark) {
  const title = createCardTitle(benchmark.displayName, benchmark.currency, benchmark.unit)

  if (/iron ore/i.test(title)) {
    return 'Iron Ore'
  }
  if (/coking coal/i.test(title)) {
    return 'Coking Coal'
  }
  if (/natural gas/i.test(title)) {
    return 'Natural Gas'
  }
  if (/electricity|power/i.test(title)) {
    return 'Electricity'
  }
  if (/copper/i.test(title)) {
    return 'Copper'
  }
  if (/brent/i.test(title)) {
    return 'Brent'
  }

  return title
}

function buildSuggestionBenchmarkPrompt(categoryName: string, categoryContext: string, suggestion: CategoryComponentSuggestion) {
  const context = categoryContext.trim()
  return [
    `Find a real benchmark for ${suggestion.benchmarkNeed}.`,
    `Category: ${categoryName.trim()}.`,
    context ? `Context: ${context}.` : null,
  ].filter(Boolean).join(' ')
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new CategoryUiError(payload.error ?? 'Request failed.', payload.code ?? null)
  }
  return payload as T
}

function resolveErrorMessage(locale: 'pl' | 'en', error: unknown, t: ReturnType<typeof useTranslations<'CategoryBuilder'>>) {
  if (error instanceof CategoryUiError && error.code === 'CATEGORY_NOT_FOUND') {
    return t('errors.notFound')
  }

  if (error instanceof CategoryUiError && error.code === 'BENCHMARK_NOT_FOUND') {
    return t('errors.attachFailed')
  }

  if (error instanceof CategoryUiError && error.code === 'AI_UNAVAILABLE') {
    return t('errors.aiUnavailable')
  }

  if (error instanceof CategoryUiError && error.code === 'AI_NO_USEFUL_SUGGESTIONS') {
    return t('errors.aiNoSuggestions')
  }

  if (error instanceof CategoryUiError && error.code === 'AI_UNSAFE_SUGGESTIONS') {
    return t('errors.aiUnavailable')
  }

  if (error instanceof CategoryUiError && error.code === 'CATEGORY_WEIGHT_EXCEEDS_100') {
    return t('errors.totalExceeds')
  }

  if (error instanceof CategoryUiError && error.code === 'INVALID_COMPONENT_WEIGHT') {
    return t('errors.invalidWeight')
  }

  return locale === 'pl' ? 'Wystąpił nieoczekiwany błąd.' : 'An unexpected error occurred.'
}

export function CategoryBuilderClient({ locale }: CategoryBuilderClientProps) {
  const t = useTranslations('CategoryBuilder')
  const searchParams = useSearchParams()
  const seededBenchmarkId = searchParams.get('seedBenchmarkId')
  const appliedSeedRef = useRef<string | null>(null)
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [availableBenchmarks, setAvailableBenchmarks] = useState<SavedBenchmark[]>([])
  const [draft, setDraft] = useState<DraftCategory>(createEmptyDraft())
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [allocationError, setAllocationError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [categoryContext, setCategoryContext] = useState('')
  const [suggestions, setSuggestions] = useState<CategoryComponentSuggestion[]>([])
  const [suggestionInterpretation, setSuggestionInterpretation] = useState<string | null>(null)
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([])
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [finderOpen, setFinderOpen] = useState(false)
  const [targetComponentId, setTargetComponentId] = useState<string | null>(null)
  const [targetSuggestion, setTargetSuggestion] = useState<CategoryComponentSuggestion | null>(null)
  const [finderPrefill, setFinderPrefill] = useState<FinderPrefill>({ mode: 'search', query: '', aiPrompt: '' })
  const [isLoading, startLoadingTransition] = useTransition()
  const [isSaving, startSavingTransition] = useTransition()
  const [isSuggesting, startSuggestionTransition] = useTransition()

  const componentCount = draft.components.length
  const allocatedPercent = sumComponentWeights(draft.components)
  const remainingPercent = Math.max(0, 100 - allocatedPercent)
  const derivedStatus: CategoryStatus = deriveDraftStatus(componentCount, allocatedPercent)
  const existingComponentKeys = new Set(draft.components.map((component) => normalizeComponentKey(component.name)))

  useEffect(() => {
    if (!seededBenchmarkId) {
      return
    }

    if (appliedSeedRef.current === seededBenchmarkId) {
      return
    }

    if (availableBenchmarks.length === 0) {
      return
    }

    const seededBenchmark = availableBenchmarks.find((item) => item.businessBenchmarkId === seededBenchmarkId)
    if (!seededBenchmark) {
      return
    }

    appliedSeedRef.current = seededBenchmarkId
    setDraft((current) => {
      if (current.id || current.components.some((component) => component.benchmark.businessBenchmarkId === seededBenchmarkId)) {
        return current
      }

      return {
        ...current,
        components: [
          {
            id: `draft-${crypto.randomUUID()}`,
            name: suggestComponentName(seededBenchmark),
            weightPercent: 0,
            benchmark: seededBenchmark,
          },
          ...current.components,
        ],
      }
    })
    setNotice(t('builder.seededBenchmarkAdded'))
    setSaveError(null)
    setAllocationError(null)
  }, [availableBenchmarks, seededBenchmarkId, t])

  async function loadAvailableBenchmarks() {
    const payload = await readJson<{ items: SavedBenchmark[] }>(await fetch('/api/benchmark/selection', { cache: 'no-store' }))
    setAvailableBenchmarks(payload.items)
  }

  async function loadCategories(selectFirst = false) {
    setLoadingError(null)
    const payload = await readJson<{ items: CategorySummary[] }>(await fetch('/api/category', { cache: 'no-store' }))
    setCategories(payload.items)

    if (selectFirst && payload.items[0]) {
      await openCategory(payload.items[0].id)
    }
  }

  async function openCategory(categoryId: string) {
    setLoadingError(null)
    const payload = await readJson<CategoryRecord>(await fetch(`/api/category/${categoryId}`, { cache: 'no-store' }))
    setDraft(toDraftCategory(payload))
    setCategoryContext('')
    setSuggestions([])
    setSuggestionInterpretation(null)
    setSelectedSuggestionIds([])
    setSuggestionError(null)
    setFinderOpen(false)
    setTargetComponentId(null)
    setTargetSuggestion(null)
    setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
    setSaveError(null)
    setAllocationError(null)
    setNotice(null)
  }

  useEffect(() => {
    startLoadingTransition(() => {
      Promise.all([loadCategories(true), loadAvailableBenchmarks()])
        .catch((error: unknown) => setLoadingError(resolveErrorMessage(locale, error, t)))
    })
  }, [locale, t])

  function startNewCategory() {
    setDraft(createEmptyDraft())
    setCategoryContext('')
    setSuggestions([])
    setSuggestionInterpretation(null)
    setSelectedSuggestionIds([])
    setSuggestionError(null)
    setFinderOpen(false)
    setTargetComponentId(null)
    setTargetSuggestion(null)
    setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
    setSaveError(null)
    setAllocationError(null)
    setNotice(null)
  }

  async function loadAiSuggestions() {
    setSuggestionError(null)
    setNotice(null)
    setAllocationError(null)

    const payload = await readJson<{
      categoryInterpretation: string | null
      components: CategoryComponentSuggestion[]
    }>(await fetch('/api/category/ai-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryName: draft.name,
        description: categoryContext.trim() || undefined,
      }),
    }))

    setSuggestions(payload.components)
    setSuggestionInterpretation(payload.categoryInterpretation)
    setSelectedSuggestionIds(payload.components.map((component) => component.id))
    setNotice(t('builder.suggestionsLoaded'))
  }

  function openManualFinder() {
    setTargetComponentId(null)
    setTargetSuggestion(null)
    setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
    setFinderOpen(true)
    setNotice(null)
    setSaveError(null)
    setAllocationError(null)
  }

  function openSuggestionFinder(suggestion: CategoryComponentSuggestion) {
    setTargetComponentId(null)
    setTargetSuggestion(suggestion)
    setFinderPrefill({
      mode: 'ai',
      query: suggestion.searchSeeds?.[0] ?? suggestion.name,
      aiPrompt: buildSuggestionBenchmarkPrompt(draft.name, categoryContext, suggestion),
    })
    setFinderOpen(true)
    setNotice(null)
    setSaveError(null)
    setAllocationError(null)
  }

  function updateComponentWeight(componentId: string, nextWeightPercent: number) {
    const maximumAvailable = getMaximumAvailableWeight(draft.components, componentId)

    if (!Number.isInteger(nextWeightPercent) || nextWeightPercent < 0) {
      setAllocationError(t('errors.invalidWeight'))
      return
    }

    if (nextWeightPercent > maximumAvailable) {
      setAllocationError(t('errors.maximumAvailable', { percent: maximumAvailable }))
      return
    }

    setDraft((current) => ({
      ...current,
      components: current.components.map((component) => component.id === componentId
        ? { ...component, weightPercent: nextWeightPercent }
        : component),
    }))
    setAllocationError(null)
    setSaveError(null)
  }

  function handleBenchmarkSelected(benchmark: SavedBenchmark) {
    setDraft((current) => {
      if (targetComponentId) {
        return {
          ...current,
          components: current.components.map((component) => component.id === targetComponentId
            ? { ...component, benchmark }
            : component),
        }
      }

      return {
        ...current,
        components: [
          ...current.components,
          {
            id: `draft-${crypto.randomUUID()}`,
            name: targetSuggestion?.name ?? suggestComponentName(benchmark),
            weightPercent: 0,
            benchmark,
          },
        ],
      }
    })

    setFinderOpen(false)
    setTargetComponentId(null)
    if (targetSuggestion) {
      setSelectedSuggestionIds((current) => current.filter((item) => item !== targetSuggestion.id))
    }
    setTargetSuggestion(null)
    setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
    setSaveError(null)
    setAllocationError(null)
    setNotice(t('builder.componentAdded'))
  }

  function saveCategory() {
    setSaveError(null)
    setAllocationError(null)
    setNotice(null)

    if (!draft.name.trim()) {
      setSaveError(t('errors.nameRequired'))
      return
    }

    if (draft.components.length === 0) {
      setSaveError(t('errors.componentAddFailed'))
      return
    }

    startSavingTransition(() => {
      const method = draft.id ? 'PATCH' : 'POST'
      const endpoint = draft.id ? `/api/category/${draft.id}` : '/api/category'

      fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          components: draft.components.map((component) => ({
            name: component.name,
            businessBenchmarkId: component.benchmark.businessBenchmarkId,
            weightPercent: component.weightPercent,
          })),
        }),
      })
        .then(readJson<CategoryRecord>)
        .then(async (payload) => {
          setDraft(toDraftCategory(payload))
          setNotice(payload.status === 'READY' ? t('builder.savedReady') : t('builder.savedDraft'))
          await loadCategories(false)
        })
        .catch((error: unknown) => setSaveError(resolveErrorMessage(locale, error, t)))
    })
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900" data-testid="category-builder-page">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.38fr_0.62fr]">
        <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{t('eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>
              <p className="mt-2 text-sm text-slate-500">{t('subtitle')}</p>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              onClick={startNewCategory}
            >
              {t('actions.newCategory')}
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{t('saved.title')}</h2>
              {isLoading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">{t('saved.subtitle')}</p>

            {loadingError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadingError}</div> : null}

            <div className="mt-4 space-y-3" data-testid="category-summary-list">
              {categories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t('saved.empty')}</div>
              ) : categories.map((category) => (
                <article key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{category.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{t('saved.count', { count: category.componentCount })}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${category.status === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {category.status === 'READY' ? t('status.ready') : t('status.draft')}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(category.updatedAt))}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                        onClick={() => {
                          startLoadingTransition(() => {
                            openCategory(category.id).catch((error: unknown) => setLoadingError(resolveErrorMessage(locale, error, t)))
                          })
                        }}
                      >
                        {t('actions.open')}
                      </button>
                      {category.status === 'READY' ? (
                        <Link
                          href={`/${locale}/cost-scan/category/${category.id}`}
                          className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                        >
                          {t('actions.runCostScan')}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="cursor-not-allowed rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-500"
                          disabled
                          title={t('builder.costScanLocked')}
                        >
                          {t('actions.runCostScan')}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{t('builder.title')}</h2>
              <p className="mt-2 text-sm text-slate-500">{t('builder.subtitle')}</p>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${derivedStatus === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} data-testid="category-status-badge">
              {derivedStatus === 'READY' ? t('status.ready') : t('status.draft')}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              {draft.id ? (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {derivedStatus === 'READY' ? (
                    <Link
                      href={`/${locale}/cost-scan/category/${draft.id}`}
                      className="inline-flex rounded-2xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800"
                    >
                      {t('actions.runCostScan')}
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {t('builder.costScanLocked')}
                    </div>
                  )}
                </div>
              ) : null}

              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="category-name">{t('builder.name')}</label>
              <input
                id="category-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                placeholder={t('builder.namePlaceholder')}
                data-testid="category-name-input"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="category-context">{t('builder.context')}</label>
              <textarea
                id="category-context"
                value={categoryContext}
                onChange={(event) => setCategoryContext(event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                placeholder={t('builder.contextPlaceholder')}
                data-testid="category-context-input"
              />
              <p className="mt-2 text-xs text-slate-500">{t('builder.contextHint')}</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{t('components.title')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t('components.subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={openManualFinder}
                    disabled={!draft.name.trim()}
                    data-testid="category-add-component"
                  >
                    {t('actions.addComponent')}
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    onClick={() => {
                      startSuggestionTransition(() => {
                        loadAiSuggestions().catch((error: unknown) => setSuggestionError(resolveErrorMessage(locale, error, t)))
                      })
                    }}
                    disabled={isSuggesting || !draft.name.trim()}
                    data-testid="category-ask-suggestions"
                  >
                    {isSuggesting ? t('common.loading') : t('actions.askSuggestions')}
                  </button>
                </div>
              </div>

              {!draft.name.trim() ? <p className="mt-3 text-sm text-amber-700">{t('builder.nameRequiredBeforeComponent')}</p> : null}

              {suggestionError ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{suggestionError}</div> : null}

              {suggestions.length > 0 ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5" data-testid="category-suggestion-list">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">{t('suggestions.title', { category: draft.name })}</h4>
                      <p className="mt-1 text-sm text-slate-600">{t('suggestions.subtitle')}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        startSuggestionTransition(() => {
                          loadAiSuggestions().catch((error: unknown) => setSuggestionError(resolveErrorMessage(locale, error, t)))
                        })
                      }}
                      disabled={isSuggesting}
                    >
                      {t('actions.generateAgain')}
                    </button>
                  </div>

                  {suggestionInterpretation ? <p className="mt-4 text-sm text-slate-700">{suggestionInterpretation}</p> : null}

                  <div className="mt-4 space-y-3">
                    {suggestions.map((suggestion) => {
                      const isSelected = selectedSuggestionIds.includes(suggestion.id)
                      const alreadyAdded = existingComponentKeys.has(normalizeComponentKey(suggestion.name))

                      return (
                        <article key={suggestion.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex-1">
                              <label className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={alreadyAdded}
                                  onChange={() => {
                                    setSelectedSuggestionIds((current) => current.includes(suggestion.id)
                                      ? current.filter((item) => item !== suggestion.id)
                                      : [...current, suggestion.id])
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
                                />
                                <span>
                                  <span className="block text-sm font-semibold text-slate-900">{suggestion.name}</span>
                                  <span className="mt-1 block text-sm text-slate-600">{suggestion.rationale}</span>
                                </span>
                              </label>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                                <span className="rounded-full bg-slate-100 px-3 py-1">{suggestion.benchmarkNeed}</span>
                                {suggestion.searchSeeds?.map((seed) => (
                                  <span key={seed} className="rounded-full bg-slate-100 px-3 py-1">{seed}</span>
                                ))}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {alreadyAdded ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">{t('suggestions.alreadyAdded')}</span> : null}
                              <button
                                type="button"
                                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                disabled={!isSelected || alreadyAdded}
                                onClick={() => openSuggestionFinder(suggestion)}
                              >
                                {t('suggestions.findBenchmark')}
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-4" data-testid="category-component-list">
                {draft.components.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">{t('components.empty')}</div>
                ) : draft.components.map((component, index) => (
                  <article key={component.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('components.itemNumber', { number: index + 1 })}</p>
                        <input
                          value={component.name}
                          onChange={(event) => setDraft((current) => ({
                            ...current,
                            components: current.components.map((item) => item.id === component.id ? { ...item, name: event.target.value } : item),
                          }))}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                        />
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{t('components.benchmarkLabel')}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{component.benchmark.displayName}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                          {component.benchmark.frequency ? <span className="rounded-full bg-white px-3 py-1">{component.benchmark.frequency}</span> : null}
                          {component.benchmark.currency ? <span className="rounded-full bg-white px-3 py-1">{component.benchmark.currency}</span> : null}
                          {component.benchmark.unit ? <span className="rounded-full bg-white px-3 py-1">{component.benchmark.unit}</span> : null}
                          {sanitizeUserFacingPublisher(component.benchmark.source) ? <span className="rounded-full bg-white px-3 py-1">{sanitizeUserFacingPublisher(component.benchmark.source)}</span> : null}
                        </div>

                        <div className="mt-4 max-w-xs">
                          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={`component-weight-${component.id}`}>
                            {t('components.shareLabel')}
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              id={`component-weight-${component.id}`}
                              type="number"
                              min={0}
                              max={getMaximumAvailableWeight(draft.components, component.id)}
                              step={1}
                              inputMode="numeric"
                              value={component.weightPercent}
                              onChange={(event) => {
                                const nextValue = event.target.value === '' ? 0 : Number.parseInt(event.target.value, 10)
                                updateComponentWeight(component.id, nextValue)
                              }}
                              className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              data-testid={`component-weight-${index + 1}`}
                            />
                            <span className="text-sm font-medium text-slate-600">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                          onClick={() => {
                            setTargetComponentId(component.id)
                            setTargetSuggestion(null)
                            setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
                            setFinderOpen(true)
                            setNotice(null)
                            setSaveError(null)
                          }}
                        >
                          {t('actions.changeBenchmark')}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              components: current.components.filter((item) => item.id !== component.id),
                            }))
                            setAllocationError(null)
                            setNotice(t('builder.componentRemoved'))
                          }}
                        >
                          {t('actions.remove')}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5" data-testid="category-allocation-summary">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{t('allocation.title')}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {derivedStatus === 'READY' ? t('allocation.complete') : t('allocation.incomplete')}
                  </p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-medium ${derivedStatus === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {derivedStatus === 'READY' ? t('status.ready') : t('status.draft')}
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${derivedStatus === 'READY' ? 'bg-emerald-500' : 'bg-teal-600'}`}
                  style={{ width: `${allocatedPercent}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                <span>{t('allocation.allocated', { percent: allocatedPercent })}</span>
                <span>{t('allocation.remaining', { percent: remainingPercent })}</span>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                {derivedStatus === 'READY'
                  ? t('builder.readyHint')
                  : componentCount < 2
                    ? t('builder.minimumHint')
                    : t('builder.remainingHint', { percent: remainingPercent })}
              </p>
            </div>

            {allocationError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{allocationError}</div> : null}
            {saveError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</div> : null}
            {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">{t('builder.savedState', { status: derivedStatus === 'READY' ? t('status.ready') : t('status.draft') })}</div>
              <button
                type="button"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={saveCategory}
                disabled={isSaving || !draft.name.trim() || draft.components.length === 0}
                data-testid="category-save-button"
              >
                {isSaving ? t('common.loading') : t('actions.save')}
              </button>
            </div>
          </div>
        </section>
      </div>

      {finderOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" data-testid="category-finder-modal">
          <div className="mx-auto max-w-6xl rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{targetComponentId ? t('modal.changeTitle') : t('modal.addTitle')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('modal.subtitle')}</p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                onClick={() => {
                  setFinderOpen(false)
                  setTargetComponentId(null)
                  setTargetSuggestion(null)
                  setFinderPrefill({ mode: 'search', query: '', aiPrompt: '' })
                }}
              >
                {t('actions.close')}
              </button>
            </div>
            <div className="max-h-[85vh] overflow-y-auto">
              <BenchmarkFinderClient
                locale={locale}
                selectionMode="picker"
                onBenchmarkSelected={handleBenchmarkSelected}
                initialMode={finderPrefill.mode}
                initialSearchQuery={finderPrefill.query}
                initialAiPrompt={finderPrefill.aiPrompt}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}