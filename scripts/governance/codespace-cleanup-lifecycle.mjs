#!/usr/bin/env node
/**
 * Task-scoped, opt-in lifecycle orchestration for the existing PMOS and
 * codespace-cleanup CLIs. Stage 03: NOT activated as a global hook.
 *
 * This module does not write PMOS, impersonate its registration/closeout or
 * infer disposable resources. Its start/finish entrypoints invoke the actual
 * canonical PMOS commands and verify continuity before enabling the epilogue.
 * All local allocations are new and task-owned; historical paths stay unknown.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { executeCleanup, OWNER_FILE } from './codespace-cleanup.mjs'

const taskRe = /^[A-Za-z0-9][A-Za-z0-9_.-]{3,159}$/
const nameRe = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,75}$/
const shaRe = /^[0-9a-f]{40,64}$/
const forbidden = new Set(['.git', '.pmos', '.context', 'recovery', 'pending', 'journals', 'history', 'phr', 'memoros', 'evidence', 'receipts', 'archives', 'secrets', 'credentials', '.ssh', '.config', 'lkg'])
const allowedProjects = new Set(['SG2', 'SRM', 'ARCHITECTURE'])
const allowedKinds = new Set(['ephemeral-directory', 'git-worktree'])
const allowedPhases = new Set(['pre-closeout', 'post-closeout'])

export class LifecycleRefusal extends Error { constructor(message) { super(message); this.name = 'LifecycleRefusal' } }
function block(s) { throw new LifecycleRefusal(s) }
function assert(condition, reason) { if (!condition) block(reason) }
function absolute(p, label) {
  assert(typeof p === 'string' && path.isAbsolute(p) && path.normalize(p) === p && !p.includes('\0'), `${label} must be absolute, normalized and nonempty`)
  return p
}
function contains(parent, candidate) { return candidate !== parent && candidate.startsWith(parent + path.sep) }
function canonicalDirectory(p, label) {
  absolute(p, label)
  const st = fs.lstatSync(p)
  assert(st.isDirectory() && !st.isSymbolicLink() && fs.realpathSync(p) === p, `${label} must be a canonical physical directory`)
  return p
}
function requirePlain(p) {
  const st = fs.lstatSync(p)
  assert(st.isFile() && !st.isSymbolicLink() && st.size < 2_000_000, `Unsafe file: ${p}`)
}
// An absolute, normalized string can still traverse a symlinked parent.
// Reject aliases instead of retaining a name that cleanup cannot locate in
// its physical resource inventory. Missing recovery slots are checked at
// their nearest existing ancestor; they need not be fabricated to validate.
function canonicalControlPath(p, label, { allowMissing = false } = {}) {
  absolute(p, label)
  let existing = p
  let st
  for (;;) {
    try { st = fs.lstatSync(existing); break }
    catch (e) {
      assert(e.code === 'ENOENT' && allowMissing && path.dirname(existing) !== existing,
        `${label} is missing or inaccessible`)
      existing = path.dirname(existing)
    }
  }
  assert(!st.isSymbolicLink() && fs.realpathSync(existing) === existing,
    `${label} must use a canonical physical path without symlink ancestors`)
  assert(existing === p || st.isDirectory(), `${label} has a nondirectory ancestor`)
  return p
}
function canonicalControlFile(p, label) {
  canonicalControlPath(p, label)
  requirePlain(p)
  return p
}
function json(p) { requirePlain(p); try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { block(`Invalid JSON: ${path.basename(p)}`) } }
function safeSlug(v) { return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v ?? '') }
function sameRepo(url, repository) {
  const m = /^(?:(?:https:\/\/|ssh:\/\/git@|git@)github\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url)
  return m?.[1].toLowerCase() === repository.toLowerCase()
}
function runRaw(cmd, args, cwd, { timeout = 20_000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, maxBuffer, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } })
  assert(!r.error && r.status === 0, `${cmd} ${args.slice(0, 2).join(' ')} failed (${r.error?.code ?? r.status ?? 'UNKNOWN'})`)
  return r.stdout.trim()
}
function git(cwd, ...args) { return runRaw('git', ['-C', cwd, ...args], cwd) }
function gitBytes(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { cwd, encoding: null, timeout: 30000,
    maxBuffer: 24 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT:'0', GIT_OPTIONAL_LOCKS:'0' } })
  assert(!r.error && r.status === 0, `Git blob read failed: ${args.slice(0, 2).join(' ')}`)
  return r.stdout
}
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex') }

export const PRE_CLOSEOUT_REPORT_PREFIX = 'WORKSPACE_PRE_CLOSEOUT_REPORT_V1:'
function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}'
  return JSON.stringify(value)
}
function substantiveDigest(value) {
  const { completionEvidence: _evidence, metadata, ...content } = value
  const { timestamp: _timestamp, ...identity } = metadata
  return sha256(stableJson({ ...content, metadata: identity }))
}
function assertReportInput(c, evidence, inputFile) {
  if (!inputFile || !fs.existsSync(inputFile)) return
  canonicalControlFile(inputFile, 'Cleanup evidence bootstrap')
  const digest = substantiveDigest(json(inputFile))
  assert(digest === evidence.baseDigest || digest === evidence.inputDigest,
    'Bootstrap changed after the measured pre-closeout report; preserve canonical recovery')
}
function prepareReportInput(c, report, inputFile, call) {
  let evidence = loadState(c).lifecycle.preCloseoutEvidence
  if (!evidence) {
    const input = json(canonicalControlFile(inputFile, 'Original bootstrap'))
    assert(!input.findings.findings.some(x => typeof x === 'string' && x.startsWith(PRE_CLOSEOUT_REPORT_PREFIX)),
      'Bootstrap already contains a cleanup report without its matching execution checkpoint')
    const receipt = { schemaVersion: '1.0', projectKey: c.projectKey, taskId: c.taskId,
      conversationId: loadState(c).lifecycle.conversationId, report: JSON.parse(JSON.stringify(report)) }
    const finding = PRE_CLOSEOUT_REPORT_PREFIX + stableJson(receipt)
    const enriched = { ...input, findings: { ...input.findings, findings: [...input.findings.findings, finding] } }
    const stem = `${c.stateFile}.${crypto.randomBytes(10).toString('hex')}.pre-closeout`
    evidence = { finding, digest: sha256(finding), report: receipt.report,
      baseDigest: substantiveDigest(input), inputDigest: substantiveDigest(enriched),
      rawInputFile: stem + '.input.json', inputFile: stem + '.validated.json', validated: false }
    // Preserve the actual measured report before validation/save can fail. A
    // retry reuses these facts; it never repeats deletion to recreate evidence.
    fileLock(c.stateFile, () => {
      const s = loadState(c)
      assert(!s.closeout && !s.lifecycle.preCloseoutEvidence, 'Concurrent cleanup report capture')
      s.lifecycle.preCloseoutEvidence = evidence
      s.lifecycle.closeoutInputPaths = [...new Set([...(s.lifecycle.closeoutInputPaths ?? []), inputFile,
        evidence.rawInputFile, evidence.inputFile])]
      saveState(c.stateFile, s)
    })
    fs.writeFileSync(evidence.rawInputFile, JSON.stringify(enriched, null, 2) + '\n', {flag:'wx',mode:0o600})
  }
  assertReportInput(c, evidence, inputFile)
  if (evidence.validated && !fs.existsSync(evidence.inputFile)) evidence = {...evidence,validated:false}
  if (!evidence.validated) {
    if (!fs.existsSync(evidence.rawInputFile)) {
      const input = json(canonicalControlFile(inputFile, 'Retained bootstrap'))
      assert(substantiveDigest(input) === evidence.baseDigest, 'Original bootstrap no longer matches cleanup checkpoint')
      input.findings.findings.push(evidence.finding)
      fs.writeFileSync(evidence.rawInputFile, JSON.stringify(input, null, 2) + '\n', {flag:'wx',mode:0o600})
    }
    if (!fs.existsSync(evidence.inputFile)) call('npx', ['--no-install','tsx','scripts/pmos-prepare-execution-handoff.ts',
      '--input',evidence.rawInputFile,'--output',evidence.inputFile], path.join(c.sourceRoot,'apps/pmos'),
      {timeout:120_000,maxBuffer:16*1024*1024})
    const verified = json(canonicalControlFile(evidence.inputFile, 'Canonical cleanup bootstrap'))
    assert(substantiveDigest(verified) === evidence.inputDigest && verified.findings.findings.includes(evidence.finding),
      'Canonical bootstrap did not preserve the actual pre-closeout report')
    fileLock(c.stateFile, () => {
      const s = loadState(c)
      assert(s.lifecycle.preCloseoutEvidence.digest === evidence.digest, 'Cleanup evidence changed during validation')
      s.lifecycle.preCloseoutEvidence.validated = true
      saveState(c.stateFile,s)
    })
    evidence = loadState(c).lifecycle.preCloseoutEvidence
  }
  assertReportInput(c, evidence, evidence.inputFile)
  return evidence
}

function fileLock(stateFile, work) {
  const name = stateFile + '.lifecycle.lock'
  const fd = fs.openSync(name, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600)
  try { fs.writeSync(fd, `${process.pid}\n`); return work() }
  finally { fs.closeSync(fd); fs.unlinkSync(name) }
}
function saveState(file, state) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try { fs.writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); fs.renameSync(temp, file) }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp) }
}
function loadState(config) {
  const state = json(config.stateFile)
  assert(state.schemaVersion === '1.0' && state.projectKey === config.projectKey && state.taskId === config.taskId && state.repository === config.repository && state.scopeRoot === config.scopeRoot, 'Task state identity mismatch')
  assert(Array.isArray(state.resources) && state.resources.length < 2000 && state.lifecycle?.beginRegistrationId, 'Missing canonical lifecycle registration')
  assert(Object.hasOwn(state.lifecycle, 'hostConversationId') &&
    state.lifecycle.hostConversationId === config.beginInput.hostConversationId, 'Canonical host conversation identity changed after original registration')
  return state
}
export function loadConfiguration(configFile) {
  canonicalControlFile(configFile, 'configFile')
  const c = json(configFile)
  assert(c.schemaVersion === '1.0' && allowedProjects.has(c.projectKey) && taskRe.test(c.taskId ?? '') && safeSlug(c.repository), 'Unregistered project/task/repository')
  for (const k of ['sourceRoot', 'scopeRoot', 'stateFile', 'beginInputFile', 'phrRoot']) absolute(c[k], k)
  canonicalDirectory(c.sourceRoot, 'sourceRoot')
  canonicalDirectory(c.scopeRoot, 'scopeRoot')
  canonicalDirectory(c.phrRoot, 'phrRoot')
  assert(c.scopeRoot.split(path.sep).filter(Boolean).length >= 2 && c.scopeRoot !== c.sourceRoot && !contains(c.scopeRoot, c.sourceRoot), 'Unsafe scope root')
  assert(!contains(c.sourceRoot, c.scopeRoot) && !contains(c.sourceRoot, c.stateFile), 'Task data must not be inside source repository')
  assert(c.phrRoot !== c.scopeRoot && !contains(c.scopeRoot, c.phrRoot) && !contains(c.phrRoot, c.scopeRoot), 'PHR clone and cleanup scope must be disjoint')
  assert(contains(c.scopeRoot, c.stateFile) && !contains(c.sourceRoot, c.stateFile), 'Task state must be inside the dedicated scope outside source Git')
  assert(!path.relative(c.scopeRoot, c.stateFile).split(path.sep).some(segment => forbidden.has(segment.toLowerCase()) || segment.startsWith('.env')), 'Protected state path')
  assert(fs.realpathSync(path.dirname(c.stateFile)) === path.dirname(c.stateFile), 'State parent must be canonical')
  const src = git(c.sourceRoot, 'rev-parse', '--show-toplevel')
  assert(src === c.sourceRoot && sameRepo(git(c.sourceRoot, 'remote', 'get-url', 'origin'), c.repository), 'Source repository identity mismatch')
  const phr = git(c.phrRoot, 'rev-parse', '--show-toplevel')
  assert(phr === c.phrRoot && sameRepo(git(c.phrRoot, 'remote', 'get-url', 'origin'), 'profitia/project-history-repository'), 'PHR repository identity mismatch')
  // Read the same active project registry used by the canonical preflight.
  // A workspace label is not an accepted PMOS project displayName.
  const registry = json(path.join(c.sourceRoot, 'Canon/registries/profitia-projects-v1.json'))
  const profile = registry.projects?.find(x => x.projectKey === c.projectKey && x.status === 'ACTIVE')
  assert(profile && profile.repository?.slug === c.repository &&
    Array.isArray(profile.workspaces), 'Task project is not ACTIVE in the canonical registry')
  canonicalControlFile(c.beginInputFile, 'beginInputFile')
  if (c.inspectorDescriptor !== undefined) canonicalControlPath(c.inspectorDescriptor, 'inspectorDescriptor', {allowMissing:true})
  const input = json(c.beginInputFile)
  assert(input.project === profile.displayName && profile.workspaces.includes(input.workspace),
    'PMOS project displayName/workspace does not match the canonical registry')
  assert(input.schemaVersion === '2.0' && input.taskId === c.taskId && input.targetEnvironment === 'development' && input.project && input.title && input.scope && Array.isArray(input.declaredTargetPaths) && input.declaredTargetPaths.length > 0, 'Invalid canonical PMOS begin input')
  assert(input.hostConversationId === null || (typeof input.hostConversationId === 'string' && input.hostConversationId.length > 0), 'Invalid host conversation identity')
  assert(!Object.hasOwn(input, 'conversationId'), 'New canonical registration cannot supply conversationId')
  return { ...c, configFile, beginInput: input }
}
function preflightArgs(config, requireBegin) {
  const i = config.beginInput
  const a = ['scripts/governance/governance-preflight.mjs', '--mode', 'development', '--project', config.projectKey,
    '--target-environment', 'development', '--task-id', config.taskId, '--title', i.title, '--scope', i.scope,
    '--workspace', i.workspace, '--execution-environment', i.executionEnvironment,
    '--repository-root', config.sourceRoot, ...i.declaredTargetPaths.flatMap(t => ['--target', t])]
  a.push(i.hostConversationId === null ? '--host-conversation-unavailable' : '--host-conversation-id', ...(i.hostConversationId === null ? [] : [i.hostConversationId]))
  if (requireBegin) a.push('--require-begin')
  return a
}
function jsonResult(output, label) {
  try { return JSON.parse(output) } catch { block(`${label} did not return a strict JSON acknowledgement`) }
}
function checkRegisteredTask(c, runtime, expectedStatus = 'running') {
  const call = runtime?.run ?? ((cmd, args, cwd, options) => runRaw(cmd, args, cwd, options))
  const hostCheck = c.beginInput.hostConversationId === null
    ? ['--check-host-conversation-unavailable']
    : ['--check-host-conversation-id', c.beginInput.hostConversationId]
  const result = jsonResult(call('npm', ['run', '--silent', 'pmos:begin', '--', '--check-task-id', c.taskId,
    ...hostCheck, '--check-project', c.beginInput.project, '--check-target-environment', 'development'], path.join(c.sourceRoot, 'apps/pmos'), {timeout:120_000}), 'pmos:begin status')
  const state = loadState(c)
  assert(result.status === 'PASS' && result.registrationId === state.lifecycle.beginRegistrationId &&
    (expectedStatus === null || result.executionStatus === expectedStatus), 'Canonical PMOS registration status or identity mismatch')
  return result
}
export function startTask(config, runtime = {}) {
  const call = runtime.run ?? ((cmd, args, cwd, options) => runRaw(cmd, args, cwd, options))
  const i = config.beginInput
  assert(i.taskId === config.taskId && !('conversationId' in i), 'Begin identity mismatch')
  if (fs.existsSync(config.stateFile)) {
    const state = loadState(config)
    assert(!state.closeout, 'A completed task cannot be reopened for cleanup')
    checkRegisteredTask(config, runtime, 'running')
    return { status: 'ALREADY_TRACKED', registrationId: state.lifecycle.beginRegistrationId, taskId: state.taskId }
  }
  // Never create even the task-local cooperative lock before actual
  // preflight, durable PMOS registration and the --require-begin gate pass.
  // Concurrent starts are safe: canonical begin is task-idempotent; the local
  // state lock is acquired only after all mandatory gates have succeeded.
  call('node', preflightArgs(config, false), config.sourceRoot, {timeout:120_000})
  const result = jsonResult(call('npm', ['run', '--silent', 'pmos:begin', '--', '--input', config.beginInputFile], path.join(config.sourceRoot, 'apps/pmos'), {timeout:120_000}), 'pmos:begin')
  assert(['REGISTERED', 'RESUMED'].includes(result.status) && result.taskId === config.taskId && result.registrationId && result.conversationId, 'Canonical pmos:begin registration not confirmed')
  call('node', preflightArgs(config, true), config.sourceRoot, {timeout:120_000})
  return fileLock(config.stateFile, () => {
    if (fs.existsSync(config.stateFile)) {
      const existing = loadState(config)
      assert(!existing.closeout && existing.lifecycle.beginRegistrationId === result.registrationId, 'Conflicting lifecycle state after concurrent start')
      return { status: 'ALREADY_TRACKED', registrationId: result.registrationId, taskId: config.taskId }
    }
    const state = {
      schemaVersion: '1.0', projectKey: config.projectKey, taskId: config.taskId, repository: config.repository,
      scopeRoot: config.scopeRoot, resources: [], lifecycle: { beginRegistrationId: result.registrationId, conversationId: result.conversationId,
        hostConversationId:i.hostConversationId, startedAt: new Date().toISOString() }
    }
    saveState(config.stateFile, state)
    return { status: 'TRACKING_INITIALIZED', registrationId: result.registrationId, taskId: state.taskId }
  })
}
function candidatePath(c, name) {
  assert(nameRe.test(name ?? '') && !name.startsWith('.') && !forbidden.has(name.toLowerCase()) && !name.toLowerCase().startsWith('secret'), 'Unsafe or protected resource name')
  const target = path.join(c.scopeRoot, name)
  assert(contains(c.scopeRoot, target) && !contains(c.sourceRoot, target) && !fs.existsSync(target), 'Resource is existing, out of scope or ambiguous')
  return target
}
export function allocateResource(c, { name, kind, phase }, runtime = {}) {
  assert(allowedKinds.has(kind) && allowedPhases.has(phase), 'Unknown resource kind or phase')
  if (kind === 'git-worktree') assert(phase === 'post-closeout', 'Worktree may be disposed only in post-closeout phase')
  return fileLock(c.stateFile, () => {
    const state = loadState(c)
    assert(!state.closeout, 'Cannot allocate resources after closeout')
    checkRegisteredTask(c, runtime, 'running')
    const dest = candidatePath(c, name)
    if (kind === 'ephemeral-directory') fs.mkdirSync(dest, { mode: 0o700 })
    else {
      const remote = git(c.sourceRoot, 'rev-parse', '--verify', 'refs/remotes/origin/main')
      assert(shaRe.test(remote), 'No verified local main for worktree')
      const upstream = git(c.sourceRoot, 'ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0]
      assert(upstream === remote, 'Remote main changed; no new worktree allocation')
      git(c.sourceRoot, 'worktree', 'add', '--detach', dest, remote)
    }
    const allocationId = crypto.randomBytes(20).toString('hex')
    const marker = { schemaVersion: '1.0', projectKey: c.projectKey, taskId: c.taskId, repository: c.repository,
      scopeRoot: c.scopeRoot, path: dest, kind, allocationId }
    fs.writeFileSync(path.join(dest, OWNER_FILE), JSON.stringify(marker, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    state.resources.push({ kind, path: dest, phase, allocationId, authorization: {
      resultVerified: false, retentionReleased: false, recoveryPreserved: false, noActiveConsumers: false,
    } })
    saveState(c.stateFile, state)
    return { status: 'RESOURCE_REGISTERED', path: dest, kind, allocationId }
  })
}
export function releaseResource(c, evidenceFile, runtime = {}) {
  canonicalControlFile(evidenceFile, 'evidenceFile')
  const e = json(evidenceFile)
  assert(e.schemaVersion === '1.0' && e.taskId === c.taskId && e.projectKey === c.projectKey && shaRe.test(e.allocationId ?? '') && e.verificationRef, 'Release evidence identity invalid')
  assert(['resultVerified','retentionReleased','recoveryPreserved','noActiveConsumers'].every(k => e.authorization?.[k] === true), 'Four affirmative release attestations and their evidence required')
  return fileLock(c.stateFile, () => {
    const state = loadState(c)
    assert(!state.closeout, 'Release evidence cannot edit completed task history')
    checkRegisteredTask(c, runtime, 'running')
    const entry = state.resources.find(x => x.allocationId === e.allocationId && x.path === e.path && x.kind === e.kind)
    assert(entry && state.resources.filter(x => x.allocationId === e.allocationId).length === 1, 'Release evidence does not match one task-owned resource')
    assert(!contains(entry.path, evidenceFile) && evidenceFile !== entry.path, 'Release evidence may not reside inside disposable candidate')
    entry.authorization = Object.fromEntries(['resultVerified','retentionReleased','recoveryPreserved','noActiveConsumers'].map(k => [k, true]))
    state.lifecycle.lastReleaseEvidenceRef = e.verificationRef
    // Exact local evidence paths must remain protected until canonical closeout.
    const releaseEvidencePaths = state.lifecycle.releaseEvidencePaths ?? []
    assert(Array.isArray(releaseEvidencePaths) && releaseEvidencePaths.length < 2000,
      'Invalid task-local evidence inventory')
    if (!releaseEvidencePaths.includes(evidenceFile)) releaseEvidencePaths.push(evidenceFile)
    state.lifecycle.releaseEvidencePaths = releaseEvidencePaths
    saveState(c.stateFile, state)
    return { status: 'RELEASE_ATTESTED', path: entry.path, taskId: c.taskId }
  })
}
// A pre-closeout cleanup is only allowed after the complete, actual PMOS
// closeout input has been checked. The token cannot be supplied from CLI.
const preparedCloseoutToken = Symbol('prepared-closeout-input')
function protectedByControlPaths(c, state, external = []) {
  // The epilogue is recoverable only if the caller can still load its config,
  // original work specification, handoff inputs, and release evidence. Preserve
  // these exact files in BOTH phases, including in a later standalone retry.
  const releaseEvidence = state.lifecycle.releaseEvidencePaths ?? []
  const closeoutInputs = state.lifecycle.closeoutInputPaths ?? []
  assert(Array.isArray(releaseEvidence) && releaseEvidence.length < 2000 &&
    Array.isArray(closeoutInputs) && closeoutInputs.length < 2000 &&
    Array.isArray(external) && external.length < 2000, 'Invalid protected path inventory')
  absolute(c.configFile, 'Task configuration source path')
  const paths = [c.configFile, c.stateFile, c.beginInputFile,
    path.join(c.sourceRoot, 'apps/pmos/.pmos/pending-artifact.json'),
    path.join(c.sourceRoot, 'apps/pmos/.pmos/recovery/active-closeout.json'),
    state.work?.specPath, state.work?.bootstrapInputFile, c.inspectorDescriptor,
    ...releaseEvidence, ...closeoutInputs, ...external].filter(p => p !== undefined)
  assert(paths.every(p => typeof p === 'string' && path.isAbsolute(p) && path.normalize(p) === p),
    'Invalid protected control/evidence paths')
  for (const p of paths) canonicalControlPath(p, 'Protected control/evidence path', { allowMissing: true })
  return [...new Set(paths)]
}
function assertNoControlPathUnderCandidates(state, phase, protectedPaths) {
  for (const resource of state.resources.filter(r => r.phase === phase && fs.existsSync(r.path))) {
    for (const p of protectedPaths) {
      if (p === resource.path || contains(resource.path, p))
        block(`Cleanup candidate contains required task control/evidence input: ${path.basename(p)}`)
    }
  }
}
export function phaseReport(c, phase, clean = false, opts = {}) {
  const state = loadState(c)
  assert(allowedPhases.has(phase), 'Invalid cleanup phase')
  if (phase === 'post-closeout') assert(state.closeout?.status === 'CLOSEOUT_COMPLETE' && state.closeout.readbackVerified === true, 'Post-closeout cannot be entered without verified canonical continuity')
  if (clean) {
    checkRegisteredTask(c, opts.runtime, phase === 'pre-closeout' ? 'running' : 'completed')
    if (phase === 'pre-closeout') {
      assert(opts.preparedCloseoutToken === preparedCloseoutToken,
        'Pre-closeout clean requires a verified canonical closeout input')
    }
    // Never let the post-closeout epilogue delete its own recovery inputs.
    // Apply the same strict, exact-path guard as the pre-closeout phase.
    const protectedPaths = protectedByControlPaths(c, state, opts.protectedPaths)
    assertNoControlPathUnderCandidates(state, phase, protectedPaths)
    if (phase === 'post-closeout') {
      const pinned = { publicationCommit: state.closeout.phrCommit, bundleHash: state.closeout.phrBundleHash }
      const receipt = opts.verifyPhr ? opts.verifyPhr(c, state.closeout.phrManifest, pinned) : verifyPhrReadback(c, state.closeout.phrManifest, pinned)
      assert(receipt.publicationId === state.closeout.publicationId &&
        receipt.bundleHash === state.closeout.phrBundleHash &&
        receipt.publicationCommit === state.closeout.phrCommit,
        'PHR task bundle or pinned publication proof changed since closeout')
      assert(receipt.businessResult === 'SUCCESS',
        'Destructive epilogue requires SUCCESS; preserve resources for incomplete business acceptance')
    }
  }
  return (opts.cleanup ?? executeCleanup)({ command: clean ? 'clean' : 'audit', projectKey: c.projectKey, taskId: c.taskId,
    repository: c.repository, sourceRoot: c.sourceRoot, scopeRoot: c.scopeRoot, stateFile: c.stateFile,
    phase, ...(c.inspectorDescriptor ? {inspectorDescriptor:c.inspectorDescriptor} : {}),
    ...(clean ? { confirmClean: c.taskId } : {}) })
}
export function findPhrManifestForTask(c) {
  // Discover by Git's *remote* committed history tree. A stale or separate PHR
  // checkout need not contain the new publication in its working directory.
  canonicalDirectory(c.phrRoot, 'phrRoot')
  assert(git(c.phrRoot, 'branch', '--show-current') === 'main', 'PHR clone is not on main')
  assert(sameRepo(git(c.phrRoot, 'config', '--get', 'remote.origin.url'), 'profitia/project-history-repository'),
    'Wrong PHR remote')
  const remote = git(c.phrRoot, 'ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0]
  assert(shaRe.test(remote), 'Cannot identify PHR remote main for discovery')
  git(c.phrRoot, 'fetch', '--no-tags', 'origin', 'main')
  assert(git(c.phrRoot, 'rev-parse', 'FETCH_HEAD') === remote,
    'Concurrent PHR publication advanced main during discovery; retry')
  const lines = git(c.phrRoot, 'ls-tree', '-r', '--name-only', remote, '--', 'history').split('\n').filter(Boolean)
  assert(lines.length <= 300_000, 'PHR remote history exceeds bounded discovery limit')
  // Match the canonical publisher's slugify(publicationId), including valid
  // task IDs containing repeated underscores, dots or dashes.
  const token = `${c.projectKey}:${c.taskId}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const candidates = lines.filter(name => /^history\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/manifest\.json$/.test(name)
    && name.split('/')[4].toLowerCase().includes(token))
  const matches = []
  for (const manifestRelative of candidates) {
    const value = gitBytes(c.phrRoot, 'show', `${remote}:${manifestRelative}`)
    let m
    try { m = JSON.parse(value.toString('utf8')) } catch { block('Invalid remote PHR manifest during discovery') }
    if (m.taskId === c.taskId && m.projectId === c.projectKey &&
        m.publicationId === `${c.projectKey}:${c.taskId}`) matches.push(manifestRelative)
  }
  assert(matches.length === 1, `Expected exactly one canonical PHR publication for task; found ${matches.length}`)
  return matches[0]
}
// Verify the exact immutable PHR bundle at the remote main snapshot, not a
// local ignored file or an exact whole-branch SHA. Newer unrelated PHR commits
// are allowed, but the original publication must remain an ancestor.
export function verifyPhrReadback(c, manifestRelative, expected = {}) {
  assert(typeof manifestRelative === 'string' && /^history\/(?:[^/.][^/]*\/){4}manifest\.json$/.test(manifestRelative) &&
    !manifestRelative.split('/').some(x => x === '..' || x === '.' || x.startsWith('.')) && !manifestRelative.includes('\\'),
    'Exact PHR manifest path required')
  canonicalDirectory(c.phrRoot, 'phrRoot')
  assert(git(c.phrRoot, 'branch', '--show-current') === 'main', 'PHR clone is not on main')
  assert(sameRepo(git(c.phrRoot, 'config', '--get', 'remote.origin.url'), 'profitia/project-history-repository'), 'Wrong PHR remote')
  const remoteHead = git(c.phrRoot, 'ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/)[0]
  assert(shaRe.test(remoteHead), 'Cannot identify PHR remote main')
  // Fetch does not reset, rebase or touch the working tree; it only makes
  // the pinned remote commit available for independent immutable blob reads.
  git(c.phrRoot, 'fetch', '--no-tags', 'origin', 'main')
  const fetched = git(c.phrRoot, 'rev-parse', 'FETCH_HEAD')
  assert(fetched === remoteHead, 'Concurrent PHR publication advanced main during verification; retry')
  if (expected.publicationCommit) {
    assert(shaRe.test(expected.publicationCommit), 'Invalid pinned PHR publication SHA')
    git(c.phrRoot, 'merge-base', '--is-ancestor', expected.publicationCommit, remoteHead)
  }
  const dir = manifestRelative.slice(0, -'/manifest.json'.length)
  const entries = git(c.phrRoot, 'ls-tree', '-r', remoteHead, '--', dir).split('\n').filter(Boolean)
  const actual = new Map()
  for (const line of entries) {
    const match = /^(100644) blob ([0-9a-f]{40,64})\t(.+)$/.exec(line)
    assert(match, 'PHR bundle contains a nonregular file or symlink')
    const rel = match[3].slice(dir.length + 1)
    assert(match[3].startsWith(dir + '/') && /^[a-z0-9][a-z0-9.-]*$/.test(rel), 'PHR bundle has unexpected nested or unsafe paths')
    actual.set(rel, gitBytes(c.phrRoot, 'show', `${remoteHead}:${match[3]}`))
  }
  assert(actual.has('manifest.json') && actual.has('integrity.json') && actual.has('closeout-evidence.json'),
    'PHR manifest/integrity/closeout evidence is incomplete')
  const parse = name => { try { return JSON.parse(actual.get(name).toString('utf8')) }
    catch { block(`Invalid published PHR JSON: ${name}`) } }
  const m = parse('manifest.json')
  const expectedPublicationId = `${c.projectKey}:${c.taskId}`
  assert(m.schemaVersion === '1.0' && m.publicationId === expectedPublicationId && m.projectId === c.projectKey &&
    m.taskId === c.taskId && m.sourceSystem === 'PMOS' && m.closeoutState === 'CLOSEOUT_COMPLETE' &&
    typeof m.result === 'string' && m.result.trim() && typeof m.publishedAt === 'string', 'PHR canonical publication mismatch')
  assert(Array.isArray(m.artifacts), 'Missing canonical PHR artifacts')
  const listed = new Set(['manifest.json'])
  for (const a of m.artifacts) {
    assert(a && ['PRESENT','ABSENT'].includes(a.status), 'Invalid PHR artifact descriptor')
    if (a.status === 'PRESENT') {
      assert(typeof a.path === 'string' && /^[a-z0-9][a-z0-9.-]*$/.test(a.path) && !listed.has(a.path), 'Unsafe or duplicate PHR artifact path')
      listed.add(a.path)
    } else assert(a.path === null, 'ABSENT PHR artifact must not reference a file')
  }
  assert(listed.has('integrity.json') && listed.has('closeout-evidence.json') &&
    listed.has('flight-record.json') && listed.has('conversation-artifact.json') && listed.has('handoff.md') &&
    listed.size === actual.size && [...actual.keys()].every(n => listed.has(n)), 'PHR bundle files differ from canonical manifest')
  const integrity = parse('integrity.json')
  assert(integrity.schemaVersion === '1.0' && integrity.algorithm === 'sha256' && Array.isArray(integrity.files), 'PHR integrity schema missing')
  const hashList = [...actual.entries()].filter(([name]) => name !== 'integrity.json')
    .sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>({path:name,sha256:sha256(bytes)}))
  const bundleHash = sha256(Buffer.from(hashList.map(x => `${x.path}\0${x.sha256}`).join('\0'), 'utf8'))
  assert(integrity.bundleHash === bundleHash && integrity.files.length === hashList.length &&
    integrity.files.every((x,i)=>x.path === hashList[i].path && x.sha256 === hashList[i].sha256),
    'PHR canonical integrity hashes or bundleHash mismatch')
  if (expected.bundleHash) assert(bundleHash === expected.bundleHash, 'PHR task bundle changed after closeout')
  const e = parse('closeout-evidence.json')
  assert(e.closeoutState === 'CLOSEOUT_COMPLETE' && e.pmosSaveStatus === 'SUCCEEDED' &&
    e.handoffPublicationStatus === 'SUCCEEDED' && e.recoveryRequired === false, 'PHR closeout evidence is not successful')
  for (const fileName of ['conversation-artifact.json','flight-record.json']) {
    const a = parse(fileName)
    assert(a.metadata?.taskId === c.taskId && a.metadata?.conversationId === loadState(c).lifecycle.conversationId &&
      a.metadata?.project === c.beginInput.project, 'Published PHR flight record identity mismatch')
    assert(a.result?.finalStatus === m.result, 'Published PHR business result differs from canonical manifest')
    const evidence = loadState(c).lifecycle.preCloseoutEvidence
    if (evidence) assert(a.findings?.findings?.includes(evidence.finding),
      'Published PHR evidence is missing the actual pre-closeout report')
  }
  return {head:remoteHead,manifestRelative,publicationId:m.publicationId,publishedAt:m.publishedAt,
    bundleHash,publicationCommit:expected.publicationCommit ?? remoteHead,businessResult:m.result}
}

function checkCanonicalCloseoutInput(c, state, bootstrapInputFile) {
  const pendingFile = path.join(c.sourceRoot, 'apps/pmos/.pmos/pending-artifact.json')
  const pendingExists = fs.existsSync(pendingFile)
  const hasBootstrap = Boolean(bootstrapInputFile && fs.existsSync(bootstrapInputFile))
  assert(pendingExists || hasBootstrap, 'Canonical PMOS pending artifact or --bootstrap-input required')
  const checkInput = (file, isBootstrap) => {
    absolute(file, isBootstrap ? 'bootstrapInputFile' : 'pendingFile')
    assert(fs.realpathSync(file) === file && file !== c.stateFile, 'PMOS closeout input must be a canonical, separate file')
    const value = json(file)
    const meta = value.metadata
    assert(meta?.taskId === c.taskId && meta.conversationId === state.lifecycle.conversationId &&
      meta.project === c.beginInput.project && meta.targetEnvironment === 'development',
      'PMOS closeout input belongs to another task, conversation, project or environment')
    if (c.beginInput.hostConversationId !== null)
      assert(meta.hostConversationId === c.beginInput.hostConversationId, 'PMOS closeout host conversation does not match original registration')
    else assert(!meta.hostConversationId, 'Unexpected PMOS host conversation identity')
    assert(Array.isArray(value.findings?.findings) && value.findings.findings.length > 0,
      'Canonical PMOS closeout input requires factual execution findings')
    if (isBootstrap) assert(!Object.hasOwn(value, 'completionEvidence'),
      'Canonical bootstrap must not provide completionEvidence')
    else assert(value.completionEvidence && typeof value.completionEvidence === 'object' &&
      !Array.isArray(value.completionEvidence), 'Canonical pending input requires PMOS completionEvidence')
    return value
  }
  const pending = pendingExists ? checkInput(pendingFile, false) : null
  const bootstrap = hasBootstrap ? checkInput(bootstrapInputFile, true) : null
  if (pending && bootstrap) {
    // Canonical PMOS materialization preserves ALL bootstrap data except two
    // PMOS-owned fields: completionEvidence and metadata.timestamp. Its
    // createCanonicalFlightRecordPayload is a JSON round-trip. Compare every
    // remaining field, including result, actions and validation evidence.
    // On mismatch pmos:save must NOT silently ignore the supplied bootstrap.
    const comparable = (value) => {
      const { completionEvidence: _pmosEvidence, metadata, ...content } = value
      const { timestamp: _pmosTimestamp, ...identityAndMetadata } = metadata
      return { ...content, metadata: identityAndMetadata }
    }
    assert(isDeepStrictEqual(comparable(pending), comparable(bootstrap)),
      'Existing PMOS pending artifact conflicts with supplied bootstrap substantive content')
  }
  return {
    saveArgs: pendingExists ? [] : ['--', '--bootstrap-input', bootstrapInputFile],
    businessResult: (pending ?? bootstrap).result?.finalStatus,
    protectedPaths: [pendingFile, ...(bootstrapInputFile ? [bootstrapInputFile] : [])],
    fromPending: pendingExists,
  }
}

export function finishTask(c, { manifestRelative, cleanPreCloseout = false, cleanPostCloseout = false,
  bootstrapInputFile, protectedPaths = [] } = {}, runtime = {}) {
  const call = runtime.run ?? ((cmd, args, cwd, options) => runRaw(cmd, args, cwd, options))
  const cleanup = runtime.cleanup ?? executeCleanup
  const s = loadState(c)
  assert(!s.closeout, 'Task closeout is already recorded; use post-closeout epilogue, not a second PMOS save')
  // First check canonical progress, BEFORE attempting pre-closeout cleanup.
  // A completed PMOS task may be waiting only for PHR readback after a crash.
  const before = checkRegisteredTask(c, runtime, null)
  // Record control paths before entering PMOS save: if persistence succeeds but
  // the PHR readback crashes, a later retry without --bootstrap-input must
  // still refuse to delete the original handoff and work-spec paths.
  const initialInputs = [...(bootstrapInputFile ? [bootstrapInputFile] : []), ...protectedPaths]
  assert(initialInputs.length < 2000 && initialInputs.every(p => typeof p === 'string' && path.isAbsolute(p) && path.normalize(p) === p),
    'Unsafe closeout input path inventory')
  for (const p of initialInputs) canonicalControlPath(p, 'Closeout input path', { allowMissing: true })
  if (initialInputs.length) fileLock(c.stateFile, () => {
    const current = loadState(c)
    assert(!current.closeout, 'Concurrent closeout change')
    const existing = current.lifecycle.closeoutInputPaths ?? []
    assert(Array.isArray(existing) && existing.length + initialInputs.length < 2000,
      'Invalid existing closeout path inventory')
    current.lifecycle.closeoutInputPaths = [...new Set([...existing, ...initialInputs])]
    saveState(c.stateFile, current)
  })
  let pre
  let preSkipped = null
  let evidence = loadState(c).lifecycle.preCloseoutEvidence
  if (before.executionStatus === 'completed') {
    // Do not retroactively clean under a completed PMOS registration.
    pre = evidence?.report ?? {summary:{NOT_APPLICABLE:s.resources.filter(r=>r.phase==='pre-closeout').length}}
    preSkipped = 'PMOS_ALREADY_COMPLETED'
  } else {
    assert(before.executionStatus === 'running', 'Cannot save an unregistered or suspended PMOS task')
    // Validate the full canonical input (including a resumed pending slot) and
    // protect it and every required task evidence BEFORE the first deletion.
    if (evidence) assertReportInput(c, evidence, bootstrapInputFile)
    const pendingFile = path.join(c.sourceRoot,'apps/pmos/.pmos/pending-artifact.json')
    if (fs.existsSync(pendingFile) && !evidence) {
      checkCanonicalCloseoutInput(c, s, bootstrapInputFile)
      block('Existing pending lacks a captured pre-closeout report; preserve it for canonical recovery')
    }
    if (evidence && !fs.existsSync(pendingFile) && !fs.existsSync(evidence.inputFile))
      evidence = prepareReportInput(c, evidence.report, bootstrapInputFile ?? evidence.rawInputFile, call)
    const effectiveInput = evidence
      ? (fs.existsSync(evidence.inputFile) ? evidence.inputFile : undefined) : bootstrapInputFile
    const ready = checkCanonicalCloseoutInput(c, s, effectiveInput)
    assert(!fs.existsSync(path.join(c.sourceRoot, 'apps/pmos/.pmos/recovery/active-closeout.json')),
      'An unresolved active PMOS closeout exists; use canonical PMOS recovery, not a blind save retry')
    let saveArgs = ready.saveArgs
    let preCleanAllowed = cleanPreCloseout && !ready.fromPending && !evidence && ready.businessResult === 'SUCCESS'
    if (evidence) {
      // Recovery reuses the original measured result. Never replace it with
      // another audit/clean after a save or validation failure.
      if (ready.fromPending) {
        const pending = json(pendingFile)
        assert(substantiveDigest(pending) === evidence.inputDigest && pending.findings.findings.includes(evidence.finding),
          'Pending input does not contain the captured canonical cleanup evidence')
        preSkipped = 'PMOS_PENDING_RECOVERY'
      } else {
        evidence = prepareReportInput(c, evidence.report, bootstrapInputFile ?? evidence.rawInputFile, call)
        saveArgs = ['--','--bootstrap-input',evidence.inputFile]
        preSkipped = 'PRE_CLOSEOUT_REPORT_RECOVERY'
      }
      pre = evidence.report
    } else {
    if (preCleanAllowed) {
      // Canonical PMOS bootstrap validation MUST run successfully before the
      // first destructive pre-closeout cleanup. The existing PMOS handoff CLI
      // materializes the validated input outside any disposable candidate.
      const protectedBeforeValidation = protectedByControlPaths(c, s,
        [...ready.protectedPaths, ...protectedPaths])
      assertNoControlPathUnderCandidates(s, 'pre-closeout', protectedBeforeValidation)
      const verified = `${c.stateFile}.${crypto.randomBytes(10).toString('hex')}.prepared-bootstrap.json`
      assert(contains(c.scopeRoot, verified) && !fs.existsSync(verified),
        'Canonical bootstrap validation output path is not safe')
      call('npx', ['--no-install', 'tsx', 'scripts/pmos-prepare-execution-handoff.ts',
        '--input', bootstrapInputFile, '--output', verified], path.join(c.sourceRoot, 'apps/pmos'),
        {timeout:120_000, maxBuffer:16*1024*1024})
      assert(fs.existsSync(verified), 'Canonical PMOS bootstrap validation produced no artifact')
      checkCanonicalCloseoutInput(c, s, verified)
      saveArgs = ['--', '--bootstrap-input', verified]
      ready.protectedPaths.push(verified)
    }
    // A pending slot means PMOS was already entered. For recovery, do not
    // repeat any pre-closeout deletion, even when the task is still running.
    pre = phaseReport(c, 'pre-closeout', preCleanAllowed, {cleanup, runtime,
      preparedCloseoutToken, protectedPaths: [...ready.protectedPaths, ...protectedPaths]})
    const measuredInput = saveArgs[saveArgs.indexOf('--bootstrap-input') + 1]
    evidence = prepareReportInput(c, pre, measuredInput, call)
    saveArgs = ['--','--bootstrap-input',evidence.inputFile]
    }
    // pmos:save remains canonical; never write or fabricate pending artifacts.
    call('npm', ['run', '--silent', 'pmos:save', ...saveArgs], path.join(c.sourceRoot, 'apps/pmos'),
      {timeout:300_000, maxBuffer:16*1024*1024})
  }
  const check = checkRegisteredTask(c, runtime, 'completed')
  assert(check.registrationId === s.lifecycle.beginRegistrationId, 'Canonical PMOS registration is not bound to task lifecycle')
  assert(!fs.existsSync(path.join(c.sourceRoot, 'apps/pmos/.pmos/pending-artifact.json')) &&
    !fs.existsSync(path.join(c.sourceRoot, 'apps/pmos/.pmos/recovery/active-closeout.json')),
    'Pending PMOS slot or active closeout remains; preserve task resources')
  assert(evidence?.validated && evidence.digest === sha256(evidence.finding),
    'Canonical closeout has no verified pre-closeout evidence checkpoint')
  const resolvedManifest = manifestRelative ?? findPhrManifestForTask(c)
  const phr = runtime.verifyPhr ? runtime.verifyPhr(c, resolvedManifest) : verifyPhrReadback(c, resolvedManifest)
  assert(typeof phr.bundleHash === 'string' && /^[0-9a-f]{64}$/.test(phr.bundleHash),
    'Full PHR integrity proof is required before marking closeout')
  fileLock(c.stateFile, () => {
    const current = loadState(c)
    assert(!current.closeout, 'Concurrent closeout change')
    // Retain exact task control paths across a crash between closeout and
    // epilogue. A later direct post-closeout retry must still protect them.
    const inputs = [...(current.lifecycle.closeoutInputPaths ?? []),
      ...(bootstrapInputFile ? [bootstrapInputFile] : []), ...protectedPaths]
    assert(inputs.length < 2000 && inputs.every(p => typeof p === 'string' && path.isAbsolute(p) && path.normalize(p) === p),
      'Unsafe closeout input path inventory')
    current.lifecycle.closeoutInputPaths = [...new Set(inputs)]
    current.closeout = { status: 'CLOSEOUT_COMPLETE', phrPublished: true, pendingSlotCleared: true,
      readbackVerified: true, publicationId: phr.publicationId, phrCommit: phr.publicationCommit ?? phr.head,
      phrBundleHash: phr.bundleHash, phrManifest: phr.manifestRelative, businessResult: phr.businessResult }
    saveState(c.stateFile, current)
  })
  const post = phaseReport(c, 'post-closeout', cleanPostCloseout,
    { cleanup, runtime, verifyPhr: runtime.verifyPhr, protectedPaths })
  return { status: 'CLOSEOUT_VERIFIED', taskId: c.taskId, preCloseout: pre.summary,
    preCloseoutReport: pre, postCloseoutReport: post,
    preCloseoutSkipped: preSkipped, preCloseoutEvidenceDigest: evidence.digest, postCloseout: post.summary,
    postCleanAttempted: cleanPostCloseout, phrPublication: phr.publicationId,
    observedFreeBytesDelta: post.observedFreeBytesDelta ?? null }
}
/**
 * Explicit, opt-in task-runner boundary: replaces manual start/work/finish
 * command sequencing for an authorized task. Stage05, not this module,
 * would decide when Codex invokes it by default. No global hooks installed.
 * The actual business command must create a lawful PMOS bootstrap before exit.
 */
