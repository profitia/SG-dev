import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'
import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { resolveEnvironmentProfile } from './environment-profile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const approved = 'b40564130fe7b6ced4d7df233dd6749653846114'
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const json = p => JSON.parse(read(p))
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const priorText = p => execFileSync('git', ['show', approved + ':' + p], { cwd: root, encoding: 'utf8' })
const prior = p => JSON.parse(priorText(p))
const registryPath = 'Canon/registries/current-architecture-baseline-v1.json'
const manifestPath = 'Canon/registries/governance-manifest-v2.json'
const g1 = prior('Canon/proposals/platform-source-hub-g1-onboarding-v1.json')
const env = json('Canon/registries/newsfeed-source-hub-environment-baseline-v1.json')
const families = json('Canon/registries/platform-source-hub-contract-families-v1.json')
const targets = ['apps/platform-source-hub/src/server.ts', 'packages/platform-source-hub-contracts/index.mjs', '.github/workflows/platform-source-hub-ci.yml']
const resolve = (project, paths, repositoryRoot = root) => resolveProjectRouting({ profile: resolveProjectProfile(project, root), targets: paths, repositoryRoot })
const decision = 'ARCH-SOURCE-HUB-G1-FINAL-ACTIVATION-20261103'
const stage1b = '9bce78138e1396765ce67b9b1b29841efdb017f2'

// Source assertions do not replace actual-main acceptance and readback.
test('Source Hub exact G1 appends approved rows and preserves all prior governance authority', () => {
  const before = prior(registryPath), current = json(registryPath)
  for (const row of before.surfaces) assert.deepEqual(current.surfaces.find(s => s.id === row.id), row)
  const { surfaces: oldRows, ...oldMeta } = before
  const { surfaces: newRows, ...newMeta } = current
  assert.deepEqual(newMeta, oldMeta)
  const rows = current.surfaces.filter(s => s.id.startsWith('SOURCE-HUB-BASE-'))
  assert.equal(rows.length, 3)
  for (let i = 0; i < rows.length; i++) {
    const { classificationReferenceSha, onboardingAuthorization, ...actual } = rows[i]
    assert.deepEqual(actual, g1.proposedSurfaces[i])
    assert.equal(classificationReferenceSha, '785c9b5175e65840b4c5a9efb983e0db0972d3e1')
    assert.match(onboardingAuthorization, /G1 GRANTED: explicit owner/)
    assert.ok(onboardingAuthorization.includes(decision))
  }
  const onboarding = json('Canon/registries/architecture-onboarding-v1.json')
  for (const row of prior('Canon/registries/architecture-onboarding-v1.json').plannedModules) assert.deepEqual(onboarding.plannedModules.find(s => s.capability === row.capability), row)
  const admitted = onboarding.plannedModules.find(s => s.capability === 'Platform Source Hub')
  assert.equal(admitted.approval.decision, 'G1 GRANTED')
  assert.equal(admitted.approval.decisionId, decision)
  assert.equal(admitted.approval.approvedCandidate, approved)
  assert.equal(admitted.approval.sourceSha256, '376a283842d9935b3565c9211d1eaab0876b0662a42e7d6b3ef21d202f6fa9d2')
  for (const key of ['implementationAuthorized', 'resourceCreationAuthorized', 'deploymentAuthorized']) assert.equal(admitted.approval[key], false)
  const manifest = validateGovernanceManifest(root)
  assert.equal(manifest.valid, true, manifest.errors.join('\n'))
  for (const row of prior(manifestPath).documents) assert.deepEqual(json(manifestPath).documents.find(s => s.id === row.id), row)
  for (const id of ['platform-source-hub-contract-families', 'newsfeed-source-hub-environment-baseline', 'platform-source-hub-business-and-architecture-canon', 'newsfeed-source-hub-responsibility-amendment']) {
    const doc = manifest.activeDocuments.find(s => s.id === id)
    assert.ok(doc)
    for (const dependency of doc.dependsOn) assert.ok(manifest.activeDocuments.find(s => s.id === dependency).loadOrder < doc.loadOrder)
  }
  const p = 'Canon/v1.0-newsfeed-business-and-architecture-canon.md'
  assert.equal(git(['hash-object', p]), git(['rev-parse', approved + ':' + p]))
})

