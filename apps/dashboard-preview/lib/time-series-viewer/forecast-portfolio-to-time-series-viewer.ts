import {
  buildHistoricalForecastDeltaSegments,
  buildHistoricalForecastLineSegments,
  type HistoricalForecastComparisonPoint,
} from '@/lib/forecast-accuracy/historical-forecast-view'
import type {
  BenchmarkForecastCurrentAvailableResult,
  BenchmarkForecastVerificationAvailableResult,
  ForecastCurrentPoint,
  ForecastPortfolioModelId,
  ForecastTargetBasis,
  ForecastVerificationRecord,
} from '@/lib/benchmark-forecast/forecast-contract'

import type {
  TimeSeriesViewerDeltaOverlay,
  TimeSeriesViewerDetailModel,
  TimeSeriesViewerLocale,
  TimeSeriesViewerPayload,
  TimeSeriesViewerPoint,
  TimeSeriesViewerSeries,
  TimeSeriesViewerTemporalResolution,
  TimeSeriesViewerTooltipModel,
} from './time-series-viewer-contract'

type DailyRibbonEndpoint = {
  date: string
  actualValue: number
  forecastValue: number
}

type EndOfPeriodActualPoint = {
  date: string
  value: number
}

type PreparedHistoricalForecastPoint = {
  key: string
  monthKey: string
  date: string
  forecastValue: number
  actualValue: number
  record: VerificationDisplayRecord
}

type PreparedHistoricalForecastSegment = {
  points: PreparedHistoricalForecastPoint[]
}

const MODEL_LABELS: Record<ForecastPortfolioModelId, { pl: string; en: string }> = {
  naive: { pl: 'Naive', en: 'Naive' },
  damped_holt: { pl: 'Damped Holt', en: 'Damped Holt' },
  ets: { pl: 'ETS', en: 'ETS' },
  arima: { pl: 'ARIMA', en: 'ARIMA' },
}

function formatNumber(locale: TimeSeriesViewerLocale, value: number | null) {
  if (value === null) {
    return ' - '
  }

  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatPercentage(locale: TimeSeriesViewerLocale, value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return ' - '
  }

  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatMonthLabel(locale: TimeSeriesViewerLocale, value: string) {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

function formatDayLabel(locale: TimeSeriesViewerLocale, value: string) {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function formatObservedAtLabel(locale: TimeSeriesViewerLocale, value: string) {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function toMonthEndDisplayDate(value: string) {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12, 0, 0, 0)).toISOString()
}

function compareDatesAscending(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime()
}

function monthOrdinal(value: string) {
  const date = new Date(value)
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function isConsecutiveForecastMonth(left: string, right: string) {
  return monthOrdinal(right) - monthOrdinal(left) === 1
}

function interpolateValueByDate(
  leftDate: string,
  rightDate: string,
  leftValue: number,
  rightValue: number,
  targetDate: string,
) {
  const leftMs = new Date(leftDate).getTime()
  const rightMs = new Date(rightDate).getTime()
  const targetMs = new Date(targetDate).getTime()

  if (rightMs <= leftMs) {
    return leftValue
  }

  const ratio = (targetMs - leftMs) / (rightMs - leftMs)
  return leftValue + ((rightValue - leftValue) * ratio)
}

function modelLabel(locale: TimeSeriesViewerLocale, model: ForecastPortfolioModelId) {
  return MODEL_LABELS[model][locale]
}

function targetBasisLabel(locale: TimeSeriesViewerLocale, targetBasis: ForecastTargetBasis) {
  if (targetBasis === 'POINT_IN_TIME') {
    return locale === 'pl' ? 'Dzienna' : 'Daily'
  }

  if (targetBasis === 'END_OF_PERIOD') {
    return locale === 'pl' ? 'Koniec okresu' : 'End of period'
  }

  return locale === 'pl' ? 'Średnia miesięczna' : 'Monthly average'
}

function verificationNarrative(locale: TimeSeriesViewerLocale, delta: number | null) {
  if (delta === null || !Number.isFinite(delta) || delta === 0) {
    return locale === 'pl'
      ? 'Prognoza była zgodna z faktycznym odczytem.'
      : 'The forecast matched the actual reading.'
  }

  if (delta > 0) {
    return locale === 'pl'
      ? 'Prognoza była powyżej faktycznego odczytu.'
      : 'The forecast was above the actual reading.'
  }

  return locale === 'pl'
    ? 'Prognoza była poniżej faktycznego odczytu.'
    : 'The forecast was below the actual reading.'
}

type VerificationDisplayRecord = {
  key: string
  monthKey: string
  displayDate: string
  forecastDate: string
  forecastOrigin: string
  actualObservedAt: string | null
  actualValue: number
  forecastValue: number
  delta: number | null
  deltaPct: number | null
  horizon: string
}

function toTooltipModel({
  locale,
  componentName,
  date,
  primarySeriesLabel,
  primaryValue,
  rows,
  datePrecision = 'month',
}: {
  locale: TimeSeriesViewerLocale
  componentName: string
  date: string
  primarySeriesLabel: string
  primaryValue: number | null
  rows: Array<{ label: string; value: string }>
  datePrecision?: 'day' | 'month'
}): TimeSeriesViewerTooltipModel {
  return {
    title: `${componentName} · ${datePrecision === 'day' ? formatDayLabel(locale, date) : formatMonthLabel(locale, date)}`,
    rows: [
      { label: locale === 'pl' ? 'Seria' : 'Series', value: primarySeriesLabel },
      { label: locale === 'pl' ? 'Wartość' : 'Value', value: formatNumber(locale, primaryValue) },
      ...rows,
    ],
  }
}

function toDetailModel(
  basePayload: TimeSeriesViewerPayload,
  sourceDate: string,
  value: number | null,
  scenarioType: string,
  options?: {
    temporalResolution?: TimeSeriesViewerTemporalResolution
    forecastLower?: number | null
    forecastUpper?: number | null
  },
): TimeSeriesViewerDetailModel {
  return {
    componentName: basePayload.title,
    benchmarkCode: basePayload.benchmarkCode,
    sourceDate,
    temporalResolution: options?.temporalResolution ?? 'month',
    scenarioType,
    value,
    forecastLower: options?.forecastLower ?? null,
    forecastUpper: options?.forecastUpper ?? null,
    forecastAccuracyDiff: null,
    description: basePayload.description,
    unit: basePayload.unit,
    currency: basePayload.currency,
    market: basePayload.market,
    country: basePayload.country,
    qualityStatus: null,
    sourceLabel: basePayload.sourceInfo?.sourceLabel ?? null,
    lastSyncedAt: basePayload.lastSyncedAt,
  }
}

function normalizePointInTimeDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (match) {
    const [, year, month, day] = match
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0)).toISOString()
  }

  return new Date(value).toISOString()
}

