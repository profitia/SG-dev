'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'

import type { CategoryCostScanResult, CostScanComponentResult, CostScanRangePreset } from '@/lib/cost-scan/contracts'

type CategoryCostScanClientProps = {
  locale: 'pl' | 'en'
  categoryId: string
}

class CostScanUiError extends Error {
  code: string | null

  constructor(message: string, code: string | null) {
    super(message)
    this.code = code
  }
}

const RANGE_PRESETS: CostScanRangePreset[] = ['1M', '3M', '6M', '12M']

function formatPercent(locale: 'pl' | 'en', value: number, fractionDigits = 1) {
  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: 'always',
  }).format(value)

  return `${formatted}%`
}

function formatPercentMagnitude(locale: 'pl' | 'en', value: number, fractionDigits = 1) {
  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)

  return `${formatted}%`
}

function formatContribution(locale: 'pl' | 'en', value: number) {
  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value)

  return `${formatted} pp`
}

function formatLevel(locale: 'pl' | 'en', value: number | null, currency: string | null, unit: string | null) {
  if (value === null) {
    return ' - '
  }

  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)

  const suffix = [currency, unit].filter(Boolean).join(' / ')
  return suffix ? `${formatted} ${suffix}` : formatted
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new CostScanUiError(payload.error ?? 'Request failed.', payload.code ?? null)
  }

  return payload as T
}

function resolveErrorMessage(locale: 'pl' | 'en', error: unknown, t: ReturnType<typeof useTranslations<'CostScan'>>) {
  if (error instanceof CostScanUiError && error.code === 'CATEGORY_NOT_READY_FOR_COST_SCAN') {
    return t('errors.notReady')
  }

  if (error instanceof CostScanUiError && error.code === 'CATEGORY_NOT_FOUND') {
    return t('errors.notFound')
  }

  return locale === 'pl' ? 'Wystąpił nieoczekiwany błąd.' : 'An unexpected error occurred.'
}

function getRangeLongLabel(range: CostScanRangePreset, t: ReturnType<typeof useTranslations<'CostScan'>>) {
  switch (range) {
    case '1M':
      return t('range.long1M')
    case '3M':
      return t('range.long3M')
    case '6M':
      return t('range.long6M')
    case '12M':
      return t('range.long12M')
  }
}

function getDirectionLabel(result: CategoryCostScanResult, t: ReturnType<typeof useTranslations<'CostScan'>>) {
  if (!result.dataComplete || result.direction === null) {
    return t('headline.partial')
  }

  switch (result.direction) {
    case 'UPWARD':
      return t('direction.upward')
    case 'DOWNWARD':
      return t('direction.downward')
    case 'STABLE':
      return t('direction.stable')
  }
}

function getComponentStatusLabel(component: CostScanComponentResult, t: ReturnType<typeof useTranslations<'CostScan'>>) {
  switch (component.dataStatus) {
    case 'OK':
      return null
    case 'DATA_UNAVAILABLE':
      return t('dataStatus.dataUnavailable')
    case 'INSUFFICIENT_DATA':
      return t('dataStatus.insufficientData')
    case 'UNSUPPORTED_CHANGE_CALCULATION':
      return t('dataStatus.unsupported')
  }
}

function buildSummaryLines(locale: 'pl' | 'en', result: CategoryCostScanResult, t: ReturnType<typeof useTranslations<'CostScan'>>) {
  if (!result.dataComplete || result.categoryMovementPercent === null) {
    return [t('summary.incomplete', { components: result.incompleteComponentNames.join(', ') })]
  }

  const rangeLabel = getRangeLongLabel(result.range, t)
  const movement = formatPercentMagnitude(locale, Math.abs(result.categoryMovementPercent), 2)
  const lines: string[] = []

  if (result.direction === 'UPWARD') {
    lines.push(t('summary.upward', { movement, period: rangeLabel }))
  } else if (result.direction === 'DOWNWARD') {
    lines.push(t('summary.downward', { movement, period: rangeLabel }))
  } else {
    lines.push(t('summary.stable', { period: rangeLabel }))
  }

  if (result.mainUpwardDriver) {
    lines.push(t('summary.mainUpwardDriver', {
      name: result.mainUpwardDriver.name,
      value: formatContribution(locale, result.mainUpwardDriver.contributionPercentagePoints),
    }))
  }

  if (result.mainDownwardDriver) {
    lines.push(t('summary.mainDownwardDriver', {
      name: result.mainDownwardDriver.name,
      value: formatContribution(locale, result.mainDownwardDriver.contributionPercentagePoints),
    }))
  }

  return lines
}

