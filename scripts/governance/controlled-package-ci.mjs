#!/usr/bin/env node
// Trusted-main CI controller. Never import candidate JavaScript while credentials exist.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync, spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

export const REPOSITORY = 'profitia/SG-dev'
export const WORKFLOW = '.github/workflows/platform-contracts-ci.yml'
export const ARTIFACT = 'sg2-controlled-operation-proof'
export const PRIVATE_PACKAGES = Object.freeze(['@profitia/advisory-widget', '@profitia/cic-core', '@profitia/cic-procurement'])
export const LOCAL_PACKAGES = Object.freeze({
  '@profitia/platform-contracts': '../../packages/platform-contracts',
  '@profitia/srm-xray': '../../packages/srm-xray',
})
const npmrc = '@profitia:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}\n'
const shaPattern = /^[a-f0-9]{40}$/
const fail = code => {throw new Error(code)}

export function assertTrustedContext(c) {
  if (c.repository !== REPOSITORY || c.ref !== 'refs/heads/main' || c.workflowRef !== `${REPOSITORY}/${WORKFLOW}@refs/heads/main`) fail('UNTRUSTED_WORKFLOW_SOURCE')
  if (!['push', 'workflow_dispatch'].includes(c.event) || c.actor !== 'profitia' || c.triggeringActor !== 'profitia' || !shaPattern.test(c.controlSha ?? '')) fail('UNTRUSTED_EXECUTION')
  return c
}

export function assertEnvironment(environment, branches, registered) {
  if (environment.id !== registered.environmentId || environment.name !== registered.environmentName || registered.repository !== REPOSITORY || registered.protectionStatus !== 'MAIN_ONLY') fail('ENVIRONMENT_IDENTITY_MISMATCH')
  const p = environment.deployment_branch_policy
  if (p?.protected_branches !== false || p?.custom_branch_policies !== true || branches.length !== 1 || branches[0].name !== 'main' || branches[0].type !== 'branch') fail('ENVIRONMENT_POLICY_DRIFT')
}

export function selectCandidate(context, pr, expectedSha) {
  assertTrustedContext(context)
  if (!pr) {
    if (expectedSha && expectedSha !== context.controlSha) fail('CANDIDATE_SHA_MISMATCH')
    return context.controlSha
  }
  if (pr.state !== 'open' || pr.base?.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'main' || pr.head?.repo?.full_name !== REPOSITORY || pr.user?.login !== 'profitia' || !pr.head?.ref?.startsWith('sg2/')) fail('UNTRUSTED_CANDIDATE')
  if (!shaPattern.test(expectedSha ?? '') || pr.head.sha !== expectedSha) fail('CANDIDATE_SHA_MISMATCH')
  return expectedSha
}

export function assertCredentialMetadata({scopes, expiresAt, login}, now = Date.now()) {
  const granted = (scopes ?? '').split(',').map(x => x.trim()).filter(Boolean)
  if (granted.length !== 1 || granted[0] !== 'read:packages' || login !== 'profitia') fail('CREDENTIAL_SCOPE_OR_OWNER_REJECTED')
  const expiry = Date.parse(expiresAt ?? '')
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 31 * 86400000) fail('CREDENTIAL_EXPIRY_REJECTED')
}

function assertOperationContractMetadata(c) {
  if (!c || Object.keys(c).sort().join(',') !== 'id,implementation,sourceDigest,version' || c.id !== 'profitia.operation-context' || c.version !== '1.0.0' || !/^1\.0\.0-candidate\.[1-9][0-9]*$/.test(c.implementation ?? '') || !/^[a-f0-9]{64}$/.test(c.sourceDigest ?? '')) fail('CONTRACT_PROVENANCE_MISMATCH')
}

export function assertReceipt(receipt) {
  if (receipt?.projectKey !== 'SG2' || receipt.targetEnvironment !== 'development' || receipt.scope !== 'ISOLATED_OPERATION_INTEGRATION_ONLY' || receipt.liveRouteUsesContract !== false || receipt.automaticProductDeployment !== false) fail('ADOPTION_RECEIPT_REJECTED')
  assertOperationContractMetadata(receipt.contract)
  return receipt
}

