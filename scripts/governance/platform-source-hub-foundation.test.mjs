import assert from 'node:assert/strict'
import {SOURCE_HUB_CONTRACT_VERSION} from '../../packages/platform-source-hub-contracts/index.mjs'
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
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
function scheduleSourceAcceptance(readCurrent=read){
 if(JSON.parse(readCurrent('packages/platform-source-hub-contracts/package.json')).version!=='1.5.0')return null
 const file='apps/platform-source-hub/operations/publication-schedule-source-acceptance.json',bytes=readCurrent(file)
 assert.equal(sha256(bytes),'3f9a3de218368152b86cd4c4efebb831f2033256465248dcf320f362d8c0c422','exact new schedule acceptance')
 const a=JSON.parse(bytes)
 assert.equal(a.sourceCandidateSha,'1ed366d9e1fdac87a549dd891d2b7b53abf13b2c')
 assert.equal(a.predecessorSourceSha,'d943d2ba17eeb6b07ba5a9162a4767e155513a90')
 assert.equal(a.predecessorManifestSha256,'458ddbf661ce1a5666260a072a03f24ac016346bdd9a9efef7f2a1d497eee403')
 assert.equal(sha256(readCurrent(a.predecessorManifestPath)),a.predecessorManifestSha256,'immutable previous acceptance')
 assert.deepEqual(Object.keys(a.sourceFiles),git(['diff','--name-only',a.baseSha,a.sourceCandidateSha]).split('\n').filter(p=>(p.startsWith('apps/platform-source-hub/')||p.startsWith('packages/platform-source-hub-contracts/'))&&p!==file).sort())
 assert.equal(Object.keys(a.sourceFiles).length,26);assert.equal(Object.keys(a.replacements).length,9)
 const old=JSON.parse(readCurrent(a.predecessorManifestPath))
 for(const [p,digest]of Object.entries(a.sourceFiles)){
  assert(p.startsWith('apps/platform-source-hub/')||p.startsWith('packages/platform-source-hub-contracts/'),'closed schedule owner scope')
  assert.equal(sha256(execFileSync('git',['show',a.sourceCandidateSha+':'+p],{cwd:root})),digest,'immutable reviewed schedule source '+p)
  assert.equal(sha256(readCurrent(p)),digest,'current schedule source '+p)
 }
 for(const [p,r]of Object.entries(a.replacements)){
  assert.equal(r.previousSha256,old.integrationFiles[p]);assert.equal(r.sha256,a.sourceFiles[p])
  assert.equal(sha256(execFileSync('git',['show',a.predecessorSourceSha+':'+p],{cwd:root})),r.previousSha256,'immutable predecessor source '+p)
 }
 assert.equal(a.publicationScheduleVersion,'1.2.0');assert.equal(a.legacyCommodityContractVersion,'1.1.0');assert.equal(a.legacyHubContractVersion,'1.0.0')
 assert.equal(a.consumerRuntimeAdoption,false);assert.equal(a.administrativeActivation,'SEPARATE_EXACT_OWNER_GO_REQUIRED')
 return a
}
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
  const { status, approval, authority, stage2aSourceAdoption, ...actualPayload } = families
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

test('Stage2A adopts four separate versioned source families and the real Newsfeed consumer while live admission stays closed',()=>{
 const a=families.stage2aSourceAdoption
 assert.equal(a.taskId,'ARCHITECTURE-SOURCE-HUB-NEWSFEED-STAGE2A-20261103');assert.equal(a.pullRequest,885)
 assert.equal(a.effectiveOn,'CONTROLLED_MAIN_ACCEPTANCE');assert.equal(a.apiVersion,'1.0.0')
 assert.equal(a.package,json('packages/platform-source-hub-contracts/package.json').name)
 assert.equal(a.apiVersion,SOURCE_HUB_CONTRACT_VERSION)
 // Stage2A is historical evidence. Later additive SDK releases must not rewrite
 // its accepted version or be forced to reuse an already published version.
 assert.equal(JSON.parse(git(['show','b837f93b47d15cd812242a2ab0df6e69c35b3656:packages/platform-source-hub-contracts/package.json'])).version,'1.1.0')
 assert.deepEqual(a.implementedFamilies,{'news-discovery':'1.0.0','economic-calendar':'1.0.0','indicators':'1.0.0','external-forecasts':'1.0.0'})
 assert.deepEqual(a.futureFamilies,['market-observations']);assert.equal(a.legacyCompatibility,'NewsDiscovery 0.1.0')
 assert.equal(a.consumer.contractPackage,json('packages/newsfeed-contracts/package.json').name)
 assert.equal(a.consumer.apiVersion,json('packages/newsfeed-contracts/package.json').version)
 assert.equal(a.consumer.adoptedFamily,'news-discovery')
 assert.equal(a.runtimeAdmission,'NOT_ACTIVATED');assert.equal(a.infrastructureActivationAuthorized,false)
 const evidence=json('apps/platform-source-hub/docs/live-evidence.json')
 assert.equal(evidence.liveProviderCalls,0);assert.equal(evidence.providerResults.length,5)
 assert(evidence.providerResults.every(x=>x.status==='IMPLEMENTED_OFFLINE_VERIFIED'))
 assert(fs.existsSync(path.join(root,a.evidenceDocument)));assert(fs.existsSync(path.join(root,a.compatibilityAndRollback)))
})

