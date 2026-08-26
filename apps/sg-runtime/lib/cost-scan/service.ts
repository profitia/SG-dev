import type { BenchmarkPreviewPoint } from '@/lib/benchmark/contracts'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { getBenchmarkHistory } from '@/lib/benchmark/service'
import { getCategory } from '@/lib/category/service'
import type {
  CategoryCostScanResult,
  CostScanComponentDataStatus,
  CostScanComponentResult,
  CostScanDriverResult,
  CostScanRangePreset,
} from '@/lib/cost-scan/contracts'
import { CostScanAppError } from '@/lib/cost-scan/errors'
import {
  calculateBenchmarkChangePercent,
  calculateCategoryMovementPercent,
  calculateContributionPercentagePoints,
  deriveCostPressureDirection,
  findMainDownwardDriver,
  findMainUpwardDriver,
} from '@/lib/cost-scan/math'

type ResolvedPoint = {
  date: string
  value: number
}

const RANGE_DAYS: Record<CostScanRangePreset, number> = {
  '1M': 31,
  '3M': 92,
  '6M': 183,
  '12M': 366,
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function buildRequestedWindow(range: CostScanRangePreset, now = new Date()) {
  const requestedEnd = new Date(now)
  const requestedStart = new Date(now)
  requestedStart.setUTCDate(requestedStart.getUTCDate() - RANGE_DAYS[range])

  return {
    requestedStart,
    requestedEnd,
    requestedStartLabel: toIsoDate(requestedStart),
    requestedEndLabel: toIsoDate(requestedEnd),
  }
}

function toResolvedPoints(points: BenchmarkPreviewPoint[]) {
  return points
    .filter((point): point is ResolvedPoint => {
      if (point.value === null || !Number.isFinite(point.value)) {
        return false
      }

      return !Number.isNaN(new Date(point.date).getTime())
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}

function findFirstPointOnOrAfter(points: ResolvedPoint[], thresholdTime: number) {
  return points.find((point) => new Date(point.date).getTime() >= thresholdTime) ?? null
}

function findLastPointOnOrBefore(points: ResolvedPoint[], thresholdTime: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]
    if (new Date(point.date).getTime() <= thresholdTime) {
      return point
    }
  }

  return null
}

function createUnavailableComponentResult(params: {
  costComponentId: string
  name: string
  businessBenchmarkId: string
  benchmarkDisplayName: string
  weightPercent: number
  requestedRange: CostScanRangePreset
  currency: string | null
  unit: string | null
  frequency: string | null
  dataStatus: CostScanComponentDataStatus
  dataAsOf?: string | null
}) : CostScanComponentResult {
  return {
    costComponentId: params.costComponentId,
    name: params.name,
    businessBenchmarkId: params.businessBenchmarkId,
    benchmarkDisplayName: params.benchmarkDisplayName,
    weightPercent: params.weightPercent,
    requestedRange: params.requestedRange,
    startDate: null,
    startValue: null,
    endDate: null,
    endValue: null,
    benchmarkChangePercent: null,
    contributionPercentagePoints: null,
    currency: params.currency,
    unit: params.unit,
    frequency: params.frequency,
    dataStatus: params.dataStatus,
    dataAsOf: params.dataAsOf ?? null,
  }
}

function toDriverResult(component: CostScanComponentResult & { contributionPercentagePoints: number }): CostScanDriverResult {
  return {
    costComponentId: component.costComponentId,
    name: component.name,
    benchmarkDisplayName: component.benchmarkDisplayName,
    contributionPercentagePoints: component.contributionPercentagePoints,
  }
}

async function scanCategoryComponent(params: {
  costComponentId: string
  name: string
  businessBenchmarkId: string
  benchmarkDisplayName: string
  weightPercent: number
  providerSeriesId: string
  currency: string | null
  unit: string | null
  frequency: string | null
  requestedRange: CostScanRangePreset
  requestedStart: Date
  requestedEnd: Date
}): Promise<CostScanComponentResult> {
  try {
    const history = await getBenchmarkHistory(params.providerSeriesId)
    const resolvedPoints = toResolvedPoints(history.historical)

    if (resolvedPoints.length < 2) {
      return createUnavailableComponentResult({
        ...params,
        currency: history.currency,
        unit: history.unit,
        frequency: history.frequency,
        dataStatus: 'INSUFFICIENT_DATA',
        dataAsOf: resolvedPoints.at(-1)?.date ?? null,
      })
    }

    const startPoint = findFirstPointOnOrAfter(resolvedPoints, params.requestedStart.getTime())
    const endPoint = findLastPointOnOrBefore(resolvedPoints, params.requestedEnd.getTime())

    if (!startPoint || !endPoint || startPoint.date === endPoint.date) {
      return createUnavailableComponentResult({
        ...params,
        currency: history.currency,
        unit: history.unit,
        frequency: history.frequency,
        dataStatus: 'INSUFFICIENT_DATA',
        dataAsOf: resolvedPoints.at(-1)?.date ?? null,
      })
    }

    const benchmarkChangePercent = calculateBenchmarkChangePercent(startPoint.value, endPoint.value)
    if (benchmarkChangePercent === null) {
      return createUnavailableComponentResult({
        ...params,
        currency: history.currency,
        unit: history.unit,
        frequency: history.frequency,
        dataStatus: 'UNSUPPORTED_CHANGE_CALCULATION',
        dataAsOf: endPoint.date,
      })
    }

    const contributionPercentagePoints = calculateContributionPercentagePoints(params.weightPercent, benchmarkChangePercent)
    if (contributionPercentagePoints === null) {
      return createUnavailableComponentResult({
        ...params,
        currency: history.currency,
        unit: history.unit,
        frequency: history.frequency,
        dataStatus: 'UNSUPPORTED_CHANGE_CALCULATION',
        dataAsOf: endPoint.date,
      })
    }

    return {
      costComponentId: params.costComponentId,
      name: params.name,
      businessBenchmarkId: params.businessBenchmarkId,
      benchmarkDisplayName: params.benchmarkDisplayName,
      weightPercent: params.weightPercent,
      requestedRange: params.requestedRange,
      startDate: startPoint.date,
      startValue: startPoint.value,
      endDate: endPoint.date,
      endValue: endPoint.value,
      benchmarkChangePercent,
      contributionPercentagePoints,
      currency: history.currency,
      unit: history.unit,
      frequency: history.frequency,
      dataStatus: 'OK',
      dataAsOf: endPoint.date,
    }
  } catch (error) {
    if (error instanceof BenchmarkAppError) {
      return createUnavailableComponentResult({
        ...params,
        dataStatus: 'DATA_UNAVAILABLE',
      })
    }

    throw error
  }
}

export async function runCategoryCostScan(organizationId: string, categoryId: string, range: CostScanRangePreset): Promise<CategoryCostScanResult> {
  const category = await getCategory(organizationId, categoryId)
  if (category.status !== 'READY') {
    throw new CostScanAppError(
      'CATEGORY_NOT_READY_FOR_COST_SCAN',
      'Complete category allocation to 100% before running Cost Scan.',
      409,
    )
  }

  const requestedWindow = buildRequestedWindow(range)
  const components = await Promise.all(category.components.map((component) => scanCategoryComponent({
    costComponentId: component.id,
    name: component.name,
    businessBenchmarkId: component.benchmark.businessBenchmarkId,
    benchmarkDisplayName: component.benchmark.displayName,
    weightPercent: component.weightPercent,
    providerSeriesId: component.benchmark.providerSeries.providerSeriesId,
    currency: component.benchmark.currency,
    unit: component.benchmark.unit,
    frequency: component.benchmark.frequency,
    requestedRange: range,
    requestedStart: requestedWindow.requestedStart,
    requestedEnd: requestedWindow.requestedEnd,
  })))

  const completeComponents = components.filter(
    (component): component is CostScanComponentResult & { contributionPercentagePoints: number } =>
      component.dataStatus === 'OK' && component.contributionPercentagePoints !== null,
  )

  const dataComplete = completeComponents.length === components.length
  const categoryMovementPercent = dataComplete
    ? calculateCategoryMovementPercent(components.map((component) => component.contributionPercentagePoints))
    : null

  const mainUpwardCandidate = findMainUpwardDriver(completeComponents.map((component) => ({
    name: component.name,
    contributionPercentagePoints: component.contributionPercentagePoints,
  })))
  const mainDownwardCandidate = findMainDownwardDriver(completeComponents.map((component) => ({
    name: component.name,
    contributionPercentagePoints: component.contributionPercentagePoints,
  })))

  const mainUpwardDriver = mainUpwardCandidate
    ? toDriverResult(completeComponents.find((component) => component.name === mainUpwardCandidate.name && component.contributionPercentagePoints === mainUpwardCandidate.contributionPercentagePoints)!)
    : null

  const mainDownwardDriver = mainDownwardCandidate
    ? toDriverResult(completeComponents.find((component) => component.name === mainDownwardCandidate.name && component.contributionPercentagePoints === mainDownwardCandidate.contributionPercentagePoints)!)
    : null

  return {
    categoryId: category.id,
    categoryName: category.name,
    range,
    status: dataComplete && categoryMovementPercent !== null ? 'COMPLETE' : 'PARTIAL',
    categoryMovementPercent,
    requestedStart: requestedWindow.requestedStartLabel,
    requestedEnd: requestedWindow.requestedEndLabel,
    dataComplete,
    direction: deriveCostPressureDirection(categoryMovementPercent),
    components,
    mainUpwardDriver,
    mainDownwardDriver,
    incompleteComponentNames: components.filter((component) => component.dataStatus !== 'OK').map((component) => component.name),
  }
}