export function assertPackagePolicy(candidate, authority, configuration) {
  if (configuration !== npmrc) fail('NPM_CONFIGURATION_REJECTED')
  if (candidate.lockfileVersion !== 3 || authority.lockfileVersion !== 3) fail('LOCKFILE_VERSION_REJECTED')
  const found = new Set()
  for (const [key, entry] of Object.entries(candidate.packages ?? {})) {
    if (key.includes('..') || key.startsWith('/') || key.includes('\\')) fail('LOCKFILE_PATH_REJECTED')
    const privateName = key.split('node_modules/').at(-1)
    if (entry.name?.startsWith('@profitia/') && entry.name !== privateName) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, spec] of Object.entries(entry[section] ?? {})) {
        if ((name.startsWith('@profitia/') && !PRIVATE_PACKAGES.includes(name) && !Object.hasOwn(LOCAL_PACKAGES, name)) || String(spec).includes('@profitia/')) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
        if (Object.hasOwn(LOCAL_PACKAGES, name) && spec !== `file:${LOCAL_PACKAGES[name]}`) fail('LOCAL_DEPENDENCY_REJECTED')
      }
    }
    if (privateName.startsWith('@profitia/')) {
      if (!PRIVATE_PACKAGES.includes(privateName) && !Object.hasOwn(LOCAL_PACKAGES, privateName)) fail('PRIVATE_PACKAGE_REJECTED')
      if (PRIVATE_PACKAGES.includes(privateName)) {
        if (key !== `node_modules/${privateName}`) fail('NESTED_PRIVATE_PACKAGE_REJECTED')
        const accepted = authority.packages?.[key]
        if (!accepted?.integrity?.startsWith('sha512-') || entry.version !== accepted.version || entry.integrity !== accepted.integrity || entry.resolved !== accepted.resolved || entry.link) fail('PRIVATE_PACKAGE_PIN_MISMATCH')
        found.add(privateName)
      }
      if (Object.hasOwn(LOCAL_PACKAGES, privateName)) {
        if (key !== `node_modules/${privateName}` || entry.link || ![LOCAL_PACKAGES[privateName], `file:${LOCAL_PACKAGES[privateName]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
      }
    }
    if (entry.resolved) {
      if (!entry.resolved.includes('://')) {
        if (!Object.hasOwn(LOCAL_PACKAGES, privateName) || ![LOCAL_PACKAGES[privateName], `file:${LOCAL_PACKAGES[privateName]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
      } else {
        const u = new URL(entry.resolved)
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || !['registry.npmjs.org', 'npm.pkg.github.com'].includes(u.hostname)) fail('PACKAGE_REGISTRY_REJECTED')
        if (u.hostname === 'npm.pkg.github.com' && !PRIVATE_PACKAGES.includes(privateName)) fail('PRIVATE_PACKAGE_REJECTED')
      }
    }
  }
  if (found.size !== PRIVATE_PACKAGES.length) fail('PRIVATE_PACKAGE_SET_MISMATCH')
}

export function assertManifestPolicy(candidate, authority) {
  if (JSON.stringify(candidate.workspaces) !== JSON.stringify(authority.workspaces) || JSON.stringify(candidate.overrides) !== JSON.stringify(authority.overrides)) fail('DEPENDENCY_POLICY_CHANGE_REQUIRES_REVIEW')
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, spec] of Object.entries(candidate[section] ?? {})) {
      if (String(spec).includes('@profitia/')) fail('PRIVATE_PACKAGE_ALIAS_REJECTED')
      if (Object.hasOwn(LOCAL_PACKAGES, name) && spec === `file:${LOCAL_PACKAGES[name]}`) continue
      if (name.startsWith('@profitia/') && (!PRIVATE_PACKAGES.includes(name) || spec !== authority[section]?.[name])) fail('PRIVATE_MANIFEST_PIN_MISMATCH')
      if (/^(?:file:|link:|workspace:)/.test(String(spec))) fail('LOCAL_DEPENDENCY_REJECTED')
    }
  }
}

