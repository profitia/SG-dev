import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { resolveProbe, assertProbeEvidence } from '../scripts/probe.mjs'
const spec = JSON.parse(fs.readFileSync(new URL('../../../Canon/registries/architecture-onboarding-v1.json', import.meta.url), 'utf8'))
const resource = spec.resources.find((entry) => entry.consumerProjectKey === 'SG2')
const url = `postgresql://${resource.runtimeRole}:fixture@${resource.host}/${resource.databaseName}?sslmode=require`
const env = { PROJECT_KEY: 'ARCHITECTURE', PMOS_WORKSPACE_NAME: 'SG-dev Architecture', TARGET_ENVIRONMENT: 'development', ARCHITECTURE_SG2_LAB_RUNTIME_URL: url }
const taskId = 'ARCHITECTURE-SYNTHETIC-PROBE-TEST', sha = 'a'.repeat(40)
test('laboratory resolves only its exact limited role and preserves evidence on replay', () => {
  const probe = resolveProbe(spec, 'SG2', env, taskId, sha)
  assert.equal(probe.resource.databaseName, 'architecture_sg_lab')
  assert.doesNotThrow(() => assertProbeEvidence(probe.evidence, { ...probe.evidence }))
  assert.throws(() => assertProbeEvidence(probe.evidence, { ...probe.evidence, sourceSha: 'b'.repeat(40) }), /Preserve/)
})
test('product profile, owner, foreign database and missing source are refused before connection', () => {
  assert.throws(() => resolveProbe(spec, 'SG2', { ...env, PROJECT_KEY: 'SG2' }, taskId, sha), /identity mismatch/)
  for (const altered of [url.replace(resource.runtimeRole, 'architecture_sg_lab_owner'), url.replace('architecture_sg_lab?', 'architecture_srm_lab?'), url.replace(resource.host, 'foreign.neon.tech')]) assert.throws(() => resolveProbe(spec, 'SG2', { ...env, ARCHITECTURE_SG2_LAB_RUNTIME_URL: altered }, taskId, sha), /identity mismatch/)
  assert.throws(() => resolveProbe(spec, 'SG2', env, 'SG2-FOREIGN-TASK', sha), /Actual Architecture/)
  assert.throws(() => resolveProbe(spec, 'SG2', env, taskId, ''), /Actual Architecture/)
})
