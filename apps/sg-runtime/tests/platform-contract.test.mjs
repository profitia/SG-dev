import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { assertDevelopmentContext, assertAcceptedContractVersion, developmentContractDigest } from '../../../packages/platform-contracts/src/development-context.mjs'
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const integration = read('../development-integration.json')
const workspaces = read('../../../Canon/registries/development-workspaces-v1.json')
const profiles = read('../../../Canon/registries/profitia-projects-v1.json')
const expectedProjectKey = 'SG2'

test('consumer explicitly accepts exact source and its registered Development surface', () => {
  assert.equal(integration.projectKey, expectedProjectKey)
  assert.equal(integration.scope, 'DEVELOPMENT_VERIFICATION_ONLY')
  assert.equal(integration.automaticProductDeployment, false)
  const workspace = workspaces.workspaces.find((w) => w.projectKey === expectedProjectKey)
  const profile = profiles.projects.find((p) => p.projectKey === expectedProjectKey && p.status === 'ACTIVE')
  assert(profile)
  assert(workspace.packages.includes(integration.sourceSurface))
  assert(profile.workspaces.includes(integration.workspaceName))
  assertAcceptedContractVersion(integration.contract.acceptedVersion)
  assert.equal(developmentContractDigest(), integration.contract.sourceDigest, 'Changed contract requires a governed consumer adoption; do not silently update this digest')
  assert.equal(integration.producer.projectKey, 'ARCHITECTURE')
  assert.equal(integration.producer.repository, 'profitia/SG-dev')
  assert.match(integration.producer.sourceSha, /^[a-f0-9]{40}$/)
  const expected = { projectKey: expectedProjectKey, workspaceName: workspace.workspaceName, targetEnvironment: 'development' }
  assert.deepEqual(assertDevelopmentContext(integration, expected), expected)
})
test('consumer rejects another project or environment before integration', () => {
  const expected = { projectKey: expectedProjectKey, workspaceName: integration.workspaceName, targetEnvironment: 'development' }
  assert.throws(() => assertDevelopmentContext({ ...integration, projectKey: 'ARCHITECTURE' }, expected), /identity mismatch/)
  assert.throws(() => assertDevelopmentContext({ ...integration, targetEnvironment: 'production' }, expected), /Only Development/)
})
