import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
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
export const automationActor = 41898282
export const controlBranch = 'governance/gv02-control-v2'
const automationLogin = 'github-actions[bot]'
const baselineWorkflow = 362561378
const governanceWorkflow = '.github/workflows/governance-preflight.yml'
const embeddedInputs = [
  'apps/dashboard-preview/package-lock.json',
  'apps/dashboard-preview/components/raw-data-view/magicpath-benchmark-chart.tsx',
  'apps/dashboard-preview/components/raw-data-view/index.tsx',
  'apps/dashboard-preview/components/raw-data-view/magicpath/chart-time-presets.ts',
  'packages/srm-adp-ui/package-lock.json',
  'apps/sg-runtime/tests/assistant-chart-context.test.ts',
  'apps/sg-runtime/scripts/with-cross-host-local-packages.mjs',
]
const labelKeys = ["'1M'", "'3M'", "'6M'", "'1Y'", "'3Y'", "'5Y'", 'All']
// Pin the reviewed display-only code shape, independently of the label values.
const routineViewShape = '1685b2cdd43ee9eee974c650f3c14532de7c0af17a02bc75051da844c7b6acb9'
const labelsBlock = /^const englishRangeLabels: Record<ChartTimePreset, string> = \{\n([^]*?)^\};$/m
const api = '/repos/' + repository
const maxZip = 1024 * 1024

export function routinePrPermitted(env, pr) {
  if (!Number.isSafeInteger(pr) || pr <= 0) return false
  const { GV02_ROUTINE_ENABLED, GV02_ROUTINE_MERGE_ENABLED, GV02_SHADOW_PR } = env
  if (!GV02_SHADOW_PR) return GV02_ROUTINE_ENABLED === 'true'
  return GV02_ROUTINE_ENABLED !== 'true' && GV02_ROUTINE_MERGE_ENABLED !== 'true' &&
    GV02_SHADOW_PR === String(pr)
}

function git(cwd, ...args) {
  return execFileSync('git', ['--no-replace-objects', ...args], {
    cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH, LANG: 'C', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
  }).trim()
}

function withoutDisplayLabels(contents) {
  const block = labelsBlock.exec(contents)
  if (!block) return null
  const rows = block[1].slice(0, -1).split('\n')
  if (rows.length !== labelKeys.length) return null
  for (const [index, key] of labelKeys.entries()) {
    const prefix = '  ' + key + ": '"
    const suffix = index === labelKeys.length - 1 ? "'" : "',"
    const line = rows[index]
    if (!line.startsWith(prefix) || !line.endsWith(suffix) ||
      !/^[\p{L}\p{N} .(),–-]{1,80}$/u.test(line.slice(prefix.length, -suffix.length))) return null
  }
  return contents.replace(labelsBlock, '<R1_CHART_DISPLAY_LABELS>')
}

