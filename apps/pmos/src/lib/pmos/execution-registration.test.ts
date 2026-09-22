import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDatabaseIdentity,
  assertRegistrationMatches,
  assertPmosCloseoutIdentity,
  assertControlPlaneContinuity,
  expectedDatabaseName,
  registrationGateSnapshot,
  validateExecutionRegistrationInput,
} from './execution-registration'

const input = {
  schemaVersion: '1.0',
  taskId: 'SG2-GOVERNANCE-001',
  conversationId: 'conversation-governance-001',
  title: 'Governance task',
  project: 'SpendGuru 2.0',
  workspace: 'SG-dev',
  executionEnvironment: 'codex',
  targetEnvironment: 'development',
  scope: 'governance',
  originalTaskRequest: 'Implement governance.',
  declaredTargetPaths: ['Canon/a.md', './apps/pmos/a.ts', 'Canon/a.md'],
  gates: {
    ROUTING_GATE: 'PASS',
    CODE_STATE_GATE: 'PASS',
    TASK_INPUT_GATE: 'PASS',
    PMOS_RUNTIME_GATE: 'WARNING',
    TARGET_ENVIRONMENT_GATE: 'PASS',
    PMOS_CONTROL_PLANE_GATE: 'PASS',
  },
} as const

test('validates and normalizes an honest pre-execution registration', () => {
  const parsed = validateExecutionRegistrationInput(input)
  assert.deepEqual(parsed.declaredTargetPaths, ['Canon/a.md', 'apps/pmos/a.ts'])
})

test('rejects completion evidence, blocked gates, and escaping paths', () => {
  assert.throws(() => validateExecutionRegistrationInput({ ...input, gates: { ...input.gates, ROUTING_GATE: 'BLOCKED' } }), /BLOCKED/)
  assert.throws(() => validateExecutionRegistrationInput({ ...input, declaredTargetPaths: ['../other-repo/file'] }), /repository-relative/)
})

test('SRM PMOS registration and PHR closeout require a verified Development target', () => {
  const srm = {
    ...input, project: 'SRM', workspace: 'SG-dev Codespaces SRM', executionEnvironment: 'development',
    targetEnvironment: 'development',
    gates: { ...input.gates, TARGET_ENVIRONMENT_GATE: 'PASS', PMOS_CONTROL_PLANE_GATE: 'PASS' },
  }
  const parsed = validateExecutionRegistrationInput(srm)
  assert.doesNotThrow(() => assertControlPlaneContinuity(parsed.project, registrationGateSnapshot(parsed)))
  assert.throws(() => validateExecutionRegistrationInput({ ...srm, targetEnvironment: 'staging' }), /targetEnvironment=development/)
  assert.throws(() => validateExecutionRegistrationInput({ ...srm, targetEnvironment: 'production' }), /targetEnvironment=development/)
  assert.throws(() => validateExecutionRegistrationInput({ ...srm, targetEnvironment: undefined }), /targetEnvironment=development/)
  assert.throws(() => validateExecutionRegistrationInput({ ...srm, gates: { ...srm.gates, TARGET_ENVIRONMENT_GATE: 'NOT_APPLICABLE' } }), /passing TARGET_ENVIRONMENT_GATE/)
  assert.throws(() => assertControlPlaneContinuity('SRM', { ...registrationGateSnapshot(parsed), targetEnvironment: 'staging' }), /TARGET_ENVIRONMENT=development/)
  assert.doesNotThrow(() => assertPmosCloseoutIdentity('SRM', 'SRM', registrationGateSnapshot(parsed), 'development'))
  assert.throws(() => assertPmosCloseoutIdentity('SRM', 'SG2', registrationGateSnapshot(parsed), 'development'), /project mismatch/)
  assert.throws(() => assertPmosCloseoutIdentity('SRM', 'SRM', registrationGateSnapshot(parsed), 'staging'), /artifact requires TARGET_ENVIRONMENT=development/)
  assert.throws(() => assertPmosCloseoutIdentity('SRM', 'SRM', registrationGateSnapshot(parsed)), /artifact requires TARGET_ENVIRONMENT=development/)
})

