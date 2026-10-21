import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'
import { validateGovernanceManifest } from './validate-governance-manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const baselinePath = 'Canon/registries/current-architecture-baseline-v1.json'
const beforeSha = 'faa97ee433a9f60de28b417b4ee323759c7c9ffb'
const before = p => JSON.parse(execFileSync('git', ['show', `${beforeSha}:${p}`], { cwd: root, encoding: 'utf8' }))
const route = (key, targets) => resolveProjectRouting({ profile: resolveProjectProfile(key, root), targets, repositoryRoot: root })
const app = 'apps/identity-runtime/package.json'
const workflow = '.github/workflows/identity-runtime-ci.yml'

test('approved application and exact CI path resolve exclusively to Architecture Platform', () => {
  const result = route('ARCHITECTURE', [app, 'apps/identity-runtime/app/register/page.tsx', workflow])
  assert.equal(result.ok, true, result.error)
  for (const r of result.results) {
    assert.equal(r.resolutionStatus, 'RESOLVED')
    assert.equal(r.currentOwner, 'Architecture Platform')
    assert.equal(r.baselineClassification, 'ALIGNED')
    assert.equal(r.projectBoundaryStatus, 'ALLOWED')
    assert.deepEqual(r.allowedProjectKeys, ['ARCHITECTURE'])
    assert.equal(r.highestSpecificityMatchCount, 1)
  }
  assert.equal(result.results[0].matchedSurfaceId, 'IDENTITY-BASE-001')
  assert.equal(result.results[2].matchedSurfaceId, 'IDENTITY-BASE-002')
})

test('SG2/SRM cannot write runtime, identity CI or the existing shared contracts', () => {
  for (const key of ['SG2', 'SRM']) {
    for (const target of [app, workflow, 'packages/platform-contracts/src/identity-provider.mjs']) {
      const result = route(key, [target])
      assert.equal(result.ok, false)
      assert.equal(result.results[0].projectBoundaryStatus, 'DENIED')
    }
  }
  assert.equal(route('ARCHITECTURE', ['apps/sg-runtime/app/page.tsx']).ok, false)
  assert.equal(route('ARCHITECTURE', ['apps/srm/app/login/page.tsx']).ok, false)
  assert.equal(route('ARCHITECTURE', ['packages/platform-contracts/src/identity-provider.mjs']).ok, true)
})

test('onboarding adds exactly two rules and preserves every existing surface and epoch', () => {
  const previous = before(baselinePath)
  const current = read(baselinePath)
  const oldIds = new Set(previous.surfaces.map(s => s.id))
  assert.deepEqual(current.surfaces.filter(s => oldIds.has(s.id)), previous.surfaces)
  assert.deepEqual(current.surfaces.filter(s => !oldIds.has(s.id)).map(s => s.id), ['IDENTITY-BASE-001', 'IDENTITY-BASE-002'])
  const { surfaces: ignoredOld, ...oldMetadata } = previous
  const { surfaces: ignoredNew, ...newMetadata } = current
  assert.deepEqual(newMetadata, oldMetadata)
  // Probe all original patterns, not just the two primary product roots.
  for (const surface of previous.surfaces) for (const pattern of surface.pathPatterns) {
    const target = pattern.endsWith('/**') ? pattern.slice(0, -3) + '/routing-regression-probe' : pattern
    const results = ['SG2', 'SRM', 'ARCHITECTURE'].map(key => route(key, [target]).results[0])
    for (const r of results) assert.notEqual(r?.matchedSurfaceId, 'IDENTITY-BASE-001')
    for (const r of results) assert.notEqual(r?.matchedSurfaceId, 'IDENTITY-BASE-002')
  }
})

test('sibling application names remain unknown and neighboring workflow is not captured', () => {
  for (const target of ['apps/identity-runtime-evil/package.json', 'apps/identity-runtimes/package.json']) {
    const r = route('ARCHITECTURE', [target])
    assert.equal(r.ok, false)
    assert.equal(r.results[0].resolutionStatus, 'NO_MATCH')
  }
  assert.notEqual(route('ARCHITECTURE', ['.github/workflows/identity-runtime-ci.yml.extra']).results[0]?.matchedSurfaceId, 'IDENTITY-BASE-002')
  assert.equal(route('ARCHITECTURE', ['../identity-runtime/package.json']).ok, false)
})

test('manifest and onboarding bind the same decision without fake physical activation', () => {
  const manifest = validateGovernanceManifest(root)
  assert.equal(manifest.valid, true, manifest.errors.join('\n'))
  const doc = manifest.activeDocuments.find(d => d.id === 'identity-runtime-architecture-and-ownership')
  assert.equal(doc.owner, 'Architecture Platform')
  assert.deepEqual(doc.appliesTo, ['SG2', 'SRM', 'ARCHITECTURE'])
  const current = read('Canon/registries/architecture-onboarding-v1.json')
  const previous = before('Canon/registries/architecture-onboarding-v1.json')
  const { plannedModules, ...unchanged } = current
  assert.deepEqual(unchanged, previous)
  assert.equal(plannedModules.length, 1)
  const module = plannedModules[0]
  assert.equal(module.owner, 'Architecture Platform')
  assert.equal(module.projectKey, 'ARCHITECTURE')
  assert.equal(module.pathPattern, 'apps/identity-runtime/**')
  assert.equal(module.ciPath, workflow)
  assert.equal(module.approval.decision, 'G1 GRANTED')
  assert.equal(module.approval.sourceType, 'EXPLICIT_OWNER_CHAT_INSTRUCTION')
  assert.equal(module.runtimeCreated, false)
  assert.equal(module.plannedRender.serviceId, null)
  assert.equal(module.profileStorage.databaseName, 'platform_private')
  assert.equal(module.profileStorage.neonProjectId, 'spring-bread-28217539')
  assert.equal(module.profileStorage.runtimeRole, null)
  assert.equal(module.decisionDocument, doc.path)
})

test('B0 preserves project/environment identities and creates no application or workflow', () => {
  for (const p of ['Canon/registries/profitia-projects-v1.json', 'Canon/registries/architecture-environment-topology-v1.json', 'Canon/registries/sg2-environment-topology-v1.json', 'Canon/registries/srm-environment-topology-v1.json']) assert.deepEqual(read(p), before(p))
  assert.equal(fs.existsSync(path.join(root, 'apps/identity-runtime')), false)
  assert.equal(fs.existsSync(path.join(root, workflow)), false)
})
