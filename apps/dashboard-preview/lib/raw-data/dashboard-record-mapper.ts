import { toScenarioLabel } from '@/lib/i18n/ui-labels'
import type {
  BackingRecord,
  ChartReadyPoint,
  ComponentBenchmarkVariant,
  ComponentListItem,
  RecordDetail,
  SeriesSelection,
} from '@/lib/time-series/series-contract'

type JsonObject = Record<string, unknown>

export interface DashboardRecordSource {
  id: string
  organizationId: string
  sourceId: string
  datasetId: string
  pipelineId: string
  latestRunId: string
  dedupeKey: string
  scenarioType: string
  componentId: string
  componentName: string
  componentCode: string | null
  metricValue: { toString(): string } | number | string | null
  unit: string | null
  currency: string | null
  sourceDate: Date | string | null
  market: string | null
  country: string | null
  qualityStatus: string | null
  duplicateStatus: string | null
  rawRecordCount: number
  duplicateCount: number
  lineageJson: unknown
  metadataJson: unknown
  lastSyncedAt: Date | string
}

export interface MapperLocaleContext {
  locale: 'pl' | 'en'
}

export interface BusinessSafeDashboardRecord {
  scenarioType: string
  scenarioLabel: string
  componentName: string
  componentCode: string | null
  metricValue: number | null
  sourceDate: string | null
  descriptionPl: string | null
  descriptionEn: string | null
  lciValue: number | null
  uciValue: number | null
  diff: number | null
  rawFields: Record<string, unknown>
  topLevelTrustFlags: {
    scenarioTypeFromFallback: boolean
    componentNameFromFallback: boolean
    componentCodeFromFallback: boolean
    metricValueFromFallback: boolean
  }
}

const FIELD_CONTAINERS = ['fields', 'rawFields', 'normalizedFields', 'sourceFields', 'payload'] as const

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function coerceRecord(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {}
}

function readNestedFieldCarrier(value: unknown): Record<string, unknown> {
  const source = coerceRecord(value)

  for (const key of FIELD_CONTAINERS) {
    if (isJsonObject(source[key])) {
      return source[key] as Record<string, unknown>
    }
  }

  return source
}

function parseTupleCarrierString(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') {
    return {}
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith('[[') || !trimmed.endsWith(']]')) {
    return {}
  }

  try {
    const parsed = JSON.parse(trimmed)

    if (!Array.isArray(parsed)) {
      return {}
    }

    const entries = parsed.flatMap((item) => {
      if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== 'string') {
        return []
      }

      return [[item[0], item[1]] as const]
    })

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function readRecordCarrierFields(record: DashboardRecordSource): Record<string, unknown> {
  const lineage = coerceRecord(record.lineageJson)

  return {
    ...parseTupleCarrierString(record.dedupeKey),
    ...parseTupleCarrierString(record.componentId),
    ...parseTupleCarrierString(lineage.duplicateKey),
    ...readNestedFieldCarrier(record.metadataJson),
    ...readNestedFieldCarrier(record.lineageJson),
  }
}

function readSupplementalField(record: DashboardRecordSource, candidateKeys: string[]): unknown {
  const source = readRecordCarrierFields(record)

  for (const key of candidateKeys) {
    if (key in source) {
      return source[key]
    }
  }

  return undefined
}

function readTopLevelScenarioType(value: string): string | null {
  const normalized = normalizeString(value)

  if (normalized?.toUpperCase() === 'UNCLASSIFIED') {
    return null
  }

  return normalized
}

function readTopLevelComponentName(value: string): string | null {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  if (/^record-\d+$/i.test(normalized)) {
    return null
  }

  return normalized
}

function readTopLevelComponentId(value: string): string | null {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  if (normalized.startsWith('[[') && normalized.endsWith(']]')) {
    return null
  }

  return normalized
}

function readTopLevelSourceDate(value: Date | string | null): string | null {
  return normalizeIsoDate(value)
}

function readRawFields(record: DashboardRecordSource): Record<string, unknown> {
  return {
    ...readRecordCarrierFields(record),
  }
}

function readFallbackTrustFlag(topLevelValue: unknown, fallbackValue: unknown): boolean {
  if (topLevelValue === null || topLevelValue === undefined) {
    return fallbackValue !== null && fallbackValue !== undefined
  }

  return false
}

function readScenarioFallbackUsed(record: DashboardRecordSource, fallbackScenarioType: string | null) {
  return readTopLevelScenarioType(record.scenarioType) === null && fallbackScenarioType !== null
}

