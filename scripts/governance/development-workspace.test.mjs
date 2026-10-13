import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadWorkspaceRegistry, readWorkspaceEnvironment, validateWorkspaceBinding, validatePmosConfiguration } from './development-workspace.mjs'
import { resolveProjectProfile } from './project-profile.mjs'

test('three workspace ports and directories are unique', () => {
  const registry = loadWorkspaceRegistry()
  assert.deepEqual(registry.workspaces.map((w) => w.projectKey), ['SG2', 'SRM', 'ARCHITECTURE'])
  assert.equal(new Set(registry.workspaces.flatMap((w) => Object.values(w.ports))).size, 7)
})

test('port collision fails registry validation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-port-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const registry = loadWorkspaceRegistry()
  registry.workspaces[1].ports.pmos = registry.workspaces[0].ports.pmos
  fs.mkdirSync(path.join(root, 'Canon/registries'), { recursive: true })
  fs.writeFileSync(path.join(root, 'Canon/registries/development-workspaces-v1.json'), JSON.stringify(registry))
  assert.throws(() => loadWorkspaceRegistry(root), /colliding/)
})

test('wrong project, environment and missing dedicated history binding are rejected', () => {
  const workspace = loadWorkspaceRegistry().workspaces[0]
  const binding = { DEVELOPMENT_WORKSPACE_PROJECT_KEY: 'SG2', TARGET_ENVIRONMENT: 'development', PHR_REPOSITORY_PATH: '/tmp/sg2-phr' }
  validateWorkspaceBinding(workspace, binding)
  assert.throws(() => validateWorkspaceBinding(workspace, { ...binding, DEVELOPMENT_WORKSPACE_PROJECT_KEY: 'SRM' }), /identity/)
  assert.throws(() => validateWorkspaceBinding(workspace, { ...binding, TARGET_ENVIRONMENT: 'staging' }), /Development/)
  assert.throws(() => validateWorkspaceBinding(workspace, { ...binding, PHR_REPOSITORY_PATH: '../shared-history' }), /Absolute/)
})

test('same database name on a foreign Neon host cannot satisfy PMOS identity', () => {
  const workspace = loadWorkspaceRegistry().workspaces[0]
  const profile = resolveProjectProfile('SG2')
  const url = `postgresql://fixture:fixture@${profile.database.allowedHosts[0]}/${profile.database.databaseName}`
  const env = { PMOS_PROJECT_NAME: profile.displayName, PMOS_WORKSPACE_NAME: workspace.workspaceName, TARGET_ENVIRONMENT: 'development', DATABASE_URL: url, DIRECT_URL: url, PMOS_MEMOROS_MODE: 'required' }
  validatePmosConfiguration(profile, workspace, env)
  assert.throws(() => validatePmosConfiguration(profile, workspace, { ...env, DATABASE_URL: 'postgresql://fixture:fixture@foreign.neon.tech/neondb' }), /registered PMOS database/)
  assert.throws(() => validatePmosConfiguration(profile, workspace, { ...env, DIRECT_URL: 'postgresql://fixture:fixture@foreign.neon.tech/neondb' }), /registered PMOS database/)
  assert.throws(() => validatePmosConfiguration(profile, workspace, { ...env, PMOS_MEMOROS_MODE: 'disabled' }), /policy/)
})

test('runtime role is enforced when declared and env parser preserves quoted paths', (t) => {
  const workspace = loadWorkspaceRegistry().workspaces[0]
  const profile = { ...resolveProjectProfile('SG2'), database: { ...resolveProjectProfile('SG2').database, runtimeRole: 'limited_runtime' } }
  const url = `postgresql://owner:fixture@${profile.database.allowedHosts[0]}/${profile.database.databaseName}`
  const env = { PMOS_PROJECT_NAME: profile.displayName, PMOS_WORKSPACE_NAME: workspace.workspaceName, TARGET_ENVIRONMENT: 'development', DATABASE_URL: url, DIRECT_URL: url }
  assert.throws(() => validatePmosConfiguration(profile, workspace, env), /runtime role/)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-env-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, '.env.local')
  fs.writeFileSync(file, 'PHR_REPOSITORY_PATH="/tmp/path with spaces"\n# ignored\nTARGET_ENVIRONMENT=development\n')
  assert.equal(readWorkspaceEnvironment(file).PHR_REPOSITORY_PATH, '/tmp/path with spaces')
})
