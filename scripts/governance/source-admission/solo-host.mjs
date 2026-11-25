import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { bindSource, produce } from './gate.mjs'
import { observePullRequest, originalGitHubRun } from './observe.mjs'
import { canonical, gitReader, inspectSource, readGitHubSnapshot, sha256 } from './source.mjs'
import { resolveProjectProfile } from '../project-profile.mjs'
import { resolveProjectRouting } from '../routing-engine.mjs'

const repo = 'profitia/SG-dev'
const owner = 275643368
const pullNumber = 1325
const main = '58e6891e4232111ac2e6932a30b0c6b4d4372faf'
const head = '8cc552056a04aa42db482a645474916149f789bf'
const tree = '7049ce485c57ffb9e4a5dddca4748c6908b6ba0b'
const sourceDigest = '131620e1dace991249c98e067de962bc57e53afa9a2340ab216ff39182aa883a'
const policyDigest = 'c8b1b5b830a0a802776dfae976e2dbc361a1549d76107aeda9d196b618dea903'
const ref = 'refs/heads/governance/gv01b-control'
const api = '/repos/' + repo
const githubId = value => Number.isSafeInteger(value) && value > 0

export function getBytes(endpoint, maxBuffer = 1024 * 1024) {
  assert.equal(typeof endpoint, 'string')
  assert.ok(endpoint === api || endpoint.startsWith(api + '/'))
  return execFileSync('gh', ['api', endpoint], { timeout: 30_000, maxBuffer, stdio: ['ignore', 'pipe', 'pipe'] })
}

export function get(endpoint) {
  return JSON.parse(getBytes(endpoint).toString('utf8'))
}

function jsonFile(filename) {
  return JSON.parse(readFileSync(filename, 'utf8'))
}

async function runObservation() {
  const [role, producerEnvelopePath, output] = process.argv.slice(2)
  assert.ok(role === 'producer' || role === 'verifier')
  assert.equal(process.env.GITHUB_REPOSITORY, repo)
  assert.equal(process.env.GITHUB_REPOSITORY_ID, '1247665550')
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch')
  assert.equal(process.env.GITHUB_REF, ref)
  assert.equal(process.env.GITHUB_WORKFLOW_REF, repo + '/.github/workflows/platform-contracts-ci.yml@' + ref)
  assert.equal(process.env.GITHUB_ACTOR_ID, String(owner))
  assert.equal(process.env.GITHUB_TRIGGERING_ACTOR, 'profitia')
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1')
  assert.ok(process.env.GH_TOKEN)
  const isolatedKey = createPrivateKey(process.env.GV01B_ROLE_KEY)
  delete process.env.GV01B_ROLE_KEY
  assert.equal(isolatedKey.asymmetricKeyType, 'ed25519')

  const pins = jsonFile(new URL('./solo-trust.json', import.meta.url))
  assert.equal(pins.appId, 5871888)
  assert.ok(githubId(pins.decisionCommentId) && githubId(pins.publisherRunId) && githubId(pins.publisherArtifactId))
  const active = get(api + '/git/ref/heads/governance/gv01b-control')
  assert.equal(active.object.sha, process.env.GITHUB_SHA)
  const repoRoot = process.cwd()
  const git = gitReader(repoRoot)
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), active.object.sha)
  const policyBytes = readFileSync(new URL('./solo-policy.json', import.meta.url))
  assert.equal(sha256(policyBytes), policyDigest)
  const profile = resolveProjectProfile('ARCHITECTURE')
  const resolveRoute = path => {
    const route = resolveProjectRouting({ profile, targets: [path], repositoryRoot: repoRoot })
    return route.ok && route.results[0]?.projectBoundaryStatus === 'ALLOWED' ? route.results[0] : null
  }
  const policy = { ...JSON.parse(policyBytes), digest: policyDigest, resolveRoute }
  const trust = { appId: pins.appId }
  for (const name of ['owner', 'producer', 'verifier']) {
    const pin = pins[name]
    assert.ok(/^[A-Za-z0-9_-]{1,80}$/.test(pin.id))
    const publicKey = createPublicKey(pin.publicKey)
    assert.equal(publicKey.asymmetricKeyType, 'ed25519')
    assert.equal(sha256(publicKey.export({ format: 'der', type: 'spki' })), pin.fingerprint)
    trust[name] = { id: pin.id, publicKey }
  }

  const snapshot = await readGitHubSnapshot(get, repo, pullNumber)
  const source = inspectSource(snapshot, git, policy)
  assert.equal(source.main, main)
  assert.equal(source.head, head)
  assert.equal(source.integrationTree, tree)
  assert.equal(source.sourceDigest, sourceDigest)
  assert.equal(source.risk, 'R4')
  assert.equal(source.draft, false)
  const binding = bindSource(source, policy, trust)

  function readDecision() {
    const comment = get(api + '/issues/comments/' + pins.decisionCommentId)
    assert.equal(comment.id, pins.decisionCommentId)
    assert.equal(comment.user.id, owner)
    assert.equal(comment.issue_url, 'https://api.github.com' + api + '/issues/1325')
    assert.ok(Buffer.byteLength(comment.body) <= 16_384)
    return JSON.parse(comment.body)
  }

  const decision = readDecision()
  const decisionId = 'gh-comment-' + pins.decisionCommentId
  assert.equal(decision.payload.id, decisionId)
  const decisionDigest = sha256(canonical(decision))
  async function grantState(id) {
    assert.equal(id, decisionId)
    const pull = get(api + '/pulls/1325')
    const digest = sha256(canonical(readDecision()))
    const active = pull.state === 'open' && pull.draft === false && pull.head?.sha === head && digest === decisionDigest
    return { digest, active, used: pull.merged !== false }
  }

  assert.ok(output && process.env.RUNNER_TEMP &&
    output === process.env.RUNNER_TEMP + '/gv01b-' + role + '.json')
  assert.equal(sha256(createPublicKey(isolatedKey).export({ format: 'der', type: 'spki' })), pins[role].fingerprint)

  const downloadZip = getBytes
  const result = role === 'producer'
    ? await produce({ policy, trust, decision, grantState, clock: Date.now, privateKey: isolatedKey,
        observe: async () => inspectSource(await readGitHubSnapshot(get, repo, pullNumber), git, policy),
        attestedRun: (await originalGitHubRun({ get, downloadZip, policy, binding,
          runId: pins.publisherRunId, attempt: 1, artifactId: pins.publisherArtifactId })).run })
    : await observePullRequest({ policyBytes, expectedDigest: policyDigest, resolveRoute, readGitHub: get, git,
        pullNumber, trust, decision, proof: jsonFile(producerEnvelopePath), grantState,
        downloadZip, verifierKey: isolatedKey })

  assert.ok(role === 'producer' ? result.role === 'producer' : result.status === 'PASS')
  writeFileSync(output, JSON.stringify(result) + '\n', { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runObservation()
