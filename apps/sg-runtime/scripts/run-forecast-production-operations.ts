import './load-env'

import {
  OPERATIONAL_FORECAST_TARGETS,
  createForecastProductionOperationsService,
  type OperationalForecastTarget,
} from '@/lib/forecast/production-operations'
import {
  USER_FACING_FORECAST_MODELS,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function readList<T extends string>(name: string, allowed: readonly T[], fallback: readonly T[]): T[] {
  const value = readArg(name)
  if (!value) return [...fallback]
  const requested = value.split(',').map((item) => item.trim()).filter(Boolean)
  const invalid = requested.filter((item) => !allowed.includes(item as T))
  if (invalid.length > 0) throw new Error(`Unsupported ${name}: ${invalid.join(', ')}`)
  return requested as T[]
}

async function main() {
  const seriesId = readArg('seriesId')
  if (!seriesId) throw new Error('Missing required --seriesId=...')

  const targetSemantics = readList<OperationalForecastTarget>(
    'targets',
    OPERATIONAL_FORECAST_TARGETS,
    OPERATIONAL_FORECAST_TARGETS,
  )
  const modelIds = readList<UserFacingForecastModelId>(
    'models',
    USER_FACING_FORECAST_MODELS,
    USER_FACING_FORECAST_MODELS,
  )
  const prepareHistorical = readArg('historical') === 'true'
  const result = await createForecastProductionOperationsService().run({
    seriesId,
    targetSemantics,
    modelIds,
    prepareHistorical,
  })

  console.log(JSON.stringify(result, null, 2))
  if (result.status !== 'SUCCEEDED') process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})