function buildNonNullSegments(points: TimeSeriesViewerPoint[]) {
  const segments: TimeSeriesViewerPoint[][] = []
  let current: TimeSeriesViewerPoint[] = []

  for (const point of points) {
    if (point.value === null) {
      if (current.length >= 2) {
        segments.push(current)
      }
      current = []
      continue
    }

    current.push(point)
  }

  if (current.length >= 2) {
    segments.push(current)
  }

  return segments
}

function sortCurrentForecastPoints(currentForecast: Record<string, ForecastCurrentPoint>) {
  return Object.values(currentForecast)
    .filter((point) => point.forecastValue !== null)
    .sort((left, right) => left.horizonSteps - right.horizonSteps)
}

function buildCurrentForecastSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  result: BenchmarkForecastCurrentAvailableResult,
): TimeSeriesViewerSeries {
  const label = locale === 'pl' ? 'Prognoza' : 'Forecast'

  return {
    id: `forecast-central-${model}`,
    kind: 'forecast-central',
    label,
    lineStyle: 'dashed',
    points: sortCurrentForecastPoints(result.currentForecast).map((point, index): TimeSeriesViewerPoint => ({
      key: `forecast-central-${model}-${point.horizon}`,
      date: toMonthEndDisplayDate(point.forecastDate),
      value: point.forecastValue,
      diff: null,
      recordId: `forecast-current-${model}-${point.horizon}`,
      anchor: index === 0,
      tooltipModel: toTooltipModel({
        locale,
        componentName: basePayload.title,
        date: point.forecastDate,
        primarySeriesLabel: label,
        primaryValue: point.forecastValue,
        rows: [
          { label: locale === 'pl' ? 'Model' : 'Model', value: modelLabel(locale, model) },
          { label: locale === 'pl' ? 'Baza celu' : 'Target basis', value: targetBasisLabel(locale, result.targetBasis) },
          { label: locale === 'pl' ? 'Horyzont' : 'Horizon', value: point.horizon },
        ],
      }),
      detailModel: toDetailModel(basePayload, point.forecastDate, point.forecastValue, 'forecast-central'),
    })),
  }
}

function buildPointInTimeCurrentForecastSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  result: BenchmarkForecastCurrentAvailableResult,
) {
  const snapshot = result.rollingDailySnapshot

  if (!snapshot) {
    return [] as TimeSeriesViewerSeries[]
  }

  const centralLabel = locale === 'pl' ? 'Prognoza' : 'Forecast'
  const upperLabel = locale === 'pl' ? 'Górna granica prognozy' : 'Forecast Upper Bound'
  const lowerLabel = locale === 'pl' ? 'Dolna granica prognozy' : 'Forecast Lower Bound'

  const centralPoints = snapshot.path.map((point, index): TimeSeriesViewerPoint => ({
    key: `forecast-central-${model}-${point.date}`,
    date: normalizePointInTimeDisplayDate(point.date),
    value: point.pointForecast,
    diff: null,
    recordId: `forecast-current-${model}-${point.date}`,
    anchor: index === 0,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: point.date,
      primarySeriesLabel: centralLabel,
      primaryValue: point.pointForecast,
      datePrecision: 'day',
      rows: [
        { label: locale === 'pl' ? 'Model' : 'Model', value: modelLabel(locale, model) },
        { label: locale === 'pl' ? 'Baza celu' : 'Target basis', value: targetBasisLabel(locale, result.targetBasis) },
      ],
    }),
    detailModel: toDetailModel(basePayload, point.date, point.pointForecast, 'forecast-central', {
      temporalResolution: 'day',
      forecastLower: point.band.status === 'AVAILABLE' ? point.band.lower : null,
      forecastUpper: point.band.status === 'AVAILABLE' ? point.band.upper : null,
    }),
  }))

  const upperPoints = snapshot.path.map((point): TimeSeriesViewerPoint => ({
    key: `forecast-upper-${model}-${point.date}`,
    date: normalizePointInTimeDisplayDate(point.date),
    value: point.band.status === 'AVAILABLE' ? point.band.upper : null,
    diff: null,
    recordId: `forecast-current-${model}-${point.date}`,
    anchor: false,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: point.date,
      primarySeriesLabel: upperLabel,
      primaryValue: point.band.status === 'AVAILABLE' ? point.band.upper : null,
      datePrecision: 'day',
      rows: [
        { label: locale === 'pl' ? 'Model' : 'Model', value: modelLabel(locale, model) },
        { label: locale === 'pl' ? 'Baza celu' : 'Target basis', value: targetBasisLabel(locale, result.targetBasis) },
      ],
    }),
    detailModel: toDetailModel(basePayload, point.date, point.band.status === 'AVAILABLE' ? point.band.upper : null, 'forecast-upper', {
      temporalResolution: 'day',
    }),
  }))

  const lowerPoints = snapshot.path.map((point): TimeSeriesViewerPoint => ({
    key: `forecast-lower-${model}-${point.date}`,
    date: normalizePointInTimeDisplayDate(point.date),
    value: point.band.status === 'AVAILABLE' ? point.band.lower : null,
    diff: null,
    recordId: `forecast-current-${model}-${point.date}`,
    anchor: false,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: point.date,
      primarySeriesLabel: lowerLabel,
      primaryValue: point.band.status === 'AVAILABLE' ? point.band.lower : null,
      datePrecision: 'day',
      rows: [
        { label: locale === 'pl' ? 'Model' : 'Model', value: modelLabel(locale, model) },
        { label: locale === 'pl' ? 'Baza celu' : 'Target basis', value: targetBasisLabel(locale, result.targetBasis) },
      ],
    }),
    detailModel: toDetailModel(basePayload, point.date, point.band.status === 'AVAILABLE' ? point.band.lower : null, 'forecast-lower', {
      temporalResolution: 'day',
    }),
  }))

  const series: TimeSeriesViewerSeries[] = [
    {
      id: `forecast-central-${model}`,
      kind: 'forecast-central',
      label: centralLabel,
      lineStyle: 'dashed',
      points: centralPoints,
    },
    {
      id: `forecast-upper-${model}`,
      kind: 'forecast-upper',
      label: upperLabel,
      lineStyle: 'dashed',
      points: upperPoints,
      segments: buildNonNullSegments(upperPoints),
    },
    {
      id: `forecast-lower-${model}`,
      kind: 'forecast-lower',
      label: lowerLabel,
      lineStyle: 'dashed',
      points: lowerPoints,
      segments: buildNonNullSegments(lowerPoints),
    },
  ]

  return series
}

function collectVerificationDisplayRecords(records: ForecastVerificationRecord[]) {
  return collectVerificationDisplayRecordsForTargetBasis('MONTHLY_AVERAGE', records)
}

