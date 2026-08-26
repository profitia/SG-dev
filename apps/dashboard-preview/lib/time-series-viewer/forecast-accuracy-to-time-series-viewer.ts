import type {
  ForecastAccuracyHorizonMonths,
  ForecastAccuracyPoint,
  ForecastAccuracyResponse,
} from '@/lib/forecast-accuracy/forecast-accuracy-contract'

import type {
  TimeSeriesViewerAxisTick,
  TimeSeriesViewerDetailModel,
  TimeSeriesViewerLocale,
  TimeSeriesViewerPayload,
  TimeSeriesViewerPoint,
  TimeSeriesViewerSeries,
  TimeSeriesViewerSeriesKind,
  TimeSeriesViewerTooltipModel,
} from './time-series-viewer-contract'

function formatDate(locale: TimeSeriesViewerLocale, value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return ' - '
  }

  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', options ?? {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value))
}

function formatNumber(locale: TimeSeriesViewerLocale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)
}

function buildDateTicks(locale: TimeSeriesViewerLocale, values: string[]): TimeSeriesViewerAxisTick[] {
  if (values.length === 0) {
    return []
  }

  const step = Math.max(1, Math.ceil(values.length / 6))

  return values
    .filter((_, index) => index % step === 0 || index === values.length - 1)
    .map((date, index, items) => ({
      value: date,
      label: formatDate(locale, date, { month: 'short', year: '2-digit' }),
      offset: items.length === 1 ? 0 : index / (items.length - 1),
    }))
}

