import './load-env'

import { persistRollingDailyCurrentForecastSnapshots } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'

const DEFAULT_SERIES_ID = 'wocaes0074'
const DEFAULT_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const
const SUPPORTED_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function readModelArgs() {
  const raw = readArg('models')

  if (!raw) {
    return [...DEFAULT_MODELS]
  }

  const requested = raw.split(',').map((value) => value.trim()).filter(Boolean)
  const invalid = requested.filter((value) => !SUPPORTED_MODELS.includes(value as (typeof SUPPORTED_MODELS)[number]))

  if (invalid.length > 0) {
    throw new Error(`Unsupported models: ${invalid.join(', ')}`)
  }

  return requested as Array<(typeof SUPPORTED_MODELS)[number]>
}

async function main() {
  const seriesId = readArg('seriesId') || DEFAULT_SERIES_ID
  const modelIds = readModelArgs()
  const results = await persistRollingDailyCurrentForecastSnapshots(seriesId, modelIds)
  console.log(JSON.stringify({ seriesId, results }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})