export function CategoryCostScanClient({ locale, categoryId }: CategoryCostScanClientProps) {
  const t = useTranslations('CostScan')
  const [range, setRange] = useState<CostScanRangePreset>('3M')
  const [result, setResult] = useState<CategoryCostScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, startLoadingTransition] = useTransition()

  function loadScan(nextRange: CostScanRangePreset) {
    setError(null)

    return fetch(`/api/cost-scan/category/${categoryId}?range=${nextRange}`, { cache: 'no-store' })
      .then(readJson<CategoryCostScanResult>)
      .then((payload) => {
        setResult(payload)
        setRange(nextRange)
      })
      .catch((loadError: unknown) => {
        setError(resolveErrorMessage(locale, loadError, t))
        setResult(null)
      })
  }

  useEffect(() => {
    startLoadingTransition(() => {
      loadScan('3M').catch(() => undefined)
    })
  }, [categoryId, locale, t])

  const contributionValues = result?.components
    .map((component) => Math.abs(component.contributionPercentagePoints ?? 0))
    .filter((value) => value > 0) ?? []
  const maximumContribution = contributionValues.length > 0 ? Math.max(...contributionValues) : 1
  const summaryLines = result ? buildSummaryLines(locale, result, t) : []

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900" data-testid="cost-scan-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">{t('eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold">{result?.categoryName ?? t('title')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t('subtitle')}</p>
          </div>
          <Link
            href={`/${locale}/category-builder`}
            className="inline-flex rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-100"
          >
            {t('actions.backToCategories')}
          </Link>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{t('headline.subtitle')}</p>
              <h2 className="mt-2 text-2xl font-semibold">{t('headline.title')}</h2>
              {result ? <p className="mt-2 text-sm text-slate-500">{getRangeLongLabel(result.range, t)}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2" data-testid="cost-scan-range-selector">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${preset === range
                    ? 'bg-teal-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}
                  onClick={() => {
                    startLoadingTransition(() => {
                      loadScan(preset).catch(() => undefined)
                    })
                  }}
                  data-testid={`cost-scan-range-${preset}`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          {!result && !error ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              {isLoading ? t('common.loading') : t('empty')}
            </div>
          ) : null}

          {result ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.56fr_0.44fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">{t('headline.title')}</p>
                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-4xl font-semibold" data-testid="cost-scan-headline-movement">
                    {result.categoryMovementPercent === null ? ' - ' : formatPercent(locale, result.categoryMovementPercent, 2)}
                  </span>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${result.direction === 'UPWARD'
                    ? 'bg-rose-100 text-rose-700'
                    : result.direction === 'DOWNWARD'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'}`}>
                    {getDirectionLabel(result, t)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <p className="font-medium text-slate-900">{t('labels.requestedWindow')}</p>
                    <p className="mt-1">{result.requestedStart} - {result.requestedEnd}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{t('labels.scanStatus')}</p>
                    <p className="mt-1">{result.status === 'COMPLETE' ? t('status.complete') : t('status.partial')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-semibold">{t('summary.title')}</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {summaryLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {result ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t('drivers.title')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('drivers.subtitle')}</p>
              </div>
              {!result.dataComplete ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{t('status.partial')}</span> : null}
            </div>

            <div className="mt-6 space-y-4" data-testid="cost-scan-driver-list">
              {result.components.map((component) => {
                const contributionWidth = component.contributionPercentagePoints === null
                  ? 0
                  : Math.min(100, (Math.abs(component.contributionPercentagePoints) / maximumContribution) * 100)
                const isPositive = (component.contributionPercentagePoints ?? 0) >= 0
                const statusLabel = getComponentStatusLabel(component, t)

                return (
                  <article key={component.costComponentId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{component.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{component.benchmarkDisplayName}</p>
                      </div>
                      {statusLabel ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{statusLabel}</span> : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{t('labels.weight')}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{component.weightPercent}%</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{t('labels.benchmarkChange')}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{component.benchmarkChangePercent === null ? ' - ' : formatPercent(locale, component.benchmarkChangePercent, 1)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{t('labels.contribution')}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{component.contributionPercentagePoints === null ? ' - ' : formatContribution(locale, component.contributionPercentagePoints)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                        <span>{t('labels.visualContribution')}</span>
                        {component.contributionPercentagePoints !== null ? <span>{formatContribution(locale, component.contributionPercentagePoints)}</span> : null}
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${isPositive ? 'bg-teal-600' : 'bg-rose-500'}`}
                          style={{ width: `${contributionWidth}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium text-slate-900">{t('labels.start')}</p>
                        <p className="mt-1">{component.startDate ?? ' - '}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatLevel(locale, component.startValue, component.currency, component.unit)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{t('labels.end')}</p>
                        <p className="mt-1">{component.endDate ?? ' - '}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatLevel(locale, component.endValue, component.currency, component.unit)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{t('labels.dataAsOf')}</p>
                        <p className="mt-1">{component.dataAsOf ?? ' - '}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{t('labels.frequency')}</p>
                        <p className="mt-1">{component.frequency ?? ' - '}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold">{t('drivers.mainUpwardTitle')}</h2>
              {result.mainUpwardDriver ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-slate-900">{result.mainUpwardDriver.name}</p>
                  <p className="text-sm text-slate-500">{result.mainUpwardDriver.benchmarkDisplayName}</p>
                  <p className="text-lg font-semibold text-teal-700">{formatContribution(locale, result.mainUpwardDriver.contributionPercentagePoints)}</p>
                </div>
              ) : <p className="mt-4 text-sm text-slate-500">{t('drivers.noneUpward')}</p>}
            </article>

            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold">{t('drivers.mainDownwardTitle')}</h2>
              {result.mainDownwardDriver ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-slate-900">{result.mainDownwardDriver.name}</p>
                  <p className="text-sm text-slate-500">{result.mainDownwardDriver.benchmarkDisplayName}</p>
                  <p className="text-lg font-semibold text-rose-600">{formatContribution(locale, result.mainDownwardDriver.contributionPercentagePoints)}</p>
                </div>
              ) : <p className="mt-4 text-sm text-slate-500">{t('drivers.noneDownward')}</p>}
            </article>
          </section>
        ) : null}
      </div>
    </main>
  )
}