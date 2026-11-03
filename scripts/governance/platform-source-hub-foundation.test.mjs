import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const prefix = 'Canon/proposals/'
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const json = p => JSON.parse(read(prefix + p))
const g1 = json('platform-source-hub-g1-onboarding-v1.json')
const env = json('platform-source-hub-environment-plan-v1.json')
const families = json('platform-source-hub-contract-families-v1.json')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const registryPath = 'Canon/registries/current-architecture-baseline-v1.json'
const manifestPath = 'Canon/registries/governance-manifest-v2.json'
const targets = ['apps/platform-source-hub/src/server.ts', 'packages/platform-source-hub-contracts/index.mjs', '.github/workflows/platform-source-hub-ci.yml']
const resolve = (project, paths, repositoryRoot = root) => resolveProjectRouting({ profile: resolveProjectProfile(project, root), targets: paths, repositoryRoot })

// These assertions protect the Stage 1B proposal boundary. An authorized later
// activation must deliberately replace them with tests of actual G1 provenance.
test('Source Hub Stage 1B cannot activate routing or supersede accepted canons', () => {
  assert.equal(g1.status, 'PROPOSED_NOT_ACTIVE')
  assert.equal(g1.directionApproval, 'OWNER_APPROVED_2026-11-03')
  assert.equal(g1.exactG1Approval, 'PENDING')
  assert.equal(g1.documentAcceptance, 'PENDING')
  for (const key of ['activeRegistryChanged', 'implementationAuthorized', 'resourceCreationByAgentAuthorized', 'deploymentAuthorized']) assert.equal(g1[key], false)
  for (const p of [registryPath, manifestPath, 'Canon/registries/architecture-onboarding-v1.json', 'Canon/v1.0-newsfeed-business-and-architecture-canon.md', 'Canon/v1.1-repository-routing-and-module-ownership-canon.md']) {
    assert.equal(git(['hash-object', p]), git(['rev-parse', g1.referenceMain + ':' + p]), p)
  }
  for (const project of ['ARCHITECTURE', 'SG2', 'SRM']) assert.equal(resolve(project, targets).ok, false)
  for (const p of ['apps/platform-source-hub', 'packages/platform-source-hub-contracts', '.github/workflows/platform-source-hub-ci.yml']) assert.equal(fs.existsSync(path.join(root, p)), false)
})

test('proposed Source Hub routes simulate one owner and reject conflicts, siblings and consumer writes', t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'source-hub-proposal-fixture-'))
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }))
  const registry = JSON.parse(read(registryPath))
  const existing = structuredClone(registry.surfaces)
  const rows = g1.proposedSurfaces.map(s => ({ ...s, classificationReferenceSha: g1.referenceMain, onboardingAuthorization: 'TEST FIXTURE ONLY - no actual G1 authority' }))
  assert.deepEqual(rows.map(s => s.pathPatterns), [['apps/platform-source-hub/**'], ['packages/platform-source-hub-contracts/**'], ['.github/workflows/platform-source-hub-ci.yml']])
  for (const row of rows) {
    assert.equal(row.currentOwner, 'Architecture Platform')
    assert.deepEqual(row.allowedProjectKeys, ['ARCHITECTURE'])
  }
  registry.surfaces.push(...rows)
  const destination = path.join(scratch, registryPath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const save = () => fs.writeFileSync(destination, JSON.stringify(registry))
  save()
  assert.deepEqual(registry.surfaces.slice(0, existing.length), existing)
  const admitted = resolve('ARCHITECTURE', targets, scratch)
  assert.equal(admitted.ok, true, admitted.error)
  assert.deepEqual(admitted.results.map(s => s.matchedSurfaceId), rows.map(s => s.id))
  assert.ok(admitted.results.every(s => s.highestSpecificityMatchCount === 1))
  for (const project of ['SG2', 'SRM']) {
    const denied = resolve(project, targets, scratch)
    assert.equal(denied.ok, false)
    assert.ok(denied.results.every(s => s.projectBoundaryStatus === 'DENIED'))
  }
  for (const target of ['apps/platform-source-hub-copy/x.mjs', 'packages/platform-source-hub-ui/x.mjs', '.github/workflows/platform-source-hub-deploy.yml', 'apps/platform-source-hub/../../srm/x.mjs']) assert.equal(resolve('ARCHITECTURE', [target], scratch).ok, false, target)
  registry.surfaces.push({ ...rows[0], id: 'CONFLICT_FIXTURE', currentOwner: 'Other fixture owner' })
  save()
  const conflict = resolve('ARCHITECTURE', [targets[0]], scratch)
  assert.equal(conflict.ok, false)
  assert.equal(conflict.results[0].resolutionStatus, 'CONFLICT')
})

