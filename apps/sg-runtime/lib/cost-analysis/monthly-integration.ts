import { createHash } from 'node:crypto'
import { calculateCci, CciValidationError } from './cci'
import type { CciInput, CciResult } from './contracts'
import { prepareCciMarketData } from './market-data-adapter'
import type { CciAlignmentResult, CciMarketDataRequest, CciPreparationMethod } from './market-data-contracts'
import { CciMarketDataValidationError } from './node-alignment'

const limitations = [
  'PRE_BASE_CALCULATION_DEFERRED_TO_TASK_02B',
  'NATIVE_CURRENCY_RELATIVES_NO_FX',
  'RETROSPECTIVE_CURRENT_HISTORY_NOT_HISTORICAL_AS_OF',
  'PROVENANCE_NOT_IMMUTABLE_SNAPSHOT',
  'ECONOMIC_QUALIFICATION_AND_APPROVAL_REFERENCES_SUPPLIED_BY_CALLER',
] as const

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Freeze only objects owned by this integration, never the caller's request. */
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

function preparationDefinition(alignment: CciAlignmentResult) {
  return {
    mappingVersion: 'CCI_MONTHLY_MAPPING_V1' as const,
    alignmentVersion: alignment.methodologyVersion,
    calendar: 'UTC_CALENDAR' as const,
    nodeBasis: alignment.nodeBasis,
    currencyPolicy: 'NATIVE_CURRENCY_RELATIVES' as const,
    missingDataPolicy: 'NULL_WITHOUT_FILL_OR_REWEIGHT' as const,
    components: [...alignment.series].sort((a, b) => compare(a.componentId, b.componentId)).map(series => {
      const methods = new Map<string, CciPreparationMethod>()
      for (const node of alignment.nodes) {
        const component = node.components.find(value => value.componentId === series.componentId)
        if (component?.method) {
          const { id, version, approvalRef } = component.method
          const method = { id, version, approvalRef }
          methods.set(JSON.stringify(method), method)
        }
      }
      const { valueKind, periodBasis, calendar, evidenceRef } = series.qualification
      const policy = series.preparationPolicy
      return {
        componentId: series.componentId,
        provider: series.provider,
        seriesId: series.seriesId,
        nativeCadence: series.nativeCadence,
        excludedZeroWeight: series.weightPercent === 0,
        qualification: { valueKind, periodBasis, calendar, evidenceRef },
        reductionPolicy: policy.method === 'NATIVE_ONLY' ? { method: policy.method } : { method: policy.method, approvalRef: policy.approvalRef },
        // Include every actual method/version/approval, including those used before base.
        methods: [...methods.entries()].sort(([a], [b]) => compare(a, b)).map(([, method]) => method),
      }
    }),
  }
}

export interface CciMonthlyMethodology {
  readonly id: string
  readonly scope: 'PREPARATION_METHODOLOGY_NOT_IMMUTABLE_SNAPSHOT'
  readonly definition: ReturnType<typeof preparationDefinition>
}

interface MonthlyContext {
  /** Original prepared alignment, copied by the adapter and recursively frozen here. */
  readonly alignment: CciAlignmentResult | null
  readonly limitations: readonly string[]
}

export interface CciMonthlyPrepared extends MonthlyContext {
  readonly status: 'PREPARED'
  readonly alignment: CciAlignmentResult
  readonly completeness: 'COMPLETE' | 'INCOMPLETE'
  readonly cciInput: CciInput
  readonly calculation: null
  readonly methodology: CciMonthlyMethodology
  readonly periods: { readonly prepared: readonly string[]; readonly calculated: readonly [] }
}

export interface CciMonthlyCalculated extends MonthlyContext {
  readonly status: 'CALCULATED'
  readonly alignment: CciAlignmentResult
  readonly completeness: CciResult['status']
  readonly cciInput: CciInput
  readonly calculation: CciResult
  readonly methodology: CciMonthlyMethodology
  readonly periods: { readonly prepared: readonly string[]; readonly calculated: readonly string[] }
}

export interface CciMonthlyRefusal extends MonthlyContext {
  readonly status: 'REFUSED'
  readonly completeness: null
  readonly cciInput: null
  readonly calculation: null
  readonly methodology: null
  readonly reason: 'INVALID_MARKET_DATA' | 'ALIGNMENT_BLOCKED' | 'CORE_CADENCE_NOT_SUPPORTED' | 'INVALID_MONTHLY_MAPPING' | 'CORE_VALIDATION_FAILED'
  readonly issues: readonly { readonly code: string; readonly message: string; readonly componentId?: string; readonly period?: string }[]
}