function collectVerificationDisplayRecordsForTargetBasis(
  targetBasis: ForecastTargetBasis,
  records: ForecastVerificationRecord[],
) {
  if (targetBasis === 'POINT_IN_TIME') {
    const selectedByDate = new Map<string, ForecastVerificationRecord>()

    for (const record of records
      .filter((candidate) => Number.isFinite(candidate.actualValue) && Number.isFinite(candidate.forecastValue))
      .sort((left, right) => new Date(left.forecastDate).getTime() - new Date(right.forecastDate).getTime() || new Date(right.forecastOrigin).getTime() - new Date(left.forecastOrigin).getTime())) {
      selectedByDate.set(record.forecastDate, record)
    }

    return [...selectedByDate.values()]
      .sort((left, right) => new Date(left.forecastDate).getTime() - new Date(right.forecastDate).getTime())
      .map((record) => ({
        key: `${record.modelId}:${record.horizon}:${record.forecastDate}`,
        monthKey: record.forecastDate,
        displayDate: normalizePointInTimeDisplayDate(record.forecastDate),
        forecastDate: record.forecastDate,
        forecastOrigin: record.forecastOrigin,
        actualObservedAt: record.actualObservedAt,
        actualValue: record.actualValue,
        forecastValue: record.forecastValue,
        delta: record.delta,
        deltaPct: record.deltaPct,
        horizon: record.horizon,
      }))
  }

  const seenMonthKeys = new Set<string>()
  const displayRecords: VerificationDisplayRecord[] = []

  for (const record of records
    .filter((candidate) => Number.isFinite(candidate.actualValue) && Number.isFinite(candidate.forecastValue))
    .sort((left, right) => new Date(left.forecastDate).getTime() - new Date(right.forecastDate).getTime())) {
    const monthKey = record.forecastDate.slice(0, 7)

    if (seenMonthKeys.has(monthKey)) {
      return null
    }

    seenMonthKeys.add(monthKey)
    displayRecords.push({
      key: `${record.modelId}:${record.horizon}:${record.forecastDate}`,
      monthKey,
      displayDate: toMonthEndDisplayDate(record.forecastDate),
      forecastDate: record.forecastDate,
      forecastOrigin: record.forecastOrigin,
      actualObservedAt: record.actualObservedAt,
      actualValue: record.actualValue,
      forecastValue: record.forecastValue,
      delta: record.delta,
      deltaPct: record.deltaPct,
      horizon: record.horizon,
    })
  }

  return displayRecords
}

function buildPointInTimeVerificationSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  records: VerificationDisplayRecord[],
): TimeSeriesViewerSeries | null {
  const label = locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast'
  const points = records.map((record): TimeSeriesViewerPoint => ({
    key: `historical-forecast-${model}-${record.horizon}-${record.forecastDate}`,
    date: record.displayDate,
    value: record.forecastValue,
    diff: record.delta,
    recordId: `historical-forecast-${model}-${record.horizon}-${record.forecastDate}`,
    anchor: false,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: record.forecastDate,
      primarySeriesLabel: label,
      primaryValue: record.forecastValue,
      datePrecision: 'day',
      rows: [
        { label: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual', value: formatNumber(locale, record.actualValue) },
        ...buildVerificationTooltipRows(locale, model, 'POINT_IN_TIME', record),
      ],
    }),
    detailModel: toDetailModel(basePayload, record.forecastDate, record.forecastValue, 'historical-forecast', {
      temporalResolution: 'day',
    }),
  }))

  if (points.length === 0) {
    return null
  }

  return {
    id: `historical-forecast-${model}`,
    kind: 'historical-forecast',
    label,
    lineStyle: 'dashed',
    points,
    segments: points.length >= 2 ? [points] : undefined,
  }
}

function findHistoricalSeries(basePayload: TimeSeriesViewerPayload) {
  return basePayload.series.find((entry) => entry.kind === 'historical') ?? null
}

function buildHistoricalActualPointLookup(basePayload: TimeSeriesViewerPayload) {
  const historicalSeries = findHistoricalSeries(basePayload)

  if (!historicalSeries) {
    return {
      historicalSeries: null,
      pointByDate: new Map<string, EndOfPeriodActualPoint>(),
      points: [] as EndOfPeriodActualPoint[],
    }
  }

  const points = historicalSeries.points
    .filter((point): point is TimeSeriesViewerPoint & { value: number } => point.value !== null)
    .map((point) => ({ date: point.date, value: point.value }))
    .sort((left, right) => compareDatesAscending(left.date, right.date))

  return {
    historicalSeries,
    pointByDate: new Map(points.map((point) => [point.date, point])),
    points,
  }
}

function resolveEndOfPeriodActualPoint(
  record: VerificationDisplayRecord,
  historicalPointByDate: Map<string, EndOfPeriodActualPoint>,
) {
  if (record.actualObservedAt) {
    const matched = historicalPointByDate.get(record.actualObservedAt)

    if (matched) {
      return matched
    }
  }

  return {
    date: record.actualObservedAt ?? record.displayDate,
    value: record.actualValue,
  }
}

function buildVerificationComparisonPoints(records: VerificationDisplayRecord[]) {
  return records.map((record): HistoricalForecastComparisonPoint => ({
    key: record.key,
    monthKey: record.monthKey,
    date: record.displayDate,
    actualValue: record.actualValue,
    forecastValue: record.forecastValue,
    sourceDifferenceValue: record.delta,
    sourceErrorType: null,
    absoluteDiff: record.delta ?? (record.forecastValue - record.actualValue),
    percentageDiff: record.deltaPct,
    direction: (record.delta ?? (record.forecastValue - record.actualValue)) > 0
      ? 'above'
      : (record.delta ?? (record.forecastValue - record.actualValue)) < 0
        ? 'below'
        : 'equal',
  }))
}

