import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PMOS_PROJECT_NAME,
  SRM_PMOS_PROJECT_NAME,
  assertPmosControlPlaneEnvironment,
  buildNamespacedPublicationId,
  findHistoricalPmosProjectProfile,
  getConfiguredPmosProjectName,
  getConfiguredPmosWorkspaceName,
  isPhrSatisfiedForCloseout,
  listActivePmosProjectProfiles,
  normalizePmosProjectName,
  normalizeHistoricalPmosProjectName,
  normalizePmosWorkspaceName,
  requireCanonicalMemorosProjectId,
  requirePmosProjectProfile,
  resolvePmosProjectProfile,
  runMemorosPublicationIfEnabled,
} from './project-profile'

function makeEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...process.env, ...values }
}

test('registry exposes isolated SG2, SRM, and CIC profiles', () => {
  assert.deepEqual(listActivePmosProjectProfiles().map((profile) => profile.projectKey), ['SG2', 'SRM', 'CIC'])
  assert.notEqual(requirePmosProjectProfile('SG2').database.projectId, requirePmosProjectProfile('CIC').database.projectId)
  assert.equal(requirePmosProjectProfile('SG2').continuity.controlPlaneEnvironment, 'development')
  assert.equal(requirePmosProjectProfile('SRM').continuity.controlPlaneEnvironment, 'development')
})

test('SG2 PMOS is bound to the Development continuity control plane', () => {
  const sg2 = requirePmosProjectProfile('SG2')
  assert.doesNotThrow(() => assertPmosControlPlaneEnvironment(sg2, 'development'))
  assert.throws(() => assertPmosControlPlaneEnvironment(sg2, 'staging'), /conflicts with the canonical SG2 continuity control plane development/)
  assert.throws(() => assertPmosControlPlaneEnvironment(sg2, 'production'), /conflicts with the canonical SG2 continuity control plane development/)
})

test('SRM PMOS is bound to the Development continuity control plane', () => {
  const srm = requirePmosProjectProfile('SRM')
  assert.doesNotThrow(() => assertPmosControlPlaneEnvironment(srm, 'development'))
  assert.doesNotThrow(() => assertPmosControlPlaneEnvironment(srm, 'codespaces'))
  assert.throws(() => assertPmosControlPlaneEnvironment(srm, 'staging'), /conflicts with the canonical SRM continuity control plane development/)
  assert.throws(() => assertPmosControlPlaneEnvironment(srm, 'production'), /conflicts with the canonical SRM continuity control plane development/)
})

test('project normalization resolves registered aliases and rejects unknown profiles at execution', () => {
  assert.equal(normalizePmosProjectName('sg-dev'), DEFAULT_PMOS_PROJECT_NAME)
  assert.equal(normalizePmosProjectName('srm'), SRM_PMOS_PROJECT_NAME)
  assert.equal(normalizePmosProjectName('CIC'), 'Conversational Intelligence Core')
  assert.throws(() => requirePmosProjectProfile('unknown project'), /Unknown PMOS project/)
})

test('retired PCOS runtime label remains readable as history but cannot select an active PMOS profile', () => {
  const retiredLabel = 'SpendGuru 2.0 - PCOS Runtime'
  assert.equal(normalizePmosProjectName(retiredLabel), retiredLabel)
  assert.throws(() => requirePmosProjectProfile(retiredLabel), /Unknown PMOS project/)
  assert.equal(findHistoricalPmosProjectProfile(retiredLabel)?.projectKey, 'SG2')
  assert.equal(normalizeHistoricalPmosProjectName(retiredLabel), DEFAULT_PMOS_PROJECT_NAME)
})

test('workspace normalization is registry driven', () => {
  assert.equal(normalizePmosWorkspaceName('SG-dev'), 'SG-dev')
  assert.equal(normalizePmosWorkspaceName('SG-dev-codespaces-srm'), 'SG-dev Codespaces SRM')
  assert.equal(normalizePmosWorkspaceName('conversational-intelligence-core'), 'conversational-intelligence-core')
})

test('configured project and workspace preserve safe SG2 compatibility default', () => {
  assert.equal(getConfiguredPmosProjectName(makeEnv({ PMOS_PROJECT_NAME: undefined })), DEFAULT_PMOS_PROJECT_NAME)
  assert.equal(getConfiguredPmosProjectName(makeEnv({ PMOS_PROJECT_NAME: 'srm' })), SRM_PMOS_PROJECT_NAME)
  assert.equal(getConfiguredPmosWorkspaceName(makeEnv({ PMOS_WORKSPACE_NAME: 'sg dev codespaces srm' })), 'SG-dev Codespaces SRM')
})

test('continuity policies come from the canonical registry and cannot be weakened by environment', async () => {
  const sg2 = resolvePmosProjectProfile({ projectName: 'SpendGuru 2.0', workspaceName: 'SG-dev' })
  const srm = resolvePmosProjectProfile({ projectName: 'SRM', workspaceName: 'SG-dev Codespaces SRM', memorosMode: 'disabled' })
  const cic = resolvePmosProjectProfile({ projectName: 'CIC', workspaceName: 'conversational-intelligence-core' })

  assert.equal(sg2.memorosEnabled, true)
  assert.equal(cic.memorosEnabled, true)
  assert.equal(srm.memorosEnabled, false)
  assert.equal(srm.memorosAuditStatus, 'MEMOROS_DISABLED_BY_PROJECT_PROFILE')
  assert.throws(() => resolvePmosProjectProfile({ projectName: 'SG2', memorosMode: 'disabled' }), /conflicts with the canonical SG2/)
  assert.throws(() => resolvePmosProjectProfile({ projectName: 'CIC', workspaceName: 'SG-dev' }), /not allowed/)

  let called = false
  const publication = await runMemorosPublicationIfEnabled(srm, async () => { called = true; return 'unexpected' })
  assert.equal(publication.attempted, false)
  assert.equal(called, false)
})

test('PHR ids are namespaced and every active profile requires successful PHR closeout', () => {
  const sg2 = resolvePmosProjectProfile({ projectName: 'SG2' })
  const srm = resolvePmosProjectProfile({ projectName: 'SRM' })

  assert.equal(buildNamespacedPublicationId('SG2', 'TASK-1'), 'SG2:TASK-1')
  assert.equal(buildNamespacedPublicationId('SRM', 'TASK-1'), 'SRM:TASK-1')
  assert.equal(isPhrSatisfiedForCloseout(sg2, 'FAILED'), false)
  assert.equal(isPhrSatisfiedForCloseout(sg2, 'PUBLISHED'), true)
  assert.equal(isPhrSatisfiedForCloseout(srm, 'IDEMPOTENT'), true)
})

test('MEMOROS destination identity is canonical and isolated per enabled project', () => {
  const sg2 = resolvePmosProjectProfile({ projectName: 'SG2', workspaceName: 'SG-dev' })
  const cic = resolvePmosProjectProfile({ projectName: 'CIC', workspaceName: 'conversational-intelligence-core' })
  const srm = resolvePmosProjectProfile({ projectName: 'SRM', workspaceName: 'SG-dev Codespaces SRM' })
  assert.equal(requireCanonicalMemorosProjectId(sg2), 'cmptxz92m000023gjw2r3gbf5')
  assert.equal(requireCanonicalMemorosProjectId(cic), 'cmubasxat03t71glbo4x0nhfn')
  assert.notEqual(requireCanonicalMemorosProjectId(sg2), requireCanonicalMemorosProjectId(cic))
  assert.throws(() => requireCanonicalMemorosProjectId(srm), /disabled/)
})
