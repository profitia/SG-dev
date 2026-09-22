#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { resolveEnvironmentProfile } from './environment-profile.mjs'
import { normalizeRepositorySlug, resolveProjectProfile } from './project-profile.mjs'
import { resolveProjectRouting } from './routing-engine.mjs'

const governanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

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
    } catch (error) {
      gates.TARGET_ENVIRONMENT_GATE = gate('BLOCKED', error.message)
    }
  } else {
    gates.TARGET_ENVIRONMENT_GATE = gate('NOT_APPLICABLE', `${profile?.projectKey ?? '<unknown>'} is not yet onboarded to an environment topology registry.`)
  }

  let pmosLifecycleApplicable = true
  try {
    const continuityEnvironment = profile?.continuity?.controlPlaneEnvironment ?? null
    if (continuityEnvironment !== null && !['development', 'staging', 'production'].includes(continuityEnvironment)) {
      throw new Error(`Invalid continuity.controlPlaneEnvironment for ${profile?.projectKey ?? '<unknown>'}: ${String(continuityEnvironment)}`)
    }
    pmosLifecycleApplicable = continuityEnvironment === null || args.target_environment === continuityEnvironment
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

  const requiredNames = ['task_id', 'conversation_id', 'title', 'project', 'workspace', 'execution_environment', 'scope']
  if (profile?.repository?.environmentTopologyRegistry) requiredNames.push('target_environment')
  const missing = requiredNames.filter((name) => !requiredInput(args, name))
  if (args.mode === 'development' && args.targets.length === 0) missing.push('target')
  gates.TASK_INPUT_GATE = missing.length === 0 ? gate('PASS', `task=${args.task_id}`) : gate('BLOCKED', `Missing inputs: ${missing.join(', ')}`)

  const routing = profile
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
    const begin = run('npm', ['run', 'pmos:begin', '--', '--check-task-id', args.task_id], path.join(governanceRoot, 'apps', 'pmos'))
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
