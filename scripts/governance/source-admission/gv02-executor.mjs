import { execFileSync } from 'node:child_process'
import { sign } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectProfile } from '../project-profile.mjs'
import { resolveProjectRouting } from '../routing-engine.mjs'
import { canonical, gitReader, inspectSource, isOid, readGitHubSnapshot, requireThat, sha256 } from './source.mjs'

const repository = 'profitia/SG-dev'
const repoId = 1247665550
const ownerId = 275643368
const repositoryApi = '/repos/' + repository
const workflowPath = '.github/workflows/governance-preflight.yml'
const controlBranch = 'governance/gv02-control'
const controlRef = 'refs/heads/' + controlBranch
const controlWorkflow = '.github/workflows/platform-contracts-ci.yml'
const authorityPaths = [
  workflowPath,
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
const mergeActor = 359783674
const memberLimit = 16 * 1024
const r1Paths = Object.freeze({
  'apps/dashboard-preview/components/raw-data-view/magicpath/CanonChartTimePresets.tsx': 'Dashboard Preview',
})

const same = (a, b) => canonical(a) === canonical(b)
const positiveId = value => Number.isSafeInteger(value) && value > 0
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

export function executorPolicy(raw) {
  requireThat(typeof raw === 'string' && raw.length > 0 && raw.length < 4096, 'R1_PRODUCER_POLICY_REQUIRED')
  const settings = JSON.parse(raw)
  const { producer } = settings
  requireThat(settings.schema === 'sg-gv-02/executor/v1' &&
    positiveId(producer?.workflowId) && producer.workflowId !== baselineWorkflow &&
    /^\.github\/workflows\/[A-Za-z0-9._-]+\.yml$/.test(producer.path ?? '') &&
    producer.path !== workflowPath && isOid(producer.blob) &&
    typeof producer.job === 'string' && /^[A-Za-z0-9 ._ -]{1,80}$/.test(producer.job),
  'R1_PRODUCER_POLICY_REJECTED')
  const policy = { repository, repoId, repoOwnerId: ownerId, r1Paths, producer }
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
  requireThat(check.id === Number(checkUrl.split('/').at(-1)) && check.name === expected.job &&
    check.app?.id === runnerApp && check.head_sha === expected.sha && check.check_suite?.id === run.check_suite_id &&
    check.status === 'completed' && check.conclusion === 'success', 'CHECK_IDENTITY_REJECTED')
  const bytes = await download(path + '/zip')
  requireThat(Buffer.isBuffer(bytes) && bytes.length === artifact.size_in_bytes &&
    artifact.digest === 'sha256:' + sha256(bytes), 'PROOF_BYTES_REJECTED')
  const proof = readMember(bytes, expected.name + '.json')
  const [fresh, freshArtifact] = await Promise.all([read(runPath), read(path)])
  requireThat(valid(fresh) && expected.authorize(fresh) && same(artifact, freshArtifact), 'PROOF_CHANGED')
  return { proof, run: run.id, attempt, check: check.id, artifact: id }
}

export function checkR1Proof(proof, expectedBinding, run, attempt) {
  requireThat(proof.schema === 'sg-gv-02/r1-evidence/v1' && proof.run === run &&
    proof.attempt === attempt && same(proof.binding, expectedBinding) &&
    proof.scope === 'PRESENTATION_ONLY' && proof.complete === true &&
    proof.protectedInputsUnchanged === true && hash(proof.inputsDigest) &&
    same(proof.checks, { dashboard: 'PASS', embedded: 'PASS', typecheck: 'PASS', build: 'PASS' }),
  'R1_PROOF_REJECTED')
  return proof
}

export function assertMergeRules(rules) {
  requireThat(rules.some(rule => rule.type === 'pull_request' &&
    rule.parameters.allowed_merge_methods.includes('merge')) &&
    rules.some(rule => rule.type === 'non_fast_forward') &&
    rules.some(rule => rule.type === 'required_status_checks' &&
      rule.parameters.strict_required_status_checks_policy === true &&
      rule.parameters.required_status_checks.some(check => check.context === baselineCheck && check.integration_id === runnerApp)),
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
    env.GITHUB_ACTOR_ID === String(ownerId) && env.GITHUB_TRIGGERING_ACTOR === 'profitia' &&
    env.GITHUB_RUN_ATTEMPT === '1' && isOid(control) && env.GITHUB_SHA === control &&
    env.GITHUB_WORKFLOW_SHA === control && event.repository?.id === repoId &&
    event.sender?.id === ownerId && event.inputs?.mode === 'gv02-protected-executor',
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
  requireThat(source.files.length === 1 && Object.hasOwn(r1Paths, source.files[0].path) &&
    source.files[0].owner === r1Paths[source.files[0].path] && source.files[0].change === 'M' &&
    source.files[0].before?.mode === '100644' && source.files[0].after?.mode === '100644', 'R1_SCOPE_REJECTED')
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
    authorize: run => run.head_branch === 'main' && run.actor?.id === ownerId && run.triggering_actor?.id === ownerId,
  })
  const binding = { repository, pr: prNumber, main: authority, head: source.head, tree: source.integrationTree,
    sourceDigest: source.sourceDigest, policyDigest: policy.digest }
  const impact = checkR1Proof(r1.proof, binding, r1.run, r1.attempt)
  requireThat(inspectSource(candidate, git, { ...policy, resolveRoute, readIntegrationImpact: () => impact }).risk === 'R1',
    'R1_CLASSIFICATION_REJECTED')

  const fresh = await readGitHubSnapshot(read, repository, prNumber)
  await assertFrozenControl(read, control)
  requireThat(fresh.main === authority && fresh.pr.head.sha === source.head &&
    fresh.pr.draft === false && fresh.pr.mergeable === true &&
    same(fresh.testMerge, candidate.testMerge), 'EXECUTION_SOURCE_MOVED')
  return { control, binding, testMerge: source.testMerge,
    evidence: [baseline, r1].map(({ run, attempt, check, artifact }) => ({ run, attempt, check, artifact })) }
}

