import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertProof, GV_01B_REVIEW, resolveCandidateAdmission } from './controlled-package-ci.mjs'

const repository = 'profitia/SG-dev'
const repo = 1247665550
const owner = 275643368
const pr = 1325
const head = GV_01B_REVIEW.sourceSha
const nativeWorkflow = 383640662
const nativePath = '.github/workflows/platform-contracts-ci.yml'
const api = '/repos/' + repository
const zipLimit = 1024 * 1024
const oid = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  return JSON.stringify(value)
}

export function checkNativeRun(run, id, main) {
  assert.equal(run.id, id)
  assert.equal(run.repository?.id, repo)
  assert.equal(run.head_repository?.id, repo)
  assert.equal(run.workflow_id, nativeWorkflow)
  assert.equal(run.path, nativePath)
  assert.equal(run.head_sha, main)
  assert.equal(run.head_branch, 'main')
  assert.equal(run.event, 'workflow_dispatch')
  assert.equal(run.actor?.id, owner)
  assert.equal(run.triggering_actor?.id, owner)
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0)
  assert.equal(run.status, 'completed')
  assert.equal(run.conclusion, 'success')
}

export function checkNativeArtifact(artifact, sourceRun, bytes) {
  assert.equal(artifact.name, 'sg2-controlled-operation-proof')
  assert.equal(artifact.expired, false)
  assert.equal(artifact.workflow_run?.id, sourceRun.id)
  assert.equal(artifact.workflow_run?.repository_id, repo)
  assert.equal(artifact.workflow_run?.head_repository_id, repo)
  assert.equal(artifact.workflow_run?.head_sha, sourceRun.head_sha)
  assert.equal(artifact.workflow_run?.head_branch, 'main')
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= zipLimit)
  assert.equal(artifact.size_in_bytes, bytes.length)
  assert.equal(artifact.digest, 'sha256:' + digest(bytes))
}

export function scopedFiles(raw, readBlob) {
  const records = new TextDecoder('utf-8', { fatal: true }).decode(raw).split('\0')
  assert.equal(records.pop(), '')
  assert.equal(records.length, Object.keys(GV_01B_REVIEW.entries).length * 2)
  const paths = new Set()
  const files = []
  for (let index = 0; index < records.length; index += 2) {
    const metadata = /^:000000 (100644) 0{40} ([a-f0-9]{40}) A$/.exec(records[index])
    assert.ok(metadata)
    const path = records[index + 1]
    const pin = GV_01B_REVIEW.entries[path]
    assert.ok(pin && !paths.has(path))
    paths.add(path)
    const [, mode, blob] = metadata
    assert.equal(mode, pin.mode)
    assert.equal(blob, pin.sha)
    assert.equal(pin.status, 'added')
    const bytes = readBlob(blob)
    const actual = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex')
    assert.equal(actual, blob)
    files.push({ path, change: 'A', before: null, after: { oid: blob, mode, sha256: digest(bytes) }, owner: pin.owner })
  }
  return files
}

export function evidenceDescriptor({ main, merge, tree, files, policyDigest, run }) {
  return {
    repo, pr, head, base: main, merge, tree, sourceDigest: digest(canonical(files)),
    policyDigest, control: main, run, attempt: 1,
  }
}

function git(...args) {
  return execFileSync('git', ['--no-replace-objects', ...args], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 })
}

