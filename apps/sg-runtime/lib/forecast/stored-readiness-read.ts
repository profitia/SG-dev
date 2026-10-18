import { z } from 'zod'
import type { PrismaClient, Prisma } from '@/generated/market-data-client'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import { createForecastCapabilityService } from './capability-resolver'
import { createInteractiveForecastPreparationService } from './interactive-preparation'
import { readForecastPreparedVariantsFromPort, type ForecastPreparedStateDataPort, type PreparedPeriodStateKey } from './prepared-state'
import { createStoredForecastSourceReader, type StoredForecastBinding } from './stored-current-read'
import { readStoredVerificationFromSource } from './stored-verification-read'
import { readStoredPeriodCurrent } from './stored-period-current'
import { readRollingDailyCurrentForecastSnapshot } from './rolling-daily-current-forecast-snapshot'
import { validatePublicForecastCurrent } from '@/lib/platform/forecast-current'
import { readForecastReadinessSelection, publishForecastReadiness, type ForecastReadinessSelectionValue } from '@/lib/platform/forecast-readiness'
import type { ForecastRequestInput } from './request-contract'
import type { ForecastServiceRequest } from './service'
import { ensureHistoricalVerificationContract } from './historical-verification-policy'
import { CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID } from './identity'
import type { ForecastCurrentPoint } from './contracts'

const row = z.object({ status: z.enum(['AVAILABLE', 'FAILED', 'NOT_AVAILABLE']), historyFingerprint: z.string(), frequency: z.string() }).strict()
const currentRow = row.extend({ pointsJson: z.array(z.object({ forecastValue: z.number().finite().nullable() }).strict()).max(366) }).strict()
const historicalRow = row.extend({ metricsJson: z.array(z.object({ origins: z.number().int().nonnegative(),
  expectedOrigins: z.number().int().nonnegative(), failedOrigins: z.number().int().nonnegative() }).strict()).max(366) }).strict()

/** Genuine dedicated projections, not a Prisma lookalike. The caller verifies
 * receipt/ACL/ordinary login before this port is used in that same transaction. */
export function createStoredPreparedStatePort(transaction: Prisma.TransactionClient): ForecastPreparedStateDataPort {
  const values = (key: PreparedPeriodStateKey) => [key.seriesId, key.modelId, key.targetBasis, key.methodId, key.methodVersion, [...key.frequencies]]
  const where = '"seriesId"=$1 AND "modelId"=$2 AND "targetBasis"::text=$3 AND "methodId"=$4 AND "methodVersion"=$5 AND frequency=ANY($6::text[])'
  return Object.freeze({
    async readLatestCurrent(key) {
      const rows = await transaction.$queryRawUnsafe<unknown[]>(`SELECT status,"historyFingerprint",frequency,"pointsJson" FROM profitia_forecast_read.forecast_current_states WHERE ${where} ORDER BY "updatedAt" DESC LIMIT 1`, ...values(key))
      if (!rows.length) return null
      const { pointsJson, ...result } = currentRow.parse(rows[0])
      return { ...result, points: pointsJson }
    },
    async readLatestHistorical(key) {
      const rows = await transaction.$queryRawUnsafe<unknown[]>(`SELECT status,"historyFingerprint",frequency,"metricsJson" FROM profitia_forecast_read.forecast_verification_states WHERE ${where} AND "trainingWindowPolicyId"=$7 AND "effectiveTrainingPolicyId"=$8 ORDER BY "updatedAt" DESC LIMIT 1`, ...values(key), key.trainingWindowPolicyId, key.effectiveTrainingPolicyId)
      if (!rows.length) return null
      const { metricsJson, ...result } = historicalRow.parse(rows[0])
      return { ...result, metrics: metricsJson }
    },
    readRollingSnapshot: key => {
      const { trainingWindowPolicyId, effectiveTrainingPolicyId, ...identity } = key
      return transaction.rollingDailyCurrentForecastSnapshot.findUnique({ where: {
        seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: {
          ...identity, trainingWindowPolicyId, effectiveTrainingPolicyId,
        } }, select: { status: true, payloadJson: true } })
    },
    readRollingMaintenance: key => transaction.rollingDailyMaintenanceState.findUnique({
      where: { seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: key },
      select: { latestSourceHistoryFingerprint: true, latestSourceObservationAt: true, lastProcessedOriginAt: true, lastMaintenanceStatus: true },
    }),
    countRollingVerification: key => transaction.rollingDailyVerificationRecord.count({ where: key }),
  } satisfies ForecastPreparedStateDataPort)
}

/** One original capability/readiness policy and one ordinary read transaction.
 * Only stored source facts are supplied; absent provider provenance stays absent.
 * The composed preparation service's execution surface is never exposed. */
