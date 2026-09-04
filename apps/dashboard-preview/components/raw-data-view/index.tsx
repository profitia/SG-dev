'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useSearchParams } from 'next/navigation'

import type { DashboardVariantId } from '@/lib/dashboard-variants/registry'
import { filterSeriesToVisibleRange, resolveNiceScaleDomain, type VisibleRange } from '@/lib/chart/chart-panel-helpers'
import { clipDeltaOverlaysToRange } from '@/lib/chart/delta-overlay-clipping'
import { resolveDatePlotOffset } from '@/lib/chart/date-plot-offset'
import { buildEndOfPeriodDeltaSurfaces, prepareVisibleSeriesGeometry } from '@/lib/chart/end-of-period-delta-geometry'
import {
  DEFAULT_FORECAST_TARGET_BASIS,
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  isAvailableCurrentResult,
  isAvailableVerificationResult,
  type BenchmarkForecastCurrentResult,
  type ForecastCurrentUiState,
  type BenchmarkForecastVerificationResult,
  type ForecastTargetBasis,
  type ForecastPortfolioModelId,
  type ProgressiveForecastPreparationSnapshot,
  type ProgressiveForecastPreparationState,
} from '@/lib/benchmark-forecast/forecast-contract'
import {
  explicitlyPrepareForecastCurrent,
  readProgressiveForecastPreparationThroughDashboard,
  readPreparedCurrentForecastThroughDashboard,
  requestExplicitCurrentForecastPreparationThroughDashboard,
  resolveForecastCurrentDisplayState,
  resolveForecastCurrentUiState,
  resolveSelectedProgressiveVariant,
  shouldReadCurrentForecast,
  shouldShowExplicitCurrentPreparation,
  warmCurrentForecastThroughDashboard,
} from '@/lib/benchmark-forecast/interactive-current-client'

import type {
  ComponentListItem,
  ComponentListResponse,
  SeriesResponse,
} from '@/lib/time-series/series-contract'
import {
  FORECAST_ACCURACY_HORIZONS,
  type ForecastAccuracyHorizonMonths,
  type ForecastAccuracyResponse,
} from '@/lib/forecast-accuracy/forecast-accuracy-contract'
import {
  toForecastAccuracyViewerPayload,
} from '@/lib/time-series-viewer/forecast-accuracy-to-time-series-viewer'
import { buildForecastPortfolioPayload } from '@/lib/time-series-viewer/forecast-portfolio-to-time-series-viewer'
import { toTimeSeriesViewerPayload } from '@/lib/time-series-viewer/raw-data-to-time-series-viewer'
import type {
  TimeSeriesViewerLocale,
  TimeSeriesViewerDetailModel,
  TimeSeriesViewerTooltipModel,
  TimeSeriesViewerPayload,
  TimeSeriesViewerPoint,
  TimeSeriesViewerSeries,
} from '@/lib/time-series-viewer/time-series-viewer-contract'

type Locale = TimeSeriesViewerLocale
type TooltipVariant = TimeSeriesViewerSeries['kind'] | 'forecast-accuracy'
type VisibilityKey = TooltipVariant

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type RangePreset = '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'
type DragSelection = { startX: number; currentX: number } | null
type TooltipCardRow = { label: string; value: string }
type TooltipCardModel = {
  series: string
  component: string
  date: string
  primaryLabel: string | null
  primaryValue: string
  forecastInterval: { label: string; lowerValue: string; upperValue: string } | null
  detailRows: TooltipCardRow[]
  businessDescriptionLines: string[]
}
type SharedTooltipRow = {
  key: string
  label: string
  value: string
  kind: TimeSeriesViewerSeries['kind']
  lineStyle: TimeSeriesViewerSeries['lineStyle']
  isMissing: boolean
}
type SharedTooltipCardModel = {
  component: string
  date: string
  rows: SharedTooltipRow[]
}
type SeriesPointSurface = {
  key: string
  point: TimeSeriesViewerPoint
  variant: Exclude<TooltipVariant, 'forecast-accuracy'>
  seriesLabel: string
}
type AccuracyMarker = {
  key: string
  component: string
  date: string
  value: number
  diff: number
  tooltipModel: TimeSeriesViewerTooltipModel
  variant: 'forecast-accuracy'
}
type TooltipSurface = AccuracyMarker | SeriesPointSurface
type TooltipPlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
type CachedSeriesEntry = {
  response: SeriesResponse
  payload: TimeSeriesViewerPayload
  cachedAt: number
}
type ForecastLayerCacheEntry<T> = {
  payload: T
  cachedAt: number
}

type BackgroundWarmupOutcome = Awaited<ReturnType<typeof warmCurrentForecastThroughDashboard>>

type UiLoadErrorState = {
  title: string
  message: string
}

type ClientSeriesProfiling = {
  componentName: string
  componentCode: string | null
  showForecast: boolean
  source: 'network' | 'client-cache' | 'aborted'
  requestDispatchMs: number
  networkMs: number
  responseParseMs: number
  adapterMs: number
  commitMs: number
  firstPaintMs: number
  totalInteractionMs: number
  serverTotalMs: number | null
}

type RawDataViewProfiler = {
  latest: ClientSeriesProfiling | null
  history: ClientSeriesProfiling[]
}

type SearchableSelectOption = {
  value: string
  label: string
}

type BenchmarkSubject = {
  seriesId: string
  displayName: string | null
}

function mergeAccuracyIntoViewerPayload(
  basePayload: TimeSeriesViewerPayload | null,
  accuracyPayload: TimeSeriesViewerPayload | null,
  enabled: boolean,
) {
  if (!enabled) {
    return basePayload
  }

  if (!basePayload) {
    return accuracyPayload
  }

  if (!accuracyPayload) {
    return basePayload
  }

  const mergedSeries = [...basePayload.series]

  const historicalForecastSeries = accuracyPayload.series.find((entry) => entry.kind === 'historical-forecast') ?? null

  if (historicalForecastSeries) {
    mergedSeries.push(historicalForecastSeries)
  }

  return {
    ...basePayload,
    series: mergedSeries,
  }
}

const CHART_WIDTH = 920
const CHART_HEIGHT = 320
const CHART_PADDING_TOP = 28
const CHART_PADDING_RIGHT = 34
const CHART_PADDING_BOTTOM = 44
const CHART_PADDING_LEFT = 76
const TOOLTIP_WIDTH = 300
const TOOLTIP_OFFSET = 20
const TOOLTIP_SURFACE_PADDING = 12
const TOOLTIP_HIDE_DELAY_MS = 180
const ACCURACY_TOOLTIP_ARM_DELAY_MS = 140
const ACCURACY_MARKER_AXIS_CLEARANCE = 14
const ACCURACY_MARKER_TOP_CLEARANCE = 12
const EDGE_TICK_LABEL_OFFSET = 8
const RANGE_PRESETS: RangePreset[] = ['3M', '6M', '1Y', '3Y', '5Y', 'ALL']
const CLIENT_SERIES_CACHE_TTL_MS = 30_000

type ChartLayout = {
  width: number
  height: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  dateTickTarget: number
  valueTickCount: number
  isTouch: boolean
}

function resolveChartLayout(viewportWidth: number, isTouchInput: boolean): ChartLayout {
  if (viewportWidth <= 420) {
    return {
      width: 620,
      height: 430,
      paddingTop: 20,
      paddingRight: 16,
      paddingBottom: 84,
      paddingLeft: 136,
      dateTickTarget: 3,
      valueTickCount: 4,
      isTouch: isTouchInput,
    }
  }

  if (viewportWidth <= 768) {
    return {
      width: 700,
      height: 430,
      paddingTop: 20,
      paddingRight: 18,
      paddingBottom: 80,
      paddingLeft: 132,
      dateTickTarget: 4,
      valueTickCount: 4,
      isTouch: isTouchInput,
    }
  }

  if (viewportWidth <= 1100) {
    return {
      width: 860,
      height: 390,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 58,
      paddingLeft: 108,
      dateTickTarget: 5,
      valueTickCount: 5,
      isTouch: isTouchInput,
    }
  }

  return {
    width: 980,
    height: 400,
    paddingTop: 26,
    paddingRight: 28,
    paddingBottom: 54,
    paddingLeft: 92,
    dateTickTarget: 7,
    valueTickCount: 5,
    isTouch: isTouchInput,
  }
}

function findLastDateOnOrBefore(dates: string[], threshold: Date) {
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const date = dates[index]

    if (new Date(date) <= threshold) {
      return date
    }
  }

  return null
}

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return ' - '
  }

  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value))
}

function formatSemanticDate(locale: Locale, value: string | null, detailModel?: Pick<TimeSeriesViewerDetailModel, 'temporalResolution'> | null) {
  if (!value) {
    return ' - '
  }

  if (detailModel?.temporalResolution === 'month') {
    return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
    }).format(new Date(value))
  }

  return formatDate(locale, value)
}

function formatNumber(locale: Locale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatPrimaryValue(locale: Locale, value: number | null, unit: string | null, currency: string | null) {
  const numberValue = formatNumber(locale, value)
  const suffix = [currency, unit].filter((item) => item && item.trim().length > 0).join(' ')

  return suffix ? `${numberValue} ${suffix}` : numberValue
}

function looksTechnicalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    return false
  }

  if (/^cmr[a-z0-9]{8,}$/i.test(normalized)) {
    return true
  }

  if (/^[a-z0-9_]{8,}$/i.test(normalized) && !/[\s-]/.test(normalized) && normalized === normalized.toLowerCase()) {
    return true
  }

  return false
}

function tooltipVariantClass(variant: TooltipVariant) {
  switch (variant) {
    case 'historical':
      return 'is-historical'
    case 'monthly-actual':
      return 'is-monthly-actual'
    case 'historical-forecast':
      return 'is-historical-forecast'
    case 'forecast-central':
      return 'is-forecast-central'
    case 'forecast-upper':
      return 'is-forecast-upper'
    case 'forecast-lower':
      return 'is-forecast-lower'
    case 'forecast-accuracy':
      return 'is-forecast-accuracy'
  }
}

function formatSeriesLabel(locale: Locale, kind: TooltipVariant) {
  switch (kind) {
    case 'historical':
      return locale === 'pl' ? 'Ceny historyczne' : 'Historical Prices'
    case 'monthly-actual':
      return locale === 'pl' ? 'Miesięczny odczyt' : 'Monthly actual'
    case 'historical-forecast':
      return locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast'
    case 'forecast-central':
      return locale === 'pl' ? 'Prognoza' : 'Forecast'
    case 'forecast-upper':
      return locale === 'pl' ? 'Górne ograniczenie prognozy' : 'Forecast Upper Bound'
    case 'forecast-lower':
      return locale === 'pl' ? 'Dolne ograniczenie prognozy' : 'Forecast Lower Bound'
    case 'forecast-accuracy':
      return locale === 'pl' ? 'Trafność prognozy' : 'Forecast Accuracy'
  }
}

function toSeriesPointSurface(
  point: TimeSeriesViewerPoint,
  variant: Exclude<TooltipVariant, 'forecast-accuracy'>,
  seriesLabel: string,
): SeriesPointSurface {
  return {
    key: `${variant}:${point.key}`,
    point,
    variant,
    seriesLabel,
  }
}

function replaceLocaleInPath(pathname: string, nextLocale: Locale) {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return `/${nextLocale}`
  }

  if (segments[0] === 'pl' || segments[0] === 'en') {
    segments[0] = nextLocale
    return `/${segments.join('/')}`
  }

  return `/${nextLocale}/${segments.join('/')}`
}

function buildClientSeriesCacheKey(locale: Locale, componentName: string, componentCode: string, showForecast: boolean) {
  return JSON.stringify({ locale, componentName, componentCode: componentCode || null, showForecast })
}

function buildBenchmarkSeriesCacheKey(locale: Locale, seriesId: string, range: RangePreset) {
  return JSON.stringify({ locale, seriesId, range, mode: 'benchmark' })
}

function buildForecastLayerCacheKey(
  locale: Locale,
  seriesId: string,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  layer: 'current' | 'verification',
) {
  return JSON.stringify({ locale, seriesId, model, targetBasis, layer })
}

function forecastModelLabel(locale: Locale, model: ForecastPortfolioModelId) {
  switch (model) {
    case 'naive':
      return 'Naive'
    case 'damped_holt':
      return 'Damped Holt'
    case 'ets':
      return 'ETS'
    case 'arima':
      return 'ARIMA'
  }
}

function forecastTargetBasisLabel(locale: Locale, targetBasis: ForecastTargetBasis) {
  switch (targetBasis) {
    case 'POINT_IN_TIME':
      return locale === 'pl' ? 'Dzienna' : 'Daily'
    case 'END_OF_PERIOD':
      return locale === 'pl' ? 'Koniec okresu' : 'End of period'
    case 'MONTHLY_AVERAGE':
    default:
      return locale === 'pl' ? 'Średnia miesięczna' : 'Monthly average'
  }
}

function forecastPreparationStateLabel(locale: Locale, state: ProgressiveForecastPreparationState) {
  switch (state) {
    case 'READY':
      return locale === 'pl' ? 'Gotowe' : 'Ready'
    case 'PREPARING':
      return locale === 'pl' ? 'Przygotowywanie' : 'Preparing'
    case 'QUEUED':
      return locale === 'pl' ? 'W kolejce' : 'Queued'
    case 'FAILED':
      return locale === 'pl' ? 'Błąd' : 'Failed'
    case 'UNSUPPORTED':
    default:
      return locale === 'pl' ? 'Niewspierane' : 'Unsupported'
  }
}

export function buildForecastControlButtonMeta(
  label: string,
  locale: Locale,
  state: ProgressiveForecastPreparationState | null,
) {
  return {
    label,
    statusLabel: state ? forecastPreparationStateLabel(locale, state) : null,
    state,
  }
}

function InfoButton({
  label,
  lines,
  tabIndex = 0,
}: {
  label: string
  lines: string[]
  tabIndex?: number
}) {
  return (
    <button
      type="button"
      className="control-info-button"
      aria-label={label}
      title={label}
      tabIndex={tabIndex}
    >
      i
      <span className="control-info-tooltip" role="tooltip">
        {lines.map((line) => (
          <span key={`${label}-${line}`}>{line}</span>
        ))}
      </span>
    </button>
  )
}

function readBenchmarkSubject(searchParams: ReturnType<typeof useSearchParams>): BenchmarkSubject | null {
  const seriesId = searchParams.get('seriesId')?.trim() ?? ''
  if (!seriesId) {
    return null
  }

  const displayName = searchParams.get('displayName')?.trim() ?? null
  return {
    seriesId,
    displayName: displayName && displayName.length > 0 ? displayName : null,
  }
}

function readInitialRange(searchParams: ReturnType<typeof useSearchParams>): RangePreset {
  const value = searchParams.get('range')?.trim().toUpperCase()

  switch (value) {
    case '3M':
    case '6M':
    case '1Y':
    case '3Y':
    case '5Y':
    case 'ALL':
      return value
    default:
      return '1Y'
  }
}

type SearchParamsReader = Pick<ReturnType<typeof useSearchParams>, 'get'>

export function shouldWarmCurrentForecastInBackground(
  searchParams: SearchParamsReader,
  options: {
    embedded: boolean
    variant: DashboardVariantId
  },
) {
  return options.embedded
    && options.variant === 'forecast-portfolio-v3'
    && searchParams.get('warmCurrentForecast')?.trim() === '1'
}

function getRawDataViewProfiler() {
  if (typeof window === 'undefined') {
    return null
  }

  const profilerWindow = window as Window & { __rawDataViewProfile?: RawDataViewProfiler }

  if (!profilerWindow.__rawDataViewProfile) {
    profilerWindow.__rawDataViewProfile = {
      latest: null,
      history: [],
    }
  }

  return profilerWindow.__rawDataViewProfile
}