function buildValueTicks(locale: TimeSeriesViewerLocale, values: number[]): TimeSeriesViewerAxisTick[] {
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

function formatForecastLabel(locale: TimeSeriesViewerLocale, horizonMonths: ForecastAccuracyHorizonMonths | null) {
  const horizonLabel = horizonMonths ? `${horizonMonths}M` : ''

  if (locale === 'pl') {
    return horizonLabel ? `${horizonLabel} prognoza` : 'Prognoza historyczna'
  }

  return horizonLabel ? `${horizonLabel} forecast` : 'Historical forecast'
}

function formatHistoricalForecastLabel(locale: TimeSeriesViewerLocale) {
  return locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast'
}

function formatHistoricalForecastTooltipLabel(
  locale: TimeSeriesViewerLocale,
  horizonMonths: ForecastAccuracyHorizonMonths | null,
) {
  const baseLabel = formatHistoricalForecastLabel(locale)

  if (!horizonMonths) {
    return baseLabel
  }

  return `${baseLabel} (${horizonMonths}M)`
}

function buildTooltipModel(
  locale: TimeSeriesViewerLocale,
  componentName: string,
  point: ForecastAccuracyPoint,
  kind: TimeSeriesViewerSeriesKind,
  horizonMonths: ForecastAccuracyHorizonMonths | null,
): TimeSeriesViewerTooltipModel {
  const seriesLabel = kind === 'historical'
    ? (locale === 'pl' ? 'Wartość rzeczywista' : 'Actual')
    : kind === 'historical-forecast'
      ? formatHistoricalForecastTooltipLabel(locale, horizonMonths)
      : formatForecastLabel(locale, horizonMonths)

  return {
    title: `${componentName} · ${formatDate(locale, point.targetDate)}`,
    rows: [
      { label: locale === 'pl' ? 'Seria' : 'Series', value: seriesLabel },
      { label: locale === 'pl' ? 'Wartość' : 'Value', value: formatNumber(locale, kind === 'historical' ? point.actualValue : point.forecastValue) },
    ],
  }
}

function buildDetailModel(
  componentName: string,
  benchmarkCode: string,
  point: ForecastAccuracyPoint,
  kind: TimeSeriesViewerSeriesKind,
  sourceLabel: string | null,
): TimeSeriesViewerDetailModel {
  return {
    componentName,
    benchmarkCode,
    sourceDate: point.targetDate,
    temporalResolution: 'month',
    scenarioType: kind,
    value: kind === 'historical' ? point.actualValue : point.forecastValue,
    forecastLower: null,
    forecastUpper: null,
    forecastAccuracyDiff: null,
    description: sourceLabel,
    unit: null,
    currency: null,
    market: null,
    country: null,
    qualityStatus: null,
    sourceLabel,
    lastSyncedAt: null,
  }
}

function buildSeriesPoints(
  locale: TimeSeriesViewerLocale,
  points: ForecastAccuracyPoint[],
  componentName: string,
  benchmarkCode: string,
  kind: TimeSeriesViewerSeriesKind,
  horizonMonths: ForecastAccuracyHorizonMonths | null,
  sourceLabel: string | null,
): TimeSeriesViewerPoint[] {
  return points.map((point, index) => ({
    key: `${kind}-${point.targetDate}-${index}`,
    date: point.targetDate,
    value: kind === 'historical' ? point.actualValue : point.forecastValue,
    diff: null,
    recordId: `${kind}-${point.targetDate}`,
    anchor: false,
    tooltipModel: buildTooltipModel(locale, componentName, point, kind, horizonMonths),
    detailModel: buildDetailModel(componentName, benchmarkCode, point, kind, sourceLabel),
  }))
}

export function toForecastAccuracyViewerPayload(
  response: ForecastAccuracyResponse,
  locale: TimeSeriesViewerLocale,
): TimeSeriesViewerPayload {
  const componentName = response.selection.componentName ?? response.selection.benchmarkCode
  const sourceLabel = response.sourceInfo.sourceBusinessName ?? response.sourceInfo.sourceTableName ?? null
  const historicalSeriesPoints = buildSeriesPoints(
    locale,
    response.points,
    componentName,
    response.selection.benchmarkCode,
    'historical',
    response.selection.horizonMonths,
    sourceLabel,
  )

  const series: TimeSeriesViewerSeries[] = [
    {
      id: 'historical',
      kind: 'historical',
      label: locale === 'pl' ? 'Wartość rzeczywista' : 'Actual',
      lineStyle: 'solid',
      points: historicalSeriesPoints,
    },
    {
      id: 'historical-forecast',
      kind: 'historical-forecast',
      label: formatHistoricalForecastLabel(locale),
      lineStyle: 'dashed',
      points: buildSeriesPoints(
        locale,
        response.points,
        componentName,
        response.selection.benchmarkCode,
        'historical-forecast',
        response.selection.horizonMonths,
        sourceLabel,
      ),
    },
  ]

  const allDates = response.points.map((point) => point.targetDate)
  const allValues = series.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const defaultPoint = historicalSeriesPoints[historicalSeriesPoints.length - 1] ?? null

  return {
    title: componentName,
    subtitle: response.selection.benchmarkCode,
    locale,
    sourceInfo: {
      benchmarkCode: response.selection.benchmarkCode,
      description: sourceLabel,
      sourceLabel,
      unit: null,
      currency: null,
      market: null,
      country: null,
      qualityStatus: null,
      lastSyncedAt: response.sourceInfo.lastSyncedAt,
    },
    benchmarkCode: response.selection.benchmarkCode,
    description: sourceLabel,
    unit: null,
    currency: null,
    market: null,
    country: null,
    lastSyncedAt: response.sourceInfo.lastSyncedAt,
    xAxis: {
      type: 'time',
      labelFormat: 'MMM yy',
      ticks: buildDateTicks(locale, allDates),
    },
    yAxis: {
      type: 'value',
      unit: null,
      currency: null,
      ticks: buildValueTicks(locale, allValues),
    },
    series,
    forecastAnchor: null,
    forecastOrigin: null,
    deltaOverlays: [],
    tooltipModel: defaultPoint?.tooltipModel ?? null,
    detailModel: defaultPoint?.detailModel ?? null,
    events: [],
  }
}