export function assertLocalPackageSources(root, candidateLock, authorityRoot = controlRoot()) {
  const canonicalRoot = fs.realpathSync(root)
  const app = path.join(canonicalRoot, 'apps/sg-runtime')
  if (fs.realpathSync(app) !== app) fail('LOCAL_DEPENDENCY_REJECTED')
  for (const [key, entry] of Object.entries(candidateLock.packages ?? {})) {
    if (!entry.resolved || entry.resolved.includes('://')) continue
    const name = key.split('node_modules/').at(-1)
    if (!Object.hasOwn(LOCAL_PACKAGES, name) || ![LOCAL_PACKAGES[name], `file:${LOCAL_PACKAGES[name]}`].includes(entry.resolved)) fail('LOCAL_DEPENDENCY_REJECTED')
    const expected = path.resolve(app, LOCAL_PACKAGES[name])
    if (!expected.startsWith(canonicalRoot + path.sep) || fs.realpathSync(expected) !== expected) fail('LOCAL_DEPENDENCY_REJECTED')
    const manifestPath = path.join(expected, 'package.json')
    if (fs.realpathSync(manifestPath) !== manifestPath) fail('LOCAL_DEPENDENCY_REJECTED')
    const manifest = readJson(manifestPath)
    if (manifest.name !== name) fail('LOCAL_PACKAGE_NAME_MISMATCH')
    if (typeof manifest.version !== 'string' || manifest.version !== entry.version) fail('LOCAL_PACKAGE_VERSION_MISMATCH')
    const authorityFile = path.resolve(authorityRoot, 'apps/sg-runtime', LOCAL_PACKAGES[name], 'package.json')
    if (!fs.existsSync(authorityFile)) fail('LOCAL_PACKAGE_AUTHORITY_REQUIRED')
    assertManifestPolicy(manifest, readJson(authorityFile))
  }
}

export function assertProof(proof, run, candidateSha, workflowId, {currentRunId, currentRef, completedJobs = [], expectedControlDigest = controlPolicyDigest()} = {}) {
  const sameRun = String(run.id) === String(currentRunId) && currentRef === 'refs/heads/main' && run.event === 'push' && completedJobs.some(j => j.name === 'SG2 controlled operation integration' && j.conclusion === 'success')
  if (run.workflow_id !== workflowId || run.repository?.full_name !== REPOSITORY || run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.actor?.login !== 'profitia' || (!sameRun && run.conclusion !== 'success')) fail('UNTRUSTED_VALIDATION_RUN')
  if (proof.schemaVersion !== '1.0' || proof.repository !== REPOSITORY || proof.projectKey !== 'SG2' || proof.targetEnvironment !== 'development' || proof.scope !== 'ISOLATED_API_AND_PERSISTENCE' || proof.candidateSha !== candidateSha || proof.controlSha !== run.head_sha || String(proof.runId) !== String(run.id) || proof.workflow !== WORKFLOW) fail('VALIDATION_PROVENANCE_MISMATCH')
  if (proof.credentialRemovedBeforeCandidateExecution !== true || proof.privatePackageArtifactsPublished !== false || proof.productDeploymentPerformed !== false || proof.customerIdentityAdapterVerified !== false || proof.install !== 'CLEAN_REGISTRY_IGNORE_SCRIPTS' || proof.tests !== 'PASS' || proof.typecheck !== 'PASS' || proof.build !== 'PASS') fail('VALIDATION_INCOMPLETE')
  if (proof.controlPolicyDigest !== expectedControlDigest) fail('CONTROL_POLICY_PROVENANCE_MISMATCH')
  if (proof.contract?.id !== 'profitia.operation-context' || !/^[a-f0-9]{64}$/.test(proof.contract?.sourceDigest ?? '')) fail('CONTRACT_PROVENANCE_MISMATCH')
  return proof
}

