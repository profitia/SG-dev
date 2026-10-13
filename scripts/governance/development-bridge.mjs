#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectProfile } from './project-profile.mjs'
import { loadWorkspaceRegistry, checkWorkspace, readWorkspaceEnvironment } from './development-workspace.mjs'
import { validateGovernanceManifest } from './validate-governance-manifest.mjs'
import { runGovernancePreflight } from './governance-preflight.mjs'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function resolveDevelopmentBridge(projectKey, root = sourceRoot) {
  const profile = resolveProjectProfile(projectKey, root)
  const workspace = loadWorkspaceRegistry(root).workspaces.find((entry) => entry.projectKey === profile.projectKey)
  if (!workspace) throw new Error('Project has no registered SG-dev Development track; preserve its own repository')
  const manifest = validateGovernanceManifest(root)
  if (!manifest.valid) throw new Error(manifest.errors.join('\n'))
  return {
    projectKey: profile.projectKey, projectName: profile.displayName,
    workspace: workspace.workspaceName, repository: profile.repository.slug,
    targetEnvironment: 'development', ports: workspace.ports,
    canonLoadOrder: manifest.activeDocuments.filter((document) => document.appliesTo.includes('CORE') || document.appliesTo.includes(profile.projectKey)).map((document) => document.path),
    entrypoint: 'AGENTS.md', continuity: profile.continuity,
    lifecycleImplementation: 'apps/pmos', selectionGrantsMutationAuthority: false,
  }
}

export function buildBridgePreflight(plan, options, root) {
  if (!options.taskId || !options.title || !options.scope || !options.targets?.length) throw new Error('Actual task ID, title, canonical scope and exact targets required')
  if ((!options.hostConversationId) === (!options.hostConversationUnavailable)) throw new Error('Supply the actual host conversation ID or explicitly mark it unavailable')
  const env = readWorkspaceEnvironment(path.join(root, 'apps/pmos/.env.local'))
  if (!env.PMOS_EXECUTION_ENVIRONMENT) throw new Error('Configured PMOS execution environment required')
  return {
    mode: 'development', project: plan.projectKey, target_environment: 'development',
    task_id: options.taskId, title: options.title, scope: options.scope,
    workspace: plan.workspace, execution_environment: env.PMOS_EXECUTION_ENVIRONMENT,
    hostConversationId: options.hostConversationId,
    hostConversationUnavailable: Boolean(options.hostConversationUnavailable),
    targets: options.targets, legacyExceptions: [], repository_root: root,
    ci: false, offline: false, allowDirty: false, requireBegin: Boolean(options.requireBegin), skipRuntime: false, checkEstate: false,
  }
}

function argumentsFrom(argv) {
  const options = { command: argv[0], targets: [] }
  const names = { '--project': 'project', '--root': 'root', '--task-id': 'taskId', '--title': 'title', '--scope': 'scope', '--host-conversation-id': 'hostConversationId' }
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--target') options.targets.push(argv[++index])
    else if (flag === '--host-conversation-unavailable') options.hostConversationUnavailable = true
    else if (flag === '--require-begin') options.requireBegin = true
    else if (names[flag]) options[names[flag]] = argv[++index]
    else throw new Error('Unknown bridge option; bypass flags are not supported')
  }
  if (!options.project || !['select', 'preflight'].includes(options.command)) throw new Error('Use select or preflight with an explicit project')
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = argumentsFrom(process.argv.slice(2))
    const root = path.resolve(options.root ?? sourceRoot)
    const plan = resolveDevelopmentBridge(options.project, root)
    const binding = checkWorkspace(root, plan.projectKey, true)
    if (options.command === 'select') console.log(JSON.stringify({ ...plan, binding, nextAction: 'Read Canon and nested AGENTS; run full preflight, canonical pmos:begin, then require-begin. Selection is not an execution gate.' }, null, 2))
    else {
      const preflight = runGovernancePreflight(buildBridgePreflight(plan, options, root))
      const output = { bridge: plan, preflight }
      if (preflight.verdict === 'PASS' && !options.requireBegin) output.beginInput = {
        schemaVersion: '2.0', taskId: options.taskId, title: options.title,
        hostConversationId: options.hostConversationId ?? null,
        project: plan.projectName, workspace: plan.workspace,
        executionEnvironment: readWorkspaceEnvironment(path.join(root, 'apps/pmos/.env.local')).PMOS_EXECUTION_ENVIRONMENT,
        targetEnvironment: 'development', scope: options.scope,
        originalTaskRequest: 'Replace with the complete actual authorized task request before canonical pmos:begin.',
        declaredTargetPaths: options.targets,
        gates: Object.fromEntries(Object.entries(preflight.gates).map(([key, value]) => [key, value.status])),
      }
      console.log(JSON.stringify(output, null, 2))
      if (preflight.verdict !== 'PASS') process.exitCode = 1
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
