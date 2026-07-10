'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'

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
type TooltipVariant = TimeSeriesViewerSeries['kind'] | 'forecast-accuracy'
type VisibilityKey = TooltipVariant

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type RangePreset = '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'
type VisibleRange = { start: string; end: string }
type DragSelection = { startX: number; currentX: number } | null
type TooltipSurface = { key: string; date: string; tooltipModel: TimeSeriesViewerTooltipModel; variant: TooltipVariant }
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
const RANGE_PRESETS: RangePreset[] = ['3M', '6M', '1Y', '3Y', '5Y', 'ALL']

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

function resolveTooltipPoint(surface: TooltipSurface | TimeSeriesViewerPoint, locale: Locale, payload: TimeSeriesViewerPayload) {
  if ('detailModel' in surface) {
    return {
      component: surface.detailModel.componentName,
      date: surface.detailModel.sourceDate,
      value: surface.value,
      primaryLabel: null,
      interval: surface.detailModel.scenarioType !== 'historical' && surface.detailModel.forecastLower !== null && surface.detailModel.forecastUpper !== null
        ? {
            label: locale === 'pl' ? 'Przedział prognozy' : 'Forecast interval',
            lowerValue: formatNumber(locale, surface.detailModel.forecastLower),
            upperValue: formatNumber(locale, surface.detailModel.forecastUpper),
          }
        : null,
      detailRows: [] as TooltipCardRow[],
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

function buildDateTicks(locale: Locale, dates: string[]) {
  if (dates.length === 0) {
    return []
  }

  const step = Math.max(1, Math.ceil(dates.length / 6))

  return dates
    .filter((_, index) => index % step === 0 || index === dates.length - 1)
    .map((date, index, items) => ({
      value: date,
      label: formatDate(locale, date).replace(/, /g, ' '),
      offset: items.length === 1 ? 0 : index / (items.length - 1),
    }))
}

function buildValueTicks(locale: Locale, values: number[]) {
  if (values.length === 0) {
    return []
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  if (minimum === maximum) {
    return [{ value: minimum, label: formatNumber(locale, minimum), offset: 0 }]
  }

  return Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
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

function clampChartX(value: number) {
  return Math.max(CHART_PADDING_LEFT, Math.min(CHART_WIDTH - CHART_PADDING_RIGHT, value))
}

function chartXFromClientX(clientX: number, rect: DOMRect) {
  const ratio = (clientX - rect.left) / rect.width
  return clampChartX(ratio * CHART_WIDTH)
}

function dateFromChartX(x: number, dates: string[]) {
  if (dates.length === 0) {
    return null
  }

  const ratio = (x - CHART_PADDING_LEFT) / (CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT)
  const index = Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1))))
  return dates[index] ?? null
}

function buildPolylinePoints(
  points: TimeSeriesViewerPoint[],
  minimum: number,
  maximum: number,
  pointX: (date: string) => number,
) {
  const validPoints = points.filter((point) => point.value !== null)

  if (validPoints.length === 0) {
    return ''
  }

  const range = maximum - minimum || 1

  return validPoints
    .map((point) => {
      const x = pointX(point.date)
      const y = CHART_HEIGHT - CHART_PADDING_BOTTOM - (((point.value ?? minimum) - minimum) / range) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)
      return `${x},${y}`
    })
    .join(' ')
}

