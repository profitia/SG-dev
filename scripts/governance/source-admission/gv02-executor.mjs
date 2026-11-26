import { execFileSync } from 'node:child_process'
import { sign } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { assertRoutineDelta, automationActor, controlBranch, dashboardReceipt, evidencePolicy,
  expectedR1Settings, impactInputsDigest, readGitBlob, routinePrPermitted } from '../publish-gv02-r1-proof.mjs'
import { resolveProjectProfile } from '../project-profile.mjs'
import { resolveProjectRouting } from '../routing-engine.mjs'
import { canonical, gitReader, inspectSource, isOid, readGitHubSnapshot, requireThat, sha256 } from './source.mjs'

const repository = 'profitia/SG-dev'
const repoId = 1247665550
const ownerId = 275643368
const repositoryApi = '/repos/' + repository
const workflowPath = '.github/workflows/governance-preflight.yml'
const controlRef = 'refs/heads/' + controlBranch
const controlWorkflow = '.github/workflows/platform-contracts-ci.yml'
const authorityPaths = [
  workflowPath,
  controlWorkflow,
  'scripts/governance/publish-gv02-r1-proof.mjs',
  'scripts/governance/source-admission/gv02-executor.mjs',
  'scripts/governance/source-admission/source.mjs',
  'Canon/registries/profitia-projects-v1.json',
  'Canon/registries/current-architecture-baseline-v1.json',
  'scripts/architecture-classify.mjs',
  'scripts/governance/project-profile.mjs',
  'scripts/governance/routing-engine.mjs',
]
const baselineWorkflow = 362561378
const baselineCheck = 'sgdev-gv02-pr-baseline'
const runnerApp = 15368
const mergeApp = 5871947
const installation = 184592814
const admissionApp = 5937392
const admissionInstallation = 186141285
const r4App = 5871888
const r4Installation = 184592336
const admissionPermissions = Object.freeze({ checks: 'write', metadata: 'read' })
const admissionCheck = 'sgdev-gv02-adequate-evidence'
const executorWorkflow = 383640662
const receiptName = 'gv02-merge-receipt'
const receiptSchema = 'sg-gv-02/merge-receipt/v1'
const mergeActor = 359783674
const memberLimit = 16 * 1024
const same = (a, b) => canonical(a) === canonical(b)
const positiveId = value => Number.isSafeInteger(value) && value > 0
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

function assertIndependentR1Issuer(app, installationId) {
  requireThat(positiveId(app) && positiveId(installationId) &&
    ![r4App, mergeApp, runnerApp].includes(app) &&
    ![r4Installation, installation].includes(installationId), 'INDEPENDENT_R1_ISSUER_REQUIRED')
}

export function executorPolicy(raw) {
  requireThat(typeof raw === 'string' && raw.length > 0 && raw.length < 4096, 'R1_PRODUCER_POLICY_REQUIRED')
  const settings = JSON.parse(raw)
  requireThat(isOid(settings.producer?.blob) && same(settings, expectedR1Settings(settings.producer.blob)),
    'R1_PRODUCER_POLICY_REJECTED')
  const policy = evidencePolicy(settings.producer.blob)
  return { ...policy, digest: sha256(canonical(policy)) }
}