export function readGitBlob(cwd, oid) {
  const bytes = execFileSync('git', ['--no-replace-objects', '-C', cwd, 'cat-file', 'blob', oid], {
    maxBuffer: 16 * 1024, timeout: 8000,
    env: { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  })
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
}

export function assertRoutineDelta(source, readBlob) {
  assert.equal(source.files.length, 1)
  const [file] = source.files
  assert.deepEqual([file.path, file.owner, file.change, file.before?.mode, file.after?.mode],
    [chartPath, r1Paths[chartPath], 'M', '100644', '100644'])
  const before = readBlob(file.before.oid)
  const after = readBlob(file.after.oid)
  const normalized = withoutDisplayLabels(before)
  assert.ok(normalized !== null && sha256(normalized) === routineViewShape &&
    normalized === withoutDisplayLabels(after) && before !== after,
    'R1_PRESENTATION_DELTA_REJECTED')
}

export function expectedR1Settings(blob) {
  assert.ok(isOid(blob))
  const producer = { workflowId, path: workflowPath, blob, job: publisherJob }
  return { schema: 'sg-gv-02/executor/v2', producer }
}

export function evidencePolicy(blob) {
  const { producer } = expectedR1Settings(blob)
  return { repository, repoId, repoOwnerId: owner, r1Paths, producer, impactPolicy: 'SG2_CHART_LABEL_VALUES_V1', viewShape: routineViewShape }
}

export function impactInputsDigest(reader, binding, testMerge, dashboard) {
  const inputs = embeddedInputs.map(path => {
    const base = reader.entry(binding.main, path)
    assert.ok(base && canonical(reader.entry(testMerge, path)) === canonical(base),
      'R1_EMBEDDED_INPUT_CHANGED')
    return [path, base.oid]
  })
  return sha256(canonical({ binding, dashboard, embeddedInputs: inputs }))
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

function readArtifact(artifact, bytes, runnerTemp, member = 'dashboard-source-proof.json') {
  assert.ok(bytes.length <= maxZip)
  assert.equal(bytes.length, artifact.size_in_bytes)
  assert.equal('sha256:' + sha256(bytes), artifact.digest)
  const dir = mkdtempSync(join(runnerTemp, 'gv02-dashboard-'))
  try {
    const zip = join(dir, 'proof.zip')
    writeFileSync(zip, bytes, { flag: 'wx', mode: 0o600 })
    const unzip = args => execFileSync('/usr/bin/unzip', args, { encoding: 'utf8', maxBuffer: 16384, timeout: 3000 })
    assert.equal(unzip(['-Z1', zip]), member + '\n')
    return JSON.parse(unzip(['-p', zip, member]))
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
    assert.equal(run.actor?.id, owner)
    assert.equal(run.triggering_actor?.id, owner)
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

function githubClient(token) {
  assert.ok(token)
  return async (path, body) => {
    assert.ok(path === api || path.startsWith(api + '/'))
    const res = await fetch('https://api.github.com' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(15000), redirect: 'error',
      body: body ? JSON.stringify(body) : undefined,
    })
    assert.ok(body ? [200, 204].includes(res.status) : res.status === 200, 'GITHUB_READ_OR_DISPATCH_REFUSED')
    return res.status === 204 ? null : res.json()
  }
}

function downloadEvidence(token, path) {
  return execFileSync('gh', ['api', path], {
    timeout: 20000, maxBuffer: maxZip,
    env: { PATH: process.env.PATH, GH_TOKEN: token, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' },
  })
}

function resolveSource(snap, cwd) {
  const reader = gitReader(cwd)
  const policy = evidencePolicy(reader.entry(snap.main, workflowPath).oid)
  const resolveRoute = path => resolveProjectRouting({
    profile: resolveProjectProfile('SG2', cwd), targets: [path], repositoryRoot: cwd,
  }).results.find(route => route.projectBoundaryStatus === 'ALLOWED')
  return inspectSource(snap, reader, { ...policy, resolveRoute })
}

async function latestArtifact(read, runId, name) {
  const result = await read(api + '/actions/runs/' + runId + '/artifacts?name=' + name + '&per_page=100')
  assert.equal(result.total_count, result.artifacts.length)
  const artifacts = result.artifacts.filter(artifact => artifact.name === name && artifact.expired === false)
  assert.ok(artifacts.length <= 1, 'AMBIGUOUS_ARTIFACT')
  return artifacts[0]
}

async function baselineArtifact(read, download, snap, runnerTemp) {
  const head = snap.pr.head.sha
  const endpoint = api + '/actions/workflows/' + baselineWorkflow + '/runs?event=pull_request&head_sha=' + head + '&per_page=100'
  for (let poll = 0; poll < 5; poll++) {
    const list = await read(endpoint)
    assert.equal(list.total_count, list.workflow_runs.length, 'INCOMPLETE_BASELINE_RUNS')
    for (const run of list.workflow_runs) {
      if (run.status !== 'completed' || run.conclusion !== 'success' || run.head_branch !== snap.pr.head.ref) continue
      const artifact = await latestArtifact(read, run.id, 'gv02-pr-baseline')
      if (!artifact) continue
      const proof = readArtifact(artifact, download(api + '/actions/artifacts/' + artifact.id + '/zip'),
        runnerTemp, 'gv02-pr-baseline.json')
      if (proof.repositoryId === repoId && proof.pr === snap.pr.number && proof.base === snap.main &&
          proof.head === head && proof.testMerge === snap.testMerge.sha && proof.tree === snap.testMerge.tree &&
          proof.run === run.id && proof.attempt === run.run_attempt) return artifact.id
    }
    if (poll < 4) await pause(3000)
  }
  throw new Error('ORIGINAL_BASELINE_REQUIRED')
}

function sourceIdentity(snap) {
  return [snap.main, snap.pr.number, snap.pr.user?.id, snap.pr.head.sha, snap.pr.draft,
    snap.pr.state, snap.pr.mergeable, snap.testMerge]
}

function proofTitle(pr, head, main) {
  return 'GV02 R1 ' + pr + ' ' + head + ' ' + main
}

async function requestR1Proof(read, download, dispatch, main, prNumber, runId, env) {
  if (!routinePrPermitted(env, prNumber)) return
  const snap = await readGitHubSnapshot(read, repository, prNumber)
  if (snap.main !== main || snap.pr.draft || !snap.pr.mergeable || snap.pr.user?.id !== owner) return
  importCandidateObjects(prNumber)
  const source = resolveSource(snap, process.cwd())
  if (source.risk === 'R4' || !source.files.every(file => file.path === chartPath)) return
  try {
    assertRoutineDelta(source, oid => readGitBlob(process.cwd(), oid))
  } catch (error) {
    if (error instanceof assert.AssertionError) return
    throw error
  }
  await dashboardReceipt(read, download, runId, snap, env.RUNNER_TEMP)
  const prior = await read(api + '/actions/workflows/' + workflowId +
    '/runs?branch=main&event=workflow_dispatch&head_sha=' + main + '&per_page=100')
  assert.equal(prior.total_count, prior.workflow_runs.length, 'INCOMPLETE_PRODUCER_RUNS')
  if (prior.workflow_runs.some(run => run.display_title === proofTitle(prNumber, source.head, main) &&
      run.head_sha === main && run.actor?.id === automationActor &&
      (run.status !== 'completed' || run.conclusion === 'success'))) return
  assert.deepEqual(sourceIdentity(await readGitHubSnapshot(read, repository, prNumber)), sourceIdentity(snap))
  await dispatch('main', { mode: 'publish-gv02-r1-proof', candidate_pr: String(prNumber), expected_sha: source.head,
    proof_run_id: String(runId), evidence_expected_main: main, evidence_expected_tree: source.integrationTree })
}

export async function coordinate(env) {
  const main = env.GITHUB_SHA
  assert.deepEqual([env.GITHUB_REPOSITORY, env.GITHUB_REPOSITORY_ID, env.GITHUB_REF,
    env.GITHUB_WORKFLOW_REF, env.GITHUB_WORKFLOW_SHA],
    [repository, String(repoId), 'refs/heads/main', repository + '/' + governanceWorkflow + '@refs/heads/main', main])
  assert.ok(isOid(main))
  assert.equal(env.GITHUB_RUN_ATTEMPT, '1')
  assert.equal(git(process.cwd(), 'rev-parse', 'HEAD'), main)
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  assert.equal(event.repository?.id, repoId)
  const read = githubClient(env.GH_TOKEN)
  const download = path => downloadEvidence(env.GH_TOKEN, path)
  const dispatch = (ref, inputs) => read(api + '/actions/workflows/' + workflowId + '/dispatches', { ref, inputs })

  if (env.GITHUB_EVENT_NAME === 'pull_request_target') {
    assert.equal(event.action, 'ready_for_review')
    const { number, head, base } = event.pull_request
    if (!routinePrPermitted(env, number) || base.ref !== 'main' || base.repo?.id !== repoId ||
        head.repo?.id !== repoId || !isOid(head.sha)) return
    const prior = await read(api + '/actions/workflows/' + workflowId +
      '/runs?event=pull_request&head_sha=' + head.sha + '&per_page=100')
    assert.equal(prior.total_count, prior.workflow_runs.length, 'INCOMPLETE_DASHBOARD_RUNS')
    for (const run of prior.workflow_runs) {
      if (run.status === 'completed' && run.head_branch === head.ref && await latestArtifact(read, run.id, 'sg2-dashboard-source-proof')) {
        await requestR1Proof(read, download, dispatch, main, number, run.id, env)
        return
      }
    }
    // The completion event will reconcile a Dashboard run that is still active.
    return
  }

  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_run')
  assert.equal(event.action, 'completed')
  const upstreamId = event.workflow_run?.id
  assert.ok(Number.isSafeInteger(upstreamId) && upstreamId > 0)
  const upstream = await read(api + '/actions/runs/' + upstreamId)
  assert.deepEqual([upstream.id, upstream.workflow_id, upstream.path, upstream.repository?.id,
    upstream.head_repository?.id, upstream.status, upstream.run_attempt],
  [upstreamId, workflowId, workflowPath, repoId, repoId, 'completed', event.workflow_run.run_attempt])
  if (upstream.event === 'pull_request') {
    assert.ok(isOid(upstream.head_sha))
    // GitHub can omit pull_requests on the run. Resolve the exact internal open PR independently.
    const associated = await read(api + '/commits/' + upstream.head_sha + '/pulls?per_page=100')
    assert.ok(Array.isArray(associated) && associated.length < 100)
    const matches = associated.filter(pr => pr.state === 'open' && pr.base?.ref === 'main' &&
      pr.base.repo?.id === repoId && pr.head.repo?.id === repoId &&
      pr.head.sha === upstream.head_sha && pr.head.ref === upstream.head_branch)
    if (matches.length === 1) await requestR1Proof(read, download, dispatch, main, matches[0].number, upstreamId, env)
    return
  }

  if (upstream.event !== 'workflow_dispatch' || upstream.head_branch !== 'main' ||
      upstream.head_sha !== main || upstream.actor?.id !== automationActor ||
      upstream.triggering_actor?.id !== automationActor || upstream.conclusion !== 'success') return
  const artifact = await latestArtifact(read, upstreamId, 'gv02-r1-proof')
  if (!artifact) return
  const proof = readArtifact(artifact, download(api + '/actions/artifacts/' + artifact.id + '/zip'),
    env.RUNNER_TEMP, 'gv02-r1-proof.json')
  const pr = proof.binding?.pr
  assert.ok(Number.isSafeInteger(pr) && pr > 0)
  if (!routinePrPermitted(env, pr)) return
  assert.equal(proof.schema, 'sg-gv-02/r1-evidence/v2')
  assert.equal(proof.run, upstreamId)
  assert.equal(proof.attempt, upstream.run_attempt)
  const snap = await readGitHubSnapshot(read, repository, pr)
  assert.equal(snap.main, main)
  assert.equal(snap.pr.head.sha, proof.binding.head)
  assert.equal(snap.testMerge?.tree, proof.binding.tree)
  const baseline = await baselineArtifact(read, download, snap, env.RUNNER_TEMP)
  await dispatch(controlBranch, { mode: 'gv02-protected-executor', candidate_pr: String(pr),
    gv02_baseline_artifact: String(baseline), gv02_r1_artifact: String(artifact.id) })
}

function importCandidateObjects(pr) {
  git(process.cwd(), 'fetch', '--no-tags', '--no-recurse-submodules', 'https://github.com/' + repository + '.git',
    'refs/pull/' + pr + '/merge')
}

async function main(stage, env) {
  assert.ok(['prepare', 'publish'].includes(stage))
  const { GH_TOKEN, RUNNER_TEMP, GITHUB_SHA: main, GITHUB_EVENT_PATH } = env
  assert.ok(GH_TOKEN && RUNNER_TEMP && GITHUB_EVENT_PATH)
  assert.ok(isOid(main) && env.GITHUB_WORKFLOW_SHA === main)
  assert.deepEqual([env.GITHUB_REPOSITORY, env.GITHUB_REPOSITORY_ID, env.GITHUB_REF,
    env.GITHUB_ACTOR_ID, env.GITHUB_TRIGGERING_ACTOR, env.GITHUB_RUN_ATTEMPT, env.GITHUB_EVENT_NAME,
    env.GITHUB_WORKFLOW_REF], [repository, String(repoId), 'refs/heads/main', String(automationActor), automationLogin,
    '1', 'workflow_dispatch', repository + '/' + workflowPath + '@refs/heads/main'])
  const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'))
  assert.equal(event.sender?.id, automationActor)
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
  assert.ok(routinePrPermitted(env, pr), 'R1_PR_SCOPE_REJECTED')
  const cwd = process.cwd()
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), main)
  const read = githubClient(GH_TOKEN)
  const snap = await readGitHubSnapshot(read, repository, pr)
  assert.equal(snap.main, main)
  assert.equal(snap.pr.head.sha, expected_sha)
  assert.equal(snap.pr.draft, false)
  assert.equal(snap.pr.mergeable, true)
  assert.equal(snap.pr.user?.id, owner)
  importCandidateObjects(pr)
  const reader = gitReader(cwd)
  const workflow = reader.entry(main, workflowPath)
  assert.equal(reader.entry(expected_sha, workflowPath)?.oid, workflow.oid)
  assert.deepEqual(reader.commit(expected_sha).parents, [main])
  const policy = evidencePolicy(workflow.oid)
  const policyDigest = sha256(canonical(policy))
  const resolveRoute = path => resolveProjectRouting({
    profile: resolveProjectProfile('SG2', cwd), targets: [path], repositoryRoot: cwd,
  }).results.find(route => route.projectBoundaryStatus === 'ALLOWED')
  const source = inspectSource(snap, reader, { ...policy, resolveRoute })
  assertRoutineDelta(source, oid => readGitBlob(cwd, oid))
  assert.equal(source.integrationTree, evidence_expected_tree)
  assert.equal(reader.commit(expected_sha).tree, source.integrationTree)
  const download = path => execFileSync('gh', ['api', path], {
    timeout: 20000, maxBuffer: maxZip,
    env: { PATH: env.PATH, GH_TOKEN, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' },
  })
  const dashboard = await dashboardReceipt(read, download, runId, snap, RUNNER_TEMP)
  const binding = { repository, pr, main, head: expected_sha, tree: source.integrationTree,
    sourceDigest: source.sourceDigest, policyDigest }
  const inputsDigest = impactInputsDigest(reader, binding, source.testMerge, dashboard)
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
    schema: 'sg-gv-02/r1-evidence/v2', run, attempt: 1, binding, scope: 'PRESENTATION_ONLY',
    complete: true, protectedInputsUnchanged: true, inputsDigest, dashboard,
    checks: { dashboard: 'PASS', embedded: 'PASS', typecheck: 'PASS', build: 'PASS' },
  }) + '\n', { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const stage = process.argv[2]
  const run = stage === 'coordinate' ? coordinate(process.env) : main(stage, process.env)
  run.catch(error => {
    console.error('GV-02 evidence publication refused:', error.code ?? error.name)
    process.exitCode = 1
  })
}