function buildPreparedHistoricalForecastGeometry(records: VerificationDisplayRecord[]) {
  const comparisonPoints = buildVerificationComparisonPoints(records)
  const recordByKey = new Map(records.map((record) => [record.key, record]))
  const pointByDate = new Map<string, PreparedHistoricalForecastPoint>()

  for (const point of comparisonPoints) {
    const record = recordByKey.get(point.key)

    if (!record) {
      continue
    }

    pointByDate.set(point.date, {
      key: point.key,
      monthKey: point.monthKey,
      date: point.date,
      forecastValue: point.forecastValue,
      actualValue: point.actualValue,
      record,
    })
  }

  const points = comparisonPoints
    .map((point) => pointByDate.get(point.date) ?? null)
    .filter((point): point is PreparedHistoricalForecastPoint => point !== null)

  const segments = buildHistoricalForecastLineSegments(comparisonPoints)
    .map((segment): PreparedHistoricalForecastSegment => ({
      points: segment.points
        .map((point) => pointByDate.get(point.date) ?? null)
        .filter((point): point is PreparedHistoricalForecastPoint => point !== null),
    }))
    .filter((segment) => segment.points.length >= 2)

  return {
    points,
    segments,
  }
}

function buildVerificationTooltipRows(
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  record: VerificationDisplayRecord,
) {
  const rows = [
    { label: locale === 'pl' ? 'Okres docelowy' : 'Target', value: targetBasis === 'POINT_IN_TIME' ? formatDayLabel(locale, record.forecastDate) : formatMonthLabel(locale, record.forecastDate) },
    { label: locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast', value: formatNumber(locale, record.forecastValue) },
    { label: locale === 'pl' ? 'Prognoza przygotowana' : 'Forecast origin', value: targetBasis === 'POINT_IN_TIME' ? formatDayLabel(locale, record.forecastOrigin) : formatMonthLabel(locale, record.forecastOrigin) },
    { label: locale === 'pl' ? 'Horyzont' : 'Horizon', value: record.horizon },
    { label: locale === 'pl' ? 'Błąd prognozy' : 'Forecast error', value: formatPercentage(locale, record.deltaPct) },
    { label: locale === 'pl' ? 'Baza celu' : 'Target basis', value: targetBasisLabel(locale, targetBasis) },
    { label: locale === 'pl' ? 'Model' : 'Model', value: modelLabel(locale, model) },
    { label: locale === 'pl' ? 'Interpretacja' : 'Interpretation', value: verificationNarrative(locale, record.delta) },
  ]

  if ((targetBasis === 'END_OF_PERIOD' || targetBasis === 'POINT_IN_TIME') && record.actualObservedAt) {
    rows.splice(2, 0, {
      label: locale === 'pl' ? 'Rzeczywisty odczyt z dnia' : 'Actual observed at',
      value: formatObservedAtLabel(locale, record.actualObservedAt),
    })
  }

  return rows
}

function monthlyActualSeriesLabel(locale: TimeSeriesViewerLocale, targetBasis: ForecastTargetBasis) {
  if (targetBasis === 'END_OF_PERIOD') {
    return locale === 'pl' ? 'Odczyt na koniec okresu' : 'End-of-period actual'
  }

  return locale === 'pl' ? 'Średnia miesięczna' : 'Monthly average actual'
}

function buildMarkerOnlySegments(points: TimeSeriesViewerPoint[]) {
  return points.map((point) => [point])
}

function buildMonthlyActualSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  records: VerificationDisplayRecord[],
): TimeSeriesViewerSeries | null {
  const label = monthlyActualSeriesLabel(locale, targetBasis)
  const points = records.map((record): TimeSeriesViewerPoint => ({
    key: `monthly-actual-${model}-${record.horizon}-${record.forecastDate}`,
    date: record.displayDate,
    value: record.actualValue,
    diff: record.delta,
    recordId: `monthly-actual-${model}-${record.horizon}-${record.forecastDate}`,
    anchor: true,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: record.forecastDate,
      primarySeriesLabel: label,
      primaryValue: record.actualValue,
      rows: buildVerificationTooltipRows(locale, model, targetBasis, record),
    }),
    detailModel: toDetailModel(basePayload, record.actualObservedAt ?? record.forecastDate, record.actualValue, 'monthly-actual'),
  }))

  if (points.length === 0) {
    return null
  }

  const pointByDate = new Map(points.map((point) => [point.date, point]))
  const segments = buildHistoricalForecastLineSegments(buildVerificationComparisonPoints(records))
    .map((segment) => segment.points.map((point) => pointByDate.get(point.date) ?? null).filter((point): point is TimeSeriesViewerPoint => point !== null))
    .filter((segment) => segment.length >= 2)

  return {
    id: `monthly-actual-${model}`,
    kind: 'monthly-actual',
    label,
    lineStyle: 'solid',
    points,
    segments,
  }
}

function buildEndOfPeriodActualSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  records: VerificationDisplayRecord[],
): TimeSeriesViewerSeries | null {
  const { pointByDate } = buildHistoricalActualPointLookup(basePayload)
  const label = monthlyActualSeriesLabel(locale, 'END_OF_PERIOD')
  const points = records
    .map((record): TimeSeriesViewerPoint => {
      const actualPoint = resolveEndOfPeriodActualPoint(record, pointByDate)

      return {
        key: `monthly-actual-${model}-${record.horizon}-${record.forecastDate}`,
        date: actualPoint.date,
        value: actualPoint.value,
        diff: record.delta,
        recordId: `monthly-actual-${model}-${record.horizon}-${record.forecastDate}`,
        anchor: true,
        tooltipModel: toTooltipModel({
          locale,
          componentName: basePayload.title,
          date: record.forecastDate,
          primarySeriesLabel: label,
          primaryValue: actualPoint.value,
          rows: buildVerificationTooltipRows(locale, model, 'END_OF_PERIOD', record),
        }),
        detailModel: toDetailModel(basePayload, record.actualObservedAt ?? actualPoint.date, actualPoint.value, 'monthly-actual'),
      }
    })
    .sort((left, right) => compareDatesAscending(left.date, right.date))

  if (points.length === 0) {
    return null
  }

  return {
    id: `monthly-actual-${model}`,
    kind: 'monthly-actual',
    label,
    lineStyle: 'solid',
    points,
    segments: buildMarkerOnlySegments(points),
  }
}

function buildVerificationSeries(
  basePayload: TimeSeriesViewerPayload,
  locale: TimeSeriesViewerLocale,
  model: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  records: VerificationDisplayRecord[],
): TimeSeriesViewerSeries | null {
  const geometry = buildPreparedHistoricalForecastGeometry(records)
  const label = locale === 'pl' ? 'Historyczna prognoza' : 'Historical forecast'
  const points = geometry.points.map(({ record, date, forecastValue }): TimeSeriesViewerPoint => ({
    key: `historical-forecast-${model}-${record.horizon}-${record.forecastDate}`,
    date,
    value: forecastValue,
    diff: record.delta,
    recordId: `historical-forecast-${model}-${record.horizon}-${record.forecastDate}`,
    anchor: false,
    tooltipModel: toTooltipModel({
      locale,
      componentName: basePayload.title,
      date: record.forecastDate,
      primarySeriesLabel: label,
      primaryValue: forecastValue,
      rows: [
        { label: locale === 'pl' ? 'Odczyt rzeczywisty' : 'Actual', value: formatNumber(locale, record.actualValue) },
        ...buildVerificationTooltipRows(locale, model, targetBasis, record),
      ],
    }),
    detailModel: toDetailModel(basePayload, record.forecastDate, forecastValue, 'historical-forecast'),
  }))

  if (points.length === 0) {
    return null
  }

  const pointByDate = new Map(points.map((point) => [point.date, point]))
  const segments = geometry.segments
    .map((segment) => segment.points.map((point) => pointByDate.get(point.date) ?? null).filter((point): point is TimeSeriesViewerPoint => point !== null))
    .filter((segment) => segment.length >= 2)

  return {
    id: `historical-forecast-${model}`,
    kind: 'historical-forecast',
    label,
    lineStyle: 'dashed',
    points,
    segments,
  }
}

function buildDeltaOverlays(records: VerificationDisplayRecord[]): TimeSeriesViewerDeltaOverlay[] {
  return buildHistoricalForecastDeltaSegments(buildVerificationComparisonPoints(records)).map((segment, index) => ({
    key: `delta-${segment.sign}-${index}`,
    sign: segment.sign,
    points: segment.points.map((point) => ({
      date: point.date,
      value: point.value,
    })),
  }))
}

function createLocalDeltaOverlay(
  sign: 'above' | 'below',
  start: DailyRibbonEndpoint,
  end: DailyRibbonEndpoint,
): TimeSeriesViewerDeltaOverlay {
  return {
    key: `delta-${sign}-${start.date}-${end.date}`,
    sign,
    points: [
      { date: start.date, value: start.actualValue },
      { date: end.date, value: end.actualValue },
      { date: end.date, value: end.forecastValue },
      { date: start.date, value: start.forecastValue },
    ],
  }
}

