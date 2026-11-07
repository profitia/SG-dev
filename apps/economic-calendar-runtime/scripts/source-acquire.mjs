import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {createCalendarSourceService, sourceServiceConfiguration} from '../src/source-service.mjs'

/** One explicit acquisition through the same ECR SERVICE path as sync. No
 * product store, provider secret, timer, retry, request counter or raw export.
 * This command does not persist calendar data or confer durable-storage rights.
 */
export async function runSourceAcquire(env = process.env) {
  if (env.ECR_ENVIRONMENT !== 'development' || !/^[a-f0-9]{40}$/.test(env.ECR_EXECUTION_SHA ?? '')) throw new Error('EXPLICIT_DEVELOPMENT_EXECUTION_REQUIRED')
  if (!env.ECR_SYNC_CRITERIA_FILE) throw new Error('EXPLICIT_CRITERIA_FILE_REQUIRED')
  const bytes = await readFile(env.ECR_SYNC_CRITERIA_FILE)
  if (bytes.length > 16000) throw new Error('CRITERIA_FILE_TOO_LARGE')
  const source = createCalendarSourceService(sourceServiceConfiguration(env))
  const response = await source.acquire({criteria: JSON.parse(bytes.toString('utf8')), organisation: env.ECR_SYNC_ORGANISATION_ID,
    grantId: env.ECR_SYNC_SERVICE_GRANT_ID, idempotencyKey: env.ECR_SYNC_IDEMPOTENCY_KEY})
  // Provider items and private criteria are transient and never logged/exported.
  return {event: 'calendar_source_acquisition', executionSha: env.ECR_EXECUTION_SHA, returned: response.items.length,
    usage: response.usage, coverage: response.coverage ?? {completeness: 'UNKNOWN'}}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runSourceAcquire().then(result => {
  process.stdout.write(JSON.stringify(result) + '\n')
}).catch(error => {
  const code = /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code ?? '') ? error.code : 'ECR_SOURCE_ACQUISITION_REFUSED_OR_FAILED'
  process.stderr.write(JSON.stringify({error: code}) + '\n'); process.exitCode = 1
})
