import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PMOS_PROJECT_NAME,
  SRM_PMOS_PROJECT_NAME,
  getConfiguredPmosProjectName,
  getConfiguredPmosWorkspaceName,
  isPhrSatisfiedForCloseout,
  normalizePmosProjectName,
  normalizePmosWorkspaceName,
  resolvePmosProjectProfile,
  runMemorosPublicationIfEnabled,
} from './project-profile'

function makeEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...values,
  }
}

test('project normalization preserves SpendGuru aliases and adds SRM aliases', () => {
  const spendGuruAliases = [
    'SpendGuru 2.0',
    'Spend Guru',
    'SpendGuru',
    'SpendGuru 2 0',
    'SpendGuru-2',
    'sg2-discovery-runtime',
    'sg-dev',
    'SpendGuru 2.0 - PMOS',
    'SpendGuru 2.0 - PCOS Runtime',
    'SpendGuru 2.0 — PMOS',
    'SpendGuru 2.0 — PCOS Runtime',
  ]

  spendGuruAliases.forEach((alias) => {
    assert.equal(normalizePmosProjectName(alias), DEFAULT_PMOS_PROJECT_NAME)
  })

  assert.equal(normalizePmosProjectName('SRM'), SRM_PMOS_PROJECT_NAME)
  assert.equal(normalizePmosProjectName('srm porr'), 'srm porr')
  assert.equal(normalizePmosProjectName('srm / porr'), 'srm / porr')
})

test('workspace normalization accepts SRM Codespaces variants', () => {
  assert.equal(normalizePmosWorkspaceName('SG-dev'), 'SG-dev')
  assert.equal(normalizePmosWorkspaceName('SG dev codespaces srm'), 'SG-dev Codespaces SRM')
  assert.equal(normalizePmosWorkspaceName('SG-dev-codespaces-srm'), 'SG-dev Codespaces SRM')
})

test('configured project and workspace default safely', () => {
  assert.equal(getConfiguredPmosProjectName(makeEnv({ PMOS_PROJECT_NAME: undefined })), DEFAULT_PMOS_PROJECT_NAME)
  assert.equal(getConfiguredPmosProjectName(makeEnv({ PMOS_PROJECT_NAME: 'srm' })), SRM_PMOS_PROJECT_NAME)
  assert.equal(getConfiguredPmosWorkspaceName(makeEnv({ PMOS_WORKSPACE_NAME: 'sg dev codespaces srm' })), 'SG-dev Codespaces SRM')
})

test('missing PMOS_MEMOROS_MODE defaults to required and requires PHR for SpendGuru governance v2', () => {
  const profile = resolvePmosProjectProfile({ projectName: 'SpendGuru 2.0' })

  assert.equal(profile.memorosMode, 'required')
  assert.equal(profile.memorosEnabled, true)
  assert.equal(profile.phrRequiredForCloseout, true)
  assert.equal(profile.memorosAuditStatus, 'MEMOROS_REQUIRED')
})

test('disabled Memoros mode is allowed only for SRM', async () => {
  const profile = resolvePmosProjectProfile({
    projectName: 'SRM',
    workspaceName: 'SG-dev Codespaces SRM',
    memorosMode: 'disabled',
  })

  let called = false
  const result = await runMemorosPublicationIfEnabled(profile, async () => {
    called = true
    return 'should-not-run'
  })

  assert.equal(profile.memorosEnabled, false)
  assert.equal(profile.memorosAuditStatus, 'MEMOROS_DISABLED_BY_PROJECT_PROFILE')
  assert.equal(result.attempted, false)
  assert.equal(result.result, null)
  assert.equal(called, false)
})

test('disabled Memoros mode is rejected for SpendGuru and unknown mode fails closed', () => {
  assert.throws(
    () => resolvePmosProjectProfile({ projectName: 'SpendGuru 2.0', memorosMode: 'disabled' }),
    /allowed only for project SRM/,
  )

  assert.throws(
    () => resolvePmosProjectProfile({ projectName: 'SRM', memorosMode: 'shadow' }),
    /invalid\. Valid values: required, disabled/,
  )

  assert.throws(
    () => resolvePmosProjectProfile({ projectName: 'SRM', memorosMode: '   ' }),
    /set but empty/,
  )
})

test('both SRM and SpendGuru closeout require successful PHR', () => {
  const srmProfile = resolvePmosProjectProfile({ projectName: 'SRM', memorosMode: 'disabled' })
  const sgProfile = resolvePmosProjectProfile({ projectName: 'SpendGuru 2.0', memorosMode: 'required' })

  assert.equal(isPhrSatisfiedForCloseout(srmProfile, 'FAILED'), false)
  assert.equal(isPhrSatisfiedForCloseout(srmProfile, 'PUBLISHED'), true)
  assert.equal(isPhrSatisfiedForCloseout(srmProfile, 'IDEMPOTENT'), true)
  assert.equal(isPhrSatisfiedForCloseout(sgProfile, 'FAILED'), false)
  assert.equal(isPhrSatisfiedForCloseout(sgProfile, 'PUBLISHED'), true)
})