async function readProof(bytes, runnerTemp) {
  const dir = await mkdtemp(join(runnerTemp, 'e4-native-proof-'))
  try {
    const archive = join(dir, 'native.zip')
    await writeFile(archive, bytes, { flag: 'wx', mode: 0o600 })
    const unzip = flag => execFileSync('/usr/bin/unzip', flag === '-Z1' ? [flag, archive] : [flag, archive, 'proof.json'], { timeout: 3000, maxBuffer: 16384 })
    assert.equal(unzip('-Z1').toString('utf8'), 'proof.json\n')
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unzip('-p')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function main(env = process.env) {
  const main = env.E4_EXPECTED_MAIN
  const tree = env.E4_EXPECTED_TREE
  const policyDigest = env.E4_POLICY_DIGEST
  const proofRunId = Number(env.E4_PROOF_RUN)
  const run = Number(env.GITHUB_RUN_ID)
  assert.equal(env.GITHUB_REPOSITORY, repository)
  assert.equal(env.GITHUB_REPOSITORY_ID, String(repo))
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch')
  assert.equal(env.GITHUB_REF, 'refs/heads/main')
  assert.equal(env.GITHUB_WORKFLOW_REF, repository + '/' + nativePath + '@refs/heads/main')
  assert.equal(env.GITHUB_ACTOR_ID, String(owner))
  assert.equal(env.GITHUB_TRIGGERING_ACTOR, 'profitia')
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1')
  assert.ok(oid(main) && oid(tree) && /^[a-f0-9]{64}$/.test(policyDigest ?? ''))
  assert.ok(/^[1-9][0-9]*$/.test(env.E4_PROOF_RUN ?? '') && Number.isSafeInteger(proofRunId))
  assert.ok(Number.isSafeInteger(run) && run > 0 && run !== proofRunId)
  assert.ok(env.GH_TOKEN && env.RUNNER_TEMP && env.GITHUB_EVENT_PATH)
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'))
  assert.equal(event.inputs?.mode, 'publish-e4-source-evidence')
  assert.equal(env.GITHUB_SHA, main)
  assert.equal(git('rev-parse', 'HEAD').toString().trim(), main)

  const request = path => fetch('https://api.github.com' + path, {
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
    redirect: 'manual',
  })
  async function get(path) {
    const res = await request(path)
    assert.ok(res.ok, 'GitHub API read failed: ' + res.status)
    return res.json()
  }
  const prPath = api + '/pulls/' + pr
  async function snapshot() {
    const [ref, pull] = await Promise.all([get(api + '/git/ref/heads/main'), get(prPath)])
    assert.equal(ref.object.sha, main)
    assert.equal(pull.number, pr)
    assert.equal(pull.state, 'open')
    assert.equal(pull.merged, false)
    assert.equal(pull.head?.sha, head)
    assert.equal(pull.head?.repo?.id, repo)
    assert.equal(pull.base?.repo?.id, repo)
    assert.equal(pull.base?.ref, 'main')
    assert.equal(pull.base?.sha, main)
    assert.ok(oid(pull.merge_commit_sha))
    return pull.merge_commit_sha
  }

  const merge = await snapshot()
  const admission = await resolveCandidateAdmission({
    repository, ref: 'refs/heads/main', workflowRef: repository + '/' + nativePath + '@refs/heads/main',
    event: 'workflow_dispatch', actor: 'profitia', triggeringActor: 'profitia', controlSha: main,
  }, String(pr), head, async path => ({ data: await get('/' + path) }))
  assert.equal(admission.admission?.candidatePr, pr)

  git('fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/' + repository + '.git', 'refs/pull/' + pr + '/head', 'refs/pull/' + pr + '/merge')
  const mergeLine = git('show', '-s', '--format=%T %P', merge).toString().trim()
  assert.equal(mergeLine, tree + ' ' + main + ' ' + head)
  const mergeBase = git('merge-base', '--all', main, head).toString().trim()
  assert.ok(oid(mergeBase))
  const delta = (from, to) => git('diff-tree', '-r', '--raw', '--no-abbrev', '--no-commit-id', '--no-renames', '--no-ext-diff', '-z', from, to)
  const raw = delta(mergeBase, head)
  assert.deepEqual(delta(main, merge), raw)
  const files = scopedFiles(raw, blob => git('cat-file', 'blob', blob))

  const runPath = api + '/actions/runs/' + proofRunId
  const sourceRun = await get(runPath)
  checkNativeRun(sourceRun, proofRunId, main)
  const base = runPath + '/attempts/' + sourceRun.run_attempt
  const [attempt, jobData, artifactData] = await Promise.all([
    get(base), get(base + '/jobs?per_page=100'), get(runPath + '/artifacts?name=sg2-controlled-operation-proof&per_page=2'),
  ])
  checkNativeRun(attempt, proofRunId, main)
  assert.equal(attempt.run_attempt, sourceRun.run_attempt)
  const jobs = jobData.jobs.filter(job => job.name === 'SG2 controlled operation integration')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].conclusion, 'success')
  assert.equal(artifactData.total_count, 1)
  const artifact = artifactData.artifacts[0]
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0)
  assert.ok(artifact.size_in_bytes > 0 && artifact.size_in_bytes <= zipLimit)
  const res = await request(api + '/actions/artifacts/' + artifact.id + '/zip')
  assert.equal(res.status, 302)
  const storage = new URL(res.headers.get('location'))
  assert.ok(storage.protocol === 'https:' && !storage.username && !storage.password && !storage.port && /^[a-z0-9]+\.blob\.core\.windows\.net$/.test(storage.hostname))
  const archive = await fetch(storage, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  assert.ok(archive.ok && Number(archive.headers.get('content-length')) === artifact.size_in_bytes)
  const bytes = Buffer.from(await archive.arrayBuffer())
  checkNativeArtifact(artifact, sourceRun, bytes)
  const proof = await readProof(bytes, env.RUNNER_TEMP)
  assert.equal(proof.candidatePr, pr)
  assertProof(proof, sourceRun, head, nativeWorkflow)

  const [freshRun, freshArtifact, freshMerge] = await Promise.all([
    get(runPath), get(api + '/actions/artifacts/' + artifact.id), snapshot(),
  ])
  checkNativeRun(freshRun, proofRunId, main)
  assert.equal(freshRun.run_attempt, sourceRun.run_attempt)
  checkNativeArtifact(freshArtifact, freshRun, bytes)
  assert.equal(freshMerge, merge)

  const output = join(env.RUNNER_TEMP, 'e4-source-admission')
  await mkdir(output)
  // The observer verifies this descriptor against its own trusted policy and live Git snapshot.
  const descriptor = evidenceDescriptor({ main, merge, tree, files, policyDigest, run })
  await writeFile(join(output, 'evidence.json'), JSON.stringify(descriptor) + '\n', { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error('E4 evidence publication refused:', error.code ?? error.name)
    process.exitCode = 1
  })
}
