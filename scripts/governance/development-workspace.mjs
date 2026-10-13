#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { normalizeRepositorySlug, resolveProjectProfile } from './project-profile.mjs'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const registryPath = 'Canon/registries/development-workspaces-v1.json'

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr?.trim() || 'see command output'}`)
  return result.stdout?.trim() ?? ''
}

export function loadWorkspaceRegistry(root = sourceRoot) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, registryPath), 'utf8'))
  if (registry.schemaVersion !== '1.0' || registry.repository !== 'profitia/SG-dev' || registry.targetEnvironment !== 'development') throw new Error('Invalid Development workspace registry')
  const keys = new Set(), names = new Set(), ports = new Set()
  for (const workspace of registry.workspaces) {
    if (!['SG2', 'SRM', 'ARCHITECTURE'].includes(workspace.projectKey) || keys.has(workspace.projectKey)) throw new Error('Unknown or duplicate workspace project')
    keys.add(workspace.projectKey)
    if (!/^[a-z][a-z0-9-]*$/.test(workspace.directoryName) || names.has(workspace.directoryName)) throw new Error('Invalid or duplicate workspace directory')
    names.add(workspace.directoryName)
    for (const port of Object.values(workspace.ports)) {
      if (!Number.isInteger(port) || port < 1024 || port > 65535 || ports.has(port)) throw new Error('Invalid or colliding Development port')
      ports.add(port)
    }
  }
  if (keys.size !== 3) throw new Error('Three Development workspaces required')
  return registry
}

export function readWorkspaceEnvironment(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
    if (!match) return []
    let value = match[2].trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value) } catch { throw new Error('Invalid quoted workspace configuration value') }
    }
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    return [[match[1], value]]
  }))
}

export function validateWorkspaceBinding(workspace, binding) {
  if (binding.DEVELOPMENT_WORKSPACE_PROJECT_KEY !== workspace.projectKey) throw new Error('Workspace project identity mismatch')
  if (binding.TARGET_ENVIRONMENT !== 'development') throw new Error('Workspace must target Development')
  if (!binding.PHR_REPOSITORY_PATH || !path.isAbsolute(binding.PHR_REPOSITORY_PATH)) throw new Error('Absolute dedicated PHR path required')
}

export function validatePmosConfiguration(profile, workspace, env) {
  if (env.PMOS_PROJECT_NAME !== profile.displayName || env.PMOS_WORKSPACE_NAME !== workspace.workspaceName) throw new Error('PMOS project/workspace configuration mismatch')
  if (env.TARGET_ENVIRONMENT !== 'development') throw new Error('PMOS target environment mismatch')
  if (env.PMOS_MEMOROS_MODE && env.PMOS_MEMOROS_MODE !== profile.continuity.memoros) throw new Error('PMOS Memoros policy mismatch')
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    let connection
    try { connection = new URL(env[key]) } catch { throw new Error(`${key} is missing or invalid`) }
    if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !profile.database.allowedHosts.includes(connection.hostname) || decodeURIComponent(connection.pathname.slice(1)) !== profile.database.databaseName) throw new Error(`${key} does not match the registered PMOS database identity`)
    if (profile.database.runtimeRole && decodeURIComponent(connection.username) !== profile.database.runtimeRole) throw new Error(`${key} must use the registered runtime role`)
  }
}

function selectWorkspace(key, root = sourceRoot) {
  const registry = loadWorkspaceRegistry(root)
  const workspace = registry.workspaces.find((entry) => entry.projectKey === key)
  if (!workspace) throw new Error('Explicit registered project required')
  return { registry, workspace }
}

function assertRepository(root, slug) {
  if (normalizeRepositorySlug(run('git', ['remote', 'get-url', 'origin'], root)) !== slug.toLowerCase()) throw new Error('Repository identity mismatch')
  if (fs.realpathSync(run('git', ['rev-parse', '--show-toplevel'], root)) !== fs.realpathSync(root)) throw new Error('Expected a distinct checkout root')
}

function ensurePhr(cloneRoot, registry) {
  if (!fs.existsSync(cloneRoot)) run('git', ['clone', '--branch', 'main', '--single-branch', `https://github.com/${registry.phrRepository}.git`, cloneRoot], sourceRoot)
  assertRepository(cloneRoot, registry.phrRepository)
  if (run('git', ['branch', '--show-current'], cloneRoot) !== 'main' || run('git', ['status', '--porcelain'], cloneRoot)) throw new Error('Dedicated PHR must be on clean main; preserve existing work')
  run('git', ['fetch', 'origin', 'main'], cloneRoot)
  run('git', ['merge', '--ff-only', 'origin/main'], cloneRoot)
}