function recordRawDataViewProfile(sample: ClientSeriesProfiling) {
  const profiler = getRawDataViewProfiler()

  if (!profiler) {
    return
  }

  profiler.latest = sample
  profiler.history = [sample, ...profiler.history].slice(0, 20)
}

function toUiLoadErrorState(
  error: unknown,
  fallbackTitle: string,
  fallbackMessage: string,
  timeoutMessage: string,
  blockedTitle?: string,
  blockedMessage?: string,
): UiLoadErrorState {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      title: fallbackTitle,
      message: timeoutMessage,
    }
  }

  if ((message.includes('provenance_required') || message.includes('provenance required')) && blockedTitle && blockedMessage) {
    return {
      title: blockedTitle,
      message: blockedMessage,
    }
  }

  return {
    title: fallbackTitle,
    message: fallbackMessage,
  }
}

function toUiLoadErrorMessage(
  error: unknown,
  fallbackMessage: string,
  timeoutMessage: string,
) {
  return toUiLoadErrorState(error, '', fallbackMessage, timeoutMessage).message
}

type ForecastVerificationErrorMessages = {
  verificationUnavailable: string
  verificationUnavailableHint: string
  verificationBlocked: string
  verificationBlockedHint: string
}

export function resolveForecastVerificationUnavailableState(
  result: BenchmarkForecastVerificationResult,
  messages: ForecastVerificationErrorMessages,
): UiLoadErrorState | null {
  if (result.status === 'AVAILABLE') {
    return null
  }

  const reason = result.reason.toUpperCase()

  if (reason.includes('PREPARATION_REQUIRED')) {
    return {
      title: messages.verificationUnavailable,
      message: messages.verificationUnavailableHint,
    }
  }

  if (reason.includes('UNSUPPORTED')) {
    return {
      title: messages.verificationBlocked,
      message: messages.verificationBlockedHint,
    }
  }

  return {
    title: messages.verificationUnavailable,
    message: result.reason,
  }
}

