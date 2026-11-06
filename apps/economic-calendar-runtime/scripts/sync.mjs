import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {loadConfiguration} from '../src/config.mjs'
import {createDatabase} from '../src/database.mjs'
import {createSynchronizer} from '../src/synchronization.mjs'
export async function runSync(env = process.env) {
  const configuration = loadConfiguration(env, 'ingest')
  const criteriaPath = env.ECR_SYNC_CRITERIA_FILE
  if (!criteriaPath) throw new Error('EXPLICIT_CRITERIA_FILE_REQUIRED')
  const bytes = await readFile(criteriaPath); if (bytes.length > 16000) throw new Error('CRITERIA_FILE_TOO_LARGE')
  const database = createDatabase({connectionString: configuration.connectionString, binding: {databaseName: configuration.databaseName, role: configuration.runtimeRole}})
  try {
    const synchronize = createSynchronizer({configuration, database, sourceConfiguration: {environment: 'development', componentId: env.ECR_SOURCE_COMPONENT_ID,
      consumerApplicationId: configuration.applicationId, receiverApplicationId: 'profitia-source-hub-development', sourceOrigin: env.ECR_SOURCE_COMPONENT_ORIGIN,
      targetOrigin: 'https://source-hub-development.onrender.com', keyId: env.ECR_SOURCE_KEY_ID, privateKey: env.ECR_SOURCE_SIGNING_PRIVATE_KEY}})
    return await synchronize.synchronize({criteria: JSON.parse(bytes.toString('utf8')), organisation: env.ECR_SYNC_ORGANISATION_ID, grantId: env.ECR_SYNC_SERVICE_GRANT_ID, idempotencyKey: env.ECR_SYNC_IDEMPOTENCY_KEY})
  } finally {await database.close()}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runSync().then(result => {
  // Counts/provenance only; no provider event content, user state or credentials.
  process.stdout.write(JSON.stringify({event: 'calendar_sync', ...result}) + '\n')
}).catch(() => {process.stderr.write('{"error":"ECR_SYNC_REFUSED_OR_FAILED"}\n'); process.exitCode = 1})
