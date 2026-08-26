import './load-env'

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import {
  runForecastStressOperationWave,
  type OperationRequest,
} from './run-forecast-phase-2-1b-operation'

async function main() {
  const requestFile = process.argv.find((argument) => argument.startsWith('--requests-file='))
    ?.slice('--requests-file='.length)
  const encoded = process.argv.find((argument) => argument.startsWith('--requests-base64='))
    ?.slice('--requests-base64='.length)
  if ((!requestFile && !encoded) || (requestFile && encoded)) {
    throw new Error('Provide exactly one of --requests-file or --requests-base64.')
  }

  const serialized = requestFile
    ? await readFile(requestFile, 'utf8')
    : Buffer.from(encoded!, 'base64url').toString('utf8')
  const requests = JSON.parse(serialized) as OperationRequest[]
  if (![2, 10].includes(requests.length)) {
    throw new Error('Phase 2.2B-1 Current wave must contain exactly 2 or 10 requests.')
  }
  if (requests.some((request) =>
    request.operation !== 'CURRENT'
    || request.seriesId !== 'wocaes0280'
    || request.targetBasis !== 'MONTHLY_AVERAGE'
    || request.targetSemantics !== 'MONTHLY_AVERAGE'
    || request.sourceFrequency !== 'MONTHLY'
    || request.targetCadence !== 'MONTHLY')) {
    throw new Error('Phase 2.2B-1 adapter permits only the frozen Generic Period Current identity.')
  }
  if (new Set(requests.map(({ stressRunId }) => stressRunId)).size !== 1) {
    throw new Error('Phase 2.2B-1 Current wave requires one stressRunId.')
  }

  const results = await runForecastStressOperationWave(requests)
  process.stdout.write(`[FORECAST_PHASE_2_2B_1_RESULT] ${JSON.stringify(results)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}