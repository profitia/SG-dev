import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveDevelopmentBridge, buildBridgePreflight } from './development-bridge.mjs'

test('bridge selects all three actual tracks and their ordered Canon without granting authority', () => {
  for (const [key, port] of [['SG2', 3201], ['SRM', 3202], ['ARCHITECTURE', 3203]]) {
    const plan = resolveDevelopmentBridge(key)
    assert.equal(plan.ports.pmos, port)
    assert.equal(plan.targetEnvironment, 'development')
    assert.equal(plan.selectionGrantsMutationAuthority, false)
    assert.equal(plan.canonLoadOrder[0], 'Canon/v3.0-profitia-agent-execution-canon.md')
    assert(plan.canonLoadOrder.includes('Canon/registries/profitia-projects-v1.json'))
  }
  assert.throws(() => resolveDevelopmentBridge('CIC'), /own repository/)
  assert.throws(() => resolveDevelopmentBridge('unknown'), /Unknown project/)
})
test('bridge delegates full gates and refuses missing or ambiguous host identity', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'development-bridge-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'apps/pmos'), { recursive: true })
  fs.writeFileSync(path.join(root, 'apps/pmos/.env.local'), 'PMOS_EXECUTION_ENVIRONMENT=local\n')
  const plan = resolveDevelopmentBridge('ARCHITECTURE')
  const options = { taskId: 'ACTUAL-TASK-001', title: 'Task', scope: 'architecture', targets: ['Canon/registries/profitia-projects-v1.json'], hostConversationId: 'actual-chat-001', requireBegin: true }
  const result = buildBridgePreflight(plan, options, root)
  assert.equal(result.project, 'ARCHITECTURE')
  assert.equal(result.requireBegin, true)
  for (const key of ['ci', 'offline', 'allowDirty', 'skipRuntime']) assert.equal(result[key], false)
  assert.throws(() => buildBridgePreflight(plan, { ...options, hostConversationId: undefined }, root), /actual host/)
  assert.throws(() => buildBridgePreflight(plan, { ...options, hostConversationUnavailable: true }, root), /actual host/)
  assert.throws(() => buildBridgePreflight(plan, { ...options, targets: [] }, root), /exact targets/)
})
