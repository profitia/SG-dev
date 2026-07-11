'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'

import {
  resolvePaddedValueDomain,
  shouldCommitZoomSelection,
  shouldTogglePinnedSurface,
} from '@/lib/chart/chart-panel-helpers'
import { buildForecastAccuracyCacheKey } from '@/lib/forecast-accuracy/forecast-accuracy-cache'
import { resolveDatePlotOffset } from '@/lib/chart/date-plot-offset'
import type {
  ForecastAccuracyErrorResponse,
  ForecastAccuracyHorizonMonths,
  ForecastAccuracyResponse,
} from '@/lib/forecast-accuracy/forecast-accuracy-contract'
import {
  buildHistoricalForecastComparison,
  buildHistoricalForecastDeltaSegments,
  buildHistoricalForecastLineSegments,
  resolveHistoricalForecastPercentageDiff,
  selectPreferredAccuracyHorizon,
  type AccuracyPresentationMode,
  type HistoricalForecastComparison,
  type HistoricalForecastComparisonPoint,
} from '@/lib/forecast-accuracy/historical-forecast-view'
import type {
  ComponentListItem,
  ComponentListResponse,
  SeriesResponse,
} from '@/lib/time-series/series-contract'
import { toTimeSeriesViewerPayload } from '@/lib/time-series-viewer/raw-data-to-time-series-viewer'
import type {
  TimeSeriesViewerLocale,
  TimeSeriesViewerTooltipModel,
  TimeSeriesViewerPayload,
  TimeSeriesViewerPoint,
  TimeSeriesViewerSeries,
} from '@/lib/time-series-viewer/time-series-viewer-contract'

type Locale = TimeSeriesViewerLocale
type TooltipVariant = TimeSeriesViewerSeries['kind'] | 'forecast-accuracy' | 'historical-forecast'
type VisibilityKey = TooltipVariant

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type HistoricalForecastLayerState = LoadState | 'unavailable'
type RangePreset = '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'
type VisibleRange = { start: string; end: string }
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
type AccuracyMarker = {
  key: string
  component: string
  date: string
  value: number
  diff: number
  tooltipModel: TimeSeriesViewerTooltipModel
  variant: 'forecast-accuracy'
}
type TooltipPlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
type CachedSeriesEntry = {
  response: SeriesResponse
  payload: TimeSeriesViewerPayload
  cachedAt: number
}