test('actual Hub routing uniquely permits Architecture and denies consumers, siblings, traversal and conflicts', t => {
  const actual = resolve('ARCHITECTURE', targets)
  assert.equal(actual.ok, true, actual.error)
  assert.deepEqual(actual.results.map(s => s.matchedSurfaceId), g1.proposedSurfaces.map(s => s.id))
  assert.ok(actual.results.every(s => s.currentOwner === 'Architecture Platform' && s.highestSpecificityMatchCount === 1))
  for (const project of ['SG2', 'SRM']) {
    const denied = resolve(project, targets)
    assert.equal(denied.ok, false)
    assert.ok(denied.results.every(s => s.projectBoundaryStatus === 'DENIED'))
  }
  for (const target of ['apps/platform-source-hub-copy/x.mjs', 'packages/platform-source-hub-ui/x.mjs', '.github/workflows/platform-source-hub-deploy.yml', 'apps/platform-source-hub/../../srm/x.mjs']) assert.equal(resolve('ARCHITECTURE', [target]).ok, false, target)
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'source-hub-g1-conflict-'))
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }))
  const registry = json(registryPath)
  registry.surfaces.push({ ...registry.surfaces.find(s => s.id === 'SOURCE-HUB-BASE-001'), id: 'CONFLICT_FIXTURE', currentOwner: 'Other fixture owner' })
  fs.mkdirSync(path.dirname(path.join(scratch, registryPath)), { recursive: true })
  fs.writeFileSync(path.join(scratch, registryPath), JSON.stringify(registry))
  const conflict = resolve('ARCHITECTURE', [targets[0]], scratch)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.results[0].resolutionStatus, 'CONFLICT')
  // Stage1B admitted empty producer surfaces. Stage2A is the separately
  // authorised implementation; preserve the historical absence at its SHA.
  for (const p of ['apps/platform-source-hub', 'packages/platform-source-hub-contracts', '.github/workflows/platform-source-hub-ci.yml']) assert.equal(git(['ls-tree','-r',stage1b,'--',p]), '')
})

test('accepted Stage1B business sections, family payloads and historical23 NewsAPI blobs remain unchanged', () => {
  const segment = (s, start, end) => s.slice(s.indexOf(start), s.indexOf(end))
  const normalizeLinks = s => s.replace(/\]\(([^)]+)\)/g, (whole, dest) => /^https:\/\//.test(dest) ? whole : '](' + path.posix.basename(dest) + ')')
  assert.equal(normalizeLinks(segment(read('Canon/v1.0-platform-source-hub-business-and-architecture-canon.md'), '## 1.', '## 7.')), normalizeLinks(segment(priorText('Canon/proposals/v1.0-platform-source-hub-business-and-architecture-canon.md'), '## 1.', '## 7.')))
  const normalizeAmendment = s => normalizeLinks(segment(s, '## Minimal clarification', '## Activation')).replace('The proposed [Platform Source Hub', 'The [Platform Source Hub')
  assert.equal(normalizeAmendment(read('Canon/v1.1-newsfeed-source-hub-responsibility-amendment.md')), normalizeAmendment(priorText('Canon/proposals/v1.1-newsfeed-source-hub-responsibility-amendment.md')))
  const { status, approval, authority, ...actualPayload } = families
  const { status: oldStatus, ...approvedPayload } = prior('Canon/proposals/platform-source-hub-contract-families-v1.json')
  assert.equal(status, 'ACTIVE')
  assert.deepEqual(actualPayload, approvedPayload)
  assert.equal(approval.sourceSha256, createHash('sha256').update(priorText('Canon/proposals/platform-source-hub-contract-families-v1.json')).digest('hex'))
  const accepted = '1a87951fbe5a513f15adce02fb169adf3bf70050'
  const scope = ['apps/newsfeed-runtime', 'packages/newsfeed-contracts', '.github/workflows/newsfeed-ci.yml']
  const before = git(['ls-tree', '-r', accepted, '--', ...scope]).split('\n')
  assert.equal(before.length, 23)
  assert.equal(git(['ls-tree', '-r', stage1b, '--', ...scope]), before.join('\n'))
  const extracted = new Set(['apps/newsfeed-runtime/package.json','apps/newsfeed-runtime/package-lock.json','apps/newsfeed-runtime/tsconfig.json','apps/newsfeed-runtime/README.md','apps/newsfeed-runtime/src/newsapi.mjs','apps/newsfeed-runtime/src/query.mjs','apps/newsfeed-runtime/src/capabilities.mjs','packages/newsfeed-contracts/package.json','packages/newsfeed-contracts/index.mjs','packages/newsfeed-contracts/index.d.ts','packages/newsfeed-contracts/README.md','.github/workflows/newsfeed-ci.yml'])
  for (const row of before) {
    const [metadata, p] = row.split('\t')
    if(!extracted.has(p))assert.equal(git(['hash-object', p]), metadata.split(' ')[2], p)
  }
  for(const [legacy,producer]of [['newsapi','newsapi'],['query','newsapi-query'],['capabilities','newsapi-capabilities']]){
    const oldPath='apps/newsfeed-runtime/src/'+legacy+'.mjs',newPath='apps/platform-source-hub/src/providers/'+producer+'.mjs'
    assert.match(read(oldPath),new RegExp('^export \\* from .*'+producer+'\\.mjs','m'))
    const original=execFileSync('git',['show',stage1b+':'+oldPath],{cwd:root,encoding:'utf8'})
    const normalize=s=>s.replaceAll('../../../packages/newsfeed-contracts/','../../../../packages/platform-source-hub-contracts/').replaceAll('./capabilities.mjs','./newsapi-capabilities.mjs').replaceAll('./query.mjs','./newsapi-query.mjs')
    assert.equal(read(newPath),normalize(original),newPath+' is the single preserved implementation')
  }
})

