export type BenchmarkProviderCode = 'MACROBOND'

export type BenchmarkRangePreset = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL'

export type BenchmarkMetadataValue = {
  value: string
  label: string
}

export type BenchmarkMetadataControlType = 'single-select' | 'multi-select'

export type BenchmarkMetadataCategory = 'business' | 'technical'

export type BenchmarkMetadataDefinition = {
  key: string
  label: string
  description: string | null
  searchable: boolean
  featured: boolean
  category: BenchmarkMetadataCategory
  controlType: BenchmarkMetadataControlType
  allowMultipleValues: boolean
  providerKey: string
}

export type BenchmarkSearchFilter = {
  metadataKey: string
  operator: 'equals'
  value?: string
  values?: string[]
}

export type BenchmarkSearchRequest = {
  query?: string
  exactSeriesId?: string
  filters?: BenchmarkSearchFilter[]
  limit?: number
}

export interface ProviderRef {
  providerCode: BenchmarkProviderCode
  displayName: string
}

export interface ProviderSeriesRef {
  provider: ProviderRef
  providerSeriesId: string
  providerSeriesKey?: string | null
}

export interface BenchmarkSemanticEntity {
  id: string | null
  label: string | null
  description: string | null
  domicile: string | null
  infoUrl: string | null
  historyUrl: string | null
  methodologyUrl: string | null
  calendarUrl: string | null
  lastReleaseAt: string | null
  nextReleaseAt: string | null
}

export interface BenchmarkSemanticContext {
  primaryTitle: string | null
  description: string | null
  fullDescription: string | null
  hierarchy: string[]
  path: string[]
  source: BenchmarkSemanticEntity | null
  release: BenchmarkSemanticEntity | null
  category: BenchmarkSemanticEntity | null
  alternativeCategories: BenchmarkSemanticEntity[]
  concept: BenchmarkSemanticEntity | null
  technicalMetadata: Record<string, string | string[]>
}

export interface BenchmarkCandidate {
  candidateId: string
  displayName: string
  description: string | null
  provider: ProviderRef
  providerSeries: ProviderSeriesRef
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  region: string | null
  titleUnit?: string | null
  lastObservationDate?: string | null
  exactMatch?: boolean
  metadata?: Record<string, string | string[]>
  semanticContext?: BenchmarkSemanticContext | null
  aiScore?: number
  aiReason?: string | null
  recommendedRank?: number
}

export interface BenchmarkSearchIntent {
  concept: string
  searchTerms: string[]
  region: string | null
  market: string | null
  instrumentType: string | null
  currency: string | null
  frequency: string | null
  useCase: string | null
  industryContext: string | null
  interpretation: string
  confidence: number
}

export interface BenchmarkAiSearchResult {
  intent: BenchmarkSearchIntent
  candidates: BenchmarkCandidate[]
}

export interface BenchmarkPreviewPoint {
  date: string
  value: number | null
}

export interface BenchmarkPreviewResult {
  providerSeries: ProviderSeriesRef
  displayName: string
  latestValue: number | null
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  range: BenchmarkRangePreset
  changeMetrics: Partial<Record<'1M' | '3M' | '1Y', number>>
  historical: BenchmarkPreviewPoint[]
}

export interface BenchmarkHistoricalSeriesResult {
  providerSeries: ProviderSeriesRef
  displayName: string
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  historical: BenchmarkPreviewPoint[]
}

export interface BenchmarkAnalyticsSeriesResult {
  providerSeries: ProviderSeriesRef
  displayName: string
  latestValue: number | null
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  range: BenchmarkRangePreset
  historical: BenchmarkPreviewPoint[]
}

export interface SavedBenchmark {
  selectionId: string
  businessBenchmarkId: string
  organizationId: string
  displayName: string
  provider: ProviderRef
  providerSeries: ProviderSeriesRef
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
  selectedAt: string
}