function readMember(bytes, member) {
  const directory = mkdtempSync(join(tmpdir(), 'sg-gv02-evidence-'))
  const archive = join(directory, 'proof.zip')
  try {
    writeFileSync(archive, bytes, { flag: 'wx', mode: 0o600 })
    const read = (...args) => execFileSync('/usr/bin/unzip', args, {
      env: { LANG: 'C' }, timeout: 3000, maxBuffer: memberLimit, stdio: ['ignore', 'pipe', 'pipe'],
    })
    requireThat(read('-Z1', archive).toString('utf8') === member + '\n', 'PROOF_LAYOUT_REJECTED')
    return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(read('-p', archive, member)))
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

export async function originalArtifact(read, download, id, expected) {
  requireThat(positiveId(id), 'PROOF_ID_REQUIRED')
  const actions = repositoryApi + '/actions'
  const path = actions + '/artifacts/' + id
  const artifact = await read(path)
  const link = artifact.workflow_run
  requireThat(artifact.id === id && artifact.name === expected.name && artifact.expired === false &&
    link?.repository_id === repoId && link.head_repository_id === repoId &&
    link.head_sha === expected.sha && positiveId(link.id) &&
    (expected.runId === undefined || link.id === expected.runId) &&
    positiveId(artifact.size_in_bytes) && artifact.size_in_bytes <= 1024 * 1024 &&
    /^sha256:[0-9a-f]{64}$/.test(artifact.digest ?? ''), 'PROOF_METADATA_REJECTED')
  const runPath = actions + '/runs/' + link.id
  const run = await read(runPath)
  const attempt = run.run_attempt
  function valid(item) {
    return item.id === link.id && item.workflow_id === expected.workflowId &&
      item.path === expected.path && item.event === expected.event &&
      item.repository?.id === repoId && item.head_repository?.id === repoId &&
      item.head_sha === expected.sha && item.status === 'completed' &&
      item.conclusion === 'success' && item.run_attempt === attempt
  }
  requireThat(positiveId(attempt) && valid(run) && expected.authorize(run), 'RUN_PROVENANCE_REJECTED')
  const exact = await read(runPath + '/attempts/' + attempt)
  requireThat(valid(exact) && expected.authorize(exact), 'RUN_ATTEMPT_REJECTED')
  const jobs = await read(runPath + '/attempts/' + attempt + '/jobs?per_page=100')
  const matching = jobs.jobs.filter(job => job.name === expected.job)
  requireThat(jobs.total_count === jobs.jobs.length && matching.length === 1 &&
    matching[0].conclusion === 'success', 'REQUIRED_JOB_REJECTED')
  const checkUrl = matching[0].check_run_url ?? ''
  requireThat(new RegExp('^https://api[.]github[.]com' + repositoryApi + '/check-runs/[1-9][0-9]*$', 'i').test(checkUrl),
    'CHECK_ORIGIN_REJECTED')
  const check = await read(checkUrl.slice('https://api.github.com'.length))
  const created = Date.parse(artifact.created_at)
  requireThat(created >= Date.parse(matching[0].started_at) &&
    created <= Date.parse(matching[0].completed_at), 'ARTIFACT_JOB_WINDOW_REJECTED')
  requireThat(check.id === Number(checkUrl.split('/').at(-1)) && check.name === expected.job &&
    check.app?.id === runnerApp && check.head_sha === expected.sha && check.check_suite?.id === run.check_suite_id &&
    check.status === 'completed' && check.conclusion === 'success', 'CHECK_IDENTITY_REJECTED')
  const bytes = await download(path + '/zip')
  requireThat(Buffer.isBuffer(bytes) && bytes.length === artifact.size_in_bytes &&
    artifact.digest === 'sha256:' + sha256(bytes), 'PROOF_BYTES_REJECTED')
  const proof = readMember(bytes, expected.name + '.json')
  const [fresh, freshArtifact] = await Promise.all([read(runPath), read(path)])
  requireThat(valid(fresh) && expected.authorize(fresh) && same(artifact, freshArtifact), 'PROOF_CHANGED')
  return { proof, run: run.id, attempt, check: check.id, artifact: id, digest: artifact.digest }
}

export function checkR1Proof(proof, expectedBinding, run, attempt) {
  requireThat(proof.schema === 'sg-gv-02/r1-evidence/v2' && proof.run === run &&
    proof.attempt === attempt && same(proof.binding, expectedBinding) &&
    proof.scope === 'PRESENTATION_ONLY' && proof.complete === true &&
    proof.protectedInputsUnchanged === true && hash(proof.inputsDigest) &&
    same(proof.checks, { dashboard: 'PASS', embedded: 'PASS', typecheck: 'PASS', build: 'PASS' }),
  'R1_PROOF_REJECTED')
  return proof
}

export function assertMergeRules(rules) {
  assertIndependentR1Issuer(admissionApp, admissionInstallation)
  requireThat(rules.some(rule => rule.type === 'pull_request' &&
    rule.parameters.allowed_merge_methods.includes('merge')) &&
    rules.some(rule => rule.type === 'non_fast_forward') &&
    rules.some(rule => rule.type === 'required_status_checks' &&
      rule.parameters.strict_required_status_checks_policy === true &&
      rule.parameters.required_status_checks.some(check => check.context === baselineCheck && check.integration_id === runnerApp)) &&
    rules.some(rule => rule.type === 'required_status_checks' &&
      rule.parameters.strict_required_status_checks_policy === true &&
      rule.parameters.required_status_checks.some(check => check.context === admissionCheck && check.integration_id === admissionApp)),
  'PROTECTED_MERGE_RULES_REQUIRED')
}

const apiHost = 'https://api.github.com'
async function github(path, token, { method = 'GET', body, status = 200 } = {}) {
  requireThat(path.startsWith('/') && !path.startsWith('//'), 'INVALID_API_PATH')
  const response = await fetch(apiHost + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  requireThat(response.status === status, 'GITHUB_HTTP_' + response.status)
  return status === 204 ? null : response.json()
}

export function executionContext(env, event) {
  const control = env.GV02_CONTROL_SHA
  requireThat(env.GITHUB_REPOSITORY === repository && env.GITHUB_REPOSITORY_ID === String(repoId) &&
    env.GITHUB_REF === controlRef && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_WORKFLOW_REF === repository + '/' + controlWorkflow + '@' + controlRef &&
    env.GITHUB_ACTOR_ID === String(automationActor) && env.GITHUB_TRIGGERING_ACTOR === 'github-actions[bot]' &&
    env.GITHUB_RUN_ATTEMPT === '1' && isOid(control) && env.GITHUB_SHA === control &&
    env.GITHUB_WORKFLOW_SHA === control && event.repository?.id === repoId &&
    event.sender?.id === automationActor && event.inputs?.mode === 'gv02-protected-executor',
  'EXECUTOR_CONTEXT_REJECTED')
  return control
}

export async function assertFrozenControl(read, control) {
  const [ref, rules] = await Promise.all([
    read(repositoryApi + '/git/ref/heads/' + controlBranch),
    read(repositoryApi + '/rules/branches/' + encodeURIComponent(controlBranch)),
  ])
  requireThat(ref.ref === controlRef && ref.object?.type === 'commit' &&
    ref.object.sha === control, 'CONTROL_REF_MOVED')
  const updateRule = rules.find(rule => rule.type === 'update')
  requireThat(positiveId(updateRule?.ruleset_id) &&
    ['deletion', 'non_fast_forward', 'pull_request'].every(type =>
      rules.some(rule => rule.type === type && rule.ruleset_id === updateRule.ruleset_id)),
  'CONTROL_REF_FREEZE_REQUIRED')
}

export function assertMainEvidenceAuthority(git, control, main) {
  requireThat(authorityPaths.every(path => {
    const frozen = git.entry(control, path)
    return frozen && same(frozen, git.entry(main, path))
  }), 'MAIN_EVIDENCE_AUTHORITY_CHANGED')
}

async function verify(read, download, control, prNumber, baselineId, r1Id, policy) {
  const git = gitReader(process.cwd())
  const candidate = await readGitHubSnapshot(read, repository, prNumber)
  const authority = candidate.main
  requireThat(candidate.pr.draft === false &&
    candidate.pr.mergeable === true && candidate.testMerge, 'FRESH_READY_PR_REQUIRED')
  // Read candidate Git objects from GitHub. Never check out or execute them.
  execFileSync('git', ['fetch', '--no-tags', 'https://github.com/profitia/SG-dev.git', 'refs/heads/main', 'refs/pull/' + prNumber + '/merge'],
    { env: { PATH: process.env.PATH, LANG: 'C', GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' }, stdio: 'ignore', timeout: 30000 })
  assertMainEvidenceAuthority(git, control, authority)
  requireThat(same(git.commit(candidate.pr.head.sha).parents, [authority]), 'DIRECT_CURRENT_MAIN_PARENT_REQUIRED')
  const resolveRoute = path => resolveProjectRouting({
    profile: resolveProjectProfile('SG2', process.cwd()), targets: [path], repositoryRoot: process.cwd(),
  }).results.find(item => item.projectBoundaryStatus === 'ALLOWED')
  const source = inspectSource(candidate, git, { ...policy, resolveRoute })
  assertRoutineDelta(source, oid => readGitBlob(process.cwd(), oid))
  requireThat(same(git.entry(authority, workflowPath), git.entry(source.testMerge, workflowPath)) &&
    git.entry(authority, policy.producer.path)?.oid === policy.producer.blob, 'TRUSTED_WORKFLOW_BLOB_REJECTED')

  const baseline = await originalArtifact(read, download, baselineId, {
    name: 'gv02-pr-baseline', workflowId: baselineWorkflow, path: workflowPath,
    event: 'pull_request', sha: source.head, job: baselineCheck,
    authorize: run => run.head_branch === candidate.pr.head.ref && Array.isArray(run.pull_requests) &&
      (run.pull_requests.length === 0 ||
        run.pull_requests.some(p => p.number === prNumber && p.head?.sha === source.head)),
  })
  requireThat(same(baseline.proof, { repositoryId: repoId, pr: prNumber, base: authority,
    head: source.head, testMerge: source.testMerge, tree: source.integrationTree, run: baseline.run,
    attempt: baseline.attempt }), 'BASELINE_TREE_REJECTED')

  const r1 = await originalArtifact(read, download, r1Id, {
    name: 'gv02-r1-proof', workflowId: policy.producer.workflowId, path: policy.producer.path,
    event: 'workflow_dispatch', sha: authority, job: policy.producer.job,
    authorize: run => run.head_branch === 'main' && run.actor?.id === automationActor &&
      run.triggering_actor?.id === automationActor && run.run_attempt === 1,
  })
  const binding = { repository, pr: prNumber, main: authority, head: source.head, tree: source.integrationTree,
    sourceDigest: source.sourceDigest, policyDigest: policy.digest }
  const impact = checkR1Proof(r1.proof, binding, r1.run, r1.attempt)
  const dashboard = await dashboardReceipt(read, download, impact.dashboard?.run, candidate, process.env.RUNNER_TEMP)
  requireThat(same(impact.dashboard, dashboard) &&
    impact.inputsDigest === impactInputsDigest(git, binding, source.testMerge, dashboard), 'R1_INPUT_BINDING_REJECTED')
  requireThat(inspectSource(candidate, git, { ...policy, resolveRoute, readIntegrationImpact: () => impact }).risk === 'R1',
    'R1_CLASSIFICATION_REJECTED')

  const fresh = await readGitHubSnapshot(read, repository, prNumber)
  await assertFrozenControl(read, control)
  requireThat(fresh.main === authority && fresh.pr.head.sha === source.head &&
    fresh.pr.draft === false && fresh.pr.mergeable === true &&
    same(fresh.testMerge, candidate.testMerge), 'EXECUTION_SOURCE_MOVED')
  return { control, binding, testMerge: source.testMerge,
    evidence: [baseline, r1].map(({ run, attempt, check, artifact, digest }) => ({ run, attempt, check, artifact, digest })) }
}

const installationRoles = Object.freeze({
  admission: { app: admissionApp, installation: admissionInstallation, permissions: { checks: 'write' } },
  merge: { app: mergeApp, installation, permissions: { contents: 'write' } },
})

async function withInstallation(key, role, use) {
  const identity = installationRoles[role]
  requireThat(identity && key, 'EXECUTOR_KEY_MISSING')
  const now = Math.floor(Date.now() / 1000)
  const base64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = base64({ alg: 'RS256', typ: 'JWT' }) + '.' +
    base64({ iat: now - 30, exp: now + 240, iss: String(identity.app) })
  const jwt = payload + '.' + sign('RSA-SHA256', Buffer.from(payload), key).toString('base64url')
  const app = await github('/app', jwt)
  const selected = await github(repositoryApi + '/installation', jwt)
  requireThat(app.id === identity.app && app.owner?.id === ownerId && selected.app_id === identity.app &&
    selected.id === identity.installation && selected.account?.id === ownerId && selected.suspended_at === null &&
    selected.repository_selection === 'selected', 'INSTALLATION_IDENTITY_REJECTED')
  if (role === 'admission') {
    assertIndependentR1Issuer(identity.app, identity.installation)
    requireThat(same(app.permissions, admissionPermissions) && same(selected.permissions, admissionPermissions),
      'R1_ISSUER_PERMISSIONS_REJECTED')
  }
  const result = await github('/app/installations/' + identity.installation + '/access_tokens', jwt, {
    method: 'POST', status: 201, body: { repository_ids: [repoId], permissions: identity.permissions },
  })
  try {
    requireThat(result.repository_selection === 'selected' && result.repositories?.length === 1 &&
      result.repositories[0].id === repoId && Object.entries(identity.permissions).every(([name, value]) =>
        result.permissions?.[name] === value) && Object.keys(result.permissions ?? {}).every(name =>
        Object.hasOwn(identity.permissions, name) || name === 'metadata' && result.permissions.metadata === 'read'),
    'INSTALLATION_TOKEN_SCOPE_REJECTED')
    if (role === 'admission') {
      requireThat(same(result.permissions, admissionPermissions), 'R1_ISSUER_TOKEN_SCOPE_REJECTED')
    }
    return await use(result.token)
  } finally {
    await github('/installation/token', result.token, { method: 'DELETE', status: 204 })
  }
}

export function admissionIdentity(expected) {
  return sha256(canonical(expected))
}

async function authenticAdmission(read, expected) {
  const checks = await read(repositoryApi + '/commits/' + expected.testMerge +
    '/check-runs?check_name=' + admissionCheck + '&filter=all&per_page=100')
  requireThat(checks.total_count === checks.check_runs.length, 'INCOMPLETE_ADMISSION_CHECKS')
  return checks.check_runs.find(check => check.app?.id === admissionApp && check.name === admissionCheck &&
    check.head_sha === expected.testMerge && check.external_id === admissionIdentity(expected) &&
    check.status === 'completed' && check.conclusion === 'success')
}

async function recheck(read, expected) {
  const { pr, main, head, tree } = expected.binding
  const fresh = await readGitHubSnapshot(read, repository, pr)
  requireThat(fresh.main === main && fresh.pr.head.sha === head &&
    fresh.pr.draft === false && fresh.pr.mergeable === true && fresh.testMerge?.sha === expected.testMerge &&
    fresh.testMerge.tree === tree, 'EXECUTION_SOURCE_MOVED')
  await assertFrozenControl(read, expected.control)
  for (const proof of expected.evidence) {
    const [run, artifact] = await Promise.all([read(repositoryApi + '/actions/runs/' + proof.run),
      read(repositoryApi + '/actions/artifacts/' + proof.artifact)])
    requireThat(run.run_attempt === proof.attempt && run.status === 'completed' &&
      run.conclusion === 'success' && artifact.workflow_run?.id === proof.run &&
      artifact.digest === proof.digest && artifact.expired === false, 'PROOF_ATTEMPT_MOVED')
  }
}

export function assertMergedTree(receipt, before, after, pr, commit) {
  const binding = receipt?.binding
  requireThat(receipt?.schema === receiptSchema && receipt.status === 'MERGED' &&
    receipt.app === mergeApp && receipt.sha === after && isOid(after) && isOid(before) &&
    binding?.repository === repository && binding.main === before && binding.pr === pr.number &&
    isOid(binding.head) && hash(binding.sourceDigest) && hash(binding.policyDigest) &&
    positiveId(receipt.admission) && pr.state === 'closed' && pr.merged === true &&
    pr.base.ref === 'main' && pr.base.repo?.id === repoId && pr.head.repo?.id === repoId &&
    pr.merged_by?.id === mergeActor && pr.merge_commit_sha === after && pr.head.sha === binding.head &&
    commit.sha === after && same(commit.parents.map(parent => parent.sha), [before, binding.head]) &&
    commit.tree.sha === binding.tree, 'MERGE_READBACK_REJECTED')
}

async function readMergedReceipt(read, download, env, event) {
  const control = env.GV02_CONTROL_SHA
  const after = env.GITHUB_SHA
  const before = event.before
  requireThat(env.GITHUB_REPOSITORY === repository && env.GITHUB_REPOSITORY_ID === String(repoId) &&
    env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_WORKFLOW_REF === repository + '/' + controlWorkflow + '@refs/heads/main' &&
    env.GITHUB_WORKFLOW_SHA === after && env.GITHUB_ACTOR_ID === String(mergeActor) &&
    env.GITHUB_TRIGGERING_ACTOR === 'profitia-e4t02-merge-pilot[bot]' &&
    event.repository?.id === repoId && event.sender?.id === mergeActor &&
    event.ref === 'refs/heads/main' && event.after === after && event.forced === false &&
    isOid(before) && isOid(after) && isOid(control), 'UNTRUSTED_R1_PUSH')
  const checkout = execFileSync('git', ['--no-replace-objects', 'rev-parse', 'HEAD'], {
    encoding: 'utf8', timeout: 8000, env: { PATH: env.PATH, GIT_NO_LAZY_FETCH: '1' },
  }).trim()
  requireThat(checkout === control, 'CONTROL_CHECKOUT_MISMATCH')
  await assertFrozenControl(read, control)
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const endpoint = repositoryApi + '/actions/workflows/' + executorWorkflow + '/runs?branch=' +
    encodeURIComponent(controlBranch) + '&event=workflow_dispatch&head_sha=' + control +
    '&created=' + encodeURIComponent('>=' + cutoff) + '&per_page=100'
  const settled = new Set()
  for (let poll = 0; poll < 10; poll++) {
    const list = await read(endpoint)
    requireThat(list.total_count === list.workflow_runs.length, 'INCOMPLETE_EXECUTOR_READBACK')
    for (const run of list.workflow_runs) {
      if (settled.has(run.id) || run.status !== 'completed' || run.conclusion !== 'success' ||
          run.actor?.id !== automationActor || run.triggering_actor?.id !== automationActor) continue
      const artifacts = await read(repositoryApi + '/actions/runs/' + run.id + '/artifacts?name=' + receiptName + '&per_page=100')
      requireThat(artifacts.total_count === artifacts.artifacts.length && artifacts.total_count <= 1, 'AMBIGUOUS_MERGE_RECEIPT')
      if (!artifacts.total_count || artifacts.artifacts[0].expired) { settled.add(run.id); continue }
      const { proof } = await originalArtifact(read, download, artifacts.artifacts[0].id, {
        name: receiptName, workflowId: executorWorkflow, path: controlWorkflow, sha: control,
        runId: run.id, event: 'workflow_dispatch', job: 'gv02-routine-merge',
        authorize: item => item.head_branch === controlBranch && item.run_attempt === 1 &&
          item.actor?.id === automationActor && item.triggering_actor?.id === automationActor,
      })
      if (proof.sha !== after) { settled.add(run.id); continue }
      requireThat(proof.control === control && positiveId(proof.binding?.pr) && isOid(proof.testMerge), 'MERGE_RECEIPT_REJECTED')
      const [pr, commit, testMerge, check] = await Promise.all([
        read(repositoryApi + '/pulls/' + proof.binding.pr),
        read(repositoryApi + '/git/commits/' + after),
        read(repositoryApi + '/git/commits/' + proof.testMerge),
        read(repositoryApi + '/check-runs/' + (positiveId(proof.admission) ? proof.admission : 0)),
      ])
      assertMergedTree(proof, before, after, pr, commit)
      requireThat(same(testMerge.parents.map(parent => parent.sha), [before, proof.binding.head]) &&
        testMerge.tree.sha === proof.binding.tree, 'MERGED_TEST_TREE_REJECTED')
      const expected = { control, binding: proof.binding, testMerge: proof.testMerge, evidence: proof.evidence }
      requireThat(check.id === proof.admission && check.name === admissionCheck && check.app?.id === admissionApp &&
        check.head_sha === proof.testMerge && check.external_id === admissionIdentity(expected) &&
        check.status === 'completed' && check.conclusion === 'success', 'MERGED_ADMISSION_CHECK_REJECTED')
      await assertFrozenControl(read, control)
      return
    }
    if (poll < 9) await pause(5000)
  }
  throw new Error('EXACT_R1_MERGE_RECEIPT_REQUIRED')
}

async function main() {
  const env = process.env
  const mode = env.GV02_MODE
  requireThat(env.GH_TOKEN && env.GITHUB_EVENT_PATH, 'READ_ONLY_CONTEXT_REQUIRED')
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  const read = path => github(path, env.GH_TOKEN)
  const download = path => execFileSync('gh', ['api', path], {
    env: { PATH: env.PATH, GH_TOKEN: env.GH_TOKEN, GH_PROMPT_DISABLED: '1' },
    timeout: 15000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (mode === 'readback') {
    assertIndependentR1Issuer(admissionApp, admissionInstallation)
    await readMergedReceipt(read, download, env, event)
    console.log('GV02_R1_RESULTING_MAIN_VERIFIED')
    return
  }
  requireThat(['verify', 'admission', 'merge'].includes(mode), 'EXECUTOR_MODE_REJECTED')
  const control = executionContext(env, event)
  await assertFrozenControl(read, control)
  const number = value => {
    requireThat(/^[1-9][0-9]*$/.test(value ?? '') && positiveId(Number(value)), 'INVALID_PROOF_INPUT')
    return Number(value)
  }
  const pr = number(env.GV02_PR)
  assertIndependentR1Issuer(admissionApp, admissionInstallation)
  requireThat(routinePrPermitted(env, pr), 'R1_PR_SCOPE_REJECTED')
  if (mode === 'merge') {
    requireThat(!env.GV02_SHADOW_PR && env.GV02_ROUTINE_ENABLED === 'true' &&
      env.GV02_ROUTINE_MERGE_ENABLED === 'true', 'R1_AUTOMATIC_MERGE_DISABLED')
  }
  const expected = await verify(read, download, control, pr, number(env.GV02_BASELINE_ARTIFACT),
    number(env.GV02_R1_ARTIFACT), executorPolicy(env.GV02_R1_POLICY))
  if (mode === 'verify') {
    console.log('GV02_R1_PROOF_VERIFIED')
    return
  }
  await recheck(read, expected)
  if (mode === 'admission') {
    if (await authenticAdmission(read, expected)) return
    await withInstallation(env.GV02_CHECK_APP_PRIVATE_KEY, 'admission', async appToken => {
      await recheck(read, expected)
      const check = await github(repositoryApi + '/check-runs', appToken, { method: 'POST', status: 201,
        body: { name: admissionCheck, external_id: admissionIdentity(expected),
          head_sha: expected.testMerge, status: 'completed', conclusion: 'success' },
      })
      requireThat(check.app?.id === admissionApp && check.head_sha === expected.testMerge &&
        await authenticAdmission(read, expected), 'ADMISSION_PUBLICATION_REQUIRES_READBACK')
    })
    return
  }

  assertMergeRules(await read(repositoryApi + '/rules/branches/main'))
  const admission = await authenticAdmission(read, expected)
  requireThat(admission && positiveId(admission.id), 'REQUIRED_ADMISSION_CHECK_MISSING')
  await withInstallation(env.GV02_MERGE_APP_PRIVATE_KEY, 'merge', async appToken => {
    await recheck(read, expected)
    assertMergeRules(await read(repositoryApi + '/rules/branches/main'))
    requireThat((await authenticAdmission(read, expected))?.id === admission.id, 'ADMISSION_CHECK_MOVED')
    let result
    try {
      result = await github(repositoryApi + '/pulls/' + pr + '/merge', appToken, {
        method: 'PUT', body: { sha: expected.binding.head, merge_method: 'merge' },
      })
    } catch {
      throw new Error('MERGE_OUTCOME_REQUIRES_READBACK')
    }
    requireThat(result.merged === true && isOid(result.sha), 'MERGE_OUTCOME_REQUIRES_READBACK')
    const [after, commit, ref] = await Promise.all([read(repositoryApi + '/pulls/' + pr),
      read(repositoryApi + '/git/commits/' + result.sha), read(repositoryApi + '/git/ref/heads/main')])
    const receipt = { schema: receiptSchema, status: 'MERGED', sha: result.sha, app: mergeApp,
      admission: admission.id, ...expected }
    assertMergedTree(receipt, expected.binding.main, result.sha, after, commit)
    requireThat(ref.object.sha === result.sha, 'MERGE_READBACK_REJECTED')
    writeFileSync(join(env.RUNNER_TEMP, receiptName + '.json'), JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 })
    console.log('GV02_R1_MERGED')
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const reason = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'EXECUTOR_REFUSED'
    console.error(reason)
    process.exitCode = 1
  })
}
