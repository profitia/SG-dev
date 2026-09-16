import './load-env'

import { refreshBenchmarkHistoricalSeries } from '@/lib/market-data/service'

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function readSeriesIds() {
  const seriesIds = [...new Set(readArg('seriesIds').split(',').map((item) => item.trim()).filter(Boolean))]
  if (seriesIds.length === 0) {
    throw new Error('Missing required --seriesIds=series_a,series_b,...')
  }
  return seriesIds
}

function readConcurrency() {
  const raw = readArg('concurrency') || '2'
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) {
    throw new Error(`Invalid --concurrency=${raw}; expected an integer from 1 to 8.`)
  }
  return parsed
}

async function runBounded<T, R>(items: T[], concurrency: number, operation: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await operation(items[index]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function main() {
  const seriesIds = readSeriesIds()
  const concurrency = readConcurrency()
  const startedAt = new Date().toISOString()
  const results = await runBounded(seriesIds, concurrency, async (seriesId) => {
    try {
      const result = await refreshBenchmarkHistoricalSeries(seriesId)
      return {
        seriesId,
        status: 'SUCCEEDED' as const,
        observations: result.history.historical.length,
        latestObservation: result.history.historical.at(-1)?.date ?? null,
        displayName: result.history.displayName,
        frequency: result.history.frequency,
        currency: result.history.currency,
        unit: result.history.unit,
        source: result.history.source,
        hydratedObservationCount: result.hydratedObservationCount,
      }
    } catch (error) {
      return {
        seriesId,
        status: 'FAILED' as const,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const failed = results.filter((result) => result.status === 'FAILED')
  console.log(JSON.stringify({
    operation: 'CANONICAL_MARKET_DATA_HYDRATION_V1',
    startedAt,
    completedAt: new Date().toISOString(),
    concurrency,
    requestedSeriesCount: seriesIds.length,
    succeededSeriesCount: results.length - failed.length,
    failedSeriesCount: failed.length,
    results,
  }, null, 2))

  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
