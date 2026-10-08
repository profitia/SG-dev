import test from 'node:test'
import assert from 'node:assert/strict'
import { readDashboardPreviewEnvironment, readDashboardPreviewMarketDataDatabaseUrl } from '@/lib/db/env'
import { resolveRuntimeServiceUrl } from '@/lib/environment-identity'
const keys = ['APP_ENV', 'DATABASE_URL', 'MARKET_DATA_DATABASE_URL', 'SG_RUNTIME_BASE_URL'] as const
function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try { for (const key of keys) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key] }; fn() }
  finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } }
}
test('dashboard missing APP_ENV fails before any database read', () => withEnv({}, () => assert.throws(readDashboardPreviewEnvironment, /APP_ENV_REQUIRED/)))
test('dashboard has no generic database or local-file market fallback', () => withEnv({ APP_ENV: 'development', DATABASE_URL: 'postgresql://legacy.invalid/legacy' }, () => assert.equal(readDashboardPreviewMarketDataDatabaseUrl(), null)))
test('dashboard refuses Staging URL under Development before creating a client', () => withEnv({ APP_ENV: 'development', MARKET_DATA_DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-cool-lab-b2wm8biu.c-6.eu-central-1.aws.neon.tech/neondb' }, () => assert.throws(readDashboardPreviewMarketDataDatabaseUrl, /MISMATCH/)))
test('dashboard refuses missing or legacy runtime bridge', () => { for (const value of [undefined, 'https://benchmark-finder-category-builder.onrender.com']) withEnv({ APP_ENV: 'development', SG_RUNTIME_BASE_URL: value }, () => assert.throws(resolveRuntimeServiceUrl)) })
