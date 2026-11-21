#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { compareProviderSnapshot, loadEnvironmentTopology, resolveEnvironmentProfile, validateEnvironmentTopology } from './environment-profile.mjs'
import { normalizeRepositorySlug, resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// The owner approved one creation of this frozen evidence file in the private repository.
// This route is consumed as soon as the path exists on the actual default branch.
const asIsEvidence = Object.freeze({
  repository: 'profitia/spendguru',
  repositoryId: 1296070778,
  path: 'docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md',
  sha256: '5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683',
  byteLength: 33312,
  taskId: 'ARCHITECTURE-DEV-RELEASE-OPT-ASIS-REF-01-20261121',
  branch: 'architecture/asis-ref-01-publication-20261121',
})

function parseArgs(argv) {
  const result = { mode: 'development', targets: [], legacyExceptions: [], json: false, ci: false, offline: false, allowDirty: false, requireBegin: false, skipRuntime: false, checkEstate: false }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--target') result.targets.push(argv[++index])
    else if (key === '--legacy-exception') result.legacyExceptions.push(argv[++index])
    else if (key === '--json') result.json = true
    else if (key === '--ci') { result.ci = true; result.offline = true; result.skipRuntime = true }
    else if (key === '--offline') result.offline = true
    else if (key === '--allow-dirty') result.allowDirty = true
    else if (key === '--require-begin') result.requireBegin = true
    else if (key === '--skip-pmos-runtime') result.skipRuntime = true
    else if (key === '--check-estate') result.checkEstate = true
    else if (key === '--host-conversation-unavailable') result.hostConversationUnavailable = true
    else if (key.startsWith('--')) result[key.slice(2).replaceAll('-', '_')] = argv[++index]
    else throw new Error(`Unexpected argument: ${key}`)
  }
  return result
}

function run(command, args, cwd = governanceRoot, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' })
  return { ok: result.status === 0, status: result.status, stdout: result.stdout?.trim() ?? '', stderr: result.stderr?.trim() ?? '' }
}

function gate(status, details) {
  return { status, details: Array.isArray(details) ? details : [details] }
}

function requiredInput(args, name) {
  return typeof args[name] === 'string' && args[name].trim().length > 0
}

function verifyAsIsEvidence({ args, profile, repositoryRoot, remote, topLevel, branch, head, originMain, status }) {
  const evidence = asIsEvidence
  if (profile?.projectKey !== 'ARCHITECTURE' || args.task_id !== evidence.taskId
    || !requiredInput(args, 'host_conversation_id') || args.mode !== 'development'
    || args.target_environment !== 'development' || args.execution_environment !== 'development'
    || args.scope !== 'documentation' || args.ci || args.offline || args.allowDirty || args.skipRuntime
    || args.targets.length !== 1 || args.targets[0] !== evidence.path || args.legacyExceptions.length !== 0) {
    throw new Error('The one-time AS-IS decision does not cover this invocation.')
  }
  if (!remote.ok || remote.stdout !== `https://github.com/${evidence.repository}.git`
    || !topLevel.ok || path.resolve(topLevel.stdout) !== repositoryRoot
    || !head.ok || !originMain.ok || !status.ok || status.stdout !== ''
    || !['main', evidence.branch].includes(branch.stdout)) {
    throw new Error('The AS-IS publication requires the clean, exact repository and publication branch.')
  }
  const repo = run('gh', ['api', `repos/${evidence.repository}`, '--jq',
    '[.id, .full_name, .private, .default_branch, .owner.login, .permissions.push] | @tsv'], repositoryRoot)
  if (!repo.ok || repo.stdout !== `${evidence.repositoryId}\t${evidence.repository}\ttrue\tmain\tprofitia\ttrue`) {
    throw new Error('GitHub did not confirm the private repository identity and push permission.')
  }
  const liveMain = run('gh', ['api', `repos/${evidence.repository}/branches/main`, '--jq', '.commit.sha'], repositoryRoot)
  if (!liveMain.ok || liveMain.stdout !== originMain.stdout) {
    throw new Error('The local origin/main does not match the current GitHub main commit.')
  }
  const existing = run('git', ['ls-tree', originMain.stdout, '--', evidence.path], repositoryRoot)
  if (!existing.ok || existing.stdout.length !== 0) {
    throw new Error('The AS-IS route permits one creation and requires an absent destination on main.')
  }
  const validBytes = (bytes) => bytes.length === evidence.byteLength
    && createHash('sha256').update(bytes).digest('hex') === evidence.sha256
  const file = fs.lstatSync(args.asis_evidence_file)
  if (!file.isFile() || file.size !== evidence.byteLength || !validBytes(fs.readFileSync(args.asis_evidence_file))) {
    throw new Error('The evidence file does not match the approved SHA-256.')
  }
  if (head.stdout !== originMain.stdout) {
    const changes = run('git', ['diff', '--name-status', '--no-renames', originMain.stdout, head.stdout, '--'], repositoryRoot)
    const entry = run('git', ['ls-tree', head.stdout, '--', evidence.path], repositoryRoot)
    const blob = spawnSync('git', ['cat-file', 'blob', `${head.stdout}:${evidence.path}`], { cwd: repositoryRoot })
    if (branch.stdout !== evidence.branch || !changes.ok || changes.stdout !== `A\t${evidence.path}`
      || !entry.ok || !entry.stdout.startsWith('100644 blob ') || blob.status !== 0 || !validBytes(blob.stdout)) {
      throw new Error('The candidate must add only the approved evidence as a regular file with identical bytes.')
    }
  }
}

