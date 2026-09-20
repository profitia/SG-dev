import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDatabaseIdentity,
  assertRegistrationMatches,
  expectedDatabaseName,
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
  scope: 'governance',
  originalTaskRequest: 'Implement governance.',
  declaredTargetPaths: ['Canon/a.md', './apps/pmos/a.ts', 'Canon/a.md'],
  gates: {
    ROUTING_GATE: 'PASS',
    CODE_STATE_GATE: 'PASS',
    TASK_INPUT_GATE: 'PASS',
    PMOS_RUNTIME_GATE: 'WARNING',
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

test('enforces database identity for SG2 and SRM', () => {
  assert.equal(expectedDatabaseName('SRM'), 'srm_pmos')
  assert.equal(expectedDatabaseName('SpendGuru 2.0'), 'neondb')
  assert.doesNotThrow(() => assertDatabaseIdentity('srm_pmos', 'SRM'))
  assert.throws(() => assertDatabaseIdentity('undefined', 'SRM'), /identity mismatch/)
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
    gateSnapshot: parsed.gates,
    status: 'running',
  }
  assert.doesNotThrow(() => assertRegistrationMatches(existing, parsed))
  assert.throws(() => assertRegistrationMatches({ ...existing, conversationId: 'other-conversation' }, parsed), /different input/)
})