export function runTask(c, workSpecFile, runtime = {}) {
  absolute(workSpecFile, 'workSpecFile')
  assert(contains(c.scopeRoot, workSpecFile) && fs.realpathSync(workSpecFile) === workSpecFile &&
    !contains(c.sourceRoot, workSpecFile), 'Task work spec must be a canonical file outside source checkout')
  const specBytes = fs.readFileSync(workSpecFile)
  const spec = json(workSpecFile)
  canonicalControlPath(spec.bootstrapInputFile, 'work-spec bootstrapInputFile', { allowMissing: true })
  assert(spec.schemaVersion === '1.0' && spec.taskId === c.taskId &&
    typeof spec.program === 'string' && path.isAbsolute(spec.program) &&
    Array.isArray(spec.args) && spec.args.length <= 128 && spec.args.every(x=>typeof x === 'string' && x.length < 8192) &&
    [c.sourceRoot, c.scopeRoot].includes(spec.cwd) &&
    Number.isInteger(spec.timeoutMs) && spec.timeoutMs >= 1000 && spec.timeoutMs <= 7_200_000 &&
    spec.bootstrapInputFile && typeof spec.bootstrapInputFile === 'string' &&
    (!spec.cleanPreCloseout || spec.cleanPreCloseout === true) &&
    (!spec.cleanPostCloseout || spec.cleanPostCloseout === true), 'Invalid explicit task work specification')
  const digest = sha256(specBytes)
  if (!fs.existsSync(c.stateFile)) startTask(c, runtime)
  const state = loadState(c)
  if (state.closeout) {
    assert(state.work?.status === 'SUCCEEDED' && state.work.specDigest === digest &&
      state.work.specPath === workSpecFile && state.work.bootstrapInputFile === spec.bootstrapInputFile,
      'Completed lifecycle is not bound to this work specification')
    const post = phaseReport(c, 'post-closeout', spec.cleanPostCloseout === true,
      {runtime, cleanup:runtime.cleanup ?? executeCleanup, verifyPhr:runtime.verifyPhr,
        protectedPaths: [workSpecFile, spec.bootstrapInputFile]})
    return {runner:'OPT_IN_AUTOMATIC_TASK_CHAIN', work:'SUCCEEDED',
      closeout: {status:'ALREADY_CLOSED', postCloseout:post.summary, postCloseoutReport:post,
        postCleanAttempted:spec.cleanPostCloseout === true}}
  }
  if (!state.work) {
    checkRegisteredTask(c, runtime, 'running')
    fileLock(c.stateFile, () => {
      const current = loadState(c)
      assert(!current.work, 'Concurrent worker already claimed task')
      current.work = { status:'STARTED', specDigest:digest, specPath:workSpecFile,
        bootstrapInputFile:spec.bootstrapInputFile, startedAt:new Date().toISOString() }
      saveState(c.stateFile, current)
    })
    try {
      const call = runtime.work ?? ((command,args,cwd,options)=>runRaw(command,args,cwd,options))
      call(spec.program, spec.args, spec.cwd, {timeout:spec.timeoutMs, maxBuffer:16*1024*1024})
    } catch(e) {
      fileLock(c.stateFile, () => {
        const current=loadState(c)
        current.work.status='FAILED'
        saveState(c.stateFile,current)
      })
      throw e
    }
    fileLock(c.stateFile, () => {
      const current=loadState(c)
      assert(current.work?.status === 'STARTED' && current.work.specDigest === digest, 'Task work identity changed during execution')
      current.work.status='SUCCEEDED'
      current.work.completedAt=new Date().toISOString()
      saveState(c.stateFile,current)
    })
  } else {
    assert(state.work.specDigest === digest && state.work.status === 'SUCCEEDED' &&
      state.work.specPath === workSpecFile && state.work.bootstrapInputFile === spec.bootstrapInputFile,
      'Interrupted, failed or modified task command requires manual review before resume')
  }
  // On resumed execution, canonical PMOS may already have persisted closeout.
  // finishTask checks this first and never calls pmos:save twice.
  return {runner:'OPT_IN_AUTOMATIC_TASK_CHAIN',
    work:'SUCCEEDED', closeout: finishTask(c, {bootstrapInputFile:spec.bootstrapInputFile,
      cleanPreCloseout:spec.cleanPreCloseout === true,
      cleanPostCloseout:spec.cleanPostCloseout === true,
      manifestRelative:spec.manifestRelative, protectedPaths:[workSpecFile]}, runtime)}
}

