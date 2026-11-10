import {ECR_STAGE03_REVIEW,assertEcrStage03ReviewEntry} from './controlled-package-ci.mjs'
import {SOURCE_HUB_MARKET_SYMBOL_REVIEW,assertMarketSymbolReviewEntry} from './controlled-package-ci.mjs'
import {ACG_G1_REVIEW,assertAcgG1ReviewEntry} from './controlled-package-ci.mjs'
import {ACG_M1_EXECUTION_REVIEW,assertAcgM1ReviewEntry,adoptedOperationContract,CIC_ANALYTICAL_PIN} from './controlled-package-ci.mjs'
import {OIL_REPORT_E1_REVIEW,assertOilReportReviewEntry} from './controlled-package-ci.mjs'
import {ECR_BACKEND_REVIEW,assertEcrBackendReviewEntry} from './controlled-package-ci.mjs'
import {createHash} from 'node:crypto'
import {ECR_G1_GOVERNANCE_REVIEW,assertEcrG1ReviewEntry} from './controlled-package-ci.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync, execFileSync} from 'node:child_process'
import {SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW,assertUniversalFirstPartyReviewEntry,SOURCE_HUB_CURRENT_E1_REVIEW,assertCurrentE1ReviewEntry,SOURCE_HUB_STAGE2A_REVIEW, assertTrustedContext, assertEnvironment, selectCandidate, assertArchitectureFiles, resolveCandidateAdmission, assertArchitectureCheckout, CONTROL_POLICY_FILES, assertCredentialMetadata, assertReceipt, assertPackagePolicy, assertManifestPolicy, assertLocalPackageSources, assertProof, controlPolicyDigest, operationContractProvenanceDigest, REPOSITORY, WORKFLOW, PRIVATE_PACKAGES, LOCAL_PACKAGES, CONTROLLED_CANDIDATE_PREFIXES, KRS_GOVERNANCE_REVIEW_FILES, ADP_GOVERNANCE_REVIEW, LIMITS_G1_GOVERNANCE_REVIEW, FRESH_REPORT_PRODUCER_REVIEW, PAYLOAD_CAPTURE_PRODUCER_REVIEW, READONLY_MISS_REPORT_PRODUCER_REVIEW, FRESH_FIXTURE_TEARDOWN_REVIEW, ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW} from './controlled-package-ci.mjs'

const sha = 'a'.repeat(40), other = 'b'.repeat(40)
const context = () => ({repository: REPOSITORY, ref: 'refs/heads/main', workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/main`, event: 'workflow_dispatch', actor: 'profitia', triggeringActor: 'profitia', controlSha: sha})
const pr = () => ({state: 'open', user: {login: 'profitia'}, base: {ref: 'main', repo: {full_name: REPOSITORY}}, head: {sha: other, ref: 'sg2/integration', repo: {full_name: REPOSITORY}}})
const configuration = '@profitia:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n'
const lock = () => ({lockfileVersion: 3, packages: Object.fromEntries(PRIVATE_PACKAGES.map(name => [`node_modules/${name}`, {version: '1.0.0', integrity: 'sha512-approved'}]))})
const rejection = fn => assert.throws(fn)

test('only trusted main workflow accepts owner execution, including push', () => {
  assertTrustedContext(context())
  assertTrustedContext({...context(), event: 'push'})
  for (const delta of [{repository: 'attacker/SG-dev'}, {ref: 'refs/pull/384/merge'}, {ref: 'refs/tags/main'}, {ref: 'refs/heads/architecture/test'}, {event: 'pull_request_target'}, {event: 'pull_request'}, {actor: 'attacker'}, {triggeringActor: 'attacker'}, {controlSha: 'main'}, {workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/untrusted`}]) rejection(() => assertTrustedContext({...context(), ...delta}))
})
test('provider policy must bind exact registered identity and sole main branch, never matching tags or pull refs', () => {
  const expected = {environmentName: 'architecture-development', environmentId: 24168168252, repository: REPOSITORY, protectionStatus: 'MAIN_ONLY'}
  const env = {id: expected.environmentId, name: expected.environmentName, deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}}
  assertEnvironment(env, [{name: 'main', type: 'branch'}], expected)
  for (const branches of [[], [{name: '*', type: 'branch'}], [{name: 'main', type: 'tag'}], [{name: 'main', type: 'branch'}, {name: 'refs/pull/*/merge', type: 'branch'}]]) rejection(() => assertEnvironment(env, branches, expected))
  rejection(() => assertEnvironment({...env, id: 1}, [{name: 'main', type: 'branch'}], expected))
  rejection(() => assertEnvironment({...env, deployment_branch_policy: null}, [{name: 'main', type: 'branch'}], expected))
})
test('internal reviewed PR is pinned; no owner-triggered fork, unapproved branch, stale SHA or arbitrary revision', () => {
  assert.equal(selectCandidate(context(), pr(), other), other)
  assert.equal(selectCandidate(context(), null, sha), sha)
  for (const change of [p => p.head.repo.full_name = 'profitia/fork', p => p.user.login = 'attacker', p => p.head.ref = 'feature/work', p => p.base.ref = 'staging', p => p.state = 'closed']) {
    const p = pr(); change(p); rejection(() => selectCandidate(context(), p, other))
  }
  rejection(() => selectCandidate(context(), pr(), sha))
  rejection(() => selectCandidate(context(), pr(), undefined))
  rejection(() => selectCandidate(context(), null, other))
})
test('explicit internal SRM and ARCHITECTURE candidates retain the same exact-source consumer proof boundary', () => {
  assert.deepEqual(CONTROLLED_CANDIDATE_PREFIXES, ['sg2/', 'srm/', 'architecture/'])
  assert(Object.isFrozen(CONTROLLED_CANDIDATE_PREFIXES))
  for (const ref of ['sg2/current', 'srm/supplier-locations', 'architecture/location-producer']) {
    const p = pr(); p.head.ref = ref
    const options = ref.startsWith('architecture/') ? {files: architectureFiles()} : {}
    if (ref.startsWith('architecture/')) {p.changed_files = 2; p.base.sha = sha}
    assert.equal(selectCandidate(context(), p, other, options), other)
    for (const edit of [p => p.user.login = 'another-owner', p => p.head.repo.full_name = 'profitia/fork', p => p.base.repo.full_name = 'other/SG-dev', p => p.base.ref = 'production', p => p.head.sha = sha]) {
      const altered = structuredClone(p); edit(altered)
      rejection(() => selectCandidate(context(), altered, other, options))
    }
    rejection(() => selectCandidate({...context(), ref:'refs/heads/srm/untrusted-control'}, p, other, options))
  }
  for (const ref of ['srm/', 'architecture/', 'sg2/', 'srm-evil/work', 'architecture-evil/work', 'SRM/work', 'feature/srm/work', 'refs/pull/590/merge', '', null]) {
    const p=pr(); p.head.ref=ref; rejection(() => selectCandidate(context(), p, other))
  }
})
test('credential metadata rejects broader scopes, another issuer account, missing/expired/unbounded lifetime', () => {
  const now = Date.parse('2026-10-17T00:00:00Z')
  const good = {scopes: 'read:packages', login: 'profitia', expiresAt: '2026-11-15T00:00:00Z'}
  assertCredentialMetadata(good, now)
  for (const delta of [{scopes: 'read:packages, repo'}, {scopes: 'write:packages'}, {scopes: ''}, {login: 'attacker'}, {expiresAt: null}, {expiresAt: '2026-10-16'}, {expiresAt: '2027-01-01'}]) rejection(() => assertCredentialMetadata({...good, ...delta}, now))
})
test('receipt is explicitly Development and has only the bounded public contract metadata', () => {
  const receipt = {projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_OPERATION_INTEGRATION_ONLY', liveRouteUsesContract: false, automaticProductDeployment: false, contract: {id: 'profitia.operation-context', version: '1.0.0', implementation: '1.0.0-candidate.3', sourceDigest: 'e'.repeat(64)}}
  assertReceipt(receipt)
  for (const delta of [{targetEnvironment: 'staging'}, {projectKey: 'SRM'}, {liveRouteUsesContract: true}, {contract: {...receipt.contract, arbitraryPayload: 'must not be copied into proof'}}]) rejection(() => assertReceipt({...receipt, ...delta}))
})
test('package names, pins and npm configuration are fixed before any install or token-bearing lifecycle', () => {
  assertPackagePolicy(lock(), lock(), configuration)
  rejection(() => assertPackagePolicy(lock(), lock(), configuration + 'registry=https://attacker.example\n'))
  for (const edit of [l => l.packages['node_modules/@profitia/cic-core'].version = '9.0.0', l => l.packages['node_modules/@profitia/cic-core'].integrity = 'sha512-forged', l => l.packages['node_modules/@profitia/other'] = {version: '1'}, l => delete l.packages['node_modules/@profitia/cic-core'], l => l.packages['node_modules/leftpad'] = {resolved: 'https://attacker.example/p.tgz'}, l => l.packages['node_modules/leftpad'] = {resolved: 'https://secret@registry.npmjs.org/p.tgz'}, l => l.packages['node_modules/local'] = {resolved: '/tmp/escape'}, l => l.packages['../escape'] = {}, l => l.lockfileVersion = 2]) {
    const candidate = lock(); edit(candidate); rejection(() => assertPackagePolicy(candidate, lock(), configuration))
  }
  const c = lock(); c.packages['node_modules/@profitia/platform-contracts'] = {resolved: '../../packages/platform-contracts', version: '1.1.3'}; assertPackagePolicy(c, lock(), configuration)
  c.packages['node_modules/@profitia/platform-contracts'].resolved = 'file:../../packages/platform-contracts'; assertPackagePolicy(c, lock(), configuration)
  c.packages['node_modules/@profitia/platform-contracts'].resolved = 'file:/tmp/escape'; rejection(() => assertPackagePolicy(c, lock(), configuration))
  const alias = lock(); alias.packages['node_modules/innocent-name'] = {name: '@profitia/cic-evals', version: '1.0.0'}; rejection(() => assertPackagePolicy(alias, lock(), configuration))
  const declared = lock(); declared.packages[''] = {dependencies: {alias: 'npm:@profitia/cic-evals@1.0.0'}}; rejection(() => assertPackagePolicy(declared, lock(), configuration))
})
test('manifest changes cannot hide private aliases, new pins or additional workspaces behind an accepted lock', () => {
  const authority = {dependencies: {'@profitia/cic-core': '1.1.1'}}
  assertManifestPolicy(authority, authority)
  assertManifestPolicy({dependencies: {...authority.dependencies, '@profitia/platform-contracts': 'file:../../packages/platform-contracts'}}, authority)
  for (const candidate of [{dependencies: {'@profitia/cic-core': '9.0.0'}}, {dependencies: {alias: 'npm:@profitia/cic-evals@1.0.0'}}, {dependencies: {'@profitia/cic-evals': '1.0.0'}}, {...authority, workspaces: ['../*']}, {...authority, overrides: {'@profitia/cic-core': '9'}}]) rejection(() => assertManifestPolicy(candidate, authority))
})
test('only the ten reviewed local names bind to their own exact paths, never a registry, alias or nested install', () => {
  assert.deepEqual(Object.keys(LOCAL_PACKAGES).sort(), ['@profitia/insights-contracts','@profitia/insights-runtime','@profitia/maps-contracts', '@profitia/maps-embed', '@profitia/platform-contracts','@profitia/platform-current-e1-authority','@profitia/platform-source-hub-contracts', '@profitia/sg2-price-change-index-ui', '@profitia/srm-adp-ui', '@profitia/srm-xray'])
  const authority = {dependencies: {'@profitia/cic-core': '1.1.1'}}
  for (const [name, relative] of Object.entries(LOCAL_PACKAGES)) {
    for (const resolved of [relative, `file:${relative}`]) {
      const candidate = lock()
      candidate.packages[`node_modules/${name}`] = {version: '0.2.0', resolved}
      candidate.packages[''] = {dependencies: {[name]: `file:${relative}`}}
      assertPackagePolicy(candidate, lock(), configuration)
      assertManifestPolicy({dependencies: {[name]: `file:${relative}`}}, authority)
      for (const edit of [
        l => l.packages[`node_modules/${name}`].resolved = '../../packages/other',
        l => l.packages[`node_modules/${name}`].resolved = `${relative}/../srm-xray`,
        l => l.packages[`node_modules/${name}`].resolved = 'https://registry.npmjs.org/other/-/other-1.tgz',
        l => l.packages[`node_modules/${name}`].resolved = 'https://npm.pkg.github.com/other',
        l => l.packages[`node_modules/${name}`].link = true,
        l => l.packages[`node_modules/parent/node_modules/${name}`] = l.packages[`node_modules/${name}`],
        l => l.packages[''].dependencies[name] = '0.2.0',
        l => l.packages['node_modules/unscoped-alias'] = {resolved: `file:${relative}`},
      ]) {
        const changed = structuredClone(candidate); edit(changed)
        rejection(() => assertPackagePolicy(changed, lock(), configuration))
      }
    }
    for (const spec of ['0.2.0', `npm:${name}@0.2.0`, `file:${relative}/../srm-xray`, 'file:/tmp/escape', `link:${relative}`]) {
      rejection(() => assertManifestPolicy({dependencies: {[name]: spec}}, authority))
    }
    rejection(() => assertManifestPolicy({dependencies: {alias: `file:${relative}`}}, authority))
  }
})
function reviewedMapsFixture() {
  const manifest = JSON.parse(fs.readFileSync(path.join(authorityRoot, 'packages/maps-embed/package.json'), 'utf8'))
  const candidate = lock()
  candidate.packages['node_modules/@profitia/maps-embed'] = {
    version: manifest.version, resolved: 'file:../../packages/maps-embed', peerDependencies: structuredClone(manifest.peerDependencies),
  }
  candidate.packages['node_modules/@profitia/maps-contracts'] = {version: '0.1.0', resolved: 'file:../../packages/maps-contracts'}
  candidate.packages[''] = {dependencies: {'@profitia/maps-embed': 'file:../../packages/maps-embed', '@profitia/maps-contracts': 'file:../../packages/maps-contracts'}}
  return {manifest, candidate}
}

test('existing MapsEmbed peers require exact reviewed owner, version, section and trusted manifest values', () => {
  const {manifest} = reviewedMapsFixture()
  assert.equal(manifest.name, '@profitia/maps-embed'); assert.equal(manifest.version, '0.1.2')
  assertManifestPolicy(manifest, manifest)
  for (const mutate of [
    m => m.name = '@profitia/srm-xray', m => m.version = '0.1.3',
    m => m.peerDependencies['@profitia/maps-contracts'] = '*',
    m => m.peerDependencies['@profitia/platform-contracts'] += ' || 1.32.4',
    m => {m.dependencies = m.peerDependencies; delete m.peerDependencies},
    m => {m.devDependencies = m.peerDependencies; delete m.peerDependencies},
    m => {m.optionalDependencies = m.peerDependencies; delete m.peerDependencies},
    m => m.peerDependencies['@profitia/other'] = '1.0.0',
  ]) {const changed = structuredClone(manifest); mutate(changed); rejection(() => assertManifestPolicy(changed, manifest))}
  for (const mutate of [
    m => m.name = 'different-authority', m => m.version = '0.1.3',
    m => delete m.peerDependencies['@profitia/maps-contracts'],
    m => m.peerDependencies['@profitia/platform-contracts'] = '*',
  ]) {const changed = structuredClone(manifest); mutate(changed); rejection(() => assertManifestPolicy(manifest, changed))}
  const app = {name: '@profitia/sg-runtime', version: '0.1.2', peerDependencies: manifest.peerDependencies}
  rejection(() => assertManifestPolicy(app, app))
})

test('Maps lock peer exception is confined to the exact top-level installed entry and never admits app or nested peers', () => {
  const {candidate} = reviewedMapsFixture()
  assertPackagePolicy(candidate, lock(), configuration)
  assertLocalPackageSources(authorityRoot, candidate, authorityRoot)
  for (const mutate of [
    l => l.packages['node_modules/@profitia/maps-embed'].version = '0.1.3',
    l => l.packages['node_modules/@profitia/maps-embed'].peerDependencies['@profitia/maps-contracts'] = '^0.1.0',
    l => l.packages['node_modules/@profitia/maps-embed'].peerDependencies['@profitia/platform-contracts'] = '*',
    l => {const e = l.packages['node_modules/@profitia/maps-embed']; e.dependencies = e.peerDependencies; delete e.peerDependencies},
    l => {const e = l.packages['node_modules/@profitia/maps-embed']; e.optionalDependencies = e.peerDependencies; delete e.peerDependencies},
    l => l.packages[''].peerDependencies = l.packages['node_modules/@profitia/maps-embed'].peerDependencies,
    l => l.packages['node_modules/unrelated'] = {version: '0.1.2', peerDependencies: l.packages['node_modules/@profitia/maps-embed'].peerDependencies},
    l => l.packages['node_modules/parent/node_modules/@profitia/maps-embed'] = l.packages['node_modules/@profitia/maps-embed'],
    l => l.packages['node_modules/@profitia/maps-embed'].resolved = 'file:../../packages/maps-contracts',
    l => l.packages['node_modules/@profitia/maps-embed'].link = true,
    l => l.packages['node_modules/@profitia/maps-embed'].peerDependencies.alias = 'npm:@profitia/maps-contracts@0.1.0',
    l => l.packages['node_modules/@profitia/cic-core'].version = '9.0.0',
  ]) {const changed = structuredClone(candidate); mutate(changed); rejection(() => assertPackagePolicy(changed, lock(), configuration))}
})

for (const name of Object.keys(LOCAL_PACKAGES)) test(`actual local source ${name} rejects mismatched names, absent authority, private dependencies and symlinks`, () => {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-local-source-')))
  const candidateRoot = path.join(temporary, 'candidate'), authorityRoot = path.join(temporary, 'authority')
  const relative = LOCAL_PACKAGES[name]
  const local = path.resolve(candidateRoot, 'apps/sg-runtime', relative), authorityLocal = path.resolve(authorityRoot, 'apps/sg-runtime', relative)
  const manifest = {name, version: '0.2.0', peerDependencies: {react: '^18.3.1 || ^19.2.4'}}
  const candidate = lock(); candidate.packages[`node_modules/${name}`] = {version: manifest.version, resolved: `file:${relative}`, peerDependencies: structuredClone(manifest.peerDependencies)}
  try {
    fs.mkdirSync(path.join(candidateRoot, 'apps/sg-runtime'), {recursive: true})
    for (const dir of [local, authorityLocal]) {fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest))}
    assertLocalPackageSources(candidateRoot, candidate, authorityRoot)
    for (const changed of [{...manifest, name: '@profitia/cic-evals'}, {...manifest, version: '9.0.0'}, {...manifest, dependencies: {'@profitia/cic-evals': '1.0.0'}}, {...manifest, workspaces: ['../*']}, {...manifest, overrides: {'@profitia/cic-core': '9'}}]) {
      fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify(changed))
      rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    }
    fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify(manifest))
    fs.renameSync(path.join(authorityLocal, 'package.json'), path.join(authorityLocal, 'saved.json'))
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.renameSync(path.join(authorityLocal, 'saved.json'), path.join(authorityLocal, 'package.json'))
    fs.renameSync(local, `${local}-real`)
    fs.symlinkSync(`${local}-real`, local, 'dir')
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.unlinkSync(local)
    fs.symlinkSync(authorityLocal, local, 'dir')
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
    fs.unlinkSync(local)
    fs.renameSync(`${local}-real`, local)
    fs.renameSync(path.join(local, 'package.json'), path.join(local, 'saved.json'))
    fs.symlinkSync(path.join(local, 'saved.json'), path.join(local, 'package.json'))
    rejection(() => assertLocalPackageSources(candidateRoot, candidate, authorityRoot))
  } finally {fs.rmSync(temporary, {recursive: true, force: true})}
})
test('actual current SG2 dependency policy remains valid and admits only the reviewed local module addition', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const authority = JSON.parse(fs.readFileSync(path.join(root, 'apps/sg-runtime/package-lock.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/sg-runtime/package.json'), 'utf8'))
  assertPackagePolicy(authority, authority, configuration)
  assertManifestPolicy(manifest, manifest)
  assertLocalPackageSources(root, authority, root)
  const candidate = structuredClone(authority)
  const dependencies = {...manifest.dependencies}
  for (const [name, relative] of Object.entries(LOCAL_PACKAGES)) {
    const file=path.resolve(root,'apps/sg-runtime',relative,'package.json');
    if(!fs.existsSync(file)){
      assert(['@profitia/insights-runtime','@profitia/insights-contracts'].includes(name));
      assert(OIL_REPORT_E1_REVIEW.entries[path.relative(root,file).split(path.sep).join('/')]);
      continue;
    }
    const source = JSON.parse(fs.readFileSync(path.resolve(root, 'apps/sg-runtime', relative, 'package.json'), 'utf8'))
    candidate.packages[`node_modules/${name}`] = {version: source.version, resolved: `file:${relative}`, peerDependencies: source.peerDependencies}
    candidate.packages[''].dependencies[name] = `file:${relative}`
    dependencies[name] = `file:${relative}`
  }
  assertPackagePolicy(candidate, authority, configuration)
  assertManifestPolicy({...manifest, dependencies}, manifest)
  assertLocalPackageSources(root, candidate, root)
  for (const name of PRIVATE_PACKAGES) assert.deepEqual(candidate.packages[`node_modules/${name}`], authority.packages[`node_modules/${name}`])
})
for (const [name, relative] of Object.entries(LOCAL_PACKAGES)) test(`actual local npm install-links for ${name} executes no lifecycle with a credential`, () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-local-lifecycle-')))
  const app = path.join(directory, 'apps/sg-runtime'), local = path.resolve(app, relative)
  try {
    fs.mkdirSync(app, {recursive: true}); fs.mkdirSync(local, {recursive: true})
    const script = `require('node:fs').writeFileSync(process.env.FIXTURE_MARKER,JSON.stringify({credentialPresent:Boolean(process.env.NPM_TOKEN||process.env.NODE_AUTH_TOKEN||process.env.GH_TOKEN||process.env.GITHUB_TOKEN)}))`
    fs.writeFileSync(path.join(local, 'package.json'), JSON.stringify({name, version: '0.2.0', scripts: {prepare: `node -e "${script}"`, postinstall: `node -e "${script}"`}}))
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({name: 'local-consumer-fixture', version: '1.0.0', dependencies: {[name]: `file:${relative}`}}))
    fs.writeFileSync(path.join(app, 'package-lock.json'), JSON.stringify({lockfileVersion: 3, packages: {'': {name: 'local-consumer-fixture', version: '1.0.0', dependencies: {[name]: `file:${relative}`}}, [`node_modules/${name}`]: {version: '0.2.0', resolved: `file:${relative}`, hasInstallScript: true}}}))
    fs.writeFileSync(path.join(directory, 'empty-npmrc'), '')
    const marker = path.join(directory, 'phase.json')
    const env = {...process.env, NPM_CONFIG_CACHE: path.join(directory, 'cache'), NPM_CONFIG_USERCONFIG: path.join(directory, 'empty-npmrc'), FIXTURE_MARKER: marker, NODE_AUTH_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '', NPM_TOKEN: 'synthetic-canary-no-real-authority'}
    const installed = spawnSync('npm', ['ci', '--install-links', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: app, env, stdio: 'pipe'})
    assert.equal(installed.status, 0)
    assert.equal(fs.existsSync(marker), false, 'local prepare and postinstall must not execute while credential exists')
    assert.equal(fs.realpathSync(path.join(app, 'node_modules', name)), path.join(app, 'node_modules', name), 'install-links must copy, not link, the local source')
    const lifecycle = spawnSync('npm', ['rebuild', '--foreground-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: app, env: {...env, NPM_TOKEN: ''}, stdio: 'pipe'})
    assert.equal(lifecycle.status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), {credentialPresent: false})
  } finally {fs.rmSync(directory, {recursive: true, force: true})}
})
function fixture() {
  return {proof: {schemaVersion: '1.0', repository: REPOSITORY, projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_API_AND_PERSISTENCE', candidateSha: other, controlSha: sha, controlPolicyDigest: controlPolicyDigest(), runId: '12', workflow: WORKFLOW, contract: {id: 'profitia.operation-context', sourceDigest: 'e'.repeat(64)}, credentialRemovedBeforeCandidateExecution: true, privatePackageArtifactsPublished: false, productDeploymentPerformed: false, customerIdentityAdapterVerified: false, install: 'CLEAN_REGISTRY_IGNORE_SCRIPTS', tests: 'PASS', typecheck: 'PASS', build: 'PASS'}, run: {id: 12, workflow_id: 34, repository: {full_name: REPOSITORY}, head_branch: 'main', head_sha: sha, event: 'workflow_dispatch', actor: {login: 'profitia'}, conclusion: 'success'}}
}
test('completed controlled proof binds exact candidate and control source; refuses reuse and false execution claims', () => {
  const {proof, run} = fixture(); assertProof(proof, run, other, 34)
  for (const change of [p => p.candidateSha = sha, p => p.controlSha = other, p => p.runId = '99', p => p.productDeploymentPerformed = true, p => p.tests = 'SKIPPED', p => p.install = 'COPIED_DEPENDENCIES', p => p.privatePackageArtifactsPublished = true, p => p.credentialRemovedBeforeCandidateExecution = false]) {const p = structuredClone(proof); change(p); rejection(() => assertProof(p, run, other, 34))}
  for (const delta of [{conclusion: 'failure'}, {conclusion: null}, {head_branch: 'feature'}, {workflow_id: 99}, {actor: {login: 'attacker'}}, {repository: {full_name: 'attacker/SG-dev'}}]) rejection(() => assertProof(proof, {...run, ...delta}, other, 34))
  rejection(() => assertProof({...proof, controlPolicyDigest: 'f'.repeat(64)}, run, other, 34))
  rejection(() => assertProof(proof, run, other, 34, {expectedControlDigest: 'f'.repeat(64)}))
})
test('same-run main push proof requires actually completed privileged job; cannot deadlock or waive a PR proof', () => {
  const {proof, run} = fixture(); run.event = 'push'; run.conclusion = null
  const options = {currentRunId: '12', currentRef: 'refs/heads/main', completedJobs: [{name: 'SG2 controlled operation integration', conclusion: 'success'}]}
  assertProof(proof, run, other, 34, options)
  for (const delta of [{currentRunId: '13'}, {currentRef: 'refs/pull/384/merge'}, {completedJobs: []}, {completedJobs: [{name: 'SG2 controlled operation integration', conclusion: 'failure'}]}]) rejection(() => assertProof(proof, run, other, 34, {...options, ...delta}))
})
test('actual npm ignores lifecycle during credential phase; later lifecycle executes with no credential', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-npm-lifecycle-test-'))
  try {
    const script = `require('node:fs').writeFileSync('phase.json',JSON.stringify({credentialPresent:Boolean(process.env.NPM_TOKEN)}))`
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name: 'synthetic-controlled-ci-fixture', version: '1.0.0', scripts: {postinstall: `node -e "${script}"`}}))
    fs.writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify({name: 'synthetic-controlled-ci-fixture', version: '1.0.0', lockfileVersion: 3, packages: {'': {name: 'synthetic-controlled-ci-fixture', version: '1.0.0', hasInstallScript: true}}}))
    fs.writeFileSync(path.join(directory, 'empty-npmrc'), '')
    const env = {...process.env, NPM_CONFIG_CACHE: path.join(directory, 'cache'), NPM_CONFIG_USERCONFIG: path.join(directory, 'empty-npmrc'), NODE_AUTH_TOKEN: '', GH_TOKEN: '', GITHUB_TOKEN: '', NPM_TOKEN: 'synthetic-canary-no-real-authority'}
    const installed = spawnSync('npm', ['ci', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: directory, env, stdio: 'pipe'})
    assert.equal(installed.status, 0)
    assert.equal(fs.existsSync(path.join(directory, 'phase.json')), false, 'credential-bearing install must execute no lifecycle')
    const lifecycle = spawnSync('npm', ['run', 'postinstall'], {cwd: directory, env: {...env, NPM_TOKEN: ''}, stdio: 'pipe'})
    assert.equal(lifecycle.status, 0)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'phase.json'))), {credentialPresent: false})
  } finally {fs.rmSync(directory, {recursive: true, force: true})}
})