test('accepted NewsAPI candidate and all 23 exact file blobs remain unchanged', () => {
  const accepted = '1a87951fbe5a513f15adce02fb169adf3bf70050'
  const scope = ['apps/newsfeed-runtime', 'packages/newsfeed-contracts', '.github/workflows/newsfeed-ci.yml']
  const before = git(['ls-tree', '-r', accepted, '--', ...scope]).split('\n')
  assert.equal(before.length, 23)
  assert.equal(git(['ls-tree', '-r', 'HEAD', '--', ...scope]), before.join('\n'))
  for (const row of before) {
    const [metadata, p] = row.split('\t')
    assert.equal(git(['hash-object', p]), metadata.split(' ')[2], p)
  }
})

test('Source Hub contract families preserve vendor semantics instead of a universal payload', () => {
  assert.equal(families.commonEnvelopeOnly, true)
  assert.equal(families.universalPayload, false)
  assert.deepEqual(families.families.map(f => f.id), ['news-discovery', 'economic-calendar', 'market-observations', 'indicators', 'external-forecasts'])
  const byId = Object.fromEntries(families.families.map(f => [f.id, f]))
  for (const [id, required] of Object.entries({
    'news-discovery': ['publisherCountryOrUnknown', 'eventGeographyOrUnknown'],
    'economic-calendar': ['actual', 'previous', 'revised', 'consensusForecast', 'vendorForecast', 'revisionRef'],
    'market-observations': ['instrumentType', 'underlyingMappingRef', 'quoteBasis', 'contractExpiry', 'rolloverRef'],
    indicators: ['frequency', 'vintage', 'revisionRef'],
    'external-forecasts': ['vendorModel', 'origin', 'targetDate', 'horizon', 'vendorIntervalOrUnknown'],
  })) for (const field of required) assert.ok(byId[id].payloadFields.includes(field), id + '/' + field)
  assert.equal(new Set(families.families.map(f => JSON.stringify(f.payloadFields))).size, 5)
  for (const key of ['requestSupport', 'resultMetadataSupport', 'evidenceKind', 'limitations', 'entitlementRefOrUnknown']) assert.ok(families.capabilityDescriptor.required.includes(key))
  assert.ok(families.capabilityDescriptor.evidenceKinds.includes('ENRICHMENT_REQUIRED'))
  assert.equal(families.providerState.NewsAPI, 'EXISTING_NEWSFEED_CONNECTOR_NO_MIGRATION')
  for (const provider of ['GDELT', 'TradingEconomics', 'Brave']) assert.equal(families.providerState[provider], 'FUTURE_NOT_IMPLEMENTED')
})