function sampleActualTrajectoryAtDate(
  points: EndOfPeriodActualPoint[],
  targetDate: string,
  startIndex: number,
) {
  if (points.length === 0) {
    return null
  }

  const targetMs = new Date(targetDate).getTime()

  if (!Number.isFinite(targetMs)) {
    return null
  }

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  if (!firstPoint || !lastPoint) {
    return null
  }

  if (targetMs < new Date(firstPoint.date).getTime() || targetMs > new Date(lastPoint.date).getTime()) {
    return null
  }

  let leftIndex = Math.max(0, Math.min(startIndex, points.length - 1))

  while (leftIndex > 0 && compareDatesAscending(points[leftIndex]?.date ?? '', targetDate) > 0) {
    leftIndex -= 1
  }

  while (leftIndex < points.length - 1 && compareDatesAscending(points[leftIndex + 1]?.date ?? '', targetDate) < 0) {
    leftIndex += 1
  }

  const leftPoint = points[leftIndex]

  if (!leftPoint) {
    return null
  }

  if (leftPoint.date === targetDate) {
    return {
      point: leftPoint,
      leftIndex,
    }
  }

  const rightPoint = points[leftIndex + 1]

  if (!rightPoint) {
    return null
  }

  if (rightPoint.date === targetDate) {
    return {
      point: rightPoint,
      leftIndex: leftIndex + 1,
    }
  }

  return {
    point: {
      date: targetDate,
      value: interpolateValueByDate(leftPoint.date, rightPoint.date, leftPoint.value, rightPoint.value, targetDate),
    },
    leftIndex,
  }
}

function appendRibbonSample(samples: DailyRibbonEndpoint[], sample: DailyRibbonEndpoint) {
  const previous = samples[samples.length - 1]

  if (previous && previous.date === sample.date && previous.actualValue === sample.actualValue && previous.forecastValue === sample.forecastValue) {
    return
  }

  samples.push(sample)
}

function buildEndOfPeriodDeltaOverlays(
  basePayload: TimeSeriesViewerPayload,
  records: VerificationDisplayRecord[],
) {
  const { points: historicalDailyPoints } = buildHistoricalActualPointLookup(basePayload)
  const forecastGeometry = buildPreparedHistoricalForecastGeometry(records)

  if (historicalDailyPoints.length < 2 || forecastGeometry.segments.length === 0) {
    return [] as TimeSeriesViewerDeltaOverlay[]
  }

  const overlays: TimeSeriesViewerDeltaOverlay[] = []
  let dailyIndex = 0
  let actualSampleIndex = 0

  for (const segment of forecastGeometry.segments) {
    for (let pointIndex = 1; pointIndex < segment.points.length; pointIndex += 1) {
      const leftPoint = segment.points[pointIndex - 1]
      const rightPoint = segment.points[pointIndex]

      if (!leftPoint || !rightPoint || !isConsecutiveForecastMonth(leftPoint.record.forecastDate, rightPoint.record.forecastDate)) {
        continue
      }

      const leftForecastDate = leftPoint.date
      const rightForecastDate = rightPoint.date
      const segmentSamples: DailyRibbonEndpoint[] = []

      const leftBoundarySample = sampleActualTrajectoryAtDate(historicalDailyPoints, leftForecastDate, actualSampleIndex)
      if (leftBoundarySample) {
        actualSampleIndex = leftBoundarySample.leftIndex
        appendRibbonSample(segmentSamples, {
          date: leftForecastDate,
          actualValue: leftBoundarySample.point.value,
          forecastValue: leftPoint.forecastValue,
        })
      }

      while (dailyIndex < historicalDailyPoints.length && compareDatesAscending(historicalDailyPoints[dailyIndex]?.date ?? '', leftForecastDate) <= 0) {
        dailyIndex += 1
      }

      while (dailyIndex < historicalDailyPoints.length && compareDatesAscending(historicalDailyPoints[dailyIndex]?.date ?? '', rightForecastDate) < 0) {
        const actualPoint = historicalDailyPoints[dailyIndex]

        if (actualPoint) {
          appendRibbonSample(segmentSamples, {
            date: actualPoint.date,
            actualValue: actualPoint.value,
            forecastValue: interpolateValueByDate(
              leftForecastDate,
              rightForecastDate,
              leftPoint.forecastValue,
              rightPoint.forecastValue,
              actualPoint.date,
            ),
          })
        }

        dailyIndex += 1
      }

      const rightBoundarySample = sampleActualTrajectoryAtDate(historicalDailyPoints, rightForecastDate, actualSampleIndex)
      if (rightBoundarySample) {
        actualSampleIndex = rightBoundarySample.leftIndex
        appendRibbonSample(segmentSamples, {
          date: rightForecastDate,
          actualValue: rightBoundarySample.point.value,
          forecastValue: rightPoint.forecastValue,
        })
      }

      if (segmentSamples.length < 2) {
        continue
      }

      for (let sampleIndex = 1; sampleIndex < segmentSamples.length; sampleIndex += 1) {
        const start = segmentSamples[sampleIndex - 1]
        const end = segmentSamples[sampleIndex]

        if (!start || !end) {
          continue
        }

        const startDelta = start.forecastValue - start.actualValue
        const endDelta = end.forecastValue - end.actualValue

        if (startDelta === 0 && endDelta === 0) {
          continue
        }

        if (startDelta === 0) {
          const sign = endDelta > 0 ? 'above' : endDelta < 0 ? 'below' : null
          if (sign) {
            overlays.push(createLocalDeltaOverlay(sign, start, end))
          }
          continue
        }

        if (endDelta === 0) {
          const sign = startDelta > 0 ? 'above' : startDelta < 0 ? 'below' : null
          if (sign) {
            overlays.push(createLocalDeltaOverlay(sign, start, end))
          }
          continue
        }

        const startSign = startDelta > 0 ? 'above' : 'below'
        const endSign = endDelta > 0 ? 'above' : 'below'

        if (startSign === endSign) {
          overlays.push(createLocalDeltaOverlay(startSign, start, end))
          continue
        }

        const ratio = startDelta / (startDelta - endDelta)
        const startMs = new Date(start.date).getTime()
        const endMs = new Date(end.date).getTime()
        const crossingDate = new Date(startMs + ((endMs - startMs) * ratio)).toISOString()
        const crossingActualValue = interpolateValueByDate(
          start.date,
          end.date,
          start.actualValue,
          end.actualValue,
          crossingDate,
        )
        const crossingForecastValue = interpolateValueByDate(
          start.date,
          end.date,
          start.forecastValue,
          end.forecastValue,
          crossingDate,
        )
        const crossingValue = crossingForecastValue
        const crossing: DailyRibbonEndpoint = {
          date: crossingDate,
          actualValue: crossingActualValue,
          forecastValue: crossingValue,
        }

        overlays.push(createLocalDeltaOverlay(startSign, start, crossing))
        overlays.push(createLocalDeltaOverlay(endSign, crossing, end))
      }
    }
  }

  return overlays
}