function buildPlotGeometry(series: TimeSeriesViewerSeries[]) {
  const allDates = Array.from(new Set(series.flatMap((entry) => entry.points.map((point) => point.date))))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
  const allValues = series.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const minimum = allValues.length > 0 ? Math.min(...allValues) : 0
  const maximum = allValues.length > 0 ? Math.max(...allValues) : 1
  const dateIndex = new Map(allDates.map((date, index) => [date, index]))
  const dateDenominator = Math.max(allDates.length - 1, 1)
  const valueRange = maximum - minimum || 1

  function pointX(date: string) {
    return CHART_PADDING_LEFT + ((dateIndex.get(date) ?? 0) / dateDenominator) * (CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT)
  }

  function pointY(value: number | null) {
    return CHART_HEIGHT - CHART_PADDING_BOTTOM - (((value ?? minimum) - minimum) / valueRange) * (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM)
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
  resetZoomLabel,
  sourceLabel,
  showForecastAccuracy,
  forecastAccuracyLabel,
}: {
  locale: Locale
  payload: TimeSeriesViewerPayload | null
  emptyMessage: string
  isLoading: boolean
  resetZoomLabel: string
  sourceLabel: string
  showForecastAccuracy: boolean
  forecastAccuracyLabel: string
}) {
  const [activePoint, setActivePoint] = useState<TimeSeriesViewerPoint | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<TooltipSurface | null>(null)
  const [activePreset, setActivePreset] = useState<RangePreset>('ALL')
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<TimeSeriesViewerPoint | null>(null)
  const [zoomRange, setZoomRange] = useState<VisibleRange | null>(null)
  const [dragSelection, setDragSelection] = useState<DragSelection>(null)
  const [hiddenItems, setHiddenItems] = useState<VisibilityKey[]>([])
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number; placement: TooltipPlacement } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartSurfaceRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const hideTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActivePreset('ALL')
    setZoomRange(null)
    setSelectedPointKey(null)
    setSelectedPoint(null)
    setActivePoint(null)
    setActiveTooltip(null)
    setHiddenItems([])
    setTooltipPosition(null)
  }, [payload?.benchmarkCode, payload?.title])

  useEffect(() => {
    return () => {
      if (hideTooltipTimeoutRef.current) {
        clearTimeout(hideTooltipTimeoutRef.current)
      }
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
      setSelectedPointKey(null)
      setSelectedPoint(null)
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [])

  useEffect(() => {
    if (isLoading || !payload || payload.series.every((entry) => entry.points.length === 0)) {
      setTooltipPosition(null)
      return
    }

    if (!tooltipRef.current || !chartSurfaceRef.current || !svgRef.current) {
      setTooltipPosition(null)
      return
    }

    const displayTooltip = activeTooltip ?? activePoint ?? selectedPoint

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
    const { pointX, pointY } = buildPlotGeometry(visibleSeries)
    const anchorX = pointX(displayTooltip.date)
    const anchorValue = ('detailModel' in displayTooltip || isAccuracySurface(displayTooltip)) ? displayTooltip.value : null
    const anchorY = pointY(anchorValue)
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const surfaceRect = chartSurfaceRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()
    const relativeAnchorX = svgRect.left - surfaceRect.left + (anchorX / CHART_WIDTH) * svgRect.width
    const relativeAnchorY = svgRect.top - surfaceRect.top + (anchorY / CHART_HEIGHT) * svgRect.height

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

    setTooltipPosition({
      left: clampedLeft,
      top: clampedTop,
      placement: selectedCandidate.placement,
    })
  }, [isLoading, payload, activeTooltip, activePoint, selectedPoint, hiddenItems, activePreset, zoomRange])

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
            <div className="chart-skeleton-trace chart-skeleton-trace-historical" />
            <div className="chart-skeleton-trace chart-skeleton-trace-forecast" />
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
  const { minimum, maximum, pointX, pointY } = buildPlotGeometry(visibleSeries)
  const xTicks = buildDateTicks(locale, visibleDates)
  const yTicks = buildValueTicks(locale, visibleValues)
  const accuracyMarkers = showForecastAccuracy && !hiddenItems.includes('forecast-accuracy')
    ? buildAccuracyMarkers(locale, visibleSeries, payload.benchmarkCode ?? payload.sourceInfo?.benchmarkCode ?? null)
    : []
  const displayTooltip = activeTooltip ?? activePoint ?? selectedPoint
  const tooltipVariant = displayTooltip ? resolveSurfaceVariant(displayTooltip) : null
  const tooltipCard = displayTooltip ? buildTooltipCardModel(locale, displayTooltip, payload) : null
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
          pointY: pointY(('detailModel' in displayTooltip || isAccuracySurface(displayTooltip)) ? displayTooltip.value : null),
          tooltipY: pointY(('detailModel' in displayTooltip || isAccuracySurface(displayTooltip)) ? displayTooltip.value : null),
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

  function handlePointEnter(point: TimeSeriesViewerPoint) {
    clearHideTimeout()
    setActivePoint(point)
    setActiveTooltip(null)
  }

  function handlePointLeave(pointKey: string) {
    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActivePoint((current) => current?.key === pointKey ? null : current)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function handleTooltipSurfaceEnter(surface: TooltipSurface) {
    clearHideTimeout()
    setActivePoint(null)
    setActiveTooltip(surface)
  }

  function handleTooltipSurfaceLeave(surfaceKey: string) {
    clearHideTimeout()
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip((current) => current?.key === surfaceKey ? null : current)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  function handleRangePreset(preset: RangePreset) {
    setActivePreset(preset)
    setZoomRange(null)
  }

  function handleChartMouseDown(event: React.MouseEvent<SVGSVGElement>) {
    if (event.button !== 0 || visibleDates.length < 2 || !svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    const startX = chartXFromClientX(event.clientX, rect)
    setDragSelection({ startX, currentX: startX })
  }

  function handleChartMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!dragSelection || !svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    setDragSelection({ ...dragSelection, currentX: chartXFromClientX(event.clientX, rect) })
  }

  function commitZoomSelection() {
    if (!dragSelection || visibleDates.length < 2) {
      setDragSelection(null)
      return
    }

    const startX = Math.min(dragSelection.startX, dragSelection.currentX)
    const endX = Math.max(dragSelection.startX, dragSelection.currentX)

    if (endX - startX < 12) {
      setDragSelection(null)
      return
    }

    const startDate = dateFromChartX(startX, visibleDates)
    const endDate = dateFromChartX(endX, visibleDates)

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

      <div ref={chartSurfaceRef} className="chart-surface">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="chart-svg"
          role="img"
          aria-label="Time series chart"
          onMouseDown={handleChartMouseDown}
          onMouseMove={handleChartMouseMove}
          onMouseUp={commitZoomSelection}
          onMouseLeave={() => {
            commitZoomSelection()
            clearHideTimeout()
            hideTooltipTimeoutRef.current = setTimeout(() => setActivePoint(null), TOOLTIP_HIDE_DELAY_MS)
          }}
        >
        <line x1={CHART_PADDING_LEFT} y1={CHART_HEIGHT - CHART_PADDING_BOTTOM} x2={CHART_WIDTH - CHART_PADDING_RIGHT} y2={CHART_HEIGHT - CHART_PADDING_BOTTOM} className="chart-axis" />
        <line x1={CHART_PADDING_LEFT} y1={CHART_PADDING_TOP} x2={CHART_PADDING_LEFT} y2={CHART_HEIGHT - CHART_PADDING_BOTTOM} className="chart-axis" />

        {tooltipAnchorPoint ? (
          <g className="chart-crosshair">
            <line x1={tooltipAnchorPoint.x} y1={CHART_PADDING_TOP} x2={tooltipAnchorPoint.x} y2={CHART_HEIGHT - CHART_PADDING_BOTTOM} className="chart-crosshair-line is-vertical" />
            <line x1={CHART_PADDING_LEFT} y1={tooltipAnchorPoint.pointY} x2={CHART_WIDTH - CHART_PADDING_RIGHT} y2={tooltipAnchorPoint.pointY} className="chart-crosshair-line is-horizontal" />
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
              <line x1={CHART_PADDING_LEFT} y1={y} x2={CHART_WIDTH - CHART_PADDING_RIGHT} y2={y} className="chart-grid" />
              <text x={CHART_PADDING_LEFT - 14} y={y + 4} textAnchor="end" className="chart-tick-label">{tick.label}</text>
            </g>
          )
        })}

        {xTicks.map((tick) => {
          const x = CHART_PADDING_LEFT + tick.offset * (CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT)

          return (
            <g key={`x-${tick.offset}`}>
              <line x1={x} y1={CHART_HEIGHT - CHART_PADDING_BOTTOM} x2={x} y2={CHART_HEIGHT - CHART_PADDING_BOTTOM + 6} className="chart-axis" />
              <text x={x} y={CHART_HEIGHT - CHART_PADDING_BOTTOM + 18} textAnchor="middle" className="chart-tick-label">{tick.label}</text>
            </g>
          )
        })}

        {visibleSeries.map((entry, index) => {
          const polyline = buildPolylinePoints(entry.points, minimum, maximum, pointX)

          return (
            <g key={entry.id} className="chart-series-layer" style={{ animationDelay: `${index * 60}ms` }}>
              {polyline ? <polyline points={polyline} className={`chart-line ${legendClass(entry.kind)}`} /> : null}
              {entry.points.filter((point) => point.value !== null).map((point) => {
                const showMarker = point.anchor || activePoint?.key === point.key || selectedPointKey === point.key

                return (
                  <g key={point.key}>
                    <circle
                      cx={pointX(point.date)}
                      cy={pointY(point.value)}
                      r={13}
                      className="chart-hit-area"
                      onMouseEnter={() => handlePointEnter(point)}
                      onMouseLeave={() => handlePointLeave(point.key)}
                      onFocus={() => handlePointEnter(point)}
                      onBlur={() => handlePointLeave(point.key)}
                      onClick={() => {
                        setSelectedPointKey(point.key)
                        setSelectedPoint(point)
                        setActivePoint(point)
                        setActiveTooltip(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedPointKey(point.key)
                          setSelectedPoint(point)
                          setActivePoint(point)
                          setActiveTooltip(null)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${formatSeriesLabel(locale, entry.kind)} ${formatDate(locale, point.date)} ${formatPrimaryValue(locale, point.value, point.detailModel.unit, point.detailModel.currency)}`}
                    />
                    {showMarker ? (
                      <circle
                        cx={pointX(point.date)}
                        cy={pointY(point.value)}
                        r={point.anchor ? 4.5 : 3}
                        className={`chart-point ${legendClass(entry.kind)}${point.anchor ? ' is-anchor' : ''}${selectedPointKey === point.key ? ' is-selected' : ''}`}
                      />
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
        {accuracyMarkers.map((marker) => {
          const markerY = pointY(marker.value) + (marker.diff >= 0 ? -16 : 18)

          return (
            <g key={marker.key} className="chart-accuracy-layer">
              <circle
                cx={pointX(marker.date)}
                cy={markerY - 2}
                r={14}
                className="chart-hit-area"
                onMouseEnter={() => handleTooltipSurfaceEnter(marker)}
                onMouseLeave={() => handleTooltipSurfaceLeave(marker.key)}
                onFocus={() => handleTooltipSurfaceEnter(marker)}
                onBlur={() => handleTooltipSurfaceLeave(marker.key)}
                role="button"
                tabIndex={0}
                aria-label={`${formatSeriesLabel(locale, 'forecast-accuracy')} ${formatDate(locale, marker.date)} ${formatSignedDiff(locale, marker.diff)}`}
              />
              <text
                x={pointX(marker.date)}
                y={markerY}
                textAnchor="middle"
                className={`chart-accuracy-marker ${marker.diff >= 0 ? 'is-positive' : 'is-negative'}`}
              >
                {marker.diff >= 0 ? '↑' : '↓'}
              </text>
            </g>
          )
        })}
        {dragSelection ? (
          <rect
            x={Math.min(dragSelection.startX, dragSelection.currentX)}
            y={CHART_PADDING_TOP}
            width={Math.abs(dragSelection.currentX - dragSelection.startX)}
            height={CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM}
            className="chart-brush"
          />
        ) : null}
        </svg>

        {displayTooltip && tooltipCard ? (
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
                  <div>
                    <span>{locale === 'pl' ? 'Dolny' : 'Lower'}</span>
                    <strong>{tooltipCard.forecastInterval.lowerValue}</strong>
                  </div>
                  <div className="chart-tooltip-interval-arrow">↓</div>
                  <div>
                    <span>{locale === 'pl' ? 'Górny' : 'Upper'}</span>
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
          {showForecastAccuracy ? (
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
  const [componentsState, setComponentsState] = useState<LoadState>('idle')
  const [seriesState, setSeriesState] = useState<LoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [components, setComponents] = useState<ComponentListItem[]>([])
  const [selectedComponentName, setSelectedComponentName] = useState('')
  const [selectedComponentCode, setSelectedComponentCode] = useState('')
  const [componentSearch, setComponentSearch] = useState('')
  const [benchmarkSearch, setBenchmarkSearch] = useState('')
  const [showForecast, setShowForecast] = useState(false)
  const [showForecastAccuracy, setShowForecastAccuracy] = useState(false)
  const [series, setSeries] = useState<SeriesResponse | null>(null)
  const [viewerPayload, setViewerPayload] = useState<TimeSeriesViewerPayload | null>(null)

  const selectedComponent = components.find((item) => item.componentName === selectedComponentName) ?? null
  const benchmarkRequired = (selectedComponent?.benchmarkCount ?? 0) > 1 && selectedComponentCode.length === 0
  const effectiveComponentCode = selectedComponentCode || (selectedComponent?.benchmarkCount === 1 ? (selectedComponent.availableBenchmarks[0]?.componentCode ?? '') : '')
  const componentOptions: SearchableSelectOption[] = components.map((component) => ({
    value: component.componentName,
    label: component.componentName,
  }))
  const benchmarkOptions: SearchableSelectOption[] = (selectedComponent?.availableBenchmarks ?? []).map((benchmark) => ({
    value: benchmark.componentCode ?? '',
    label: benchmark.componentCode ?? t('benchmarkMissing'),
  }))

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
        setErrorMessage((error as Error).message)
      }
    }

    void loadComponents()

    return () => {
      cancelled = true
    }
  }, [locale, t])

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
  }, [selectedComponentName])

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
    const params = new URLSearchParams({
      locale,
      componentName: selectedComponentName,
      historyMonths: '24',
      showForecast: showForecast ? 'true' : 'false',
    })

    if (effectiveComponentCode) {
      params.set('componentCode', effectiveComponentCode)
    }

    async function loadData() {
      setSeriesState('loading')
      setErrorMessage(null)
      setSeries(null)
      setViewerPayload(null)

      try {
        const seriesResponse = await fetch(`/api/series?${params.toString()}`, { cache: 'no-store' })
        const seriesPayload = await seriesResponse.json() as SeriesResponse | { error?: string }

        if (!seriesResponse.ok) {
          throw new Error('error' in seriesPayload ? seriesPayload.error ?? t('errors.series') : t('errors.series'))
        }

        const nextSeries = seriesPayload as SeriesResponse
        const nextViewerPayload = toTimeSeriesViewerPayload(nextSeries, locale)

        if (cancelled) {
          return
        }

        setSeries(nextSeries)
        setViewerPayload(nextViewerPayload)
        setSeriesState('ready')
      } catch (error) {
        if (cancelled) {
          return
        }

        setSeriesState('error')
        setErrorMessage((error as Error).message)
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [benchmarkRequired, effectiveComponentCode, locale, selectedComponent?.availableBenchmarks, selectedComponentName, showForecast, t])

  return (
    <div className="shell-grid">
      <section className="panel" style={{ gridColumn: 'span 12' }}>
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

          <label className="control-check">
            <input type="checkbox" checked={showForecast} onChange={(event) => setShowForecast(event.target.checked)} />
            <span>{t('showForecast')}</span>
          </label>

          <label className="control-check">
            <input type="checkbox" checked={showForecastAccuracy} onChange={(event) => setShowForecastAccuracy(event.target.checked)} />
            <span>{t('showForecastAccuracy')}</span>
          </label>
        </div>

        <div className="status-row muted">
          <span>{t('componentCount', { count: components.length })}</span>
          {selectedComponent ? <span>{t('benchmarkCount', { count: selectedComponent.benchmarkCount })}</span> : null}
          <span>{componentsState === 'loading' || seriesState === 'loading' ? t('loading') : t('ready')}</span>
        </div>

        {benchmarkRequired ? <p className="callout">{t('benchmarkRequired')}</p> : null}
        {errorMessage ? <p className="callout callout-error">{errorMessage}</p> : null}
      </section>

      <ChartPanel
        locale={locale}
        payload={viewerPayload}
        emptyMessage={benchmarkRequired ? t('chartNeedsBenchmark') : t('chartEmpty')}
        isLoading={componentsState === 'loading' || seriesState === 'loading'}
        resetZoomLabel={t('resetZoom')}
        sourceLabel={t('sourceLabel')}
        showForecastAccuracy={showForecastAccuracy}
        forecastAccuracyLabel={t('forecastAccuracy')}
      />
    </div>
  )
}