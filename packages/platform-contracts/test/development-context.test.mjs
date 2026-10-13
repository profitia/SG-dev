import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDevelopmentContext, assertAcceptedContractVersion } from '../src/development-context.mjs'

test('registered consumer identity is immutable and does not manufacture tenant IDs', () => {
  const expected = { projectKey: 'SG2', workspaceName: 'SG-dev', targetEnvironment: 'development' }
  const result = assertDevelopmentContext(expected, expected)
  assert.equal(Object.isFrozen(result), true)
  assert.deepEqual(Object.keys(result), ['projectKey', 'workspaceName', 'targetEnvironment'])
})
test('cross-project, foreign workspace and elevated environments fail closed', () => {
  const expected = { projectKey: 'SRM', workspaceName: 'SG-dev Codespaces SRM', targetEnvironment: 'development' }
  assert.throws(() => assertDevelopmentContext({ ...expected, projectKey: 'SG2' }, expected), /identity mismatch/)
  assert.throws(() => assertDevelopmentContext({ ...expected, workspaceName: 'SG-dev' }, expected), /identity mismatch/)
  for (const environment of ['staging', 'production', undefined]) assert.throws(() => assertDevelopmentContext({ ...expected, targetEnvironment: environment }, expected), /Only Development/)
  assert.throws(() => assertDevelopmentContext(expected, { ...expected, projectKey: 'UNREGISTERED' }), /Registered/)
})
test('consumer adoption cannot silently accept a changed version', () => {
  assert.doesNotThrow(() => assertAcceptedContractVersion('1.0.0'))
  for (const version of ['0.0.0', '2.0.0', undefined]) assert.throws(() => assertAcceptedContractVersion(version), /explicitly accept/)
})
