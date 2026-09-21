import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { resolveHistoricalProjectProfile, resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('repository governance manifest is valid and has one active execution canon', () => {
  const result = validateGovernanceManifest(repositoryRoot)
  assert.equal(result.valid, true, result.errors.join('\n'))
  assert.equal(result.activeDocuments.filter((document) => document.id === 'agent-execution-canon').length, 1)
  assert.equal(result.manifest.documents.find((document) => document.id === 'vsc-execution-canon').status, 'SUPERSEDED')
  assert.equal(result.manifest.documents.find((document) => document.id === 'sg2-agent-execution-canon-v2').status, 'SUPERSEDED')
})

test('project profiles route SG2 and allow only bounded CIC governance bootstrap before its registry exists', () => {
  const sg2 = resolveProjectProfile('sg-dev', repositoryRoot)
  const cic = resolveProjectProfile('CIC', repositoryRoot)
  assert.equal(sg2.projectKey, 'SG2')
  assert.equal(cic.repository.slug, 'profitia/conversational-intelligence-core')
  assert.throws(() => resolveProjectProfile('unregistered', repositoryRoot), /Unknown project/)

  const sg2Routing = resolveProjectRouting({ profile: sg2, targets: ['apps/pmos/package.json'], repositoryRoot })
  assert.equal(sg2Routing.ok, true)
  const tempCicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-governance-bootstrap-'))
  const bootstrapRouting = resolveProjectRouting({
    profile: cic,
    targets: ['AGENTS.md', 'governance/registries/cic-architecture-baseline-v1.json'],
    repositoryRoot: tempCicRoot,
  })
  assert.equal(bootstrapRouting.ok, true)
  assert.equal(bootstrapRouting.bootstrapMode, true)

  const productRouting = resolveProjectRouting({ profile: cic, targets: ['packages/cic-core/src/index.ts'], repositoryRoot: tempCicRoot })
  assert.equal(productRouting.ok, false)
  assert.match(productRouting.error, /restricted to declared governance paths/)

  const registryPath = path.join(tempCicRoot, cic.repository.routingRegistry)
  fs.mkdirSync(path.dirname(registryPath), { recursive: true })
  fs.writeFileSync(registryPath, JSON.stringify({
    schemaVersion: '1.0',
    classificationReferenceSha: '2f59a86144b9f578b6cdc78746bee22192b1cb9f',
    pathResolutionStrategy: 'MOST_SPECIFIC_MATCH_WINS',
    surfaces: [{
      id: 'CIC-BASE-001',
      pathPatterns: ['packages/cic-core/**'],
      currentOwner: 'CIC Core',
      currentResponsibility: 'Canonical shared conversation contracts.',
      baselineClassification: 'ALIGNED',
    }],
  }))
  const onboardedRouting = resolveProjectRouting({ profile: cic, targets: ['packages/cic-core/src/index.ts'], repositoryRoot: tempCicRoot })
  assert.equal(onboardedRouting.ok, true)
  assert.equal(onboardedRouting.bootstrapMode, undefined)
})

test('PCOS is not an active PMOS project identity and cross-runtime coupling stays blocked', () => {
  const retiredLabel = 'SpendGuru 2.0 - PCOS Runtime'
  assert.throws(() => resolveProjectProfile(retiredLabel, repositoryRoot), /Unknown project/)
  assert.equal(resolveHistoricalProjectProfile(retiredLabel, repositoryRoot)?.projectKey, 'SG2')

  const projectRegistry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'Canon/registries/profitia-projects-v1.json'), 'utf8'))
  const sg2 = projectRegistry.projects.find((project) => project.projectKey === 'SG2')
  assert.equal(sg2.aliases.includes(retiredLabel), false)
  assert.equal(sg2.legacyAliases.includes(retiredLabel), true)

  const sourceFiles = (root) => {
    const pending = [root]
    const result = []
    while (pending.length > 0) {
      const current = pending.pop()
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const resolved = path.join(current, entry.name)
        if (entry.isDirectory()) pending.push(resolved)
        else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) result.push(resolved)
      }
    }
    return result
  }
  const importsFrom = (root) => sourceFiles(root)
    .flatMap((file) => fs.readFileSync(file, 'utf8').split('\n').filter((line) => /(?:from\s+|import\s*\(|require\s*\()/.test(line)))
    .join('\n')

  assert.doesNotMatch(importsFrom(path.join(repositoryRoot, 'apps/pcos-explorer/src')), /pmos/i)
  assert.doesNotMatch(importsFrom(path.join(repositoryRoot, 'apps/pmos/src')), /pcos/i)

  const pcosBlueprint = fs.readFileSync(path.join(repositoryRoot, 'apps/pcos-explorer/render.preview.yaml'), 'utf8')
  assert.match(pcosBlueprint, /buildFilter:/)
  assert.match(pcosBlueprint, /apps\/pcos-explorer\/\*\*/)
  assert.doesNotMatch(pcosBlueprint, /(?:DATABASE_URL|DIRECT_URL)/)

  const pcosPackage = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'apps/pcos-explorer/package.json'), 'utf8'))
  assert.equal('db:sync' in pcosPackage.scripts, false)
  assert.equal('db:check-sync' in pcosPackage.scripts, false)
  assert.equal(fs.existsSync(path.join(repositoryRoot, 'apps/pcos-explorer/scripts/sync-schema.mjs')), false)

  const rootBlueprint = fs.readFileSync(path.join(repositoryRoot, 'render.yaml'), 'utf8')
  const pmosService = rootBlueprint.slice(rootBlueprint.indexOf('name: pmos-spendguru2-development'))
  assert.match(pmosService, /buildFilter:/)
  assert.match(pmosService, /apps\/pmos\/\*\*/)
  assert.doesNotMatch(pmosService, /apps\/pcos-explorer/)
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