function context(env = process.env) {
  return {repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF, workflowRef: env.GITHUB_WORKFLOW_REF, event: env.GITHUB_EVENT_NAME, actor: env.GITHUB_ACTOR, triggeringActor: env.GITHUB_TRIGGERING_ACTOR, controlSha: env.GITHUB_SHA}
}
function controlRoot() {return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')}
const policyFiles = [WORKFLOW, 'scripts/governance/controlled-package-ci.mjs', 'Canon/registries/architecture-environment-topology-v1.json']
export function controlPolicyDigest(root = controlRoot()) {
  const digest = createHash('sha256')
  for (const name of policyFiles) digest.update(fs.readFileSync(path.join(root, name)))
  return digest.digest('hex')
}
function candidateRoot() {return path.resolve(process.env.CANDIDATE_ROOT ?? fail('CANDIDATE_ROOT_REQUIRED'))}
function statePath() {return path.join(process.env.RUNNER_TEMP ?? fail('RUNNER_TEMP_REQUIRED'), 'controlled-package-resolution.json')}
function readJson(file) {return JSON.parse(fs.readFileSync(file, 'utf8'))}
function output(name, value) {if (!process.env.GITHUB_OUTPUT) fail('GITHUB_OUTPUT_REQUIRED'); fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)}
async function api(endpoint, token = process.env.GH_TOKEN) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {redirect: 'error', headers: {'Accept': 'application/vnd.github+json', ...(token ? {Authorization: `Bearer ${token}`} : {})}})
  if (!response.ok) fail(`GITHUB_API_${response.status}`)
  return {data: await response.json(), headers: response.headers}
}
async function checkEnvironment() {
  const registered = readJson(path.join(controlRoot(), 'Canon/registries/architecture-environment-topology-v1.json')).environments.development.github
  const endpoint = `repos/${REPOSITORY}/environments/${encodeURIComponent(registered.environmentName)}`
  const [environment, branches] = await Promise.all([api(endpoint), api(`${endpoint}/deployment-branch-policies`)])
  assertEnvironment(environment.data, branches.data.branch_policies, registered)
  return registered
}
async function resolve() {
  const c = assertTrustedContext(context())
  if (execFileSync('git', ['rev-parse', 'HEAD'], {cwd: controlRoot(), encoding: 'utf8'}).trim() !== c.controlSha) fail('CONTROL_CHECKOUT_MISMATCH')
  const registered = await checkEnvironment()
  const number = process.env.CANDIDATE_PR ?? ''
  if (number && !/^[1-9][0-9]*$/.test(number)) fail('PR_NUMBER_REJECTED')
  const pr = number ? (await api(`repos/${REPOSITORY}/pulls/${number}`)).data : null
  const sha = selectCandidate(c, pr, process.env.EXPECTED_SHA)
  let receipt
  try {receipt = (await api(`repos/${REPOSITORY}/contents/apps/sg-runtime/operation-integration.json?ref=${sha}`)).data}
  catch (error) {if (!number && error.message === 'GITHUB_API_404') {output('adopted', 'false'); console.log('NOT_ADOPTED: no SG2 runtime proof claimed'); return}; throw error}
  receipt = JSON.parse(Buffer.from(receipt.content, 'base64').toString('utf8'))
  assertReceipt(receipt)
  fs.writeFileSync(statePath(), JSON.stringify({sha, controlSha: c.controlSha, runId: process.env.GITHUB_RUN_ID, receipt, registered}), {mode: 0o600})
  output('adopted', 'true'); output('candidate_sha', sha)
  console.log(`Accepted internal SG2 source ${sha}; control ${c.controlSha}`)
}
/** Static, closed source layouts. Candidate data selects neither file paths nor
 * executable hashing code. Candidate15 additionally binds its imported request
 * metadata and optional SQL; it may never fall back to the legacy two files. */