function writeBinding(root, workspace, cloneRoot) {
  const envPath = path.join(root, '.env.local')
  const existing = readWorkspaceEnvironment(envPath)
  if (existing.DEVELOPMENT_WORKSPACE_PROJECT_KEY) {
    validateWorkspaceBinding(workspace, existing)
    if (fs.realpathSync(existing.PHR_REPOSITORY_PATH) !== fs.realpathSync(cloneRoot)) throw new Error('Existing PHR binding differs; preserve configuration')
    return
  }
  if (existing.TARGET_ENVIRONMENT && existing.TARGET_ENVIRONMENT !== 'development') throw new Error('Existing configuration targets a different environment')
  if (run('git', ['check-ignore', '.env.local'], root) !== '.env.local') throw new Error('Workspace configuration must be ignored by Git')
  const marker = `\nDEVELOPMENT_WORKSPACE_PROJECT_KEY=${workspace.projectKey}\nTARGET_ENVIRONMENT=development\nPHR_REPOSITORY_PATH=${JSON.stringify(cloneRoot)}\n`
  fs.appendFileSync(envPath, marker, { mode: 0o600 })
  fs.chmodSync(envPath, 0o600)
}

export function prepareWorkspace({ projectKey, parent, bindCurrent = false }) {
  const { registry, workspace } = selectWorkspace(projectKey)
  if (!path.isAbsolute(parent)) throw new Error('Absolute workspace parent required')
  fs.mkdirSync(parent, { recursive: true })
  if (fs.realpathSync(parent) !== path.resolve(parent)) throw new Error('Symlinked workspace parent is not allowed')
  assertRepository(sourceRoot, registry.repository)
  run('git', ['fetch', 'origin', registry.authorityBranch], sourceRoot)
  const root = bindCurrent ? sourceRoot : path.join(parent, workspace.directoryName)
  if (!fs.existsSync(root)) run('git', ['worktree', 'add', '--detach', root, `origin/${registry.authorityBranch}`], sourceRoot)
  assertRepository(root, registry.repository)
  if (run('git', ['status', '--porcelain'], root)) throw new Error('Workspace has existing changes; preserve them')
  run('git', ['merge-base', '--is-ancestor', `origin/${registry.authorityBranch}`, 'HEAD'], root)
  const phrRoot = path.join(parent, `${workspace.directoryName}-phr`)
  ensurePhr(phrRoot, registry)
  writeBinding(root, workspace, phrRoot)
  return { projectKey, root, phrRoot, sourceSha: run('git', ['rev-parse', 'HEAD'], root), ports: workspace.ports, profileActivationPerformed: false }
}

export function checkWorkspace(root, projectKey, requireConfiguration = false) {
  const { registry, workspace } = selectWorkspace(projectKey, root)
  assertRepository(root, registry.repository)
  const binding = readWorkspaceEnvironment(path.join(root, '.env.local'))
  validateWorkspaceBinding(workspace, binding)
  assertRepository(binding.PHR_REPOSITORY_PATH, registry.phrRepository)
  if (fs.realpathSync(binding.PHR_REPOSITORY_PATH).startsWith(fs.realpathSync(root) + path.sep)) throw new Error('PHR clone must be outside the source checkout')
  let profileActive = false
  try { resolveProjectProfile(projectKey, root); profileActive = true } catch (error) {
    if (requireConfiguration || projectKey !== 'ARCHITECTURE' || !/Unknown project/.test(error.message)) throw error
  }
  if (requireConfiguration) {
    const profile = resolveProjectProfile(projectKey, root)
    const env = readWorkspaceEnvironment(path.join(root, 'apps/pmos/.env.local'))
    validatePmosConfiguration(profile, workspace, env)
    if (fs.realpathSync(env.PHR_REPOSITORY_PATH) !== fs.realpathSync(binding.PHR_REPOSITORY_PATH)) throw new Error('PMOS uses a different PHR clone')
  }
  return { projectKey, root, phrRoot: binding.PHR_REPOSITORY_PATH, profileActive, configurationVerified: requireConfiguration, ports: workspace.ports }
}

function installPackages(root, projectKey, product) {
  const { workspace } = selectWorkspace(projectKey, root)
  checkWorkspace(root, projectKey)
  const packages = product ? workspace.packages : ['apps/pmos']
  for (const packagePath of packages) {
    run('npm', ['ci', ...(packagePath === 'apps/srm' ? ['--install-links'] : [])], path.join(root, packagePath), { stdio: 'inherit' })
    if (packagePath === 'apps/pmos') run('npm', ['run', 'db:generate'], path.join(root, packagePath), { stdio: 'inherit' })
  }
  return { projectKey, packagesInstalled: packages }
}

function parseArguments(argv) {
  const options = { command: argv[0] }
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index]
    if (['--require-config', '--product'].includes(flag)) options[flag.slice(2)] = true
    else if (['--project', '--parent', '--root'].includes(flag)) options[flag.slice(2)] = argv[++index]
    else throw new Error('Unknown workspace argument')
  }
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2))
    let result
    if (options.command === 'list') result = loadWorkspaceRegistry()
    else if (['prepare', 'bind'].includes(options.command)) result = prepareWorkspace({ projectKey: options.project, parent: options.parent, bindCurrent: options.command === 'bind' })
    else if (options.command === 'check') result = checkWorkspace(path.resolve(options.root ?? sourceRoot), options.project, options['require-config'])
    else if (options.command === 'install') result = installPackages(path.resolve(options.root ?? sourceRoot), options.project, options.product)
    else throw new Error('Use list, prepare, bind, check or install')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
