import type { ProviderRef, ProviderSeriesRef } from '@/lib/benchmark/contracts'

export type CategoryStatus = 'DRAFT' | 'READY'

export interface CategoryBenchmarkRef {
  businessBenchmarkId: string
  displayName: string
  provider: ProviderRef
  providerSeries: ProviderSeriesRef
  frequency: string | null
  currency: string | null
  unit: string | null
  source: string | null
}

export interface CategoryCostComponentRecord {
  id: string
  name: string
  position: number
  weightPercent: number
  benchmark: CategoryBenchmarkRef
}

export interface CategoryRecord {
  id: string
  organizationId: string
  name: string
  status: CategoryStatus
  componentCount: number
  allocatedPercent: number
  remainingPercent: number
  createdAt: string
  updatedAt: string
  components: CategoryCostComponentRecord[]
}

export interface CategorySummary {
  id: string
  name: string
  status: CategoryStatus
  componentCount: number
  updatedAt: string
}

export interface CategoryComponentSuggestion {
  id: string
  name: string
  rationale: string
  benchmarkNeed: string
  searchSeeds?: string[]
}

export interface CategorySuggestionResult {
  categoryInterpretation: string | null
  components: CategoryComponentSuggestion[]
}