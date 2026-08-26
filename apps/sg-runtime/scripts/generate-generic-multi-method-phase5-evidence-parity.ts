import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import { buildLiveForecastBridgePayloadFromHistory } from '@/lib/forecast/live-market-input'

const LAB_ROOT = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting')
const PYTHON = path.join(LAB_ROOT, '.venv', 'bin', 'python')
const GENERATOR = path.join(LAB_ROOT, 'scripts', 'generate_generic_multi_method_phase5_evidence_parity.py')
const OUTPUT = path.join(
  LAB_ROOT,
  'validation',
  'generic_multi_method_forecast_phase5_historical_verification_and_evidence_parity.json',
)

function rounded(value: number) {
  return Number(value.toFixed(6))
}

function buildControlledDailyHistory(): BenchmarkHistoricalSeriesResult {
  const historical: Array<{ date: string; value: number | null }> = []

  for (let index = 0; index < 60; index += 1) {
    const year = 2021 + Math.floor(index / 12)
    const month = (index % 12) + 1
    const monthText = String(month).padStart(2, '0')
    const base = 80 + index * 0.35 + Math.sin(index / 3) * 2 + ((index % 5) - 2) * 0.15

    historical.push(
      { date: `${year}-${monthText}-05T00:00:00.000Z`, value: rounded(base) },
      { date: `${year}-${monthText}-24T00:00:00.000Z`, value: rounded(base + 1.25 + (index % 4) * 0.15) },
      { date: `${year}-${monthText}-28T00:00:00.000Z`, value: null },
    )
  }

  historical.push(
    { date: '2026-01-03T00:00:00.000Z', value: 103.25 },
    { date: '2026-01-10T00:00:00.000Z', value: 104.1 },
  )

  return {
    providerSeries: {
      provider: {
        providerCode: 'MACROBOND',
        displayName: 'Controlled Phase 5 Fixture',
      },
      providerSeriesId: 'wocaes0074',
      providerSeriesKey: 'wocaes0074',
    },
    displayName: 'Controlled Phase 5 Daily Benchmark',
    frequency: 'DAILY',
    currency: 'USD',
    unit: 'index',
    source: 'CONTROLLED_FIXTURE',
    historical,
  }
}

function main() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'sg-phase5-evidence-parity-'))

  try {
    const source = buildControlledDailyHistory()
    const endOfPeriod = buildLiveForecastBridgePayloadFromHistory('wocaes0074', source, {
      targetBasis: 'END_OF_PERIOD',
      now: new Date('2026-01-15T00:00:00.000Z'),
    })
    const monthlyAverage = buildLiveForecastBridgePayloadFromHistory('wocaes0074', source, {
      targetBasis: 'MONTHLY_AVERAGE',
      now: new Date('2026-01-15T00:00:00.000Z'),
    })
    if (
      endOfPeriod.history.observations !== 60
      || monthlyAverage.history.observations !== 60
      || endOfPeriod.canonicalization.excludedPartialPeriods !== 1
      || monthlyAverage.canonicalization.excludedPartialPeriods !== 1
    ) {
      throw new Error('Phase 5 controlled monthly preparation must produce 60 closed periods and exclude one partial month.')
    }

    const lawfulDailyPoints = source.historical
      .filter((point) => point.value !== null)
      .map((point) => ({ date: point.date, value: point.value }))
    const input = {
      seriesId: 'wocaes0074',
      identity: {
        END_OF_PERIOD: {
          methodId: 'END_OF_PERIOD',
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        },
        MONTHLY_AVERAGE: {
          methodId: 'MONTHLY_AVERAGE',
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        },
        ROLLING_DAILY_POINT_IN_TIME: {
          methodId: 'ROLLING_DAILY_POINT_IN_TIME',
          methodVersion: 'rolling-daily-point-in-time-v1',
        },
      },
      monthly: {
        END_OF_PERIOD: {
          targetSemantics: 'END_OF_PERIOD',
          targetBasis: 'END_OF_PERIOD',
          methodId: 'END_OF_PERIOD',
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
          preparation: endOfPeriod.canonicalization,
          history: endOfPeriod.history,
        },
        MONTHLY_AVERAGE: {
          targetSemantics: 'MONTHLY_AVERAGE',
          targetBasis: 'MONTHLY_AVERAGE',
          methodId: 'MONTHLY_AVERAGE',
          methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
          preparation: monthlyAverage.canonicalization,
          history: monthlyAverage.history,
        },
      },
      rollingDaily: {
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        targetBasis: 'POINT_IN_TIME',
        methodId: 'ROLLING_DAILY_POINT_IN_TIME',
        methodVersion: 'rolling-daily-point-in-time-v1',
        selectedValidationOrigins: ['2024-01-24', '2024-06-24', '2024-12-24'],
        history: {
          seriesId: 'wocaes0074',
          benchmarkName: source.displayName,
          description: 'Controlled Phase 5 DAILY verification history',
          points: lawfulDailyPoints,
        },
      },
      sourceCoverage: {
        sourceFrequency: 'DAILY',
        sourceFirstObservation: source.historical[0]?.date ?? null,
        sourceLastObservation: source.historical.at(-1)?.date ?? null,
        totalSourceRows: source.historical.length,
        lawfulNumericDailyObservations: lawfulDailyPoints.length,
        nullPlaceholders: source.historical.filter((point) => point.value === null).length,
        closedMonthlyPeriods: 60,
        excludedPartialMonthlyPeriods: 1,
        productionDataUsed: false,
      },
    }
    const inputPath = path.join(tempDir, 'phase5-input.json')
    writeFileSync(inputPath, JSON.stringify(input))
    execFileSync(PYTHON, [GENERATOR, '--input-json', inputPath, '--output-json', OUTPUT], {
      cwd: LAB_ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024,
    })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

main()