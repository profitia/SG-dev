import type { SeriesResponse } from '@/lib/time-series/series-contract'

import type {
  TimeSeriesViewerAxisTick,
  TimeSeriesViewerDetailModel,
  TimeSeriesViewerLocale,
  TimeSeriesViewerPayload,
  TimeSeriesViewerPoint,
  TimeSeriesViewerSeries,
  TimeSeriesViewerSeriesKind,
  TimeSeriesViewerTooltipModel,
  TimeSeriesViewerTooltipRow,
} from './time-series-viewer-contract'

type RawSeriesPoint = { date: string; value: number | null; diff: number | null; recordId: string }

function formatScenarioLabel(locale: TimeSeriesViewerLocale, pointType: TimeSeriesViewerSeriesKind) {
  switch (pointType) {
    case 'historical':
      return locale === 'pl' ? 'Ceny historyczne' : 'Historical Prices'
    case 'monthly-actual':
      return locale === 'pl' ? 'Miesięczny odczyt' : 'Monthly actual'
    case 'historical-forecast':
      return locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast'
    case 'forecast-central':
      return locale === 'pl' ? 'Prognoza' : 'Forecast'
    case 'forecast-upper':
      return locale === 'pl' ? 'Górna granica prognozy' : 'Forecast Upper Bound'
    case 'forecast-lower':
      return locale === 'pl' ? 'Dolna granica prognozy' : 'Forecast Lower Bound'
  }
}

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

function uniqueDates(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
}

function sortSeriesPoints(points: RawSeriesPoint[]) {
  return [...points].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}

