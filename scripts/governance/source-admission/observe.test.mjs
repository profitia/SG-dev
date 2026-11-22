import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { test } from 'node:test'
import { bindSource, produce, signEnvelope } from './gate.mjs'
import { observePullRequest } from './observe.mjs'
import { canonical, gitReader, inspectSource, sha256 } from './source.mjs'

const repository = 'example/fixture'
const prefix = '/repos/' + repository
const pullNumber = 7
const runId = 9
const artifactId = 12
const bundle = '/actions/runs/' + runId
const archive = '/actions/artifacts/' + artifactId

function fixture(t, { risk = 'R4', stale = false, drift = false, wrongScope = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gv01b-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const zipDirectory = join(root, 'zip')
  mkdirSync(zipDirectory)
  const git = (...args) => execFileSync('git', args, {
    cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString().trim()
  const write = (file, text) => {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }

  git('init', '-b', 'main')
  git('config', 'user.name', 'Synthetic Fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  const input = 'Canon/registries/current-architecture-baseline-v1.json'
  for (const path of [
    input, 'Canon/registries/profitia-projects-v1.json',
    'scripts/architecture-classify.mjs', 'scripts/governance/routing-engine.mjs',
    'docs/routine.txt', '.github/workflows/controlled.yml',
  ]) write(path, 'initial\n')
  git('add', 'Canon', 'scripts', 'docs', '.github')
  git('commit', '-qm', 'synthetic base')
  const authoritySha = git('rev-parse', 'HEAD')
  git('checkout', '-qb', 'candidate')
  const file = risk === 'R1' ? 'docs/routine.txt' : '.github/workflows/controlled.yml'
  write(file, 'changed\n')
  git('add', file)
  git('commit', '-qm', 'synthetic change')
  const head = git('rev-parse', 'HEAD')
  git('checkout', '-q', 'main')
  git('merge', '--no-ff', '-qm', 'synthetic test merge', head)
  const testMergeSha = git('rev-parse', 'HEAD')
  const tree = git('rev-parse', 'HEAD^{tree}')
  git('checkout', '-qb', 'fresh-main', authoritySha)
  write(drift ? input : 'unrelated.txt', 'new base\n')
  git('add', drift ? input : 'unrelated.txt')
  git('commit', '-qm', 'synthetic newer commit')
  const main = stale || drift ? git('rev-parse', 'HEAD') : authoritySha

  const repo = { id: 1, full_name: repository, owner: { id: 2 } }
  const pr = {
    number: pullNumber, state: 'open', draft: false, merged: false,
    head: { sha: head, repo: { id: 1 } }, base: { ref: 'main', repo: { id: 1 } },
    merge_commit_sha: testMergeSha,
  }
  const config = {
    schema: 'sg-gv-01b-observation/v1', mode: 'observation',
    repository, repoId: 1, repoOwnerId: 2, authoritySha, appVersion: '1',
    r1Paths: { 'docs/routine.txt': 'Product' },
    evidence: { controlSha: authoritySha, controlBranch: 'control', workflowId: 3, actorId: 4,
      workflowPath: '.github/workflows/controlled.yml' },
  }
  const policyBytes = Buffer.from(canonical(config))
  const expectedDigest = sha256(policyBytes)
  const resolveRoute = path => ({
    currentOwner: path.startsWith('.github') ? 'Governance Source Layer' : 'Product',
    baselineClassification: 'ALIGNED', projectBoundaryStatus: wrongScope ? 'DENIED' : 'ALLOWED',
  })
  const data = new Map([
    [prefix, repo], [prefix + '/git/ref/heads/main', { object: { sha: main } }],
    [prefix + '/pulls/' + pullNumber, pr], [
      prefix + '/compare/' + main + '...' + head, { merge_base_commit: { sha: authoritySha } },
    ],
    [prefix + '/git/commits/' + testMergeSha, { sha: testMergeSha, tree: { sha: tree },
      parents: [authoritySha, head].map(sha => ({ sha })) }],
  ])
  const reads = []
  const readGitHub = async path => {
    reads.push(path)
    assert(data.has(path), 'Unexpected read ' + path)
    return structuredClone(data.get(path))
  }
  const options = { policyBytes, expectedDigest, resolveRoute, readGitHub,
    git: gitReader(root), pullNumber, clock: () => 10 }
  const testMerge = { sha: testMergeSha, tree, parents: [authoritySha, head] }
  return { options, config, root, data, reads, zipDirectory,
    snapshot: { repo, pr, main, mergeBase: authoritySha, testMerge } }
}

async function signed(t, options) {
  const scenario = fixture(t, options)
  const { config, zipDirectory, data, snapshot, options: base } = scenario
  const policy = { ...config, digest: base.expectedDigest, resolveRoute: base.resolveRoute }
  const source = inspectSource(snapshot, base.git, policy)
  const producer = generateKeyPairSync('ed25519')
  const owner = generateKeyPairSync('ed25519')
  const verifier = generateKeyPairSync('ed25519')
  const trust = {
    appId: 99, owner: { id: 'owner', publicKey: owner.publicKey },
    producer: { id: 'producer', publicKey: producer.publicKey },
    verifier: { id: 'verifier', publicKey: verifier.publicKey },
  }
  const binding = bindSource(source, policy, trust)
  const decision = signEnvelope('owner', 'owner', { binding, id: 'approval', validFrom: 0, validUntil: 100 }, owner.privateKey)
  const state = { digest: sha256(canonical(decision)), active: true, used: false }
  const grantState = async () => state
  const descriptor = {
    repo: 1, pr: pullNumber, head: source.head, base: source.main, merge: source.testMerge,
    tree: source.integrationTree, sourceDigest: options?.incorrectDigest ? '0'.repeat(64) : source.sourceDigest,
    policyDigest: policy.digest, control: config.authoritySha, run: runId, attempt: 1,
  }
  writeFileSync(join(zipDirectory, 'evidence.json'), JSON.stringify(descriptor))
  const bytes = execFileSync('/usr/bin/zip', ['-q', '-', 'evidence.json'], { cwd: zipDirectory })
  const digest = sha256(bytes)
  const runRecord = {
    id: runId, run_attempt: 1, status: 'completed', conclusion: 'success', event: 'workflow_dispatch',
    repository: { id: 1 }, head_repository: { id: 1 }, head_sha: config.authoritySha, head_branch: 'control',
    workflow_id: 3, path: config.evidence.workflowPath, actor: { id: 4 }, triggering_actor: { id: 4 },
  }
  data.set(prefix + bundle, runRecord)
  data.set(prefix + bundle + '/attempts/1', { ...runRecord })
  data.set(prefix + archive, {
    id: artifactId, expired: false, size_in_bytes: bytes.length, name: 'source-admission-evidence',
    digest: 'sha256:' + digest, workflow_run: { id: runId, repository_id: 1,
      head_repository_id: 1, head_sha: config.authoritySha, head_branch: 'control' },
  })
  const proof = await produce({ observe: async () => source, policy, trust, decision, grantState,
    attestedRun: { id: runId + '/1/' + artifactId, digest, result: 'PASS', binding },
    clock: base.clock, privateKey: producer.privateKey })
  const downloadZip = async (path, cap) => {
    assert.equal(path, prefix + archive + '/zip')
    assert.equal(cap, 1048576)
    return bytes
  }
  return { ...scenario, options: { ...base, trust, decision, proof, grantState, downloadZip,
    verifierKey: verifier.privateKey }, state, runRecord }
}

test('R1 does not call R4 grant, action or download adapters and never authorizes merge', async t => {
  const { options, reads } = fixture(t, { risk: 'R1' })
  const unavailable = () => { assert.fail('R4 dependency used for R1') }
  const result = await observePullRequest({ ...options, grantState: unavailable, downloadZip: unavailable })
  assert.deepEqual(result, { status: 'NOT_APPLICABLE', reason: 'EXISTING_CONTROLS_ONLY',
    route: 'R1', mode: 'observation', mergeAuthority: false })
  assert(reads.every(path => !path.includes('/actions/')))
})

test('scope denied, stale base and drifted routing fail closed', async t => {
  for (const [kind, reason] of [['wrongScope', 'ROUTING_NOT_PROVEN'], ['stale', 'INTEGRATION_PARENTS_STALE'],
    ['drift', 'ROUTING_AUTHORITY_MOVED']]) {
    const { options } = fixture(t, { [kind]: true })
    assert.equal((await observePullRequest(options)).reason, reason)
  }
})

test('policy bytes must match the detached digest before any remote read', async t => {
  const { options, reads } = fixture(t)
  const result = await observePullRequest({ ...options, expectedDigest: '0'.repeat(64) })
  assert.equal(result.reason, 'TRUST_POLICY_DIGEST_MISMATCH')
  assert.equal(reads.length, 0)
})

test('R4 observation requires owner decision, distinct roles, original run and original archive', async t => {
  const { options, reads } = await signed(t)
  const result = await observePullRequest(options)
  assert.equal(result.status, 'PASS', result.reason)
  assert.equal(result.mergeAuthority, false)
  assert.equal(reads.filter(path => path === prefix + bundle).length, 2)
  const wrongTrust = { ...options.trust, producer: { ...options.trust.owner, id: 'producer' } }
  assert.equal((await observePullRequest({ ...options, trust: wrongTrust })).reason, 'INDEPENDENCE_REQUIRED')
})

test('R4 denies wrong workflow attempt, bytes and embedded source binding', async t => {
  const { options, data, runRecord } = await signed(t)
  const attemptPath = prefix + bundle + '/attempts/1'
  data.get(attemptPath).workflow_id = 100
  assert.equal((await observePullRequest(options)).reason, 'ORIGINAL_WORKFLOW_OR_ATTEMPT_REJECTED')
  data.set(attemptPath, { ...runRecord })
  const corrupt = async () => Buffer.from('not the archive')
  assert.equal((await observePullRequest({ ...options, downloadZip: corrupt })).reason, 'ORIGINAL_ARTIFACT_BYTES_REJECTED')
  const mismatch = await signed(t, { incorrectDigest: true })
  assert.equal((await observePullRequest(mismatch.options)).reason, 'ORIGINAL_ARTIFACT_SOURCE_MISMATCH')
})

test('R4 denies revoked or already used grants, and notices rerun during artifact download', async t => {
  const { options, state, runRecord } = await signed(t)
  state.active = false
  assert.equal((await observePullRequest(options)).reason, 'OWNER_DECISION_UNAVAILABLE_REVOKED_OR_USED')
  state.active = true
  state.used = true
  assert.equal((await observePullRequest(options)).reason, 'OWNER_DECISION_UNAVAILABLE_REVOKED_OR_USED')
  state.used = false
  assert.equal((await observePullRequest({ ...options, clock: () => 100 })).reason, 'OWNER_DECISION_NOT_CURRENT')
  const downloadZip = async (...args) => {
    const bytes = await options.downloadZip(...args)
    runRecord.run_attempt++
    return bytes
  }
  assert.equal((await observePullRequest({ ...options, downloadZip })).reason, 'ORIGINAL_EVIDENCE_CHANGED')
})
