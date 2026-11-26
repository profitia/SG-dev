import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'
import { canonical, gitReader, inspectSource, isOid, readGitHubSnapshot, sha256 } from './source-admission/source.mjs'

const repository = 'profitia/SG-dev'
const repoId = 1247665550
const owner = 275643368
const workflowId = 383640662
const workflowPath = '.github/workflows/platform-contracts-ci.yml'
const dashboardJob = 'SG2 dashboard source regression'
const publisherJob = 'Publish GV-02 R1 proof'
const chartPath = 'apps/dashboard-preview/components/raw-data-view/magicpath/CanonChartTimePresets.tsx'
const r1Paths = { [chartPath]: 'Dashboard Preview' }
const beforeBlob = 'dec11d1e3d4378a0e173e57c0ec65a3efee1c150'
const afterBlob = 'e3a0d7781080e769a13340d4224037a4dc1b596e'
const api = '/repos/' + repository
const maxZip = 1024 * 1024

function git(cwd, ...args) {
  return execFileSync('git', ['--no-replace-objects', ...args], {
    cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH, LANG: 'C', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
  }).trim()
}

export function assertTrialDelta(source) {
  assert.equal(source.files.length, 1)
  const [file] = source.files
  assert.deepEqual([file.path, file.owner, file.change, file.before?.mode, file.after?.mode],
    [chartPath, r1Paths[chartPath], 'M', '100644', '100644'])
  assert.equal(file.before.oid, beforeBlob)
  assert.equal(file.after.oid, afterBlob)
}

export function checkDashboardDescriptor(proof, head) {
  assert.equal(proof.projectKey, 'SG2')
  assert.equal(proof.targetEnvironment, 'development')
  assert.equal(proof.scope, 'DASHBOARD_SOURCE_REGRESSION')
  assert.equal(proof.validationSha, head)
  assert.equal(proof.candidateHeadSha, head)
  assert.deepEqual([proof.tests, proof.typecheck, proof.build, proof.productionHttpRefusal],
    ['PASS', 'PASS', 'PASS', 'PASS'])
  assert.equal(proof.productDeploymentPerformed, false)
}

export function policySettings(blob) {
  assert.ok(isOid(blob))
  return { schema: 'sg-gv-02/executor/v1',
    producer: { workflowId, path: workflowPath, blob, job: publisherJob } }
}