test('active design catalogue keeps separate future contracts and existing NewsDiscovery0.1.0', () => {
  assert.equal(families.commonEnvelopeOnly, true)
  assert.equal(families.universalPayload, false)
  assert.deepEqual(families.families.map(f => f.id), ['news-discovery', 'economic-calendar', 'market-observations', 'indicators', 'external-forecasts'])
  assert.equal(new Set(families.families.map(f => JSON.stringify(f.payloadFields))).size, 5)
  assert.ok(families.families.every(f => f.version === 'PROPOSED_1.0'))
  assert.equal(families.providerState.NewsAPI, 'EXISTING_NEWSFEED_CONNECTOR_NO_MIGRATION')
  for (const p of ['GDELT', 'TradingEconomics', 'Brave']) assert.equal(families.providerState[p], 'FUTURE_NOT_IMPLEMENTED')
  for (const f of ['requestSupport', 'resultMetadataSupport', 'evidenceKind', 'limitations', 'entitlementRefOrUnknown']) assert.ok(families.capabilityDescriptor.required.includes(f))
})

test('real four-project six-branch baseline cannot grant runtime or substitute old Development and PMOS', () => {
  assert.equal(env.status, 'OBSERVED_INFRASTRUCTURE_ONLY')
  assert.equal(env.resourceCreationActor, 'HUMAN_OWNER_ONLY')
  assert.equal(env.agentResourceMutationsAllowed, false)
  assert.equal(env.deploymentByThisTask, false)
  assert.equal(env.runtimeReadiness, 'NOT_VERIFIED')
  const expected = {
    'shiny-bonus-85532609': { development: ['br-wispy-bonus-b9ohunab', 'ep-mute-night-b9o332my'], staging: ['br-frosty-cell-b9hzdh6e', 'ep-wandering-term-b9v57pi9'] },
    'twilight-wind-91374750': { production: ['br-noisy-pine-b9i0865t', 'ep-aged-sun-b9ooczkd'] },
    'delicate-queen-44677134': { development: ['br-orange-salad-ba2llks7', 'ep-noisy-darkness-barhqoqw'], staging: ['br-snowy-breeze-bahrkgrr', 'ep-noisy-grass-baszxszx'] },
    'crimson-band-46697896': { production: ['br-flat-resonance-b9dh28bf', 'ep-empty-water-b9yjwui8'] },
  }
  assert.deepEqual(env.neon.map(p => p.projectId).sort(), Object.keys(expected).sort())
  for (const p of env.neon) {
    assert.equal(p.region, 'aws-eu-central-1')
    assert.equal(p.postgresVersion, 18)
    assert.equal(p.historyRetentionSeconds, 86400)
    assert.notEqual(p.projectId, env.architecturePmos.projectId)
    assert.equal(p.branches.length, Object.keys(expected[p.projectId]).length)
    for (const b of p.branches) {
      const pair = expected[p.projectId][b.name]
      assert.equal(b.id, pair[0])
      assert.equal(b.protected, false)
      assert.ok(b.databases.some(d => d.name === 'neondb'))
      const endpoint = p.endpoints.find(e => e.branchId === b.id)
      assert.equal(endpoint.id, pair[1])
      assert.equal(endpoint.minCu, 0.25)
      assert.equal(endpoint.maxCu, 8)
      assert.equal(endpoint.suspendTimeoutSeconds, 0)
    }
  }
  assert.doesNotMatch(JSON.stringify(env.neon), /ep-restless-sea-b9ducsrh|br-solitary-star-b9i144lk/)
  assert.equal(env.architecturePmos.database, 'architecture_pmos')
  assert.equal(env.architecturePmos.productDatabaseAllowed, false)
  assert.equal(env.render.projectId, 'prj-dbl079ou01pc73eg0ffg')
  assert.equal(env.render.connectorProjectEnvironmentMetadata, 'OWNER_CONFIRMATION_REQUIRED')
  assert.equal(env.render.uiReadback, 'VERIFIED_READ_ONLY')
  assert.equal(new Set(env.render.environments.map(e => e.id)).size, 3)
  for (const e of env.render.environments) {
    assert.equal(e.serviceCount, 0)
    assert.equal(e.environmentGroupCount, 0)
    assert.equal(e.blockCrossEnvironmentPrivateTraffic, false)
    assert.equal(e.protected, false)
  }
  for (const e of env.environments) {
    assert.equal(e.autoDeploy, false)
    assert.equal(e.previews, false)
    assert.equal(e.plannedSettingsOnly, true)
    assert.equal(e.servicesStatus, 'NOT_CREATED')
  }
})

