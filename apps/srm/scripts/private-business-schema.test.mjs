import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { assertPrivateBaseline, privateBusinessPlan } from '../db/private-store/initialize.mjs'
import { migrationManifest, migrationStatements, runMigrations } from './staging-migrate.mjs'
const binding = { environment: 'development', projectId: 'isolated-private-project',
  branchId: 'isolated-private-branch', databaseName: 'srm_private_host_test', role: 'srm_private_host_runtime' }
const sourceSha = 'a'.repeat(40)
const boundary = readFileSync(new URL('../db/security/private-operation-boundaries.sql', import.meta.url), 'utf8')

test('the private schema pins exact existing source bytes, order and boundary', () => {
  const sources = migrationManifest()
  assert.equal(assertPrivateBaseline(sources, boundary).baseline.length, 18)
  assert.throws(() => assertPrivateBaseline(sources.slice(0, 17), boundary), /missing/)
  assert.throws(() => assertPrivateBaseline([sources[1], sources[0], ...sources.slice(2)], boundary), /drift/)
  assert.throws(() => assertPrivateBaseline(sources.map((m, i) => i ? m : { ...m, sql: m.sql + '\n-- drift' }), boundary), /mismatch/)
  assert.throws(() => assertPrivateBaseline(sources, boundary + '\n-- drift'), /drift/)
  // A later migration can be developed independently but is never adopted here.
  assert.equal(assertPrivateBaseline([...sources.slice(0, 18), { version: '0019_unadopted' }], boundary).baseline.length, 18)
})
test('the canonical plan preserves raw sources and parameterized ledger writes', () => {
  const sources = migrationManifest().slice(0, 18), steps = migrationStatements(sources)
  assert.equal(steps.length, 36)
  for (let i = 0; i < sources.length; i++) {
    assert.equal(steps[i * 2].sql, sources[i].sql)
    assert.deepEqual(steps[i * 2 + 1].values, [sources[i].version, sources[i].checksum])
  }
  assert.throws(() => migrationStatements([{ ...sources[0], version: "0001_x';DROP SCHEMA srm" }]), /mismatch/)
})
test('the pure operator plan requires explicit safe bindings and an accepted source revision', () => {
  assert.throws(() => privateBusinessPlan({ binding, sourceSha: 'main' }), /source SHA/)
  for (const patch of [{ environment: 'production' }, { role: 'srm_app_runtime' }, { role: 'neondb_owner' }, { databaseName: 'x; DROP DATABASE other' }, { branchId: "x'\n" }]) {
    assert.throws(() => privateBusinessPlan({ binding: { ...binding, ...patch }, sourceSha }))
  }
  const plan = privateBusinessPlan({ binding, sourceSha })
  assert.equal(plan.migrationCount, 18); assert.equal(plan.expectedTables.length, 22)
  assert.match(plan.schemaDigest, /^[a-f0-9]{64}$/)
  assert(!plan.sql.some(sql => /CREATE ROLE|DROP SCHEMA|TRUNCATE|UPDATE profitia_access\.applications/.test(sql)))
})
test('the existing Stage migrator still refuses a private-store destination', async () => {
  const calls = []
  await assert.rejects(runMigrations({ async query(sql) {
    calls.push(sql)
    return sql.includes('current_database') ? { rows: [{ name: 'platform_private' }] } : { rows: [] }
  } }), /Product database identity mismatch/)
  assert.deepEqual(calls, ['BEGIN', 'SELECT current_database() AS name', 'ROLLBACK'])
})