function parseArgs(argv) {
  const action = argv[0]
  const opts = { action }
  const keys = { '--config': 'configFile', '--name': 'name', '--kind': 'kind', '--phase': 'phase', '--evidence': 'evidenceFile', '--phr-manifest': 'manifestRelative', '--bootstrap-input': 'bootstrapInputFile', '--work-spec': 'workSpecFile' }
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--clean') { opts.clean = true; continue }
    if (!keys[argv[i]] || !argv[i + 1] || argv[i + 1].startsWith('--')) block(`Unknown or missing CLI option: ${argv[i]}`)
    if (Object.hasOwn(opts, keys[argv[i]])) block(`Duplicate CLI option: ${argv[i]}`)
    opts[keys[argv[i]]] = argv[++i]
  }
  assert(['start', 'allocate', 'release', 'pre-closeout', 'finish', 'post-closeout', 'run', 'status'].includes(action), 'Unknown lifecycle action')
  assert(opts.configFile, 'Use --config ABSOLUTE/CONFIG.json')
  return opts
}
function main(argv) {
  const o = parseArgs(argv), c = loadConfiguration(o.configFile)
  if (o.action === 'start') return startTask(c)
  if (o.action === 'allocate') return allocateResource(c, { name: o.name, kind: o.kind, phase: o.phase ?? 'pre-closeout' })
  if (o.action === 'release') return releaseResource(c, o.evidenceFile)
  if (o.action === 'pre-closeout') return phaseReport(c, 'pre-closeout', o.clean)
  if (o.action === 'finish') return finishTask(c, { manifestRelative: o.manifestRelative, bootstrapInputFile: o.bootstrapInputFile, cleanPostCloseout: o.clean })
  if (o.action === 'run') return runTask(c, o.workSpecFile)
  if (o.action === 'post-closeout') return phaseReport(c, 'post-closeout', o.clean)
  return { taskId: c.taskId, ...(fs.existsSync(c.stateFile) ? { state: loadState(c) } : { status: 'NOT_INITIALIZED' }) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)) }
  catch (e) { console.error(JSON.stringify({ status: 'BLOCKED', reason: e.message })); process.exitCode = 2 }
}