test('environment plan reuses owner Newsfeed and separates Production and continuity authority', () => {
  assert.equal(env.resourceCreationActor, 'HUMAN_OWNER_ONLY')
  assert.equal(env.agentResourceMutationsAllowed, false)
  for (const key of ['resourcesCreatedByThisTask', 'schemasAppliedByThisTask', 'providerCallsByThisTask']) assert.equal(env[key], 0)
  assert.equal(env.deploymentByThisTask, false)
  assert.equal(env.observedNewsfeed.projectId, 'shiny-bonus-85532609')
  assert.equal(env.observedNewsfeed.sqlOrRolesInspected, false)
  const dev = env.observedNewsfeed.branches.find(b => b.environmentLabel === 'development')
  assert.equal(dev.branchId, 'br-solitary-star-b9i144lk')
  assert.equal(dev.pooledHost, 'ep-restless-sea-b9ducsrh-pooler.c-7.eu-central-1.aws.neon.tech')
  assert.equal(env.observedNewsfeed.branches.find(b => b.environmentLabel === 'production').runtimeProductionAccepted, false)
  assert.equal(env.observedNewsfeed.allEndpoints.suspendMeaning, 'GLOBAL_DEFAULT_300_SECONDS')
  const nonprod = env.targetNeonProjects.find(p => p.purpose === 'NEWSFEED_NONPRODUCTION')
  assert.equal(nonprod.existingProjectId, env.observedNewsfeed.projectId)
  assert.equal(nonprod.action, 'REUSE_EXISTING_DEVELOPMENT_AND_STAGING_NO_DUPLICATE')
  assert.equal(new Set(env.targetNeonProjects.map(p => p.name)).size, 4)
  const production = env.targetNeonProjects.filter(p => p.purpose.endsWith('_PRODUCTION'))
  assert.equal(production.length, 2)
  assert.ok(production.every(p => !p.existingProjectId && p.branches.length === 1 && p.branches[0] === 'production'))
  assert.notEqual(env.architecturePmos.projectId, env.observedNewsfeed.projectId)
  assert.equal(env.architecturePmos.productDatabaseAllowed, false)
  assert.equal(env.runtimeReadiness, 'NOT_VERIFIED')
  const names = []
  assert.deepEqual(env.environments.map(e => e.name), ['development', 'staging', 'production'])
  for (const e of env.environments) {
    assert.equal(e.autoDeploy, false)
    assert.equal(e.previews, false)
    assert.equal(e.blockCrossEnvironmentPrivateTraffic, true)
    assert.equal(e.servicesCreateWhen, 'BACKEND_ACCEPTED_AND_SEPARATE_TASK_AUTHORIZED')
    assert.deepEqual(e.services.map(s => s.type), ['web', 'web', 'cron'])
    names.push(...e.services.map(s => s.name), ...e.rolesLater)
  }
  assert.equal(new Set(names).size, names.length)
  assert.equal(env.secretHandling.ownerDatabaseUrlAllowedInRuntime, false)
  assert.equal(env.secretHandling.sharedProductionCredentialsAllowed, false)
})

test('proposal and provisioning links resolve and guide agrees with exact resource plan', () => {
  const docs = [
    prefix + 'v1.0-platform-source-hub-business-and-architecture-canon.md',
    prefix + 'v1.1-newsfeed-source-hub-responsibility-amendment.md',
    'Canon/runbooks/newsfeed-source-hub-infrastructure-provisioning-v1.md',
    'Canon/evidence/2026-11-03-platform-source-hub-stage1b-foundation.md',
  ]
  for (const p of docs) {
    const text = read(p)
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      if (/^https:\/\//.test(match[1])) continue
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(p), match[1].split('#')[0])), p + ': ' + match[1])
    }
    assert.doesNotMatch(text, /postgres(?:ql)?:\/\/[^\s]*@|Bearer\s+[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]+/)
  }
  const guide = read(docs[2])
  for (const p of env.targetNeonProjects) assert.ok(guide.includes(p.name))
  for (const e of env.environments) {
    for (const s of e.services) assert.ok(guide.includes(s.name))
    for (const role of e.rolesLater) assert.ok(guide.includes(role))
  }
  for (const phrase of ['0.5c-512mb', '04:15 UTC', 'SOURCE_HUB_BASE_URL', 'TRADING_ECONOMICS_API_KEY', 'Auto-Deploy Off', '7.36', '84.53', 'DO POTWIERDZENIA']) assert.ok(guide.includes(phrase), phrase)
})

test('existing SG2 and SRM owner boundaries cannot be claimed by Source Hub profile', () => {
  for (const [project, owner, p] of [
    ['SG2', 'SG Runtime', 'apps/sg-runtime/app/page.tsx'],
    ['SRM', 'SRM Runtime', 'apps/srm/src/modules/intelligence/x.ts'],
    ['SRM', 'SRM Runtime', 'packages/srm-adp-ui/src/index.ts'],
  ]) {
    const actual = resolve(project, [p])
    assert.equal(actual.ok, true, actual.error)
    assert.equal(actual.results[0].currentOwner, owner)
    assert.equal(resolve('ARCHITECTURE', [p]).ok, false)
  }
})
