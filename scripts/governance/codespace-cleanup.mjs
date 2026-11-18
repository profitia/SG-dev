#!/usr/bin/env node
/**
 * Task-scoped Codespace cleanup. Stage 02: a manual, fail-closed audit/clean CLI.
 * No hook, scheduler, registration or PMOS mutation is provided by this module.
 * Contract: Canon v3 §10.8. Node >=20, no third-party dependencies.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const OWNER_FILE = '.codespace-cleanup-owner.json'
const VALID_KINDS = new Set(['ephemeral-directory', 'git-worktree'])
const VALID_PHASES = new Set(['pre-closeout', 'post-closeout'])
const PROTECTED_NAMES = new Set([
  '.git', '.pmos', '.context', '.ssh', '.gnupg', '.aws', '.config',
  'recovery', 'recoveries', 'journal', 'journals', 'pending', 'closeout', 'closeouts',
  'evidence', 'receipts', 'archives', 'history', 'phr', 'memoros', 'lkg',
  'credentials', 'secrets', 'private', 'locks', '.env', '.env.local',
])
const RESOURCE_STATUSES = new Set(['CLEANED', 'RETAINED', 'REVIEW_REQUIRED', 'UNKNOWN_OWNER', 'OWNED_DISPOSABLE', 'NOT_APPLICABLE'])
const DEFAULT_MAX_ENTRIES = 500_000

class Refuse extends Error { constructor(reason, code = 'REVIEW_REQUIRED') { super(reason); this.code = code } }
function deny(reason, code) { throw new Refuse(reason, code) }
function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) deny(`${label} must be a nonempty string`)
  return value
}
function assertAbsolute(value, label) {
  assertString(value, label)
  if (!path.isAbsolute(value) || path.normalize(value) !== value || value.includes('\0')) deny(`${label} must be an absolute normalized path`)
  return value
}
function inside(candidate, parent) {
  return candidate !== parent && candidate.startsWith(parent + path.sep)
}
function sameOrInside(candidate, parent) { return candidate === parent || inside(candidate, parent) }
function matchRepo(actualUrl, expectedSlug, allowLocalOriginForTests) {
  if (allowLocalOriginForTests && path.isAbsolute(actualUrl)) return true
  const m = /^(?:(?:https:\/\/|ssh:\/\/git@|git@)github\.com[/:])([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(actualUrl)
  return Boolean(m && m[1].toLowerCase() === expectedSlug.toLowerCase())
}
function isProtectedName(name) {
  const lower = name.toLowerCase()
  return PROTECTED_NAMES.has(lower) || lower.startsWith('.env.') || /\.(pem|key|p12|pfx|sqlite|db)$/.test(lower)
}
function assertSafePathComponents(base, target) {
  assertAbsolute(base, 'scopeRoot')
  assertAbsolute(target, 'resource.path')
  if (!inside(target, base)) deny('Resource is outside its explicitly selected scope root')
  if (base === path.parse(base).root || base.split(path.sep).filter(Boolean).length < 2 ||
      base.split(path.sep).filter(Boolean).some(isProtectedName)) deny('Unsafe or protected scope root')
  const st = fs.lstatSync(base)
  if (!st.isDirectory() || st.isSymbolicLink() || fs.realpathSync(base) !== base) deny('Scope root is not a canonical directory')
  let walk = base
  for (const part of path.relative(base, target).split(path.sep)) {
    if (isProtectedName(part)) deny(`Protected path component: ${part}`)
    walk = path.join(walk, part)
    const item = fs.lstatSync(walk)
    if (item.isSymbolicLink()) deny(`Symlinked path component: ${part}`)
  }
  if (fs.realpathSync(target) !== target) deny('Noncanonical resource path')
  if (!fs.lstatSync(target).isDirectory()) deny('Only actual directories can be candidates')
}
function git(cwd, args, { allowError = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1' },
  })
  if (r.error || r.status !== 0) {
    if (allowError) return null
    deny(`Git verification failed: ${args[0]} (${r.error?.code ?? r.status ?? 'unknown'})`)
  }
  return r.stdout.trimEnd()
}
function statfsAvailable(scope) {
  const s = fs.statfsSync(scope)
  return Number(s.bavail) * Number(s.bsize)
}
function pathsEqual(a, b) { return path.resolve(a) === path.resolve(b) }
function readJson(file) {
  const stat = fs.lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink()) deny(`JSON file must be an ordinary file: ${path.basename(file)}`)
  if (stat.size > 2_000_000) deny('JSON file exceeds the size limit')
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { deny(`Invalid JSON: ${path.basename(file)}`) }
}
function normalizedRealDirectory(dir, label) {
  assertAbsolute(dir, label)
  const st = fs.lstatSync(dir)
  if (!st.isDirectory() || st.isSymbolicLink() || fs.realpathSync(dir) !== dir) deny(`${label} must be an existing canonical directory`)
  return dir
}
function validateSource({ sourceRoot, repository, allowLocalOriginForTests }) {
  normalizedRealDirectory(sourceRoot, 'sourceRoot')
  const top = git(sourceRoot, ['rev-parse', '--show-toplevel'])
  if (!pathsEqual(top, sourceRoot)) deny('Source is not a Git working tree root')
  const url = git(sourceRoot, ['remote', 'get-url', 'origin'])
  if (!matchRepo(url, repository, allowLocalOriginForTests)) deny('Source origin does not match declared repository')
  const common = git(sourceRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  normalizedRealDirectory(common, 'Git common directory')
  return { origin: url, commonDir: common }
}
function checkMarker(resource, state, scopeRoot) {
  const markerFile = path.join(resource.path, OWNER_FILE)
  if (!fs.existsSync(markerFile)) deny('Missing explicit owner marker', 'UNKNOWN_OWNER')
  const marker = readJson(markerFile)
  if (marker.schemaVersion !== '1.0' || marker.projectKey !== state.projectKey || marker.taskId !== state.taskId ||
      marker.repository !== state.repository || marker.path !== resource.path || marker.kind !== resource.kind ||
      marker.allocationId !== resource.allocationId || !/^[0-9a-f]{32,64}$/.test(marker.allocationId ?? '')) {
    deny('Marker does not match the task-scoped inventory', 'UNKNOWN_OWNER')
  }
  if (marker.scopeRoot !== scopeRoot) deny('Owner marker has a different scope root', 'UNKNOWN_OWNER')
  return { markerFile, marker }
}
function validateAuthorization(resource, state, phase) {
  if (resource.phase !== phase || !VALID_PHASES.has(resource.phase)) deny('Resource is not authorized for this cleanup phase', 'RETAINED')
  const a = resource.authorization
  if (!a || a.resultVerified !== true || a.retentionReleased !== true || a.recoveryPreserved !== true || a.noActiveConsumers !== true) {
    deny('Task outcome, retention, recovery or quiescence not affirmatively verified', 'RETAINED')
  }
  if (phase === 'post-closeout') {
    const c = state.closeout
    if (!c || c.status !== 'CLOSEOUT_COMPLETE' || c.phrPublished !== true || c.pendingSlotCleared !== true || c.readbackVerified !== true) {
      deny('Post-closeout requires attested completed PMOS/PHR and cleared pending slot', 'RETAINED')
    }
  }
  if (resource.kind === 'git-worktree' && phase !== 'post-closeout') deny('Git worktrees may only be removed in the verified post-closeout epilogue', 'RETAINED')
}
function walkDirectory(root, { allowGitFile = false, skipProtected = false, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  let items = 0, logicalBytes = 0, allocatedBytes = 0
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    for (const d of fs.readdirSync(current, { withFileTypes: true })) {
      if (++items > maxEntries) deny('Directory exceeds bounded verification limit')
      const p = path.join(current, d.name)
      const st = fs.lstatSync(p)
      if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile())) deny(`Unsafe nested filesystem entry: ${d.name}`)
      if (d.name === OWNER_FILE && pathsEqual(current, root)) continue
      if (allowGitFile && pathsEqual(current, root) && d.name === '.git' && st.isFile()) continue
      if (!skipProtected && isProtectedName(d.name) && !(allowGitFile && st.isFile() && d.name === '.git')) {
        deny(`Protected content under candidate: ${d.name}`)
      }
      if (st.isDirectory()) stack.push(p)
      else { logicalBytes += st.size; allocatedBytes += st.blocks * 512 }
    }
  }
  return { items, logicalBytes, allocatedBytes }
}
function assertNoLiveLocalConsumer(target) {
  // Best-effort OS observation, in addition to the explicit task quiescence attestation.
  // Linux exposes same-UID cwd and fd ownership through /proc. Other hosts still
  // require the explicit task-level confirmation; never infer from age alone.
  if (process.platform !== 'linux' || !fs.existsSync('/proc')) return
  const uid = process.getuid?.()
  let inspectedFds = 0
  for (const pid of fs.readdirSync('/proc').filter(s => /^[0-9]+$/.test(s))) {
    const root = path.join('/proc', pid)
    let st
    try { st = fs.statSync(root) } catch (e) { if (e.code === 'ENOENT') continue; throw e }
    if (uid !== undefined && st.uid !== uid) continue
    for (const ref of [path.join(root, 'cwd'), path.join(root, 'root')]) {
      // The process root is usually '/' and cannot itself establish activity.
      if (ref.endsWith('/root')) continue
      let location
      try { location = fs.readlinkSync(ref) }
      catch (e) { if (e.code === 'ENOENT' || e.code === 'ESRCH') continue; deny('Unable to inspect same-user process cwd') }
      if (sameOrInside(location.replace(/ \(deleted\)$/, ''), target)) deny('Active local process has cwd within candidate', 'RETAINED')
    }
    let fds
    try { fds = fs.readdirSync(path.join(root, 'fd')) }
    catch (e) { if (e.code === 'ENOENT' || e.code === 'ESRCH') continue; deny('Unable to inspect same-user open file descriptors') }
    for (const fd of fds) {
      if (++inspectedFds > 30_000) deny('Process verification limit exceeded')
      let dest
      try { dest = fs.readlinkSync(path.join(root, 'fd', fd)) }
      catch (e) { if (e.code === 'ENOENT' || e.code === 'ESRCH') continue; deny('Unable to inspect same-user open file') }
      if (sameOrInside(dest.replace(/ \(deleted\)$/, ''), target)) deny('Active local process holds an open file within candidate', 'RETAINED')
    }
  }
}
function findContainingRepo(dir) {
  return git(dir, ['rev-parse', '--show-toplevel'], { allowError: true })
}
function checkCache(resource, state, sourceRoot) {
  // No checked-in file can be removed even from a task-owned subdirectory.
  const containing = findContainingRepo(path.dirname(resource.path))
  if (containing) {
    if (!pathsEqual(containing, sourceRoot)) deny('Ephemeral directory belongs to another Git checkout; refuse')
    const relative = path.relative(sourceRoot, resource.path)
    const tracked = git(sourceRoot, ['ls-files', '--cached', '-z', '--', relative])
    if (tracked.length) deny('Candidate contains tracked Git files')
  }
  return walkDirectory(resource.path)
}
function parseWorktrees(s) {
  const all = []
  let cur = null
  for (const line of s.split('\n')) {
    if (line.startsWith('worktree ')) { cur = { path: line.slice(9) }; all.push(cur) }
    else if (cur && line === 'locked') cur.locked = true
    else if (cur && line.startsWith('locked ')) cur.locked = true
    else if (cur && line === 'prunable') cur.prunable = true
    else if (cur && line.startsWith('prunable ')) cur.prunable = true
    else if (cur && line === 'bare') cur.bare = true
  }
  return all
}
function checkGitWorktree(resource, sourceRoot, state, source) {
  if (sameOrInside(sourceRoot, resource.path) || sameOrInside(process.cwd(), resource.path)) deny('Worktree is current source or contains the running process')
  const root = git(resource.path, ['rev-parse', '--show-toplevel'])
  if (!pathsEqual(root, resource.path)) deny('Candidate is not a standalone Git worktree')
  const common = git(resource.path, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (!pathsEqual(common, source.commonDir)) deny('Worktree is not attached to expected Git source')
  const url = git(resource.path, ['remote', 'get-url', 'origin'])
  if (url !== source.origin) deny('Worktree has a different Git remote')
  const entries = parseWorktrees(git(sourceRoot, ['worktree', 'list', '--porcelain']))
  const matching = entries.filter(e => pathsEqual(e.path, resource.path))
  if (matching.length !== 1 || matching[0].locked || matching[0].prunable || matching[0].bare) deny('Worktree missing, locked, prunable or ambiguous', 'RETAINED')
  const statuses = git(resource.path, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching', '--', '.'])
  const allLines = statuses ? statuses.split('\n') : []
  if (allLines.some(x => x !== `?? ${OWNER_FILE}`)) deny('Worktree contains modified, untracked or ignored files besides the owner marker', 'RETAINED')
  if (allLines.length !== 1 || allLines[0] !== `?? ${OWNER_FILE}`) deny('Worktree marker status is not explicitly confirmed', 'RETAINED')
  const head = git(resource.path, ['rev-parse', 'HEAD'])
  const remoteMain = git(sourceRoot, ['rev-parse', '--verify', 'refs/remotes/origin/main'])
  if (git(sourceRoot, ['merge-base', '--is-ancestor', head, remoteMain], { allowError: true }) === null) deny('Worktree HEAD is not reachable from origin/main', 'RETAINED')
  // The local remote-tracking tip must match the actual remote tip. No git fetch is run by this tool.
  const actualMain = git(sourceRoot, ['ls-remote', '--heads', 'origin', 'refs/heads/main'])
  const match = /^([a-f0-9]{40,64})\s+refs\/heads\/main$/m.exec(actualMain)
  if (!match || match[1] !== remoteMain) deny('Local origin/main is stale or remote main is unavailable', 'RETAINED')
  return { ...walkDirectory(resource.path, { allowGitFile: true, skipProtected: true }), head, remoteMain }
}
function checkResource(resource, state, args, source) {
  const { scopeRoot, sourceRoot, phase } = args
  const result = { path: resource?.path ?? null, kind: resource?.kind ?? null, status: 'REVIEW_REQUIRED', reason: null }
  try {
    if (!resource || !VALID_KINDS.has(resource.kind)) deny('Unknown resource kind')
    assertAbsolute(resource.path, 'resource.path')
    if (!inside(resource.path, scopeRoot) || sameOrInside(sourceRoot, resource.path)) deny('Resource is outside task-owned cleanup scope')
    if (args.stateFile && sameOrInside(args.stateFile, resource.path)) deny('Task-state file or cooperative lock resides inside candidate')
    if (!fs.existsSync(resource.path)) {
      result.status = 'NOT_APPLICABLE'
      result.reason = 'Previously recorded resource is absent; no deletion attempted'
      return result
    }
    if (!Array.isArray(state.resources) || state.resources.filter(r => r.path === resource.path).length !== 1) deny('Duplicate or missing inventory entry')
    assertSafePathComponents(scopeRoot, resource.path)
    if (pathsEqual(resource.path, sourceRoot) || sameOrInside(sourceRoot, resource.path)) deny('Source checkout cannot be removed')
    // Do not touch source repository's .git, product sources or a PHR clone.
    const marker = checkMarker(resource, state, scopeRoot)
    validateAuthorization(resource, state, phase)
    assertNoLiveLocalConsumer(resource.path)
    const snapshot = fs.lstatSync(resource.path)
    const size = resource.kind === 'git-worktree' ? checkGitWorktree(resource, sourceRoot, state, source) : checkCache(resource, state, sourceRoot)
    result.status = 'OWNED_DISPOSABLE'
    result.measurement = { logicalBytes: size.logicalBytes, allocatedBytes: size.allocatedBytes, entries: size.items }
    result.expectedIdentity = { dev: snapshot.dev, ino: snapshot.ino }
    result.markerFile = marker.markerFile
  } catch (e) {
    result.status = ['UNKNOWN_OWNER', 'RETAINED'].includes(e?.code) ? e.code : 'REVIEW_REQUIRED'
    result.reason = e instanceof Refuse ? e.message : `Inspection error: ${e.code ?? e.name ?? 'unknown'}`
  }
  return result
}
function verifyExistingIdentity(result, scopeRoot) {
  assertSafePathComponents(scopeRoot, result.path)
  const st = fs.lstatSync(result.path)
  if (st.dev !== result.expectedIdentity.dev || st.ino !== result.expectedIdentity.ino) deny('Resource was replaced during inspection')
}
function parseArgs(argv) {
  const command = argv[0]
  if (!['audit', 'clean'].includes(command)) throw new Error('Usage: codespace-cleanup.mjs audit|clean --project KEY --task ID --repository owner/repo --source-root ABS --scope-root ABS [--state ABS] [--phase pre-closeout|post-closeout] [--confirm-clean ID]')
  const args = { command }
  const keys = { '--project': 'projectKey', '--task': 'taskId', '--repository': 'repository', '--source-root': 'sourceRoot', '--scope-root': 'scopeRoot', '--state': 'stateFile', '--phase': 'phase', '--confirm-clean': 'confirmClean' }
  for (let i = 1; i < argv.length; i++) {
    if (!keys[argv[i]] || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error(`Unsupported or missing argument: ${argv[i]}`)
    if (Object.hasOwn(args, keys[argv[i]])) throw new Error(`Repeated argument: ${argv[i]}`)
    args[keys[argv[i]]] = argv[++i]
  }
  if (!Object.hasOwn(args, 'phase')) args.phase = 'pre-closeout'
  return args
}
export function executeCleanup(options) {
  const args = { phase: 'pre-closeout', ...options }
  if (!['audit', 'clean'].includes(args.command)) deny('Command must be audit or clean')
  if (!VALID_PHASES.has(args.phase)) deny('Unknown cleanup phase')
  if (!['SG2', 'SRM', 'ARCHITECTURE', 'CIC'].includes(args.projectKey)) deny('Unknown project key')
  assertString(args.taskId, 'taskId')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{3,159}$/.test(args.taskId)) deny('Unsafe taskId format')
  assertString(args.repository, 'repository')
  if (!/^[\w.-]+\/[\w.-]+$/.test(args.repository)) deny('Repository must be owner/name')
  assertAbsolute(args.scopeRoot, 'scopeRoot')
  assertAbsolute(args.sourceRoot, 'sourceRoot')
  normalizedRealDirectory(args.scopeRoot, 'scopeRoot')
  if (args.scopeRoot === path.parse(args.scopeRoot).root || args.scopeRoot.split(path.sep).filter(Boolean).length < 2 ||
      args.scopeRoot.split(path.sep).filter(Boolean).some(isProtectedName)) deny('Unsafe or protected scope root')
  const source = validateSource(args)
  if (args.command === 'clean' && (!args.stateFile || args.confirmClean !== args.taskId)) deny('Clean requires a task inventory and --confirm-clean with exact task ID')
  let state
  if (args.stateFile) {
    assertAbsolute(args.stateFile, 'stateFile')
    state = readJson(args.stateFile)
    if (state.schemaVersion !== '1.0' || state.projectKey !== args.projectKey || state.taskId !== args.taskId ||
      state.repository !== args.repository || state.scopeRoot !== args.scopeRoot || !Array.isArray(state.resources) || state.resources.length > 2000) {
      deny('Task inventory does not match selected project, task, repository and scope')
    }
  } else {
    state = { schemaVersion: '1.0', projectKey: args.projectKey, taskId: args.taskId, repository: args.repository, scopeRoot: args.scopeRoot, resources: [] }
  }
  const entries = state.resources.map(r => checkResource(r, state, args, source))
  // Audit without task state reports direct children as unknown, never silently assumes ownership.
  if (!args.stateFile) {
    for (const n of fs.readdirSync(args.scopeRoot, { withFileTypes: true })) {
      if (!n.isDirectory() && !n.isSymbolicLink()) continue
      entries.push({ path: path.join(args.scopeRoot, n.name), kind: null, status: 'UNKNOWN_OWNER', reason: 'No task-scoped ownership inventory' })
    }
  }
  const report = {
    schemaVersion: '1.0', command: args.command, projectKey: args.projectKey, taskId: args.taskId,
    repository: args.repository, phase: args.phase, scopeRoot: args.scopeRoot,
    inspected: entries.length, summary: {}, observedFreeBytesDelta: null, results: entries.map(({expectedIdentity, markerFile, ...r}) => r),
    note: 'Free-space delta is an observation, not an attribution; logical/allocated sizes are measured before deletion.'
  }
  if (args.command === 'clean') {
    const lockPath = `${args.stateFile}.codespace-cleanup.lock`
    const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600)
    try {
      fs.writeSync(fd, `${process.pid} ${new Date().toISOString()} ${args.taskId}\n`)
      // Re-inspect after taking the cooperative cleanup lock; no pre-lock verdict authorizes deletion.
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].status !== 'OWNED_DISPOSABLE') continue
        const current = checkResource(state.resources[i], state, args, source)
        if (current.status !== 'OWNED_DISPOSABLE') {
          report.results[i] = { path: entries[i].path, kind: entries[i].kind, status: current.status, reason: `Recheck: ${current.reason}` }
          continue
        }
        try {
          verifyExistingIdentity(current, args.scopeRoot)
          const before = statfsAvailable(args.scopeRoot)
          if (current.kind === 'ephemeral-directory') {
            fs.rmSync(current.path, { recursive: true, force: false })
          } else {
            // The verified marker is the only tolerated untracked file. Remove it just before Git's safe worktree remove.
            const markerBytes = fs.readFileSync(current.markerFile)
            fs.unlinkSync(current.markerFile)
            try {
              git(args.sourceRoot, ['worktree', 'remove', '--', current.path])
            } catch (err) {
              if (fs.existsSync(current.path)) fs.writeFileSync(current.markerFile, markerBytes, { flag: 'wx', mode: 0o600 })
              throw err
            }
          }
          if (fs.existsSync(current.path)) deny('Resource still exists after cleanup')
          const delta = Math.max(0, statfsAvailable(args.scopeRoot) - before)
          report.results[i] = { path: current.path, kind: current.kind, status: 'CLEANED', reason: null,
            measurement: current.measurement, observedFreeBytesDelta: delta }
          report.observedFreeBytesDelta = (report.observedFreeBytesDelta ?? 0) + delta
        } catch (e) {
          report.results[i] = { path: current.path, kind: current.kind, status: 'REVIEW_REQUIRED', reason: `Cleanup interrupted: ${e.message}` }
        }
      }
    } finally {
      fs.closeSync(fd)
      fs.unlinkSync(lockPath)
    }
  }
  for (const item of report.results) {
    if (!RESOURCE_STATUSES.has(item.status)) deny('Invalid internal status')
    report.summary[item.status] = (report.summary[item.status] ?? 0) + 1
  }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = executeCleanup(parseArgs(process.argv.slice(2)))
    console.log(JSON.stringify(report, null, 2))
    if (report.command === 'clean' && (report.summary.REVIEW_REQUIRED || report.summary.UNKNOWN_OWNER)) process.exitCode = 2
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', error: error.message }))
    process.exitCode = 2
  }
}
