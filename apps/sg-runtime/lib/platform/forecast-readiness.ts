import { z } from 'zod'
import { OperationDenied } from '@profitia/platform-contracts/operation-context'
import { ForecastCurrentSelection } from './forecast-current'
import { USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import { FORECAST_TARGET_SEMANTICS } from '@/lib/forecast/identity'
import { FORECAST_NATIVE_FREQUENCIES } from '@/lib/forecast/cadence'
import type { InteractiveForecastCapabilityResult, InteractiveForecastCapabilitySeriesSnapshot } from '@/lib/forecast/interactive-preparation'

export const FORECAST_READINESS_PROJECTION = 'sg2-stored-readiness-v1'
export const MAX_FORECAST_READINESS_BYTES = 65536
const seriesId = ForecastCurrentSelection.innerType().shape.seriesId
const modelId = z.enum(USER_FACING_FORECAST_MODELS)
const targetSemantics = z.enum(FORECAST_TARGET_SEMANTICS)
const seriesSelection = { seriesId }
export const ForecastReadinessSelection = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('capability'), ...seriesSelection, modelId, targetSemantics }).strict(),
  z.object({ kind: z.literal('capabilities'), ...seriesSelection }).strict(),
  z.object({ kind: z.literal('readiness'), ...seriesSelection }).strict(),
])
export type ForecastReadinessSelectionValue = z.infer<typeof ForecastReadinessSelection>
export type ForecastReadinessKind = ForecastReadinessSelectionValue['kind']
export function readForecastReadinessSelection(value: unknown): ForecastReadinessSelectionValue {
  const result = ForecastReadinessSelection.safeParse(value)
  if (!result.success) throw new OperationDenied('CONTEXT_INVALID')
  return result.data
}
export const forecastReadinessResourceId = (selection: ForecastReadinessSelectionValue) =>
  `forecast-${selection.kind}:${selection.seriesId}`
    + (selection.kind === 'capability' ? `:${selection.modelId}:${selection.targetSemantics}` : '')

const frequency = z.enum(FORECAST_NATIVE_FREQUENCIES)
const state = z.enum(['READY', 'NOT_PREPARED', 'STALE'])
const availability = z.enum(['AVAILABLE', 'DATA_NOT_AVAILABLE', 'FAILED'])
const status = z.enum(['AVAILABLE', 'NOT_PREPARED', 'STALE', 'PREPARATION_REQUIRED', 'INSUFFICIENT_HISTORY',
  'DATA_NOT_AVAILABLE', 'NOT_IMPLEMENTED', 'PROVENANCE_REQUIRED', 'NOT_LAWFUL', 'FAILED'])
const reason = z.enum(['Stored forecast capability is unavailable.']).nullable()
const blocker = z.enum(['CURRENT_MISSING', 'CURRENT_STALE', 'RECENT_MISSING', 'RECENT_PARTIAL', 'RECENT_STALE',
  'FAST_VERIFICATION_MISSING', 'FAST_VERIFICATION_PARTIAL', 'FAST_VERIFICATION_STALE', 'FULL_HISTORICAL_MISSING',
  'FULL_HISTORICAL_PARTIAL', 'FULL_HISTORICAL_STALE', 'CALIBRATION_INSUFFICIENT_SAMPLES', 'BANDS_NOT_AVAILABLE',
  'SOURCE_REVISION_REBUILD_REQUIRED', 'DATA_NOT_AVAILABLE', 'INSUFFICIENT_HISTORY', 'PROVENANCE_REQUIRED', 'NOT_IMPLEMENTED', 'NOT_LAWFUL'])
