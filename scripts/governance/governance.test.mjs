import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('repository governance manifest is valid and has one active execution canon', () => {
  const result = validateGovernanceManifest(repositoryRoot)
  assert.equal(result.valid, true, result.errors.join('\n'))
  assert.equal(result.activeDocuments.filter((document) => document.id === 'agent-execution-canon').length, 1)
  assert.equal(result.manifest.documents.find((document) => document.id === 'vsc-execution-canon').status, 'SUPERSEDED')
  assert.equal(result.manifest.documents.find((document) => document.id === 'sg2-agent-execution-canon-v2').status, 'SUPERSEDED')
})

test('project profiles route SG2 and fail closed for unknown projects or missing CIC ownership registry', () => {
  const sg2 = resolveProjectProfile('sg-dev', repositoryRoot)
  const cic = resolveProjectProfile('CIC', repositoryRoot)
  assert.equal(sg2.projectKey, 'SG2')
  assert.equal(cic.repository.slug, 'profitia/conversational-intelligence-core')
  assert.throws(() => resolveProjectProfile('unregistered', repositoryRoot), /Unknown project/)

  const sg2Routing = resolveProjectRouting({ profile: sg2, targets: ['apps/pmos/package.json'], repositoryRoot })
  assert.equal(sg2Routing.ok, true)
  const cicRouting = resolveProjectRouting({ profile: cic, targets: ['src/index.ts'], repositoryRoot })
  assert.equal(cicRouting.ok, false)
  assert.match(cicRouting.error, /no active routing registry/)
})

test('manifest validation rejects an active dependency on a superseded document', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sg2-governance-manifest-'))
  const manifestDirectory = path.join(tempRoot, 'Canon', 'registries')
  fs.mkdirSync(manifestDirectory, { recursive: true })
  fs.writeFileSync(path.join(tempRoot, 'AGENTS.md'), 'loader')
  fs.mkdirSync(path.join(tempRoot, 'scripts', 'governance'), { recursive: true })
  fs.writeFileSync(path.join(tempRoot, 'scripts', 'governance', 'governance-preflight.mjs'), 'export {}')
  fs.writeFileSync(path.join(tempRoot, 'active.md'), 'active')
  fs.writeFileSync(path.join(tempRoot, 'old.md'), 'old')
  fs.writeFileSync(path.join(manifestDirectory, 'governance-manifest-v2.json'), JSON.stringify({
    schemaVersion: '2.0',
    validation: { failClosed: true },
    entrypoint: 'AGENTS.md',
    preflight: 'scripts/governance/governance-preflight.mjs',
    documents: [
      { id: 'old', version: '1', owner: 'test', path: 'old.md', status: 'SUPERSEDED', loadOrder: null, dependsOn: [], supersededBy: 'active' },
      { id: 'active', version: '2', owner: 'test', path: 'active.md', status: 'ACTIVE', loadOrder: 1, dependsOn: ['old'] },
    ],
  }))

  const result = validateGovernanceManifest(tempRoot)
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /depends on superseded/)
})