function sourceLayoutFixture(implementation='1.0.0-candidate.15') {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'contract-source-layout-'))
 const names=['src/operation-context.mjs','src/operation-context.d.mts','src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql','src/supplier-location.mjs','src/supplier-location.d.mts','migrations/access/019-supplier-location-operations.sql']
 for(const name of names){const file=path.join(root,'packages/platform-contracts',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,name==='src/operation-context.mjs'?`export const OPERATION_CONTRACT = Object.freeze({ id: 'profitia.operation-context', version: '1.0.0', implementation: '${implementation}' })\n`:name+' synthetic source\n')}
 return{root,names,contract:{id:'profitia.operation-context',version:'1.0.0',implementation,sourceDigest:'a'.repeat(64)},file:name=>path.join(root,'packages/platform-contracts',name),close:()=>fs.rmSync(root,{recursive:true,force:true})}
}
for(const version of[1,3,14,15,16])test('fixed source provenance preserves explicit candidate'+version+' layout without evaluating candidate code',async()=>{
 const {createHash}=await import('node:crypto'),f=sourceLayoutFixture('1.0.0-candidate.'+version)
 try{const selected=f.names.slice(0,version===16?8:version===15?5:2),h=createHash('sha256');for(const name of selected)h.update(fs.readFileSync(f.file(name)));const before=f.names.map(name=>fs.readFileSync(f.file(name),'utf8'));assert.equal(operationContractProvenanceDigest(f.root,f.contract),h.digest('hex'));assert.deepEqual(f.names.map(name=>fs.readFileSync(f.file(name),'utf8')),before)}finally{f.close()}
})
test('candidate15 cannot downgrade to the two-file hash or supply its own source file list',async()=>{
 const {createHash}=await import('node:crypto'),f=sourceLayoutFixture()
 try{const h=createHash('sha256');for(const name of f.names.slice(0,2))h.update(fs.readFileSync(f.file(name)));const actual=operationContractProvenanceDigest(f.root,f.contract);assert.notEqual(actual,h.digest('hex'));assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,sourceFiles:['src/operation-context.mjs','src/operation-context.d.mts']}),/CONTRACT_PROVENANCE_MISMATCH/);assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,implementation:'1.0.0-candidate.14'}),/CONTRACT_IMPLEMENTATION_MISMATCH/)}finally{f.close()}
})
for(const name of['src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql'])test('candidate15 binds changes and refuses missing '+name,()=>{
 const f=sourceLayoutFixture()
 try{const before=operationContractProvenanceDigest(f.root,f.contract);fs.appendFileSync(f.file(name),'changed dependency');assert.notEqual(operationContractProvenanceDigest(f.root,f.contract),before);fs.unlinkSync(f.file(name));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/)}finally{f.close()}
})
for(const implementation of['1.0.0-candidate.17','1.0.0-candidate.015','1.0.0-candidate.0','toString',null])test('unsupported source identity cannot select an implicit layout '+implementation,()=>{
 const f=sourceLayoutFixture();try{assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,implementation}),/CONTRACT_SOURCE_LAYOUT_UNSUPPORTED|CONTRACT_PROVENANCE_MISMATCH/)}finally{f.close()}
})
test('regular files and bounded size are required; symlink files and parent directories never widen reads',()=>{
 const f=sourceLayoutFixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'untrusted-contract-source-'))
 try{const file=f.file('src/request-operations.mjs');fs.unlinkSync(file);fs.writeFileSync(path.join(outside,'private-file'),'synthetic outside marker');fs.symlinkSync(path.join(outside,'private-file'),file);assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/);fs.unlinkSync(file);fs.writeFileSync(file,'a'.repeat(1024*1024+1));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/);fs.writeFileSync(file,'small');const src=f.file('src');fs.renameSync(src,path.join(outside,'src'));fs.symlinkSync(path.join(outside,'src'),src,'dir');assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/)}finally{f.close();fs.rmSync(outside,{recursive:true,force:true})}
})
test('actual current source provenance is the exact accepted SDK digest with all old trust rules intact',async()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),receipt=JSON.parse(fs.readFileSync(path.join(root,'apps/sg-runtime/operation-integration.json'),'utf8'))
 const contract=adoptedOperationContract(receipt)
 assert.equal(operationContractProvenanceDigest(root,contract),contract.sourceDigest)
 const sdk=await import('../../packages/platform-contracts/src/operation-context.mjs');assert.equal(await sdk.operationSourceDigest(),contract.sourceDigest)
})

for(const patch of[{id:'untrusted.contract'},{version:'9.0.0'},{sourceDigest:'invalid'},{paths:['../../outside']},{implementation:'1.0.0-candidate.14'}])test('source identity refuses malformed metadata or a downgrade '+JSON.stringify(patch),()=>{
 const f=sourceLayoutFixture();try{assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,...patch}),/CONTRACT_PROVENANCE_MISMATCH|CONTRACT_IMPLEMENTATION_MISMATCH/)}finally{f.close()}
})

for(const name of['src/supplier-location.mjs','src/supplier-location.d.mts','migrations/access/019-supplier-location-operations.sql'])test('candidate16 binds new dependency bytes and rejects missing '+name,()=>{
 const f=sourceLayoutFixture('1.0.0-candidate.16')
 try{const before=operationContractProvenanceDigest(f.root,f.contract);fs.appendFileSync(f.file(name),'changed fixed dependency');assert.notEqual(operationContractProvenanceDigest(f.root,f.contract),before);fs.unlinkSync(f.file(name));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),/CONTRACT_SOURCE_FILE_REJECTED/)}finally{f.close()}
})
test('candidate16 cannot select an older layout, altered file identity or candidate-provided source list',()=>{
 const f=sourceLayoutFixture('1.0.0-candidate.16')
 try{for(const patch of[{implementation:'1.0.0-candidate.15'},{sourceFiles:['src/operation-context.mjs']},{implementation:'1.0.0-candidate.17'}])assert.throws(()=>operationContractProvenanceDigest(f.root,{...f.contract,...patch}));fs.appendFileSync(f.file('src/supplier-location.mjs'),'\nthrow Error("must never execute candidate metadata")');assert.match(operationContractProvenanceDigest(f.root,f.contract),/^[a-f0-9]{64}$/)}finally{f.close()}
})

const authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const architecturePr = (count = 2) => ({...pr(), changed_files: count, base: {...pr().base, sha}, head: {...pr().head, ref: 'architecture/profile'}})
const producerFile = (filename = 'packages/platform-contracts/src/user-profile.mjs') => ({filename, status: 'modified', sha: 'c'.repeat(40)})
const architectureFiles = () => [producerFile(), producerFile('Canon/evidence/2026-10-21-identity-profile-b1-handoff.md')]
const krsReviewFiles = () => KRS_GOVERNANCE_REVIEW_FILES.map(producerFile)
const freshReviewFiles = () => Object.entries(FRESH_REPORT_PRODUCER_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:'modified'}))
const freshReviewPr = () => ({...architecturePr(10),number:817,head:{...architecturePr().head,ref:FRESH_REPORT_PRODUCER_REVIEW.branch}})