test('direct PMOS registration refuses SG2 Staging, Production and missing target identity', () => {
  for (const targetEnvironment of ['staging', 'production']) {
    assert.throws(() => validateExecutionRegistrationInput({ ...input, targetEnvironment }), /targetEnvironment=development/)
  }
  assert.throws(() => validateExecutionRegistrationInput({ ...input, targetEnvironment: undefined }), /targetEnvironment=development/)
  assert.throws(() => validateExecutionRegistrationInput({ ...input, gates: { ...input.gates, TARGET_ENVIRONMENT_GATE: 'NOT_APPLICABLE' } }), /requires passing/)
  assert.throws(() => validateExecutionRegistrationInput({ ...input, gates: { ...input.gates, PMOS_CONTROL_PLANE_GATE: 'NOT_APPLICABLE' } }), /requires passing/)
  const parsed = validateExecutionRegistrationInput(input)
  assert.doesNotThrow(() => assertControlPlaneContinuity(parsed.project, registrationGateSnapshot(parsed)))
  assert.throws(() => assertPmosCloseoutIdentity('SG2', 'SG2', registrationGateSnapshot(parsed), 'staging'), /artifact requires TARGET_ENVIRONMENT=development/)
  assert.throws(() => assertPmosCloseoutIdentity('SG2', 'SG2', registrationGateSnapshot(parsed)), /artifact requires TARGET_ENVIRONMENT=development/)
})

test('historical registrations remain recoverable but new snapshots cannot omit their target', () => {
  const parsed = validateExecutionRegistrationInput(input)
  assert.doesNotThrow(() => assertControlPlaneContinuity('SG2', parsed.gates))
  assert.doesNotThrow(() => assertPmosCloseoutIdentity('SG2', 'SG2', parsed.gates, 'development'))
  assert.doesNotThrow(() => assertPmosCloseoutIdentity('SRM', 'SRM', parsed.gates))
  assert.throws(() => assertPmosCloseoutIdentity('SRM', 'SRM', parsed.gates, 'staging'), /artifact requires TARGET_ENVIRONMENT=development/)
  assert.doesNotThrow(() => assertControlPlaneContinuity('SG2', { ...parsed.gates, __targetEnvironment: 'development' }))
  assert.throws(() => assertControlPlaneContinuity('SG2', { ...parsed.gates, __targetEnvironment: 'staging' }), /TARGET_ENVIRONMENT=development/)
})

test('enforces project-specific database name and Neon endpoint identity', () => {
  assert.equal(expectedDatabaseName('SRM'), 'srm_pmos')
  assert.equal(expectedDatabaseName('SpendGuru 2.0'), 'neondb')
  assert.equal(expectedDatabaseName('CIC'), 'neondb')
  assert.doesNotThrow(() => assertDatabaseIdentity(
    'srm_pmos',
    'SRM',
    'postgresql://user:secret@ep-dark-frost-b1fmda7e.c-5.eu-central-1.aws.neon.tech/srm_pmos',
  ))
  assert.throws(() => assertDatabaseIdentity(
    'neondb',
    'CIC',
    'postgresql://user:secret@ep-plain-king-al45f92h.c-3.eu-central-1.aws.neon.tech/neondb',
  ), /endpoint identity mismatch/)
  assert.throws(() => assertDatabaseIdentity('undefined', 'SRM', 'postgresql://user:secret@example.com/undefined'), /identity mismatch/)
  assert.throws(() => expectedDatabaseName('unknown'), /Unknown PMOS project/)
})

test('idempotence accepts the same registration and rejects identity drift', () => {
  const parsed = validateExecutionRegistrationInput(input)
  const existing = {
    id: 'prompt-1',
    taskId: parsed.taskId,
    conversationId: parsed.conversationId,
    title: parsed.title,
    project: parsed.project,
    workspace: parsed.workspace,
    executionEnvironment: parsed.executionEnvironment,
    scope: parsed.scope,
    promptContent: parsed.originalTaskRequest,
    declaredTargetPaths: parsed.declaredTargetPaths,
    gateSnapshot: registrationGateSnapshot(parsed),
    status: 'running',
  }
  assert.doesNotThrow(() => assertRegistrationMatches(existing, parsed))
  assert.doesNotThrow(() => assertRegistrationMatches({ ...existing, gateSnapshot: parsed.gates }, parsed))
  assert.throws(() => assertRegistrationMatches({ ...existing, conversationId: 'other-conversation' }, parsed), /different input/)
})