function readArtifact(artifact, bytes, runnerTemp) {
  assert.equal(bytes.length, artifact.size_in_bytes)
  assert.equal('sha256:' + sha256(bytes), artifact.digest)
  const dir = mkdtempSync(join(runnerTemp, 'gv02-dashboard-'))
  try {
    const zip = join(dir, 'proof.zip')
    writeFileSync(zip, bytes, { flag: 'wx', mode: 0o600 })
    const unzip = args => execFileSync('/usr/bin/unzip', args, { encoding: 'utf8', maxBuffer: 16384, timeout: 3000 })
    assert.equal(unzip(['-Z1', zip]), 'dashboard-source-proof.json\n')
    return JSON.parse(unzip(['-p', zip, 'dashboard-source-proof.json']))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export async function dashboardReceipt(read, download, runId, snap, runnerTemp) {
  const runPath = api + '/actions/runs/' + runId
  function checkRun(run) {
    assert.equal(run.id, runId)
    assert.equal(run.workflow_id, workflowId)
    assert.equal(run.path, workflowPath)
    assert.equal(run.event, 'pull_request')
    assert.equal(run.head_sha, snap.pr.head.sha)
    assert.equal(run.head_branch, snap.pr.head.ref)
    assert.equal(run.repository?.id, repoId)
    assert.equal(run.head_repository?.id, repoId)
    assert.equal(run.status, 'completed')
    // An independent Dashboard job can pass even when a different job in the same run fails.
    // No status of another job is inferred or replaced by this receipt.
    assert.ok(['success', 'failure'].includes(run.conclusion))
    assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0)
    if (run.pull_requests?.length) {
      assert.ok(run.pull_requests.some(p => p.number === snap.pr.number && p.head?.sha === snap.pr.head.sha))
    }
  }
  const run = await read(runPath)
  checkRun(run)
  const attemptPath = runPath + '/attempts/' + run.run_attempt
  const [attempt, jobs, artifacts] = await Promise.all([
    read(attemptPath), read(attemptPath + '/jobs?per_page=100'),
    read(runPath + '/artifacts?name=sg2-dashboard-source-proof&per_page=100'),
  ])
  checkRun(attempt)
  assert.equal(attempt.run_attempt, run.run_attempt)
  assert.equal(jobs.total_count, jobs.jobs.length)
  const matches = jobs.jobs.filter(job => job.name === dashboardJob)
  assert.equal(matches.length, 1)
  const [job] = matches
  assert.equal(job.conclusion, 'success')
  const checkUrl = job.check_run_url
  const match = /^https:\/\/api\.github\.com\/repos\/profitia\/SG-dev\/check-runs\/([1-9][0-9]*)$/i.exec(checkUrl ?? '')
  assert.ok(match)
  const check = await read(api + '/check-runs/' + match[1])
  assert.deepEqual([check.id, check.name, check.app?.id, check.head_sha, check.check_suite?.id,
    check.status, check.conclusion], [Number(match[1]), dashboardJob, 15368, snap.pr.head.sha,
    run.check_suite_id, 'completed', 'success'])
  assert.equal(artifacts.total_count, 1)
  const [candidateArtifact] = artifacts.artifacts
  assert.ok(Number.isSafeInteger(candidateArtifact.id) && candidateArtifact.id > 0)
  const artifactPath = api + '/actions/artifacts/' + candidateArtifact.id
  const artifact = await read(artifactPath)
  assert.equal(artifact.id, candidateArtifact.id)
  assert.equal(artifact.digest, candidateArtifact.digest)
  assert.equal(artifact.name, 'sg2-dashboard-source-proof')
  assert.equal(artifact.expired, false)
  const createdAt = Date.parse(artifact.created_at)
  assert.ok(createdAt >= Date.parse(job.started_at) && createdAt <= Date.parse(job.completed_at))
  assert.ok(Number.isSafeInteger(artifact.id) && artifact.id > 0)
  assert.ok(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= maxZip)
  assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual([artifact.workflow_run?.id, artifact.workflow_run?.repository_id,
    artifact.workflow_run?.head_repository_id, artifact.workflow_run?.head_sha],
  [runId, repoId, repoId, snap.pr.head.sha])
  checkDashboardDescriptor(readArtifact(artifact, await download(artifactPath + '/zip'), runnerTemp),
    snap.pr.head.sha)
  const [freshRun, freshArtifact] = await Promise.all([read(runPath), read(artifactPath)])
  checkRun(freshRun)
  assert.equal(freshRun.run_attempt, run.run_attempt)
  assert.deepEqual(freshArtifact, artifact)
  return { run: runId, attempt: run.run_attempt, check: check.id, artifact: artifact.id, digest: artifact.digest }
}

async function main(stage, env) {
  assert.ok(['prepare', 'publish'].includes(stage))
  const { GH_TOKEN, RUNNER_TEMP, GITHUB_SHA: main, GITHUB_EVENT_PATH } = env
  assert.ok(GH_TOKEN && RUNNER_TEMP && GITHUB_EVENT_PATH)
  assert.ok(isOid(main) && env.GITHUB_WORKFLOW_SHA === main)
  assert.deepEqual([env.GITHUB_REPOSITORY, env.GITHUB_REPOSITORY_ID, env.GITHUB_REF,
    env.GITHUB_ACTOR_ID, env.GITHUB_TRIGGERING_ACTOR, env.GITHUB_RUN_ATTEMPT, env.GITHUB_EVENT_NAME,
    env.GITHUB_WORKFLOW_REF], [repository, String(repoId), 'refs/heads/main', String(owner), 'profitia',
    '1', 'workflow_dispatch', repository + '/' + workflowPath + '@refs/heads/main'])
  const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'))
  assert.equal(event.sender?.id, owner)
  assert.equal(event.repository?.id, repoId)
  assert.equal(event.inputs?.mode, 'publish-gv02-r1-proof')
  const { candidate_pr, expected_sha, proof_run_id, evidence_expected_main, evidence_expected_tree } = event.inputs
  assert.equal(evidence_expected_main, main)
  assert.ok(isOid(expected_sha) && isOid(evidence_expected_tree))
  assert.match(candidate_pr, /^[1-9][0-9]*$/)
  assert.match(proof_run_id, /^[1-9][0-9]*$/)
  const pr = Number(candidate_pr)
  const runId = Number(proof_run_id)
  const run = Number(env.GITHUB_RUN_ID)
  assert.ok([pr, runId, run].every(Number.isSafeInteger) && run > 0 && run !== runId)
  const cwd = process.cwd()
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), main)
  const read = async path => {
    assert.ok(path === api || path.startsWith(api + '/'))
    const res = await fetch('https://api.github.com' + path, {
      headers: { Authorization: 'Bearer ' + GH_TOKEN, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000), redirect: 'error',
    })
    assert.equal(res.status, 200)
    return res.json()
  }
  const snap = await readGitHubSnapshot(read, repository, pr)
  assert.equal(snap.main, main)
  assert.equal(snap.pr.head.sha, expected_sha)
  assert.equal(snap.pr.draft, false)
  assert.equal(snap.pr.mergeable, true)
  assert.equal(snap.pr.user?.id, owner)
  git(cwd, 'fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/' + repository + '.git',
    'refs/pull/' + pr + '/merge')
  const reader = gitReader(cwd)
  const workflow = reader.entry(main, workflowPath)
  assert.equal(reader.entry(expected_sha, workflowPath)?.oid, workflow.oid)
  assert.deepEqual(reader.commit(expected_sha).parents, [main])
  const { producer } = policySettings(workflow.oid)
  const policy = { repository, repoId, repoOwnerId: owner, r1Paths, producer }
  const policyDigest = sha256(canonical(policy))
  const resolveRoute = path => resolveProjectRouting({
    profile: resolveProjectProfile('SG2', cwd), targets: [path], repositoryRoot: cwd,
  }).results.find(route => route.projectBoundaryStatus === 'ALLOWED')
  const source = inspectSource(snap, reader, { ...policy, resolveRoute })
  assertTrialDelta(source)
  assert.equal(source.integrationTree, evidence_expected_tree)
  assert.equal(reader.commit(expected_sha).tree, source.integrationTree)
  const download = path => execFileSync('gh', ['api', path], {
    timeout: 20000, maxBuffer: maxZip,
    env: { PATH: env.PATH, GH_TOKEN, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' },
  })
  const dashboard = await dashboardReceipt(read, download, runId, snap, RUNNER_TEMP)
  const binding = { repository, pr, main, head: expected_sha, tree: source.integrationTree,
    sourceDigest: source.sourceDigest, policyDigest }
  const embeddedInputs = ['apps/dashboard-preview/package-lock.json', 'packages/srm-adp-ui/package-lock.json',
    'apps/sg-runtime/tests/assistant-chart-context.test.ts', 'apps/sg-runtime/scripts/with-cross-host-local-packages.mjs']
  const inputsDigest = sha256(canonical({ binding, dashboard,
    embeddedInputs: embeddedInputs.map(path => [path, reader.entry(source.testMerge, path).oid]) }))
  const state = { binding, testMerge: source.testMerge, dashboard, inputsDigest }
  const statePath = join(RUNNER_TEMP, 'gv02-r1-state.json')
  const candidate = join(RUNNER_TEMP, 'gv02-r1-candidate')
  if (stage === 'prepare') {
    git(cwd, 'worktree', 'add', '--detach', candidate, source.testMerge)
    writeFileSync(statePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 })
    return
  }

  assert.equal(env.GV02_EMBEDDED_OUTCOME, 'success')
  assert.deepEqual(state, JSON.parse(readFileSync(statePath, 'utf8')))
  assert.equal(git(candidate, 'rev-parse', 'HEAD'), source.testMerge)
  assert.equal(git(candidate, 'rev-parse', 'HEAD^{tree}'), source.integrationTree)
  assert.equal(git(candidate, 'status', '--porcelain', '--untracked-files=no'), '')
  const fresh = await readGitHubSnapshot(read, repository, pr)
  assert.equal(fresh.main, main)
  assert.equal(fresh.pr.head.sha, expected_sha)
  assert.equal(fresh.pr.draft, false)
  assert.equal(fresh.pr.state, 'open')
  assert.equal(fresh.pr.mergeable, true)
  assert.deepEqual(fresh.testMerge, snap.testMerge)
  writeFileSync(join(RUNNER_TEMP, 'gv02-r1-proof.json'), JSON.stringify({
    schema: 'sg-gv-02/r1-evidence/v1', run, attempt: 1, binding, scope: 'PRESENTATION_ONLY',
    complete: true, protectedInputsUnchanged: true, inputsDigest, dashboard,
    checks: { dashboard: 'PASS', embedded: 'PASS', typecheck: 'PASS', build: 'PASS' },
  }) + '\n', { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv[2], process.env).catch(error => {
    console.error('GV-02 evidence publication refused:', error.code ?? error.name)
    process.exitCode = 1
  })
}