test('FRESH review pins ten reviewed blobs of PR817 without opening optional packages or workflow patterns',()=>{
 assert(Object.isFrozen(FRESH_REPORT_PRODUCER_REVIEW));assert(Object.isFrozen(FRESH_REPORT_PRODUCER_REVIEW.blobs))
 assert.equal(FRESH_REPORT_PRODUCER_REVIEW.prNumber,817)
 assert.equal(FRESH_REPORT_PRODUCER_REVIEW.sourceSha,'9f23dc13902f942c31fe7d86ba5bf7bc2e9c6363')
 assert.equal(Object.keys(FRESH_REPORT_PRODUCER_REVIEW.blobs).length,10)
 const files=freshReviewFiles(),p=freshReviewPr()
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 assert.equal(selectCandidate(context(),p,other,{files:files.map(f=>({...f,status:'added'}))}),other)
 for(const delta of [{number:818},{number:undefined},{head:{...p.head,ref:'architecture/another-fresh'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...delta},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})
test('FRESH review refuses every changed or missing blob, duplicate, delete, rename and generic extension',()=>{
 const original=freshReviewFiles()
 for(let i=0;i<original.length;i++){
  const incomplete=original.filter((_,j)=>i!==j)
  rejection(()=>selectCandidate(context(),{...freshReviewPr(),changed_files:incomplete.length},other,{files:incomplete}))
  for(const patch of [{sha:'d'.repeat(40)},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename},{sha:'forged'}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f)
   rejection(()=>selectCandidate(context(),freshReviewPr(),other,{files}))
  }
  const duplicate=original.map((f,j)=>i===j?original[(i+1)%original.length]:f)
  rejection(()=>selectCandidate(context(),freshReviewPr(),other,{files:duplicate}))
 }
 for(const name of ['packages/platform-contracts/current-fresh-report/src/extra.mjs','packages/platform-contracts/other/package.json',
  'packages/platform-contracts/src/operation-context.mjs','apps/sg-runtime/package.json','apps/srm/package.json',
  'apps/identity-runtime/package.json','apps/maps-runtime/package.json','.github/workflows/another.yml',
  'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-30-extra.md']){
  const files=[...original,producerFile(name)]
  rejection(()=>selectCandidate(context(),{...freshReviewPr(),changed_files:files.length},other,{files}))
  const replaced=[...original];replaced[0]=producerFile(name)
  rejection(()=>selectCandidate(context(),freshReviewPr(),other,{files:replaced}))
 }
})
test('FRESH review preserves current actor, main, repository, owner and route fences',()=>{
 const files=freshReviewFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='staging',p=>p.state='closed']){
  const p=freshReviewPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))
 }
 for(const delta of [{actor:'other'},{triggeringActor:'other'},{event:'pull_request_target'},{ref:'refs/heads/architecture/untrusted'}])rejection(()=>selectCandidate({...context(),...delta},freshReviewPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const pattern of ['packages/platform-contracts/**','apps/architecture-lab/**','Canon/**',WORKFLOW])for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){
  const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes(pattern))
  assert(surface);Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry))
  rejection(()=>selectCandidate(context(),freshReviewPr(),other,{files,repositoryRoot:root}))
 }}finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('FRESH review requires complete API files and repeat metadata before the existing Git/tree fence',async()=>{
 const files=freshReviewFiles(),candidate=freshReviewPr()
 const result=await resolveCandidateAdmission(context(),'817',other,apiFixture(candidate,files).request)
 assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
 for(const after of [{...candidate,head:{...candidate.head,sha}},{...candidate,base:{...candidate.base,sha:other}},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}])await assert.rejects(resolveCandidateAdmission(context(),'817',other,apiFixture(candidate,files,after).request))
 await assert.rejects(resolveCandidateAdmission(context(),'817',other,apiFixture(candidate,files.slice(1)).request))
})
const payloadCaptureFiles = () => Object.entries(PAYLOAD_CAPTURE_PRODUCER_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:'added'}))
const payloadCapturePr = () => ({...architecturePr(10),number:827,head:{...architecturePr().head,ref:PAYLOAD_CAPTURE_PRODUCER_REVIEW.branch,sha:PAYLOAD_CAPTURE_PRODUCER_REVIEW.sourceSha}})

test('payload capture review admits only exact PR827 HEAD and ten immutable added blobs',()=>{
 const pinned=PAYLOAD_CAPTURE_PRODUCER_REVIEW,files=payloadCaptureFiles(),p=payloadCapturePr()
 assert(Object.isFrozen(pinned));assert(Object.isFrozen(pinned.blobs));assert.equal(pinned.prNumber,827)
 assert.equal(pinned.branch,'architecture/payload-capture-source-publication-20261031')
 assert.equal(pinned.sourceSha,'9d44684b968ca3a067d414f7c450b6016ecc8d19')
 assert.equal(files.length,10)
 assert.equal(files.filter(f=>f.filename.startsWith('packages/platform-contracts/payload-capture/')).length,6)
 assert.equal(files.filter(f=>f.filename.startsWith('apps/architecture-lab/')).length,2)
 assert.equal(files.filter(f=>f.filename.startsWith('Canon/evidence/')).length,2)
 assert.equal(selectCandidate(context(),p,pinned.sourceSha,{files}),pinned.sourceSha)
 assert.equal(selectCandidate(context(),p,pinned.sourceSha,{files:[...files].reverse()}),pinned.sourceSha)
 for(const patch of [{number:817},{number:828},{number:undefined},{head:{...p.head,ref:'architecture/another-capture'}},
  {head:{...p.head,sha:other}},{head:{...p.head,sha}}]){
  const changed={...p,...patch}
  rejection(()=>selectCandidate(context(),changed,changed.head.sha,{files}))
 }
 for(const expected of [undefined,sha,other,'main'])rejection(()=>selectCandidate(context(),p,expected,{files}))
})
test('payload capture review refuses each changed, absent, duplicate, modified, removed or renamed file and every extension',()=>{
 const original=payloadCaptureFiles(),p=payloadCapturePr(),head=p.head.sha
 for(let i=0;i<original.length;i++){
  const fewer=original.filter((_,j)=>i!==j)
  rejection(()=>selectCandidate(context(),{...p,changed_files:fewer.length},head,{files:fewer}))
  for(const patch of [{sha:'d'.repeat(40)},{sha:'forged'},{status:'modified'},{status:'removed'},{status:'copied'},
   {status:'renamed',previous_filename:original[i].filename},{previous_filename:original[i].filename}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f)
   rejection(()=>selectCandidate(context(),p,head,{files}))
  }
  const files=original.map((f,j)=>i===j?original[(i+1)%original.length]:f)
  rejection(()=>selectCandidate(context(),p,head,{files}))
 }
 for(const name of ['packages/platform-contracts/payload-capture/src/extra.mjs','packages/platform-contracts/other/package.json',
  'packages/platform-contracts/src/operation-context.mjs','apps/architecture-lab/test/extra.test.mjs','apps/srm/package.json',
  'apps/sg-runtime/package.json',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-31-extra.md']){
  const extra={...producerFile(name),status:'added'},files=[...original,extra]
  rejection(()=>selectCandidate(context(),{...p,changed_files:files.length},head,{files}))
  const replaced=[...original];replaced[0]=extra
  rejection(()=>selectCandidate(context(),p,head,{files:replaced}))
 }
})
test('payload capture review preserves trusted owner, main, repository, routing and source classification',()=>{
 const files=payloadCaptureFiles(),head=PAYLOAD_CAPTURE_PRODUCER_REVIEW.sourceSha
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.repo.full_name='other/SG-dev',
  p=>p.base.ref='staging',p=>p.base.ref='production',p=>p.state='closed']){
  const p=payloadCapturePr();edit(p);rejection(()=>selectCandidate(context(),p,head,{files}))
 }
 for(const patch of [{actor:'other'},{triggeringActor:'other'},{event:'pull_request_target'},{ref:'refs/heads/architecture/untrusted'},
  {workflowRef:`${REPOSITORY}/${WORKFLOW}@refs/heads/sg2/untrusted`}])rejection(()=>selectCandidate({...context(),...patch},payloadCapturePr(),head,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const pattern of ['packages/platform-contracts/**','apps/architecture-lab/**','Canon/**'])for(const patch of [
  {currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){
   const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes(pattern))
   assert(surface);Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry))
   rejection(()=>selectCandidate(context(),payloadCapturePr(),head,{files,repositoryRoot:root}))
 }}finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('payload capture review requires complete API pages, repeat metadata and exact-head stability',async()=>{
 const files=payloadCaptureFiles(),candidate=payloadCapturePr(),head=candidate.head.sha
 const api=apiFixture(candidate,files),result=await resolveCandidateAdmission(context(),'827',head,api.request)
 assert.equal(result.sha,head);assert.equal(result.admission.kind,'ARCHITECTURE');assert.deepEqual(result.admission.files,files)
 assert.deepEqual(api.calls,[`repos/${REPOSITORY}/pulls/827`,`repos/${REPOSITORY}/pulls/827/files?per_page=100&page=1`,`repos/${REPOSITORY}/pulls/827`])
 for(const after of [{...candidate,head:{...candidate.head,sha:other}},{...candidate,base:{...candidate.base,sha:other}},
  {...candidate,changed_files:9},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}]){
  await assert.rejects(resolveCandidateAdmission(context(),'827',head,apiFixture(candidate,files,after).request))
 }
 await assert.rejects(resolveCandidateAdmission(context(),'827',head,apiFixture(candidate,files.slice(1)).request))
 await assert.rejects(resolveCandidateAdmission(context(),'827',head,async endpoint=>{if(endpoint.includes('/files?'))throw Error('unavailable');return {data:structuredClone(candidate)}}))
})

const adpReviewFiles = () => Object.entries(ADP_GOVERNANCE_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:'modified'}))
const adpReviewPr = () => ({...architecturePr(5),number:ADP_GOVERNANCE_REVIEW.prNumber,head:{...architecturePr().head,ref:ADP_GOVERNANCE_REVIEW.branch}})

test('ADP admission binds only the five approved blobs of PR756 and its exact branch',()=>{
 assert(Object.isFrozen(ADP_GOVERNANCE_REVIEW));assert(Object.isFrozen(ADP_GOVERNANCE_REVIEW.blobs))
 assert.equal(ADP_GOVERNANCE_REVIEW.prNumber,756);assert.equal(ADP_GOVERNANCE_REVIEW.sourceSha,'202bcd0b4c7e00a03a2a7eee9aeb38338363f3d0')
 assert.equal(Object.keys(ADP_GOVERNANCE_REVIEW.blobs).length,5)
 assert(!Object.keys(ADP_GOVERNANCE_REVIEW.blobs).some(n=>n.startsWith('apps/')||n.startsWith('packages/')||n.startsWith('.github/')))
 const files=adpReviewFiles(),p=adpReviewPr()
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 assert.equal(selectCandidate(context(),p,other,{files:files.map(f=>({...f,status:'added'}))}),other)
 for(const delta of [{number:757},{number:undefined},{head:{...p.head,ref:'architecture/another-review'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...delta},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('ADP review refuses changed blobs, missing/extra/duplicate files, deletion and rename',()=>{
 const original=adpReviewFiles()
 for(let i=0;i<original.length;i++){
  const incomplete=original.filter((_,j)=>i!==j);rejection(()=>selectCandidate(context(),{...adpReviewPr(),changed_files:incomplete.length},other,{files:incomplete}))
  for(const patch of [{sha:'d'.repeat(40)},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename},{sha:'forged'}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),adpReviewPr(),other,{files}))
  }
  const files=original.map((f,j)=>i===j?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),adpReviewPr(),other,{files}))
 }
 for(const name of ['apps/sg-runtime/package.json','packages/srm-adp-ui/src/index.ts','packages/platform-contracts/src/operation-context.mjs',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-27-extra.md']){
  const files=[...original,producerFile(name)];rejection(()=>selectCandidate(context(),{...adpReviewPr(),changed_files:files.length},other,{files}))
  const replaced=[...original];replaced[0]=producerFile(name);rejection(()=>selectCandidate(context(),adpReviewPr(),other,{files:replaced}))
 }
})

test('ADP review preserves trusted actor/repository/main and current owner routing fences',()=>{
 const files=adpReviewFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='staging',p=>p.state='closed']){const p=adpReviewPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},adpReviewPr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/architecture/untrusted'},adpReviewPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'));Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),adpReviewPr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('ADP review uses complete API pagination and metadata race fencing before fixed Git checks',async()=>{
 const files=adpReviewFiles(),candidate=adpReviewPr(),result=await resolveCandidateAdmission(context(),'756',other,apiFixture(candidate,files).request)
 assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
 for(const after of [{...candidate,head:{...candidate.head,sha}},{...candidate,base:{...candidate.base,sha:other}},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}])await assert.rejects(resolveCandidateAdmission(context(),'756',other,apiFixture(candidate,files,after).request))
 await assert.rejects(resolveCandidateAdmission(context(),'756',other,apiFixture(candidate,files.slice(1)).request))
})

const limitsG1ReviewFiles = () => Object.entries(LIMITS_G1_GOVERNANCE_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:'modified'}))
const limitsG1ReviewPr = () => ({...architecturePr(8),number:LIMITS_G1_GOVERNANCE_REVIEW.prNumber,head:{...architecturePr().head,ref:LIMITS_G1_GOVERNANCE_REVIEW.branch}})

test('Limits G1 admission binds only the eight frozen blobs of PR814 and its exact branch',()=>{
 assert(Object.isFrozen(LIMITS_G1_GOVERNANCE_REVIEW));assert(Object.isFrozen(LIMITS_G1_GOVERNANCE_REVIEW.blobs))
 assert.equal(LIMITS_G1_GOVERNANCE_REVIEW.prNumber,814);assert.equal(LIMITS_G1_GOVERNANCE_REVIEW.sourceSha,'b6f1772ecc23b9efcbac6cb4e7265cfbea375c42')
 assert.equal(Object.keys(LIMITS_G1_GOVERNANCE_REVIEW.blobs).length,8)
 assert(!Object.keys(LIMITS_G1_GOVERNANCE_REVIEW.blobs).some(n=>n.startsWith('apps/')||n.startsWith('packages/')||n.startsWith('.github/')))
 const files=limitsG1ReviewFiles(),p=limitsG1ReviewPr()
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 assert.equal(selectCandidate(context(),p,other,{files:files.map(f=>({...f,status:'added'}))}),other)
 for(const delta of [{number:815},{number:undefined},{head:{...p.head,ref:'architecture/another-review'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...delta},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('Limits G1 review refuses changed blobs, missing/extra/duplicate files, deletion and rename',()=>{
 const original=limitsG1ReviewFiles()
 for(let i=0;i<original.length;i++){
  const incomplete=original.filter((_,j)=>i!==j);rejection(()=>selectCandidate(context(),{...limitsG1ReviewPr(),changed_files:incomplete.length},other,{files:incomplete}))
  for(const patch of [{sha:'d'.repeat(40)},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename},{sha:'forged'}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),limitsG1ReviewPr(),other,{files}))
  }
  const files=original.map((f,j)=>i===j?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),limitsG1ReviewPr(),other,{files}))
 }
 for(const name of ['apps/sg-runtime/package.json','apps/package-limits/src/server.ts','packages/platform-contracts/src/operation-context.mjs',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-27-extra.md']){
  const files=[...original,producerFile(name)];rejection(()=>selectCandidate(context(),{...limitsG1ReviewPr(),changed_files:files.length},other,{files}))
  const replaced=[...original];replaced[0]=producerFile(name);rejection(()=>selectCandidate(context(),limitsG1ReviewPr(),other,{files:replaced}))
 }
})

test('Limits G1 review preserves trusted actor/repository/main and current owner routing fences',()=>{
 const files=limitsG1ReviewFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='staging',p=>p.state='closed']){const p=limitsG1ReviewPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},limitsG1ReviewPr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/architecture/untrusted'},limitsG1ReviewPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'));Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),limitsG1ReviewPr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('Limits G1 review uses complete API pagination and metadata race fencing before fixed Git checks',async()=>{
 const files=limitsG1ReviewFiles(),candidate=limitsG1ReviewPr(),result=await resolveCandidateAdmission(context(),'814',other,apiFixture(candidate,files).request)
 assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
 for(const after of [{...candidate,head:{...candidate.head,sha}},{...candidate,base:{...candidate.base,sha:other}},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}])await assert.rejects(resolveCandidateAdmission(context(),'814',other,apiFixture(candidate,files,after).request))
 await assert.rejects(resolveCandidateAdmission(context(),'814',other,apiFixture(candidate,files.slice(1)).request))
})

test('KRS governance admission is one immutable complete fifteen-file review bundle without a dummy producer', () => {
  assert(Object.isFrozen(KRS_GOVERNANCE_REVIEW_FILES))
  assert.equal(KRS_GOVERNANCE_REVIEW_FILES.length, 15)
  assert.equal(new Set(KRS_GOVERNANCE_REVIEW_FILES).size, 15)
  assert(!KRS_GOVERNANCE_REVIEW_FILES.some(p => p.startsWith('apps/') || p.startsWith('packages/')))
  const files = krsReviewFiles(), p = architecturePr(files.length)
  assert.equal(selectCandidate(context(), p, other, {files}), other)
  assert.equal(selectCandidate(context(), p, other, {files: [...files].reverse()}), other)
  assert.equal(selectCandidate(context(), p, other, {files: files.map(f => ({...f, status: 'added'}))}), other)
  for (let i = 0; i < files.length; i++) {
    const incomplete = files.filter((_, at) => at !== i)
    rejection(() => selectCandidate(context(), architecturePr(incomplete.length), other, {files: incomplete}))
    for (const patch of [{status:'removed'}, {status:'renamed', previous_filename:'Canon/other.md'}, {status:'copied'}, {previous_filename:files[i].filename}, {sha:'forged'}]) {
      const changed = files.map((f, at) => at === i ? {...f,...patch} : f)
      rejection(() => selectCandidate(context(), p, other, {files: changed}))
    }
    const duplicates = files.map((f, at) => at === i ? files[(i + 1) % files.length] : f)
    rejection(() => selectCandidate(context(), p, other, {files: duplicates}))
  }
})

test('KRS class cannot mix a producer, another review, runtime, workflow, secret policy or extra governance path', () => {
  for (const name of ['packages/platform-contracts/src/operation-context.mjs', 'apps/krs-registry-runtime/index.mjs',
    'apps/srm/src/server/mgbi-financial.ts', 'apps/maps-runtime/package.json', '.github/workflows/krs-registry-ci.yml',
    WORKFLOW, 'scripts/governance/controlled-package-ci.mjs', 'Canon/registries/profitia-projects-v1.json',
    'Canon/registries/architecture-environment-topology-v1.json', 'Canon/evidence/2026-10-23-krs-extra.md',
    'Canon/evidence/2026-10-22-identity-runtime-lifecycle-b2-e.md', 'AGENTS.md', '.npmrc']) {
    const files = [...krsReviewFiles(),producerFile(name)]
    rejection(() => selectCandidate(context(), architecturePr(files.length), other, {files}))
    const replaced = krsReviewFiles(); replaced[0] = producerFile(name)
    rejection(() => selectCandidate(context(), architecturePr(replaced.length), other, {files:replaced}))
  }
})

