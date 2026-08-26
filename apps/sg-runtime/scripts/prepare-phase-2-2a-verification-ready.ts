import './load-env'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Prisma } from '@/generated/market-data-client'
import type { BenchmarkForecastVerificationAvailableResult } from '@/lib/forecast/contracts'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const SOURCE_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  'tooling',
  'Benchmark-Forecasting',
  'performance',
  'results',
  'phase-2-1',
  'executions',
  '2026-08-24T144030-754Z-1ac1ed68-613d-4904-8f7a-14c250c0deea',
  'diagnostics',
  'phase-2-1b-p08-2-ets-5bb8ea6c-5d2a-48f4-87c0-65df8e00eea1-worker.log',
)
const SOURCE_SHA256 = 'ff1127f2457fc1a01fc75af17cd10f98d7cf63505532ed64eb881a6120f12465'
const VERIFICATION_SHA256 = '895762e8cc37929dac67d1cac1f6eeeb0210edb4fee96551891b44968b6cad34'
const RESULT_PREFIX = '[FORECAST_STRESS_WORKER_RESULT] '
const FREQUENCY_IDENTITY = 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY'

type WorkerResult = {
  ok: boolean
  value: BenchmarkForecastVerificationAvailableResult
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function assertCanonicalArtifact(artifact: BenchmarkForecastVerificationAvailableResult) {
  const failures = [
    artifact.status !== 'AVAILABLE' && 'status',
    artifact.seriesId !== 'wocaes0280' && 'seriesId',
    artifact.modelId !== 'ets' && 'modelId',
    artifact.targetBasis !== 'MONTHLY_AVERAGE' && 'targetBasis',
    artifact.targetSemantics !== 'MONTHLY_AVERAGE' && 'targetSemantics',
    artifact.methodId !== 'MONTHLY_AVERAGE' && 'methodId',
    artifact.methodVersion !== 'benchmark-forecasting-mvp-phase2-v1' && 'methodVersion',
    artifact.lineage.sourceFrequency !== 'MONTHLY' && 'sourceFrequency',
    artifact.lineage.preparation?.provenanceStatus !== 'PROVEN' && 'provenanceStatus',
    artifact.historyFingerprint !== artifact.lineage.historyFingerprint && 'historyFingerprint',
  ].filter(Boolean)
  if (failures.length > 0) throw new Error(`P08 artifact identity is not canonical: ${failures.join(', ')}`)

  const horizons = Object.values(artifact.verification)
  if (horizons.length !== 4 || horizons.some((horizon) => (
    horizon.coverage !== 1
    || horizon.failedOrigins !== 0
    || horizon.records.length !== horizon.expectedOrigins
  ))) {
    throw new Error('P08 artifact does not contain complete canonical 1M/3M/6M/12M Verification coverage.')
  }
}

async function readCanonicalArtifact() {
  const source = await readFile(SOURCE_PATH, 'utf8')
  if (sha256(source) !== SOURCE_SHA256) throw new Error('Immutable P08 source hash mismatch.')
  const resultLine = source.split('\n').find((line) => line.startsWith(RESULT_PREFIX))
  if (!resultLine) throw new Error('Immutable P08 worker result is absent.')
  const results = JSON.parse(resultLine.slice(RESULT_PREFIX.length)) as WorkerResult[]
  if (results.length !== 2 || results.some(({ ok }) => !ok)) throw new Error('P08 source does not contain two successful results.')
  const [first, second] = results.map(({ value }) => value)
  assertCanonicalArtifact(first)
  assertCanonicalArtifact(second)
  const firstVerification = stableJson(first.verification)
  const secondVerification = stableJson(second.verification)
  if (firstVerification !== secondVerification || sha256(firstVerification) !== VERIFICATION_SHA256) {
    throw new Error('P08 canonical Verification payload parity/hash mismatch.')
  }
  return first
}

async function main() {
  const artifact = await readCanonicalArtifact()
  const prisma = getMarketDataPrisma()
  if (!prisma) throw new Error('MARKET_DATA_DATABASE_URL is not configured.')

  const existing = await prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId: artifact.seriesId,
      targetBasis: artifact.targetBasis,
      methodId: artifact.methodId,
      methodVersion: artifact.methodVersion,
      modelId: artifact.modelId,
      frequency: FREQUENCY_IDENTITY,
      historyFingerprint: artifact.historyFingerprint,
      status: 'AVAILABLE',
    },
    include: { metrics: true, points: true },
  })
  if (existing) {
    process.stdout.write(`${JSON.stringify({ status: 'ALREADY_PREPARED', runId: existing.id, metricCount: existing.metrics.length, pointCount: existing.points.length })}\n`)
    return
  }

  const verificationEntries = Object.values(artifact.verification)
  const persisted = await prisma.$transaction(async (tx) => {
    const run = await tx.forecastVerificationRun.create({
      data: {
        seriesId: artifact.seriesId,
        displayName: artifact.displayName,
        description: artifact.description,
        frequency: FREQUENCY_IDENTITY,
        inputSource: artifact.source.kind,
        inputRunId: artifact.source.runId,
        historyFingerprint: artifact.historyFingerprint,
        targetBasis: artifact.targetBasis,
        methodId: artifact.methodId,
        historyStartAt: artifact.history.start ? new Date(artifact.history.start) : null,
        historyEndAt: artifact.history.end ? new Date(artifact.history.end) : null,
        observationCount: artifact.history.observations,
        forecastOriginAt: artifact.forecastOrigin ? new Date(artifact.forecastOrigin) : null,
        modelId: artifact.modelId,
        methodVersion: artifact.methodVersion,
        status: 'AVAILABLE',
        runtimeSeconds: artifact.runtimeSeconds,
      },
    })
    await tx.forecastVerificationMetric.createMany({
      data: verificationEntries.map((horizon) => ({
        runId: run.id,
        horizonLabel: horizon.horizon,
        horizonSteps: horizon.horizonSteps,
        origins: horizon.origins,
        expectedOrigins: horizon.expectedOrigins,
        failedOrigins: horizon.failedOrigins,
        coverage: horizon.coverage,
        mae: horizon.metrics?.mae ?? null,
        rmse: horizon.metrics?.rmse ?? null,
        mase: horizon.metrics?.mase ?? null,
        smape: horizon.metrics?.smape ?? null,
        directionalAccuracy: horizon.metrics?.directionalAccuracy ?? null,
        bias: horizon.metrics?.bias ?? null,
        failureSummaryJson: horizon.failures as unknown as Prisma.InputJsonValue,
      })),
    })
    const points = verificationEntries.flatMap((horizon) => horizon.records.map((record) => ({
      runId: run.id,
      horizonLabel: horizon.horizon,
      horizonSteps: horizon.horizonSteps,
      forecastOriginAt: new Date(record.forecastOrigin),
      targetDate: new Date(record.forecastDate),
      actualObservedAt: record.actualObservedAt ? new Date(record.actualObservedAt) : null,
      originValue: record.originValue,
      forecastValue: record.forecastValue,
      actualValue: record.actualValue,
      errorValue: record.error,
      absoluteErrorValue: record.absoluteError,
      deltaValue: record.delta,
      deltaPct: record.deltaPct,
      maseScale: record.maseScale,
      selectedVariant: record.metadata?.selectedVariant ?? null,
      selectionMetric: record.metadata?.selectionMetric ?? null,
      selectionScore: record.metadata?.selectionScore ?? null,
      metadataJson: record.metadata as unknown as Prisma.InputJsonValue,
    })))
    await tx.forecastVerificationPoint.createMany({ data: points })
    return { runId: run.id, metricCount: verificationEntries.length, pointCount: points.length }
  })

  process.stdout.write(`${JSON.stringify({
    status: 'PREPARED_FROM_IMMUTABLE_PHASE_2_1_EVIDENCE',
    ...persisted,
    sourceSha256: SOURCE_SHA256,
    verificationSha256: VERIFICATION_SHA256,
    verificationComputeCount: 0,
    modelFitCount: 0,
    providerCallCount: 0,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})