function refuse(reason: CciMonthlyRefusal['reason'], issues: CciMonthlyRefusal['issues'], alignment: CciAlignmentResult | null): CciMonthlyRefusal {
  return freeze({ status: 'REFUSED', completeness: null, cciInput: null, calculation: null, methodology: null, reason, issues, alignment, limitations })
}

/** Validate the mapping boundary; do not reinterpret, fill or resample any node. */
function validMonthlyAlignment(alignment: CciAlignmentResult): boolean {
  const base = alignment.nodes.find(node => node.period.start === alignment.baseNodeStart)
  return base?.status === 'COMPLETE' && alignment.nodes.every(node => {
    const start = node.period.start
    const end = new Date(start)
    end.setUTCMonth(end.getUTCMonth() + 1)
    return node.period.cadence === 'MONTHLY' && /^\d{4}-(0[1-9]|1[0-2])-01T00:00:00\.000Z$/.test(start)
      && node.period.endExclusive === end.toISOString() && node.period.endExclusive <= alignment.cutoff
      && node.components.every(component => component.status !== 'COMPLETE'
        || (component.value !== null && Number.isFinite(component.value) && component.value > 0
          && component.method !== null && [component.method.id, component.method.version, component.method.approvalRef]
            .every(value => value.length > 0 && value.trim() === value)))
  })
}

/** Preparation is not calculation. Malformed requests and unsupported policies fail closed. */
export function prepareMonthlyCciInput(request: CciMarketDataRequest): CciMonthlyPrepared | CciMonthlyRefusal {
  let alignment: CciAlignmentResult
  try {
    alignment = prepareCciMarketData(request)
  } catch (error) {
    if (!(error instanceof CciMarketDataValidationError)) throw error
    return refuse('INVALID_MARKET_DATA', [{ code: error.code, message: error.message,
      ...(error.componentId === undefined ? {} : { componentId: error.componentId }) }], null)
  }
  if (alignment.issues.length || !['COMPLETE', 'INCOMPLETE'].includes(alignment.status)
    || alignment.currencyStatus !== 'NATIVE_RELATIVES_FX_NOT_APPLIED'
    || alignment.availability.requested !== 'RETROSPECTIVE_CURRENT_HISTORY') {
    return refuse('ALIGNMENT_BLOCKED', alignment.issues, alignment)
  }
  if (alignment.analysisCadence !== 'MONTHLY') return refuse('CORE_CADENCE_NOT_SUPPORTED', [{
    code: 'CORE_CADENCE_NOT_SUPPORTED', message: 'The existing CCI Core accepts monthly nodes only; native cadence is preserved.',
  }], alignment)
  if (!validMonthlyAlignment(alignment)) return refuse('INVALID_MONTHLY_MAPPING', [{
    code: 'INVALID_MONTHLY_MAPPING', message: 'A closed, complete monthly base and explicit preparation methods are required.',
  }], alignment)

  const definition = preparationDefinition(alignment)
  const id = `cci-monthly-preparation-v1:${createHash('sha256').update(JSON.stringify(definition)).digest('hex')}`
  const cciInput: CciInput = {
    basePeriod: alignment.baseNodeStart.slice(0, 7),
    inputSemantics: { frequency: 'MONTHLY', monthlyPreparationPolicyId: id, currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
    components: alignment.series.map(series => ({ componentId: series.componentId, weightPercent: series.weightPercent,
      observations: alignment.nodes.map(node => ({ period: node.period.start.slice(0, 7),
        value: node.components.find(component => component.componentId === series.componentId)!.value })) })),
  }
  return freeze({ status: 'PREPARED', completeness: alignment.status as 'COMPLETE' | 'INCOMPLETE', alignment, cciInput,
    calculation: null, methodology: { id, scope: 'PREPARATION_METHODOLOGY_NOT_IMMUTABLE_SNAPSHOT', definition },
    periods: { prepared: alignment.nodes.map(node => node.period.start.slice(0, 7)), calculated: [] }, limitations })
}

/** Execute the original Core on the actual prepared levels; no duplicate index mathematics. */
export function calculateMonthlyCci(request: CciMarketDataRequest): CciMonthlyCalculated | CciMonthlyRefusal {
  const prepared = prepareMonthlyCciInput(request)
  if (prepared.status === 'REFUSED') return prepared
  try {
    const calculation = calculateCci(prepared.cciInput)
    return freeze({ ...prepared, status: 'CALCULATED', completeness: calculation.status, calculation,
      periods: { prepared: prepared.periods.prepared, calculated: calculation.monthly.map(month => month.period) } })
  } catch (error) {
    if (!(error instanceof CciValidationError)) throw error
    return refuse('CORE_VALIDATION_FAILED', [error.issue], prepared.alignment)
  }
}