test('KRS review preserves trusted actor, repository, main, head and current authority routing checks', () => {
  const files = krsReviewFiles()
  for (const edit of [p=>p.user.login='other', p=>p.head.repo.full_name='other/fork', p=>p.base.ref='staging', p=>p.head.sha=sha, p=>p.state='closed']) {
    const p = architecturePr(files.length);edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))
  }
  rejection(()=>selectCandidate({...context(),triggeringActor:'other'},architecturePr(files.length),other,{files}))
  const root = routingFixture(), file = path.join(root,'Canon/registries/current-architecture-baseline-v1.json'), original = fs.readFileSync(file,'utf8')
  try {
    assertArchitectureFiles(architecturePr(files.length),files,root)
    for (const patch of [{currentOwner:'Other owner'}, {allowedProjectKeys:['SG2']}, {baselineClassification:'LEGACY'}]) {
      const registry = JSON.parse(original), surface = registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'))
      assert(surface);Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry))
      rejection(()=>assertArchitectureFiles(architecturePr(files.length),files,root))
    }
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})

test('KRS complete API list and metadata race fence precede the unchanged exact Git checkout checks', async () => {
  const files=krsReviewFiles(), candidate=architecturePr(files.length), api=apiFixture(candidate,files)
  const result=await resolveCandidateAdmission(context(),'603',other,api.request)
  assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
  const after={...candidate,head:{...candidate.head,sha}}
  await assert.rejects(resolveCandidateAdmission(context(),'603',other,apiFixture(candidate,files,after).request))
  await assert.rejects(resolveCandidateAdmission(context(),'603',other,apiFixture(candidate,files.slice(1)).request))
})

test('KRS full review uses actual Git diff/blob/regular-file validation, rejecting hidden source and symlinks', () => {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'krs-review-checkout-')))
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Synthetic CI',GIT_AUTHOR_EMAIL:'ci@example.invalid',GIT_COMMITTER_NAME:'Synthetic CI',GIT_COMMITTER_EMAIL:'ci@example.invalid'}}).trim()
  try {
    fs.writeFileSync(path.join(root,'baseline.txt'),'synthetic baseline');git('init','-q');git('add','.');git('commit','-qm','baseline');const baseSha=git('rev-parse','HEAD')
    for(const p of KRS_GOVERNANCE_REVIEW_FILES){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),'synthetic bytes; never executed\n')}
    git('add','.');git('commit','-qm','complete KRS review');const candidateSha=git('rev-parse','HEAD')
    const files=KRS_GOVERNANCE_REVIEW_FILES.map(filename=>({filename,status:'added',sha:git('rev-parse',`${candidateSha}:${filename}`)})),admission={kind:'ARCHITECTURE',baseSha,files}
    assertArchitectureCheckout(root,candidateSha,admission)
    const target=path.join(root,files[0].filename);fs.appendFileSync(target,'tampered')
    rejection(()=>assertArchitectureCheckout(root,candidateSha,admission));git('checkout','--',files[0].filename)
    fs.unlinkSync(target);fs.symlinkSync('/synthetic-outside-never-read',target)
    rejection(()=>assertArchitectureCheckout(root,candidateSha,admission));git('checkout','--',files[0].filename)
    fs.mkdirSync(path.join(root,'apps/srm'),{recursive:true});fs.writeFileSync(path.join(root,'apps/srm/hidden.mjs'),'hidden mutation');git('add','.');git('commit','-qm','hidden consumer mutation')
    assert.throws(()=>assertArchitectureCheckout(root,git('rev-parse','HEAD'),admission),/ARCHITECTURE_DIFF_MISMATCH/)
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})

test('Architecture admission requires complete source files, exact SHA and actual trusted ownership', () => {
  assert.equal(selectCandidate(context(), architecturePr(), other, {files: architectureFiles()}), other)
  for (const files of [undefined, [], architectureFiles().slice(0, 1), [...architectureFiles(), producerFile()]]) rejection(() => selectCandidate(context(), architecturePr(), other, {files}))
  for (const expected of [undefined, sha, 'main']) rejection(() => selectCandidate(context(), architecturePr(), expected, {files: architectureFiles()}))
  const {proof, run} = fixture()
  assertProof(proof, run, selectCandidate(context(), architecturePr(), other, {files: architectureFiles()}), 34)
  rejection(() => assertProof(proof, run, sha, 34))
  // SG2 retains its original separate semantics; it requires no Architecture file list.
  assert.equal(selectCandidate(context(), pr(), other), other)
})

test('Architecture prefix never relaxes internal repository, owner, main or execution trust', () => {
  for (const edit of [p => p.head.repo.full_name = 'attacker/fork', p => p.base.repo.full_name = 'attacker/SG-dev', p => p.user.login = 'attacker', p => p.base.ref = 'staging', p => p.state = 'closed', p => p.head.ref = 'feature/work', p => p.head.sha = sha]) {
    const candidate = architecturePr(); edit(candidate)
    rejection(() => selectCandidate(context(), candidate, other, {files: architectureFiles()}))
  }
  for (const delta of [{ref: 'refs/heads/architecture/profile'}, {event: 'pull_request_target'}, {actor: 'attacker'}, {workflowRef: `${REPOSITORY}/${WORKFLOW}@refs/heads/untrusted`}]) rejection(() => selectCandidate({...context(), ...delta}, architecturePr(), other, {files: architectureFiles()}))
})

for (const name of ['apps/sg-runtime/package.json', 'apps/srm/page.tsx', 'apps/identity-runtime/index.mjs', 'packages/srm-xray/package.json',
  'scripts/governance/controlled-package-ci.mjs', WORKFLOW, '.github/workflows/identity-runtime-ci.yml', 'AGENTS.md',
  'Canon/registries/current-architecture-baseline-v1.json', 'Canon/registries/architecture-environment-topology-v1.json',
  'packages/platform-contracts/.npmrc', 'packages/platform-contracts/.env', 'packages/platform-contracts/scripts/install.mjs',
  'packages/platform-contracts/src/../../srm-xray/escape.mjs', 'packages/platform-contracts/src//escape.mjs', 'packages/platform-contracts/src/%2e%2e/escape.mjs',
  'packages/platform-contracts/src/escape.mjs\n', 'packages/platform-contracts-unrelated/src/escape.mjs', 'Canon/evidence/undated.md']) {
  test('Architecture rejects protected or non-producer path ' + JSON.stringify(name), () => rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), producerFile(name)]})))
}

test('Architecture rejects renames, forged/incomplete metadata, duplicate paths and evidence-only PRs', () => {
  for (const delta of [{status: 'renamed', previous_filename: 'apps/sg-runtime/escape.mjs'}, {previous_filename: 'apps/srm/escape.mjs'}, {status: 'copied'}, {sha: 'unverified'}]) rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), {...producerFile('packages/platform-contracts/src/other.mjs'), ...delta}]}))
  rejection(() => selectCandidate(context(), architecturePr(), other, {files: [producerFile(), producerFile()]}))
  rejection(() => selectCandidate(context(), architecturePr(1), other, {files: [architectureFiles()[1]]}))
  for (const count of [undefined, 0, 301, '2']) rejection(() => selectCandidate(context(), {...architecturePr(), changed_files: count}, other, {files: architectureFiles()}))
})

function routingFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-routing-authority-'))
  fs.mkdirSync(path.join(root, 'Canon/registries'), {recursive: true})
  for (const name of ['profitia-projects-v1.json', 'current-architecture-baseline-v1.json']) fs.copyFileSync(path.join(authorityRoot, 'Canon/registries', name), path.join(root, 'Canon/registries', name))
  return root
}

test('trusted ownership/project boundary drift fails closed; candidate declarations cannot substitute routing', () => {
  const root = routingFixture(), file = path.join(root, 'Canon/registries/current-architecture-baseline-v1.json'), original = fs.readFileSync(file, 'utf8')
  try {
    assertArchitectureFiles(architecturePr(), architectureFiles(), root)
    for (const patch of [{currentOwner: 'SG2 Runtime'}, {allowedProjectKeys: ['SG2']}, {baselineClassification: 'TRANSITIONAL'}]) {
      const registry = JSON.parse(original), surface = registry.surfaces.find(s => s.pathPatterns.includes('packages/platform-contracts/**'))
      Object.assign(surface, patch); fs.writeFileSync(file, JSON.stringify(registry))
      rejection(() => assertArchitectureFiles(architecturePr(), architectureFiles(), root))
    }
  } finally {fs.rmSync(root, {recursive: true, force: true})}
})

function apiFixture(candidate, files, after = candidate) {
  const calls = []
  return {calls, request: async endpoint => {
    calls.push(endpoint)
    const m = /\/files\?per_page=100&page=([1-4])$/.exec(endpoint)
    return {data: m ? files.slice((Number(m[1]) - 1) * 100, Number(m[1]) * 100) : structuredClone(calls.length === 1 ? candidate : after)}
  }}
}

test('trusted GitHub admission paginates actual files and fences exact PR metadata', async () => {
  const files = Array.from({length: 107}, (_, i) => producerFile(`packages/platform-contracts/src/contract-${i}.mjs`)), candidate = architecturePr(files.length), api = apiFixture(candidate, files)
  const result = await resolveCandidateAdmission(context(), '591', other, api.request)
  assert.equal(result.sha, other); assert.equal(result.admission.kind, 'ARCHITECTURE'); assert.equal(result.admission.files.length, 107)
  assert.deepEqual(api.calls, [`repos/${REPOSITORY}/pulls/591`, `repos/${REPOSITORY}/pulls/591/files?per_page=100&page=1`, `repos/${REPOSITORY}/pulls/591/files?per_page=100&page=2`, `repos/${REPOSITORY}/pulls/591`])
  for (const after of [{...candidate, head: {...candidate.head, sha}}, {...candidate, base: {...candidate.base, sha: other}}, {...candidate, changed_files: 106}, {...candidate, state: 'closed'}]) {
    const changed = apiFixture(candidate, files, after)
    await assert.rejects(resolveCandidateAdmission(context(), '591', other, changed.request))
  }
  const truncated = apiFixture(candidate, files.slice(0, 100)); await assert.rejects(resolveCandidateAdmission(context(), '591', other, truncated.request))
  const missing = apiFixture(candidate, []); await assert.rejects(resolveCandidateAdmission(context(), '591', other, missing.request))
  const duplicate = apiFixture(candidate, [...files.slice(0, 106), files[0]]); await assert.rejects(resolveCandidateAdmission(context(), '591', other, duplicate.request))
  const broad = apiFixture(architecturePr(301), files); await assert.rejects(resolveCandidateAdmission(context(), '591', other, broad.request)); assert.equal(broad.calls.length, 1)
})

test('unavailable file API is a failure; SG2 and exact-main keep their original no-list path', async () => {
  const unavailable = async endpoint => {if (endpoint.includes('/files?')) throw new Error('unavailable'); return {data: architecturePr()}}
  await assert.rejects(resolveCandidateAdmission(context(), '591', other, unavailable))
  for (const ref of ['sg2/integration', 'srm/supplier-locations']) {
    const candidate = pr(); candidate.head.ref = ref
    const consumer = apiFixture(candidate, [])
    assert.deepEqual(await resolveCandidateAdmission(context(), '591', other, consumer.request), {sha: other})
    assert.equal(consumer.calls.length, 1, 'consumer candidates retain the accepted no-producer-list path')
  }
  assert.deepEqual(await resolveCandidateAdmission(context(), '', sha, () => {throw new Error('must not request')}), {sha})
})

function checkoutFixture(edit = () => {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-checkout-')))
  const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', env: {...process.env, GIT_AUTHOR_NAME: 'Synthetic CI', GIT_AUTHOR_EMAIL: 'ci@example.invalid', GIT_COMMITTER_NAME: 'Synthetic CI', GIT_COMMITTER_EMAIL: 'ci@example.invalid'}}).trim()
  const filename = 'packages/platform-contracts/src/profile.mjs'
  fs.mkdirSync(path.dirname(path.join(root, filename)), {recursive: true}); fs.writeFileSync(path.join(root, filename), 'original synthetic source\n')
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'synthetic baseline'); const baseSha = git('rev-parse', 'HEAD')
  fs.writeFileSync(path.join(root, filename), 'changed synthetic source\n'); edit(root, filename)
  git('add', '.'); git('commit', '-qm', 'synthetic candidate'); const candidateSha = git('rev-parse', 'HEAD'), blob = git('rev-parse', `${candidateSha}:${filename}`)
  return {root, filename, candidateSha, admission: {kind: 'ARCHITECTURE', baseSha, files: [{filename, sha: blob, status: 'modified'}]}, close: () => fs.rmSync(root, {recursive: true, force: true})}
}

test('pinned real Git checkout binds complete diff, actual blob and regular-file contents before credentials', () => {
  const f = checkoutFixture()
  try {
    assertArchitectureCheckout(f.root, f.candidateSha, f.admission)
    const {proof, run} = fixture(); proof.candidateSha = f.candidateSha; assertProof(proof, run, f.candidateSha, 34)
    rejection(() => assertArchitectureCheckout(f.root, f.candidateSha, {...f.admission, files: [{...f.admission.files[0], sha: 'd'.repeat(40)}]}))
    fs.appendFileSync(path.join(f.root, f.filename), 'uncommitted replacement')
    rejection(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission))
  } finally {f.close()}
})

test('pinned Git diff rejects a hidden consumer mutation omitted from the API list', () => {
  const f = checkoutFixture(root => {fs.mkdirSync(path.join(root, 'apps/sg-runtime'), {recursive: true}); fs.writeFileSync(path.join(root, 'apps/sg-runtime/protected.mjs'), 'synthetic')})
  try {assert.throws(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission), /ARCHITECTURE_DIFF_MISMATCH/)} finally {f.close()}
})

test('Architecture Git checkout rejects symlink source even when API blob SHA matches', () => {
  const f = checkoutFixture((root, filename) => {fs.unlinkSync(path.join(root, filename)); fs.symlinkSync('/synthetic-outside-not-read', path.join(root, filename))})
  try {assert.throws(() => assertArchitectureCheckout(f.root, f.candidateSha, f.admission), /ARCHITECTURE_CHECKOUT_REJECTED/)} finally {f.close()}
})

test('all new trusted routing inputs invalidate the policy fingerprint; no candidate source is executed to hash them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-policy-fingerprint-'))
  try {
    for (const name of CONTROL_POLICY_FILES) {fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true}); fs.copyFileSync(path.join(authorityRoot, name), path.join(root, name))}
    const before = controlPolicyDigest(root)
    for (const name of CONTROL_POLICY_FILES) {const file = path.join(root, name), original = fs.readFileSync(file); fs.appendFileSync(file, '\n'); assert.notEqual(controlPolicyDigest(root), before, name); fs.writeFileSync(file, original)}
  } finally {fs.rmSync(root, {recursive: true, force: true})}
})

test('workflow keeps main-only pinned controller, credential-free execution/proof and unchanged private installation phase', () => {
  const source = fs.readFileSync(path.join(authorityRoot, WORKFLOW), 'utf8'), privileged = source.slice(source.indexOf('  controlled-sg2:'), source.indexOf('  environment-policy-probe:'))
  assert.match(privileged, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(privileged, /environment: architecture-development/)
  assert.equal((privileged.match(/secrets\.SG2_PACKAGES_READ_TOKEN/g) ?? []).length, 1)
  const execute = privileged.slice(privileged.indexOf('      - name: Run lifecycle'), privileged.indexOf('      - name: Record sanitized'))
  for (const key of ['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN']) assert(execute.includes(`${key}: ''`))
  assert(!execute.includes('secrets.')); assert.match(privileged, /run: node control\/scripts\/governance\/controlled-package-ci.mjs proof/)
  assert(!privileged.includes('continue-on-error')); assert(!privileged.includes('pull_request_target'))
})

test('missing proof is rejected and proof command refuses a credential before reading candidate state', () => {
  const {run} = fixture()
  rejection(() => assertProof(undefined, run, other, 34))
  rejection(() => assertProof({}, run, other, 34))
  const result = spawnSync(process.execPath, [path.join(authorityRoot, 'scripts/governance/controlled-package-ci.mjs'), 'proof'], {encoding: 'utf8', env: {...process.env, NPM_TOKEN: 'synthetic-canary-no-authority', NODE_AUTH_TOKEN: '', GH_TOKEN: ''}})
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CREDENTIAL_PRESENT_IN_EXECUTION_PHASE/)
})

