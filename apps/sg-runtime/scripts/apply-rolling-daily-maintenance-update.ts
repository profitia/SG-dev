import './load-env'

import { readFile } from 'node:fs/promises'

import {
  createRollingDailyMaintenanceRepository,
  type RollingDailyPersistedUpdate,
} from '@/lib/forecast/rolling-daily-maintenance'

function readArg(name: string) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  return argument ? argument.slice(prefix.length).trim() : ''
}

async function main() {
  const inputPath = readArg('inputJson')
  if (!inputPath) {
    throw new Error('Missing required argument --inputJson=...')
  }

  const payload = JSON.parse(await readFile(inputPath, 'utf8')) as RollingDailyPersistedUpdate
  const repository = createRollingDailyMaintenanceRepository()
  await repository.applyMaintenanceUpdate(payload)

  console.log(JSON.stringify({
    status: 'SUCCEEDED',
    identity: payload.identity,
    newRecordCount: payload.newRecords.length,
    maturedRecordCount: payload.maturedRecords.length,
    calibrationGroupCount: payload.calibrationGroups.length,
    lastProcessedOriginAt: payload.lastProcessedOriginAt,
    lastMaturedObservedAt: payload.lastMaturedObservedAt,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})