export interface ComponentBenchmarkVariant {
  componentCode: string | null
  sourceLabel: string | null
  descriptionPlAvailable: boolean
  descriptionEnAvailable: boolean
}

export interface ComponentListItem {
  componentName: string
  componentId: string | null
  benchmarkCount: number
  availableBenchmarks: ComponentBenchmarkVariant[]
  hasHistorical: boolean
  hasForecast: boolean
  latestHistoricalDate: string | null
  latestForecastDate: string | null
}

export interface ComponentListResponse {
  items: ComponentListItem[]
}

export interface ChartReadyPoint {
  date: string
  value: number | null
  diff: number | null
  recordId: string
  dedupeKey: string
}

export interface BackingRecord {
  id: string
  dedupeKey: string
  componentName: string
  componentCode: string | null
  scenarioType: string
  scenarioLabel: string
  metricValue: number | null
  sourceDate: string | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  duplicateStatus: string | null
  forecastLower: number | null
  forecastUpper: number | null
}

export interface RecordDetail extends BackingRecord {
  organizationId: string
  sourceId: string
  datasetId: string
  pipelineId: string
  latestRunId: string
  rawRecordCount: number
  duplicateCount: number
  descriptionPl: string | null
  descriptionEn: string | null
  forecastLower: number | null
  forecastUpper: number | null
  forecastAccuracyDiff: number | null
  lineageJson: unknown
  metadataJson: unknown
  rawFields: Record<string, unknown>
  lastSyncedAt: string
}

export interface SeriesSelection {
  componentName: string
  componentId: string | null
  componentCode: string | null
  sourceLabel: string | null
}

export interface ForecastSeriesLayer {
  from: string | null
  to: string | null
  central: ChartReadyPoint[]
  upper: ChartReadyPoint[]
  lower: ChartReadyPoint[]
}

export interface SeriesSourceInfo {
  benchmarkCode: string | null
  sourceLabel: string | null
  descriptionPl: string | null
  descriptionEn: string | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  lastSyncedAt: string | null
}

export interface SeriesDetailSummary {
  componentName: string
  componentCode: string | null
  sourceDate: string | null
  scenarioType: string
  metricValue: number | null
  forecastLower: number | null
  forecastUpper: number | null
  forecastAccuracyDiff: number | null
  unit: string | null
  currency: string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  descriptionPl: string | null
  descriptionEn: string | null
  sourceLabel: string | null
  lastSyncedAt: string | null
}

export interface ForecastAnchor {
  date: string | null
  value: number | null
}

export interface SeriesResponse {
  selection: SeriesSelection | null
  benchmarkSelectionRequired: boolean
  availableBenchmarks: ComponentBenchmarkVariant[]
  sourceInfo: SeriesSourceInfo | null
  detailSummary: SeriesDetailSummary | null
  forecastAnchor: ForecastAnchor | null
  historicalWindow: {
    from: string | null
    to: string | null
  }
  historical: ChartReadyPoint[]
  forecast: ForecastSeriesLayer | null
}

export interface RecordsResponse {
  rows: BackingRecord[]
  detail: RecordDetail | null
}