export async function withInstallation(key, write, use) {
  const now = Math.floor(Date.now() / 1000)
  const base64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = base64({ alg: 'RS256', typ: 'JWT' }) + '.' +
    base64({ iat: now - 30, exp: now + 240, iss: String(mergeApp) })
  const jwt = payload + '.' + sign('RSA-SHA256', Buffer.from(payload), key).toString('base64url')
  const app = await github('/app', jwt)
  const selected = await github(repositoryApi + '/installation', jwt)
  requireThat(app.id === mergeApp && app.owner?.id === ownerId && selected.app_id === mergeApp &&
    selected.id === installation && selected.account?.id === ownerId && selected.suspended_at === null,
  'EXECUTOR_INSTALLATION_REJECTED')
  const requested = { contents: write ? 'write' : 'read', pull_requests: 'read' }
  const auth = await github('/app/installations/' + installation + '/access_tokens', jwt, {
    method: 'POST', status: 201, body: { repository_ids: [repoId], permissions: requested },
  })
  requireThat(typeof auth.token === 'string' && auth.token.length > 20, 'INSTALLATION_TOKEN_REQUIRED')
  try {
    requireThat(same(auth.permissions, { ...requested, metadata: 'read' }), 'INSTALLATION_TOKEN_SCOPE_REJECTED')
    const scope = await github('/installation/repositories?per_page=100', auth.token)
    requireThat(scope.total_count === 1 && scope.repositories[0].id === repoId, 'INSTALLATION_REPOSITORY_SCOPE_REJECTED')
    return await use(auth.token)
  } finally {
    await github('/installation/token', auth.token, { method: 'DELETE', status: 204 })
  }
}

