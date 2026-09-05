#!/usr/bin/env tsx

import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient, ArtifactKind as PrismaArtifactKind, ArtifactNature as PrismaArtifactNature, ArtifactStatus as PrismaArtifactStatus } from '@prisma/client'

import { validateGptHandoffArtifact, type CloseoutEvidence, type GptHandoffArtifactV1 } from '../../../packages/governance/src'

import { readJsonFileSafe } from '../src/lib/pmos/atomic-io'
import { buildPhrPublicationInput, writePhrPublicationAttempt, writePhrPublicationSidecar } from '../src/lib/pmos/phr-publication'

const prisma = new PrismaClient()
const SG_DEV_ROOT = path.resolve(__dirname, '../../..')
const PMOS_DIR = path.join(SG_DEV_ROOT, 'apps/pmos/.pmos')
const CONVERSATIONS_DIR = path.join(PMOS_DIR, 'conversations')
const CLOSEOUTS_DIR = path.join(PMOS_DIR, 'recovery/closeouts')
const PHR_PUBLICATIONS_DIR = path.join(PMOS_DIR, 'recovery/phr-publications')

function parseArgs(argv: string[]): { baseName: string | null } {
  let baseName: string | null = null
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--base-name') {
      baseName = argv[index + 1] ?? null
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return { baseName }
}

function resolveStem(dir: string, baseName: string, suffix: string): string {
  const exactFile = path.join(dir, `${baseName}${suffix}`)
  if (fs.existsSync(exactFile)) {
    return exactFile
  }

  const matches = fs.readdirSync(dir).filter((entry) => entry.endsWith(`${baseName}${suffix}`))
  if (matches.length === 1) {
    return path.join(dir, matches[0])
  }

  if (matches.length > 1) {
    throw new Error(`Ambiguous archive stem for ${baseName}${suffix}: ${matches.join(', ')}`)
  }

  throw new Error(`Archive stem not found for ${baseName}${suffix}`)
}

function readPersistedHandoffArtifactOrThrow(row: {
  id: string
  artifactKind: PrismaArtifactKind
  artifactNature: PrismaArtifactNature
  version: string
  status: PrismaArtifactStatus
  taskId: string
  conversationId: string
  sourceRefs: unknown
  payload: unknown
  createdAt: Date
}): GptHandoffArtifactV1 {
  if (!Array.isArray(row.sourceRefs)) {
    throw new Error(`Persisted handoff artifact ${row.id} has invalid sourceRefs`)
  }
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    throw new Error(`Persisted handoff artifact ${row.id} has invalid payload`)
  }

  const candidate: GptHandoffArtifactV1 = {
    id: row.id,
    artifactKind: row.artifactKind,
    artifactNature: row.artifactNature,
    version: row.version,
    status: row.status,
    taskId: row.taskId,
    conversationId: row.conversationId,
    createdAt: row.createdAt.toISOString(),
    sourceRefs: row.sourceRefs as GptHandoffArtifactV1['sourceRefs'],
    payload: row.payload as GptHandoffArtifactV1['payload'],
  }

  const validation = validateGptHandoffArtifact(candidate)
  if (!validation.valid) {
    throw new Error(`Persisted handoff artifact validation failed: ${validation.errors.join(' | ')}`)
  }

  return candidate
}

async function main(): Promise<void> {
  const { baseName } = parseArgs(process.argv)
  if (!baseName) {
    throw new Error('Missing --base-name argument.')
  }

  const conversationPath = resolveStem(CONVERSATIONS_DIR, baseName, '.json')
  const closeoutPath = resolveStem(CLOSEOUTS_DIR, baseName, '.closeout.json')

  const conversationArtifact = readJsonFileSafe<Record<string, unknown>>(conversationPath)
  if (!conversationArtifact.value) {
    throw new Error(conversationArtifact.error ?? `Conversation artifact not found: ${conversationPath}`)
  }

  const closeout = readJsonFileSafe<CloseoutEvidence>(closeoutPath)
  if (!closeout.value) {
    throw new Error(closeout.error ?? `Closeout evidence not found: ${closeoutPath}`)
  }

  const conversationId = String((conversationArtifact.value.metadata as Record<string, unknown>).conversationId)
  const handoffId = `${conversationId}:HANDOFF:v1`
  const persistedHandoff = await prisma.artifact.findUnique({
    where: { id: handoffId },
    select: {
      id: true,
      artifactKind: true,
      artifactNature: true,
      version: true,
      status: true,
      taskId: true,
      conversationId: true,
      sourceRefs: true,
      payload: true,
      createdAt: true,
    },
  })

  if (!persistedHandoff) {
    throw new Error(`Persisted handoff artifact not found: ${handoffId}`)
  }

  const handoff = readPersistedHandoffArtifactOrThrow(persistedHandoff)
  const publication = buildPhrPublicationInput({
    artifact: conversationArtifact.value as never,
    handoff,
    closeout: closeout.value,
    closeoutRef: `apps/pmos/.pmos/recovery/closeouts/${baseName}.closeout.json`,
    conversationArtifactPath: `apps/pmos/.pmos/conversations/${baseName}.json`,
  })

  fs.mkdirSync(PHR_PUBLICATIONS_DIR, { recursive: true })
  const sidecarPath = path.join(PHR_PUBLICATIONS_DIR, `${baseName}.json`)
  const result = writePhrPublicationAttempt({
    publication,
    repositoryPath: process.env.PHR_REPOSITORY_PATH ?? '',
  })
  writePhrPublicationSidecar({
    sidecarPath,
    result,
    attemptedAt: new Date().toISOString(),
    closeoutRef: `apps/pmos/.pmos/recovery/closeouts/${baseName}.closeout.json`,
    handoffArtifactId: handoff.id,
    conversationArtifactPath: `apps/pmos/.pmos/conversations/${baseName}.json`,
  })

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.status === 'FAILED') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