function readonlyMissCandidate() {
  const review=READONLY_MISS_REPORT_PRODUCER_REVIEW,p=pr()
  p.number=review.prNumber;p.head.ref=review.branch;p.head.sha=review.sourceSha;p.base.sha=sha
  const files=Object.entries(review.blobs).map(([filename,blob])=>({filename,status:'added',sha:blob}))
  p.changed_files=files.length
  return {p,files}
}
test('read-only MISS review is frozen and admits only the exact nine additive producer blobs',()=>{
  const review=READONLY_MISS_REPORT_PRODUCER_REVIEW,{p,files}=readonlyMissCandidate()
  assert(Object.isFrozen(review));assert(Object.isFrozen(review.blobs));assert.equal(files.length,9)
  assert.equal(review.prNumber,831);assert.equal(review.sourceSha,'b2b52c6a61ab3c3882f60ab5033670046715a5bc')
  assert.equal(review.branch,'architecture/current-fresh-miss-20261031')
  assert(files.every(f=>f.status==='added' && (f.filename.startsWith('packages/platform-contracts/readonly-miss-report/')
    || f.filename==='apps/architecture-lab/test/readonly-miss-report.test.mjs')))
  assert(!files.some(f=>f.filename.includes('/current-fresh-report/')))
  assertArchitectureFiles(p,files)
  assert.equal(selectCandidate(context(),p,review.sourceSha,{files}),review.sourceSha)
})
test('read-only MISS review refuses another PR, source SHA or internal branch even with matching caller metadata',()=>{
  for(const mutate of [p=>p.number++,p=>p.head.ref='architecture/another-candidate',p=>p.head.sha=other]){
    const {p,files}=readonlyMissCandidate();mutate(p)
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('read-only MISS review preserves trusted main, owner, repository and target fences',()=>{
  for(const mutate of [p=>p.user.login='attacker',p=>p.head.repo.full_name='profitia/fork',p=>p.base.repo.full_name='other/SG-dev',p=>p.base.ref='staging',p=>p.state='closed']){
    const {p,files}=readonlyMissCandidate();mutate(p)
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
  for(const change of [{ref:'refs/pull/831/merge'},{event:'pull_request_target'},{triggeringActor:'attacker'},{workflowRef:REPOSITORY+'/'+WORKFLOW+'@refs/heads/untrusted'}]){
    const {p,files}=readonlyMissCandidate()
    rejection(()=>selectCandidate({...context(),...change},p,p.head.sha,{files}))
  }
})
test('read-only MISS review rejects omitted, extra, duplicate, modified, renamed and substituted blobs',()=>{
  for(const mutate of [files=>files.pop(),files=>files.push({filename:'packages/platform-contracts/src/extra.mjs',status:'added',sha}),
    files=>files[0]={...files[1]},files=>files[0].status='modified',files=>files[0].previous_filename='other.mjs',files=>files[0].sha=other]){
    const {p,files}=readonlyMissCandidate();mutate(files);p.changed_files=files.length
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('read-only MISS admission cannot include old FRESH, SDK, product, workflow or registry mutations',()=>{
  for(const filename of ['packages/platform-contracts/current-fresh-report/package.json','packages/platform-contracts/src/operation-context.mjs',
    'apps/srm/operation-integration.json','apps/sg-runtime/package.json',WORKFLOW,'Canon/registries/profitia-projects-v1.json']){
    const {p,files}=readonlyMissCandidate();files[0]={filename,status:'modified',sha}
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('read-only MISS API resolution binds the complete exact file list and rechecks candidate metadata',async()=>{
  const {p,files}=readonlyMissCandidate(),calls=[]
  const request=async endpoint=>{calls.push(endpoint);return {data:structuredClone(endpoint.includes('/files?')?files:p)}}
  const resolved=await resolveCandidateAdmission(context(),'831',p.head.sha,request)
  assert.equal(resolved.sha,p.head.sha);assert.deepEqual(resolved.admission.files,files);assert.equal(calls.length,3)
  let reads=0
  const changing=async endpoint=>{
    if(endpoint.includes('/files?'))return {data:structuredClone(files)}
    const value=structuredClone(p);if(++reads===2)value.base.sha=other
    return {data:value}
  }
  await assert.rejects(resolveCandidateAdmission(context(),'831',p.head.sha,changing),/CANDIDATE_CHANGED_DURING_RESOLUTION/)
})

function freshTeardownCandidate() {
 const review=FRESH_FIXTURE_TEARDOWN_REVIEW,p=pr()
 p.number=review.prNumber;p.head.ref=review.branch;p.head.sha=review.sourceSha;p.base.sha=sha
 const files=Object.entries(review.blobs).map(([filename,blob])=>({filename,status:'modified',sha:blob}))
 p.changed_files=files.length;return {p,files}
}
test('FRESH fixture teardown admits only the exact three modified test/support blobs',()=>{
 const review=FRESH_FIXTURE_TEARDOWN_REVIEW,{p,files}=freshTeardownCandidate()
 assert(Object.isFrozen(review));assert(Object.isFrozen(review.blobs));assert.equal(files.length,3)
 assert.equal(review.prNumber,843);assert.equal(review.sourceSha,'a709995993176d79ab8bdf7874f6c14e1ee0028d')
 assert.deepEqual(files.map(f=>f.filename).sort(),[
  'apps/architecture-lab/src/operation-postgres-fixture.mjs',
  'packages/platform-contracts/current-fresh-report/test/current-fresh-report-postgres.test.mjs',
  'packages/platform-contracts/readonly-miss-report/test/readonly-miss-report-postgres.test.mjs'])
 assertArchitectureFiles(p,files);assert.equal(selectCandidate(context(),p,p.head.sha,{files}),p.head.sha)
})
test('FRESH fixture teardown refuses another PR, branch or source SHA',()=>{
 for(const mutate of[p=>p.number++,p=>p.head.ref='architecture/another-fixture',p=>p.head.sha=other]){
  const {p,files}=freshTeardownCandidate();mutate(p);rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
 }
})
test('FRESH fixture teardown retains main workflow, owner, repository and target fences',()=>{
 for(const mutate of[p=>p.user.login='attacker',p=>p.head.repo.full_name='profitia/fork',p=>p.base.repo.full_name='other/SG-dev',p=>p.base.ref='staging',p=>p.state='closed']){
  const {p,files}=freshTeardownCandidate();mutate(p);rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
 }
 for(const change of[{ref:'refs/pull/843/merge'},{event:'pull_request_target'},{triggeringActor:'attacker'}]){
  const {p,files}=freshTeardownCandidate();rejection(()=>selectCandidate({...context(),...change},p,p.head.sha,{files}))
 }
})
test('FRESH fixture teardown rejects omissions, additions, duplicates, renamed or substituted blobs and statuses',()=>{
 for(const mutate of[files=>files.pop(),files=>files.push({filename:'packages/platform-contracts/src/extra.mjs',status:'modified',sha}),
  files=>files[0]={...files[1]},files=>files[0].status='added',files=>files[0].status='removed',
  files=>files[0].previous_filename='other.mjs',files=>files[0].sha=other]){
  const {p,files}=freshTeardownCandidate();mutate(files);p.changed_files=files.length
  rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
 }
})
test('FRESH fixture teardown cannot admit a runtime, schema, app, workflow, package policy or registry substitution',()=>{
 for(const filename of['packages/platform-contracts/current-fresh-report/src/current-fresh-report.mjs',
  'packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/migrations/access/007-delegated-jobs.sql',
  'apps/srm/operation-integration.json','apps/sg-runtime/package.json',WORKFLOW,
  'scripts/governance/controlled-package-ci.mjs','Canon/registries/profitia-projects-v1.json']){
  const {p,files}=freshTeardownCandidate();files[0]={filename,status:'modified',sha}
  rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
 }
})
test('FRESH fixture API admission rechecks complete file metadata before checkout',async()=>{
 const {p,files}=freshTeardownCandidate(),calls=[]
 const request=async endpoint=>{calls.push(endpoint);return{data:structuredClone(endpoint.includes('/files?')?files:p)}}
 const result=await resolveCandidateAdmission(context(),'843',p.head.sha,request)
 assert.equal(result.sha,p.head.sha);assert.deepEqual(result.admission.files,files);assert.equal(calls.length,3)
})

function rootAtomicClaimCandidate() {
  const review=ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW,p=pr()
  p.number=review.prNumber;p.head.ref=review.branch;p.head.sha=review.sourceSha;p.base.sha=sha
  const files=Object.entries(review.blobs).map(([filename,blob])=>({filename,status:'added',sha:blob}))
  p.changed_files=files.length
  return {p,files}
}
test('atomic Root claim review is frozen and admits only the exact eleven additive producer blobs',()=>{
  const review=ROOT_ATOMIC_CLAIM_PRODUCER_REVIEW,{p,files}=rootAtomicClaimCandidate()
  assert(Object.isFrozen(review));assert(Object.isFrozen(review.blobs));assert.equal(files.length,11)
  assert.equal(review.prNumber,854);assert.equal(review.sourceSha,'3a494b5432555935168c060be5950589d550d276')
  assert.equal(review.branch,'architecture/root-atomic-claim-producer-20261101')
  assert(files.every(f=>f.status==='added' && (f.filename.startsWith('packages/platform-contracts/root-atomic-claim/')
    || f.filename==='apps/architecture-lab/test/root-atomic-claim.test.mjs')))
  assert(!files.some(f=>f.filename.includes('/current-fresh-report/')))
  assertArchitectureFiles(p,files)
  assert.equal(selectCandidate(context(),p,review.sourceSha,{files}),review.sourceSha)
})
test('atomic Root claim review refuses another PR, source SHA or internal branch even with matching caller metadata',()=>{
  for(const mutate of [p=>p.number++,p=>p.head.ref='architecture/another-candidate',p=>p.head.sha=other]){
    const {p,files}=rootAtomicClaimCandidate();mutate(p)
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('atomic Root claim review preserves trusted main, owner, repository and target fences',()=>{
  for(const mutate of [p=>p.user.login='attacker',p=>p.head.repo.full_name='profitia/fork',p=>p.base.repo.full_name='other/SG-dev',p=>p.base.ref='staging',p=>p.state='closed']){
    const {p,files}=rootAtomicClaimCandidate();mutate(p)
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
  for(const change of [{ref:'refs/pull/854/merge'},{event:'pull_request_target'},{triggeringActor:'attacker'},{workflowRef:REPOSITORY+'/'+WORKFLOW+'@refs/heads/untrusted'}]){
    const {p,files}=rootAtomicClaimCandidate()
    rejection(()=>selectCandidate({...context(),...change},p,p.head.sha,{files}))
  }
})
test('atomic Root claim review rejects omitted, extra, duplicate, modified, renamed and substituted blobs',()=>{
  for(const mutate of [files=>files.pop(),files=>files.push({filename:'packages/platform-contracts/src/extra.mjs',status:'added',sha}),
    files=>files[0]={...files[1]},files=>files[0].status='modified',files=>files[0].previous_filename='other.mjs',files=>files[0].sha=other]){
    const {p,files}=rootAtomicClaimCandidate();mutate(files);p.changed_files=files.length
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('atomic Root claim admission cannot include old FRESH, SDK, product, workflow or registry mutations',()=>{
  for(const filename of ['packages/platform-contracts/current-fresh-report/package.json','packages/platform-contracts/src/operation-context.mjs',
    'apps/srm/operation-integration.json','apps/sg-runtime/package.json',WORKFLOW,'Canon/registries/profitia-projects-v1.json']){
    const {p,files}=rootAtomicClaimCandidate();files[0]={filename,status:'modified',sha}
    rejection(()=>selectCandidate(context(),p,p.head.sha,{files}))
  }
})
test('atomic Root claim API resolution binds the complete exact file list and rechecks candidate metadata',async()=>{
  const {p,files}=rootAtomicClaimCandidate(),calls=[]
  const request=async endpoint=>{calls.push(endpoint);return {data:structuredClone(endpoint.includes('/files?')?files:p)}}
  const resolved=await resolveCandidateAdmission(context(),'854',p.head.sha,request)
  assert.equal(resolved.sha,p.head.sha);assert.deepEqual(resolved.admission.files,files);assert.equal(calls.length,3)
  let reads=0
  const changing=async endpoint=>{
    if(endpoint.includes('/files?'))return {data:structuredClone(files)}
    const value=structuredClone(p);if(++reads===2)value.base.sha=other
    return {data:value}
  }
  await assert.rejects(resolveCandidateAdmission(context(),'854',p.head.sha,changing),/CANDIDATE_CHANGED_DURING_RESOLUTION/)
})

test('atomic Root claim review rejects substitution at every pinned producer blob',()=>{
 for(let i=0;i<11;i++)for(const field of ['sha','status','filename']){
  const {p,files}=rootAtomicClaimCandidate();files[i][field]=field==='sha'?'f'.repeat(40):field==='status'?'modified':files[i].filename+'.extra';
  rejection(()=>selectCandidate(context(),p,p.head.sha,{files}));
 }
})

import {NEWSFEED_G1_GOVERNANCE_REVIEW} from './controlled-package-ci.mjs'

const newsfeedG1ReviewFiles = () => Object.entries(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:'modified'}))
const newsfeedG1ReviewPr = () => ({...architecturePr(10),number:NEWSFEED_G1_GOVERNANCE_REVIEW.prNumber,head:{...architecturePr().head,ref:NEWSFEED_G1_GOVERNANCE_REVIEW.branch}})

test('Newsfeed G1 admission binds only the ten frozen blobs of PR872 and its exact branch',()=>{
 assert(Object.isFrozen(NEWSFEED_G1_GOVERNANCE_REVIEW));assert(Object.isFrozen(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs))
 assert.equal(NEWSFEED_G1_GOVERNANCE_REVIEW.prNumber,872);assert.equal(NEWSFEED_G1_GOVERNANCE_REVIEW.sourceSha,'d7c425651faa354a21bf20c4679e12345365b6be')
 assert.equal(Object.keys(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs).length,10)
 assert(!Object.keys(NEWSFEED_G1_GOVERNANCE_REVIEW.blobs).some(n=>n.startsWith('apps/')||n.startsWith('packages/')||n.startsWith('.github/')))
 const files=newsfeedG1ReviewFiles(),p=newsfeedG1ReviewPr()
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 assert.equal(selectCandidate(context(),p,other,{files:files.map(f=>({...f,status:'added'}))}),other)
 for(const delta of [{number:873},{number:undefined},{head:{...p.head,ref:'architecture/another-review'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...delta},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('Newsfeed G1 review refuses changed blobs, missing/extra/duplicate files, deletion and rename',()=>{
 const original=newsfeedG1ReviewFiles()
 for(let i=0;i<original.length;i++){
  const incomplete=original.filter((_,j)=>i!==j);rejection(()=>selectCandidate(context(),{...newsfeedG1ReviewPr(),changed_files:incomplete.length},other,{files:incomplete}))
  for(const patch of [{sha:'d'.repeat(40)},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename},{sha:'forged'}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),newsfeedG1ReviewPr(),other,{files}))
  }
  const files=original.map((f,j)=>i===j?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),newsfeedG1ReviewPr(),other,{files}))
 }
 for(const name of ['apps/sg-runtime/package.json','apps/newsfeed-runtime/src/server.ts','packages/platform-contracts/src/operation-context.mjs',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-27-extra.md']){
  const files=[...original,producerFile(name)];rejection(()=>selectCandidate(context(),{...newsfeedG1ReviewPr(),changed_files:files.length},other,{files}))
  const replaced=[...original];replaced[0]=producerFile(name);rejection(()=>selectCandidate(context(),newsfeedG1ReviewPr(),other,{files:replaced}))
 }
})

test('Newsfeed G1 review preserves trusted actor/repository/main and current owner routing fences',()=>{
 const files=newsfeedG1ReviewFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='staging',p=>p.state='closed']){const p=newsfeedG1ReviewPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},newsfeedG1ReviewPr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/architecture/untrusted'},newsfeedG1ReviewPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'));Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),newsfeedG1ReviewPr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('Newsfeed G1 review uses complete API pagination and metadata race fencing before fixed Git checks',async()=>{
 const files=newsfeedG1ReviewFiles(),candidate=newsfeedG1ReviewPr(),result=await resolveCandidateAdmission(context(),'872',other,apiFixture(candidate,files).request)
 assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
 for(const after of [{...candidate,head:{...candidate.head,sha}},{...candidate,base:{...candidate.base,sha:other}},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}])await assert.rejects(resolveCandidateAdmission(context(),'872',other,apiFixture(candidate,files,after).request))
 await assert.rejects(resolveCandidateAdmission(context(),'872',other,apiFixture(candidate,files.slice(1)).request))
})

import {SOURCE_HUB_G1_GOVERNANCE_REVIEW} from './controlled-package-ci.mjs'

const sourceHubG1ReviewFiles = () => Object.entries(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:SOURCE_HUB_G1_GOVERNANCE_REVIEW.statuses[filename]}))
const sourceHubG1ReviewPr = () => ({...architecturePr(14),number:SOURCE_HUB_G1_GOVERNANCE_REVIEW.prNumber,head:{...architecturePr().head,ref:SOURCE_HUB_G1_GOVERNANCE_REVIEW.branch}})

test('Source Hub G1 admission binds only the fourteen frozen blobs of PR878 and its exact branch',()=>{
 assert(Object.isFrozen(SOURCE_HUB_G1_GOVERNANCE_REVIEW));assert(Object.isFrozen(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs))
 assert.equal(SOURCE_HUB_G1_GOVERNANCE_REVIEW.prNumber,878);assert.equal(SOURCE_HUB_G1_GOVERNANCE_REVIEW.sourceSha,'aef76dd768aa52b0fe0f17349cb1c972d6c67eae')
 assert.equal(Object.keys(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs).length,14)
 assert(!Object.keys(SOURCE_HUB_G1_GOVERNANCE_REVIEW.blobs).some(n=>n.startsWith('apps/')||n.startsWith('packages/')||n.startsWith('.github/')))
 const files=sourceHubG1ReviewFiles(),p=sourceHubG1ReviewPr()
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 for(const delta of [{number:879},{number:undefined},{head:{...p.head,ref:'architecture/another-review'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...delta},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('Source Hub G1 review refuses changed blobs, missing/extra/duplicate files, deletion and rename',()=>{
 const original=sourceHubG1ReviewFiles()
 for(let i=0;i<original.length;i++){
  const incomplete=original.filter((_,j)=>i!==j);rejection(()=>selectCandidate(context(),{...sourceHubG1ReviewPr(),changed_files:incomplete.length},other,{files:incomplete}))
  for(const patch of [{sha:'d'.repeat(40)},{status:original[i].status==='added'?'modified':'added'},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename},{sha:'forged'}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),sourceHubG1ReviewPr(),other,{files}))
  }
  const files=original.map((f,j)=>i===j?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),sourceHubG1ReviewPr(),other,{files}))
 }
 for(const name of ['apps/sg-runtime/package.json','apps/newsfeed-runtime/src/server.ts','packages/platform-contracts/src/operation-context.mjs',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-10-27-extra.md']){
  const files=[...original,producerFile(name)];rejection(()=>selectCandidate(context(),{...sourceHubG1ReviewPr(),changed_files:files.length},other,{files}))
  const replaced=[...original];replaced[0]=producerFile(name);rejection(()=>selectCandidate(context(),sourceHubG1ReviewPr(),other,{files:replaced}))
 }
})

test('Source Hub G1 review preserves trusted actor/repository/main and current owner routing fences',()=>{
 const files=sourceHubG1ReviewFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='staging',p=>p.state='closed']){const p=sourceHubG1ReviewPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},sourceHubG1ReviewPr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/architecture/untrusted'},sourceHubG1ReviewPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'));Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),sourceHubG1ReviewPr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('Source Hub G1 review uses complete API pagination and metadata race fencing before fixed Git checks',async()=>{
 const files=sourceHubG1ReviewFiles(),candidate=sourceHubG1ReviewPr(),result=await resolveCandidateAdmission(context(),'878',other,apiFixture(candidate,files).request)
 assert.equal(result.sha,other);assert.deepEqual(result.admission.files,files)
 for(const after of [{...candidate,head:{...candidate.head,sha}},{...candidate,base:{...candidate.base,sha:other}},{...candidate,head:{...candidate.head,ref:'architecture/replaced'}}])await assert.rejects(resolveCandidateAdmission(context(),'878',other,apiFixture(candidate,files,after).request))
 await assert.rejects(resolveCandidateAdmission(context(),'878',other,apiFixture(candidate,files.slice(1)).request))
})

const sourceHubStage2aFiles=()=>Object.entries(SOURCE_HUB_STAGE2A_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:SOURCE_HUB_STAGE2A_REVIEW.statuses[filename]}))
const sourceHubStage2aPr=()=>({...pr(),number:885,changed_files:sourceHubStage2aFiles().length,base:{...pr().base,sha:SOURCE_HUB_STAGE2A_REVIEW.reviewedBaseSha},head:{...pr().head,sha:SOURCE_HUB_STAGE2A_REVIEW.reviewedCandidateSha,ref:SOURCE_HUB_STAGE2A_REVIEW.branch}})
test('Stage2A closed review admits the exact mixed-owner source and retains PR identity fences',()=>{
 const p=sourceHubStage2aPr(),files=sourceHubStage2aFiles()
 assert.equal(selectCandidate(context(),p,p.head.sha,{files}),p.head.sha)
 for(const mutate of [p=>p.number=886,p=>p.head.ref='architecture/other',p=>p.user.login='other',p=>p.head.repo.full_name='other/SG-dev']){
  const q=structuredClone(p);mutate(q);rejection(()=>selectCandidate(context(),q,q.head.sha,{files}))
 }
})
test('Stage2A closed review rejects changed, missing, additional, duplicate, renamed or differently classified blobs',()=>{
 const p=sourceHubStage2aPr()
 for(const mutate of [f=>f[0].sha='0'.repeat(40),f=>f.pop(),f=>f.push({...f[0],filename:'apps/sg-runtime/app/unreviewed.ts'}),f=>f.push({...f[0]}),f=>f[0].previous_filename='old',f=>f[0].status='removed']){
  const files=sourceHubStage2aFiles();mutate(files);const q={...p,changed_files:files.length}
  rejection(()=>selectCandidate(context(),q,q.head.sha,{files}))
 }
})
test('Maps peer transition needs exact source, a pinned admission and matching lock metadata',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'stage2a-peer-transition-')),candidateRoot=path.join(temporary,'candidate'),authorityRoot=path.join(temporary,'authority')
 try{
  const relative=LOCAL_PACKAGES['@profitia/maps-embed'],candidateApp=path.join(candidateRoot,'apps/sg-runtime'),authorityApp=path.join(authorityRoot,'apps/sg-runtime')
  fs.mkdirSync(candidateApp,{recursive:true});fs.mkdirSync(authorityApp,{recursive:true})
  const from=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../packages/maps-embed/package.json'),original=fs.readFileSync(from,'utf8')
  // Exercise the same frozen candidate before and after its separate main acceptance.
  const installedRange=JSON.parse(original).peerDependencies['@profitia/platform-contracts']
  const priorRange=installedRange.replace(/ \|\| 1\.34\.0$/,'')
  const reviewedRange=priorRange.endsWith(' || 1.33.0')?priorRange:priorRange+' || 1.33.0'
  const bytes=Buffer.from(original.replace(JSON.stringify(installedRange),JSON.stringify(reviewedRange))),manifest=JSON.parse(bytes)
  const target=path.resolve(candidateApp,relative,'package.json'),trusted=path.resolve(authorityApp,relative,'package.json')
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.mkdirSync(path.dirname(trusted),{recursive:true});fs.writeFileSync(target,bytes)
  const previous=structuredClone(manifest);previous.peerDependencies['@profitia/platform-contracts']=previous.peerDependencies['@profitia/platform-contracts'].replace(/ \|\| 1\.33\.0$/,'')
  fs.writeFileSync(trusted,JSON.stringify(previous))
  const candidate={packages:{'node_modules/@profitia/maps-embed':{version:manifest.version,resolved:'file:'+relative,peerDependencies:manifest.peerDependencies}}}
  rejection(()=>assertLocalPackageSources(candidateRoot,candidate,authorityRoot))
  assertLocalPackageSources(candidateRoot,candidate,authorityRoot,{reviewedStage2a:true})
  assertLocalPackageSources(candidateRoot,candidate,candidateRoot)
  const inconsistent=structuredClone(candidate);inconsistent.packages['node_modules/@profitia/maps-embed'].peerDependencies=previous.peerDependencies
  rejection(()=>assertLocalPackageSources(candidateRoot,inconsistent,authorityRoot,{reviewedStage2a:true}))
  fs.writeFileSync(target,JSON.stringify({...manifest,unreviewed:true}));rejection(()=>assertLocalPackageSources(candidateRoot,candidate,authorityRoot,{reviewedStage2a:true}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})

test('test-only reconciliation preserves all115 other reviewed blobs and every status, mode and owner route',()=>{
 const corrected={"apps/architecture-lab/test/sdk-compatibility.test.mjs": "1616eb2591d3e6ccd0c68e595f81fe8a16733e84", "apps/sg-runtime/operation-integration.json": "0e494a92f1c0bb151ade7866c2fbc7b0afd2753d", "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx": "2bebee2a9a87d669a597463d0ae4afcccb171382", "apps/sg-runtime/tests/category-operation.test.ts": "249ad2982f8f61dabef235393699f4c52837ecd8", "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs": "21953cf04a3c1fa0936b4c960757abadc821bbaf", "apps/sg-runtime/tests/identity-runtime.test.ts": "04a365354295640963fb93e559c070ce1a2fdc51", "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs": "88f2fbd8d3aa4a7f9dd77bc5433559911019b231", "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs": "24916132ff4bef7c656a602443b8ccd189cebc4d", "apps/sg-runtime/tests/operation-context.test.mjs": "4aacdbd1b70d777a9d6b8d94c10306337d1fb266", "apps/sg-runtime/tests/pci-smart-integrity.mjs": "684a069d0b32c0fee69fc20ec887ab80edb88919", "apps/sg-runtime/tests/pci-smart-integrity.test.mjs": "a646a1df74b845f27da1b792daae6aad09129b55", "apps/sg-runtime/tests/porr-demo-middleware.test.ts": "271825c3cdbd1699b5335a84ca5646a69d2c3cff", "apps/sg-runtime/tests/self-service-account.test.ts": "9143c04a7f6f426f14e758c3174fbe4de075874c", "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs": "1f28a8bb6c7af42b0618fa5c71a83781a98eab16", "apps/sg-runtime/tests/xray-gateway.test.ts": "8339797a56609cde7e4944e95542df440b2ac0be", "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs": "c477d38bcb9f1d067bfa10e4699fd0ec140c96b3"}
 const stableHash=value=>createHash('sha256').update(JSON.stringify(Object.keys(value).sort().map(key=>[key,value[key]]))).digest('hex')
 assert.equal(Object.keys(SOURCE_HUB_STAGE2A_REVIEW.blobs).length,131)
 for(const [file,prior]of Object.entries(corrected))assert.notEqual(SOURCE_HUB_STAGE2A_REVIEW.blobs[file],prior,file)
 assert.equal(stableHash({...SOURCE_HUB_STAGE2A_REVIEW.blobs,...corrected}),"a23420b718a11a26a9bec8ed4e84700971cf36b48da8aac2a68a2a96378e7292")
 assert.equal(stableHash(SOURCE_HUB_STAGE2A_REVIEW.statuses),"29cb126ce19de461cc827c6ff32a6178ec8be26cb2195f92b370ae55803d7336")
 assert.equal(stableHash(SOURCE_HUB_STAGE2A_REVIEW.modes),"217ec78117be5de638851910a7554f455dd0d22411c69c11814bb5c6c404d7f0")
 assert.equal(stableHash(SOURCE_HUB_STAGE2A_REVIEW.routes),"98a7cc0f331554c2c07b1e51ad3aff91bad8727bb45b6f5d812214241456bd5b")
})

const currentE1Files=()=>Object.entries(SOURCE_HUB_CURRENT_E1_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:SOURCE_HUB_CURRENT_E1_REVIEW.statuses[filename]}));
const currentE1Pr=()=>({...pr(),number:897,changed_files:31,base:{...pr().base,sha:SOURCE_HUB_CURRENT_E1_REVIEW.reviewedBaseSha},head:{...pr().head,sha:SOURCE_HUB_CURRENT_E1_REVIEW.reviewedCandidateSha,ref:SOURCE_HUB_CURRENT_E1_REVIEW.branch}});
test('current E1 review admits only the exact 31 owner-routed file versions of PR897',()=>{
 const p=currentE1Pr(),files=currentE1Files();assert.equal(files.length,31);assertArchitectureFiles(p,files);assert.equal(selectCandidate(context(),p,p.head.sha,{files}),p.head.sha);
 for(const edit of[fs=>fs.pop(),fs=>fs.push({...fs[0],filename:'apps/identity-runtime/src/unreviewed.ts'}),fs=>fs[0].sha=sha,fs=>fs[0].status='removed',fs=>fs[0].previous_filename='renamed',fs=>fs[0].filename='packages/platform-contracts/current-e1-authority/unreviewed.mjs',fs=>fs[1]={...fs[0]}]){const changed=structuredClone(files);edit(changed);rejection(()=>assertArchitectureFiles({...p,changed_files:changed.length},changed));}
});
test('current E1 review retains exact PR, branch, owner, repository and candidate SHA fences',()=>{
 for(const edit of[p=>p.number=898,p=>p.head.ref='architecture/unreviewed-e1',p=>p.head.repo.full_name='profitia/fork',p=>p.user.login='other-owner',p=>p.base.ref='staging',p=>p.head.sha=sha]){const p=currentE1Pr();edit(p);rejection(()=>selectCandidate(context(),p,SOURCE_HUB_CURRENT_E1_REVIEW.reviewedCandidateSha,{files:currentE1Files()}));}
 const refreshed=currentE1Pr();refreshed.head.sha=other;assert.equal(selectCandidate(context(),refreshed,other,{files:currentE1Files()}),other,'Main refresh may retain only identical reviewed file bytes');
});
test('current E1 review denies executable and symlink modes and altered tree entries',()=>{
 for(const file of currentE1Files()){const entry='100644 blob '+file.sha+'\t'+file.filename+'\0';assertCurrentE1ReviewEntry(file,entry);for(const bad of[entry.replace('100644','100755'),entry.replace('100644','120000'),entry.replace(file.sha,sha),entry.replace(file.filename,file.filename+'.extra'),''])rejection(()=>assertCurrentE1ReviewEntry(file,bad));}
});

const universalFiles=()=>Object.entries(SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.statuses[filename]}));
const universalPr=()=>({...pr(),number:904,changed_files:39,base:{...pr().base,sha:SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.reviewedBaseSha},head:{...pr().head,sha:SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.reviewedCandidateSha,ref:SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.branch}});
test('universal first-party review admits only the exact 39 owner-routed file versions of PR904',()=>{
 const p=universalPr(),files=universalFiles();assert.equal(files.length,39);assertArchitectureFiles(p,files);assert.equal(selectCandidate(context(),p,p.head.sha,{files}),p.head.sha);
 for(const edit of[fs=>fs.pop(),fs=>fs.push({...fs[0],filename:'apps/identity-runtime/src/unreviewed.ts'}),fs=>fs[0].sha=sha,fs=>fs[0].status='removed',fs=>fs[0].previous_filename='renamed',fs=>fs[0].filename='packages/platform-contracts/current-e1-authority/unreviewed.mjs',fs=>fs[1]={...fs[0]}]){const changed=structuredClone(files);edit(changed);rejection(()=>assertArchitectureFiles({...p,changed_files:changed.length},changed));}
});
test('universal first-party review retains exact PR, branch, owner, repository and candidate SHA fences',()=>{
 for(const edit of[p=>p.number=905,p=>p.head.ref='architecture/unreviewed-universal',p=>p.head.repo.full_name='profitia/fork',p=>p.user.login='other-owner',p=>p.base.ref='staging',p=>p.head.sha=sha]){const p=universalPr();edit(p);rejection(()=>selectCandidate(context(),p,SOURCE_HUB_UNIVERSAL_FIRST_PARTY_REVIEW.reviewedCandidateSha,{files:universalFiles()}));}
 const refreshed=universalPr();refreshed.head.sha=other;assert.equal(selectCandidate(context(),refreshed,other,{files:universalFiles()}),other,'Main refresh may retain only identical reviewed file bytes');
});
test('universal first-party review denies executable and symlink modes and altered tree entries',()=>{
 for(const file of universalFiles()){const entry='100644 blob '+file.sha+'\t'+file.filename+'\0';assertUniversalFirstPartyReviewEntry(file,entry);for(const bad of[entry.replace('100644','100755'),entry.replace('100644','120000'),entry.replace(file.sha,sha),entry.replace(file.filename,file.filename+'.extra'),''])rejection(()=>assertUniversalFirstPartyReviewEntry(file,bad));}
});

const ecrG1Files=()=>Object.entries(ECR_G1_GOVERNANCE_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:ECR_G1_GOVERNANCE_REVIEW.statuses[filename]}))
const ecrG1Pr=()=>({...architecturePr(12),number:906,head:{...architecturePr().head,ref:ECR_G1_GOVERNANCE_REVIEW.branch}})