function readComponentNameFallbackUsed(record: DashboardRecordSource, fallbackComponentName: string | null) {
  return readTopLevelComponentName(record.componentName) === null && fallbackComponentName !== null
}

function readComponentCodeFallbackUsed(record: DashboardRecordSource, fallbackComponentCode: string | null) {
  return normalizeString(record.componentCode) === null && fallbackComponentCode !== null
}

function readMetricValueFallbackUsed(record: DashboardRecordSource, fallbackMetricValue: number | null) {
  return normalizeNumber(record.metricValue) === null && fallbackMetricValue !== null
}

function readSourceDateFallbackUsed(record: DashboardRecordSource, fallbackSourceDate: string | null) {
  return readTopLevelSourceDate(record.sourceDate) === null && fallbackSourceDate !== null
}

function readSupplementalSourceDate(record: DashboardRecordSource): string | null {
  const value = readSupplementalField(record, ['date', 'DATE'])

  if (value instanceof Date || typeof value === 'string' || value === null) {
    return normalizeIsoDate(value)
  }

  return null
}

function readBusinessSourceDate(record: DashboardRecordSource): string | null {
  return readTopLevelSourceDate(record.sourceDate) ?? readSupplementalSourceDate(record)
}

function readBusinessComponentId(record: DashboardRecordSource): string | null {
  return readTopLevelComponentId(record.componentId)
}

function readBusinessScenarioType(record: DashboardRecordSource): string {
  return readTopLevelScenarioType(record.scenarioType) ?? normalizeString(readSupplementalField(record, ['valueType', 'VALUE_TYPE'])) ?? 'UNCLASSIFIED'
}

function readBusinessComponentName(record: DashboardRecordSource): string {
  return readTopLevelComponentName(record.componentName)
    ?? normalizeString(readSupplementalField(record, ['nazwaSkAdnika', 'nazwaSkladnika', 'Nazwa składnika']))
    ?? 'unknown-component'
}

function readBusinessComponentCode(record: DashboardRecordSource): string | null {
  return normalizeString(record.componentCode) ?? normalizeString(readSupplementalField(record, ['indeks', 'Indeks']))
}

function readBusinessMetricValue(record: DashboardRecordSource): number | null {
  return normalizeNumber(record.metricValue) ?? normalizeNumber(readSupplementalField(record, ['value', 'VALUE']))
}

function readBusinessDescriptions(record: DashboardRecordSource) {
  return {
    descriptionPl: normalizeString(readSupplementalField(record, ['descriptionPl', 'DESCRIPTION_PL'])),
    descriptionEn: normalizeString(readSupplementalField(record, ['descriptionEng', 'DESCRIPTION_ENG'])),
  }
}

