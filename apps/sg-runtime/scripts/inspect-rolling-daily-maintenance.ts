import './load-env'

import {
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
  createRollingDailyMaintenanceRepository,
  type RollingDailyMaintenanceIdentity,
} from '@/lib/forecast/rolling-daily-maintenance'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'

const DEFAULT_SERIES_ID = 'wocaes0074'

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

function readRequiredArg(name: string) {
  const value = readArg(name)
  if (!value) {
    throw new Error(`Missing required argument --${name}=...`)
  }
  return value
}

function readTargetBasis(): ForecastTargetBasis {
  const raw = readArg('targetBasis')
  return (raw || ROLLING_DAILY_TARGET_BASIS) as ForecastTargetBasis
}

async function main() {
  const repository = createRollingDailyMaintenanceRepository()
  const identity: RollingDailyMaintenanceIdentity = {
    seriesId: readArg('seriesId') || DEFAULT_SERIES_ID,
    inputSource: readArg('inputSource') || ROLLING_DAILY_INPUT_SOURCE,
    targetBasis: readTargetBasis(),
    methodId: readArg('methodId') || ROLLING_DAILY_METHOD_ID,
    methodVersion: readArg('methodVersion') || ROLLING_DAILY_METHOD_VERSION,
    modelId: readRequiredArg('modelId'),
  }

  const [state, records] = await Promise.all([
    repository.readState(identity),
    repository.listVerificationRecords(identity),
  ])

  console.log(JSON.stringify({ identity, state, records }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})