export function operationContractProvenanceDigest(root, contract) {
  assertOperationContractMetadata(contract)
  const legacy = /^1\.0\.0-candidate\.([1-9][0-9]*)$/.exec(contract?.implementation ?? '')
  if (!legacy || Number(legacy[1]) > 15) fail('CONTRACT_SOURCE_LAYOUT_UNSUPPORTED')
  const names = ['src/operation-context.mjs', 'src/operation-context.d.mts',
    ...(Number(legacy[1]) === 15 ? ['src/request-operations.mjs', 'src/request-operations.d.mts', 'migrations/access/017-additional-request-operations.sql'] : [])]
  let base, contents
  try {
    base = fs.realpathSync(root)
    contents = names.map(name => {
      const file = path.join(base, 'packages/platform-contracts', name)
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024 || fs.realpathSync(file) !== file) fail('CONTRACT_SOURCE_FILE_REJECTED')
      return fs.readFileSync(file)
    })
  } catch { fail('CONTRACT_SOURCE_FILE_REJECTED') }
  const identity = /^export\s+const\s+OPERATION_CONTRACT\s*=\s*Object\.freeze\(\s*\{\s*id:\s*'profitia\.operation-context',\s*version:\s*'1\.0\.0',\s*implementation:\s*'(1\.0\.0-candidate\.[1-9][0-9]*)'\s*\}\s*\)\s*;?\s*$/m.exec(contents[0].toString('utf8'))
  if (!identity || identity[1] !== contract.implementation) fail('CONTRACT_IMPLEMENTATION_MISMATCH')
  const digest = createHash('sha256')
  for (const content of contents) digest.update(content)
  return digest.digest('hex')
}
function checkCandidate() {
  const c = assertTrustedContext(context()), state = readJson(statePath()), root = candidateRoot()
  if (state.controlSha !== c.controlSha || state.runId !== process.env.GITHUB_RUN_ID || !shaPattern.test(state.sha) || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim() !== state.sha) fail('CANDIDATE_CHECKOUT_MISMATCH')
  const app = path.join(root, 'apps/sg-runtime')
  const candidateLock = readJson(path.join(app, 'package-lock.json'))
  assertPackagePolicy(candidateLock, readJson(path.join(controlRoot(), 'apps/sg-runtime/package-lock.json')), fs.readFileSync(path.join(app, '.npmrc'), 'utf8'))
  assertManifestPolicy(readJson(path.join(app, 'package.json')), readJson(path.join(controlRoot(), 'apps/sg-runtime/package.json')))
  assertLocalPackageSources(root, candidateLock)
  if (operationContractProvenanceDigest(root, state.receipt.contract) !== state.receipt.contract.sourceDigest || JSON.stringify(readJson(path.join(app, 'operation-integration.json'))) !== JSON.stringify(state.receipt)) fail('CONTRACT_PROVENANCE_MISMATCH')
  return {state, app}
}
async function install() {
  const {app} = checkCandidate()
  const token = process.env.NPM_TOKEN
  if (!token) fail('CONTROLLED_PACKAGE_CREDENTIAL_REQUIRED')
  const identity = await api('user', token)
  assertCredentialMetadata({scopes: identity.headers.get('x-oauth-scopes'), expiresAt: identity.headers.get('github-authentication-token-expiration'), login: identity.data.login})
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-npm-cache-'))
  try {
    // Do not print captured npm output or upload its logs. No lifecycle code receives the token.
    const result = spawnSync('npm', ['ci', '--install-links', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: app, env: {...process.env, NPM_CONFIG_CACHE: cache}, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
    if (result.status !== 0) fail('CONTROLLED_DEPENDENCY_INSTALL_FAILED')
    console.log('Clean registry installation completed with lifecycle scripts disabled')
  } finally {fs.rmSync(cache, {recursive: true, force: true})}
}
function proof() {
  if (process.env.NPM_TOKEN || process.env.NODE_AUTH_TOKEN || process.env.GH_TOKEN) fail('CREDENTIAL_PRESENT_IN_EXECUTION_PHASE')
  const {state} = checkCandidate(), directory = path.join(process.env.RUNNER_TEMP, ARTIFACT)
  fs.mkdirSync(directory, {recursive: true})
  fs.writeFileSync(path.join(directory, 'proof.json'), JSON.stringify({schemaVersion: '1.0', repository: REPOSITORY, workflow: WORKFLOW, projectKey: 'SG2', targetEnvironment: 'development', scope: 'ISOLATED_API_AND_PERSISTENCE', candidateSha: state.sha, controlSha: state.controlSha, controlPolicyDigest: controlPolicyDigest(), runId: state.runId, contract: state.receipt.contract, install: 'CLEAN_REGISTRY_IGNORE_SCRIPTS', credentialRemovedBeforeCandidateExecution: true, privatePackageArtifactsPublished: false, tests: 'PASS', typecheck: 'PASS', build: 'PASS', productDeploymentPerformed: false, customerIdentityAdapterVerified: false}, null, 2))
  output('proof_sha', state.sha)
}
async function verify() {
  const sha = process.env.EXPECTED_SHA
  if (!shaPattern.test(sha ?? '')) fail('CANDIDATE_SHA_MISMATCH')
  await checkEnvironment()
  const workflow = (await api(`repos/${REPOSITORY}/actions/workflows/platform-contracts-ci.yml`)).data
  const listed = (await api(`repos/${REPOSITORY}/actions/workflows/${workflow.id}/runs?branch=main&status=success&per_page=50`)).data.workflow_runs
  const current = (await api(`repos/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`)).data
  const runs = current.head_branch === 'main' && current.event === 'push' ? [current, ...listed.filter(r => r.id !== current.id)] : listed
  for (const run of runs) {
    const artifacts = (await api(`repos/${REPOSITORY}/actions/runs/${run.id}/artifacts`)).data.artifacts.filter(a => a.name === ARTIFACT && !a.expired)
    if (artifacts.length !== 1) continue
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'controlled-proof-'))
    try {
      const downloaded = spawnSync('gh', ['run', 'download', String(run.id), '--repo', REPOSITORY, '--name', ARTIFACT, '--dir', directory], {stdio: 'pipe'})
      if (downloaded.status !== 0 || fs.readdirSync(directory).join(',') !== 'proof.json' || fs.statSync(path.join(directory, 'proof.json')).size > 16384) continue
      const p = readJson(path.join(directory, 'proof.json'))
      if (p.candidateSha !== sha) continue
      const jobs = String(run.id) === process.env.GITHUB_RUN_ID ? (await api(`repos/${REPOSITORY}/actions/runs/${run.id}/jobs`)).data.jobs : []
      assertProof(p, run, sha, workflow.id, {currentRunId: process.env.GITHUB_RUN_ID, currentRef: process.env.GITHUB_REF, completedJobs: jobs})
      const sourceFiles = await Promise.all(policyFiles.map(async name => Buffer.from((await api(`repos/${REPOSITORY}/contents/${name}?ref=${run.head_sha}`)).data.content, 'base64')))
      const actualControl = createHash('sha256'); for (const bytes of sourceFiles) actualControl.update(bytes)
      if (actualControl.digest('hex') !== p.controlPolicyDigest) fail('CONTROL_POLICY_PROVENANCE_MISMATCH')
      const sourceReceipt = JSON.parse(Buffer.from((await api(`repos/${REPOSITORY}/contents/apps/sg-runtime/operation-integration.json?ref=${sha}`)).data.content, 'base64').toString('utf8'))
      assertReceipt(sourceReceipt)
      if (JSON.stringify(p.contract) !== JSON.stringify(sourceReceipt.contract)) fail('CONTRACT_PROVENANCE_MISMATCH')
      console.log(`Verified actual SG2 tests/build for ${sha}: https://github.com/${REPOSITORY}/actions/runs/${run.id}`)
      return
    } finally {fs.rmSync(directory, {recursive: true, force: true})}
  }
  fail('CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const commands = {resolve, 'check-candidate': checkCandidate, install, proof, verify}
    const command = commands[process.argv[2]]
    if (!command) fail('UNKNOWN_CONTROLLED_CI_COMMAND')
    await command()
  } catch (error) {console.error(error.message?.match(/^[A-Z][A-Z0-9_]+$/) ? error.message : 'CONTROLLED_CI_FAILED_CLOSED'); process.exitCode = 1}
}
