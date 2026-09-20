import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('repository governance manifest is valid and has one active execution canon', () => {
  const result = validateGovernanceManifest(repositoryRoot)
  assert.equal(result.valid, true, result.errors.join('\n'))
  assert.equal(result.activeDocuments.filter((document) => document.id === 'agent-execution-canon').length, 1)
  assert.equal(result.manifest.documents.find((document) => document.id === 'vsc-execution-canon').status, 'SUPERSEDED')
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
