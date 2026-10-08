#!/usr/bin/env node
// Read-only catalog probe. Never echoes a connection string or business records.
import { spawnSync } from 'node:child_process'
import { assertSg2DatabaseIdentity, assertSg2ProducerIdentity } from '../../packages/governance/src/sg2-environment-identity.mjs'
try {
  const identity = assertSg2DatabaseIdentity({ appEnv: process.env.APP_ENV, connectionString: process.env.MARKET_DATA_DATABASE_URL })
  if (process.argv.includes('--producer')) {
    const series = (process.env.SERIES_IDS || '').split(',').map(value => value.trim()).filter(Boolean)
    if (!series.length) throw new Error('SG2_PRODUCER_SERIES_REQUIRED')
    for (const id of series) assertSg2ProducerIdentity(process.env, id, process.env.PREPARE_HISTORICAL === 'true')
  }
  const url = new URL(process.env.MARKET_DATA_DATABASE_URL)
  const sql = "BEGIN READ ONLY; SET LOCAL statement_timeout=5000; SELECT json_build_object('database',current_database(),'role',current_user,'transactionReadOnly',current_setting('transaction_read_only'),'marketJobs',to_regclass('public.forecast_preparation_job') IS NOT NULL,'applicationSchema',EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='sg_runtime_benchmarks'),'roleBypassRls',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user)); ROLLBACK;"
  const result = spawnSync('psql', ['-X', '-A', '-t', '-h', identity.hostname, '-p', '5432', '-U', identity.role, '-d', identity.databaseName, '-c', sql], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'verify-full', PGSSLROOTCERT: process.env.PGSSLROOTCERT || 'system', PGCONNECT_TIMEOUT: '8' }, encoding: 'utf8', timeout: 15000,
  })
  if (result.status !== 0) throw new Error('SG2_READ_ONLY_DATABASE_PROBE_FAILED')
  const actual = JSON.parse(result.stdout.split('\n').find(line => line.startsWith('{')))
  if (actual.database !== identity.databaseName || actual.role !== identity.role || actual.transactionReadOnly !== 'on' || !actual.marketJobs) throw new Error('SG2_DATABASE_CATALOG_IDENTITY_MISMATCH')
  console.log(JSON.stringify({ status: 'DIRECTLY_VERIFIED', identity, catalog: actual }))
} catch (error) {
  console.error(error.message?.startsWith('SG2_') ? error.message : 'SG2_IDENTITY_PROBE_FAILED')
  process.exitCode = 1
}
