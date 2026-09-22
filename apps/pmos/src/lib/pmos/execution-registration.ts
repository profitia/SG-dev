import path from 'node:path'

import { requirePmosProjectProfile } from './project-profile'

export const EXECUTION_REGISTRATION_SCHEMA_VERSION = '1.0' as const

export type ExecutionGateStatus = 'PASS' | 'WARNING' | 'BLOCKED' | 'NOT_APPLICABLE'

export type ExecutionRegistrationInput = {
  schemaVersion: typeof EXECUTION_REGISTRATION_SCHEMA_VERSION
  taskId: string
  conversationId: string
  title: string
  project: string
  workspace: string
  executionEnvironment: string
  targetEnvironment?: string
  scope: string
  originalTaskRequest: string
  declaredTargetPaths: string[]
  gates: Record<string, ExecutionGateStatus>
  etap?: string
  subetap?: string
  promptType?: string
}

export type ExistingExecutionRegistration = {
  id: string
  taskId: string | null
  conversationId: string | null
  title: string
  project: string | null
  workspace: string | null
  executionEnvironment: string | null
  scope: string | null
  promptContent: string
  declaredTargetPaths: string[]
  gateSnapshot: unknown
  status: string
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/
const GATE_STATUS = new Set<ExecutionGateStatus>(['PASS', 'WARNING', 'BLOCKED', 'NOT_APPLICABLE'])

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value.trim()
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return requiredString(value, label)
}

