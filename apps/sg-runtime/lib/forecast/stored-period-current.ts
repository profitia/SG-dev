import type { Prisma } from '@/generated/market-data-client'
import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import { normalizeForecastSourceFrequency, createForecastCadence } from './cadence'
import { resolveForecastCapabilities } from './capability-resolver'
import { resolveForecastTechnicalMinimumObservations } from './current-fast-policy'
import { buildLiveForecastBridgePayloadFromHistory, selectMinimalLawfulCurrentTrainingPayload } from './live-market-input'
import { buildForecastHistoryFingerprint, createForecastLibraryService, readCurrentRunFromPrisma, readLatestCurrentRunFromPrisma } from './service'
import { periodCurrentUnavailable, validatePublicPeriodCurrentForecast } from '@/lib/platform/period-forecast-current'
import type { ForecastCurrentSelectionValue } from '@/lib/platform/forecast-current'

/** Called only after the common stored-source descriptor/receipt gate, inside
 * its existing transaction. Persisted artifacts do not manufacture provenance. */
export async function readStoredPeriodCurrent(
  transaction: Prisma.TransactionClient, history: BenchmarkHistoricalSeriesResult, selection: ForecastCurrentSelectionValue,
) {
  const unavailable = () => periodCurrentUnavailable(selection)
  if (selection.targetBasis === 'POINT_IN_TIME') return unavailable()
  const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
  const resolve = (observations: number) => resolveForecastCapabilities({ seriesId: selection.seriesId, sourceFrequency,
    sourceObservationCount: history.historical.filter(point => point.value !== null && Number.isFinite(point.value)).length,
    preparedObservationCounts: { [selection.targetBasis]: observations }, provenance: [], preparedVariants: [] })
    .find(item => item.identity.modelId === selection.modelId && item.identity.targetSemantics === selection.targetBasis)
  const capability = resolve(0)
  if (!sourceFrequency || !capability?.targetCadence || capability.admissionState !== 'ADMITTED'
    || capability.implementationState !== 'SUPPORTED'
    || selection.sourceFrequency && (selection.sourceFrequency !== sourceFrequency || selection.targetCadence !== capability.targetCadence)) return unavailable()

  // Exact existing canonicalization and per-model training suffix. No Python,
  // provider lookup, hydration, refit or different fingerprint is substituted.
  let payload
  try {
    const base = buildLiveForecastBridgePayloadFromHistory(selection.seriesId, history, { targetBasis: selection.targetBasis,
      targetCadence: capability.targetCadence, continuityPolicy: capability.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL' })
    if (resolve(base.history.observations)?.currentForecastEligible !== true) return unavailable()
    payload = selectMinimalLawfulCurrentTrainingPayload(base, resolveForecastTechnicalMinimumObservations({
      targetSemantics: selection.targetBasis, modelId: selection.modelId }))
  } catch { return unavailable() }
  const cadence = createForecastCadence(sourceFrequency, capability.targetCadence)
  const expectedHistoryFingerprint = buildForecastHistoryFingerprint(payload.history, cadence)
  const refuse = async (): Promise<never> => { throw new Error('Stored Current reads cannot use this execution port') }
  const service = createForecastLibraryService({
    repository: { readCurrentRun: key => readCurrentRunFromPrisma(key, { prisma: transaction, projection: 'STORED_SHARED' }),
      readLatestCurrentRun: key => readLatestCurrentRunFromPrisma(key, { prisma: transaction, projection: 'STORED_SHARED' }),
      writeCurrentRun: refuse, readVerificationRun: refuse, writeVerificationRun: refuse },
    bridge: { exportHistory: refuse, exportCurrent: refuse, exportVerification: refuse },
    resolveExactPreparedCapability: refuse, executePreparedCurrent: refuse,
    // A pure prepared read has no compute-execution ledger. Refuse its ports
    // explicitly: the legacy default constructs a global datastore client.
    // Durable access INTENT/OUTCOME/FAILURE remains owned by the outer executor.
    executionLedger: { recordEvent: refuse, readExecution: refuse },
  })
  const result = await service.readPreparedCurrentForecastRequest({ ...selection,
    sourceFrequency, targetCadence: capability.targetCadence,
    preparedReadAuthority: { seriesId: selection.seriesId, modelId: selection.modelId, targetBasis: selection.targetBasis,
      sourceFrequency, targetCadence: capability.targetCadence, expectedHistoryFingerprint } })
  if (result.status !== 'AVAILABLE') return unavailable()
  return validatePublicPeriodCurrentForecast(result, selection)
}
