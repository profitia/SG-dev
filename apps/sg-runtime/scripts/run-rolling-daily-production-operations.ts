import './load-env'

import {
  createRollingDailyProductionOperationsService,
  DEFAULT_ROLLING_DAILY_PRODUCTION_OPERATIONS_SERIES_ID,
  ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS,
  type RollingDailyProductionOperationsModelId,
} from '@/lib/forecast/rolling-daily-production-operations'

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function readModelArgs(): RollingDailyProductionOperationsModelId[] {
  const raw = readArg('models')

  if (!raw) {
    return [...ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS]
  }

  const requested = raw.split(',').map((value) => value.trim()).filter(Boolean)
  const invalid = requested.filter((value) => !ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS.includes(value as RollingDailyProductionOperationsModelId))

  if (invalid.length > 0) {
    throw new Error(`Unsupported models: ${invalid.join(', ')}`)
  }

  return requested as RollingDailyProductionOperationsModelId[]
}

async function main() {
  const service = createRollingDailyProductionOperationsService()
  const seriesId = readArg('seriesId') || DEFAULT_ROLLING_DAILY_PRODUCTION_OPERATIONS_SERIES_ID
  const modelIds = readModelArgs()
  const result = await service.run({ seriesId, modelIds })
  console.log(JSON.stringify(result, null, 2))

  if (result.status === 'FAILED') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})