function SearchableSelect({
  label,
  placeholder,
  emptyStateTitle,
  emptyStateHint,
  options,
  value,
  searchValue,
  onSearchChange,
  onValueChange,
}: {
  label: string
  placeholder: string
  emptyStateTitle: string
  emptyStateHint: string
  options: SearchableSelectOption[]
  value: string
  searchValue: string
  onSearchChange: (value: string) => void
  onValueChange: (value: string) => void
}) {
  const listboxId = useId()
  const comboboxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const normalizedSearch = searchValue.trim().toLowerCase()
  const selectedOption = options.find((option) => option.value === value) ?? null
  const filteredOptions = normalizedSearch.length === 0
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(normalizedSearch))

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    inputRef.current?.focus()
  }, [filteredOptions, isOpen, value])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        onSearchChange('')
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onSearchChange])

  function openDropdown() {
    setIsOpen(true)
  }

  function closeDropdown() {
    setIsOpen(false)
    onSearchChange('')
  }

  function commitSelection(option: SearchableSelectOption) {
    inputRef.current?.blur()

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    onValueChange(option.value)
    closeDropdown()
  }

  function moveHighlight(direction: -1 | 1) {
    if (filteredOptions.length === 0) {
      return
    }

    setHighlightedIndex((current) => {
      const nextIndex = current + direction

      if (nextIndex < 0) {
        return filteredOptions.length - 1
      }

      if (nextIndex >= filteredOptions.length) {
        return 0
      }

      return nextIndex
    })
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDropdown()
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight(-1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const nextOption = filteredOptions[highlightedIndex]

      if (nextOption) {
        commitSelection(nextOption)
      }

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
    }
  }

  return (
    <label className="control-block control-block-searchable">
      <span>{label}</span>
      <div ref={comboboxRef} className={`control-combobox${isOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="control-combobox-trigger"
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
        >
          <span className="control-combobox-trigger-value">{selectedOption?.label ?? placeholder}</span>
          <span className="control-combobox-trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false">
              <path d="M11.5 10.5 14 13" />
              <circle cx="7" cy="7" r="4.25" />
            </svg>
          </span>
        </button>

        {isOpen ? (
          <div className="control-combobox-panel">
            <div className="control-combobox-search-row">
              <span className="control-combobox-search-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false">
                  <path d="M11.5 10.5 14 13" />
                  <circle cx="7" cy="7" r="4.25" />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={placeholder}
                className="control-search-input"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={filteredOptions[highlightedIndex] ? `${listboxId}-${filteredOptions[highlightedIndex]?.value}` : undefined}
              />
            </div>

            {filteredOptions.length === 0 ? (
              <div className="control-combobox-empty" role="status">
                <strong>{emptyStateTitle}</strong>
                <span>{emptyStateHint}</span>
              </div>
            ) : (
              <ul id={listboxId} className="control-combobox-list" role="listbox">
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value
                  const isHighlighted = index === highlightedIndex

                  return (
                    <li key={option.value}>
                      <button
                        id={`${listboxId}-${option.value}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`control-combobox-option${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onTouchStart={(event) => event.preventDefault()}
                        onClick={() => commitSelection(option)}
                      >
                        {option.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function buildSourceLine(locale: Locale, payload: TimeSeriesViewerPayload) {
  const lines = [
    buildCountryBadge(locale, payload.country, payload.description),
    payload.description,
    !payload.description ? payload.market : null,
  ]

  return lines.filter((line): line is string => Boolean(line && line.trim().length > 0)).join(' · ')
}

function buildTooltipDescriptionLines(payload: TimeSeriesViewerPayload) {
  const lines = [payload.description ?? payload.market ?? null]
  return lines.filter((line): line is string => Boolean(line && line.trim().length > 0))
}

function resolveTooltipPoint(surface: TooltipSurface | TimeSeriesViewerPoint, locale: Locale, payload: TimeSeriesViewerPayload) {
  if ('point' in surface) {
    return resolveTooltipPoint(surface.point, locale, payload)
  }

  if ('detailModel' in surface) {
    const detailRows = surface.tooltipModel.rows
      .filter((row) => row.label !== 'Series' && row.label !== 'Seria' && row.label !== 'Value' && row.label !== 'Wartość')
      .map((row) => ({ label: row.label, value: row.value }))

    return {
      component: surface.detailModel.componentName,
      date: surface.detailModel.sourceDate,
      value: surface.value,
      primaryLabel: null,
      interval: surface.detailModel.scenarioType !== 'historical' && surface.detailModel.forecastLower !== null && surface.detailModel.forecastUpper !== null
        ? {
            label: locale === 'pl' ? 'Prognoza' : 'Forecast',
            lowerValue: formatNumber(locale, surface.detailModel.forecastLower),
            upperValue: formatNumber(locale, surface.detailModel.forecastUpper),
          }
        : null,
      detailRows,
      businessDescriptionLines: buildTooltipDescriptionLines(payload),
    }
  }

  const accuracySurface = surface as AccuracyMarker

  return {
    component: accuracySurface.component,
    date: accuracySurface.date,
    value: accuracySurface.value,
    primaryLabel: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual',
    interval: null,
    detailRows: [] as TooltipCardRow[],
    businessDescriptionLines: [],
  }
}

function buildTooltipCardModel(
  locale: Locale,
  surface: TooltipSurface | TimeSeriesViewerPoint,
  payload: TimeSeriesViewerPayload,
): TooltipCardModel {
  const surfacePoint = 'point' in surface ? surface.point : surface
  const resolved = resolveTooltipPoint(surface, locale, payload)
  const variant = resolveSurfaceVariant(surface)
  const detailModel = 'detailModel' in surfacePoint ? surfacePoint.detailModel : null
  const actualRowLabel = locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual'
  const seriesLabel = 'seriesLabel' in surface
    ? surface.seriesLabel
    : variant === 'historical-forecast'
    ? (locale === 'pl' ? 'Sprawdzalność prognozy' : 'Forecast Verification')
    : formatSeriesLabel(locale, variant)
  const actualRow = variant === 'historical-forecast'
    ? resolved.detailRows.find((row) => row.label === actualRowLabel) ?? null
    : null
  const detailRows = variant === 'historical-forecast'
    ? resolved.detailRows.filter((row) => row.label !== actualRowLabel)
    : resolved.detailRows

  return {
    series: seriesLabel,
    component: resolved.component,
    date: formatSemanticDate(locale, resolved.date, detailModel),
    primaryLabel: variant === 'historical-forecast' ? actualRowLabel : resolved.primaryLabel,
    primaryValue: variant === 'historical-forecast'
      ? (actualRow?.value ?? ' - ')
      : variant === 'forecast-accuracy'
      ? formatNumber(locale, resolved.value)
      : formatPrimaryValue(locale, detailModel?.value ?? ('detailModel' in surfacePoint || isAccuracySurface(surface) ? surfacePoint.value : null), detailModel?.unit ?? payload.unit, detailModel?.currency ?? payload.currency),
    forecastInterval: resolved.interval,
    detailRows,
    businessDescriptionLines: resolved.businessDescriptionLines,
  }
}

function buildDeltaOverlayPath(
  overlay: TimeSeriesViewerPayload['deltaOverlays'][number],
  pointX: (date: string) => number,
  pointY: (value: number | null) => number,
) {
  if (overlay.points.length < 4) {
    return ''
  }

  const vertices = overlay.points
    .map((point) => `${pointX(point.date)},${pointY(point.value)}`)
    .join(' L ')

  return `M ${vertices} Z`
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function uniqueSortedDates(series: TimeSeriesViewerSeries[]) {
  return Array.from(new Set(series.flatMap((entry) => entry.points.map((point) => point.date))))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
}

function buildDateTicks(locale: Locale, dates: string[], targetCount: number) {
  if (dates.length === 0) {
    return []
  }

  const step = Math.max(1, Math.ceil(dates.length / Math.max(targetCount, 2)))

  return dates
    .filter((_, index) => index % step === 0 || index === dates.length - 1)
    .map((date, index, items) => ({
      value: date,
      label: formatDate(locale, date).replace(/, /g, ' '),
      offset: items.length === 1 ? 0 : index / (items.length - 1),
    }))
}

function buildValueTicks(locale: Locale, values: number[], tickCount: number) {
  const domain = resolveNiceScaleDomain(values)

  return domain.ticks.map((tick) => ({
    value: tick.value,
    label: formatNumber(locale, tick.value),
    offset: tick.offset,
  }))
}

export function resolvePresetRange(historicalDates: string[], forecastDates: string[], preset: RangePreset): VisibleRange | null {
  if (historicalDates.length === 0 && forecastDates.length === 0) {
    return null
  }

  if (historicalDates.length === 0) {
    return {
      start: forecastDates[0] ?? new Date(0).toISOString(),
      end: forecastDates[forecastDates.length - 1] ?? new Date(0).toISOString(),
    }
  }

  const historicalStart = historicalDates[0]
  const historicalEnd = historicalDates[historicalDates.length - 1]

  if (preset === 'ALL') {
    const forecastEnd = forecastDates.length > 0
      ? findLastDateOnOrBefore(forecastDates, endOfDay(addMonths(new Date(historicalEnd), 12))) ?? historicalEnd
      : historicalEnd

    return { start: historicalStart, end: forecastEnd }
  }

  const historicalMonths = {
    '3M': -3,
    '6M': -6,
    '1Y': -12,
    '3Y': -36,
    '5Y': -60,
    ALL: 0,
  }[preset]

  const forecastMonths = {
    '3M': 3,
    '6M': 6,
    '1Y': 12,
    '3Y': 12,
    '5Y': 12,
    ALL: 12,
  }[preset]

  const threshold = addMonths(new Date(historicalEnd), historicalMonths)
  const firstVisibleHistorical = historicalDates.find((date) => new Date(date) >= threshold) ?? historicalStart
  const forecastEnd = forecastDates.length > 0
    ? findLastDateOnOrBefore(forecastDates, endOfDay(addMonths(new Date(historicalEnd), forecastMonths))) ?? historicalEnd
    : historicalEnd

  return { start: firstVisibleHistorical, end: forecastEnd }
}

function flagFromCountryCode(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

function buildCountryBadge(locale: Locale, country: string | null, description: string | null) {
  const normalizedCountry = country?.trim() ?? null

  if (normalizedCountry && /^[A-Za-z]{2}$/.test(normalizedCountry)) {
    return `${flagFromCountryCode(normalizedCountry)} ${normalizedCountry.toUpperCase()}`
  }

  const normalizedDescription = description?.trim().toLowerCase() ?? ''
  if (normalizedDescription.startsWith('world') || normalizedDescription.startsWith('świat')) {
    return locale === 'pl' ? 'Świat' : 'World'
  }

  return null
}

function clampChartX(value: number, layout: ChartLayout) {
  return Math.max(layout.paddingLeft, Math.min(layout.width - layout.paddingRight, value))
}

function chartXFromClientX(clientX: number, rect: DOMRect, layout: ChartLayout) {
  const ratio = (clientX - rect.left) / rect.width
  return clampChartX(ratio * layout.width, layout)
}

function dateFromChartX(x: number, dates: string[], layout: ChartLayout) {
  if (dates.length === 0) {
    return null
  }

  const ratio = (x - layout.paddingLeft) / (layout.width - layout.paddingLeft - layout.paddingRight)
  const index = Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1))))
  return dates[index] ?? null
}

function buildPolylinePoints(
  points: TimeSeriesViewerPoint[],
  pointX: (date: string) => number,
  pointY: (value: number | null) => number,
) {
  const validPoints = points.filter((point) => point.value !== null)

  if (validPoints.length === 0) {
    return ''
  }

  return validPoints
    .map((point) => {
      const x = pointX(point.date)
      const y = pointY(point.value)
      return `${x},${y}`
    })
    .join(' ')
}

function buildAreaBetweenSeriesPath(
  primarySeries: TimeSeriesViewerSeries | null,
  secondarySeries: TimeSeriesViewerSeries | null,
  pointX: (date: string) => number,
  pointY: (value: number | null) => number,
) {
  if (!primarySeries || !secondarySeries) {
    return ''
  }

  const toDateKey = (value: string) => new Date(value).toISOString().slice(0, 10)

  const secondaryByDate = new Map(
    secondarySeries.points
      .filter((point) => point.value !== null)
      .map((point) => [toDateKey(point.date), point]),
  )

  const pairs = primarySeries.points
    .filter((point) => point.value !== null)
    .map((point) => {
      const secondaryPoint = secondaryByDate.get(toDateKey(point.date)) ?? null

      if (!secondaryPoint || secondaryPoint.value === null) {
        return null
      }

      return {
        date: point.date,
        primaryValue: point.value,
        secondaryValue: secondaryPoint.value,
      }
    })
    .filter((pair): pair is { date: string; primaryValue: number; secondaryValue: number } => pair !== null)

  if (pairs.length < 2) {
    return ''
  }

  const upperPath = pairs
    .map((pair) => `${pointX(pair.date)},${pointY(pair.primaryValue)}`)
    .join(' L ')
  const lowerPath = [...pairs]
    .reverse()
    .map((pair) => `${pointX(pair.date)},${pointY(pair.secondaryValue)}`)
    .join(' L ')

  return `M ${upperPath} L ${lowerPath} Z`
}

function buildDeltaOverlayBoundaryPolyline(
  points: { date: string; value: number }[],
  pointX: (date: string) => number,
  pointY: (value: number | null) => number,
) {
  if (points.length < 2) {
    return ''
  }

  return points
    .map((point) => `${pointX(point.date)},${pointY(point.value)}`)
    .join(' ')
}

function buildPlotGeometry(series: TimeSeriesViewerSeries[], layout: ChartLayout) {
  const allDates = Array.from(new Set(series.flatMap((entry) => entry.points.map((point) => point.date))))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
  const allValues = series.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const yDomain = resolveNiceScaleDomain(allValues)
  const minimum = yDomain.minimum
  const maximum = yDomain.maximum
  const dateDenominator = Math.max(allDates.length - 1, 1)
  const valueRange = maximum - minimum || 1

  function pointX(date: string) {
    return layout.paddingLeft + (resolveDatePlotOffset(allDates, date) / dateDenominator) * (layout.width - layout.paddingLeft - layout.paddingRight)
  }

  function pointY(value: number | null) {
    return layout.height - layout.paddingBottom - (((value ?? minimum) - minimum) / valueRange) * (layout.height - layout.paddingTop - layout.paddingBottom)
  }

  return {
    minimum,
    maximum,
    yDomain,
    pointX,
    pointY,
  }
}

function resolveSeriesOrder(kind: string) {
  switch (kind) {
    case 'historical':
      return 0
    case 'monthly-actual':
      return 1
    case 'historical-forecast':
      return 2
    case 'forecast-central':
      return 3
    case 'forecast-lower':
      return 4
    case 'forecast-upper':
      return 5
    default:
      return 100
  }
}

function buildSharedTooltipCardModel(
  locale: Locale,
  date: string,
  payload: TimeSeriesViewerPayload,
  series: TimeSeriesViewerSeries[],
): SharedTooltipCardModel {
  const rows = [...series]
    .sort((left, right) => resolveSeriesOrder(left.kind) - resolveSeriesOrder(right.kind))
    .map((entry) => {
      const point = entry.points.find((candidate) => candidate.date === date) ?? null
      const detailModel = point?.detailModel ?? null

      return {
        key: `${entry.id}-${date}`,
        label: entry.kind === 'historical-forecast'
          ? (point?.tooltipModel.rows.find((row) => row.label === (locale === 'pl' ? 'Seria' : 'Series'))?.value ?? entry.label)
          : entry.label,
        value: point
          ? formatPrimaryValue(locale, point.value, detailModel?.unit ?? payload.unit, detailModel?.currency ?? payload.currency)
          : '—',
        kind: entry.kind,
        lineStyle: entry.lineStyle,
        isMissing: point === null,
      }
    })

  return {
    component: payload.title,
    date: formatSemanticDate(locale, date, series.find((entry) => entry.points.some((point) => point.date === date))?.points.find((point) => point.date === date)?.detailModel ?? null),
    rows,
  }
}

function hasSharedTooltipRows(card: SharedTooltipCardModel | null) {
  return card !== null && card.rows.some((row) => !row.isMissing)
}

function legendClass(kind: TimeSeriesViewerSeries['kind']) {
  switch (kind) {
    case 'historical':
      return 'historical'
    case 'monthly-actual':
      return 'monthly-actual'
    case 'historical-forecast':
      return 'historical-forecast'
    case 'forecast-central':
      return 'forecast-central'
    case 'forecast-upper':
      return 'forecast-upper'
    case 'forecast-lower':
      return 'forecast-lower'
  }
}

function hasMarkerOnlyLegend(entry: TimeSeriesViewerSeries) {
  return entry.kind === 'monthly-actual'
    && Array.isArray(entry.segments)
    && entry.segments.length > 0
    && entry.segments.every((segment) => segment.length <= 1)
}

function resolveSurfaceVariant(surface: TooltipSurface | TimeSeriesViewerPoint): TooltipVariant {
  if ('point' in surface) {
    return surface.variant
  }

  return 'detailModel' in surface ? surface.detailModel.scenarioType as TooltipVariant : surface.variant
}

function isAccuracySurface(surface: TooltipSurface | TimeSeriesViewerPoint): surface is AccuracyMarker {
  return !('point' in surface) && !('detailModel' in surface) && 'diff' in surface && 'value' in surface
}

function tooltipSurfaceDate(surface: TooltipSurface) {
  return 'point' in surface ? surface.point.date : surface.date
}

function tooltipSurfaceValue(surface: TooltipSurface) {
  return 'point' in surface ? surface.point.value : surface.value
}

function ChartPanel({
  locale,
  payload,
  emptyMessage,
  isLoading,
  loadingTitle,
  loadingHint,
  resetZoomLabel,
  sourceLabel,
  showForecastAccuracy,
  verificationRibbonLabel,
  verificationRibbonInfoLabel,
  verificationRibbonInfoLines,
  initialPreset = 'ALL',
  lockServerRange = false,
  onPresetChange,
  embedded = false,
}: {
  locale: Locale
  payload: TimeSeriesViewerPayload | null
  emptyMessage: string
  isLoading: boolean
  loadingTitle: string
  loadingHint: string
  resetZoomLabel: string
  sourceLabel: string
  showForecastAccuracy: boolean
  verificationRibbonLabel: string
  verificationRibbonInfoLabel: string
  verificationRibbonInfoLines: string[]
  initialPreset?: RangePreset
  lockServerRange?: boolean
  onPresetChange?: (preset: RangePreset) => void
  embedded?: boolean
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<AccuracyMarker | null>(null)
  const [activePreset, setActivePreset] = useState<RangePreset>(initialPreset)
  const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSurface, setSelectedSurface] = useState<TooltipSurface | null>(null)
  const [selectedSurfaceVariant, setSelectedSurfaceVariant] = useState<TooltipVariant | null>(null)
  const [armedAccuracyKey, setArmedAccuracyKey] = useState<string | null>(null)
  const [zoomRange, setZoomRange] = useState<VisibleRange | null>(null)
  const [dragSelection, setDragSelection] = useState<DragSelection>(null)
  const [hiddenItems, setHiddenItems] = useState<VisibilityKey[]>([])
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; placement: TooltipPlacement } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth)
  const [isTouchInput, setIsTouchInput] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartSurfaceRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armAccuracyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chartLayout = resolveChartLayout(viewportWidth, isTouchInput)
  const useCompactTooltipRail = viewportWidth <= 420
  const pinnedSurfaceKey = selectedSurface?.key ?? selectedSurfaceKey ?? selectedDate
  const chartScene = useMemo(() => {
    if (!payload || payload.series.every((entry) => entry.points.length === 0)) {
      return null
    }

    const historicalSeries = payload.series.find((entry) => entry.kind === 'historical') ?? null
    const forecastSeries = payload.series.filter((entry) => entry.kind !== 'historical')
    const filteredSeries = payload.series.filter((entry) => !hiddenItems.includes(entry.kind))
    const historicalDates = uniqueSortedDates(historicalSeries ? [historicalSeries] : [])
    const forecastDates = uniqueSortedDates(forecastSeries)
    const presetRange = resolvePresetRange(historicalDates, forecastDates, activePreset)
    const effectiveRange = zoomRange ?? presetRange
    const visibleSeries = filterSeriesToVisibleRange(filteredSeries, effectiveRange)
    const visibleDates = uniqueSortedDates(visibleSeries)
    const visibleValues = visibleSeries.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
    const geometry = buildPlotGeometry(visibleSeries, chartLayout)
    const clippedDeltaOverlays = clipDeltaOverlaysToRange(payload.deltaOverlays, effectiveRange)
    const xTicks = buildDateTicks(locale, visibleDates, chartLayout.dateTickTarget)
    const yTicks = buildValueTicks(locale, visibleValues, chartLayout.valueTickCount)
    const historicalVisibleSeries = visibleSeries.find((entry) => entry.kind === 'historical') ?? null
    const historicalForecastVisibleSeries = visibleSeries.find((entry) => entry.kind === 'historical-forecast') ?? null
    const usesEndOfPeriodOverlayGeometry = payload.verificationTargetBasis === 'END_OF_PERIOD' || payload.verificationTargetBasis === 'POINT_IN_TIME'
    const historicalVisualGeometry = prepareVisibleSeriesGeometry(historicalVisibleSeries, geometry.pointX, geometry.pointY)
    const historicalForecastVisualGeometry = prepareVisibleSeriesGeometry(historicalForecastVisibleSeries, geometry.pointX, geometry.pointY)
    const historicalForecastDeltaPath = showForecastAccuracy
      && payload.deltaOverlays.length === 0
      && historicalVisibleSeries
      && historicalForecastVisibleSeries
      && historicalVisibleSeries.points.every((point) => point.detailModel.temporalResolution === 'month')
      ? buildAreaBetweenSeriesPath(historicalVisibleSeries, historicalForecastVisibleSeries, geometry.pointX, geometry.pointY)
      : ''
    const deltaOverlayPaths = showForecastAccuracy
      ? usesEndOfPeriodOverlayGeometry
        ? buildEndOfPeriodDeltaSurfaces(historicalVisualGeometry, historicalForecastVisualGeometry)
        : clippedDeltaOverlays
            .map((overlay) => ({
              key: overlay.key,
              sign: overlay.sign,
              path: buildDeltaOverlayPath(overlay, geometry.pointX, geometry.pointY),
              actualBoundary: '',
              forecastBoundary: '',
              samples: [],
            }))
            .filter((overlay) => overlay.path.length > 0)
      : []
    const lineLayers = visibleSeries.map((entry, index) => ({
      entry,
      index,
      polylines: entry.kind === 'historical'
        ? historicalVisualGeometry.polylines
        : entry.kind === 'historical-forecast'
          ? historicalForecastVisualGeometry.polylines
          : (entry.segments && entry.segments.length > 0 ? entry.segments : [entry.points])
              .map((points) => buildPolylinePoints(points, geometry.pointX, geometry.pointY))
              .filter((polyline) => polyline.length > 0),
    }))

    return {
      effectiveRange,
      visibleSeries,
      visibleDates,
      historicalVisibleSeries,
      historicalForecastVisibleSeries,
      usesEndOfPeriodOverlayGeometry,
      historicalForecastDeltaPath,
      deltaOverlayPaths,
      lineLayers,
      xTicks,
      yTicks,
      ...geometry,
    }
  }, [
    payload,
    hiddenItems,
    activePreset,
    zoomRange,
    locale,
    showForecastAccuracy,
    chartLayout.width,
    chartLayout.height,
    chartLayout.paddingTop,
    chartLayout.paddingRight,
    chartLayout.paddingBottom,
    chartLayout.paddingLeft,
    chartLayout.dateTickTarget,
    chartLayout.valueTickCount,
    chartLayout.isTouch,
  ])

  useEffect(() => {
    setActivePreset(initialPreset)
    setZoomRange(null)
    setSelectedSurfaceKey(null)
    setSelectedDate(null)
    setSelectedSurface(null)
    setSelectedSurfaceVariant(null)
    setActiveDate(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(null)
    setHiddenItems([])
    setTooltipPosition(null)
  }, [initialPreset, payload?.benchmarkCode, payload?.title])

  useEffect(() => {
    return () => {
      if (hideTooltipTimeoutRef.current) {
        clearTimeout(hideTooltipTimeoutRef.current)
      }

      if (armAccuracyTimeoutRef.current) {
        clearTimeout(armAccuracyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const pointerMedia = window.matchMedia('(pointer: coarse)')

    function updateResponsiveState() {
      setViewportWidth(window.innerWidth)
      setIsTouchInput(pointerMedia.matches)
    }

    updateResponsiveState()
    window.addEventListener('resize', updateResponsiveState)
    pointerMedia.addEventListener?.('change', updateResponsiveState)

    return () => {
      window.removeEventListener('resize', updateResponsiveState)
      pointerMedia.removeEventListener?.('change', updateResponsiveState)
    }
  }, [])

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      clearHideTimeout()
      setActiveDate(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
      setSelectedDate(null)
      setSelectedSurface(null)
      setSelectedSurfaceVariant(null)
      setArmedAccuracyKey(null)
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  useEffect(() => {
    if (chartLayout.isTouch || useCompactTooltipRail) {
      setTooltipPosition(null)
      return
    }

    if (isLoading || !chartScene) {
      setTooltipPosition(null)
      return
    }

    if (!tooltipRef.current || !chartSurfaceRef.current || !svgRef.current) {
      setTooltipPosition(null)
      return
    }

    const displaySurfaceTooltip = selectedSurface ?? activeTooltip
    const displaySharedDate = displaySurfaceTooltip ? null : (selectedDate ?? activeDate)

    if (!displaySurfaceTooltip && !displaySharedDate) {
      setTooltipPosition(null)
      return
    }

    const anchorX = chartScene.pointX(displaySurfaceTooltip ? tooltipSurfaceDate(displaySurfaceTooltip) : (displaySharedDate ?? chartScene.visibleDates[0] ?? ''))
    const anchorY = displaySurfaceTooltip ? chartScene.pointY(tooltipSurfaceValue(displaySurfaceTooltip)) : chartLayout.paddingTop + 28
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const surfaceRect = chartSurfaceRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()
    const relativeAnchorX = svgRect.left - surfaceRect.left + (anchorX / chartLayout.width) * svgRect.width
    const relativeAnchorY = svgRect.top - surfaceRect.top + (anchorY / chartLayout.height) * svgRect.height

    const candidates: Array<{ placement: TooltipPlacement; left: number; top: number }> = [
      { placement: 'top-right', left: relativeAnchorX + TOOLTIP_OFFSET, top: relativeAnchorY - tooltipRect.height - TOOLTIP_OFFSET },
      { placement: 'top-left', left: relativeAnchorX - tooltipRect.width - TOOLTIP_OFFSET, top: relativeAnchorY - tooltipRect.height - TOOLTIP_OFFSET },
      { placement: 'bottom-right', left: relativeAnchorX + TOOLTIP_OFFSET, top: relativeAnchorY + TOOLTIP_OFFSET },
      { placement: 'bottom-left', left: relativeAnchorX - tooltipRect.width - TOOLTIP_OFFSET, top: relativeAnchorY + TOOLTIP_OFFSET },
    ]

    const fits = (candidate: { left: number; top: number }) => (
      candidate.left >= TOOLTIP_SURFACE_PADDING
      && candidate.top >= TOOLTIP_SURFACE_PADDING
      && candidate.left + tooltipRect.width <= surfaceRect.width - TOOLTIP_SURFACE_PADDING
      && candidate.top + tooltipRect.height <= surfaceRect.height - TOOLTIP_SURFACE_PADDING
    )

    const selectedCandidate = candidates.find(fits) ?? candidates[0]
    const clampedLeft = Math.max(
      TOOLTIP_SURFACE_PADDING,
      Math.min(selectedCandidate.left, surfaceRect.width - tooltipRect.width - TOOLTIP_SURFACE_PADDING),
    )
    const clampedTop = Math.max(
      TOOLTIP_SURFACE_PADDING,
      Math.min(selectedCandidate.top, surfaceRect.height - tooltipRect.height - TOOLTIP_SURFACE_PADDING),
    )

    setTooltipPosition((current) => {
      if (
        current
        && current.left === clampedLeft
        && current.top === clampedTop
        && current.placement === selectedCandidate.placement
      ) {
        return current
      }

      return {
        left: clampedLeft,
        top: clampedTop,
        placement: selectedCandidate.placement,
      }
    })
  }, [isLoading, chartScene, selectedSurface, activeTooltip, selectedDate, activeDate, chartLayout, useCompactTooltipRail])

  useEffect(() => {
    if (!activeDate && !selectedDate && !activeTooltip && !selectedSurface) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (chartSurfaceRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return
      }

      clearHideTimeout()
      setActiveDate(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
      setSelectedDate(null)
      setSelectedSurface(null)
      setSelectedSurfaceVariant(null)
      setArmedAccuracyKey(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [activeDate, selectedDate, activeTooltip, selectedSurface])

  useEffect(() => {
    if ((!chartLayout.isTouch && !useCompactTooltipRail) || !tooltipRef.current || (!activeDate && !selectedDate && !activeTooltip && !selectedSurface)) {
      return
    }

    tooltipRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [chartLayout.isTouch, useCompactTooltipRail, activeDate, selectedDate, activeTooltip, selectedSurface])

  if (isLoading) {
    return (
      <section className="panel chart-panel-full" style={{ gridColumn: 'span 12', minHeight: '320px' }} aria-busy="true">
        <div className="chart-skeleton">
          <div className="chart-skeleton-header">
            <div className="chart-skeleton-block chart-skeleton-title" />
            <div className="chart-skeleton-block chart-skeleton-subtitle" />
          </div>
          <div className="chart-skeleton-legend">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={`legend-${index}`} className="chart-skeleton-pill" />
            ))}
          </div>
          <div className="chart-skeleton-surface">
            <div className="chart-skeleton-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <span key={`grid-${index}`} className="chart-skeleton-grid-line" />
              ))}
            </div>
            <div className="chart-skeleton-copy">
              <strong>{loadingTitle}</strong>
              <span>{loadingHint}</span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!payload || payload.series.every((entry) => entry.points.length === 0)) {
    return (
      <section className="panel" style={{ gridColumn: 'span 12', minHeight: '320px' }}>
        <strong>{emptyMessage}</strong>
      </section>
    )
  }

  if (!chartScene) {
    return null
  }

  const displaySurfaceTooltip = selectedSurface ?? activeTooltip
  const displaySharedDate = displaySurfaceTooltip ? null : (selectedDate ?? activeDate)
  const tooltipVariant = displaySurfaceTooltip ? resolveSurfaceVariant(displaySurfaceTooltip) : null
  const tooltipCard = displaySurfaceTooltip ? buildTooltipCardModel(locale, displaySurfaceTooltip, payload) : null
  const sharedTooltipCard = displaySharedDate ? buildSharedTooltipCardModel(locale, displaySharedDate, payload, chartScene.visibleSeries) : null
  const sourceLine = buildSourceLine(locale, payload)
  const visibleRangeLabel = chartScene.visibleDates.length > 0
    ? `${formatDate(locale, chartScene.visibleDates[0])} - ${formatDate(locale, chartScene.visibleDates[chartScene.visibleDates.length - 1])}`
    : `${formatDate(locale, chartScene.effectiveRange?.start ?? null)} - ${formatDate(locale, chartScene.effectiveRange?.end ?? null)}`
  const chartValueContext = [payload.currency, payload.unit].filter((entry) => entry && entry.trim().length > 0).join(' · ')

  const tooltipAnchorPoint = displaySurfaceTooltip || displaySharedDate
    ? (() => {
        const x = chartScene.pointX(displaySurfaceTooltip ? tooltipSurfaceDate(displaySurfaceTooltip) : (displaySharedDate ?? chartScene.visibleDates[0] ?? ''))

        if (displaySurfaceTooltip && isAccuracySurface(displaySurfaceTooltip)) {
          return {
            x,
            pointY: chartScene.pointY(displaySurfaceTooltip.value),
            tooltipY: chartScene.pointY(displaySurfaceTooltip.value) + (displaySurfaceTooltip.diff >= 0 ? -16 : 18),
          }
        }

        if (displaySurfaceTooltip && 'point' in displaySurfaceTooltip) {
          return {
            x,
            pointY: chartScene.pointY(displaySurfaceTooltip.point.value),
            tooltipY: chartScene.pointY(displaySurfaceTooltip.point.value),
          }
        }

        return {
          x,
          pointY: chartLayout.paddingTop,
          tooltipY: chartLayout.paddingTop,
        }
      })()
    : null

  function clearHideTimeout() {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current)
      hideTooltipTimeoutRef.current = null
    }
  }

  function toggleVisibility(key: VisibilityKey) {
    setHiddenItems((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  function handleSharedDateChange(date: string | null) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    setArmedAccuracyKey(null)
    clearHideTimeout()
    setActiveDate(date)
    setActiveTooltip(null)
  }

  function handleSharedDateLeave() {
    if (pinnedSurfaceKey) {
      return
    }

    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActiveDate(null)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function handleTooltipSurfaceEnter(surface: AccuracyMarker) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    clearHideTimeout()
    setArmedAccuracyKey(isAccuracySurface(surface) ? surface.key : null)
    setActiveDate(null)
    setActiveTooltip(surface)
  }

  function handleTooltipSurfaceLeave(surfaceKey: string) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    setArmedAccuracyKey((current) => current === surfaceKey ? null : current)
    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip((current) => current?.key === surfaceKey ? null : current)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function armAccuracyMarker(marker: AccuracyMarker) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
    }

    clearHideTimeout()
    setArmedAccuracyKey(marker.key)
    setActiveDate(null)
    setSelectedDate(null)
    setSelectedSurfaceKey(null)
    setSelectedSurface(null)
    setSelectedSurfaceVariant(null)
    setActiveTooltip(null)
    armAccuracyTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(marker)
      armAccuracyTimeoutRef.current = null
    }, ACCURACY_TOOLTIP_ARM_DELAY_MS)
  }

  function activateAccuracyMarker(marker: AccuracyMarker) {
    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    clearHideTimeout()
    setArmedAccuracyKey(marker.key)
    setActiveDate(null)
    setSelectedDate(null)
    setActiveTooltip(null)
    setSelectedSurfaceKey(marker.key)
    setSelectedSurface(marker)
    setSelectedSurfaceVariant('forecast-accuracy')
  }

  function handleRangePreset(preset: RangePreset) {
    setActivePreset(preset)
    onPresetChange?.(preset)
    if (!lockServerRange) {
      setZoomRange(null)
    }
  }

  function scheduleChartSurfaceDismissal() {
    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActiveDate(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
      setSelectedDate(null)
      setSelectedSurface(null)
      setSelectedSurfaceVariant(null)
      setArmedAccuracyKey(null)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function clearPinnedSelection() {
    clearHideTimeout()
    setSelectedSurfaceKey(null)
    setSelectedDate(null)
    setSelectedSurface(null)
    setSelectedSurfaceVariant(null)
    setActiveDate(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(null)
  }

  function isSelectedSeriesPoint(point: TimeSeriesViewerPoint, kind: TimeSeriesViewerSeries['kind']) {
    if (selectedSurface && 'point' in selectedSurface) {
      return selectedSurface.point.key === point.key && selectedSurface.variant === kind
    }

    return selectedSurface === null && selectedDate === point.date && !hiddenItems.includes(kind)
  }

  function resolveDateFromPointerClientX(clientX: number) {
    if (!svgRef.current || !chartScene || chartScene.visibleDates.length === 0) {
      return null
    }

    const rect = svgRef.current.getBoundingClientRect()
    const chartX = chartXFromClientX(clientX, rect, chartLayout)
    return dateFromChartX(chartX, chartScene.visibleDates, chartLayout)
  }

  function handleChartMouseDown(event: React.MouseEvent<SVGSVGElement>) {
    if (chartLayout.isTouch || event.button !== 0 || !chartScene || chartScene.visibleDates.length < 2 || !svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    const startX = chartXFromClientX(event.clientX, rect, chartLayout)
    setDragSelection({ startX, currentX: startX })
  }

  function handleChartMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!dragSelection || !svgRef.current) {
      handleSharedDateChange(resolveDateFromPointerClientX(event.clientX))
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    setDragSelection({ ...dragSelection, currentX: chartXFromClientX(event.clientX, rect, chartLayout) })
  }

  function commitZoomSelection() {
    if (!dragSelection || !chartScene || chartScene.visibleDates.length < 2) {
      setDragSelection(null)
      return
    }

    const startX = Math.min(dragSelection.startX, dragSelection.currentX)
    const endX = Math.max(dragSelection.startX, dragSelection.currentX)

    if (endX - startX < 12) {
      setDragSelection(null)
      return
    }

    const startDate = dateFromChartX(startX, chartScene.visibleDates, chartLayout)
    const endDate = dateFromChartX(endX, chartScene.visibleDates, chartLayout)

    setDragSelection(null)

    if (!startDate || !endDate || startDate === endDate) {
      return
    }

    setZoomRange(
      new Date(startDate) <= new Date(endDate)
        ? { start: startDate, end: endDate }
        : { start: endDate, end: startDate },
    )
  }

  return (
    <section className={`${embedded ? 'chart-panel-full chart-panel-embedded' : 'panel chart-panel-full'}`} style={{ gridColumn: 'span 12', minHeight: '320px' }}>
      <div className={`chart-header${embedded ? ' is-embedded' : ''}`}>
        {embedded ? null : (
          <div>
            <strong>{payload.title}</strong>
            <p className="muted chart-subtitle">{visibleRangeLabel}</p>
            {chartValueContext ? <p className="muted chart-value-context">{chartValueContext}</p> : null}
          </div>
        )}
        <div className="chart-actions">
          <div className="chart-range-buttons">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`chart-range-button${activePreset === preset && zoomRange === null ? ' is-active' : ''}`}
                onClick={() => handleRangePreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          {zoomRange && !lockServerRange ? (
            <button type="button" className="chart-reset-button" onClick={() => setZoomRange(null)}>{resetZoomLabel}</button>
          ) : null}
        </div>
      </div>

      <div
        ref={chartSurfaceRef}
        className="chart-surface"
        onMouseEnter={clearHideTimeout}
        onMouseLeave={scheduleChartSurfaceDismissal}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}
          className="chart-svg"
          role="img"
          aria-label="Time series chart"
          onClick={(event) => {
            const target = event.target as Element

            if (target.closest('.chart-hit-area')) {
              return
            }

            clearPinnedSelection()
          }}
          onMouseDown={handleChartMouseDown}
          onMouseMove={handleChartMouseMove}
          onMouseUp={commitZoomSelection}
          onMouseLeave={() => {
            commitZoomSelection()
            clearHideTimeout()
            hideTooltipTimeoutRef.current = setTimeout(() => setActiveDate(null), TOOLTIP_HIDE_DELAY_MS)
          }}
        >
        <line x1={chartLayout.paddingLeft} y1={chartLayout.height - chartLayout.paddingBottom} x2={chartLayout.width - chartLayout.paddingRight} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-axis" />
        <line x1={chartLayout.paddingLeft} y1={chartLayout.paddingTop} x2={chartLayout.paddingLeft} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-axis" />

        {tooltipAnchorPoint ? (
          <g className="chart-crosshair">
            <line x1={tooltipAnchorPoint.x} y1={chartLayout.paddingTop} x2={tooltipAnchorPoint.x} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-crosshair-line is-vertical" />
          </g>
        ) : null}

        {chartScene.yTicks.map((tick) => {
          const y = chartScene.pointY(typeof tick.value === 'number' ? tick.value : Number(tick.value))

          return (
            <g key={`y-${tick.offset}`}>
              <line x1={chartLayout.paddingLeft} y1={y} x2={chartLayout.width - chartLayout.paddingRight} y2={y} className="chart-grid" />
              <text x={chartLayout.paddingLeft - 14} y={y + 4} textAnchor="end" className="chart-tick-label">{tick.label}</text>
            </g>
          )
        })}

        {chartScene.xTicks.map((tick) => {
          const x = chartLayout.paddingLeft + tick.offset * (chartLayout.width - chartLayout.paddingLeft - chartLayout.paddingRight)
          const isFirstTick = tick.offset <= 0.001
          const isLastTick = tick.offset >= 0.999
          const textAnchor = isFirstTick ? 'start' : isLastTick ? 'end' : 'middle'
          const labelX = isFirstTick ? x + EDGE_TICK_LABEL_OFFSET : isLastTick ? x - EDGE_TICK_LABEL_OFFSET : x

          return (
            <g key={`x-${tick.offset}`}>
              <line x1={x} y1={chartLayout.height - chartLayout.paddingBottom} x2={x} y2={chartLayout.height - chartLayout.paddingBottom + 6} className="chart-axis" />
              <text x={labelX} y={chartLayout.height - chartLayout.paddingBottom + 18} textAnchor={textAnchor} className="chart-tick-label">{tick.label}</text>
            </g>
          )
        })}

        {payload.forecastOrigin ? (() => {
          const originX = chartScene.pointX(payload.forecastOrigin.date)

          return (
            <g className="chart-origin-marker" aria-hidden="true">
              <line
                x1={originX}
                y1={chartLayout.paddingTop}
                x2={originX}
                y2={chartLayout.height - chartLayout.paddingBottom}
                className="chart-crosshair-line is-vertical is-origin"
              />
              <text x={originX + 10} y={chartLayout.paddingTop + 12} className="chart-origin-label">{payload.forecastOrigin.label}</text>
            </g>
          )
        })() : null}

        {chartScene.historicalForecastDeltaPath ? (
          <path d={chartScene.historicalForecastDeltaPath} className="chart-delta-area historical-forecast" />
        ) : null}

        {chartScene.deltaOverlayPaths.map((overlay) => (
          <g key={overlay.key}>
            <path d={overlay.path} className={`chart-delta-area historical-forecast is-${overlay.sign}`} />
            {chartScene.usesEndOfPeriodOverlayGeometry && overlay.actualBoundary ? (
              <polyline points={overlay.actualBoundary} className={`chart-delta-boundary historical-forecast is-${overlay.sign} is-actual`} />
            ) : null}
          </g>
        ))}

        {chartScene.lineLayers.map(({ entry, index, polylines }) => {
          return (
            <g key={entry.id} className="chart-series-layer" style={{ animationDelay: `${index * 60}ms` }}>
              {polylines.map((polyline, polylineIndex) => (
                <polyline key={`${entry.id}-${polylineIndex}`} points={polyline} className={`chart-line ${legendClass(entry.kind)}`} />
              ))}
              {entry.points.filter((point) => point.value !== null).map((point) => {
                const isSelected = isSelectedSeriesPoint(point, entry.kind)
                const showMarker = point.anchor || activeDate === point.date || selectedDate === point.date || isSelected

                return (
                  <g key={point.key}>
                    <circle
                      cx={chartScene.pointX(point.date)}
                      cy={chartScene.pointY(point.value)}
                      r={13}
                      className="chart-hit-area"
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseEnter={() => handleSharedDateChange(point.date)}
                      onMouseLeave={handleSharedDateLeave}
                      onFocus={() => handleSharedDateChange(point.date)}
                      onBlur={handleSharedDateLeave}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (entry.kind === 'historical') {
                          setSelectedSurfaceKey(null)
                          setSelectedDate(point.date)
                          setSelectedSurface(null)
                          setSelectedSurfaceVariant(null)
                        } else {
                          const surface = toSeriesPointSurface(point, entry.kind, entry.label)
                          setSelectedSurfaceKey(surface.key)
                          setSelectedSurface(surface)
                          setSelectedSurfaceVariant(entry.kind)
                          setSelectedDate(null)
                        }
                        setActiveDate(null)
                        setActiveTooltip(null)
                        setArmedAccuracyKey(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          if (entry.kind === 'historical') {
                            setSelectedSurfaceKey(null)
                            setSelectedDate(point.date)
                            setSelectedSurface(null)
                            setSelectedSurfaceVariant(null)
                          } else {
                            const surface = toSeriesPointSurface(point, entry.kind, entry.label)
                            setSelectedSurfaceKey(surface.key)
                            setSelectedSurface(surface)
                            setSelectedSurfaceVariant(entry.kind)
                            setSelectedDate(null)
                          }
                          setActiveDate(null)
                          setActiveTooltip(null)
                          setArmedAccuracyKey(null)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${entry.label} ${formatSemanticDate(locale, point.date, point.detailModel)} ${formatPrimaryValue(locale, point.value, point.detailModel.unit, point.detailModel.currency)}`}
                    />
                    {isSelected ? (
                      <circle
                        cx={chartScene.pointX(point.date)}
                        cy={chartScene.pointY(point.value)}
                        r={10}
                        className={`chart-selection-ring ${legendClass(entry.kind)}`}
                      />
                    ) : null}
                    {showMarker ? (
                      <circle
                        cx={chartScene.pointX(point.date)}
                        cy={chartScene.pointY(point.value)}
                        r={point.anchor ? 4.5 : 3}
                        className={`chart-point ${legendClass(entry.kind)}${point.anchor ? ' is-anchor' : ''}${isSelected ? ' is-selected' : ''}`}
                      />
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
        {dragSelection ? (
          <rect
            x={Math.min(dragSelection.startX, dragSelection.currentX)}
            y={chartLayout.paddingTop}
            width={Math.abs(dragSelection.currentX - dragSelection.startX)}
            height={chartLayout.height - chartLayout.paddingTop - chartLayout.paddingBottom}
            className="chart-brush"
          />
        ) : null}
        </svg>

        {!chartLayout.isTouch && !useCompactTooltipRail && displaySurfaceTooltip && tooltipCard ? (
          <div
            ref={tooltipRef}
            className={`chart-tooltip${tooltipPosition ? ` is-${tooltipPosition.placement}` : ''}${tooltipVariant ? ` ${tooltipVariantClass(tooltipVariant)}` : ''}`}
            onMouseEnter={clearHideTimeout}
            onMouseLeave={() => handleTooltipSurfaceLeave(displaySurfaceTooltip.key)}
            style={{
              left: tooltipPosition ? `${tooltipPosition.left}px` : '-999px',
              top: tooltipPosition ? `${tooltipPosition.top}px` : '-999px',
            }}
          >
            <div className="chart-tooltip-series">{tooltipCard.series}</div>
            <div className="chart-tooltip-component">{tooltipCard.component}</div>
            <strong>{tooltipCard.date}</strong>
            <div className="chart-tooltip-divider" />
            {tooltipCard.primaryLabel ? <div className="chart-tooltip-primary-label">{tooltipCard.primaryLabel}</div> : null}
            <div className="chart-tooltip-primary-value">{tooltipCard.primaryValue}</div>
            {tooltipCard.forecastInterval ? (
              <>
                <div className="chart-tooltip-divider" />
                <div className="chart-tooltip-interval-label">{tooltipCard.forecastInterval.label}</div>
                <div className="chart-tooltip-interval-values">
                  <div className="chart-tooltip-interval-bound is-lower">
                    <span>{locale === 'pl' ? 'Dolny' : 'Lower'}</span>
                    <i className="chart-tooltip-interval-arrow" aria-hidden="true">↓</i>
                    <strong>{tooltipCard.forecastInterval.lowerValue}</strong>
                  </div>
                  <div className="chart-tooltip-interval-bound is-upper">
                    <span>{locale === 'pl' ? 'Górny' : 'Upper'}</span>
                    <i className="chart-tooltip-interval-arrow" aria-hidden="true">↑</i>
                    <strong>{tooltipCard.forecastInterval.upperValue}</strong>
                  </div>
                </div>
              </>
            ) : null}
            {tooltipCard.detailRows.length > 0 ? (
              <>
                <div className="chart-tooltip-divider" />
                <dl>
                  {tooltipCard.detailRows.map((row) => (
                    <div key={`${displaySurfaceTooltip.key}-detail-${row.label}`} className="tooltip-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {tooltipCard.businessDescriptionLines.length > 0 ? (
              <>
                <div className="chart-tooltip-divider" />
                <div className="chart-tooltip-business-lines">
                  {tooltipCard.businessDescriptionLines.map((line) => (
                    <span key={`${displaySurfaceTooltip.key}-${line}`}>{line}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {!chartLayout.isTouch && !useCompactTooltipRail && !displaySurfaceTooltip && hasSharedTooltipRows(sharedTooltipCard) ? (
          <div
            ref={tooltipRef}
            className={`chart-tooltip is-shared${tooltipPosition ? ` is-${tooltipPosition.placement}` : ''}`}
            onMouseEnter={clearHideTimeout}
            onMouseLeave={handleSharedDateLeave}
            style={{
              left: tooltipPosition ? `${tooltipPosition.left}px` : '-999px',
              top: tooltipPosition ? `${tooltipPosition.top}px` : '-999px',
            }}
          >
            <div className="chart-tooltip-series">{locale === 'pl' ? 'Wartości biznesowe' : 'Business values'}</div>
            <div className="chart-tooltip-component">{sharedTooltipCard?.component}</div>
            <strong>{sharedTooltipCard?.date}</strong>
            <div className="chart-tooltip-divider" />
            <dl className="chart-tooltip-shared-list">
              {sharedTooltipCard?.rows.filter((row) => !row.isMissing).map((row) => (
                <div key={row.key} className="tooltip-row tooltip-row-shared">
                  <dt>
                    <span className={`chart-tooltip-series-dot ${legendClass(row.kind)} ${row.lineStyle === 'dashed' ? 'is-dashed' : ''}`} aria-hidden="true" />
                    {row.label}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      {(!embedded && (chartLayout.isTouch || useCompactTooltipRail)) ? (
        <div className={`chart-tooltip-mobile-wrap${(displaySurfaceTooltip && tooltipCard) || hasSharedTooltipRows(sharedTooltipCard) ? ' is-active' : ' is-reserved'}`}>
          {displaySurfaceTooltip && tooltipCard ? (
          <div ref={tooltipRef} className={`chart-tooltip${tooltipVariant ? ` ${tooltipVariantClass(tooltipVariant)}` : ''}`}>
            <div className="chart-tooltip-series">{tooltipCard.series}</div>
            <div className="chart-tooltip-component">{tooltipCard.component}</div>
            <strong>{tooltipCard.date}</strong>
            <div className="chart-tooltip-divider" />
            {tooltipCard.primaryLabel ? <div className="chart-tooltip-primary-label">{tooltipCard.primaryLabel}</div> : null}
            <div className="chart-tooltip-primary-value">{tooltipCard.primaryValue}</div>
            {tooltipCard.forecastInterval ? (
              <>
                <div className="chart-tooltip-divider" />
                <div className="chart-tooltip-interval-label">{tooltipCard.forecastInterval.label}</div>
                <div className="chart-tooltip-interval-values">
                  <div className="chart-tooltip-interval-bound is-lower">
                    <span>{locale === 'pl' ? 'Dolny' : 'Lower'}</span>
                    <i className="chart-tooltip-interval-arrow" aria-hidden="true">↓</i>
                    <strong>{tooltipCard.forecastInterval.lowerValue}</strong>
                  </div>
                  <div className="chart-tooltip-interval-bound is-upper">
                    <span>{locale === 'pl' ? 'Górny' : 'Upper'}</span>
                    <i className="chart-tooltip-interval-arrow" aria-hidden="true">↑</i>
                    <strong>{tooltipCard.forecastInterval.upperValue}</strong>
                  </div>
                </div>
              </>
            ) : null}
            {tooltipCard.detailRows.length > 0 ? (
              <>
                <div className="chart-tooltip-divider" />
                <dl>
                  {tooltipCard.detailRows.map((row) => (
                    <div key={`${displaySurfaceTooltip.key}-mobile-detail-${row.label}`} className="tooltip-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {tooltipCard.businessDescriptionLines.length > 0 ? (
              <>
                <div className="chart-tooltip-divider" />
                <div className="chart-tooltip-business-lines">
                  {tooltipCard.businessDescriptionLines.map((line) => (
                    <span key={`${displaySurfaceTooltip.key}-mobile-${line}`}>{line}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          ) : hasSharedTooltipRows(sharedTooltipCard) ? (
            <div ref={tooltipRef} className="chart-tooltip is-shared">
              <div className="chart-tooltip-series">{locale === 'pl' ? 'Wartości biznesowe' : 'Business values'}</div>
              <div className="chart-tooltip-component">{sharedTooltipCard?.component}</div>
              <strong>{sharedTooltipCard?.date}</strong>
              <div className="chart-tooltip-divider" />
              <dl className="chart-tooltip-shared-list">
                {sharedTooltipCard?.rows.filter((row) => !row.isMissing).map((row) => (
                  <div key={`${row.key}-mobile`} className="tooltip-row tooltip-row-shared">
                    <dt>
                      <span className={`chart-tooltip-series-dot ${legendClass(row.kind)} ${row.lineStyle === 'dashed' ? 'is-dashed' : ''}`} aria-hidden="true" />
                      {row.label}
                    </dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      ) : null}

      {embedded ? null : (
        <div className="chart-footer">
          <div className="chart-legend chart-legend-footer">
            {payload.series.map((entry) => {
              const hidden = hiddenItems.includes(entry.kind)

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`chart-legend-button${hidden ? ' is-muted' : ''}`}
                  aria-pressed={!hidden}
                  onClick={() => toggleVisibility(entry.kind)}
                >
                  <i className={`legend-swatch legend-${legendClass(entry.kind)}${hasMarkerOnlyLegend(entry) ? ' is-marker-only' : ''}`} />
                  {entry.label}
                </button>
              )
            })}
            {showForecastAccuracy && (chartScene.deltaOverlayPaths.length > 0 || chartScene.historicalForecastDeltaPath) ? (
              <span className="chart-legend-static-item">
                <i className="legend-swatch legend-forecast-accuracy-ribbon" />
                <span>{verificationRibbonLabel}</span>
                <InfoButton label={verificationRibbonInfoLabel} lines={verificationRibbonInfoLines} />
              </span>
            ) : null}
          </div>

          <div className="source-legend">
            <div className="source-primary">
              <p className="muted source-description">{sourceLine}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

type RawDataViewProps = {
  embedded?: boolean
  initialBenchmarkSeries?: SeriesResponse | null
  variant?: DashboardVariantId
  forcedBenchmarkSubject?: BenchmarkSubject | null
}

export function resolveDefaultForecastTargetBasis(variant: DashboardVariantId): ForecastTargetBasis {
  if (variant === 'forecast-portfolio-v3') {
    return 'POINT_IN_TIME'
  }

  return DEFAULT_FORECAST_TARGET_BASIS
}

export function resolveInitialForecastVisibility(variant: DashboardVariantId, embedded: boolean): boolean {
  return variant === 'forecast-portfolio-v3' && !embedded
}

export function resolveInitialForecastVerificationVisibility(variant: DashboardVariantId, embedded: boolean): boolean {
  return resolveInitialForecastVisibility(variant, embedded)
}

export function shouldHideEmbeddedBenchmarkShell(
  embedded: boolean,
  isBenchmarkMode: boolean,
  isForecastPortfolioVariant: boolean,
): boolean {
  return embedded && isBenchmarkMode && !isForecastPortfolioVariant
}
export function RawDataView({
  embedded = false,
  initialBenchmarkSeries = null,
  variant = 'finder-embedded-v2',
  forcedBenchmarkSubject = null,
}: RawDataViewProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('RawDataView')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isHistoricalVariant = variant === 'historical-v1'
  const benchmarkSubject = isHistoricalVariant ? null : (forcedBenchmarkSubject ?? readBenchmarkSubject(searchParams))
  const isBenchmarkMode = benchmarkSubject !== null
  const isForecastPortfolioVariant = variant === 'forecast-portfolio-v3'
  const benchmarkSeriesId = benchmarkSubject?.seriesId ?? null
  const benchmarkDisplayName = benchmarkSubject?.displayName ?? null
  const initialRange = readInitialRange(searchParams)
  const backgroundCurrentForecastWarmupEnabled = shouldWarmCurrentForecastInBackground(searchParams, { embedded, variant })
  const defaultForecastTargetBasis = resolveDefaultForecastTargetBasis(variant)
  const initialForecastVisibility = resolveInitialForecastVisibility(variant, embedded)
  const initialForecastVerificationVisibility = resolveInitialForecastVerificationVisibility(variant, embedded)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [componentsState, setComponentsState] = useState<LoadState>('idle')
  const [seriesState, setSeriesState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [components, setComponents] = useState<ComponentListItem[]>([])
  const [selectedComponentName, setSelectedComponentName] = useState('')
  const [selectedComponentCode, setSelectedComponentCode] = useState('')
  const [componentSearch, setComponentSearch] = useState('')
  const [benchmarkSearch, setBenchmarkSearch] = useState('')
  const [showForecast, setShowForecast] = useState(initialForecastVisibility)
  const [showForecastAccuracy, setShowForecastAccuracy] = useState(false)
  const [showForecastVerification, setShowForecastVerification] = useState(initialForecastVerificationVisibility)
  const [forecastModel, setForecastModel] = useState<ForecastPortfolioModelId>('arima')
  const [selectedForecastTargetBasis, setSelectedForecastTargetBasis] = useState<ForecastTargetBasis>(defaultForecastTargetBasis)
  const [forecastAccuracyHorizon, setForecastAccuracyHorizon] = useState<ForecastAccuracyHorizonMonths>(1)
  const [forecastAccuracyState, setForecastAccuracyState] = useState<LoadState>('idle')
  const [forecastAccuracyResponse, setForecastAccuracyResponse] = useState<ForecastAccuracyResponse | null>(null)
  const [forecastAccuracyPayload, setForecastAccuracyPayload] = useState<TimeSeriesViewerPayload | null>(null)
  const [forecastCurrentState, setForecastCurrentState] = useState<ForecastCurrentUiState>(initialForecastVisibility ? 'READING' : 'IDLE')
  const [forecastCurrentResult, setForecastCurrentResult] = useState<BenchmarkForecastCurrentResult | null>(null)
  const [progressivePreparationSnapshot, setProgressivePreparationSnapshot] = useState<ProgressiveForecastPreparationSnapshot | null>(null)
  const [forecastCurrentReloadNonce, setForecastCurrentReloadNonce] = useState(0)
  const [forecastVerificationReloadNonce, setForecastVerificationReloadNonce] = useState(0)
  const [forecastVerificationState, setForecastVerificationState] = useState<LoadState>(initialForecastVerificationVisibility ? 'loading' : 'idle')
  const [forecastVerificationResult, setForecastVerificationResult] = useState<BenchmarkForecastVerificationResult | null>(null)
  const [forecastErrorState, setForecastErrorState] = useState<UiLoadErrorState | null>(null)
  const [forecastVerificationErrorState, setForecastVerificationErrorState] = useState<UiLoadErrorState | null>(null)
  const [series, setSeries] = useState<SeriesResponse | null>(null)
  const [viewerPayload, setViewerPayload] = useState<TimeSeriesViewerPayload | null>(null)
  const [benchmarkRange, setBenchmarkRange] = useState<RangePreset>(initialRange)
  const seriesAbortRef = useRef<AbortController | null>(null)
  const forecastAccuracyAbortRef = useRef<AbortController | null>(null)
  const forecastCurrentAbortRef = useRef<AbortController | null>(null)
  const forecastVerificationAbortRef = useRef<AbortController | null>(null)
  const forecastPreparationRequestRef = useRef(0)
  const seriesCacheRef = useRef<Map<string, CachedSeriesEntry>>(new Map())
  const forecastLayerCacheRef = useRef<Map<string, ForecastLayerCacheEntry<BenchmarkForecastCurrentResult | BenchmarkForecastVerificationResult>>>(new Map())
  const backgroundWarmupAttemptedRef = useRef<Set<string>>(new Set())
  const backgroundWarmupInflightRef = useRef<Map<string, Promise<BackgroundWarmupOutcome>>>(new Map())
  const forecastSelectionTouchedRef = useRef(false)
  const selectedProgressiveCurrentStateRef = useRef<ProgressiveForecastPreparationState | null>(null)
  const selectedProgressiveVerificationStateRef = useRef<ProgressiveForecastPreparationState | null>(null)

  useEffect(() => {
    if (!isForecastPortfolioVariant) {
      return
    }

    setShowForecast(initialForecastVisibility)
    setShowForecastVerification(initialForecastVerificationVisibility)
    setForecastModel('arima')
    setSelectedForecastTargetBasis(defaultForecastTargetBasis)
    setForecastAccuracyHorizon(1)
    setForecastCurrentState(initialForecastVisibility ? 'READING' : 'IDLE')
    setProgressivePreparationSnapshot(null)
    setForecastCurrentReloadNonce(0)
    setForecastVerificationReloadNonce(0)
    setForecastVerificationState(initialForecastVerificationVisibility ? 'loading' : 'idle')
    forecastSelectionTouchedRef.current = false
    selectedProgressiveCurrentStateRef.current = null
    selectedProgressiveVerificationStateRef.current = null
  }, [defaultForecastTargetBasis, initialForecastVerificationVisibility, initialForecastVisibility, isForecastPortfolioVariant])

  const selectedProgressiveVariant = resolveSelectedProgressiveVariant(progressivePreparationSnapshot, {
    seriesId: benchmarkSeriesId ?? '',
    modelId: forecastModel,
    targetBasis: selectedForecastTargetBasis,
  })
  const forecastCurrentDisplayState = resolveForecastCurrentDisplayState(forecastCurrentState, selectedProgressiveVariant)

  useEffect(() => {
    if (!showForecast) {
      setShowForecastVerification(false)
      setForecastVerificationState('idle')
      setForecastVerificationResult(null)
      setForecastVerificationErrorState(null)
    }
  }, [showForecast])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlBackground = html.style.background
    const previousHtmlBackgroundImage = html.style.backgroundImage
    const previousBodyBackground = body.style.background
    const previousBodyBackgroundImage = body.style.backgroundImage

    if (embedded) {
      html.classList.add('preview-embedded')
      body.classList.add('preview-embedded')
      html.style.background = 'transparent'
      html.style.backgroundImage = 'none'
      body.style.background = 'transparent'
      body.style.backgroundImage = 'none'
    }

    return () => {
      html.classList.remove('preview-embedded')
      body.classList.remove('preview-embedded')
      html.style.background = previousHtmlBackground
      html.style.backgroundImage = previousHtmlBackgroundImage
      body.style.background = previousBodyBackground
      body.style.backgroundImage = previousBodyBackgroundImage
    }
  }, [embedded])

  useEffect(() => {
    if (!embedded || typeof window === 'undefined' || window.parent === window) {
      return
    }

    let frameId = 0

    const reportHeight = () => {
      const measuredHeights = [
        document.body.getBoundingClientRect().height,
        document.querySelector('.app-shell.is-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('.shell-grid.is-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('.chart-panel-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('main')?.getBoundingClientRect().height ?? 0,
      ]
      const nextHeight = Math.ceil(Math.max(...measuredHeights.filter((value) => Number.isFinite(value) && value > 0))) + 8

      if (nextHeight > 0 && benchmarkSeriesId) {
        window.parent.postMessage({ type: 'sg-dashboard-preview:resize', seriesId: benchmarkSeriesId, height: nextHeight }, '*')
      }
    }

    const scheduleReport = () => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(reportHeight)
    }

    scheduleReport()

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          scheduleReport()
        })

    if (resizeObserver) {
      resizeObserver.observe(document.body)
      const appShell = document.querySelector('.app-shell.is-embedded')
      if (appShell) {
        resizeObserver.observe(appShell)
      }
    }

    window.addEventListener('resize', scheduleReport)

    return () => {
      window.removeEventListener('resize', scheduleReport)
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [benchmarkSeriesId, embedded])

  useEffect(() => {
    if (!embedded || !benchmarkSeriesId || typeof window === 'undefined' || window.parent === window) {
      return
    }

    const reportHeight = () => {
      const measuredHeights = [
        document.body.getBoundingClientRect().height,
        document.querySelector('.app-shell.is-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('.shell-grid.is-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('.chart-panel-embedded')?.getBoundingClientRect().height ?? 0,
        document.querySelector('main')?.getBoundingClientRect().height ?? 0,
      ]
      const nextHeight = Math.ceil(Math.max(...measuredHeights.filter((value) => Number.isFinite(value) && value > 0))) + 8

      if (nextHeight > 0) {
        window.parent.postMessage({ type: 'sg-dashboard-preview:resize', seriesId: benchmarkSeriesId, height: nextHeight }, '*')
      }
    }

    const timeoutId = window.setTimeout(reportHeight, 0)
    const intervalId = window.setInterval(reportHeight, 250)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [benchmarkRange, benchmarkSeriesId, embedded, errorMessage, forecastAccuracyPayload, seriesState, viewerPayload])

  const selectedComponent = components.find((item) => item.componentName === selectedComponentName) ?? null
  const benchmarkRequired = (selectedComponent?.benchmarkCount ?? 0) > 1 && selectedComponentCode.length === 0
  const effectiveComponentCode = selectedComponent?.benchmarkCount === 1
    ? (selectedComponent.availableBenchmarks[0]?.componentCode ?? '')
    : selectedComponentCode
  const componentOptions: SearchableSelectOption[] = components.map((component) => ({
    value: component.componentName,
    label: component.componentName,
  }))
  const benchmarkOptions: SearchableSelectOption[] = (selectedComponent?.availableBenchmarks ?? []).map((benchmark) => ({
    value: benchmark.componentCode ?? '',
    label: benchmark.componentCode ?? t('benchmarkMissing'),
  }))

  useEffect(() => {
    setBenchmarkRange(initialRange)
  }, [initialRange, benchmarkSeriesId])

  function retryLoad() {
    setErrorMessage(null)
    setReloadNonce((current) => current + 1)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setTheme(window.localStorage.getItem('tsiv-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('tsiv-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light')
  }

  useEffect(() => {
    if (isBenchmarkMode) {
      setComponentsState('ready')
      return
    }

    let cancelled = false

    async function loadComponents() {
      setComponentsState('loading')

      try {
        const response = await fetch(`/api/components?locale=${locale}`, { cache: 'no-store' })
        const payload = await response.json() as ComponentListResponse | { error?: string }

        if (!response.ok) {
          throw new Error('error' in payload ? payload.error ?? t('errors.components') : t('errors.components'))
        }

        const componentPayload = payload as ComponentListResponse

        if (cancelled) {
          return
        }

        setComponents(componentPayload.items)
        setSelectedComponentName((current) => current || componentPayload.items[0]?.componentName || '')
        setComponentsState('ready')
      } catch (error) {
        if (cancelled) {
          return
        }

        setComponentsState('error')
        setErrorMessage(toUiLoadErrorMessage(error, t('errors.components'), t('errors.timeout')))
      }
    }

    void loadComponents()

    return () => {
      cancelled = true
    }
  }, [isBenchmarkMode, locale, t, reloadNonce])

  useEffect(() => {
    if (!isBenchmarkMode || !benchmarkSeriesId || !initialBenchmarkSeries) {
      return
    }

    const initialPayload = toTimeSeriesViewerPayload(initialBenchmarkSeries, locale)
    const cacheKey = buildBenchmarkSeriesCacheKey(locale, benchmarkSeriesId, initialRange)
    seriesCacheRef.current.set(cacheKey, {
      response: initialBenchmarkSeries,
      payload: initialPayload,
      cachedAt: Date.now(),
    })
    setErrorMessage(null)
    setSeries(initialBenchmarkSeries)
    setViewerPayload(initialPayload)
    setSeriesState('ready')
  }, [benchmarkSeriesId, initialBenchmarkSeries, initialRange, isBenchmarkMode, locale])

  useEffect(() => {
    if (isBenchmarkMode) {
      return
    }

    if (!selectedComponent) {
      return
    }

    if (selectedComponent.benchmarkCount === 1) {
      setSelectedComponentCode(selectedComponent.availableBenchmarks[0]?.componentCode ?? '')
      return
    }

    setSelectedComponentCode('')
    setBenchmarkSearch('')
    setSeries(null)
    setViewerPayload(null)
    setForecastAccuracyResponse(null)
    setForecastAccuracyPayload(null)
  }, [isBenchmarkMode, selectedComponentName])

  useEffect(() => {
    if (isBenchmarkMode) {
      if (!benchmarkSeriesId) {
        return
      }

      const activeBenchmarkSeriesId = benchmarkSeriesId
      const activeBenchmarkDisplayName = benchmarkDisplayName

      let cancelled = false
      seriesAbortRef.current?.abort()
      const controller = new AbortController()
      seriesAbortRef.current = controller
      const interactionStartedAt = performance.now()
      let timedOut = false

      async function waitForNextPaint() {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
      }

      async function loadBenchmarkSeries() {
        const cacheKey = buildBenchmarkSeriesCacheKey(locale, activeBenchmarkSeriesId, benchmarkRange)
        const cached = seriesCacheRef.current.get(cacheKey)

        if (cached && Date.now() - cached.cachedAt <= CLIENT_SERIES_CACHE_TTL_MS) {
          setErrorMessage(null)
          setSeries(cached.response)
          setViewerPayload(cached.payload)
          setSeriesState('ready')
          const committedAt = performance.now()
          await waitForNextPaint()

          if (!cancelled) {
            const renderedAt = performance.now()
            recordRawDataViewProfile({
              componentName: activeBenchmarkDisplayName ?? activeBenchmarkSeriesId,
              componentCode: activeBenchmarkSeriesId,
              showForecast: false,
              source: 'client-cache',
              requestDispatchMs: 0,
              networkMs: 0,
              responseParseMs: 0,
              adapterMs: 0,
              commitMs: committedAt - interactionStartedAt,
              firstPaintMs: renderedAt - committedAt,
              totalInteractionMs: renderedAt - interactionStartedAt,
              serverTotalMs: cached.response.profiling?.totalServerMs ?? null,
            })
          }

          return
        }

        setSeriesState('loading')
        setErrorMessage(null)
        setSeries(null)
        setViewerPayload(null)

        const timeoutHandle = window.setTimeout(() => {
          timedOut = true
          controller.abort()
        }, 8000)

        try {
          const params = new URLSearchParams({
            locale,
            seriesId: activeBenchmarkSeriesId,
            range: benchmarkRange,
          })
          if (activeBenchmarkDisplayName) {
            params.set('displayName', activeBenchmarkDisplayName)
          }

          const requestStartedAt = performance.now()
          const seriesResponse = await fetch(`/api/series?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
          const responseReceivedAt = performance.now()
          const seriesPayload = await seriesResponse.json() as SeriesResponse | { error?: string }
          const responseParsedAt = performance.now()

          if (!seriesResponse.ok) {
            throw new Error('error' in seriesPayload ? seriesPayload.error ?? t('errors.series') : t('errors.series'))
          }

          const nextSeries = seriesPayload as SeriesResponse
          const adapterStartedAt = performance.now()
          const nextViewerPayload = toTimeSeriesViewerPayload(nextSeries, locale)
          const adapterFinishedAt = performance.now()

          if (cancelled) {
            return
          }

          seriesCacheRef.current.set(cacheKey, {
            response: nextSeries,
            payload: nextViewerPayload,
            cachedAt: Date.now(),
          })
          setSeries(nextSeries)
          setViewerPayload(nextViewerPayload)
          setSeriesState('ready')
          const committedAt = performance.now()
          await waitForNextPaint()

          if (!cancelled) {
            const renderedAt = performance.now()
            recordRawDataViewProfile({
              componentName: activeBenchmarkDisplayName ?? activeBenchmarkSeriesId,
              componentCode: activeBenchmarkSeriesId,
              showForecast: false,
              source: 'network',
              requestDispatchMs: requestStartedAt - interactionStartedAt,
              networkMs: responseReceivedAt - requestStartedAt,
              responseParseMs: responseParsedAt - responseReceivedAt,
              adapterMs: adapterFinishedAt - adapterStartedAt,
              commitMs: committedAt - adapterFinishedAt,
              firstPaintMs: renderedAt - committedAt,
              totalInteractionMs: renderedAt - interactionStartedAt,
              serverTotalMs: nextSeries.profiling?.totalServerMs ?? null,
            })
          }
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            if (timedOut && !cancelled) {
              setSeriesState('error')
              setErrorMessage(t('errors.timeout'))
            }

            return
          }

          if (cancelled) {
            return
          }

          setSeriesState('error')
          setErrorMessage(toUiLoadErrorMessage(error, t('errors.series'), t('errors.timeout')))
        } finally {
          window.clearTimeout(timeoutHandle)
        }
      }

      void loadBenchmarkSeries()

      return () => {
        cancelled = true
        controller.abort()
      }
    }

    if (!selectedComponentName) {
      return
    }

    if (benchmarkRequired) {
      setSeries({
        selection: null,
        benchmarkSelectionRequired: true,
        availableBenchmarks: selectedComponent?.availableBenchmarks ?? [],
        sourceInfo: null,
        detailSummary: null,
        forecastAnchor: null,
        historicalWindow: { from: null, to: null },
        historical: [],
        forecast: null,
      })
      setViewerPayload(null)
      return
    }

    let cancelled = false
    seriesAbortRef.current?.abort()
    const params = new URLSearchParams({
      locale,
      componentName: selectedComponentName,
      historyMonths: '24',
      showForecast: showForecast ? 'true' : 'false',
    })

    if (effectiveComponentCode) {
      params.set('componentCode', effectiveComponentCode)
    }

    const cacheKey = buildClientSeriesCacheKey(locale, selectedComponentName, effectiveComponentCode, showForecast)
    const controller = new AbortController()
    seriesAbortRef.current = controller
    const interactionStartedAt = performance.now()
    let timedOut = false

    async function waitForNextPaint() {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }

    async function loadData() {
      const cached = seriesCacheRef.current.get(cacheKey)

      if (cached && Date.now() - cached.cachedAt <= CLIENT_SERIES_CACHE_TTL_MS) {
        setErrorMessage(null)
        setSeries(cached.response)
        setViewerPayload(cached.payload)
        setSeriesState('ready')
        const committedAt = performance.now()
        await waitForNextPaint()

        if (!cancelled) {
          const renderedAt = performance.now()
          recordRawDataViewProfile({
            componentName: selectedComponentName,
            componentCode: effectiveComponentCode || null,
            showForecast,
            source: 'client-cache',
            requestDispatchMs: 0,
            networkMs: 0,
            responseParseMs: 0,
            adapterMs: 0,
            commitMs: committedAt - interactionStartedAt,
            firstPaintMs: renderedAt - committedAt,
            totalInteractionMs: renderedAt - interactionStartedAt,
            serverTotalMs: cached.response.profiling?.totalServerMs ?? null,
          })
        }

        return
      }

      setSeriesState('loading')
      setErrorMessage(null)
      setSeries(null)
      setViewerPayload(null)

      const timeoutHandle = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, 8000)

      try {
        const requestStartedAt = performance.now()
        const seriesResponse = await fetch(`/api/series?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const responseReceivedAt = performance.now()
        const seriesPayload = await seriesResponse.json() as SeriesResponse | { error?: string }
        const responseParsedAt = performance.now()

        if (!seriesResponse.ok) {
          throw new Error('error' in seriesPayload ? seriesPayload.error ?? t('errors.series') : t('errors.series'))
        }

        const nextSeries = seriesPayload as SeriesResponse
        const adapterStartedAt = performance.now()
        const nextViewerPayload = toTimeSeriesViewerPayload(nextSeries, locale)
        const adapterFinishedAt = performance.now()

        if (cancelled) {
          return
        }

        seriesCacheRef.current.set(cacheKey, {
          response: nextSeries,
          payload: nextViewerPayload,
          cachedAt: Date.now(),
        })
        setSeries(nextSeries)
        setViewerPayload(nextViewerPayload)
        setSeriesState('ready')
        const committedAt = performance.now()
        await waitForNextPaint()

        if (!cancelled) {
          const renderedAt = performance.now()
          recordRawDataViewProfile({
            componentName: selectedComponentName,
            componentCode: effectiveComponentCode || null,
            showForecast,
            source: 'network',
            requestDispatchMs: requestStartedAt - interactionStartedAt,
            networkMs: responseReceivedAt - requestStartedAt,
            responseParseMs: responseParsedAt - responseReceivedAt,
            adapterMs: adapterFinishedAt - adapterStartedAt,
            commitMs: committedAt - adapterFinishedAt,
            firstPaintMs: renderedAt - committedAt,
            totalInteractionMs: renderedAt - interactionStartedAt,
            serverTotalMs: nextSeries.profiling?.totalServerMs ?? null,
          })
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          if (timedOut && !cancelled) {
            setSeriesState('error')
            setErrorMessage(t('errors.timeout'))
          }

          recordRawDataViewProfile({
            componentName: selectedComponentName,
            componentCode: effectiveComponentCode || null,
            showForecast,
            source: 'aborted',
            requestDispatchMs: 0,
            networkMs: 0,
            responseParseMs: 0,
            adapterMs: 0,
            commitMs: 0,
            firstPaintMs: 0,
            totalInteractionMs: performance.now() - interactionStartedAt,
            serverTotalMs: null,
          })
          return
        }

        if (cancelled) {
          return
        }

        setSeriesState('error')
        setErrorMessage(toUiLoadErrorMessage(error, t('errors.series'), t('errors.timeout')))
      } finally {
        window.clearTimeout(timeoutHandle)
      }
    }

    void loadData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [benchmarkDisplayName, benchmarkRange, benchmarkRequired, benchmarkSeriesId, effectiveComponentCode, isBenchmarkMode, locale, selectedComponent?.availableBenchmarks, selectedComponentName, showForecast, t, reloadNonce])

  useEffect(() => {
    if (!isForecastPortfolioVariant || !benchmarkSeriesId) {
      return
    }

    const activeSeriesId = benchmarkSeriesId
    forecastPreparationRequestRef.current += 1

    if (!shouldReadCurrentForecast({ showForecast, isForecastPortfolioVariant, seriesId: activeSeriesId })) {
      forecastCurrentAbortRef.current?.abort()
      setForecastCurrentState('IDLE')
      setForecastCurrentResult(null)
      setForecastErrorState(null)
      return
    }

    let cancelled = false
    forecastCurrentAbortRef.current?.abort()
    const controller = new AbortController()
    forecastCurrentAbortRef.current = controller

    async function loadForecastCurrent() {
      const cacheKey = buildForecastLayerCacheKey(locale, activeSeriesId, forecastModel, selectedForecastTargetBasis, 'current')
      const cached = forecastLayerCacheRef.current.get(cacheKey)

      if (cached) {
        const cachedResult = cached.payload as BenchmarkForecastCurrentResult
        const cachedState = resolveForecastCurrentUiState(cachedResult)
        setForecastCurrentResult(cachedResult)
        setForecastCurrentState(cachedState)
        setForecastErrorState(null)
        return
      }

      setForecastCurrentState('READING')
      setForecastErrorState(null)

      try {
        const payload = await readPreparedCurrentForecastThroughDashboard(fetch, {
          seriesId: activeSeriesId,
          modelId: forecastModel,
          targetBasis: selectedForecastTargetBasis,
        }, controller.signal)

        if (cancelled) {
          return
        }

        if (payload.seriesId !== activeSeriesId
          || payload.modelId !== forecastModel
          || payload.targetBasis !== selectedForecastTargetBasis) {
          return
        }

        forecastLayerCacheRef.current.set(cacheKey, {
          payload,
          cachedAt: Date.now(),
        })
        const nextState = resolveForecastCurrentUiState(payload)
        setForecastCurrentResult(payload)
        setForecastCurrentState(nextState)
        setForecastErrorState(null)
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') {
          return
        }

        setForecastCurrentState('FAILED')
        setForecastCurrentResult(null)
        setForecastErrorState(toUiLoadErrorState(
          error,
          t('forecastUnavailable'),
          t('forecastUnavailableHint'),
          t('errors.timeout'),
          t('forecastBlocked'),
          t('forecastBlockedHint'),
        ))
      }
    }

    void loadForecastCurrent()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [benchmarkSeriesId, forecastCurrentReloadNonce, forecastModel, isForecastPortfolioVariant, locale, selectedForecastTargetBasis, showForecast, t])

  useEffect(() => {
    if (!isForecastPortfolioVariant || !benchmarkSeriesId || !showForecast) {
      setProgressivePreparationSnapshot(null)
      return
    }

    const activeSeriesId = benchmarkSeriesId
    const controller = new AbortController()
    let cancelled = false

    async function pollProgressivePreparation() {
      while (!cancelled) {
        try {
          const snapshot = await readProgressiveForecastPreparationThroughDashboard(fetch, {
            seriesId: activeSeriesId,
            modelId: forecastModel,
            targetBasis: selectedForecastTargetBasis,
          }, controller.signal)

          if (cancelled) {
            return
          }

          setProgressivePreparationSnapshot(snapshot)

          const selectedVariant = resolveSelectedProgressiveVariant(snapshot, {
            seriesId: activeSeriesId,
            modelId: forecastModel,
            targetBasis: selectedForecastTargetBasis,
          })

          if (
            !forecastSelectionTouchedRef.current
            && snapshot.firstReadyCurrent
            && selectedVariant
            && selectedVariant.currentState !== 'READY'
            && forecastCurrentState !== 'AVAILABLE'
          ) {
            forecastSelectionTouchedRef.current = true
            setForecastModel(snapshot.firstReadyCurrent.modelId)
            setSelectedForecastTargetBasis(snapshot.firstReadyCurrent.targetBasis)
            return
          }

          if (selectedVariant?.currentState === 'READY' && selectedProgressiveCurrentStateRef.current !== 'READY' && forecastCurrentState !== 'AVAILABLE') {
            forecastLayerCacheRef.current.delete(buildForecastLayerCacheKey(locale, activeSeriesId, forecastModel, selectedForecastTargetBasis, 'current'))
            setForecastCurrentReloadNonce((value) => value + 1)
          }

          if (selectedVariant?.verificationState === 'READY' && selectedProgressiveVerificationStateRef.current !== 'READY') {
            forecastLayerCacheRef.current.delete(buildForecastLayerCacheKey(locale, activeSeriesId, forecastModel, selectedForecastTargetBasis, 'verification'))
            setForecastVerificationReloadNonce((value) => value + 1)
          }

          selectedProgressiveCurrentStateRef.current = selectedVariant?.currentState ?? null
          selectedProgressiveVerificationStateRef.current = selectedVariant?.verificationState ?? null

          if (!snapshot.activeItem && snapshot.queuedCount === 0) {
            return
          }

          await new Promise((resolve) => window.setTimeout(resolve, 1500))
        } catch (error) {
          if (cancelled || (error as Error).name === 'AbortError') {
            return
          }

          setProgressivePreparationSnapshot(null)
          return
        }
      }
    }

    void pollProgressivePreparation()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [benchmarkSeriesId, forecastCurrentState, forecastModel, isForecastPortfolioVariant, locale, selectedForecastTargetBasis, showForecast])

  useEffect(() => {
    if (!backgroundCurrentForecastWarmupEnabled || !benchmarkSeriesId) {
      return
    }

    const cacheKey = buildForecastLayerCacheKey(locale, benchmarkSeriesId, forecastModel, selectedForecastTargetBasis, 'current')
    if (forecastLayerCacheRef.current.has(cacheKey) || backgroundWarmupAttemptedRef.current.has(cacheKey)) {
      return
    }

    backgroundWarmupAttemptedRef.current.add(cacheKey)
    const controller = new AbortController()
    let cancelled = false

    const warmupPromise = warmCurrentForecastThroughDashboard(fetch, {
      seriesId: benchmarkSeriesId,
      modelId: forecastModel,
      targetBasis: selectedForecastTargetBasis,
    }, controller.signal)
    backgroundWarmupInflightRef.current.set(cacheKey, warmupPromise)

    async function warmCurrentForecast() {
      try {
        const outcome = await warmupPromise

        if (cancelled || !outcome.currentResult || outcome.currentState !== 'AVAILABLE') {
          return
        }

        forecastLayerCacheRef.current.set(cacheKey, {
          payload: outcome.currentResult,
          cachedAt: Date.now(),
        })
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') {
          return
        }
      } finally {
        if (backgroundWarmupInflightRef.current.get(cacheKey) === warmupPromise) {
          backgroundWarmupInflightRef.current.delete(cacheKey)
        }
      }
    }

    void warmCurrentForecast()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [backgroundCurrentForecastWarmupEnabled, benchmarkSeriesId, forecastModel, locale, selectedForecastTargetBasis])

  async function handlePrepareForecastCurrent() {
    if (!benchmarkSeriesId) {
      return
    }

    const requestId = forecastPreparationRequestRef.current + 1
    forecastPreparationRequestRef.current = requestId
    const identity = {
      seriesId: benchmarkSeriesId,
      modelId: forecastModel,
      targetBasis: selectedForecastTargetBasis,
    } as const
    const cacheKey = buildForecastLayerCacheKey(locale, identity.seriesId, identity.modelId, identity.targetBasis, 'current')
    const inFlightWarmup = backgroundWarmupInflightRef.current.get(cacheKey)

    setForecastCurrentState('PREPARING')
    setForecastErrorState(null)

    try {
      if (inFlightWarmup) {
        const outcome = await inFlightWarmup

        if (requestId !== forecastPreparationRequestRef.current) {
          return
        }

        if (outcome.currentResult) {
          forecastLayerCacheRef.current.set(cacheKey, {
            payload: outcome.currentResult,
            cachedAt: Date.now(),
          })
        }

        setForecastCurrentResult(outcome.currentResult)
        setForecastCurrentState(outcome.currentState)

        if (outcome.currentState === 'FAILED') {
          setForecastErrorState({
            title: t('forecastPreparationFailed'),
            message: outcome.preparation?.reason ?? t('forecastUnavailableHint'),
          })
          return
        }

        if (outcome.currentState === 'UNSUPPORTED') {
          setForecastErrorState(null)
          return
        }

        setForecastErrorState(null)
        return
      }

      const outcome = await explicitlyPrepareForecastCurrent(identity, {
        prepareCurrent: (input) => requestExplicitCurrentForecastPreparationThroughDashboard(fetch, input),
        readPrepared: (input) => readPreparedCurrentForecastThroughDashboard(fetch, input),
      })

      if (requestId !== forecastPreparationRequestRef.current) {
        return
      }

      if (outcome.currentResult) {
        forecastLayerCacheRef.current.set(cacheKey, {
          payload: outcome.currentResult,
          cachedAt: Date.now(),
        })
      }

      setForecastCurrentResult(outcome.currentResult)
      setForecastCurrentState(outcome.currentState)

      if (outcome.currentState === 'FAILED') {
        setForecastErrorState({
          title: t('forecastPreparationFailed'),
          message: outcome.errorMessage ?? t('forecastUnavailableHint'),
        })
        return
      }

      if (outcome.currentState === 'UNSUPPORTED') {
        setForecastErrorState(null)
        return
      }

      setForecastErrorState(null)
    } catch (error) {
      if (requestId !== forecastPreparationRequestRef.current) {
        return
      }

      setForecastCurrentState('FAILED')
      setForecastCurrentResult(null)
      setForecastErrorState(toUiLoadErrorState(
        error,
        t('forecastPreparationFailed'),
        t('forecastPreparationFailedHint'),
        t('errors.timeout'),
        t('forecastBlocked'),
        t('forecastBlockedHint'),
      ))
    }
  }

  useEffect(() => {
    if (!isForecastPortfolioVariant || !benchmarkSeriesId) {
      return
    }

    const activeSeriesId = benchmarkSeriesId

    if (!showForecast || !showForecastVerification) {
      forecastVerificationAbortRef.current?.abort()
      setForecastVerificationState('idle')
      setForecastVerificationResult(null)
      setForecastVerificationErrorState(null)
      return
    }

    if (
      selectedProgressiveVariant
      && selectedProgressiveVariant.verificationState !== 'READY'
      && selectedProgressiveVariant.verificationState !== 'UNSUPPORTED'
      && selectedProgressiveVariant.verificationState !== 'FAILED'
    ) {
      forecastVerificationAbortRef.current?.abort()
      setForecastVerificationState('loading')
      setForecastVerificationResult(null)
      setForecastVerificationErrorState(null)
      return
    }

    let cancelled = false
    forecastVerificationAbortRef.current?.abort()
    const controller = new AbortController()
    forecastVerificationAbortRef.current = controller

    async function loadForecastVerification() {
      const cacheKey = buildForecastLayerCacheKey(locale, activeSeriesId, forecastModel, selectedForecastTargetBasis, 'verification')
      const cached = forecastLayerCacheRef.current.get(cacheKey)

      if (cached) {
        setForecastVerificationResult(cached.payload as BenchmarkForecastVerificationResult)
        setForecastVerificationState('ready')
        setForecastVerificationErrorState(null)
        return
      }

      setForecastVerificationState('loading')
      setForecastVerificationErrorState(null)

      try {
        const params = new URLSearchParams({
          seriesId: activeSeriesId,
          model: forecastModel,
          targetBasis: selectedForecastTargetBasis,
        })
        const response = await fetch(`/api/benchmark-forecast/verification?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json() as BenchmarkForecastVerificationResult | { error?: string }

        if (!response.ok) {
          throw new Error('error' in payload ? payload.error ?? t('verificationUnavailable') : t('verificationUnavailable'))
        }

        if (cancelled) {
          return
        }

        if ((payload as BenchmarkForecastVerificationResult).seriesId !== activeSeriesId
          || (payload as BenchmarkForecastVerificationResult).modelId !== forecastModel
          || (payload as BenchmarkForecastVerificationResult).targetBasis !== selectedForecastTargetBasis) {
          return
        }

        const normalizedPayload = payload as BenchmarkForecastVerificationResult

        if (!isAvailableVerificationResult(normalizedPayload)) {
          setForecastVerificationResult(null)
          setForecastVerificationState('error')
          setForecastVerificationErrorState(resolveForecastVerificationUnavailableState(normalizedPayload, {
            verificationUnavailable: t('verificationUnavailable'),
            verificationUnavailableHint: t('verificationUnavailableHint'),
            verificationBlocked: t('verificationBlocked'),
            verificationBlockedHint: t('verificationBlockedHint'),
          }))
          return
        }

        forecastLayerCacheRef.current.set(cacheKey, {
          payload: normalizedPayload,
          cachedAt: Date.now(),
        })
        setForecastVerificationResult(normalizedPayload)
        setForecastVerificationState('ready')
        setForecastVerificationErrorState(null)
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') {
          return
        }

        setForecastVerificationState('error')
        setForecastVerificationResult(null)
        setForecastVerificationErrorState(toUiLoadErrorState(
          error,
          t('verificationUnavailable'),
          t('verificationUnavailableHint'),
          t('errors.timeout'),
          t('verificationBlocked'),
          t('verificationBlockedHint'),
        ))
      }
    }

    void loadForecastVerification()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [benchmarkSeriesId, forecastModel, forecastVerificationReloadNonce, isForecastPortfolioVariant, locale, selectedForecastTargetBasis, selectedProgressiveVariant?.verificationState, showForecast, showForecastVerification, t])

  useEffect(() => {
    if (isBenchmarkMode) {
      forecastAccuracyAbortRef.current?.abort()
      setForecastAccuracyState('idle')
      setForecastAccuracyResponse(null)
      setForecastAccuracyPayload(null)
      return
    }

    if (!showForecastAccuracy || !selectedComponentName || benchmarkRequired || !effectiveComponentCode) {
      forecastAccuracyAbortRef.current?.abort()
      setForecastAccuracyState('idle')
      setForecastAccuracyResponse(null)
      setForecastAccuracyPayload(null)
      return
    }

    let cancelled = false
    forecastAccuracyAbortRef.current?.abort()
    const controller = new AbortController()
    forecastAccuracyAbortRef.current = controller

    async function loadForecastAccuracy() {
      setForecastAccuracyState('loading')

      try {
        const params = new URLSearchParams({
          locale,
          componentName: selectedComponentName,
          componentCode: effectiveComponentCode,
          horizonMonths: String(forecastAccuracyHorizon),
        })
        const response = await fetch(`/api/forecast-accuracy?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json() as ForecastAccuracyResponse | { error?: { message?: string } }

        if (!response.ok) {
          throw new Error('error' in payload ? payload.error?.message ?? t('errors.series') : t('errors.series'))
        }

        if (cancelled) {
          return
        }

        const accuracyResponse = payload as ForecastAccuracyResponse
        setForecastAccuracyResponse(accuracyResponse)
        setForecastAccuracyPayload(toForecastAccuracyViewerPayload(accuracyResponse, locale))
        setForecastAccuracyState('ready')
      } catch (error) {
        if (cancelled || (error as Error).name === 'AbortError') {
          return
        }

        setForecastAccuracyState('error')
        setForecastAccuracyResponse(null)
        setForecastAccuracyPayload(null)
        setErrorMessage(toUiLoadErrorMessage(error, t('errors.series'), t('errors.timeout')))
      }
    }

    void loadForecastAccuracy()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [benchmarkRequired, effectiveComponentCode, forecastAccuracyHorizon, isBenchmarkMode, locale, selectedComponentName, showForecastAccuracy, t])

  useEffect(() => {
    if (!forecastAccuracyResponse) {
      return
    }

    setForecastAccuracyPayload(toForecastAccuracyViewerPayload(forecastAccuracyResponse, locale))
  }, [forecastAccuracyResponse, locale])

  const forecastPortfolioPayload = isForecastPortfolioVariant
    ? buildForecastPortfolioPayload({
        basePayload: viewerPayload,
        locale,
        model: forecastModel,
        currentResult: showForecast && isAvailableCurrentResult(forecastCurrentResult) ? forecastCurrentResult : null,
        verificationResult: showForecast && showForecastVerification && isAvailableVerificationResult(forecastVerificationResult)
          ? forecastVerificationResult
          : null,
        verificationHorizon: `${forecastAccuracyHorizon}M`,
      })
    : null
  const activePayload = isForecastPortfolioVariant
    ? forecastPortfolioPayload
    : mergeAccuracyIntoViewerPayload(viewerPayload, forecastAccuracyPayload, showForecastAccuracy)
  const isChartLoading = componentsState === 'loading'
    || seriesState === 'loading'
    || (!isForecastPortfolioVariant && forecastAccuracyState === 'loading' && !activePayload)
  const hideEmbeddedBenchmarkShell = shouldHideEmbeddedBenchmarkShell(
    embedded,
    isBenchmarkMode,
    isForecastPortfolioVariant,
  )
  const selectedBenchmarkLabel = benchmarkRequired
    ? t('selectBenchmark')
    : selectedComponent?.availableBenchmarks.find((benchmark) => benchmark.componentCode === effectiveComponentCode)?.sourceLabel
      ?? selectedComponent?.availableBenchmarks[0]?.sourceLabel
      ?? t('singleBenchmark')
  return (
    <div className={`shell-grid${hideEmbeddedBenchmarkShell ? ' is-embedded' : ''}`}>
      {hideEmbeddedBenchmarkShell ? null : <section className="panel filter-panel" style={{ gridColumn: 'span 12' }}>
        {embedded ? null : (
          <div className="filters-topbar">
            <div className="language-switch" role="group" aria-label={t('language')}>
              <button
                type="button"
                className={`language-switch-button${locale === 'en' ? ' is-active' : ''}`}
                onClick={() => window.location.assign(replaceLocaleInPath(pathname, 'en'))}
              >
                EN
              </button>
              <button
                type="button"
                className={`language-switch-button${locale === 'pl' ? ' is-active' : ''}`}
                onClick={() => window.location.assign(replaceLocaleInPath(pathname, 'pl'))}
              >
                PL
              </button>
              <button
                type="button"
                className="language-switch-button theme-switch-button"
                onClick={toggleTheme}
                aria-label={t('toggleTheme')}
                title={t('toggleTheme')}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="10" cy="10" r="6.25" />
                  <path d="M10 3.75a6.25 6.25 0 0 1 0 12.5Z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="filter-grid">
          {isForecastPortfolioVariant && isBenchmarkMode ? (
            <>
              <div className="control-block" style={{ flex: '1 1 100%', minWidth: 0 }}>
                <span>{t('forecastPortfolioTitle')}</span>
                <strong>{benchmarkDisplayName ?? benchmarkSeriesId ?? ' - '}</strong>
                <span className="muted">{t('forecastPortfolioSubtitle')}</span>
              </div>

              <div className="control-check-row forecast-portfolio-controls">
                <label className="control-check control-check-inline forecast-portfolio-toggle">
                  <input type="checkbox" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} />
                  <span>{t('showForecast')}</span>
                </label>

                <div className={`control-block control-mode-group forecast-portfolio-group${showForecast ? '' : ' is-hidden'}`} aria-hidden={!showForecast}>
                  <span className="control-group-label">{t('forecastModel')}</span>
                  <div className="chart-range-buttons control-mode-buttons" role="group" aria-label={t('forecastModel')}>
                    {FORECAST_PORTFOLIO_MODELS.map((model) => {
                      const buttonMeta = buildForecastControlButtonMeta(
                        forecastModelLabel(locale, model),
                        locale,
                        progressivePreparationSnapshot
                          ? resolveSelectedProgressiveVariant(progressivePreparationSnapshot, {
                            seriesId: benchmarkSeriesId ?? '',
                            modelId: model,
                            targetBasis: selectedForecastTargetBasis,
                          })?.currentState ?? 'UNSUPPORTED'
                          : null,
                      )

                      return (
                        <button
                          key={model}
                          type="button"
                          className={`chart-range-button forecast-control-button${forecastModel === model ? ' is-active' : ''}`}
                          aria-pressed={forecastModel === model}
                          disabled={!showForecast}
                          tabIndex={showForecast ? 0 : -1}
                          onClick={() => {
                            forecastSelectionTouchedRef.current = true
                            setForecastModel(model)
                          }}
                        >
                          <span className="forecast-control-button-copy">
                            <span className="forecast-control-button-label">{buttonMeta.label}</span>
                            {buttonMeta.statusLabel ? (
                              <span className={`forecast-control-button-status is-${buttonMeta.state?.toLowerCase()}`}>{buttonMeta.statusLabel}</span>
                            ) : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className={`control-block control-mode-group forecast-portfolio-group${showForecast ? '' : ' is-hidden'}`} aria-hidden={!showForecast}>
                  <div className="control-label-with-help">
                    <span className="control-group-label">{t('forecastTargetBasis')}</span>
                    <InfoButton
                      label={t('forecastTargetBasisInfoLabel')}
                      lines={[t('forecastTargetBasisInfoLine1'), t('forecastTargetBasisInfoLine2')]}
                      tabIndex={showForecast ? 0 : -1}
                    />
                  </div>
                  <div className="chart-range-buttons control-mode-buttons" role="group" aria-label={t('forecastTargetBasis')}>
                    {FORECAST_TARGET_BASES.map((targetBasis) => {
                      const buttonMeta = buildForecastControlButtonMeta(
                        forecastTargetBasisLabel(locale, targetBasis),
                        locale,
                        progressivePreparationSnapshot
                          ? resolveSelectedProgressiveVariant(progressivePreparationSnapshot, {
                            seriesId: benchmarkSeriesId ?? '',
                            modelId: forecastModel,
                            targetBasis,
                          })?.currentState ?? 'UNSUPPORTED'
                          : null,
                      )

                      return (
                        <button
                          key={targetBasis}
                          type="button"
                          className={`chart-range-button forecast-control-button${selectedForecastTargetBasis === targetBasis ? ' is-active' : ''}`}
                          aria-pressed={selectedForecastTargetBasis === targetBasis}
                          disabled={!showForecast}
                          tabIndex={showForecast ? 0 : -1}
                          onClick={() => {
                            forecastSelectionTouchedRef.current = true
                            setSelectedForecastTargetBasis(targetBasis)
                          }}
                        >
                          <span className="forecast-control-button-copy">
                            <span className="forecast-control-button-label">{buttonMeta.label}</span>
                            {buttonMeta.statusLabel ? (
                              <span className={`forecast-control-button-status is-${buttonMeta.state?.toLowerCase()}`}>{buttonMeta.statusLabel}</span>
                            ) : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className={`control-check control-check-inline forecast-portfolio-toggle${showForecast ? '' : ' is-hidden'}`} aria-hidden={!showForecast}>
                  <input
                    type="checkbox"
                    checked={showForecast && showForecastVerification}
                    disabled={!showForecast}
                    onChange={(event) => setShowForecastVerification(event.target.checked)}
                  />
                  <span>{t('showForecastVerification')}</span>
                </label>

                <div
                  className={`control-block control-mode-group control-horizon-group forecast-portfolio-group${showForecast && showForecastVerification ? '' : ' is-hidden'}`}
                  aria-hidden={!(showForecast && showForecastVerification)}
                >
                  <div className="control-label-with-help">
                    <span className="control-group-label">{t('verificationHorizon')}</span>
                    <InfoButton
                      label={t('verificationHorizonInfoLabel')}
                      lines={[t('verificationHorizonInfoLine1'), t('verificationHorizonInfoLine2')]}
                      tabIndex={showForecast && showForecastVerification ? 0 : -1}
                    />
                  </div>
                  <div className="chart-range-buttons control-mode-buttons" role="group" aria-label={t('verificationHorizon')}>
                    {FORECAST_ACCURACY_HORIZONS.map((horizon) => (
                      <button
                        key={horizon}
                        type="button"
                        className={`chart-range-button${forecastAccuracyHorizon === horizon ? ' is-active' : ''}`}
                        aria-pressed={forecastAccuracyHorizon === horizon}
                        disabled={!(showForecast && showForecastVerification)}
                        tabIndex={showForecast && showForecastVerification ? 0 : -1}
                        onClick={() => setForecastAccuracyHorizon(horizon)}
                      >
                        {`${horizon}M`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : !isBenchmarkMode ? (
            <>
              <SearchableSelect
                label={t('component')}
                placeholder={t('componentSearchPlaceholder')}
                emptyStateTitle={t('searchEmptyTitle')}
                emptyStateHint={t('searchEmptyHint')}
                options={componentOptions}
                value={selectedComponentName}
                searchValue={componentSearch}
                onSearchChange={setComponentSearch}
                onValueChange={setSelectedComponentName}
              />

              {selectedComponent?.benchmarkCount && selectedComponent.benchmarkCount > 1 ? (
                <SearchableSelect
                  label={t('benchmark')}
                  placeholder={t('benchmarkSearchPlaceholder')}
                  emptyStateTitle={t('benchmarkSearchEmptyTitle')}
                  emptyStateHint={t('benchmarkSearchEmptyHint')}
                  options={benchmarkOptions}
                  value={selectedComponentCode}
                  searchValue={benchmarkSearch}
                  onSearchChange={setBenchmarkSearch}
                  onValueChange={setSelectedComponentCode}
                />
              ) : null}

              <div className="control-check-row">
                <label className="control-check control-check-inline">
                  <input type="checkbox" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} />
                  <span>{t('showForecast')}</span>
                </label>

                <label className="control-check control-check-inline">
                  <input type="checkbox" checked={showForecastAccuracy} onChange={(event) => setShowForecastAccuracy(event.target.checked)} />
                  <span>{t('showForecastAccuracy')}</span>
                </label>

                <div
                  className={`control-block control-mode-group control-horizon-group${showForecastAccuracy ? '' : ' is-hidden'}`}
                  aria-hidden={!showForecastAccuracy}
                >
                  <div className="control-label-with-help">
                    <span>{t('forecastHorizon')}</span>
                    <InfoButton
                      label={t('forecastAccuracyInfoLabel')}
                      lines={[t('forecastAccuracyInfoLine1'), t('forecastAccuracyInfoLine2')]}
                      tabIndex={showForecastAccuracy ? 0 : -1}
                    />
                  </div>
                  <div className="chart-range-buttons control-mode-buttons" role="group" aria-label={t('forecastHorizon')}>
                    {FORECAST_ACCURACY_HORIZONS.map((horizon) => (
                      <button
                        key={horizon}
                        type="button"
                        className={`chart-range-button${forecastAccuracyHorizon === horizon ? ' is-active' : ''}`}
                        aria-pressed={forecastAccuracyHorizon === horizon}
                        disabled={!showForecastAccuracy}
                        tabIndex={showForecastAccuracy ? 0 : -1}
                        onClick={() => setForecastAccuracyHorizon(horizon)}
                      >
                        {`${horizon}M`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {!isBenchmarkMode && benchmarkRequired ? <p className="callout">{t('benchmarkRequired')}</p> : null}
        {errorMessage ? (
          <div className="callout callout-error" role="status" aria-live="polite">
            <div>{errorMessage}</div>
            <div className="callout-actions">
              <button type="button" className="callout-button" onClick={retryLoad}>{t('retry')}</button>
            </div>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastCurrentDisplayState === 'NOT_PREPARED' ? (
          <div className="callout" role="status" aria-live="polite">
            <strong>{t('forecastPreparationRequired')}</strong>
            <p>{t('forecastPreparationRequiredHint')}</p>
            <div className="callout-actions">
              <button type="button" className="callout-button" onClick={handlePrepareForecastCurrent}>
                {t('prepareForecast')}
              </button>
            </div>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastCurrentDisplayState === 'PREPARING' ? (
          <div className="callout" role="status" aria-live="polite">
            <strong>{t('forecastPreparing')}</strong>
            <p>{t('forecastPreparingHint')}</p>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastCurrentDisplayState === 'QUEUED' ? (
          <div className="callout" role="status" aria-live="polite">
            <strong>{t('forecastQueued')}</strong>
            <p>{t('forecastQueuedHint')}</p>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastCurrentDisplayState === 'UNSUPPORTED' ? (
          <div className="callout" role="status" aria-live="polite">
            <strong>{t('forecastUnsupported')}</strong>
            <p>{selectedProgressiveVariant?.currentReason ?? (forecastCurrentResult && !isAvailableCurrentResult(forecastCurrentResult) ? forecastCurrentResult.reason : null) ?? t('forecastUnsupportedHint')}</p>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastCurrentDisplayState === 'FAILED' && forecastErrorState ? (
          <div className="callout callout-error" role="status" aria-live="polite">
            <strong>{forecastErrorState.title}</strong>
            <p>{forecastErrorState.message}</p>
          </div>
        ) : null}
        {isForecastPortfolioVariant && showForecast && showForecastVerification && selectedProgressiveVariant && forecastVerificationState !== 'ready' && ['PREPARING', 'QUEUED'].includes(selectedProgressiveVariant.verificationState) ? (
          <div className="callout" role="status" aria-live="polite">
            <strong>{selectedProgressiveVariant.verificationState === 'PREPARING' ? t('verificationPreparing') : t('verificationQueued')}</strong>
            <p>{selectedProgressiveVariant.verificationState === 'PREPARING' ? t('verificationPreparingHint') : t('verificationQueuedHint')}</p>
          </div>
        ) : null}
        {isForecastPortfolioVariant && forecastVerificationErrorState ? (
          <div className="callout callout-error" role="status" aria-live="polite">
            <strong>{forecastVerificationErrorState.title}</strong>
            <p>{forecastVerificationErrorState.message}</p>
          </div>
        ) : null}
      </section>}

      <ChartPanel
        locale={locale}
        payload={activePayload}
        emptyMessage={benchmarkRequired ? t('chartNeedsBenchmark') : t('chartEmpty')}
        isLoading={isChartLoading}
        loadingTitle={t('loadingTitle')}
        loadingHint={t('loadingHint')}
        resetZoomLabel={t('resetZoom')}
        sourceLabel={t('sourceLabel')}
        showForecastAccuracy={isForecastPortfolioVariant ? showForecast && showForecastVerification : showForecastAccuracy && !isBenchmarkMode}
        verificationRibbonLabel={t('forecastVerificationDelta')}
        verificationRibbonInfoLabel={t('forecastVerificationDeltaInfoLabel')}
        verificationRibbonInfoLines={[t('forecastVerificationDeltaInfoLine1'), t('forecastVerificationDeltaInfoLine2')]}
        initialPreset={isBenchmarkMode ? benchmarkRange : 'ALL'}
        lockServerRange={isBenchmarkMode}
        onPresetChange={isBenchmarkMode ? setBenchmarkRange : undefined}
        embedded={embedded}
      />
    </div>
  )
}