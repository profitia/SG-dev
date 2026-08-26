export type TimeSeriesViewerLocale = 'pl' | 'en'

export type TimeSeriesViewerSeriesKind =
  | 'historical'
  | 'monthly-actual'
  | 'historical-forecast'
  | 'forecast-central'
  | 'forecast-upper'
  | 'forecast-lower'

export type TimeSeriesViewerTemporalResolution = 'day' | 'month'

export type TimeSeriesViewerLineStyle = 'solid' | 'dashed'

export interface TimeSeriesViewerAxisTick {
  value: string | number
  label: string
  offset: number
}

export interface TimeSeriesViewerXAxis {
  type: 'time'
  labelFormat: 'MMM yy'
  ticks: TimeSeriesViewerAxisTick[]
}

export interface TimeSeriesViewerYAxis {
  type: 'value'
  unit: string | null
  currency: string | null
  ticks: TimeSeriesViewerAxisTick[]
}

export interface TimeSeriesViewerSourceInfo {
  benchmarkCode: string | null
  description: string | null
  sourceLabel: string | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  lastSyncedAt: string | null
}

export interface TimeSeriesViewerTooltipRow {
  label: string
  value: string
}

export interface TimeSeriesViewerTooltipModel {
  title: string
  rows: TimeSeriesViewerTooltipRow[]
}

export interface TimeSeriesViewerDetailModel {
  componentName: string
  benchmarkCode: string | null
  sourceDate: string | null
  temporalResolution: TimeSeriesViewerTemporalResolution
  scenarioType: string
  value: number | null
  forecastLower: number | null
  forecastUpper: number | null
  forecastAccuracyDiff: number | null
  description: string | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  sourceLabel: string | null
  lastSyncedAt: string | null
}

export interface TimeSeriesViewerDeltaOverlayPoint {
  date: string
  value: number
}

export interface TimeSeriesViewerDeltaOverlay {
  key: string
  sign: 'above' | 'below'
  points: TimeSeriesViewerDeltaOverlayPoint[]
}

export interface TimeSeriesViewerForecastOrigin {
  date: string
  label: string
}

export interface TimeSeriesViewerPoint {
  key: string
  date: string
  value: number | null
  diff: number | null
  recordId: string
  anchor: boolean
  tooltipModel: TimeSeriesViewerTooltipModel
  detailModel: TimeSeriesViewerDetailModel
}

export interface TimeSeriesViewerSeries {
  id: string
  kind: TimeSeriesViewerSeriesKind
  label: string
  lineStyle: TimeSeriesViewerLineStyle
  points: TimeSeriesViewerPoint[]
  segments?: TimeSeriesViewerPoint[][]
}

export interface TimeSeriesViewerForecastAnchor {
  date: string | null
  value: number | null
}

export interface TimeSeriesViewerPayload {
  title: string
  subtitle: string | null
  locale: TimeSeriesViewerLocale
  sourceInfo: TimeSeriesViewerSourceInfo | null
  benchmarkCode: string | null
  description: string | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  lastSyncedAt: string | null
  xAxis: TimeSeriesViewerXAxis
  yAxis: TimeSeriesViewerYAxis
  series: TimeSeriesViewerSeries[]
  forecastAnchor: TimeSeriesViewerForecastAnchor | null
  forecastOrigin: TimeSeriesViewerForecastOrigin | null
  verificationTargetBasis?: 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD' | null
  deltaOverlays: TimeSeriesViewerDeltaOverlay[]
  tooltipModel: TimeSeriesViewerTooltipModel | null
  detailModel: TimeSeriesViewerDetailModel | null
  events: []
}