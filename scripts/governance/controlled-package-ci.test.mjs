import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {assertTrustedContext, assertEnvironment, selectCandidate, assertCredentialMetadata, assertReceipt, assertPackagePolicy, assertManifestPolicy, assertProof, REPOSITORY, WORKFLOW, PRIVATE_PACKAGES} from './controlled-package-ci.mjs'

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
test('internal reviewed PR is pinned; no owner-triggered fork, other product branch, stale SHA or arbitrary revision', () => {
  assert.equal(selectCandidate(context(), pr(), other), other)
  assert.equal(selectCandidate(context(), null, sha), sha)
  for (const change of [p => p.head.repo.full_name = 'profitia/fork', p => p.user.login = 'attacker', p => p.head.ref = 'srm/work', p => p.base.ref = 'staging', p => p.state = 'closed']) {
    const p = pr(); change(p); rejection(() => selectCandidate(context(), p, other))
  }
  rejection(() => selectCandidate(context(), pr(), sha))
  rejection(() => selectCandidate(context(), pr(), undefined))
  rejection(() => selectCandidate(context(), null, other))
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
function fixture() {
  return {proof: {schemaVersion: '1.0', repository: REPOSITORY, projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_API_AND_PERSISTENCE', candidateSha: other, controlSha: sha, runId: '12', workflow: WORKFLOW, contract: {id: 'profitia.operation-context', sourceDigest: 'e'.repeat(64)}, credentialRemovedBeforeCandidateExecution: true, privatePackageArtifactsPublished: false, productDeploymentPerformed: false, customerIdentityAdapterVerified: false, install: 'CLEAN_REGISTRY_IGNORE_SCRIPTS', tests: 'PASS', typecheck: 'PASS', build: 'PASS'}, run: {id: 12, workflow_id: 34, repository: {full_name: REPOSITORY}, head_branch: 'main', head_sha: sha, event: 'workflow_dispatch', actor: {login: 'profitia'}, conclusion: 'success'}}
}
test('completed controlled proof binds exact candidate and control source; refuses reuse and false execution claims', () => {
  const {proof, run} = fixture(); assertProof(proof, run, other, 34)
  for (const change of [p => p.candidateSha = sha, p => p.controlSha = other, p => p.runId = '99', p => p.productDeploymentPerformed = true, p => p.tests = 'SKIPPED', p => p.install = 'COPIED_DEPENDENCIES', p => p.privatePackageArtifactsPublished = true, p => p.credentialRemovedBeforeCandidateExecution = false]) {const p = structuredClone(proof); change(p); rejection(() => assertProof(p, run, other, 34))}
  for (const delta of [{conclusion: 'failure'}, {conclusion: null}, {head_branch: 'feature'}, {workflow_id: 99}, {actor: {login: 'attacker'}}, {repository: {full_name: 'attacker/SG-dev'}}]) rejection(() => assertProof(proof, {...run, ...delta}, other, 34))
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
