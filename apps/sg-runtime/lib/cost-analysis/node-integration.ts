import { createHash } from 'node:crypto'
import { calculateCciNodes, CciNodeValidationError } from './cci-node-calculation'
import type { CciNodeInput, CciNodesResult, CciNodeValidationIssue } from './cci-node-contracts'
import { prepareCciMarketData } from './market-data-adapter'
import type { CciAlignmentResult, CciMarketDataRequest } from './market-data-contracts'
import { CciMarketDataValidationError } from './node-alignment'
import { freeze, preparationDefinition, type CciPreparationMethodology } from './preparation-context'

const limitations = [
  'NATIVE_CURRENCY_RELATIVES_NO_FX', 'RETROSPECTIVE_CURRENT_HISTORY_NOT_HISTORICAL_AS_OF',
  'PROVENANCE_NOT_IMMUTABLE_SNAPSHOT', 'ECONOMIC_QUALIFICATION_AND_APPROVAL_REFERENCES_SUPPLIED_BY_CALLER',
  'DAILY_REDUCTION_USES_AVAILABLE_SUPPLIED_OBSERVATIONS_NOT_VERIFIED_TRADING_CALENDAR',
] as const

interface Context {
  readonly alignment: CciAlignmentResult
  readonly cciInput: CciNodeInput
  readonly methodology: CciPreparationMethodology
  readonly limitations: readonly string[]
}
export interface CciNodesPrepared extends Context {
  readonly status: 'PREPARED'
  readonly completeness: 'COMPLETE' | 'INCOMPLETE'
  readonly calculation: null
}
export interface CciNodesCalculated extends Context {
  readonly status: 'CALCULATED'
  readonly completeness: CciNodesResult['status']
  readonly calculation: CciNodesResult
}
export interface CciNodesRefused {
  readonly status: 'REFUSED'
  readonly alignment: CciAlignmentResult | null
  readonly cciInput: null
  readonly calculation: null
  readonly reason: 'INVALID_MARKET_DATA' | 'ALIGNMENT_BLOCKED' | 'CORE_VALIDATION_FAILED'
  readonly issues: readonly { readonly code: string; readonly message: string; readonly componentId?: string; readonly period?: string }[]
  readonly limitations: readonly string[]
}
function refuse(reason: CciNodesRefused['reason'], issues: CciNodesRefused['issues'], alignment: CciAlignmentResult | null): CciNodesRefused {
  return freeze({ status: 'REFUSED', alignment, cciInput: null, calculation: null, reason, issues, limitations })
}

/** The adapter remains the sole owner of common-node alignment and reductions. */
export function prepareCciNodeInput(request: CciMarketDataRequest): CciNodesPrepared | CciNodesRefused {
  let alignment: CciAlignmentResult
  try {
    // This legacy flag describes the unchanged monthly API, not the new node Core.
    const { coreCompatibility: _monthlyCompatibility, ...prepared } = prepareCciMarketData(request)
    alignment = prepared
  } catch (error) {
    if (!(error instanceof CciMarketDataValidationError)) throw error
    return refuse('INVALID_MARKET_DATA', [{ code: error.code, message: error.message,
      ...(error.componentId === undefined ? {} : { componentId: error.componentId }) }], null)
  }
  if (alignment.issues.length || !['COMPLETE', 'INCOMPLETE'].includes(alignment.status) || alignment.analysisCadence === null
    || alignment.currencyStatus !== 'NATIVE_RELATIVES_FX_NOT_APPLIED' || alignment.availability.requested !== 'RETROSPECTIVE_CURRENT_HISTORY') {
    return refuse('ALIGNMENT_BLOCKED', alignment.issues, alignment)
  }
  const definition = preparationDefinition(alignment, 'CCI_NODE_MAPPING_V1')
  const id = `cci-node-preparation-v1:${createHash('sha256').update(JSON.stringify(definition)).digest('hex')}`
  const cciInput: CciNodeInput = { modelKey: alignment.modelKey, baseNodeStart: alignment.baseNodeStart,
    analysisCadence: alignment.analysisCadence, nodeBasis: alignment.nodeBasis, cutoff: alignment.cutoff,
    inputSemantics: { preparationPolicyId: id, currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
    components: alignment.series.map(({ componentId, weightPercent }) => ({ componentId, weightPercent })), nodes: alignment.nodes }
  return freeze({ status: 'PREPARED', completeness: alignment.status as 'COMPLETE' | 'INCOMPLETE', alignment, cciInput, calculation: null,
    methodology: { id, scope: 'PREPARATION_METHODOLOGY_NOT_IMMUTABLE_SNAPSHOT', definition }, limitations })
}

/** Real adapter-to-Core execution for every lawful native/common cadence, including pre-base nodes. */
export function calculateCciFromMarketData(request: CciMarketDataRequest): CciNodesCalculated | CciNodesRefused {
  const prepared = prepareCciNodeInput(request)
  if (prepared.status === 'REFUSED') return prepared
  try {
    const calculation = calculateCciNodes(prepared.cciInput)
    return freeze({ ...prepared, status: 'CALCULATED', completeness: calculation.status, calculation })
  } catch (error) {
    if (!(error instanceof CciNodeValidationError)) throw error
    const issue: CciNodeValidationIssue = error.issue
    return refuse('CORE_VALIDATION_FAILED', [issue], prepared.alignment)
  }
}