type CachedForecastAccuracyEntry = {
  response: ForecastAccuracyResponse
  cachedAt: number
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

type HistoricalForecastSurface = {
  key: string
  component: string
  date: string
  value: number
  actualValue: number
  forecastValue: number
  horizonMonths: ForecastAccuracyHorizonMonths
  sourceDifferenceValue: number | null
  sourceErrorType: string | null
  tooltipModel: TimeSeriesViewerTooltipModel
  variant: 'historical-forecast'
}

type TooltipSurface = AccuracyMarker | HistoricalForecastSurface

type SearchableSelectOption = {
  value: string
  label: string
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
const ZOOM_DRAG_THRESHOLD_PX = 12
const FORECAST_POINT_CAPTURE_RADIUS_PX = 14
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

function formatNumber(locale: Locale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatDiff(locale: Locale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  return `${new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)}%`
}

function formatSignedDiff(locale: Locale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${formatDiff(locale, value)}`
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

function describeForecastDirection(locale: Locale, diff: number) {
  return diff > 0
    ? {
        forecast: locale === 'pl' ? 'Powyżej odczytu rzeczywistego' : 'Above actual',
        accuracy: locale === 'pl' ? 'Prognoza zawyzona' : 'Over-forecast',
        interpretation: locale === 'pl'
          ? 'Wczesniejsza prognoza byla powyzej zrealizowanego odczytu rynkowego.'
          : 'The previous forecast was above the realized market reading.',
      }
    : {
        forecast: locale === 'pl' ? 'Ponizej odczytu rzeczywistego' : 'Below actual',
        accuracy: locale === 'pl' ? 'Prognoza zanizona' : 'Under-forecast',
        interpretation: locale === 'pl'
          ? 'Wczesniejsza prognoza byla ponizej zrealizowanego odczytu rynkowego.'
          : 'The previous forecast was below the realized market reading.',
      }
}

function tooltipVariantClass(variant: TooltipVariant) {
  switch (variant) {
    case 'historical':
      return 'is-historical'
    case 'forecast-central':
      return 'is-forecast-central'
    case 'forecast-upper':
      return 'is-forecast-upper'
    case 'forecast-lower':
      return 'is-forecast-lower'
    case 'forecast-accuracy':
      return 'is-forecast-accuracy'
    case 'historical-forecast':
      return 'is-historical-forecast'
  }
}

function formatSeriesLabel(locale: Locale, kind: TooltipVariant) {
  switch (kind) {
    case 'historical':
      return locale === 'pl' ? 'Ceny historyczne' : 'Historical Prices'
    case 'forecast-central':
      return locale === 'pl' ? 'Prognoza' : 'Forecast'
    case 'forecast-upper':
      return locale === 'pl' ? 'Górne ograniczenie prognozy' : 'Forecast Upper Bound'
    case 'forecast-lower':
      return locale === 'pl' ? 'Dolne ograniczenie prognozy' : 'Forecast Lower Bound'
    case 'forecast-accuracy':
      return locale === 'pl' ? 'Trafnosc prognozy' : 'Forecast Accuracy'
    case 'historical-forecast':
      return locale === 'pl' ? 'Historyczna prognoza' : 'Historical Forecast'
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

function isForecastAccuracyErrorResponse(payload: unknown): payload is ForecastAccuracyErrorResponse {
  return typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof (payload as { error?: { code?: unknown } }).error?.code === 'string'
}

function buildHistoricalForecastTooltipModel(
  locale: Locale,
  point: HistoricalForecastComparisonPoint,
  component: string,
  horizonMonths: ForecastAccuracyHorizonMonths,
): TimeSeriesViewerTooltipModel {
  const percentageDiff = resolveHistoricalForecastPercentageDiff(point.actualValue, point.forecastValue)

  return {
    title: locale === 'pl' ? 'Historyczna prognoza' : 'Historical Forecast',
    rows: [
      { label: locale === 'pl' ? 'Komponent' : 'Component', value: component },
      { label: locale === 'pl' ? 'Data' : 'Date', value: formatDate(locale, point.date) },
      { label: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual', value: formatNumber(locale, point.actualValue) },
      { label: locale === 'pl' ? `Prognoza ${horizonMonths}M` : `${horizonMonths}M forecast`, value: formatNumber(locale, point.forecastValue) },
      {
        label: locale === 'pl' ? 'Odchylenie' : 'Difference',
        value: percentageDiff === null ? '—' : formatSignedDiff(locale, percentageDiff),
      },
      {
        label: locale === 'pl' ? 'Interpretacja biznesowa' : 'Business interpretation',
        value: describeForecastDirection(locale, point.forecastValue - point.actualValue).interpretation,
      },
    ],
  }
}

function toHistoricalForecastSurface(
  locale: Locale,
  point: HistoricalForecastComparisonPoint,
  component: string,
  horizonMonths: ForecastAccuracyHorizonMonths,
): HistoricalForecastSurface {
  return {
    key: `historical-forecast:${point.key}`,
    component,
    date: point.date,
    value: point.forecastValue,
    actualValue: point.actualValue,
    forecastValue: point.forecastValue,
    horizonMonths,
    sourceDifferenceValue: point.sourceDifferenceValue,
    sourceErrorType: point.sourceErrorType,
    tooltipModel: buildHistoricalForecastTooltipModel(locale, point, component, horizonMonths),
    variant: 'historical-forecast',
  }
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

function toUiLoadErrorMessage(error: unknown, fallbackMessage: string, timeoutMessage: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('timeout') || message.includes('timed out')) {
    return timeoutMessage
  }

  return fallbackMessage
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

function formatForecastDirectionValue(locale: Locale, diff: number | null) {
  if (diff === null) {
    return ' - '
  }

  const direction = diff >= 0
    ? locale === 'pl' ? 'powyżej odczytu rzeczywistego' : 'above actual'
    : locale === 'pl' ? 'poniżej odczytu rzeczywistego' : 'below actual'

  return `${formatSignedDiff(locale, diff)} ${direction}`
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

function isHistoricalForecastSurface(surface: TooltipSurface | TimeSeriesViewerPoint): surface is HistoricalForecastSurface {
  return !('detailModel' in surface) && surface.variant === 'historical-forecast'
}

function resolveTooltipPoint(surface: TooltipSurface | TimeSeriesViewerPoint, locale: Locale, payload: TimeSeriesViewerPayload) {
  if ('detailModel' in surface) {
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
      detailRows: [] as TooltipCardRow[],
      businessDescriptionLines: buildTooltipDescriptionLines(payload),
    }
  }

  if (isHistoricalForecastSurface(surface)) {
    return {
      component: surface.component,
      date: surface.date,
      value: surface.actualValue,
      primaryLabel: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual',
      interval: null,
      detailRows: [
        {
          label: locale === 'pl' ? `Prognoza ${surface.horizonMonths}M` : `${surface.horizonMonths}M forecast`,
          value: formatPrimaryValue(locale, surface.forecastValue, payload.unit, payload.currency),
        },
        {
          label: locale === 'pl' ? 'Odchylenie' : 'Difference',
          value: resolveHistoricalForecastPercentageDiff(surface.actualValue, surface.forecastValue) === null
            ? '—'
            : formatSignedDiff(locale, resolveHistoricalForecastPercentageDiff(surface.actualValue, surface.forecastValue)),
        },
      ] as TooltipCardRow[],
      businessDescriptionLines: [describeForecastDirection(locale, surface.forecastValue - surface.actualValue).interpretation],
    }
  }

  const accuracySurface = surface as AccuracyMarker

  return {
    component: accuracySurface.component,
    date: accuracySurface.date,
    value: accuracySurface.value,
    primaryLabel: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual',
    interval: null,
    detailRows: [
      { label: locale === 'pl' ? 'Prognoza' : 'Forecast', value: formatForecastDirectionValue(locale, accuracySurface.diff) },
      {
        label: locale === 'pl' ? 'Interpretacja biznesowa' : 'Business interpretation',
        value: describeForecastDirection(locale, accuracySurface.diff).interpretation,
      },
    ],
    businessDescriptionLines: [],
  }
}

function buildTooltipCardModel(
  locale: Locale,
  surface: TooltipSurface | TimeSeriesViewerPoint,
  payload: TimeSeriesViewerPayload,
): TooltipCardModel {
  const resolved = resolveTooltipPoint(surface, locale, payload)
  const variant = resolveSurfaceVariant(surface)
  const detailModel = 'detailModel' in surface ? surface.detailModel : null

  return {
    series: formatSeriesLabel(locale, variant),
    component: resolved.component,
    date: formatDate(locale, resolved.date),
    primaryLabel: resolved.primaryLabel,
    primaryValue: variant === 'forecast-accuracy'
      ? formatNumber(locale, resolved.value)
      : variant === 'historical-forecast'
        ? formatPrimaryValue(locale, resolved.value, payload.unit, payload.currency)
      : formatPrimaryValue(locale, detailModel?.value ?? ('detailModel' in surface || isAccuracySurface(surface) ? surface.value : null), detailModel?.unit ?? payload.unit, detailModel?.currency ?? payload.currency),
    forecastInterval: resolved.interval,
    detailRows: resolved.detailRows,
    businessDescriptionLines: resolved.businessDescriptionLines,
  }
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
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
  if (values.length === 0) {
    return []
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  if (minimum === maximum) {
    return [{ value: minimum, label: formatNumber(locale, minimum), offset: 0 }]
  }

  const safeTickCount = Math.max(tickCount, 2)

  return Array.from({ length: safeTickCount }, (_, index) => {
    const ratio = index / (safeTickCount - 1)
    const value = minimum + (maximum - minimum) * ratio

    return {
      value,
      label: formatNumber(locale, value),
      offset: ratio,
    }
  })
}

function resolvePresetRange(historicalDates: string[], forecastDates: string[], preset: RangePreset): VisibleRange | null {
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
      ? findLastDateOnOrBefore(forecastDates, addMonths(new Date(historicalEnd), 12)) ?? historicalEnd
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
    ? findLastDateOnOrBefore(forecastDates, addMonths(new Date(historicalEnd), forecastMonths)) ?? historicalEnd
    : historicalEnd

  return { start: firstVisibleHistorical, end: forecastEnd }
}

function filterSeriesToRange(series: TimeSeriesViewerSeries[], range: VisibleRange | null) {
  if (!range) {
    return series
  }

  const startMs = new Date(range.start).getTime()
  const endMs = new Date(range.end).getTime()

  return series.map((entry) => ({
    ...entry,
    points: entry.points.filter((point) => {
      const pointMs = new Date(point.date).getTime()
      return pointMs >= startMs && pointMs <= endMs
    }),
  }))
}

function filterHistoricalForecastPointsToRange(
  comparison: HistoricalForecastComparison | null,
  range: VisibleRange | null,
) {
  if (!comparison) {
    return []
  }

  if (!range) {
    return comparison.points
  }

  const startMs = new Date(range.start).getTime()
  const endMs = new Date(range.end).getTime()

  return comparison.points.filter((point) => {
    const pointMs = new Date(point.date).getTime()
    return pointMs >= startMs && pointMs <= endMs
  })
}

function buildAccuracyTooltip(locale: Locale, point: TimeSeriesViewerPoint, benchmarkCode: string | null): TimeSeriesViewerTooltipModel {
  const direction = describeForecastDirection(locale, point.diff ?? 0)

  return {
    title: locale === 'pl' ? 'Trafnosc prognozy' : 'Forecast accuracy',
    rows: [
      { label: locale === 'pl' ? 'Data' : 'Date', value: formatDate(locale, point.date) },
      { label: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual', value: formatNumber(locale, point.value) },
      { label: locale === 'pl' ? 'Prognoza' : 'Forecast', value: direction.forecast },
      { label: locale === 'pl' ? 'Blad prognozy' : 'Forecast Error', value: formatSignedDiff(locale, point.diff) },
      { label: locale === 'pl' ? 'Ocena' : 'Accuracy', value: direction.accuracy },
      {
        label: locale === 'pl' ? 'Interpretacja biznesowa' : 'Business interpretation',
        value: direction.interpretation,
      },
    ],
  }
}

function buildAccuracyMarkers(locale: Locale, series: TimeSeriesViewerSeries[], benchmarkCode: string | null): AccuracyMarker[] {
  return series
    .filter((entry) => entry.kind === 'historical')
    .flatMap((entry) => entry.points)
    .filter((point) => point.value !== null && point.diff !== null && point.diff !== 0)
    .map((point) => ({
      key: `accuracy-${point.key}`,
      component: point.detailModel.componentName,
      date: point.date,
      value: point.value as number,
      diff: point.diff as number,
      tooltipModel: buildAccuracyTooltip(locale, point, benchmarkCode),
      variant: 'forecast-accuracy',
    }))
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

function clampChartY(value: number, layout: ChartLayout) {
  return Math.max(layout.paddingTop, Math.min(layout.height - layout.paddingBottom, value))
}

function chartYFromClientY(clientY: number, rect: DOMRect, layout: ChartLayout) {
  const ratio = (clientY - rect.top) / rect.height
  return clampChartY(ratio * layout.height, layout)
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
  minimum: number,
  maximum: number,
  pointX: (date: string) => number,
  layout: ChartLayout,
) {
  const validPoints = points.filter((point) => point.value !== null)

  if (validPoints.length === 0) {
    return ''
  }

  const range = maximum - minimum || 1

  return validPoints
    .map((point) => {
      const x = pointX(point.date)
      const y = layout.height - layout.paddingBottom - (((point.value ?? minimum) - minimum) / range) * (layout.height - layout.paddingTop - layout.paddingBottom)
      return `${x},${y}`
    })
    .join(' ')
}

function buildPlotGeometry(series: TimeSeriesViewerSeries[], layout: ChartLayout) {
  const allDates = Array.from(new Set(series.flatMap((entry) => entry.points.map((point) => point.date))))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
  const allValues = series.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const { minimum, maximum } = resolvePaddedValueDomain(allValues)
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
    pointX,
    pointY,
  }
}

function legendClass(kind: TimeSeriesViewerSeries['kind']) {
  switch (kind) {
    case 'historical':
      return 'historical'
    case 'forecast-central':
      return 'forecast-central'
    case 'forecast-upper':
      return 'forecast-upper'
    case 'forecast-lower':
      return 'forecast-lower'
  }
}

function resolveSurfaceVariant(surface: TooltipSurface | TimeSeriesViewerPoint): TooltipVariant {
  return 'detailModel' in surface ? surface.detailModel.scenarioType as TooltipVariant : surface.variant
}

function isAccuracySurface(surface: TooltipSurface | TimeSeriesViewerPoint): surface is AccuracyMarker {
  return !('detailModel' in surface) && 'diff' in surface && 'value' in surface
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
  accuracyPresentationMode,
  forecastAccuracyLabel,
  historicalForecastLabel,
  historicalForecastResponse,
  historicalForecastState,
  historicalForecastMessage,
  pinnedTooltipLabel,
}: {
  locale: Locale
  payload: TimeSeriesViewerPayload | null
  emptyMessage: string
  isLoading: boolean
  loadingTitle: string
  loadingHint: string
  resetZoomLabel: string
  sourceLabel: string
  accuracyPresentationMode: AccuracyPresentationMode
  forecastAccuracyLabel: string
  historicalForecastLabel: string
  historicalForecastResponse: ForecastAccuracyResponse | null
  historicalForecastState: HistoricalForecastLayerState
  historicalForecastMessage: string | null
  pinnedTooltipLabel: string
}) {
  const [activePoint, setActivePoint] = useState<TimeSeriesViewerPoint | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<TooltipSurface | null>(null)
  const [activePreset, setActivePreset] = useState<RangePreset>('ALL')
  const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<string | null>(null)
  const [selectedSurface, setSelectedSurface] = useState<TooltipSurface | TimeSeriesViewerPoint | null>(null)
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
  const dragSelectionRef = useRef<DragSelection>(null)
  const windowDragMoveHandlerRef = useRef<((event: MouseEvent) => void) | null>(null)
  const windowDragUpHandlerRef = useRef<(() => void) | null>(null)
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armAccuracyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressSurfaceClickRef = useRef(false)
  const handledSurfaceMouseDownKeyRef = useRef<string | null>(null)
  const chartLayout = resolveChartLayout(viewportWidth, isTouchInput)
  const useCompactTooltipRail = viewportWidth <= 420
  const pinnedSurfaceKey = selectedSurface?.key ?? selectedSurfaceKey
  const previewHistoricalSeries = payload?.series.find((entry) => entry.kind === 'historical') ?? null
  const previewForecastSeries = payload?.series.filter((entry) => entry.kind !== 'historical') ?? []
  const previewFilteredSeries = payload?.series.filter((entry) => !hiddenItems.includes(entry.kind)) ?? []
  const previewHistoricalDates = uniqueSortedDates(previewHistoricalSeries ? [previewHistoricalSeries] : [])
  const previewForecastDates = uniqueSortedDates(previewForecastSeries)
  const previewPresetRange = resolvePresetRange(previewHistoricalDates, previewForecastDates, activePreset)
  const visibleDatesForZoom = uniqueSortedDates(filterSeriesToRange(previewFilteredSeries, zoomRange ?? previewPresetRange))

  useEffect(() => {
    setActivePreset('ALL')
    setZoomRange(null)
    setSelectedSurfaceKey(null)
    setSelectedSurface(null)
    setSelectedSurfaceVariant(null)
    setActivePoint(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(null)
    setHiddenItems([])
    setTooltipPosition(null)
  }, [payload?.benchmarkCode, payload?.title])

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
    dragSelectionRef.current = dragSelection
  }, [dragSelection])

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
      setActivePoint(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
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

    if (isLoading || !payload || payload.series.every((entry) => entry.points.length === 0)) {
      setTooltipPosition(null)
      return
    }

    if (!tooltipRef.current || !chartSurfaceRef.current || !svgRef.current) {
      setTooltipPosition(null)
      return
    }

    const displayTooltip = selectedSurface ?? activeTooltip ?? activePoint

    if (!displayTooltip) {
      setTooltipPosition(null)
      return
    }

    const historicalSeries = payload.series.find((entry) => entry.kind === 'historical') ?? null
    const forecastSeries = payload.series.filter((entry) => entry.kind !== 'historical')
    const filteredSeries = payload.series.filter((entry) => !hiddenItems.includes(entry.kind))
    const historicalDates = uniqueSortedDates(historicalSeries ? [historicalSeries] : [])
    const forecastDates = uniqueSortedDates(forecastSeries)
    const presetRange = resolvePresetRange(historicalDates, forecastDates, activePreset)
    const effectiveRange = zoomRange ?? presetRange
    const visibleSeries = filterSeriesToRange(filteredSeries, effectiveRange)
    const { pointX, pointY } = buildPlotGeometry(visibleSeries, chartLayout)
    const anchorX = pointX(displayTooltip.date)
    const anchorValue = displayTooltip.value
    const anchorY = pointY(anchorValue)
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
  }, [isLoading, payload, selectedSurface, activeTooltip, activePoint, hiddenItems, activePreset, zoomRange, chartLayout, useCompactTooltipRail])

  useEffect(() => {
    if (!activePoint && !activeTooltip && !selectedSurface) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (chartSurfaceRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return
      }

      clearHideTimeout()
      setActivePoint(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
      setSelectedSurface(null)
      setSelectedSurfaceVariant(null)
      setArmedAccuracyKey(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [activePoint, activeTooltip, selectedSurface])

  useEffect(() => {
    if ((!chartLayout.isTouch && !useCompactTooltipRail) || !tooltipRef.current || (!activePoint && !activeTooltip && !selectedSurface)) {
      return
    }

    tooltipRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [chartLayout.isTouch, useCompactTooltipRail, activePoint, activeTooltip, selectedSurface])

  useEffect(() => () => {
    detachWindowDragListeners()
  }, [])

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

  const historicalSeries = payload.series.find((entry) => entry.kind === 'historical') ?? null
  const forecastSeries = payload.series.filter((entry) => entry.kind !== 'historical')
  const filteredSeries = payload.series.filter((entry) => !hiddenItems.includes(entry.kind))
  const historicalDates = uniqueSortedDates(historicalSeries ? [historicalSeries] : [])
  const forecastDates = uniqueSortedDates(forecastSeries)
  const presetRange = resolvePresetRange(historicalDates, forecastDates, activePreset)
  const effectiveRange = zoomRange ?? presetRange
  const visibleSeries = filterSeriesToRange(filteredSeries, effectiveRange)
  const visibleDates = uniqueSortedDates(visibleSeries)
  const visibleValues = visibleSeries.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const { minimum, maximum, pointX, pointY } = buildPlotGeometry(visibleSeries, chartLayout)
  const xTicks = buildDateTicks(locale, visibleDates, chartLayout.dateTickTarget)
  const yTicks = buildValueTicks(locale, visibleValues, chartLayout.valueTickCount)
  const accuracyMarkers = accuracyPresentationMode === 'percentage-arrows' && !hiddenItems.includes('forecast-accuracy')
    ? buildAccuracyMarkers(locale, visibleSeries, payload.benchmarkCode ?? payload.sourceInfo?.benchmarkCode ?? null)
    : []
  const historicalForecastComparison = accuracyPresentationMode === 'historical-forecast' && historicalForecastResponse
    ? buildHistoricalForecastComparison(historicalForecastResponse)
    : null
  const visibleHistoricalForecastPoints = historicalForecastComparison && !hiddenItems.includes('historical-forecast') && !hiddenItems.includes('historical')
    ? filterHistoricalForecastPointsToRange(historicalForecastComparison, effectiveRange)
    : []
  const historicalForecastLineSegments = buildHistoricalForecastLineSegments(visibleHistoricalForecastPoints)
  const historicalForecastDeltaSegments = buildHistoricalForecastDeltaSegments(visibleHistoricalForecastPoints)
  const forecastInteractivePoints = accuracyPresentationMode === 'historical-forecast'
    ? visibleSeries
      .filter((entry) => entry.kind !== 'historical')
      .flatMap((entry) => entry.points.filter((point) => point.value !== null).map((point) => ({ entry, point })))
    : []
  const displayTooltip = selectedSurface ?? activeTooltip ?? activePoint
  const tooltipVariant = displayTooltip ? resolveSurfaceVariant(displayTooltip) : null
  const tooltipCard = displayTooltip ? buildTooltipCardModel(locale, displayTooltip, payload) : null
  const isTooltipPinned = !!displayTooltip && selectedSurface?.key === displayTooltip.key
  const sourceLine = buildSourceLine(locale, payload)
  const visibleRangeLabel = visibleDates.length > 0
    ? `${formatDate(locale, visibleDates[0])} - ${formatDate(locale, visibleDates[visibleDates.length - 1])}`
    : `${formatDate(locale, effectiveRange?.start ?? null)} - ${formatDate(locale, effectiveRange?.end ?? null)}`
  const chartValueContext = [payload.currency, payload.unit].filter((entry) => entry && entry.trim().length > 0).join(' · ')

  const tooltipAnchorPoint = displayTooltip
    ? (() => {
        const x = pointX(displayTooltip.date)

        if (isAccuracySurface(displayTooltip)) {
          return {
            x,
            pointY: pointY(displayTooltip.value),
            tooltipY: pointY(displayTooltip.value) + (displayTooltip.diff >= 0 ? -16 : 18),
          }
        }

        return {
          x,
          pointY: pointY(displayTooltip.value),
          tooltipY: pointY(displayTooltip.value),
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

  function pinSurface(surface: TooltipSurface | TimeSeriesViewerPoint, variant: TooltipVariant) {
    clearHideTimeout()

    if (shouldTogglePinnedSurface(selectedSurface?.key ?? null, selectedSurfaceVariant, surface.key, variant)) {
      clearPinnedSelection()
      return
    }

    setSelectedSurfaceKey(surface.key)
    setSelectedSurface(surface)
    setSelectedSurfaceVariant(variant)
    setActivePoint(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(isAccuracySurface(surface) ? surface.key : null)
  }

  function handlePointEnter(point: TimeSeriesViewerPoint) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    setArmedAccuracyKey(null)
    clearHideTimeout()
    setActivePoint(point)
    setActiveTooltip(null)
  }

  function handlePointLeave(pointKey: string) {
    if (pinnedSurfaceKey) {
      return
    }

    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActivePoint((current) => current?.key === pointKey ? null : current)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function handleTooltipSurfaceEnter(surface: TooltipSurface) {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    clearHideTimeout()
    setArmedAccuracyKey(isAccuracySurface(surface) ? surface.key : null)
    setActivePoint(null)
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
    setActivePoint(null)
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
    pinSurface(marker, 'forecast-accuracy')
  }

  function handleRangePreset(preset: RangePreset) {
    setActivePreset(preset)
    setZoomRange(null)
  }

  function scheduleChartSurfaceDismissal() {
    if (pinnedSurfaceKey) {
      return
    }

    if (armAccuracyTimeoutRef.current) {
      clearTimeout(armAccuracyTimeoutRef.current)
      armAccuracyTimeoutRef.current = null
    }

    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActivePoint(null)
      setActiveTooltip(null)
      setSelectedSurfaceKey(null)
      setSelectedSurface(null)
      setSelectedSurfaceVariant(null)
      setArmedAccuracyKey(null)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function clearPinnedSelection() {
    clearHideTimeout()
    setSelectedSurfaceKey(null)
    setSelectedSurface(null)
    setSelectedSurfaceVariant(null)
    setActivePoint(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(null)
  }

  function isSelectedSeriesPoint(point: TimeSeriesViewerPoint, kind: TimeSeriesViewerSeries['kind']) {
    if (!selectedSurface || selectedSurfaceVariant !== kind || !('detailModel' in selectedSurface)) {
      return false
    }

    return selectedSurface.key === point.key
      || (selectedSurface.recordId === point.recordId && selectedSurface.date === point.date)
  }

  function isHoveredSeriesPoint(point: TimeSeriesViewerPoint) {
    return !pinnedSurfaceKey && activePoint?.key === point.key
  }

  function resolveNearestHistoricalForecastSurface(
    event: React.MouseEvent<SVGElement>,
    points: HistoricalForecastComparisonPoint[],
  ) {
    if (points.length === 0 || !svgRef.current || !historicalForecastComparison) {
      return null
    }

    const rect = svgRef.current.getBoundingClientRect()
    const chartX = chartXFromClientX(event.clientX, rect, chartLayout)
    const nearestPoint = points.reduce((best, point) => {
      const nextDistance = Math.abs(pointX(point.date) - chartX)

      if (!best) {
        return { point, distance: nextDistance }
      }

      return nextDistance < best.distance ? { point, distance: nextDistance } : best
    }, null as { point: HistoricalForecastComparisonPoint; distance: number } | null)

    return nearestPoint
      ? toHistoricalForecastSurface(locale, nearestPoint.point, payload?.title ?? nearestPoint.point.key, historicalForecastComparison.horizonMonths)
      : null
  }

  function resolveForecastPointFromEvent(event: React.MouseEvent<SVGElement>) {
    if (forecastInteractivePoints.length === 0 || !svgRef.current) {
      return null
    }

    const rect = svgRef.current.getBoundingClientRect()
    const chartX = chartXFromClientX(event.clientX, rect, chartLayout)
    const chartY = chartYFromClientY(event.clientY, rect, chartLayout)
    const nearestPoint = forecastInteractivePoints.reduce((best, candidate) => {
      const candidateX = pointX(candidate.point.date)
      const candidateY = pointY(candidate.point.value)
      const distance = Math.hypot(candidateX - chartX, candidateY - chartY)

      if (!best || distance < best.distance) {
        return { ...candidate, distance }
      }

      return best
    }, null as ({ entry: TimeSeriesViewerSeries; point: TimeSeriesViewerPoint; distance: number }) | null)

    if (!nearestPoint || nearestPoint.distance > FORECAST_POINT_CAPTURE_RADIUS_PX) {
      return null
    }

    return nearestPoint
  }

  function handleHistoricalForecastEnter(surface: HistoricalForecastSurface) {
    if (pinnedSurfaceKey) {
      return
    }

    clearHideTimeout()
    setArmedAccuracyKey(null)
    setActivePoint(null)
    setActiveTooltip(surface)
  }

  function activateHistoricalForecastSurface(surface: HistoricalForecastSurface) {
    setArmedAccuracyKey(null)
    pinSurface(surface, 'historical-forecast')
  }

  function handleChartMouseDown(event: React.MouseEvent<SVGElement>) {
    if (chartLayout.isTouch || event.button !== 0 || visibleDatesForZoom.length < 2 || !svgRef.current) {
      return
    }

    suppressSurfaceClickRef.current = false
    setActivePoint(null)
    setActiveTooltip(null)
    setArmedAccuracyKey(null)

    const rect = svgRef.current.getBoundingClientRect()
    const startX = chartXFromClientX(event.clientX, rect, chartLayout)
    const nextSelection = { startX, currentX: startX }
    dragSelectionRef.current = nextSelection
    setDragSelection(nextSelection)

    attachWindowDragListeners()
  }

  function handleChartMouseMove(event: React.MouseEvent<SVGElement>) {
    const activeDragSelection = dragSelectionRef.current

    if (!activeDragSelection || !svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    const nextSelection = { ...activeDragSelection, currentX: chartXFromClientX(event.clientX, rect, chartLayout) }
    dragSelectionRef.current = nextSelection
    setDragSelection(nextSelection)
  }

  function commitZoomSelection() {
    const activeDragSelection = dragSelectionRef.current

    detachWindowDragListeners()

    if (!activeDragSelection || visibleDatesForZoom.length < 2) {
      dragSelectionRef.current = null
      setDragSelection(null)
      return
    }

    const startX = Math.min(activeDragSelection.startX, activeDragSelection.currentX)
    const endX = Math.max(activeDragSelection.startX, activeDragSelection.currentX)

    if (!shouldCommitZoomSelection(startX, endX, ZOOM_DRAG_THRESHOLD_PX)) {
      dragSelectionRef.current = null
      setDragSelection(null)
      return
    }

    suppressSurfaceClickRef.current = true

    const startDate = dateFromChartX(startX, visibleDatesForZoom, chartLayout)
    const endDate = dateFromChartX(endX, visibleDatesForZoom, chartLayout)

    dragSelectionRef.current = null
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

  function attachWindowDragListeners() {
    detachWindowDragListeners()

    const handleWindowMouseMove = (event: MouseEvent) => {
      const activeDragSelection = dragSelectionRef.current

      if (!activeDragSelection || !svgRef.current) {
        return
      }

      const rect = svgRef.current.getBoundingClientRect()
      const nextSelection = { ...activeDragSelection, currentX: chartXFromClientX(event.clientX, rect, chartLayout) }
      dragSelectionRef.current = nextSelection
      setDragSelection(nextSelection)
    }

    const handleWindowMouseUp = () => {
      commitZoomSelection()
    }

    windowDragMoveHandlerRef.current = handleWindowMouseMove
    windowDragUpHandlerRef.current = handleWindowMouseUp
    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
  }

  function detachWindowDragListeners() {
    if (windowDragMoveHandlerRef.current) {
      window.removeEventListener('mousemove', windowDragMoveHandlerRef.current)
      windowDragMoveHandlerRef.current = null
    }

    if (windowDragUpHandlerRef.current) {
      window.removeEventListener('mouseup', windowDragUpHandlerRef.current)
      windowDragUpHandlerRef.current = null
    }
  }

  return (
    <section className="panel chart-panel-full" style={{ gridColumn: 'span 12', minHeight: '320px' }}>
      <div className="chart-header">
        <div>
          <strong>{payload.title}</strong>
          <p className="muted chart-subtitle">{visibleRangeLabel}</p>
          {chartValueContext ? <p className="muted chart-value-context">{chartValueContext}</p> : null}
        </div>
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
          {zoomRange ? (
            <button type="button" className="chart-reset-button" onClick={() => setZoomRange(null)}>{resetZoomLabel}</button>
          ) : null}
        </div>
      </div>

      {accuracyPresentationMode === 'historical-forecast' && historicalForecastState === 'loading' ? (
        <div className="chart-layer-status" role="status" aria-live="polite">
          <strong>{locale === 'pl' ? 'Ładowanie warstwy historycznej prognozy' : 'Loading historical forecast layer'}</strong>
          <span>{locale === 'pl' ? 'Główny wykres pozostaje dostępny podczas przygotowania porównania.' : 'The main chart remains available while the comparison layer is prepared.'}</span>
        </div>
      ) : null}

      {accuracyPresentationMode === 'historical-forecast' && historicalForecastMessage ? (
        <div className={`chart-layer-status${historicalForecastState === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
          <strong>{historicalForecastState === 'error' ? (locale === 'pl' ? 'Warstwa historycznej prognozy jest chwilowo niedostępna' : 'Historical forecast layer is temporarily unavailable') : historicalForecastLabel}</strong>
          <span>{historicalForecastMessage}</span>
        </div>
      ) : null}

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
            if (suppressSurfaceClickRef.current) {
              suppressSurfaceClickRef.current = false
              return
            }

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
            hideTooltipTimeoutRef.current = setTimeout(() => setActivePoint(null), TOOLTIP_HIDE_DELAY_MS)
          }}
        >
        <line x1={chartLayout.paddingLeft} y1={chartLayout.height - chartLayout.paddingBottom} x2={chartLayout.width - chartLayout.paddingRight} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-axis" />
        <line x1={chartLayout.paddingLeft} y1={chartLayout.paddingTop} x2={chartLayout.paddingLeft} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-axis" />

        {tooltipAnchorPoint ? (
          <g className="chart-crosshair">
            <line x1={tooltipAnchorPoint.x} y1={chartLayout.paddingTop} x2={tooltipAnchorPoint.x} y2={chartLayout.height - chartLayout.paddingBottom} className="chart-crosshair-line is-vertical" />
            <line x1={chartLayout.paddingLeft} y1={tooltipAnchorPoint.pointY} x2={chartLayout.width - chartLayout.paddingRight} y2={tooltipAnchorPoint.pointY} className="chart-crosshair-line is-horizontal" />
            <line
              x1={tooltipAnchorPoint.x}
              y1={tooltipAnchorPoint.pointY}
              x2={tooltipAnchorPoint.x + ((tooltipPosition?.placement.endsWith('right') ?? true) ? TOOLTIP_OFFSET - 4 : -(TOOLTIP_OFFSET - 4))}
              y2={tooltipAnchorPoint.pointY + ((tooltipPosition?.placement.startsWith('bottom') ?? false) ? TOOLTIP_OFFSET - 4 : -(TOOLTIP_OFFSET - 4))}
              className="chart-crosshair-line is-leader"
            />
          </g>
        ) : null}

        {yTicks.map((tick) => {
          const y = pointY(typeof tick.value === 'number' ? tick.value : Number(tick.value))

          return (
            <g key={`y-${tick.offset}`}>
              <line x1={chartLayout.paddingLeft} y1={y} x2={chartLayout.width - chartLayout.paddingRight} y2={y} className="chart-grid" />
              <text x={chartLayout.paddingLeft - 14} y={y + 4} textAnchor="end" className="chart-tick-label">{tick.label}</text>
            </g>
          )
        })}

        {xTicks.map((tick) => {
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

        {visibleSeries.map((entry, index) => {
          const polyline = buildPolylinePoints(entry.points, minimum, maximum, pointX, chartLayout)

          return (
            <g key={entry.id} className="chart-series-layer" style={{ animationDelay: `${index * 60}ms` }}>
              {polyline ? <polyline points={polyline} className={`chart-line ${legendClass(entry.kind)}`} /> : null}
              {entry.points.filter((point) => point.value !== null).map((point) => {
                const isSelected = isSelectedSeriesPoint(point, entry.kind)
                const isHovered = isHoveredSeriesPoint(point)
                const showMarker = point.anchor || activePoint?.key === point.key || isSelected

                return (
                  <g key={point.key}>
                    <circle
                      cx={pointX(point.date)}
                      cy={pointY(point.value)}
                      r={13}
                      className="chart-hit-area"
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseEnter={() => handlePointEnter(point)}
                      onMouseLeave={() => handlePointLeave(point.key)}
                      onFocus={() => handlePointEnter(point)}
                      onBlur={() => handlePointLeave(point.key)}
                      onClick={(event) => {
                        event.stopPropagation()
                        pinSurface(point, entry.kind)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          pinSurface(point, entry.kind)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${formatSeriesLabel(locale, entry.kind)} ${formatDate(locale, point.date)} ${formatPrimaryValue(locale, point.value, point.detailModel.unit, point.detailModel.currency)}`}
                    />
                    {isHovered ? (
                      <circle
                        cx={pointX(point.date)}
                        cy={pointY(point.value)}
                        r={7.5}
                        className={`chart-hover-ring ${legendClass(entry.kind)}`}
                      />
                    ) : null}
                    {isSelected ? (
                      <circle
                        cx={pointX(point.date)}
                        cy={pointY(point.value)}
                        r={10}
                        className={`chart-selection-ring ${legendClass(entry.kind)}`}
                      />
                    ) : null}
                    {showMarker ? (
                      <circle
                        cx={pointX(point.date)}
                        cy={pointY(point.value)}
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
        {accuracyPresentationMode === 'historical-forecast' && historicalForecastDeltaSegments.map((segment, index) => {
          const areaPoints = segment.points
            .map((point) => `${pointX(point.date)},${pointY(point.value)}`)
            .join(' ')

          return (
            <polygon
              key={`historical-forecast-delta-${segment.sign}-${index}`}
              points={areaPoints}
              className={`chart-historical-forecast-delta is-${segment.sign}`}
            />
          )
        })}
        {accuracyPresentationMode === 'historical-forecast' && historicalForecastLineSegments.map((segment, index) => {
          const polyline = segment.points
            .map((point) => `${pointX(point.date)},${pointY(point.forecastValue)}`)
            .join(' ')

          return (
            <polyline
              key={`historical-forecast-line-${index}`}
              points={polyline}
              className="chart-line historical-forecast"
            />
          )
        })}
        {accuracyPresentationMode === 'historical-forecast' && visibleHistoricalForecastPoints.length > 0 ? (
          <g className="chart-historical-forecast-layer">
            <path
              d={(() => {
                const values = visibleHistoricalForecastPoints
                if (values.length === 0) {
                  return ''
                }

                const first = values[0]
                return `M ${pointX(first.date)} ${chartLayout.paddingTop} L ${pointX(first.date)} ${chartLayout.height - chartLayout.paddingBottom}`
              })()}
              className="chart-historical-forecast-helper"
            />
            <rect
              x={chartLayout.paddingLeft}
              y={chartLayout.paddingTop}
              width={chartLayout.width - chartLayout.paddingLeft - chartLayout.paddingRight}
              height={chartLayout.height - chartLayout.paddingTop - chartLayout.paddingBottom}
              className="chart-hit-area chart-hit-area-historical-forecast"
              onMouseMove={(event) => {
                if (event.buttons === 1) {
                  handleChartMouseMove(event)
                  return
                }

                const forecastPoint = resolveForecastPointFromEvent(event)

                if (forecastPoint) {
                  handlePointEnter(forecastPoint.point)
                  return
                }

                const surface = resolveNearestHistoricalForecastSurface(event, visibleHistoricalForecastPoints)

                if (surface) {
                  handleHistoricalForecastEnter(surface)
                }
              }}
              onMouseLeave={() => handleTooltipSurfaceLeave(selectedSurfaceVariant === 'historical-forecast' && selectedSurface ? selectedSurface.key : 'historical-forecast-layer')}
              onClick={(event) => {
                event.stopPropagation()

                if (suppressSurfaceClickRef.current) {
                  suppressSurfaceClickRef.current = false
                  return
                }

                const forecastPoint = resolveForecastPointFromEvent(event)

                if (forecastPoint) {
                  pinSurface(forecastPoint.point, forecastPoint.entry.kind)
                  return
                }

                const surface = resolveNearestHistoricalForecastSurface(event, visibleHistoricalForecastPoints)

                if (surface) {
                  activateHistoricalForecastSurface(surface)
                }
              }}
              onMouseDown={handleChartMouseDown}
              onMouseUp={commitZoomSelection}
              role="button"
              tabIndex={0}
              aria-label={historicalForecastLabel}
            />
          </g>
        ) : null}
        {accuracyPresentationMode === 'historical-forecast' && visibleSeries
          .filter((entry) => entry.kind === 'historical')
          .flatMap((entry) => entry.points.filter((point) => point.value !== null).map((point) => ({ entry, point })))
          .map(({ entry, point }) => (
            <circle
              key={`historical-overlay-hit-${point.key}`}
              cx={pointX(point.date)}
              cy={pointY(point.value)}
              r={8}
              className="chart-hit-area"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseEnter={() => handlePointEnter(point)}
              onMouseLeave={() => handlePointLeave(point.key)}
              onClick={(event) => {
                event.stopPropagation()
                pinSurface(point, entry.kind)
              }}
            />
          ))}
        {accuracyPresentationMode === 'historical-forecast' && visibleHistoricalForecastPoints.map((point) => {
          const surface = toHistoricalForecastSurface(
            locale,
            point,
            payload?.title ?? point.key,
            historicalForecastComparison!.horizonMonths,
          )
          const isSelected = selectedSurfaceVariant === 'historical-forecast' && pinnedSurfaceKey === surface.key
          const isHovered = !isSelected && activeTooltip?.key === surface.key
          const showMarker = isSelected || isHovered

          return (
            <g key={`historical-forecast-point-${surface.key}`}>
              <circle
                cx={pointX(point.date)}
                cy={pointY(point.forecastValue)}
                r={13}
                className="chart-hit-area chart-hit-area-historical-forecast"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={() => handleHistoricalForecastEnter(surface)}
                onMouseLeave={() => handleTooltipSurfaceLeave(surface.key)}
                onFocus={() => handleHistoricalForecastEnter(surface)}
                onBlur={() => handleTooltipSurfaceLeave(surface.key)}
                onClick={(event) => {
                  event.stopPropagation()
                  activateHistoricalForecastSurface(surface)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activateHistoricalForecastSurface(surface)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${historicalForecastLabel} ${formatDate(locale, point.date)} ${formatPrimaryValue(locale, point.forecastValue, payload.unit, payload.currency)}`}
              />
              {isHovered ? (
                <circle
                  cx={pointX(point.date)}
                  cy={pointY(point.forecastValue)}
                  r={7.5}
                  className="chart-hover-ring historical-forecast"
                />
              ) : null}
              {isSelected ? (
                <circle
                  cx={pointX(point.date)}
                  cy={pointY(point.forecastValue)}
                  r={10}
                  className="chart-selection-ring historical-forecast"
                />
              ) : null}
              {showMarker ? (
                <circle
                  cx={pointX(point.date)}
                  cy={pointY(point.forecastValue)}
                  r={3.25}
                  className={`chart-point historical-forecast${isSelected ? ' is-selected' : ''}`}
                />
              ) : null}
            </g>
          )
        })}
        {accuracyPresentationMode === 'historical-forecast' && visibleSeries
          .filter((entry) => entry.kind !== 'historical')
          .flatMap((entry) => entry.points.filter((point) => point.value !== null).map((point) => ({ entry, point })))
          .map(({ entry, point }) => (
            <circle
              key={`forecast-overlay-hit-${point.key}`}
              cx={pointX(point.date)}
              cy={pointY(point.value)}
              r={13}
              className={`chart-hit-area chart-hit-area-forecast-overlay ${entry.kind}`}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => {
                event.stopPropagation()

                if (!event.isPrimary || event.button !== 0) {
                  return
                }

                handledSurfaceMouseDownKeyRef.current = point.key
                pinSurface(point, entry.kind)
              }}
              onMouseEnter={() => handlePointEnter(point)}
              onMouseLeave={() => handlePointLeave(point.key)}
              onFocus={() => handlePointEnter(point)}
              onBlur={() => handlePointLeave(point.key)}
              onClick={(event) => {
                event.stopPropagation()

                if (handledSurfaceMouseDownKeyRef.current === point.key) {
                  handledSurfaceMouseDownKeyRef.current = null
                  return
                }

                pinSurface(point, entry.kind)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  pinSurface(point, entry.kind)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${formatSeriesLabel(locale, entry.kind)} ${formatDate(locale, point.date)} ${formatPrimaryValue(locale, point.value, point.detailModel.unit, point.detailModel.currency)}`}
            />
          ))}
        {accuracyMarkers.map((marker) => {
          const axisY = chartLayout.height - chartLayout.paddingBottom
          const unclampedMarkerY = pointY(marker.value) + (marker.diff >= 0 ? -16 : 18)
          const markerY = Math.max(
            chartLayout.paddingTop + ACCURACY_MARKER_TOP_CLEARANCE,
            Math.min(unclampedMarkerY, axisY - ACCURACY_MARKER_AXIS_CLEARANCE),
          )
          const isSelected = selectedSurfaceVariant === 'forecast-accuracy' && pinnedSurfaceKey === marker.key
          const isArmed = armedAccuracyKey === marker.key || activeTooltip?.key === marker.key || isSelected

          return (
            <g key={marker.key} className={`chart-accuracy-layer${isArmed ? ' is-armed' : ''}`}>
              <circle
                cx={pointX(marker.date)}
                cy={markerY - 2}
                r={22}
                className="chart-hit-area chart-hit-area-accuracy"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={() => armAccuracyMarker(marker)}
                onMouseLeave={() => handleTooltipSurfaceLeave(marker.key)}
                onFocus={() => armAccuracyMarker(marker)}
                onBlur={() => handleTooltipSurfaceLeave(marker.key)}
                onClick={(event) => {
                  event.stopPropagation()
                  activateAccuracyMarker(marker)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activateAccuracyMarker(marker)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${formatSeriesLabel(locale, 'forecast-accuracy')} ${formatDate(locale, marker.date)} ${formatSignedDiff(locale, marker.diff)}`}
              />
              {isSelected ? (
                <circle
                  cx={pointX(marker.date)}
                  cy={markerY - 2}
                  r={12}
                  className={`chart-selection-ring forecast-accuracy ${marker.diff >= 0 ? 'is-positive' : 'is-negative'}`}
                />
              ) : null}
              <text
                x={pointX(marker.date)}
                y={markerY}
                textAnchor="middle"
                className={`chart-accuracy-marker ${marker.diff >= 0 ? 'is-positive' : 'is-negative'}${isArmed ? ' is-armed' : ''}`}
              >
                {marker.diff >= 0 ? '↑' : '↓'}
              </text>
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

        {!chartLayout.isTouch && !useCompactTooltipRail && displayTooltip && tooltipCard ? (
          <div
            ref={tooltipRef}
            className={`chart-tooltip${tooltipPosition ? ` is-${tooltipPosition.placement}` : ''}${tooltipVariant ? ` ${tooltipVariantClass(tooltipVariant)}` : ''}`}
            onMouseEnter={clearHideTimeout}
            onMouseLeave={() => handleTooltipSurfaceLeave(displayTooltip.key)}
            style={{
              left: tooltipPosition ? `${tooltipPosition.left}px` : '-999px',
              top: tooltipPosition ? `${tooltipPosition.top}px` : '-999px',
            }}
          >
            {isTooltipPinned ? <div className="chart-tooltip-status">{pinnedTooltipLabel}</div> : null}
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
                    <div key={`${displayTooltip.key}-detail-${row.label}`} className="tooltip-row">
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
                    <span key={`${displayTooltip.key}-${line}`}>{line}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {chartLayout.isTouch || useCompactTooltipRail ? (
        <div className={`chart-tooltip-mobile-wrap${displayTooltip && tooltipCard ? ' is-active' : ' is-reserved'}`}>
          {displayTooltip && tooltipCard ? (
          <div ref={tooltipRef} className={`chart-tooltip${tooltipVariant ? ` ${tooltipVariantClass(tooltipVariant)}` : ''}`}>
            {isTooltipPinned ? <div className="chart-tooltip-status">{pinnedTooltipLabel}</div> : null}
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
                    <div key={`${displayTooltip.key}-mobile-detail-${row.label}`} className="tooltip-row">
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
                    <span key={`${displayTooltip.key}-mobile-${line}`}>{line}</span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          ) : null}
        </div>
      ) : null}

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
                <i className={`legend-swatch legend-${legendClass(entry.kind)}`} />
                {entry.label}
              </button>
            )
          })}
          {accuracyPresentationMode === 'percentage-arrows' ? (
            <button
              type="button"
              className={`chart-legend-button${hiddenItems.includes('forecast-accuracy') ? ' is-muted' : ''}`}
              aria-pressed={!hiddenItems.includes('forecast-accuracy')}
              onClick={() => toggleVisibility('forecast-accuracy')}
            >
              <i className="legend-accuracy-icon">↑</i>
              {forecastAccuracyLabel}
            </button>
          ) : null}
          {accuracyPresentationMode === 'historical-forecast' ? (
            <button
              type="button"
              className={`chart-legend-button${hiddenItems.includes('historical-forecast') ? ' is-muted' : ''}`}
              aria-pressed={!hiddenItems.includes('historical-forecast')}
              onClick={() => toggleVisibility('historical-forecast')}
            >
              <i className="legend-swatch legend-historical-forecast" />
              {historicalForecastLabel}
            </button>
          ) : null}
        </div>

        <div className="source-legend">
          <div className="source-primary">
            <p className="muted source-description">{sourceLine}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function RawDataView() {
  const locale = useLocale() as Locale
  const t = useTranslations('RawDataView')
  const pathname = usePathname()
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
  const [showForecast, setShowForecast] = useState(false)
  const [accuracyPresentationMode, setAccuracyPresentationMode] = useState<AccuracyPresentationMode>('off')
  const [historicalForecastState, setHistoricalForecastState] = useState<HistoricalForecastLayerState>('idle')
  const [historicalForecastMessage, setHistoricalForecastMessage] = useState<string | null>(null)
  const [historicalForecastHorizon, setHistoricalForecastHorizon] = useState<ForecastAccuracyHorizonMonths | null>(null)
  const [historicalForecastAvailableHorizons, setHistoricalForecastAvailableHorizons] = useState<ForecastAccuracyHorizonMonths[]>([])
  const [historicalForecastResponse, setHistoricalForecastResponse] = useState<ForecastAccuracyResponse | null>(null)
  const [historicalForecastReloadNonce, setHistoricalForecastReloadNonce] = useState(0)
  const [isHorizonInfoOpen, setIsHorizonInfoOpen] = useState(false)
  const [series, setSeries] = useState<SeriesResponse | null>(null)
  const [viewerPayload, setViewerPayload] = useState<TimeSeriesViewerPayload | null>(null)
  const seriesAbortRef = useRef<AbortController | null>(null)
  const seriesCacheRef = useRef<Map<string, CachedSeriesEntry>>(new Map())
  const historicalForecastCacheRef = useRef<Map<string, CachedForecastAccuracyEntry>>(new Map())
  const historicalForecastPendingRequestsRef = useRef<Map<string, Promise<ForecastAccuracyResponse>>>(new Map())
  const horizonInfoRef = useRef<HTMLDivElement | null>(null)
  const horizonInfoId = useId()

  const selectedComponent = components.find((item) => item.componentName === selectedComponentName) ?? null
  const showForecastAccuracy = accuracyPresentationMode !== 'off'
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

  function retryLoad() {
    setErrorMessage(null)
    setReloadNonce((current) => current + 1)
  }

  function retryHistoricalForecast() {
    setHistoricalForecastMessage(null)
    setHistoricalForecastState('idle')
    setHistoricalForecastResponse(null)
    setHistoricalForecastReloadNonce((current) => current + 1)
  }

  useEffect(() => {
    if (accuracyPresentationMode !== 'historical-forecast') {
      setIsHorizonInfoOpen(false)
    }
  }, [accuracyPresentationMode])

  useEffect(() => {
    if (!isHorizonInfoOpen) {
      return
    }

    function handleWindowPointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (horizonInfoRef.current?.contains(target)) {
        return
      }

      setIsHorizonInfoOpen(false)
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsHorizonInfoOpen(false)
      }
    }

    window.addEventListener('pointerdown', handleWindowPointerDown)
    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown)
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [isHorizonInfoOpen])

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
  }, [locale, t, reloadNonce])

  useEffect(() => {
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
    setHistoricalForecastAvailableHorizons([])
    setHistoricalForecastResponse(null)
    setHistoricalForecastMessage(null)
    setHistoricalForecastState('idle')
  }, [selectedComponentName])

  useEffect(() => {
    setHistoricalForecastAvailableHorizons([])
    setHistoricalForecastResponse(null)
    setHistoricalForecastMessage(null)
    setHistoricalForecastState('idle')
  }, [effectiveComponentCode, locale])

  useEffect(() => {
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
  }, [benchmarkRequired, effectiveComponentCode, locale, selectedComponent?.availableBenchmarks, selectedComponentName, showForecast, t, reloadNonce])

  useEffect(() => {
    if (accuracyPresentationMode !== 'historical-forecast' || benchmarkRequired || !effectiveComponentCode || !selectedComponentName) {
      if (accuracyPresentationMode !== 'historical-forecast') {
        setHistoricalForecastState((current) => current === 'unavailable' ? current : 'idle')
      }

      return
    }

    let cancelled = false

    if (
      historicalForecastResponse
      && historicalForecastResponse.selection.benchmarkCode === effectiveComponentCode
      && historicalForecastHorizon !== null
      && historicalForecastResponse.selection.horizonMonths === historicalForecastHorizon
      && historicalForecastAvailableHorizons.length > 0
    ) {
      return () => {
        cancelled = true
      }
    }

    async function fetchForecastAccuracy(nextHorizon: ForecastAccuracyHorizonMonths | null) {
      const params = new URLSearchParams({
        locale,
        componentName: selectedComponentName,
        componentCode: effectiveComponentCode,
      })

      if (nextHorizon !== null) {
        params.set('horizonMonths', String(nextHorizon))
      }

      const cacheKey = buildForecastAccuracyCacheKey({
        locale,
        organizationId: null,
        benchmarkCode: effectiveComponentCode,
        horizonMonths: nextHorizon,
        dateFrom: null,
        dateTo: null,
      })
      const cached = historicalForecastCacheRef.current.get(cacheKey)

      if (cached && Date.now() - cached.cachedAt <= CLIENT_SERIES_CACHE_TTL_MS) {
        return cached.response
      }

      const pendingRequest = historicalForecastPendingRequestsRef.current.get(cacheKey)

      if (pendingRequest) {
        return pendingRequest
      }

      const nextRequest = (async () => {
        const response = await fetch(`/api/forecast-accuracy?${params.toString()}`, {
          cache: 'no-store',
        })
        const payload = await response.json() as ForecastAccuracyResponse | ForecastAccuracyErrorResponse

        if (!response.ok) {
          if (isForecastAccuracyErrorResponse(payload)) {
            const error = new Error(payload.error.message)
            ;(error as Error & { code?: string }).code = payload.error.code
            throw error
          }

          throw new Error(t('errors.series'))
        }

        const nextResponse = payload as ForecastAccuracyResponse
        historicalForecastCacheRef.current.set(cacheKey, {
          response: nextResponse,
          cachedAt: Date.now(),
        })
        return nextResponse
      })()

      historicalForecastPendingRequestsRef.current.set(cacheKey, nextRequest)

      try {
        return await nextRequest
      } finally {
        historicalForecastPendingRequestsRef.current.delete(cacheKey)
      }
    }

    async function loadHistoricalForecast() {
      try {
        setHistoricalForecastState('loading')
        setHistoricalForecastMessage(null)

        const discovery = await fetchForecastAccuracy(null)

        if (cancelled) {
          return
        }

        const resolvedHorizon = selectPreferredAccuracyHorizon(
          discovery.availableHorizons,
          historicalForecastHorizon,
        )

        setHistoricalForecastAvailableHorizons(discovery.availableHorizons)

        if (resolvedHorizon === null) {
          setHistoricalForecastResponse(null)
          setHistoricalForecastState('unavailable')
          setHistoricalForecastMessage(t('historicalForecastUnavailableHint'))
          return
        }

        if (historicalForecastHorizon !== resolvedHorizon) {
          setHistoricalForecastHorizon(resolvedHorizon)
          setHistoricalForecastState('idle')
          return
        }

        const nextResponse = await fetchForecastAccuracy(resolvedHorizon)

        if (cancelled) {
          return
        }

        setHistoricalForecastResponse(nextResponse)
        setHistoricalForecastState('ready')
      } catch (error) {
        if ((error as Error).name === 'AbortError' || cancelled) {
          return
        }

        const code = (error as Error & { code?: string }).code

        if (code === 'NO_ACCURACY_DATA') {
          setHistoricalForecastAvailableHorizons([])
          setHistoricalForecastResponse(null)
          setHistoricalForecastState('unavailable')
          setHistoricalForecastMessage(t('historicalForecastUnavailableHint'))
          return
        }

        setHistoricalForecastResponse(null)
        setHistoricalForecastState('error')
        setHistoricalForecastMessage(t('historicalForecastErrorHint'))
      }
    }

    void loadHistoricalForecast()

    return () => {
      cancelled = true
    }
  }, [accuracyPresentationMode, benchmarkRequired, effectiveComponentCode, historicalForecastHorizon, historicalForecastReloadNonce, locale, selectedComponentName])

  return (
    <div className="shell-grid">
      <section className="panel filter-panel" style={{ gridColumn: 'span 12' }}>
        <div className="filters-topbar">
          <div>
            <strong>{t('workspaceTitle')}</strong>
            <p className="muted filters-subtitle">{t('workspaceSubtitle')}</p>
          </div>

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

        <div className="filter-grid">
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
            <label className="control-check">
              <input type="checkbox" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} />
              <span>{t('showForecast')}</span>
            </label>

            <label className="control-check">
              <input
                type="checkbox"
                checked={showForecastAccuracy}
                onChange={(event) => setAccuracyPresentationMode(event.target.checked ? 'percentage-arrows' : 'off')}
              />
              <span>{t('showForecastAccuracy')}</span>
            </label>
          </div>

          {showForecastAccuracy ? (
            <div className="control-stack control-stack-accuracy">
              <div className={`accuracy-controls-row${accuracyPresentationMode === 'historical-forecast' && historicalForecastAvailableHorizons.length > 0 ? ' accuracy-controls-row-historical-forecast' : ''}`}>
                <div className="control-block control-segmented-block">
                  <span>{t('accuracyPresentationMode')}</span>
                  <div className="segmented-control" role="tablist" aria-label={t('accuracyPresentationMode')}>
                    <button
                      type="button"
                      className={`segmented-control-button${accuracyPresentationMode === 'percentage-arrows' ? ' is-active' : ''}`}
                      aria-pressed={accuracyPresentationMode === 'percentage-arrows'}
                      onClick={() => setAccuracyPresentationMode('percentage-arrows')}
                    >
                      {t('accuracyModes.percentageArrows')}
                    </button>
                    <button
                      type="button"
                      className={`segmented-control-button${accuracyPresentationMode === 'historical-forecast' ? ' is-active' : ''}${historicalForecastState === 'unavailable' ? ' is-unavailable' : ''}`}
                      aria-pressed={accuracyPresentationMode === 'historical-forecast'}
                      aria-disabled={historicalForecastState === 'unavailable'}
                      onClick={() => setAccuracyPresentationMode('historical-forecast')}
                    >
                      {t('accuracyModes.historicalForecast')}
                    </button>
                  </div>
                </div>

                {accuracyPresentationMode === 'historical-forecast' && historicalForecastAvailableHorizons.length > 0 ? (
                  <div className="control-block control-segmented-block control-segmented-block-tight">
                    <div className="control-label-inline">
                      <span>{t('forecastHorizon')}</span>
                      <div
                        ref={horizonInfoRef}
                        className={`inline-info${isHorizonInfoOpen ? ' is-open' : ''}`}
                        onMouseEnter={() => setIsHorizonInfoOpen(true)}
                        onMouseLeave={() => setIsHorizonInfoOpen(false)}
                        onBlurCapture={(event) => {
                          const nextTarget = event.relatedTarget as Node | null

                          if (!event.currentTarget.contains(nextTarget)) {
                            setIsHorizonInfoOpen(false)
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="inline-info-button"
                          aria-label={t('forecastHorizonInfoButton')}
                          aria-expanded={isHorizonInfoOpen}
                          aria-controls={horizonInfoId}
                          onClick={() => setIsHorizonInfoOpen((current) => !current)}
                          onFocus={() => setIsHorizonInfoOpen(true)}
                        >
                          ⓘ
                        </button>
                        <div id={horizonInfoId} role="tooltip" className="inline-info-popover">
                          <strong>{t('forecastHorizonInfoTitle')}</strong>
                          <p>{t('forecastHorizonInfoBody')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="segmented-control segmented-control-horizon" role="tablist" aria-label={t('forecastHorizon')}>
                      {historicalForecastAvailableHorizons.map((horizon) => (
                        <button
                          key={horizon}
                          type="button"
                          className={`segmented-control-button${historicalForecastHorizon === horizon ? ' is-active' : ''}`}
                          aria-pressed={historicalForecastHorizon === horizon}
                          onClick={() => setHistoricalForecastHorizon(horizon)}
                        >
                          {horizon}M
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {accuracyPresentationMode === 'historical-forecast' && historicalForecastState === 'error' ? (
                <div className="callout callout-error" role="status" aria-live="polite">
                  <div>{historicalForecastMessage}</div>
                  <div className="callout-actions">
                    <button type="button" className="callout-button" onClick={retryHistoricalForecast}>{t('retry')}</button>
                  </div>
                </div>
              ) : null}

              {accuracyPresentationMode === 'historical-forecast' && historicalForecastState === 'unavailable' ? (
                <div className="callout" role="status" aria-live="polite">
                  <div>{historicalForecastMessage}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {benchmarkRequired ? <p className="callout">{t('benchmarkRequired')}</p> : null}
        {errorMessage ? (
          <div className="callout callout-error" role="status" aria-live="polite">
            <div>{errorMessage}</div>
            <div className="callout-actions">
              <button type="button" className="callout-button" onClick={retryLoad}>{t('retry')}</button>
            </div>
          </div>
        ) : null}
      </section>

      <ChartPanel
        locale={locale}
        payload={viewerPayload}
        emptyMessage={benchmarkRequired ? t('chartNeedsBenchmark') : t('chartEmpty')}
        isLoading={componentsState === 'loading' || seriesState === 'loading'}
        loadingTitle={t('loadingTitle')}
        loadingHint={t('loadingHint')}
        resetZoomLabel={t('resetZoom')}
        sourceLabel={t('sourceLabel')}
        accuracyPresentationMode={accuracyPresentationMode}
        forecastAccuracyLabel={t('forecastAccuracy')}
        historicalForecastLabel={t('accuracyModes.historicalForecast')}
        historicalForecastResponse={historicalForecastResponse}
        historicalForecastState={historicalForecastState}
        historicalForecastMessage={historicalForecastMessage}
        pinnedTooltipLabel={t('pinnedTooltipLabel')}
      />
    </div>
  )
}