import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertEmptyInitializationState, assertInitializationConnection, resolveInitializationTarget } from './initialize-project-db.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const spec = JSON.parse(fs.readFileSync(path.join(root, 'Canon/registries/architecture-onboarding-v1.json'), 'utf8'))
const target = resolveInitializationTarget(spec, 'pmos')
const ownerUrl = `postgresql://${target.ownerRole}:fixture@${target.host}/${target.databaseName}?sslmode=require`

test('initialization refuses products, Staging, unregistered databases and source schemas', () => {
  assert.throws(() => resolveInitializationTarget({ ...spec, projectKey: 'SG2' }, 'pmos'), /Architecture Development/)
  assert.throws(() => resolveInitializationTarget({ ...spec, targetEnvironment: 'staging' }, 'pmos'), /Architecture Development/)
  assert.throws(() => resolveInitializationTarget(spec, 'srm-app'), /Unregistered/)
  const modified = structuredClone(spec); modified.resources[0].schemaPath = 'apps/srm/db/migrations'
  assert.throws(() => resolveInitializationTarget(modified, 'pmos'), /Wrong PMOS/)
})

test('same-named foreign database, pooled URL, runtime role and insecure connection are rejected', () => {
  assertInitializationConnection(target, ownerUrl)
  assert.throws(() => assertInitializationConnection(target, ownerUrl.replace(target.host, 'foreign.neon.tech')), /exact registered/)
  assert.throws(() => assertInitializationConnection(target, ownerUrl.replace(target.host, target.host.replace('.c-', '-pooler.c-'))), /direct owner/)
  assert.throws(() => assertInitializationConnection(target, ownerUrl.replace(target.ownerRole, target.runtimeRole)), /owner identity/)
  assert.throws(() => assertInitializationConnection(target, ownerUrl.replace('sslmode=require', 'sslmode=disable')), /exact registered/)
})

test('existing data or a foreign connected role can never be initialized', () => {
  const state = { database_name: target.databaseName, connected_role: target.ownerRole, relation_count: 0 }
  assertEmptyInitializationState(target, state)
  assert.throws(() => assertEmptyInitializationState(target, { ...state, relation_count: 1 }), /empty database/)
  assert.throws(() => assertEmptyInitializationState(target, { ...state, connected_role: 'foreign_owner' }), /identity mismatch/)
})

test('validation branch is exact, separate from parent and cannot target laboratory', () => {
  const validation = resolveInitializationTarget(spec, 'pmos', true)
  assert.equal(validation.branchId, 'br-floral-cell-b96289m1')
  assert.notEqual(validation.host, target.host)
  assert.throws(() => resolveInitializationTarget(spec, 'sg-lab', true), /validation branch/)
  const modified = structuredClone(spec); modified.validation.branchId = target.branchId
  assert.throws(() => resolveInitializationTarget(modified, 'pmos', true), /validation branch/)
})
