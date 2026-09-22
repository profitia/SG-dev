import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { assertDatabaseUrl } from '../src/lib/pmos/operator-preflight'
import {
  assertDatabaseIdentity,
  assertRegistrationMatches,
  assertControlPlaneContinuity,
  registrationGateSnapshot,
  validateExecutionRegistrationInput,
  type ExistingExecutionRegistration,
} from '../src/lib/pmos/execution-registration'
import {
  assertPmosControlPlaneEnvironment,
  getConfiguredPmosProjectName,
  getConfiguredPmosWorkspaceName,
  normalizePmosProjectName,
  normalizePmosWorkspaceName,
  requirePmosProjectProfile,
} from '../src/lib/pmos/project-profile'

const prisma = new PrismaClient()
const registrationSelect = {
  id: true,
  taskId: true,
  conversationId: true,
  title: true,
  project: true,
  workspace: true,
  executionEnvironment: true,
  scope: true,
  promptContent: true,
  declaredTargetPaths: true,
  gateSnapshot: true,
  status: true,
} as const

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

async function currentDatabaseName(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`
  return rows[0]?.current_database ?? ''
}

async function checkRegistration(taskId: string, conversationId: string | null, project: string | null, targetEnvironment: string | null): Promise<void> {
  const record = await prisma.promptExecution.findUnique({ where: { taskId }, select: registrationSelect })
  if (!record) throw new Error(`No PMOS execution registration exists for task ${taskId}.`)
  if (!['queued', 'running', 'completed'].includes(record.status)) {
    throw new Error(`PMOS execution registration ${taskId} has unusable status ${record.status}.`)
  }
  if (conversationId && record.conversationId !== conversationId) {
    throw new Error(`PMOS execution registration ${taskId} belongs to another conversation.`)
  }
  if (project && normalizePmosProjectName(record.project ?? '') !== normalizePmosProjectName(project)) {
    throw new Error(`PMOS execution registration ${taskId} belongs to another project.`)
  }
  const registeredProfile = requirePmosProjectProfile(record.project ?? '')
  if (targetEnvironment && registeredProfile.continuity.controlPlaneEnvironment
    && targetEnvironment !== registeredProfile.continuity.controlPlaneEnvironment) {
    throw new Error(`PMOS execution registration ${taskId} cannot serve target environment ${targetEnvironment}.`)
  }
  assertDatabaseIdentity(await currentDatabaseName(), record.project ?? '', process.env.DATABASE_URL)
  assertControlPlaneContinuity(record.project ?? '', record.gateSnapshot)
  process.stdout.write(`${JSON.stringify({ status: 'PASS', taskId, registrationId: record.id, executionStatus: record.status }, null, 2)}\n`)
}

async function begin(inputPath: string): Promise<void> {
  const resolved = path.resolve(inputPath)
  const input = validateExecutionRegistrationInput(JSON.parse(fs.readFileSync(resolved, 'utf8')))
  assertControlPlaneContinuity(input.project, registrationGateSnapshot(input))
  const configuredProject = getConfiguredPmosProjectName()
  const configuredWorkspace = getConfiguredPmosWorkspaceName()
  if (normalizePmosProjectName(input.project) !== configuredProject) {
    throw new Error(`PMOS project profile mismatch: input=${input.project}, configured=${configuredProject}.`)
  }
  if (!configuredWorkspace || normalizePmosWorkspaceName(input.workspace) !== configuredWorkspace) {
    throw new Error(`PMOS workspace profile mismatch: input=${input.workspace}, configured=${configuredWorkspace ?? '<unset>'}.`)
  }
  assertPmosControlPlaneEnvironment(requirePmosProjectProfile(input.project), input.executionEnvironment)
  const configuredEnvironment = process.env.PMOS_EXECUTION_ENVIRONMENT?.trim()
  if (!configuredEnvironment || input.executionEnvironment !== configuredEnvironment) {
    throw new Error(`PMOS execution environment mismatch: input=${input.executionEnvironment}, configured=${configuredEnvironment ?? '<unset>'}.`)
  }

  const databaseName = await currentDatabaseName()
  assertDatabaseIdentity(databaseName, input.project, process.env.DATABASE_URL)

  const [byTask, byConversation] = await Promise.all([
    prisma.promptExecution.findUnique({ where: { taskId: input.taskId }, select: registrationSelect }),
    prisma.promptExecution.findUnique({ where: { conversationId: input.conversationId }, select: registrationSelect }),
  ])
  if (byTask || byConversation) {
    if (!byTask || !byConversation || byTask.id !== byConversation.id) {
      throw new Error('Task or conversation identity is already owned by another PMOS registration.')
    }
    assertRegistrationMatches(byTask as ExistingExecutionRegistration, input)
    process.stdout.write(`${JSON.stringify({ status: byTask.status === 'completed' ? 'ALREADY_COMPLETED' : 'RESUMED', taskId: input.taskId, conversationId: input.conversationId, registrationId: byTask.id, databaseName }, null, 2)}\n`)
    return
  }

  const created = await prisma.promptExecution.create({
    data: {
      taskId: input.taskId,
      conversationId: input.conversationId,
      title: input.title,
      project: input.project,
      workspace: input.workspace,
      executionEnvironment: input.executionEnvironment,
      scope: input.scope,
      declaredTargetPaths: input.declaredTargetPaths,
      gateSnapshot: registrationGateSnapshot(input),
      startedAt: new Date(),
      etap: input.etap,
      subetap: input.subetap,
      promptType: input.promptType ?? 'managed-development-task',
      promptContent: input.originalTaskRequest,
      status: 'running',
    },
    select: registrationSelect,
  })
  process.stdout.write(`${JSON.stringify({ status: 'REGISTERED', taskId: input.taskId, conversationId: input.conversationId, registrationId: created.id, databaseName }, null, 2)}\n`)
}

async function main(): Promise<void> {
  assertDatabaseUrl('pmos:begin')
  const checkTaskId = argument('--check-task-id')
  const inputPath = argument('--input')
  if (checkTaskId) return checkRegistration(checkTaskId, argument('--check-conversation-id'), argument('--check-project'), argument('--check-target-environment'))
  if (!inputPath) throw new Error('Usage: npm run pmos:begin -- --input <registration.json> OR --check-task-id <taskId> [--check-conversation-id <id> --check-project <project> --check-target-environment <environment>]')
  return begin(inputPath)
}

main()
  .catch((error) => {
    console.error(`[pmos:begin] ${(error as Error).message}`)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