test('ECR G1 admission is one frozen twelve-file review and preserves the exact PR/branch/current-head fence',()=>{
 const r=ECR_G1_GOVERNANCE_REVIEW,files=ecrG1Files(),p=ecrG1Pr()
 for(const part of [r,r.blobs,r.statuses,r.modes])assert(Object.isFrozen(part))
 assert.equal(r.prNumber,906);assert.equal(r.reviewedCandidateSha,'253bdbd0f445914e2f964d42cd2206de093cb460')
 assert.equal(files.length,12);assert(files.every(f=>!f.filename.startsWith('apps/')&&!f.filename.startsWith('packages/')))
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 for(const change of [{number:907},{number:undefined},{head:{...p.head,ref:'architecture/ecr-other'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...change},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('ECR closed admission rejects every changed/missing/duplicate/status/rename/copy/deletion entry and any extra scope',()=>{
 const original=ecrG1Files()
 for(let i=0;i<original.length;i++){
  const missing=original.filter((_,j)=>j!==i);rejection(()=>selectCandidate(context(),{...ecrG1Pr(),changed_files:missing.length},other,{files:missing}))
  for(const patch of [{sha:'d'.repeat(40)},{sha:'invalid'},{status:original[i].status==='added'?'modified':'added'},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),ecrG1Pr(),other,{files}))
  }
  const duplicate=original.map((f,j)=>j===i?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),ecrG1Pr(),other,{files:duplicate}))
 }
 for(const filename of ['apps/economic-calendar-runtime/src/main.mjs','packages/economic-calendar-contracts/index.mjs','.github/workflows/economic-calendar-ci.yml',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-11-06-extra.md']){
  const files=[...original,producerFile(filename)];rejection(()=>selectCandidate(context(),{...ecrG1Pr(),changed_files:files.length},other,{files}))
 }
})

test('ECR exact review admits only regular nonexecutable pinned files',()=>{
 const r=ECR_G1_GOVERNANCE_REVIEW
 for(const file of ecrG1Files()){
  assert.equal(r.modes[file.filename],'100644')
  assertEcrG1ReviewEntry(file,'100644 blob '+file.sha+'\t'+file.filename+'\0')
  for(const mode of ['100755','120000','160000'])rejection(()=>assertEcrG1ReviewEntry(file,mode+' blob '+file.sha+'\t'+file.filename+'\0'))
  rejection(()=>assertEcrG1ReviewEntry({...file,sha:other},'100644 blob '+file.sha+'\t'+file.filename+'\0'))
 }
})

test('ECR review retains actual-owner routing and trusted account/repository/main/environment rules',()=>{
 const files=ecrG1Files()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='production',p=>p.state='closed']){const p=ecrG1Pr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},ecrG1Pr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/sg2/untrusted-control'},ecrG1Pr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.pathPatterns.includes('Canon/**'));Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),ecrG1Pr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('ECR complete API metadata resolution rejects file truncation and concurrent head/base movement',async()=>{
 const p=ecrG1Pr(),files=ecrG1Files(),answer=await resolveCandidateAdmission(context(),'906',other,apiFixture(p,files).request)
 assert.equal(answer.sha,other);assert.deepEqual(answer.admission.files,files)
 await assert.rejects(resolveCandidateAdmission(context(),'906',other,apiFixture(p,files.slice(1)).request))
 for(const after of [{...p,head:{...p.head,sha}},{...p,base:{...p.base,sha:other}},{...p,head:{...p.head,ref:'architecture/changed'}}])await assert.rejects(resolveCandidateAdmission(context(),'906',other,apiFixture(p,files,after).request))
})

const ecrBackendFiles=()=>Object.entries(ECR_BACKEND_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:ECR_BACKEND_REVIEW.statuses[filename]}))
const ecrBackendPr=()=>({...architecturePr(44),number:908,head:{...architecturePr().head,ref:ECR_BACKEND_REVIEW.branch}})

test('ECR backend admission is one frozen forty-four-file review and preserves the exact PR/branch/current-head fence',()=>{
 const r=ECR_BACKEND_REVIEW,files=ecrBackendFiles(),p=ecrBackendPr()
 for(const part of [r,r.blobs,r.statuses,r.modes])assert(Object.isFrozen(part))
 assert.equal(r.prNumber,908);assert.equal(r.reviewedCandidateSha,'253e20369fcd26f1985fc14188fd3e7f927a8faa')
 assert.equal(files.length,44);assert(files.some(f=>f.filename==='apps/economic-calendar-runtime/src/main.mjs'));assert(files.some(f=>f.filename==='scripts/governance/platform-source-hub-foundation.test.mjs'))
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),p,other,{files:[...files].reverse()}),other)
 for(const change of [{number:909},{number:undefined},{head:{...p.head,ref:'architecture/ecr-other'}},{head:{...p.head,sha}}])rejection(()=>selectCandidate(context(),{...p,...change},other,{files}))
 rejection(()=>selectCandidate(context(),p,sha,{files}))
})

test('ECR closed admission rejects every changed/missing/duplicate/status/rename/copy/deletion entry and any extra scope',()=>{
 const original=ecrBackendFiles()
 for(let i=0;i<original.length;i++){
  const missing=original.filter((_,j)=>j!==i);rejection(()=>selectCandidate(context(),{...ecrBackendPr(),changed_files:missing.length},other,{files:missing}))
  for(const patch of [{sha:'d'.repeat(40)},{sha:'invalid'},{status:original[i].status==='added'?'modified':'added'},{status:'removed'},{status:'renamed',previous_filename:original[i].filename},{status:'copied'},{previous_filename:original[i].filename}]){
   const files=original.map((f,j)=>i===j?{...f,...patch}:f);rejection(()=>selectCandidate(context(),ecrBackendPr(),other,{files}))
  }
  const duplicate=original.map((f,j)=>j===i?original[(i+1)%original.length]:f);rejection(()=>selectCandidate(context(),ecrBackendPr(),other,{files:duplicate}))
 }
 for(const filename of ['apps/economic-calendar-runtime/src/main.mjs','packages/economic-calendar-contracts/index.mjs','.github/workflows/economic-calendar-ci.yml',WORKFLOW,'scripts/governance/controlled-package-ci.mjs','.npmrc','Canon/evidence/2026-11-06-extra.md']){
  const files=[...original,producerFile(filename)];rejection(()=>selectCandidate(context(),{...ecrBackendPr(),changed_files:files.length},other,{files}))
 }
})

test('ECR exact review admits only regular nonexecutable pinned files',()=>{
 const r=ECR_BACKEND_REVIEW
 for(const file of ecrBackendFiles()){
  assert.equal(r.modes[file.filename],'100644')
  assertEcrBackendReviewEntry(file,'100644 blob '+file.sha+'\t'+file.filename+'\0')
  for(const mode of ['100755','120000','160000'])rejection(()=>assertEcrBackendReviewEntry(file,mode+' blob '+file.sha+'\t'+file.filename+'\0'))
  rejection(()=>assertEcrBackendReviewEntry({...file,sha:other},'100644 blob '+file.sha+'\t'+file.filename+'\0'))
 }
})

test('ECR review retains actual-owner routing and trusted account/repository/main/environment rules',()=>{
 const files=ecrBackendFiles()
 for(const edit of [p=>p.user.login='other',p=>p.head.repo.full_name='other/fork',p=>p.base.ref='production',p=>p.state='closed']){const p=ecrBackendPr();edit(p);rejection(()=>selectCandidate(context(),p,other,{files}))}
 rejection(()=>selectCandidate({...context(),triggeringActor:'other'},ecrBackendPr(),other,{files}))
 rejection(()=>selectCandidate({...context(),ref:'refs/heads/sg2/untrusted-control'},ecrBackendPr(),other,{files}))
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const patch of [{currentOwner:'Other owner'},{allowedProjectKeys:['SG2']},{baselineClassification:'LEGACY'}]){const registry=JSON.parse(original),surface=registry.surfaces.find(s=>s.id===ECR_BACKEND_REVIEW.routes['apps/economic-calendar-runtime/src/main.mjs'].surfaceId);Object.assign(surface,patch);fs.writeFileSync(file,JSON.stringify(registry));rejection(()=>selectCandidate(context(),ecrBackendPr(),other,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})

test('ECR complete API metadata resolution rejects file truncation and concurrent head/base movement',async()=>{
 const p=ecrBackendPr(),files=ecrBackendFiles(),answer=await resolveCandidateAdmission(context(),'908',other,apiFixture(p,files).request)
 assert.equal(answer.sha,other);assert.deepEqual(answer.admission.files,files)
 await assert.rejects(resolveCandidateAdmission(context(),'908',other,apiFixture(p,files.slice(1)).request))
 for(const after of [{...p,head:{...p.head,sha}},{...p,base:{...p.base,sha:other}},{...p,head:{...p.head,ref:'architecture/changed'}}])await assert.rejects(resolveCandidateAdmission(context(),'908',other,apiFixture(p,files,after).request))
})

const marketSymbolFiles=()=>Object.entries(SOURCE_HUB_MARKET_SYMBOL_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:SOURCE_HUB_MARKET_SYMBOL_REVIEW.statuses[filename]}))
const marketSymbolPr=()=>({...pr(),number:915,changed_files:marketSymbolFiles().length,base:{...pr().base,sha:SOURCE_HUB_MARKET_SYMBOL_REVIEW.reviewedBaseSha},head:{...pr().head,sha:SOURCE_HUB_MARKET_SYMBOL_REVIEW.reviewedCandidateSha,ref:SOURCE_HUB_MARKET_SYMBOL_REVIEW.branch}})
test('PR915 permits only the exact reviewed producer and correctly owned consumer file closure',()=>{
 const p=marketSymbolPr(),files=marketSymbolFiles();assert.equal(files.length,77)
 assert.equal(selectCandidate(context(),p,p.head.sha,{files}),p.head.sha)
 assert(Object.values(SOURCE_HUB_MARKET_SYMBOL_REVIEW.routes).some(r=>r.projectKey==='SG2'))
 assert(Object.values(SOURCE_HUB_MARKET_SYMBOL_REVIEW.routes).some(r=>r.projectKey==='SRM'))
 for(const edit of [f=>f.pop(),f=>f.push({...f[0]}),f=>f[0].sha=other,f=>f[0].status='removed',f=>f[0].previous_filename='old']){
  const f=marketSymbolFiles();edit(f);rejection(()=>selectCandidate(context(),{...p,changed_files:f.length},p.head.sha,{files:f}))
 }
 for(const filename of ['apps/sg-runtime/app/unreviewed.ts','apps/srm/src/server/unreviewed.ts','Canon/registries/governance-manifest-v2.json','.github/workflows/platform-contracts-ci.yml','scripts/governance/controlled-package-ci.mjs','.npmrc']){
  const f=[...files,producerFile(filename)];rejection(()=>selectCandidate(context(),{...p,changed_files:f.length},p.head.sha,{files:f}))
 }
 // The fixed PR/branch cannot fall back to the generic producer class.
 const subset=files.filter(f=>f.filename==='packages/platform-contracts/src/external-call.mjs')
 rejection(()=>selectCandidate(context(),{...p,changed_files:subset.length},p.head.sha,{files:subset}))
})
test('PR915 exact admission preserves trusted owner, branch, SHA, route and regular-file boundaries',()=>{
 const p=marketSymbolPr(),files=marketSymbolFiles()
 for(const edit of [q=>q.number=916,q=>q.head.ref='architecture/other',q=>q.head.ref='sg2/unreviewed',q=>q.user.login='other',q=>q.head.repo.full_name='other/fork',q=>q.base.ref='production',q=>q.state='closed']){const q=structuredClone(p);edit(q);rejection(()=>selectCandidate(context(),q,q.head.sha,{files}))}
 rejection(()=>selectCandidate(context(),p,other,{files}));rejection(()=>selectCandidate({...context(),triggeringActor:'other'},p,p.head.sha,{files}))
 for(const f of files){assertMarketSymbolReviewEntry(f,'100644 blob '+f.sha+'\t'+f.filename+'\0');for(const mode of ['100755','120000','160000'])rejection(()=>assertMarketSymbolReviewEntry(f,mode+' blob '+f.sha+'\t'+f.filename+'\0'))}
 const root=routingFixture(),file=path.join(root,'Canon/registries/current-architecture-baseline-v1.json'),original=fs.readFileSync(file,'utf8')
 try{for(const projectKey of ['ARCHITECTURE','SG2','SRM']){const e=Object.values(SOURCE_HUB_MARKET_SYMBOL_REVIEW.routes).find(r=>r.projectKey===projectKey);const v=JSON.parse(original);v.surfaces.find(s=>s.id===e.surfaceId).currentOwner='Other';fs.writeFileSync(file,JSON.stringify(v));rejection(()=>selectCandidate(context(),p,p.head.sha,{files,repositoryRoot:root}))}}finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('PR915 resolution rejects truncated API lists and head/base movement',async()=>{
 const p=marketSymbolPr(),files=marketSymbolFiles(),sha=p.head.sha;const result=await resolveCandidateAdmission(context(),'915',sha,apiFixture(p,files).request);assert.equal(result.sha,sha)
 await assert.rejects(resolveCandidateAdmission(context(),'915',sha,apiFixture(p,files.slice(1)).request))
 for(const after of [{...p,head:{...p.head,sha:other}},{...p,base:{...p.base,sha:other}}])await assert.rejects(resolveCandidateAdmission(context(),'915',sha,apiFixture(p,files,after).request))
})
test('SDK1.34 Maps peer transition needs pinned bytes, matching lock and the closed review',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'market-symbol-peer-transition-')),candidateRoot=path.join(temporary,'candidate'),authorityRoot=path.join(temporary,'authority')
 try{
  const relative=LOCAL_PACKAGES['@profitia/maps-embed'],candidateApp=path.join(candidateRoot,'apps/sg-runtime'),authorityApp=path.join(authorityRoot,'apps/sg-runtime');fs.mkdirSync(candidateApp,{recursive:true});fs.mkdirSync(authorityApp,{recursive:true})
  const original=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../packages/maps-embed/package.json'),'utf8'),installed=JSON.parse(original).peerDependencies['@profitia/platform-contracts'];const next=installed.endsWith(' || 1.34.0')?installed:installed+' || 1.34.0';const bytes=Buffer.from(original.replace(JSON.stringify(installed),JSON.stringify(next))),manifest=JSON.parse(bytes)
  assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),SOURCE_HUB_MARKET_SYMBOL_REVIEW.blobs['packages/maps-embed/package.json'])
  const target=path.resolve(candidateApp,relative,'package.json'),trusted=path.resolve(authorityApp,relative,'package.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.mkdirSync(path.dirname(trusted),{recursive:true});fs.writeFileSync(target,bytes)
  const prior=structuredClone(manifest);prior.peerDependencies['@profitia/platform-contracts']=next.replace(/ \|\| 1\.34\.0$/,'');fs.writeFileSync(trusted,JSON.stringify(prior))
  const lock={packages:{'node_modules/@profitia/maps-embed':{version:manifest.version,resolved:'file:'+relative,peerDependencies:manifest.peerDependencies}}};rejection(()=>assertLocalPackageSources(candidateRoot,lock,authorityRoot));assertLocalPackageSources(candidateRoot,lock,authorityRoot,{reviewedMarketSymbol:true});assertLocalPackageSources(candidateRoot,lock,candidateRoot);assertLocalPackageSources(candidateRoot,lock,candidateRoot,{reviewedMarketSymbol:true})
  const bad=structuredClone(lock);bad.packages['node_modules/@profitia/maps-embed'].peerDependencies=prior.peerDependencies;rejection(()=>assertLocalPackageSources(candidateRoot,bad,authorityRoot,{reviewedMarketSymbol:true}))
  fs.writeFileSync(target,JSON.stringify({...manifest,unreviewed:true}));rejection(()=>assertLocalPackageSources(candidateRoot,lock,authorityRoot,{reviewedMarketSymbol:true}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})


import {INSIGHTS_G1_REVIEW,assertInsightsG1ReviewEntry} from './controlled-package-ci.mjs'
function insightsG1Fixture(){
 const p=pr();p.number=INSIGHTS_G1_REVIEW.prNumber;p.head.ref=INSIGHTS_G1_REVIEW.branch;
 const files=Object.entries(INSIGHTS_G1_REVIEW.blobs).map(([filename,sha])=>({filename,sha,status:INSIGHTS_G1_REVIEW.statuses[filename]}));p.changed_files=files.length;p.base.sha=sha;return {p,files};
}
test('existing exact Insights G1 governance branch receives the reviewed Architecture path only',()=>{
 const {p,files}=insightsG1Fixture();assert(Object.isFrozen(INSIGHTS_G1_REVIEW.blobs));assert.equal(selectCandidate(context(),p,other,{files}),other);assertArchitectureFiles(p,files);
 assert.equal(INSIGHTS_G1_REVIEW.prNumber,848);assert.equal(files.length,4);assert.equal(INSIGHTS_G1_REVIEW.branch,'governance/procurement-insights-g1-20261101');
});
test('Insights G1 rejects altered or incomplete file closure before credential use',()=>{
 const {p,files}=insightsG1Fixture();
 for(const mutate of [f=>f.pop(),f=>f.push({filename:'apps/insights-runtime/index.mjs',sha:sha,status:'added'}),f=>f[0].sha=sha,f=>f[0].status='removed',f=>f[0].previous_filename='Canon/old.md',f=>f[1]={...f[0]},f=>f[0].filename='scripts/governance/controlled-package-ci.mjs']){const changed=structuredClone(files);mutate(changed);rejection(()=>selectCandidate(context(),p,other,{files:changed}));}
});
test('Insights G1 cannot borrow another PR, prefix, actor, fork or candidate SHA',()=>{
 const {p,files}=insightsG1Fixture();
 for(const mutate of [x=>x.number=849,x=>x.head.ref='governance/other',x=>x.head.ref='sg2/fallback',x=>x.head.ref='architecture/fallback',x=>x.user.login='other',x=>x.head.repo.full_name='profitia/fork',x=>x.base.ref='staging']){const changed=structuredClone(p);mutate(changed);rejection(()=>selectCandidate(context(),changed,other,{files}));}
 rejection(()=>selectCandidate(context(),p,sha,{files}));rejection(()=>selectCandidate({...context(),ref:'refs/heads/governance/not-main'},p,other,{files}));
});
test('Insights G1 fixes every actual blob to regular100644 entries; executables and symlinks fail',()=>{
 const {files}=insightsG1Fixture();for(const f of files){assertInsightsG1ReviewEntry(f,`100644 blob ${f.sha}\t${f.filename}\0`);for(const mode of ['100755','120000'])rejection(()=>assertInsightsG1ReviewEntry(f,`${mode} blob ${f.sha}\t${f.filename}\0`));rejection(()=>assertInsightsG1ReviewEntry({...f,sha},`100644 blob ${sha}\t${f.filename}\0`));}
});

function oilReportFixture(){
 const p=pr(),r=OIL_REPORT_E1_REVIEW;p.number=r.prNumber;p.head.ref=r.branch;p.base.sha=sha;
 const files=Object.entries(r.entries).map(([filename,e])=>({filename,sha:e.sha,status:e.status}));p.changed_files=files.length;return{p,files};
}
test('Oil report review accepts only the113 exact owner-routed files on existing PR923',()=>{
 const {p,files}=oilReportFixture();assert.equal(files.length,113);assert.equal(p.number,923);assert.equal(OIL_REPORT_E1_REVIEW.sourceSha,'9b820dcac90239f59a9cf5d875eb5497cb93be0e');assert(Object.isFrozen(OIL_REPORT_E1_REVIEW.entries));
 assert.equal(selectCandidate(context(),p,other,{files}),other);assertArchitectureFiles(p,files);
 assert.deepEqual([...new Set(Object.values(OIL_REPORT_E1_REVIEW.entries).map(e=>e.projectKey))].sort(),['ARCHITECTURE','SG2','SRM']);
});
test('Oil review rejects missing, extra, altered, renamed, duplicate or borrowed files and another PR identity',()=>{
 const {p,files}=oilReportFixture();
 for(const mutate of [f=>f.pop(),f=>f.push({filename:'apps/sg-runtime/unapproved.ts',sha,status:'added'}),f=>f[0].sha=sha,f=>f[0].status='removed',f=>f[0].previous_filename='old.md',f=>f[1]={...f[0]}]){const f=structuredClone(files);mutate(f);rejection(()=>selectCandidate(context(),p,other,{files:f}));}
 for(const mutate of [p=>p.number=928,p=>p.head.ref='feat/another',p=>p.user.login='another',p=>p.head.repo.full_name='profitia/fork',p=>p.base.ref='production']){const changed=structuredClone(p);mutate(changed);rejection(()=>selectCandidate(context(),changed,other,{files}));}
 rejection(()=>selectCandidate(context(),p,sha,{files}));
});
test('current Oil source cannot reuse the actual prior94,111,112 or prior113-file admission',()=>{
 for(const[commit,count]of [['400f3970fad60d1e24e20bf90e12e5e02bca4365',94],['71a9bec5970ac8c0db401044533e3cb37279db68',111],['58307056e55f218fe4501c4c1aa8715511bba523',112],['1a5d36da9e1ff0be118225613035f2b0070307a9',113]]){
  const text=execFileSync('git',['show',commit+':scripts/governance/controlled-package-ci.mjs'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
  const start=text.indexOf('export const OIL_REPORT_E1_REVIEW='),end=text.indexOf('function isPinnedOilReportReview',start);
  const previous=[...text.slice(start,end).matchAll(/"([^"\n]+)":Object\.freeze\((\{[^\n]+\})\)/g)].map(m=>({filename:m[1],...JSON.parse(m[2])}));
  assert.equal(previous.length,count);
  const{p}=oilReportFixture();rejection(()=>selectCandidate(context(),p,other,{files:previous,repositoryRoot:new URL('../../',import.meta.url)}));
 }
});
test('Oil review fixes each original file mode; a symlink or different blob is never admitted',()=>{
 const{files}=oilReportFixture();for(const f of files){const e=OIL_REPORT_E1_REVIEW.entries[f.filename];assertOilReportReviewEntry(f,`${e.mode} blob ${f.sha}\t${f.filename}\0`);rejection(()=>assertOilReportReviewEntry(f,`120000 blob ${f.sha}\t${f.filename}\0`));rejection(()=>assertOilReportReviewEntry({...f,sha},`${e.mode} blob ${sha}\t${f.filename}\0`));}
});
test('new report package names do not admit arbitrary Source peers or changed private registry artifacts',()=>{
 const c=lock(),a=lock();
 c.packages['node_modules/@profitia/platform-current-e1-authority']={version:'1.2.1',resolved:'../../packages/platform-contracts/current-e1-authority',peerDependencies:{'@profitia/platform-contracts':'1.33.0 || 1.34.0'}};
 assertPackagePolicy(c,a,configuration);
 c.packages['node_modules/@profitia/platform-current-e1-authority'].peerDependencies['@profitia/platform-contracts']='*';rejection(()=>assertPackagePolicy(c,a,configuration));
 delete c.packages['node_modules/@profitia/platform-current-e1-authority'];c.packages['node_modules/@profitia/cic-core'].integrity='sha512-unapproved';rejection(()=>assertPackagePolicy(c,a,configuration));
});

test('missing main package authority needs the exact reviewed manifest, never only an opt-in boolean',()=>{
 const t=fs.mkdtempSync(path.join(os.tmpdir(),'oil-package-policy-'));
 try{
  const root=path.join(t,'candidate'),a=path.join(t,'authority'),app=path.join(root,'apps/sg-runtime'),pkg=path.join(root,'apps/insights-runtime');
  fs.mkdirSync(app,{recursive:true});fs.mkdirSync(pkg,{recursive:true});fs.mkdirSync(a,{recursive:true});
  fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'@profitia/insights-runtime',version:'1.0.0',scripts:{postinstall:'unapproved'}}));
  const l={packages:{'node_modules/@profitia/insights-runtime':{version:'1.0.0',resolved:'../insights-runtime'}}};
  rejection(()=>assertLocalPackageSources(root,l,a));rejection(()=>assertLocalPackageSources(root,l,a,{reviewedOilReport:true}));
 }finally{fs.rmSync(t,{recursive:true,force:true})}
});

test('accepted SourceHub1.6 keeps the same exact peer range; future versions and wider ranges are rejected',()=>{
 for(const version of ['1.4.0','1.5.0','1.6.0']){
  const m={name:'@profitia/platform-source-hub-contracts',version,peerDependencies:{'@profitia/platform-current-e1-authority':'1.1.0 || 1.2.0 || 1.2.1'}};
  assertManifestPolicy(m,m);
  rejection(()=>assertManifestPolicy({...m,peerDependencies:{'@profitia/platform-current-e1-authority':'*'}},m));
 }
 const future={name:'@profitia/platform-source-hub-contracts',version:'1.7.0',peerDependencies:{'@profitia/platform-current-e1-authority':'1.1.0 || 1.2.0 || 1.2.1'}};
 rejection(()=>assertManifestPolicy(future,future));
});


test('ACG G1 review accepts only the two exact governance blobs on its own PR and branch',()=>{
 const files=Object.entries(ACG_G1_REVIEW.entries).map(([filename,e])=>({filename,status:e.status,sha:e.sha}));
 const candidate={...pr(),number:ACG_G1_REVIEW.prNumber,changed_files:2,base:{...pr().base,sha},head:{...pr().head,ref:ACG_G1_REVIEW.branch}};
 assert.equal(selectCandidate(context(),candidate,other,{files}),other);
 for(const delta of [{number:932},{head:{...candidate.head,ref:'architecture/unreviewed'}},{head:{...candidate.head,ref:'sg2/forged'}}])rejection(()=>selectCandidate(context(),{...candidate,...delta},other,{files}));
 for(const edit of [f=>f[0].sha='f'.repeat(40),f=>f[0].status='added',f=>f[0].filename='Canon/proposals/other.md',f=>f[0].previous_filename='old',f=>f.push({...f[0]}),f=>f.pop()]){
  const changed=structuredClone(files);edit(changed);rejection(()=>selectCandidate(context(),candidate,other,{files:changed}));
 }
 for(const f of files){assertAcgG1ReviewEntry(f,'100644 blob '+f.sha+'\t'+f.filename+'\0');for(const mode of ['100755','120000','160000'])rejection(()=>assertAcgG1ReviewEntry(f,mode+' blob '+f.sha+'\t'+f.filename+'\0'));}
});

test('M1 admits only the reviewed 63 source blobs through their actual three owner profiles',()=>{
 const review=ACG_M1_EXECUTION_REVIEW,files=Object.entries(review.entries).map(([filename,e])=>({filename,sha:e.sha,status:e.status})),p={...architecturePr(files.length),number:937,head:{...pr().head,ref:review.branch}}
 assert.equal(Object.keys(review.entries).length,63);assert.equal(review.sourceSha,'1f25d37589d0c8e0e0020f014ab9788b4a04417b')
 assert.deepEqual([...new Set(Object.values(review.entries).map(e=>e.projectKey))].sort(),['ARCHITECTURE','SG2','SRM'])
 assert.equal(selectCandidate(context(),p,other,{files}),other)
 assert.equal(selectCandidate(context(),{...p,base:{...p.base,sha:'f'.repeat(40)}},other,{files:[...files].reverse()}),other,'main refresh requires unchanged reviewed versions')
 for(const patch of [{number:938},{head:{...p.head,ref:'architecture/other'}},{head:{...p.head,ref:'sg2/other'}},{head:{...p.head,sha}},{base:{...p.base,ref:'staging'}}])rejection(()=>selectCandidate(context(),{...p,...patch},other,{files}))
 for(const original of files){
  for(const patch of [{sha:'0'.repeat(40)},{status:original.status==='added'?'modified':'added'},{previous_filename:original.filename},{filename:'constructor'}]){
   const changed=files.map(f=>f===original?{...f,...patch}:f);rejection(()=>selectCandidate(context(),p,other,{files:changed}))
  }
  for(const mode of ['120000','100755','040000'])rejection(()=>assertAcgM1ReviewEntry(original,mode+' blob '+original.sha+'\t'+original.filename+'\0'))
  assertAcgM1ReviewEntry(original,review.entries[original.filename].mode+' blob '+original.sha+'\t'+original.filename+'\0')
 }
 for(const changed of [files.slice(1),[...files,files[0]],[...files,{filename:'apps/sg-runtime/unreviewed.ts',sha:other,status:'added'}]])rejection(()=>selectCandidate(context(),{...p,changed_files:changed.length},other,{files:changed}))
})

test('M1 fixed Root layout binds both real usage dependencies and cannot fall back to eight files',()=>{
 const f=sourceLayoutFixture('1.0.0-candidate.16'),extras=['src/assistant-usage.mjs','src/assistant-usage.d.mts']
 try{
  fs.appendFileSync(f.file('src/operation-context.mjs'),"export const ASSISTANT_ROOT_CONTRACT=Object.freeze({...OPERATION_CONTRACT,implementation:'1.0.0-candidate.20'})\nimport './assistant-usage.mjs'\n")
  for(const name of extras)fs.writeFileSync(f.file(name),'throw new Error("source hashing must never evaluate candidate code")')
  const h=createHash('sha256');for(const name of [...f.names,...extras])h.update(fs.readFileSync(f.file(name)))
  const before=operationContractProvenanceDigest(f.root,f.contract);assert.equal(before,h.digest('hex'))
  const legacy=createHash('sha256');for(const name of f.names)legacy.update(fs.readFileSync(f.file(name)));assert.notEqual(before,legacy.digest('hex'))
  for(const name of extras){const bytes=fs.readFileSync(f.file(name));fs.appendFileSync(f.file(name),'changed');assert.notEqual(operationContractProvenanceDigest(f.root,f.contract),before);fs.unlinkSync(f.file(name));assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract));fs.writeFileSync(f.file(name),bytes)}
  fs.writeFileSync(f.file('src/operation-context.mjs'),fs.readFileSync(f.file('src/operation-context.mjs'),'utf8').replace(/^export const ASSISTANT_ROOT_CONTRACT=.*\n/m,''))
  assert.throws(()=>operationContractProvenanceDigest(f.root,f.contract),'imported usage cannot select the old layout by removing the marker')
 }finally{f.close()}
})

test('explicit current Root acceptance preserves the complete historical receipt and closes false activation claims',()=>{
 const r={contract:{id:'profitia.operation-context',version:'1.0.0',implementation:'1.0.0-candidate.16',sourceDigest:'a'.repeat(64)}}
 assert.equal(adoptedOperationContract(r),r.contract)
 const a={schemaVersion:'1.0',taskId:'SG2-ACG-M1-20261109',targetEnvironment:'development',scope:'OPTIONAL_ASSISTANT_SOURCE_NO_RUNTIME_ACTIVATION',rootContract:{...r.contract,sourceDigest:'b'.repeat(64)},rootProducer:{projectKey:'ARCHITECTURE',taskId:'ARCH-ACG-M1-EXECUTION-20261109',pullRequest:937,sourceSha:'6a7863459977f5651bf30100935118e1613021fd'},sdkDigests:{operationSourceDigest:'b'.repeat(64)},assistantOptedIn:false,sql030Installed:false,historyInstalled:false,grantsChanged:false,providerCallsPerformed:false,deploymentPerformed:false}
 const current={...r,assistantM1SourceCompatibility:a};assert.equal(adoptedOperationContract(current),a.rootContract);assert.equal(current.contract.sourceDigest,'a'.repeat(64))
 for(const mutate of [x=>x.assistantOptedIn=true,x=>x.grantsChanged=true,x=>x.targetEnvironment='production',x=>x.rootProducer.sourceSha='0'.repeat(40),x=>x.rootContract.implementation='1.0.0-candidate.19',x=>x.sdkDigests.operationSourceDigest='f'.repeat(64)]){const changed=structuredClone(a);mutate(changed);rejection(()=>adoptedOperationContract({...r,assistantM1SourceCompatibility:changed}))}
})

test('CIC M1 allows exactly the already-published analytical artifact without expanding private names or credential scope',()=>{
 const authority=lock(),candidate=lock();candidate.packages['']={name:'@sg/runtime',dependencies:{'@profitia/cic-core':'1.3.0'}}
 candidate.packages['node_modules/@profitia/cic-core']={...CIC_ANALYTICAL_PIN}
 assertPackagePolicy(candidate,authority,configuration)
 const manifest={name:'@sg/runtime',dependencies:{'@profitia/cic-core':'1.3.0'}},prior={name:'@sg/runtime',dependencies:{'@profitia/cic-core':'1.1.1'}}
 assertManifestPolicy(manifest,prior)
 for(const [key,value]of [['version','1.3.1'],['integrity','sha512-forged'],['resolved',CIC_ANALYTICAL_PIN.resolved+'?other=1'],['link',true]]){const altered=structuredClone(candidate);altered.packages['node_modules/@profitia/cic-core'][key]=value;rejection(()=>assertPackagePolicy(altered,authority,configuration))}
 for(const value of ['^1.3.0','latest','1.3.1'])rejection(()=>assertManifestPolicy({...manifest,dependencies:{'@profitia/cic-core':value}},prior))
 rejection(()=>assertManifestPolicy({...manifest,name:'unrelated'},prior))
 assert.deepEqual(PRIVATE_PACKAGES,['@profitia/advisory-widget','@profitia/cic-core','@profitia/cic-procurement'])
 rejection(()=>assertCredentialMetadata({login:'profitia',scopes:'read:packages,repo',expiresAt:new Date(Date.now()+86400000).toISOString()}))
})

test('Oil current Root is separate from immutable M1 and refuses an altered producer, history, digest or activation',()=>{
 const r={"contract":{"id":"profitia.operation-context","version":"1.0.0","implementation":"1.0.0-candidate.16","sourceDigest":"dc609cc3a4a92ce013a7ffdac34337b341f355725319a19a5917e0e1851b6052"},"oilAutonomousReportCompatibility":{"schemaVersion":"1.0","taskId":"SG2-OIL-FINAL-INTEGRATION-20261109","targetEnvironment":"development","scope":"EXPLICIT_SOURCE_ADOPTION_CANDIDATE_NOT_LIVE_ADMISSION","producer":{"projectKey":"ARCHITECTURE","taskId":"ARCH-OIL-E1-REPORT-ADOPTION-20261109","repository":"profitia/SG-dev","pullRequest":923,"sourceSha":"e189433899349ddda6664c37988255c13845b3e2"},"sourceSha":"e189433899349ddda6664c37988255c13845b3e2","previousReceiptSourceSha":"7ed96210f4cc3ccfcd0e0dac6ad126144bdcdecb","previousReceiptSha256":"c79fa9f732bedb8692c54553e04bd14c5b756b4e8cd24cd66c1d2c44a73636f9","sdkDigests":{"operationSourceDigest":"dc609cc3a4a92ce013a7ffdac34337b341f355725319a19a5917e0e1851b6052","accessSchemaDigest":"356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2","accessStoreSourceDigest":"71e42f5e194f8b251c86a70c22bfbd7cb940cf66b8279159b08781f042ec9f47","moduleAuditSchemaDigest":"af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac","serviceReadSchemaDigest":"f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49","clerkConfigurationSourceDigest":"b3bdad865a16cbf677db1dd7450f594870abca30f8a252bd4d361d2387417246","privateOperationHostSourceDigest":"63d2e2721f2a7bc2223e90f39192e4933f657a89f91be03c84db7db9958f7a08","delegatedJobSchemaDigest":"6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb","delegatedJobSourceDigest":"2a2bc66260bc33b1bcafe80c9a1e1f594c0206b9efe362082760b1f24d8e7f4a","supplierDelegationSchemaDigest":"cd12f9b88397da88241499548b8a5977d0aca830ad83c53a1bcf146265503555","diagnosticPhaseSourceDigest":"52816918087b9bd437c8c7619be643146f5af9527ea692263b4f2aa0471c7556","apiPathTransportSchemaDigest":"bd35367f22eccb34dc6c8f62b3a82bfc8947471142fc5daab45a32d67c07707c","externalCallSchemaDigest":"69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206","externalCallSourceDigest":"8a6de7bf58170e97a01dc656f0ef822701a5ff4dae343bfa9e5d3e7a38e825a8","marketSymbolTransportSchemaDigest":"fee0f8738f7ccb8481ce2894b6e5a84792256d5230ef0ef1585fc34ac851d504","nativeExternalTransportSchemaDigest":"6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde","publicWebTransportSchemaDigest":"f334e0efe99aac742ecad53e9cfa4d0199dbd2333a56792c58c387621b5b174d","externalRequestSchemaDigest":"8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79","requestLedgerSourceDigest":"d24a1c98efe2f04a2d9cd6335f75bd6a37eda4bfe0eca0ebae712a638e9e43d5","requestQuotaSchemaDigest":"88c5014db027c40568fcc737acbcf27766bb5db1c434c32ce6c236af859d90ef","requestReservationSchemaDigest":"0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127","delegatedPrivatePhasesSchemaDigest":"13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3","requestContinuationSchemaDigest":"d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1","requestContinuationSourceDigest":"d49673ecec3a85dad478b4e8d3e38aa30241cf04b61b6a7dfbb99e7af33c3c53","requestInspectionSchemaDigest":"00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d","requestInspectionSourceDigest":"772f1f5a58e8e544d275c4b8bb0ab09774317a6673c1f6bd8563f96fc6a19811","requestWorkSchemaDigest":"19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe","requestWorkSourceDigest":"1b9a56aa85548fa0025366bf725ccad5c4ef278f43753dee9714ea97197bee86","additionalRequestSchemaDigest":"a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94","requestOperationsSourceDigest":"65e1d46269df57ccd7f3f1637e9ac6a73171ecbdad02b35677d23469d73e7237","supplierLocationAdmissionSchemaDigest":"90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc","supplierLocationSchemaDigest":"34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5","modelExecutionSchemaDigest":"1d4b6af7900b44f3d6a311bdcef85280d1b5c968ca67128e0e641e9adb8d253c","currentHumanReadSourceDigest":"2796a54f7d19b89a44fcc4765da68fabd2f5c83d3cefac4fc1aee28db1d7ab04"},"runtimeGrantsActivated":false,"sourceTemplatesInstalled":false,"privateArchiveInstalled":false,"deploymentPerformed":false,"paidCallsPerformed":false}};
 assert.equal(adoptedOperationContract(r),r.contract);
 for(const edit of [x=>x.oilAutonomousReportCompatibility.runtimeGrantsActivated=true,x=>x.oilAutonomousReportCompatibility.producer.sourceSha='0'.repeat(40),x=>x.oilAutonomousReportCompatibility.previousReceiptSha256='0'.repeat(64),x=>x.oilAutonomousReportCompatibility.sdkDigests.operationSourceDigest='0'.repeat(64),x=>x.contract.sourceDigest='0'.repeat(64),x=>x.oilAutonomousReportCompatibility.targetEnvironment='production']){const changed=structuredClone(r);edit(changed);rejection(()=>adoptedOperationContract(changed));}
});

test('Stage03 exact review binds42 actual-owner blobs and rejects source, mode, namespace and identity drift',()=>{
 const review=ECR_STAGE03_REVIEW,files=Object.entries(review.entries).map(([filename,e])=>({filename,sha:e.sha,status:e.status})),p={...pr(),number:review.prNumber,changed_files:files.length,base:{...pr().base,sha:review.baseSha},head:{...pr().head,sha:review.sourceSha,ref:review.branch}}
 assert.equal(files.length,42);assert.equal(review.sourceSha,'995c2b5f385b515d647e6d770d77873503815311');assert.equal(createHash('sha256').update(JSON.stringify(review.entries)).digest('hex'),'cb0bfee1e807211a0f091ded9f7c47205ded1954c7a8e22071718d9d201fe019')
 assertArchitectureFiles(p,files)
 assert.equal(selectCandidate(context(),p,review.sourceSha,{files}),review.sourceSha)
 for(const f of files){assertEcrStage03ReviewEntry(f,'100644 blob '+f.sha+'\t'+f.filename+'\0');for(const mode of ['100755','120000','160000'])rejection(()=>assertEcrStage03ReviewEntry(f,mode+' blob '+f.sha+'\t'+f.filename+'\0'))}
 for(const edit of [a=>a.pop(),a=>a.push(a[0]),a=>a[0]={...a[0],sha:'f'.repeat(40)},a=>a[0]={...a[0],status:'removed'},a=>a[0]={...a[0],previous_filename:a[0].filename},a=>a[0]={...a[0],filename:'apps/economic-calendar-runtime/src/unreviewed.mjs'}]){const bad=structuredClone(files);edit(bad);rejection(()=>selectCandidate(context(),{...p,changed_files:bad.length},review.sourceSha,{files:bad}))}
 for(const edit of [q=>q.number++,q=>q.head.ref='architecture/another-ecr',q=>q.head.ref='sg2/ecr-stage03',q=>q.head.repo.full_name='profitia/fork',q=>q.user.login='attacker',q=>q.base.ref='staging']){const bad=structuredClone(p);edit(bad);rejection(()=>selectCandidate(context(),bad,review.sourceSha,{files}))}
 assert(files.every(f=>!f.filename.startsWith('Canon/')&&!f.filename.startsWith('.github/')&&!f.filename.startsWith('apps/sg-runtime/')&&!f.filename.startsWith('apps/srm/')))
})
