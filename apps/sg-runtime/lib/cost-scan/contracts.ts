import type { CostPressureDirection } from '@/lib/cost-scan/math'

export type CostScanRangePreset = '1M' | '3M' | '6M' | '12M'

export type CostScanComponentDataStatus =
  | 'OK'
  | 'DATA_UNAVAILABLE'
  | 'INSUFFICIENT_DATA'
  | 'UNSUPPORTED_CHANGE_CALCULATION'

export type CategoryCostScanStatus = 'COMPLETE' | 'PARTIAL'

export interface CostScanDriverResult {
  costComponentId: string
  name: string
  benchmarkDisplayName: string
  contributionPercentagePoints: number
}

export interface CostScanComponentResult {
  costComponentId: string
  name: string
  businessBenchmarkId: string
  benchmarkDisplayName: string
  weightPercent: number
  requestedRange: CostScanRangePreset
  startDate: string | null
  startValue: number | null
  endDate: string | null
  endValue: number | null
  benchmarkChangePercent: number | null
  contributionPercentagePoints: number | null
  currency: string | null
  unit: string | null
  frequency: string | null
  dataStatus: CostScanComponentDataStatus
  dataAsOf: string | null
}

export interface CategoryCostScanResult {
  categoryId: string
  categoryName: string
  range: CostScanRangePreset
  status: CategoryCostScanStatus
  categoryMovementPercent: number | null
  requestedStart: string
  requestedEnd: string
  dataComplete: boolean
  direction: CostPressureDirection | null
  components: CostScanComponentResult[]
  mainUpwardDriver: CostScanDriverResult | null
  mainDownwardDriver: CostScanDriverResult | null
  incompleteComponentNames: string[]
}