export function createStoredForecastReadinessReader(prisma: Pick<PrismaClient, '$transaction'>, binding: StoredForecastBinding) {
  const readSource = createStoredForecastSourceReader(prisma, binding)
  return async (value: ForecastReadinessSelectionValue) => {
    const selection = readForecastReadinessSelection(value)
    return readSource(selection.seriesId, async (transaction, history) => {
      if (!history) throw new BenchmarkAppError('STORED_HISTORY_NOT_AVAILABLE', 'Stored market history is not available.', 404)
      const service = createStoredForecastReadinessPolicy(transaction,history,selection.seriesId)
      const result = selection.kind === 'capability' ? await service.capability(selection)
        : selection.kind === 'capabilities' ? await service.capabilitySnapshotBySeriesId(selection.seriesId)
          : await service.readinessSnapshotBySeriesId(selection.seriesId)
      return publishForecastReadiness(result, selection)
    })
  }
}

/** Original capability/readiness policy over already admitted stored-source
 * facts. The caller owns the real ordinary transaction and source guard.
 * No connection, hydration, provider access, preparation or execution is exposed. */
export function createStoredForecastReadinessPolicy(transaction:Prisma.TransactionClient,history:BenchmarkHistoricalSeriesResult,boundSeriesId:string) {
  const statePort = createStoredPreparedStatePort(transaction)
  const capabilities = createForecastCapabilityService({
    resolveHistoricalSeries: async (seriesId, range) => {
      if (seriesId !== boundSeriesId || range !== 'ALL') throw new Error('Stored capability history scope mismatch')
      return { history, marketDataSource: 'postgres', cacheStatus: 'hit' }
    },
    resolveProvenance: async () => [],
    readPreparedVariants: (seriesId, source) => readForecastPreparedVariantsFromPort(seriesId, source, statePort),
    now: () => new Date(),
  })
  const refuse = async (): Promise<never> => { throw new Error('Stored capability cannot execute preparation or persistence') }
  const verification = (scope: 'FAST' | 'FULL' | 'RECENT') => async (input: ForecastRequestInput | ForecastServiceRequest) =>
    ensureHistoricalVerificationContract(await readStoredVerificationFromSource(transaction, history, {
      seriesId: input.seriesId, modelId: input.modelId as ForecastRequestInput['modelId'], targetBasis: input.targetBasis,
      verificationScope: scope,
      ...(input.sourceFrequency ? { sourceFrequency: input.sourceFrequency, targetCadence: input.targetCadence } : {}),
    }))
  const service = createInteractiveForecastPreparationService({
    resolveExactCapability: capabilities.resolveExact, resolveCapabilitiesBySeriesId: capabilities.resolveBySeriesId,
    prepareMonthlyCurrent: refuse, prepareRollingCurrent: refuse, prepareRollingDailyOwnership: refuse,
    executionAdmission: { get leaseDurationMs(): never { throw new Error('Stored capability has no execution lease') }, acquireExecution: refuse, renewLease: refuse,
      markExecutionCompleted: refuse, markExecutionFailed: refuse, readLatestExecutionForLogicalArtifact: refuse },
    readPreparedCurrent: async input => {
      if (input.targetBasis === 'POINT_IN_TIME') return refuse()
      const selected = { seriesId: input.seriesId, modelId: input.modelId as ForecastRequestInput['modelId'], targetBasis: input.targetBasis }
      const current = await readStoredPeriodCurrent(transaction, history, selected)
      await validatePublicForecastCurrent(current, selected)
      if (current.status !== 'AVAILABLE') return current
      // The publication schema permits textual policy identifiers; the
      // legacy domain type is a literal union. Narrow the validated value,
      // preserving every field rather than casting a public DTO to it.
      const currentForecast: Record<string, ForecastCurrentPoint> = {}
      for (const [key, point] of Object.entries(current.currentForecast)) {
        const metadata = point.metadata, band = metadata?.uncertaintyBand
        if (!metadata || !band?.identity) {
          currentForecast[key] = { ...point, metadata: metadata ? { ...metadata, uncertaintyBand: band ? { ...band, identity: undefined } : band } : metadata }
          continue
        }
        const trainingWindowPolicyId = band.identity.trainingWindowPolicyId
        if (trainingWindowPolicyId !== CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID) throw new Error('Stored Current band policy mismatch')
        currentForecast[key] = { ...point, metadata: { ...metadata, uncertaintyBand: { ...band, identity: { ...band.identity, trainingWindowPolicyId } } } }
      }
      return { ...current, currentForecast }
    },
    readRollingCurrentSnapshot: async input => {
      const snapshot = await readRollingDailyCurrentForecastSnapshot(input, { prisma: transaction })
      if (snapshot.status === 'HIT') await validatePublicForecastCurrent(snapshot.payload,
        { seriesId: input.seriesId, modelId: input.modelId, targetBasis: 'POINT_IN_TIME' })
      return snapshot
    },
    readPreparedFullVerification: verification('FULL'), readPreparedFastVerification: verification('FAST'),
    readPreparedRollingDailyFullVerification: verification('FULL'), readPreparedRollingDailyFastVerification: verification('FAST'),
    // Current's minimal authority is deliberately not passed to Verification:
    // its existing source reader derives the complete history independently.
    readPreparedRecentVerification: verification('RECENT'), now: () => performance.now(),
  })
  return Object.freeze({capability:service.capability,capabilitySnapshotBySeriesId:service.capabilitySnapshotBySeriesId,
    readinessSnapshotBySeriesId:service.readinessSnapshotBySeriesId,resolveExact:capabilities.resolveExact})
}
