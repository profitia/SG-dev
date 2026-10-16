import test from 'node:test'
import assert from 'node:assert/strict'
import { assertRuntimeDatabaseIdentity, assertSg2WorkerIdentity } from '@/lib/environment-identity'
test('runtime guards reject missing APP_ENV and foreign database before writes', () => {
 const previous = process.env.APP_ENV
 try {
  delete process.env.APP_ENV
  assert.throws(() => assertRuntimeDatabaseIdentity(undefined, 'market'), /APP_ENV_REQUIRED/)
  process.env.APP_ENV = 'development'
  assert.throws(() => assertRuntimeDatabaseIdentity('postgresql://neondb_owner:fixture@ep-cool-paper-b22wpbd9.c-6.eu-central-1.aws.neon.tech/neondb', 'market'), /MISMATCH/)
 } finally { if (previous === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous }
})
test('worker entrypoint refuses implicit and ALL lanes before claiming work', () => { for (const lane of [undefined, 'ALL']) assert.throws(() => assertSg2WorkerIdentity({ APP_ENV: 'development', FORECAST_PREPARATION_WORKER_MODE: lane })) })