export function runGovernancePreflight(args) {
  const repositoryRoot = args.repository_root ? path.resolve(args.repository_root) : governanceRoot
  const gates = {}
  const manifest = validateGovernanceManifest(governanceRoot)
  gates.GOVERNANCE_MANIFEST_GATE = manifest.valid ? gate('PASS', `${manifest.activeDocuments.length} active documents validated.`) : gate('BLOCKED', manifest.errors)

  let profile = null
  try {
    profile = resolveProjectProfile(args.project, governanceRoot)
    gates.PROJECT_PROFILE_GATE = gate('PASS', `${profile.projectKey} -> ${profile.repository.slug}`)
  } catch (error) {
    gates.PROJECT_PROFILE_GATE = gate('BLOCKED', error.message)
  }

  let environmentProfile = null
  if (profile?.repository?.environmentTopologyRegistry) {
    try {
      const { registry } = loadEnvironmentTopology(profile, governanceRoot)
      const topology = validateEnvironmentTopology(registry)
      gates.TOPOLOGY_REGISTRY_GATE = topology.valid ? gate('PASS', 'Registered environment identities are internally consistent.') : gate('BLOCKED', topology.errors)
      environmentProfile = resolveEnvironmentProfile({
        profile,
        targetEnvironment: args.target_environment,
        governanceRoot,
      })
      gates.TARGET_ENVIRONMENT_GATE = gate('PASS', [
        `${profile.projectKey}/${environmentProfile.targetEnvironment}`,
        `registry=${environmentProfile.registryPath}`,
        `githubEnvironmentId=${environmentProfile.environment.github.environmentId}`,
        `renderEnvironmentId=${environmentProfile.environment.render.environmentId}`,
        `neonBranchId=${environmentProfile.environment.neon.branchId}`,
      ])
      if (args.provider_snapshot) {
        try {
          const snapshot = JSON.parse(fs.readFileSync(path.resolve(args.provider_snapshot), 'utf8'))
          const drift = compareProviderSnapshot(registry, environmentProfile.targetEnvironment, snapshot)
          gates.LIVE_PROVIDER_DRIFT_GATE = drift.valid ? gate('PASS', `Read-only provider snapshot verified at ${snapshot.capturedAt}.`) : gate('BLOCKED', drift.errors)
        } catch (error) {
          gates.LIVE_PROVIDER_DRIFT_GATE = gate('BLOCKED', `Provider snapshot could not be read: ${error.message}`)
        }
      } else if (args.ci || environmentProfile.targetEnvironment === 'development') {
        gates.LIVE_PROVIDER_DRIFT_GATE = gate('NOT_APPLICABLE', args.ci ? 'CI validates static topology; live provider evidence is required before Staging or Production mutation.' : 'Live provider snapshot was not requested for Development source work.')
      } else {
        gates.LIVE_PROVIDER_DRIFT_GATE = gate('BLOCKED', 'A fresh read-only Render and Neon provider snapshot is required for Staging or Production work.')
      }
    } catch (error) {
      gates.TARGET_ENVIRONMENT_GATE = gate('BLOCKED', error.message)
      gates.LIVE_PROVIDER_DRIFT_GATE = gate('BLOCKED', 'Target environment could not be verified.')
    }
  } else {
    gates.TARGET_ENVIRONMENT_GATE = gate('NOT_APPLICABLE', `${profile?.projectKey ?? '<unknown>'} is not yet onboarded to an environment topology registry.`)
    gates.LIVE_PROVIDER_DRIFT_GATE = gate('NOT_APPLICABLE', 'Project has no environment topology registry.')
  }

  let pmosLifecycleApplicable = true
  try {
    const continuityEnvironment = profile?.continuity?.controlPlaneEnvironment ?? null
    if (continuityEnvironment !== null && !['development', 'staging', 'production'].includes(continuityEnvironment)) {
      throw new Error(`Invalid continuity.controlPlaneEnvironment for ${profile?.projectKey ?? '<unknown>'}: ${String(continuityEnvironment)}`)
    }
    pmosLifecycleApplicable = continuityEnvironment === null || environmentProfile?.targetEnvironment === continuityEnvironment
    if (!pmosLifecycleApplicable) {
      gates.PMOS_CONTROL_PLANE_GATE = gate('NOT_APPLICABLE', `PMOS continuity applies only to ${profile.projectKey}/${continuityEnvironment}; product target ${args.target_environment} creates no PMOS history or closeout.`)
    } else if (args.ci) {
      gates.PMOS_CONTROL_PLANE_GATE = gate('NOT_APPLICABLE', `CI validates the registered ${profile?.projectKey ?? '<unknown>'} control-plane policy without executing PMOS.`)
    } else if (continuityEnvironment === null) {
      gates.PMOS_CONTROL_PLANE_GATE = gate('NOT_APPLICABLE', `${profile?.projectKey ?? '<unknown>'} does not declare a continuity control-plane environment.`)
    } else if (!['development', 'staging', 'production'].includes(args.execution_environment) || args.execution_environment === continuityEnvironment) {
      gates.PMOS_CONTROL_PLANE_GATE = gate('PASS', [
        `controlPlaneEnvironment=${continuityEnvironment}`,
        `productTargetEnvironment=${args.target_environment}`,
      ])
    } else {
      gates.PMOS_CONTROL_PLANE_GATE = gate('BLOCKED', `PMOS execution environment ${args.execution_environment ?? '<missing>'} conflicts with ${profile.projectKey} continuity control plane ${continuityEnvironment}.`)
    }
  } catch (error) {
    gates.PMOS_CONTROL_PLANE_GATE = gate('BLOCKED', error.message)
  }

  const remote = run('git', ['remote', 'get-url', 'origin'], repositoryRoot)
  const topLevel = run('git', ['rev-parse', '--show-toplevel'], repositoryRoot)
  const repositoryMatches = Boolean(profile) && remote.ok
    && normalizeRepositorySlug(remote.stdout) === profile.repository.slug.toLowerCase()
    && topLevel.ok && path.resolve(topLevel.stdout) === repositoryRoot
  gates.REPOSITORY_GATE = repositoryMatches
    ? gate('PASS', [`origin=${remote.stdout}`, `root=${topLevel.stdout}`])
    : gate('BLOCKED', [`origin=${remote.stdout || '<missing>'}`, `root=${topLevel.stdout || '<missing>'}`])

  const authorityBranch = profile?.repository.defaultBranch ?? 'main'
  if (!args.offline) run('git', ['fetch', '--quiet', 'origin', authorityBranch], repositoryRoot)
  const branch = run('git', ['branch', '--show-current'], repositoryRoot)
  const head = run('git', ['rev-parse', 'HEAD'], repositoryRoot)
  const originMain = run('git', ['rev-parse', `origin/${authorityBranch}`], repositoryRoot)
  const ancestry = head.ok && originMain.ok ? run('git', ['merge-base', '--is-ancestor', originMain.stdout, head.stdout], repositoryRoot) : { ok: false }
  const status = run('git', ['status', '--porcelain'], repositoryRoot)
  const dirtyAccepted = status.ok && (status.stdout === '' || args.allowDirty)
  gates.CODE_STATE_GATE = head.ok && originMain.ok && ancestry.ok && dirtyAccepted
    ? gate(status.stdout === '' ? 'PASS' : 'WARNING', [`branch=${branch.stdout || '<detached>'}`, `HEAD=${head.stdout}`, `origin/${authorityBranch}=${originMain.stdout}`, `dirty=${status.stdout !== ''}`])
    : gate('BLOCKED', [`branch=${branch.stdout || '<detached>'}`, `HEAD=${head.stdout || '<missing>'}`, `origin/${authorityBranch}=${originMain.stdout || '<missing>'}`, `dirty=${status.stdout !== ''}`])

  const asIsPublication = Object.hasOwn(args, 'asis_evidence_file')
  if (asIsPublication) {
    try {
      verifyAsIsEvidence({ args, profile, repositoryRoot, remote, topLevel, branch, head, originMain, status })
      gates.REPOSITORY_GATE = gate('PASS', [`origin=${remote.stdout}`, `root=${topLevel.stdout}`, `private repository ID=${asIsEvidence.repositoryId}`])
      gates.ASIS_EVIDENCE_GATE = gate('PASS', `Confirmed creation-only scope and SHA-256 ${asIsEvidence.sha256}.`)
    } catch (error) {
      gates.ASIS_EVIDENCE_GATE = gate('BLOCKED', error.message)
    }
  }

  const requiredNames = ['task_id', 'title', 'project', 'workspace', 'execution_environment', 'scope']
  if (profile?.repository?.environmentTopologyRegistry) requiredNames.push('target_environment')
  const missing = requiredNames.filter((name) => !requiredInput(args, name))
  const identityModes = [requiredInput(args, 'host_conversation_id'), requiredInput(args, 'conversation_id'), args.hostConversationUnavailable === true].filter(Boolean).length
  if (identityModes !== 1) missing.push('provide exactly one of host_conversation_id, conversation_id (historical), or host_conversation_unavailable')
  if (args.mode === 'development' && args.targets.length === 0) missing.push('target')
  gates.TASK_INPUT_GATE = missing.length === 0 ? gate('PASS', `task=${args.task_id}`) : gate('BLOCKED', `Invalid or missing inputs: ${missing.join(', ')}`)

  const routing = asIsPublication && gates.ASIS_EVIDENCE_GATE.status === 'PASS'
    ? { ok: true, results: [{ normalizedPath: asIsEvidence.path, currentOwner: 'Governance Source Layer', baselineClassification: 'ALIGNED' }] }
    : profile
    ? resolveProjectRouting({ profile, targets: args.targets, repositoryRoot })
    : { ok: false, results: [], error: 'Project profile is unavailable.' }
  const legacyWithoutException = routing.results.filter((entry) => entry.baselineClassification === 'LEGACY' && !args.legacyExceptions.includes(entry.normalizedPath))
  gates.ROUTING_GATE = routing.ok && legacyWithoutException.length === 0
    ? gate('PASS', routing.results.map((entry) => `${entry.normalizedPath} -> ${entry.currentOwner} / ${entry.baselineClassification}`))
    : gate('BLOCKED', [routing.error ?? '', ...legacyWithoutException.map((entry) => `Legacy target requires explicit exception: ${entry.normalizedPath}`)].filter(Boolean))

  if (!pmosLifecycleApplicable) {
    gates.PMOS_RUNTIME_GATE = gate('NOT_APPLICABLE', `PMOS continuity does not apply to target environment ${args.target_environment}.`)
  } else if (args.skipRuntime) {
    gates.PMOS_RUNTIME_GATE = gate('NOT_APPLICABLE', args.ci ? 'Live PMOS runtime verification is not available in CI.' : 'Explicitly skipped for this invocation.')
  } else {
    const runtime = run('npm', ['run', 'pmos:verify-runtime'], path.join(governanceRoot, 'apps', 'pmos'))
    gates.PMOS_RUNTIME_GATE = runtime.ok ? gate('PASS', 'Current PMOS runtime verification passed.') : gate('BLOCKED', runtime.stderr || runtime.stdout)
  }

  if (!pmosLifecycleApplicable) {
    gates.PMOS_BEGIN_GATE = gate('NOT_APPLICABLE', `PMOS registration is forbidden for target environment ${args.target_environment}.`)
  } else if (args.requireBegin) {
    const checkArgs = ['run', 'pmos:begin', '--', '--check-task-id', args.task_id]
    if (requiredInput(args, 'host_conversation_id')) checkArgs.push('--check-host-conversation-id', args.host_conversation_id)
    else if (args.hostConversationUnavailable === true) checkArgs.push('--check-host-conversation-unavailable')
    else if (requiredInput(args, 'conversation_id')) checkArgs.push('--check-conversation-id', args.conversation_id)
    checkArgs.push('--check-project', args.project)
    if (args.target_environment) checkArgs.push('--check-target-environment', args.target_environment)
    const begin = run('npm', checkArgs, path.join(governanceRoot, 'apps', 'pmos'))
    gates.PMOS_BEGIN_GATE = begin.ok ? gate('PASS', `Registered task ${args.task_id}.`) : gate('BLOCKED', begin.stderr || begin.stdout)
  } else {
    gates.PMOS_BEGIN_GATE = gate('PASS', 'READY_TO_REGISTER — run pmos:begin before implementation, then rerun with --require-begin.')
  }

  if (args.checkEstate) {
    const estate = run('npm', ['run', 'pmos:audit-estate'], path.join(governanceRoot, 'apps', 'pmos'))
    gates.PMOS_ESTATE_GATE = estate.ok ? gate('PASS', 'Historical estate verification passed.') : gate('WARNING', estate.stderr || estate.stdout)
  } else {
    gates.PMOS_ESTATE_GATE = gate('NOT_APPLICABLE', 'Historical estate audit was not requested; it is independent of runtime readiness.')
  }

  const blockingGates = Object.entries(gates).filter(([, value]) => value.status === 'BLOCKED').map(([name]) => name)
  return {
    schemaVersion: '3.0',
    mode: args.mode,
    projectKey: profile?.projectKey ?? null,
    targetEnvironment: environmentProfile?.targetEnvironment ?? null,
    governanceRoot,
    repositoryRoot,
    gates,
    verdict: blockingGates.length === 0 ? 'PASS' : 'BLOCKED',
    blockingGates,
  }
}

const isDirectExecution = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href
if (isDirectExecution) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = runGovernancePreflight(args)
    console.log(JSON.stringify(result, null, 2))
    if (result.verdict !== 'PASS') process.exitCode = 1
  } catch (error) {
    console.error(JSON.stringify({ schemaVersion: '3.0', verdict: 'BLOCKED', error: error.message }, null, 2))
    process.exitCode = 1
  }
}
