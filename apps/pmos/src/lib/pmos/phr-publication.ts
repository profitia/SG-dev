import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import type {
  CloseoutEvidence,
  FlightRecordV1,
  GptHandoffArtifactV1,
} from '../../../../../packages/governance/src/index.js'

import { atomicWriteJsonFile } from './atomic-io.js'

export type PhrPublicationArtifactInput = {
  type: string
  status: 'PRESENT' | 'ABSENT'
  path: string | null
  sourceId: string | null
  content?: string | Record<string, unknown>
}

export type PhrPublicationInput = {
  schemaVersion: '1.0'
  publicationId: string
  taskId: string
  projectId: string
  createdAt: string
  publishedAt: string
  result: string
  closeoutState: string
  sourceSystem: 'PMOS'
  artifacts: PhrPublicationArtifactInput[]
}

export type PhrPublicationResult = {
  status: 'PUBLISHED' | 'IDEMPOTENT' | 'FAILED'
  bundlePath: string | null
  manifestPath: string | null
  commitSha: string | null
  publicationId: string
  taskId: string
  artifactCount: number
  repositoryPath: string | null
  error: string | null
}

export function buildPhrPublicationInput(params: {
  artifact: FlightRecordV1
  handoff: GptHandoffArtifactV1
  closeout: CloseoutEvidence
  closeoutRef: string
  conversationArtifactPath: string
}): PhrPublicationInput {
  const publishedAt = params.closeout.closeoutCompletedAt ?? params.closeout.closeoutStartedAt
  if (!publishedAt) {
    throw new Error('Closeout evidence is missing a stable publication timestamp.')
  }

  return {
    schemaVersion: '1.0',
    publicationId: params.artifact.metadata.taskId,
    taskId: params.artifact.metadata.taskId,
    projectId: params.artifact.metadata.project,
    createdAt: params.artifact.metadata.timestamp,
    publishedAt,
    result: params.artifact.result.finalStatus,
    closeoutState: params.closeout.closeoutState,
    sourceSystem: 'PMOS',
    artifacts: [
      {
        type: 'handoff.md',
        status: 'PRESENT',
        path: 'handoff.md',
        sourceId: params.handoff.id,
        content: params.handoff as unknown as Record<string, unknown>,
      },
      {
        type: 'handoff.json',
        status: 'ABSENT',
        path: null,
        sourceId: null,
      },
      {
        type: 'conversation-artifact.json',
        status: 'PRESENT',
        path: 'conversation-artifact.json',
        sourceId: params.conversationArtifactPath,
        content: params.artifact as unknown as Record<string, unknown>,
      },
      {
        type: 'flight-record.json',
        status: 'PRESENT',
        path: 'flight-record.json',
        sourceId: params.conversationArtifactPath,
        content: params.artifact as unknown as Record<string, unknown>,
      },
      {
        type: 'closeout-evidence.json',
        status: 'PRESENT',
        path: 'closeout-evidence.json',
        sourceId: params.closeoutRef,
        content: params.closeout as unknown as Record<string, unknown>,
      },
    ],
  }
}

export function writePhrPublicationAttempt(params: {
  publication: PhrPublicationInput
  repositoryPath: string
}): PhrPublicationResult {
  if (!params.repositoryPath) {
    return {
      status: 'FAILED',
      bundlePath: null,
      manifestPath: null,
      commitSha: null,
      publicationId: params.publication.publicationId,
      taskId: params.publication.taskId,
      artifactCount: params.publication.artifacts.length,
      repositoryPath: null,
      error: 'PHR_REPOSITORY_PATH is not configured.',
    }
  }

  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-publication-'))
  const inputPath = path.join(inputDir, `${params.publication.publicationId}.json`)
  atomicWriteJsonFile(inputPath, params.publication, {
    label: `phr-publication:${params.publication.publicationId}`,
  })

  try {
    const publisherScript = path.join(params.repositoryPath, 'scripts', 'publish-bundle.mjs')
    if (!fs.existsSync(publisherScript)) {
      return {
        status: 'FAILED',
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: params.repositoryPath,
        error: `PHR publisher entrypoint not found: ${publisherScript}`,
      }
    }

    const result = spawnSync(process.execPath, [publisherScript, '--input', inputPath], {
      cwd: params.repositoryPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        PHR_REPOSITORY_PATH: params.repositoryPath,
      },
    })

    if (result.error) {
      return {
        status: 'FAILED',
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: params.repositoryPath,
        error: result.error.message,
      }
    }

    const stdout = result.stdout?.trim() ?? ''
    if (result.status !== 0) {
      return {
        status: 'FAILED',
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: params.repositoryPath,
        error: result.stderr?.trim() || stdout || `PHR publisher exited with status ${result.status}`,
      }
    }

    const parsed = JSON.parse(stdout) as {
      status?: 'PUBLISHED' | 'IDEMPOTENT'
      bundlePath?: string
      manifestPath?: string
      commitSha?: string
      publicationId?: string
      taskId?: string
      artifactCount?: number
    }

    return {
      status: parsed.status === 'IDEMPOTENT' ? 'IDEMPOTENT' : 'PUBLISHED',
      bundlePath: parsed.bundlePath ?? null,
      manifestPath: parsed.manifestPath ?? null,
      commitSha: parsed.commitSha ?? null,
      publicationId: parsed.publicationId ?? params.publication.publicationId,
      taskId: parsed.taskId ?? params.publication.taskId,
      artifactCount: parsed.artifactCount ?? params.publication.artifacts.length,
      repositoryPath: params.repositoryPath,
      error: null,
    }
  } catch (error) {
    return {
      status: 'FAILED',
      bundlePath: null,
      manifestPath: null,
      commitSha: null,
      publicationId: params.publication.publicationId,
      taskId: params.publication.taskId,
      artifactCount: params.publication.artifacts.length,
      repositoryPath: params.repositoryPath,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    fs.rmSync(inputDir, { recursive: true, force: true })
  }
}

export function writePhrPublicationSidecar(params: {
  sidecarPath: string
  result: PhrPublicationResult
  attemptedAt: string
  closeoutRef: string
  handoffArtifactId: string
  conversationArtifactPath: string
}): void {
  atomicWriteJsonFile(params.sidecarPath, {
    ...params.result,
    attemptedAt: params.attemptedAt,
    closeoutRef: params.closeoutRef,
    handoffArtifactId: params.handoffArtifactId,
    conversationArtifactPath: params.conversationArtifactPath,
  }, {
    label: `phr-publication-result:${params.result.publicationId}`,
  })
}