function buildDateTicks(locale: TimeSeriesViewerLocale, values: string[]): TimeSeriesViewerAxisTick[] {
  const dates = uniqueDates(values)

  if (dates.length === 0) {
    return []
  }

  const step = Math.max(1, Math.ceil(dates.length / 6))

  return dates
    .filter((_, index) => index % step === 0 || index === dates.length - 1)
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

function buildTooltipRows(
  locale: TimeSeriesViewerLocale,
  detail: TimeSeriesViewerDetailModel,
  pointType: TimeSeriesViewerSeriesKind,
): TimeSeriesViewerTooltipRow[] {
  const rows: TimeSeriesViewerTooltipRow[] = [
    { label: locale === 'pl' ? 'Komponent' : 'Component', value: detail.componentName },
    { label: locale === 'pl' ? 'Data' : 'Date', value: formatDate(locale, detail.sourceDate) },
    { label: locale === 'pl' ? 'Seria' : 'Series', value: formatScenarioLabel(locale, pointType) },
    { label: locale === 'pl' ? 'Wartość' : 'Value', value: formatNumber(locale, detail.value) },
  ]

  if (pointType !== 'historical') {
    rows.push({ label: locale === 'pl' ? 'Lower' : 'Lower', value: formatNumber(locale, detail.forecastLower) })
    rows.push({ label: locale === 'pl' ? 'Upper' : 'Upper', value: formatNumber(locale, detail.forecastUpper) })
  }

  rows.push({ label: locale === 'pl' ? 'Benchmark' : 'Benchmark', value: detail.benchmarkCode ?? ' - ' })

  if (detail.description) {
    rows.push({ label: locale === 'pl' ? 'Opis' : 'Description', value: detail.description })
  }

  if (detail.sourceLabel) {
    rows.push({ label: locale === 'pl' ? 'Źródło' : 'Source', value: detail.sourceLabel })
  }

  return rows
}

function buildTooltipModel(
  locale: TimeSeriesViewerLocale,
  detail: TimeSeriesViewerDetailModel,
  pointType: TimeSeriesViewerSeriesKind,
): TimeSeriesViewerTooltipModel {
  return {
    title: `${detail.componentName} · ${formatDate(locale, detail.sourceDate)}`,
    rows: buildTooltipRows(locale, detail, pointType),
  }
}

function buildPointDetail(
  detailBase: TimeSeriesViewerDetailModel,
  pointType: TimeSeriesViewerSeriesKind,
  date: string,
  value: number | null,
  forecastAccuracyDiff: number | null,
  forecastLower: number | null,
  forecastUpper: number | null,
): TimeSeriesViewerDetailModel {
  return {
    ...detailBase,
    sourceDate: date,
    temporalResolution: 'day',
    scenarioType: pointType,
    value,
    forecastAccuracyDiff,
    forecastLower,
    forecastUpper,
  }
}

function buildSeriesPoints(
  locale: TimeSeriesViewerLocale,
  kind: TimeSeriesViewerSeriesKind,
  seriesId: string,
  points: RawSeriesPoint[],
  detailBase: TimeSeriesViewerDetailModel,
  forecastBands: Map<string, { lower: number | null; upper: number | null }>,
  anchor: RawSeriesPoint | null,
): TimeSeriesViewerPoint[] {
  const normalized = anchor ? [anchor, ...points] : points

  return normalized.map((point, index) => {
    const band = forecastBands.get(point.recordId) ?? { lower: null, upper: null }
    const detailModel = buildPointDetail(
      detailBase,
      kind,
      point.date,
      point.value,
      point.diff,
      band.lower,
      band.upper,
    )

    return {
      key: `${seriesId}-${point.recordId}-${index}`,
      date: point.date,
      value: point.value,
      diff: point.diff,
      recordId: point.recordId,
      anchor: Boolean(anchor) && index === 0,
      detailModel,
      tooltipModel: buildTooltipModel(locale, detailModel, kind),
    }
  })
}

export function toTimeSeriesViewerPayload(series: SeriesResponse, locale: TimeSeriesViewerLocale): TimeSeriesViewerPayload {
  const historicalPoints = sortSeriesPoints(series.historical)
  const forecastCentralPoints = sortSeriesPoints(series.forecast?.central ?? [])
  const forecastUpperPoints = sortSeriesPoints(series.forecast?.upper ?? [])
  const forecastLowerPoints = sortSeriesPoints(series.forecast?.lower ?? [])
  const normalizedForecastAnchor = historicalPoints.length > 0
    ? {
        date: historicalPoints[historicalPoints.length - 1]?.date ?? null,
        value: historicalPoints[historicalPoints.length - 1]?.value ?? null,
      }
    : series.forecastAnchor

  const description = locale === 'pl' ? (series.sourceInfo?.descriptionPl ?? null) : (series.sourceInfo?.descriptionEn ?? null)
  const detailBase: TimeSeriesViewerDetailModel = {
    componentName: series.detailSummary?.componentName ?? series.selection?.componentName ?? ' - ',
    benchmarkCode: series.detailSummary?.componentCode ?? series.selection?.componentCode ?? null,
    sourceDate: series.detailSummary?.sourceDate ?? normalizedForecastAnchor?.date ?? null,
    temporalResolution: 'day',
    scenarioType: series.detailSummary?.scenarioType ?? 'historical',
    value: series.detailSummary?.metricValue ?? normalizedForecastAnchor?.value ?? null,
    forecastLower: series.detailSummary?.forecastLower ?? null,
    forecastUpper: series.detailSummary?.forecastUpper ?? null,
    forecastAccuracyDiff: series.detailSummary?.forecastAccuracyDiff ?? null,
    description,
    unit: series.detailSummary?.unit ?? series.sourceInfo?.unit ?? null,
    currency: series.detailSummary?.currency ?? series.sourceInfo?.currency ?? null,
    market: series.detailSummary?.market ?? series.sourceInfo?.market ?? null,
    country: series.detailSummary?.country ?? series.sourceInfo?.country ?? null,
    qualityStatus: series.detailSummary?.qualityStatus ?? series.sourceInfo?.qualityStatus ?? null,
    sourceLabel: series.detailSummary?.sourceLabel ?? series.sourceInfo?.sourceLabel ?? null,
    lastSyncedAt: series.detailSummary?.lastSyncedAt ?? series.sourceInfo?.lastSyncedAt ?? null,
  }

  const forecastBands = new Map<string, { lower: number | null; upper: number | null }>()
  for (let index = 0; index < forecastCentralPoints.length; index += 1) {
    const central = forecastCentralPoints[index]
    const lower = forecastLowerPoints[index]
    const upper = forecastUpperPoints[index]

    if (!central) {
      continue
    }

    forecastBands.set(central.recordId, {
      lower: lower?.value ?? null,
      upper: upper?.value ?? null,
    })
  }

  const anchor = normalizedForecastAnchor?.date
    ? {
        date: normalizedForecastAnchor.date,
        value: normalizedForecastAnchor.value,
        diff: null,
        recordId: historicalPoints[historicalPoints.length - 1]?.recordId ?? 'anchor',
      }
    : null

  const viewerSeries: TimeSeriesViewerSeries[] = [
    {
      id: 'historical',
      kind: 'historical',
      label: formatScenarioLabel(locale, 'historical'),
      lineStyle: 'solid',
      points: buildSeriesPoints(locale, 'historical', 'historical', historicalPoints, detailBase, forecastBands, null),
    },
  ]

  if (series.forecast && forecastCentralPoints.length > 0) {
    viewerSeries.push(
      {
        id: 'forecast-central',
        kind: 'forecast-central',
        label: formatScenarioLabel(locale, 'forecast-central'),
        lineStyle: 'dashed',
        points: buildSeriesPoints(locale, 'forecast-central', 'forecast-central', forecastCentralPoints, detailBase, forecastBands, anchor),
      },
      {
        id: 'forecast-upper',
        kind: 'forecast-upper',
        label: formatScenarioLabel(locale, 'forecast-upper'),
        lineStyle: 'dashed',
        points: buildSeriesPoints(locale, 'forecast-upper', 'forecast-upper', forecastUpperPoints, detailBase, forecastBands, anchor),
      },
      {
        id: 'forecast-lower',
        kind: 'forecast-lower',
        label: formatScenarioLabel(locale, 'forecast-lower'),
        lineStyle: 'dashed',
        points: buildSeriesPoints(locale, 'forecast-lower', 'forecast-lower', forecastLowerPoints, detailBase, forecastBands, anchor),
      },
    )
  }

  const allDates = viewerSeries.flatMap((entry) => entry.points.map((point) => point.date))
  const allValues = viewerSeries.flatMap((entry) => entry.points.map((point) => point.value).filter((value): value is number => value !== null))
  const defaultPoint = viewerSeries[0]?.points[viewerSeries[0].points.length - 1] ?? viewerSeries[1]?.points[0] ?? null

  return {
    title: series.selection?.componentName ?? ' - ',
    subtitle: series.selection?.componentCode ?? null,
    locale,
    sourceInfo: series.sourceInfo
      ? {
          benchmarkCode: series.sourceInfo.benchmarkCode,
          description,
          sourceLabel: series.sourceInfo.sourceLabel,
          unit: series.sourceInfo.unit,
          currency: series.sourceInfo.currency,
          market: series.sourceInfo.market,
          country: series.sourceInfo.country,
          qualityStatus: series.sourceInfo.qualityStatus,
          lastSyncedAt: series.sourceInfo.lastSyncedAt,
        }
      : null,
    benchmarkCode: series.sourceInfo?.benchmarkCode ?? series.selection?.componentCode ?? null,
    description,
    unit: series.sourceInfo?.unit ?? null,
    currency: series.sourceInfo?.currency ?? null,
    market: series.sourceInfo?.market ?? null,
    country: series.sourceInfo?.country ?? null,
    lastSyncedAt: series.sourceInfo?.lastSyncedAt ?? null,
    xAxis: {
      type: 'time',
      labelFormat: 'MMM yy',
      ticks: buildDateTicks(locale, allDates),
    },
    yAxis: {
      type: 'value',
      unit: series.sourceInfo?.unit ?? null,
      currency: series.sourceInfo?.currency ?? null,
      ticks: buildValueTicks(locale, allValues),
    },
    series: viewerSeries,
    forecastAnchor: normalizedForecastAnchor,
    forecastOrigin: null,
    deltaOverlays: [],
    tooltipModel: defaultPoint?.tooltipModel ?? null,
    detailModel: defaultPoint?.detailModel ?? detailBase,
    events: [],
  }
}