export function buildForecastPortfolioPayload({
  basePayload,
  locale,
  model,
  currentResult,
  verificationResult,
  verificationHorizon,
}: {
  basePayload: TimeSeriesViewerPayload | null
  locale: TimeSeriesViewerLocale
  model: ForecastPortfolioModelId
  currentResult: BenchmarkForecastCurrentAvailableResult | null
  verificationResult: BenchmarkForecastVerificationAvailableResult | null
  verificationHorizon: string
}) {
  if (!basePayload) {
    return null
  }

  const series = [...basePayload.series]
  let deltaOverlays: TimeSeriesViewerDeltaOverlay[] = []
  let forecastOrigin = basePayload.forecastOrigin
  let verificationTargetBasis: ForecastTargetBasis | null = null

  if (verificationResult) {
    const selectedVerification = verificationResult.verification[verificationHorizon]

    if (selectedVerification) {
      verificationTargetBasis = verificationResult.targetBasis
      const verificationRecords = collectVerificationDisplayRecordsForTargetBasis(verificationResult.targetBasis, selectedVerification.records)

      if (verificationRecords !== null) {
        const monthlyActualSeries = verificationResult.targetBasis === 'POINT_IN_TIME'
          ? null
          : verificationResult.targetBasis === 'END_OF_PERIOD'
            ? buildEndOfPeriodActualSeries(basePayload, locale, model, verificationRecords)
            : buildMonthlyActualSeries(basePayload, locale, model, verificationResult.targetBasis, verificationRecords)
        const verificationSeries = verificationResult.targetBasis === 'POINT_IN_TIME'
          ? buildPointInTimeVerificationSeries(basePayload, locale, model, verificationRecords)
          : buildVerificationSeries(basePayload, locale, model, verificationResult.targetBasis, verificationRecords)

        if (monthlyActualSeries) {
          series.push(monthlyActualSeries)
        }

        if (verificationSeries) {
          series.push(verificationSeries)
          deltaOverlays = verificationResult.targetBasis === 'END_OF_PERIOD' || verificationResult.targetBasis === 'POINT_IN_TIME'
            ? buildEndOfPeriodDeltaOverlays(basePayload, verificationRecords)
            : buildDeltaOverlays(verificationRecords)
        }
      }
    }
  }

  if (currentResult) {
    if (currentResult.targetBasis === 'POINT_IN_TIME' && currentResult.rollingDailySnapshot) {
      series.push(...buildPointInTimeCurrentForecastSeries(basePayload, locale, model, currentResult))
    } else {
      series.push(buildCurrentForecastSeries(basePayload, locale, model, currentResult))
    }

    if (currentResult.forecastOrigin) {
      forecastOrigin = {
        date: currentResult.targetBasis === 'POINT_IN_TIME'
          ? normalizePointInTimeDisplayDate(currentResult.forecastOrigin)
          : toMonthEndDisplayDate(currentResult.forecastOrigin),
        label: `${locale === 'pl' ? 'Forecast Origin' : 'Forecast origin'} · ${currentResult.targetBasis === 'POINT_IN_TIME' ? formatDayLabel(locale, currentResult.forecastOrigin) : formatMonthLabel(locale, currentResult.forecastOrigin)}`,
      }
    }
  }

  return {
    ...basePayload,
    series,
    forecastOrigin,
    verificationTargetBasis,
    deltaOverlays,
  }
}