function readBusinessForecastFields(record: DashboardRecordSource) {
  return {
    lciValue: normalizeNumber(readSupplementalField(record, ['lciValue', 'LCI_VALUE'])),
    uciValue: normalizeNumber(readSupplementalField(record, ['uciValue', 'UCI_VALUE'])),
    diff: normalizeNumber(readSupplementalField(record, ['diff', '% DIFF'])),
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (typeof value === 'object' && value !== null && 'toString' in value && typeof value.toString === 'function') {
    const parsed = Number(value.toString())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeIsoDate(value: Date | string | null): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function toBusinessSafeDashboardRecord(
  record: DashboardRecordSource,
  context: MapperLocaleContext,
): BusinessSafeDashboardRecord {
  const scenarioType = readBusinessScenarioType(record)
  const componentName = readBusinessComponentName(record)
  const componentCode = readBusinessComponentCode(record)
  const metricValue = readBusinessMetricValue(record)
  const sourceDate = readBusinessSourceDate(record)
  const descriptions = readBusinessDescriptions(record)
  const forecastFields = readBusinessForecastFields(record)

  return {
    scenarioType,
    scenarioLabel: toScenarioLabel(context.locale, scenarioType),
    componentName,
    componentCode,
    metricValue,
    sourceDate,
    descriptionPl: descriptions.descriptionPl,
    descriptionEn: descriptions.descriptionEn,
    lciValue: forecastFields.lciValue,
    uciValue: forecastFields.uciValue,
    diff: forecastFields.diff,
    rawFields: readRawFields(record),
    topLevelTrustFlags: {
      scenarioTypeFromFallback: readScenarioFallbackUsed(record, scenarioType),
      componentNameFromFallback: readComponentNameFallbackUsed(record, componentName),
      componentCodeFromFallback: readComponentCodeFallbackUsed(record, componentCode),
      metricValueFromFallback: readMetricValueFallbackUsed(record, metricValue),
    },
  }
}

export function toBackingRecord(record: DashboardRecordSource, context: MapperLocaleContext): BackingRecord {
  const mapped = toBusinessSafeDashboardRecord(record, context)

  return {
    id: record.id,
    dedupeKey: record.dedupeKey,
    componentName: mapped.componentName,
    componentCode: mapped.componentCode,
    scenarioType: mapped.scenarioType,
    scenarioLabel: mapped.scenarioLabel,
    metricValue: mapped.metricValue,
    sourceDate: mapped.sourceDate,
    unit: record.unit,
    currency: record.currency,
    market: record.market,
    country: record.country,
    qualityStatus: record.qualityStatus,
    duplicateStatus: record.duplicateStatus,
    forecastLower: mapped.lciValue,
    forecastUpper: mapped.uciValue,
  }
}

export function toChartReadyPoint(record: DashboardRecordSource, context: MapperLocaleContext): ChartReadyPoint {
  const mapped = toBusinessSafeDashboardRecord(record, context)

  return {
    date: mapped.sourceDate ?? new Date(0).toISOString(),
    value: mapped.metricValue,
    diff: mapped.diff,
    recordId: record.id,
    dedupeKey: record.dedupeKey,
  }
}

export function toRecordDetail(record: DashboardRecordSource, context: MapperLocaleContext): RecordDetail {
  const mapped = toBusinessSafeDashboardRecord(record, context)

  return {
    ...toBackingRecord(record, context),
    organizationId: record.organizationId,
    sourceId: record.sourceId,
    datasetId: record.datasetId,
    pipelineId: record.pipelineId,
    latestRunId: record.latestRunId,
    rawRecordCount: record.rawRecordCount,
    duplicateCount: record.duplicateCount,
    descriptionPl: mapped.descriptionPl,
    descriptionEn: mapped.descriptionEn,
    forecastLower: mapped.lciValue,
    forecastUpper: mapped.uciValue,
    forecastAccuracyDiff: mapped.diff,
    lineageJson: record.lineageJson,
    metadataJson: record.metadataJson,
    rawFields: mapped.rawFields,
    lastSyncedAt: normalizeIsoDate(record.lastSyncedAt) ?? new Date(0).toISOString(),
  }
}

export function toComponentListItem(records: DashboardRecordSource[], context: MapperLocaleContext): ComponentListItem {
  const mapped = records.map((record) => ({
    raw: record,
    business: toBusinessSafeDashboardRecord(record, context),
  }))
  const [first] = mapped

  const availableBenchmarks = new Map<string, ComponentBenchmarkVariant>()
  let latestHistoricalDate: string | null = null
  let latestForecastDate: string | null = null
  let hasHistorical = false
  let hasForecast = false

  for (const item of mapped) {
    const benchmarkKey = item.business.componentCode ?? '__null__'

    if (!availableBenchmarks.has(benchmarkKey)) {
      availableBenchmarks.set(benchmarkKey, {
        componentCode: item.business.componentCode,
        sourceLabel: item.raw.sourceId,
        descriptionPlAvailable: item.business.descriptionPl !== null,
        descriptionEnAvailable: item.business.descriptionEn !== null,
      })
    }

    if (item.business.scenarioType.trim().toLowerCase() === 'historical') {
      hasHistorical = true
      if (item.business.sourceDate && (!latestHistoricalDate || item.business.sourceDate > latestHistoricalDate)) {
        latestHistoricalDate = item.business.sourceDate
      }
    }

    if (item.business.scenarioType.trim().toLowerCase() === 'forecast') {
      hasForecast = true
      if (item.business.sourceDate && (!latestForecastDate || item.business.sourceDate > latestForecastDate)) {
        latestForecastDate = item.business.sourceDate
      }
    }
  }

  return {
    componentName: first?.business.componentName ?? 'unknown-component',
    componentId: first ? readBusinessComponentId(first.raw) : null,
    benchmarkCount: availableBenchmarks.size,
    availableBenchmarks: Array.from(availableBenchmarks.values()).sort((left, right) =>
      (left.componentCode ?? '').localeCompare(right.componentCode ?? ''),
    ),
    hasHistorical,
    hasForecast,
    latestHistoricalDate,
    latestForecastDate,
  }
}

export function toSeriesSelection(record: DashboardRecordSource | null, context: MapperLocaleContext): SeriesSelection | null {
  if (!record) {
    return null
  }

  const mapped = toBusinessSafeDashboardRecord(record, context)

  return {
    componentName: mapped.componentName,
    componentId: readBusinessComponentId(record),
    componentCode: mapped.componentCode,
    sourceLabel: record.sourceId,
  }
}