async function main() {
  const key = process.env.GV02_MERGE_APP_PRIVATE_KEY
  delete process.env.GV02_MERGE_APP_PRIVATE_KEY
  const event = JSON.parse(execFileSync('/bin/cat', [process.env.GITHUB_EVENT_PATH], { maxBuffer: 128 * 1024 }))
  const control = executionContext(process.env, event)
  const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 3000 }).trim()
  requireThat(checkout === control, 'CONTROL_CHECKOUT_REJECTED')
  const mode = process.env.GV02_MODE
  requireThat(['probe', 'verify', 'trial', 'merge'].includes(mode), 'EXECUTOR_MODE_REJECTED')
  const number = name => {
    const value = process.env[name]
    requireThat(/^[1-9][0-9]*$/.test(value ?? '') && positiveId(Number(value)), 'INVALID_PROOF_INPUT')
    return Number(value)
  }
  const token = process.env.GH_TOKEN
  requireThat(token, 'READ_TOKEN_REQUIRED')
  const read = path => github(path, token)
  await assertFrozenControl(read, control)
  if (mode === 'probe') {
    requireThat(!key, 'HOST_PROBE_CREDENTIAL_FORBIDDEN')
    console.log(JSON.stringify({ status: 'FROZEN_HOST_PROBE_PASS', control }))
    return
  }
  const pr = number('GV02_PR')
  const download = path => execFileSync('gh', ['api', path], {
    env: { PATH: process.env.PATH, GH_TOKEN: token, GH_PROMPT_DISABLED: '1' },
    timeout: 15000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const expected = await verify(read, download, control, pr, number('GV02_BASELINE_ARTIFACT'),
    number('GV02_R1_ARTIFACT'), executorPolicy(process.env.GV02_R1_POLICY))
  const authority = expected.binding.main
  if (mode === 'verify') {
    console.log(JSON.stringify({ status: 'PROOF_VERIFIED', ...expected }))
    return
  }
  requireThat(key, 'EXECUTOR_KEY_MISSING')
  if (mode === 'merge') {
    const approved = process.env.GV02_APPROVED_MERGE
    requireThat(approved && same(JSON.parse(approved), expected.binding), 'EXACT_MERGE_APPROVAL_REQUIRED')
    assertMergeRules(await read(repositoryApi + '/rules/branches/main'))
  }
  await withInstallation(key, mode === 'merge', async appToken => {
    const fresh = await readGitHubSnapshot(read, repository, pr)
    requireThat(fresh.main === authority && fresh.pr.head.sha === expected.binding.head &&
      fresh.pr.draft === false && fresh.pr.mergeable === true &&
      fresh.testMerge?.sha === expected.testMerge && fresh.testMerge.tree === expected.binding.tree,
    'EXECUTION_SOURCE_MOVED')
    await assertFrozenControl(read, control)
    for (const proof of expected.evidence) {
      const run = await read(repositoryApi + '/actions/runs/' + proof.run)
      requireThat(run.run_attempt === proof.attempt && run.status === 'completed' &&
        run.conclusion === 'success', 'PROOF_ATTEMPT_MOVED')
    }
    if (mode === 'trial') {
      console.log(JSON.stringify({ status: 'TRIAL_PASS_NO_MERGE', app: mergeApp, installation, ...expected }))
      return
    }

    assertMergeRules(await read(repositoryApi + '/rules/branches/main'))
    // One ordinary merge attempt. Never retry a timeout or other ambiguous mutation.
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
    requireThat(after.merged === true && after.merge_commit_sha === result.sha &&
      after.merged_by?.id === mergeActor && ref.object.sha === result.sha &&
      same(commit.parents.map(parent => parent.sha), [authority, expected.binding.head]) &&
      commit.tree.sha === expected.binding.tree, 'MERGE_READBACK_REJECTED')
    console.log(JSON.stringify({ status: 'MERGED', sha: result.sha, app: mergeApp, ...expected }))
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const reason = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'EXECUTOR_REFUSED'
    console.error(reason)
    process.exitCode = 1
  })
}
