import test from 'node:test'
import assert from 'node:assert/strict'
import { assessSg2ReleaseReadiness, requireSg2ReleaseReady } from '../sg2-release-readiness.mjs'
const sha = 'a'.repeat(40)
const gateNames = ['liveBindings', 'applicationSchemas', 'legacyBridgeClosure', 'productCi', 'environmentConfiguration', 'multiServiceManifest', 'forecastProducerAuthority']
const fixture = () => ({ projectKey: 'SG2', sourceAuthority: 'profitia/SG-dev', approvedSourceSha: sha, evidenceExpiresAt: new Date(Date.now()+60000).toISOString(), gates: Object.fromEntries(gateNames.map(key => [key, { status: 'PASS' }])), openBlockers: [] })
test('complete synthetic contract is required at exact approved source', () => assert.equal(requireSg2ReleaseReady(fixture(), 'staging', sha).verdict, 'READY'))
test('missing evidence, gates, CI, foreign source and reserved production fail closed', () => {
  assert.throws(() => requireSg2ReleaseReady(null, 'staging', sha))
  for (const key of gateNames) { const record=fixture(); delete record.gates[key]; assert.throws(() => requireSg2ReleaseReady(record, 'staging', sha)) }
  for (const patch of [{ projectKey: 'SRM' }, { sourceAuthority: 'profitia/other' }, { approvedSourceSha: 'b'.repeat(40) }, { evidenceExpiresAt: '2020-01-01' }, { openBlockers: ['unverified binding'] }]) assert.throws(() => requireSg2ReleaseReady({ ...fixture(), ...patch }, 'development', sha))
  assert.equal(assessSg2ReleaseReadiness(fixture(), 'production', sha).verdict, 'BLOCKED')
})