test('SourceHub optional ECR storage metadata preserves accepted transport and payload compatibility',()=>{
 const accepted='b837f93b47d15cd812242a2ab0df6e69c35b3656'
 const p='packages/platform-source-hub-contracts/package.json'
 const old=JSON.parse(git(['show',accepted+':'+p])),current=json(p)
 assert.equal(old.version,'1.1.0')
 assert.equal(SOURCE_HUB_CONTRACT_VERSION,'1.0.0')
 const sdkVersion=json('packages/platform-contracts/package.json').version
 const schedule=scheduleSourceAcceptance()
 if(sdkVersion==='1.34.0'){
  const adoption=json('apps/architecture-lab/sdk-1.34-compatibility.json')
  assert.equal(adoption.producerCandidateSha,'ebf017cae09bf7bd9139af7917534b47ae0c4d4b')
  assert.equal(Object.keys(adoption.producerFiles).length,27)
  for(const [file,digest]of Object.entries(adoption.producerFiles))assert.equal(createHash('sha256').update(execFileSync('git',['show',adoption.producerCandidateSha+':'+file],{cwd:root})).digest('hex'),digest,'immutable original producer '+file)
  for(const [file,digest]of Object.entries(adoption.integrationFiles)){
   const bytes=schedule?.replacements[file]?execFileSync('git',['show',schedule.predecessorSourceSha+':'+file],{cwd:root}):fs.readFileSync(path.join(root,file))
   assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,'preserved integrated predecessor '+file)
  }
 }else{
  assert.equal(sdkVersion,'1.33.0')
  assert.equal(git(['hash-object','packages/platform-contracts/package.json']),git(['rev-parse',accepted+':packages/platform-contracts/package.json']))
 }
 for(const path of ['packages/platform-source-hub-contracts/client.mjs'])
  assert.equal(git(['hash-object',path]),git(['rev-parse',accepted+':'+path]),path)
 if(current.version==='1.1.0'){
  assert.deepEqual(current,old)
 }else{
  assert.equal(current.version,schedule?'1.5.0':sdkVersion==='1.34.0'?'1.4.0':'1.3.0')
  const {version:oldVersion,peerDependencies:oldPeers,...oldManifest}=old
  const {version,peerDependencies,...currentManifest}=current
  if(current.version==='1.2.0'){
   assert.deepEqual(currentManifest,oldManifest)
   const path='packages/platform-source-hub-contracts/client.d.mts'
   assert.equal(git(['hash-object',path]),git(['rev-parse',accepted+':'+path]))
  }else{
   const {exports:oldExports,scripts:oldScripts,...oldRest}=oldManifest
   const {exports:currentExports,scripts:currentScripts,...currentRest}=currentManifest
   assert.deepEqual(currentRest,oldRest)
   assert.deepEqual(currentExports,{...oldExports,'./commodities':{types:'./commodities-v1.d.mts',import:'./commodities-v1.mjs'}})
   assert.deepEqual(currentScripts,{...oldScripts,build:'node --check index.mjs && node --check commodities-v1.mjs && node --check client.mjs'})
   const oldTypes=git(['show',accepted+':packages/platform-source-hub-contracts/index.d.ts'])
   const legacyTypes=read('packages/platform-source-hub-contracts/index.d.ts')
   const marketBranch="\n |Base<'market-observations','trading-economics','search',MarketObservationCriteria>"
   assert(legacyTypes.match(/export type LegacyHubRequest=([\s\S]*?);/)[1].endsWith(marketBranch))
   assert.equal(legacyTypes.match(/export type LegacyHubRequest=([\s\S]*?);/)[1].replace(marketBranch,''),oldTypes.match(/export type HubRequest=([\s\S]*?);/)[1])
   const oldClient=git(['show',accepted+':packages/platform-source-hub-contracts/client.d.mts'])
   assert(read('packages/platform-source-hub-contracts/client.d.mts').replaceAll('LegacyHubRequest','HubRequest').includes(oldClient.match(/acquire\(input:[\s\S]*?\):Promise<HubResponse>/)[0]))
   assert.match(read('packages/platform-source-hub-contracts/client.d.mts'),/command:CommodityRequest[\s\S]*Promise<CommodityResponse>/)
   const proposal=json('Canon/proposals/sourcehub-commodity-contracts-v1.json')
   assert.equal(proposal.sdkVersion,'1.3.0');assert.equal(proposal.protocolVersion,'1.1.0');assert.equal(proposal.legacyProtocolUnchanged,'1.0.0')
   assert.deepEqual(proposal.families,['data-catalog','series-observations','positioning-observations','publication-calendar'])
  }
  assert.deepEqual(oldPeers,{'@profitia/platform-current-e1-authority':'1.1.0'})
  assert.deepEqual(peerDependencies,{'@profitia/platform-current-e1-authority':sdkVersion==='1.34.0'?'1.1.0 || 1.2.0 || 1.2.1':'1.1.0 || 1.2.0'})
 }
})

test('opt-in schedule producer pins its complete new closure while preserving every previous acceptance byte',()=>{
 const a=scheduleSourceAcceptance();assert(a)
 assert.equal(a.taskId,'ARCHITECTURE-ECR-STAGE01-SCHEDULE-SOURCES-20261109')
 assert.equal(a.scope,'SOURCEHUB_PRODUCER_ONLY_OPT_IN_SCHEDULE_CONTRACT')
})
test('schedule acceptance rejects altered new source, new metadata and historical receipt without changing fixtures on disk',()=>{
 for(const target of ['apps/platform-source-hub/src/providers/eia-schedules.mjs','apps/platform-source-hub/operations/publication-schedule-source-acceptance.json','apps/architecture-lab/sdk-1.34-compatibility.json']){
  assert.throws(()=>scheduleSourceAcceptance(p=>read(p)+(p===target?'\nUNACCEPTED_CHANGE':'')),target)
 }
})