const capability = z.object({
  seriesId, modelId, targetSemantics,
  preparedReadAuthority: z.object({ sourceFrequency: frequency, targetCadence: frequency,
    expectedHistoryFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict().nullable(),
  sourceFrequency: frequency.nullable(), targetCadence: frequency.nullable(), sourceAvailability: availability,
  lawfulTargetSemantics: z.enum(['LAWFUL', 'LAWFUL_WITH_PROVENANCE', 'NOT_LAWFUL']).nullable(), status,
  currentReadiness: state, verificationReadiness: state, recentVerificationReadiness: state,
  fastVerificationReadiness: state, fullVerificationReadiness: state,
  predictionBandResidualCount: z.number().int().nonnegative(), predictionBandState: z.enum(['AVAILABLE', 'INSUFFICIENT_SAMPLE', 'NOT_AVAILABLE']),
  readiness: z.object({ fastReady: z.boolean(), bandsReady: z.boolean(), calibratedReady: z.boolean(), fullReady: z.boolean(),
    blockers: z.array(blocker).max(21).refine(values => new Set(values).size === values.length) }).strict(),
  targetedDataScope: z.literal('SINGLE_SERIES'), timingMs: z.number().finite().nonnegative(), reason,
}).strict()
const snapshot = z.object({ seriesId, sourceFrequency: frequency.nullable(), sourceAvailability: availability,
  status: z.enum(['AVAILABLE', 'FAILED']), reason, targetedDataScope: z.literal('SINGLE_SERIES'),
  timingMs: z.number().finite().nonnegative(), variants: z.array(capability).length(12) }).strict()
export type PublicForecastReadinessResult = z.infer<typeof capability> | z.infer<typeof snapshot>

/** Publication validation, not a second readiness policy. Never retain traces,
 * raw failures or producer diagnostics in the shared knowledge projection. */
export function validatePublicForecastReadiness(value: unknown, selection: ForecastReadinessSelectionValue): PublicForecastReadinessResult {
  const encoded = JSON.stringify(value)
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > MAX_FORECAST_READINESS_BYTES) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const parsed = (selection.kind === 'capability' ? capability : snapshot).safeParse(value)
  if (!parsed.success || parsed.data.seriesId !== selection.seriesId) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const result = parsed.data
  // An unavailable source is an execution failure, never an allowed NO_DATA
  // publication. The private host must retain its correlated FAILURE event.
  if (result.sourceAvailability === 'FAILED') throw new OperationDenied('POLICY_UNAVAILABLE')
  if (selection.kind === 'capability') {
    if (!('modelId' in result) || result.modelId !== selection.modelId || result.targetSemantics !== selection.targetSemantics) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  } else {
    if (!('variants' in result)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    const identities = new Set(result.variants.map(item => `${item.modelId}:${item.targetSemantics}`))
    if (identities.size !== 12 || result.variants.some(item => item.seriesId !== selection.seriesId
      || item.sourceFrequency !== result.sourceFrequency || item.sourceAvailability !== result.sourceAvailability)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  }
  for (const item of 'variants' in result ? result.variants : [result]) {
    if (item.preparedReadAuthority && (item.preparedReadAuthority.sourceFrequency !== item.sourceFrequency
      || item.preparedReadAuthority.targetCadence !== item.targetCadence)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  }
  return result
}

export function publishForecastReadiness(value: InteractiveForecastCapabilityResult | InteractiveForecastCapabilitySeriesSnapshot,
  selection: ForecastReadinessSelectionValue): PublicForecastReadinessResult {
  const publicCapability = ({ trace: _trace, reason: originalReason, ...item }: InteractiveForecastCapabilityResult) =>
    ({ ...item, reason: originalReason === null ? null : 'Stored forecast capability is unavailable.' as const })
  return validatePublicForecastReadiness('variants' in value
    ? { ...value, reason: value.reason === null ? null : 'Stored forecast capability is unavailable.', variants: value.variants.map(publicCapability) }
    : publicCapability(value), selection)
}

export async function projectForecastReadinessResponse(value: unknown, context: { payload?: unknown; resource: { id: string } }) {
  const selection = readForecastReadinessSelection(context.payload)
  if (context.resource?.id !== forecastReadinessResourceId(selection) || !(value instanceof Response)
    || value.status !== 200 || !value.headers.get('content-type')?.startsWith('application/json')) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const text = await value.clone().text()
  if (Buffer.byteLength(text) > MAX_FORECAST_READINESS_BYTES) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  let body: unknown
  try { body = JSON.parse(text) } catch { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
  const result = validatePublicForecastReadiness(body, selection)
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } })
}