function normalizeTargetPath(value: unknown): string {
  const target = requiredString(value, 'declaredTargetPaths entry').replaceAll('\\', '/')
  if (path.isAbsolute(target) || target === '..' || target.startsWith('../') || target.includes('/../')) {
    throw new Error(`declaredTargetPaths must contain repository-relative paths: ${target}`)
  }
  return target.replace(/^\.\//, '')
}

export function validateExecutionRegistrationInput(raw: unknown): ExecutionRegistrationInput {
  assertObject(raw, 'pmos:begin input')
  if (raw.schemaVersion !== EXECUTION_REGISTRATION_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must equal ${EXECUTION_REGISTRATION_SCHEMA_VERSION}.`)
  }

  const taskId = requiredString(raw.taskId, 'taskId')
  const conversationId = requiredString(raw.conversationId, 'conversationId')
  if (!IDENTIFIER.test(taskId)) throw new Error('taskId contains unsupported characters.')
  if (!IDENTIFIER.test(conversationId)) throw new Error('conversationId contains unsupported characters.')

  if (!Array.isArray(raw.declaredTargetPaths)) {
    throw new Error('declaredTargetPaths must be an array.')
  }
  const declaredTargetPaths = [...new Set(raw.declaredTargetPaths.map(normalizeTargetPath))].sort()

  assertObject(raw.gates, 'gates')
  const gates = Object.fromEntries(Object.entries(raw.gates).map(([name, status]) => {
    if (!GATE_STATUS.has(status as ExecutionGateStatus)) {
      throw new Error(`gates.${name} has invalid status ${String(status)}.`)
    }
    return [name, status as ExecutionGateStatus]
  }))
  for (const requiredGate of ['ROUTING_GATE', 'CODE_STATE_GATE', 'TASK_INPUT_GATE', 'PMOS_RUNTIME_GATE']) {
    if (!(requiredGate in gates)) throw new Error(`gates.${requiredGate} is required.`)
  }
  if (Object.values(gates).includes('BLOCKED')) {
    throw new Error('pmos:begin refuses registration while a declared gate is BLOCKED.')
  }
  const project = requiredString(raw.project, 'project')
  const profile = requirePmosProjectProfile(project)
  const targetEnvironment = raw.targetEnvironment === undefined ? undefined : requiredString(raw.targetEnvironment, 'targetEnvironment').toLowerCase()
  if (profile.continuity.controlPlaneEnvironment) {
    if (targetEnvironment !== profile.continuity.controlPlaneEnvironment) {
      throw new Error(`pmos:begin is allowed for ${profile.projectKey} only when targetEnvironment=${profile.continuity.controlPlaneEnvironment}; received ${targetEnvironment ?? '<missing>'}.`)
    }
    if (gates.TARGET_ENVIRONMENT_GATE !== 'PASS' || gates.PMOS_CONTROL_PLANE_GATE !== 'PASS') {
      throw new Error('pmos:begin requires passing TARGET_ENVIRONMENT_GATE and PMOS_CONTROL_PLANE_GATE.')
    }
  }

  return {
    schemaVersion: EXECUTION_REGISTRATION_SCHEMA_VERSION,
    taskId,
    conversationId,
    title: requiredString(raw.title, 'title'),
    project,
    workspace: requiredString(raw.workspace, 'workspace'),
    executionEnvironment: requiredString(raw.executionEnvironment, 'executionEnvironment'),
    targetEnvironment,
    scope: requiredString(raw.scope, 'scope'),
    originalTaskRequest: requiredString(raw.originalTaskRequest, 'originalTaskRequest'),
    declaredTargetPaths,
    gates,
    etap: optionalString(raw.etap, 'etap'),
    subetap: optionalString(raw.subetap, 'subetap'),
    promptType: optionalString(raw.promptType, 'promptType'),
  }
}

export function registrationGateSnapshot(input: ExecutionRegistrationInput): Record<string, string> {
  return input.targetEnvironment
    ? { ...input.gates, __targetEnvironment: input.targetEnvironment }
    : { ...input.gates }
}

export function expectedDatabaseName(project: string): string {
  return requirePmosProjectProfile(project).database.databaseName
}

function endpointIdentity(host: string): string {
  return host.split('.')[0].replace(/-pooler$/i, '').replace(/-[a-z0-9]{3}$/i, '')
}

export function assertDatabaseIdentity(actualDatabaseName: string, project: string, databaseUrl?: string): void {
  const profile = requirePmosProjectProfile(project)
  const expected = profile.database.databaseName
  if (actualDatabaseName !== expected) {
    throw new Error(`PMOS database identity mismatch: project ${project} requires ${expected}, connected to ${actualDatabaseName}.`)
  }

  if (!databaseUrl) {
    throw new Error(`PMOS database endpoint identity cannot be verified for project ${profile.projectKey}: DATABASE_URL is missing.`)
  }

  let actualHost: string
  try {
    actualHost = new URL(databaseUrl).hostname
  } catch {
    throw new Error(`PMOS database endpoint identity cannot be verified for project ${profile.projectKey}: DATABASE_URL is invalid.`)
  }

  const actualEndpoint = endpointIdentity(actualHost)
  const allowed = profile.database.allowedHosts.some((host) => endpointIdentity(host) === actualEndpoint)
  if (!allowed) {
    throw new Error(`PMOS database endpoint identity mismatch: project ${profile.projectKey} is not allowed to use host ${actualHost}.`)
  }
}

export function assertRegistrationMatches(existing: ExistingExecutionRegistration, input: ExecutionRegistrationInput): void {
  const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
        .join(',')}}`
    }
    return JSON.stringify(value)
  }
  const mismatches: string[] = []
  const legacyGateSnapshot = existing.gateSnapshot && typeof existing.gateSnapshot === 'object'
    && !Array.isArray(existing.gateSnapshot)
    && !('__targetEnvironment' in existing.gateSnapshot)
  const expectedSnapshot = legacyGateSnapshot ? input.gates : registrationGateSnapshot(input)
  const checks: Array<[string, unknown, unknown]> = [
    ['taskId', existing.taskId, input.taskId],
    ['conversationId', existing.conversationId, input.conversationId],
    ['title', existing.title, input.title],
    ['project', existing.project, input.project],
    ['workspace', existing.workspace, input.workspace],
    ['executionEnvironment', existing.executionEnvironment, input.executionEnvironment],
    ['scope', existing.scope, input.scope],
    ['originalTaskRequest', existing.promptContent, input.originalTaskRequest],
    ['declaredTargetPaths', JSON.stringify([...existing.declaredTargetPaths].sort()), JSON.stringify(input.declaredTargetPaths)],
    ['gates', canonicalJson(existing.gateSnapshot), canonicalJson(expectedSnapshot)],
  ]
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) mismatches.push(field)
  }
  if (mismatches.length > 0) {
    throw new Error(`Existing PMOS task registration belongs to different input: ${mismatches.join(', ')}.`)
  }
}