test('canonical guide resolves links and names every actual binding without credentials', () => {
  const docs = ['Canon/v1.0-platform-source-hub-business-and-architecture-canon.md', 'Canon/v1.1-newsfeed-source-hub-responsibility-amendment.md', 'Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md', 'Canon/evidence/2026-11-03-platform-source-hub-final-activation.md', 'Canon/evidence/2026-11-03-platform-source-hub-stage1b-foundation.md']
  for (const p of docs) {
    for (const match of read(p).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^https:\/\//.test(match[1])) continue
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(p), match[1].split('#')[0])), p + ': ' + match[1])
    }
    assert.doesNotMatch(read(p), /postgres(?:ql)?:\/\/[^\s]*@|Bearer\s+[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]+/)
  }
  const guide = read(docs[2])
  for (const p of env.neon) {
    assert.ok(guide.includes(p.projectId))
    for (const b of p.branches) assert.ok(guide.includes(b.id))
    for (const e of p.endpoints) assert.ok(guide.includes(e.id) && guide.includes(e.pooledHost))
  }
  for (const e of env.render.environments) assert.ok(guide.includes(e.id))
  for (const e of env.environments) {
    for (const s of e.services) assert.ok(guide.includes(s.name))
    for (const role of e.rolesLater) assert.ok(guide.includes(role))
  }
  for (const phrase of ['OWNER_CONFIRMATION_REQUIRED', 'Protected wyłączone', '0.5c-512mb', '04:15 UTC', '7.36', '84.53']) assert.ok(guide.includes(phrase), phrase)
})

test('new producer admission retains SG2 and SRM owners and reserved execution environments', () => {
  for (const [project, owner, p] of [['SG2', 'SG Runtime', 'apps/sg-runtime/app/page.tsx'], ['SRM', 'SRM Runtime', 'apps/srm/src/modules/intelligence/x.ts'], ['SRM', 'SRM Runtime', 'packages/srm-adp-ui/src/index.ts']]) {
    const actual = resolve(project, [p])
    assert.equal(actual.ok, true, actual.error)
    assert.equal(actual.results[0].currentOwner, owner)
    assert.equal(resolve('ARCHITECTURE', [p]).ok, false)
  }
  for (const targetEnvironment of ['staging', 'production']) assert.throws(() => resolveEnvironmentProfile({ profile: resolveProjectProfile('ARCHITECTURE', root), targetEnvironment, governanceRoot: root }), /not ACTIVE/)
})
