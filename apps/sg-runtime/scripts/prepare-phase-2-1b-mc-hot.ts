import './load-env'

import { resolveBenchmarkCurrentForecast } from '@/lib/forecast/service'

async function main() {
  const result = await resolveBenchmarkCurrentForecast({
    seriesId: 'wocaes0280',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })

  if (result.status !== 'AVAILABLE' || result.cacheStatus === 'hit') {
    throw new Error(`Expected one canonical Monthly preparation, received ${result.status}/${'cacheStatus' in result ? result.cacheStatus : 'none'}.`)
  }

  process.stdout.write(`${JSON.stringify({
    status: result.status,
    seriesId: result.seriesId,
    modelId: result.modelId,
    targetBasis: result.targetBasis,
    targetSemantics: result.targetSemantics,
    methodId: result.methodId,
    methodVersion: result.methodVersion,
    historyFingerprint: result.historyFingerprint,
    forecastOrigin: result.forecastOrigin,
    preparationOnly: true,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})