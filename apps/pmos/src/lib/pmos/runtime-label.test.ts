import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePmosRuntimeLabel } from './runtime-label'
const env = (values: Record<string, string> = {}): NodeJS.ProcessEnv => ({ NODE_ENV: 'test', ...values })

test('runtime labels use the canonical profile while preserving the SG2 default', () => {
  assert.equal(resolvePmosRuntimeLabel(env()).projectName, 'SpendGuru 2.0')
  for (const [identity, projectKey] of [['srm', 'SRM'], ['architecture', 'ARCHITECTURE'], ['CIC', 'CIC']]) {
    const label = resolvePmosRuntimeLabel(env({ PMOS_PROJECT_NAME: identity, TARGET_ENVIRONMENT: 'development' }))
    assert.equal(label.projectKey, projectKey)
    assert.equal(label.targetEnvironment, 'development')
    assert(label.title.includes(label.projectName))
  }
})
test('unknown profile, foreign continuity and elevated target cannot mislabel the ledger', () => {
  assert.throws(() => resolvePmosRuntimeLabel(env({ PMOS_PROJECT_NAME: 'unknown' })), /Unknown PMOS project/)
  assert.throws(() => resolvePmosRuntimeLabel(env({ PMOS_PROJECT_NAME: 'ARCHITECTURE', TARGET_ENVIRONMENT: 'staging' })), /conflicts/)
  assert.throws(() => resolvePmosRuntimeLabel(env({ PMOS_PROJECT_NAME: 'ARCHITECTURE', DATABASE_URL: 'postgresql://fixture:fixture@ep-plain-king-al45f92h.c-3.eu-central-1.aws.neon.tech/neondb' })), /identity mismatch/)
  assert.throws(() => resolvePmosRuntimeLabel(env({ PMOS_PROJECT_NAME: 'ARCHITECTURE', DATABASE_URL: 'postgresql://neondb_owner:fixture@ep-solitary-unit-b9b3imd3.c-7.eu-central-1.aws.neon.tech/architecture_pmos?sslmode=require' })), /runtime role/)
})
