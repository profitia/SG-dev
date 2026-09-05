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
  status: 'PUBLISHED' | 'IDEMPOTENT' | 'FAILED' | 'FAILED_RETRYABLE' | 'CONFLICT'
  retryable: boolean
  bundlePath: string | null
  manifestPath: string | null
  commitSha: string | null
  publicationId: string
  taskId: string
  artifactCount: number
  repositoryPath: string | null
  error: string | null
}

export type PhrPublicationAttemptRecord = PhrPublicationResult & {
  attemptedAt: string
}

export type PhrPublicationSidecar = PhrPublicationResult & {
  attemptedAt: string
  closeoutRef: string
  handoffArtifactId: string
  conversationArtifactPath: string
  currentStatus: PhrPublicationResult['status']
  attemptHistory: PhrPublicationAttemptRecord[]
}

const EXPECTED_PHR_REPOSITORY_SLUG = 'profitia/project-history-repository'

export type PhrRepositoryValidationResult = {
  ok: boolean
  retryable: boolean
  repositoryPath: string | null
  originUrl: string | null
  error: string | null
}

function runGitCommand(repositoryPath: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync('git', args, {
    cwd: repositoryPath,
    encoding: 'utf8',
  })

  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  }
}

export function isSuccessfulPhrPublicationStatus(status: PhrPublicationResult['status']): boolean {
  return status === 'PUBLISHED' || status === 'IDEMPOTENT'
}

function classifyPublicationFailure(message: string): Pick<PhrPublicationResult, 'status' | 'retryable'> {
  if (message.includes('not configured') || message.includes('unavailable')) {
    return { status: 'FAILED_RETRYABLE', retryable: true }
  }

  if (message.includes('does not match') || message.includes('not a Git worktree') || message.includes('missing canonical files')) {
    return { status: 'CONFLICT', retryable: false }
  }

  return { status: 'FAILED', retryable: false }
}

export function validatePhrRepositoryPath(repositoryPath: string): PhrRepositoryValidationResult {
  if (!repositoryPath) {
    return {
      ok: false,
      retryable: true,
      repositoryPath: null,
      originUrl: null,
      error: 'PHR_REPOSITORY_PATH is not configured.',
    }
  }

  let resolvedPath: string
  try {
    resolvedPath = fs.realpathSync(repositoryPath)
  } catch {
    return {
      ok: false,
      retryable: true,
      repositoryPath,
      originUrl: null,
      error: `PHR repository path is unavailable: ${repositoryPath}`,
    }
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    return {
      ok: false,
      retryable: true,
      repositoryPath: resolvedPath,
      originUrl: null,
      error: `PHR repository path is unavailable: ${resolvedPath}`,
    }
  }

  const workTreeCheck = runGitCommand(resolvedPath, ['rev-parse', '--is-inside-work-tree'])
  if (!workTreeCheck.ok || workTreeCheck.stdout !== 'true') {
    return {
      ok: false,
      retryable: false,
      repositoryPath: resolvedPath,
      originUrl: null,
      error: `PHR repository path is not a Git worktree: ${resolvedPath}`,
    }
  }

  const origin = runGitCommand(resolvedPath, ['remote', 'get-url', 'origin'])
  if (!origin.ok || !origin.stdout) {
    return {
      ok: false,
      retryable: false,
      repositoryPath: resolvedPath,
      originUrl: null,
      error: `PHR repository origin remote is not configured: ${resolvedPath}`,
    }
  }

  const normalizedOrigin = origin.stdout.replace(/\.git$/i, '')
  const identityMatches = normalizedOrigin.includes(EXPECTED_PHR_REPOSITORY_SLUG)
  const requiredFiles = ['scripts/publish-bundle.mjs', 'schemas/publication-manifest-v1.schema.json', 'history/README.md']
  const missingFiles = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(resolvedPath, relativePath)))

  if (!identityMatches) {
    return {
      ok: false,
      retryable: false,
      repositoryPath: resolvedPath,
      originUrl: origin.stdout,
      error: `PHR repository origin does not match ${EXPECTED_PHR_REPOSITORY_SLUG}: ${origin.stdout}`,
    }
  }

  if (missingFiles.length > 0) {
    return {
      ok: false,
      retryable: false,
      repositoryPath: resolvedPath,
      originUrl: origin.stdout,
      error: `PHR repository is missing canonical files: ${missingFiles.join(', ')}`,
    }
  }

  return {
    ok: true,
    retryable: false,
    repositoryPath: resolvedPath,
    originUrl: origin.stdout,
    error: null,
  }
}

function loadExistingPublicationAttempts(sidecarPath: string): PhrPublicationAttemptRecord[] {
  if (!fs.existsSync(sidecarPath)) {
    return []
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(sidecarPath, 'utf8')) as Partial<PhrPublicationSidecar> & Record<string, unknown>
    if (Array.isArray(parsed.attemptHistory)) {
      return parsed.attemptHistory.filter((attempt): attempt is PhrPublicationAttemptRecord => Boolean(attempt && typeof attempt === 'object' && 'attemptedAt' in attempt))
    }

    if (typeof parsed.attemptedAt === 'string' && typeof parsed.status === 'string') {
      return [{
        status: parsed.status as PhrPublicationResult['status'],
        retryable: Boolean(parsed.retryable),
        bundlePath: parsed.bundlePath ?? null,
        manifestPath: parsed.manifestPath ?? null,
        commitSha: parsed.commitSha ?? null,
        publicationId: typeof parsed.publicationId === 'string' ? parsed.publicationId : '',
        taskId: typeof parsed.taskId === 'string' ? parsed.taskId : '',
        artifactCount: typeof parsed.artifactCount === 'number' ? parsed.artifactCount : 0,
        repositoryPath: parsed.repositoryPath ?? null,
        error: parsed.error ?? null,
        attemptedAt: parsed.attemptedAt,
      }]
    }
  } catch {
    return []
  }

  return []
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
  const repositoryValidation = validatePhrRepositoryPath(params.repositoryPath)
  if (!repositoryValidation.ok) {
    const failure = classifyPublicationFailure(repositoryValidation.error ?? 'PHR publication failed.')
    return {
      status: failure.status,
      retryable: failure.retryable,
      bundlePath: null,
      manifestPath: null,
      commitSha: null,
      publicationId: params.publication.publicationId,
      taskId: params.publication.taskId,
      artifactCount: params.publication.artifacts.length,
      repositoryPath: repositoryValidation.repositoryPath,
      error: repositoryValidation.error,
    }
  }

  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-publication-'))
  const inputPath = path.join(inputDir, `${params.publication.publicationId}.json`)
  atomicWriteJsonFile(inputPath, params.publication, {
    label: `phr-publication:${params.publication.publicationId}`,
  })

  try {
    const publisherScript = path.join(repositoryValidation.repositoryPath ?? params.repositoryPath, 'scripts', 'publish-bundle.mjs')
    if (!fs.existsSync(publisherScript)) {
      return {
        status: 'FAILED_RETRYABLE',
        retryable: true,
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: repositoryValidation.repositoryPath,
        error: `PHR publisher entrypoint not found: ${publisherScript}`,
      }
    }

    const result = spawnSync(process.execPath, [publisherScript, '--input', inputPath], {
      cwd: repositoryValidation.repositoryPath ?? params.repositoryPath,
      encoding: 'utf8',
      env: {
        ...process.env,
        PHR_REPOSITORY_PATH: repositoryValidation.repositoryPath ?? params.repositoryPath,
      },
    })

    if (result.error) {
      return {
        status: 'FAILED_RETRYABLE',
        retryable: true,
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: repositoryValidation.repositoryPath,
        error: result.error.message,
      }
    }

    const stdout = result.stdout?.trim() ?? ''
    if (result.status !== 0) {
      const failure = classifyPublicationFailure(result.stderr?.trim() || stdout || `PHR publisher exited with status ${result.status}`)
      return {
        status: failure.status,
        retryable: failure.retryable,
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: params.publication.publicationId,
        taskId: params.publication.taskId,
        artifactCount: params.publication.artifacts.length,
        repositoryPath: repositoryValidation.repositoryPath,
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
      retryable: false,
      bundlePath: parsed.bundlePath ?? null,
      manifestPath: parsed.manifestPath ?? null,
      commitSha: parsed.commitSha ?? null,
      publicationId: parsed.publicationId ?? params.publication.publicationId,
      taskId: parsed.taskId ?? params.publication.taskId,
      artifactCount: parsed.artifactCount ?? params.publication.artifacts.length,
      repositoryPath: repositoryValidation.repositoryPath,
      error: null,
    }
  } catch (error) {
    const failure = classifyPublicationFailure(error instanceof Error ? error.message : String(error))
    return {
      status: failure.status,
      retryable: failure.retryable,
      bundlePath: null,
      manifestPath: null,
      commitSha: null,
      publicationId: params.publication.publicationId,
      taskId: params.publication.taskId,
      artifactCount: params.publication.artifacts.length,
      repositoryPath: repositoryValidation.repositoryPath,
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
  const attemptHistory = [...loadExistingPublicationAttempts(params.sidecarPath), {
    ...params.result,
    attemptedAt: params.attemptedAt,
  }]

  atomicWriteJsonFile(params.sidecarPath, {
    ...params.result,
    attemptedAt: params.attemptedAt,
    closeoutRef: params.closeoutRef,
    handoffArtifactId: params.handoffArtifactId,
    conversationArtifactPath: params.conversationArtifactPath,
    currentStatus: params.result.status,
    attemptHistory,
  }, {
    label: `phr-publication-result:${params.result.publicationId}`,
  })
}

export function publishPhrPublicationOnCompletedCloseout(params: {
  artifact: FlightRecordV1
  handoff: GptHandoffArtifactV1 | null
  closeout: CloseoutEvidence
  closeoutRef: string
  conversationArtifactPath: string
  sidecarPath: string
  repositoryPath: string
  attemptedAt?: string
  writeAttempt?: typeof writePhrPublicationAttempt
  writeSidecar?: typeof writePhrPublicationSidecar
}): { attempted: boolean; attemptedAt: string | null; result: PhrPublicationResult | null } {
  if (params.closeout.closeoutState !== 'CLOSEOUT_COMPLETE' || !params.handoff) {
    return { attempted: false, attemptedAt: null, result: null }
  }

  const attemptedAt = params.attemptedAt ?? new Date().toISOString()
  const writeAttempt = params.writeAttempt ?? writePhrPublicationAttempt
  const writeSidecar = params.writeSidecar ?? writePhrPublicationSidecar
  const result = writeAttempt({
    publication: buildPhrPublicationInput({
      artifact: params.artifact,
      handoff: params.handoff,
      closeout: params.closeout,
      closeoutRef: params.closeoutRef,
      conversationArtifactPath: params.conversationArtifactPath,
    }),
    repositoryPath: params.repositoryPath,
  })

  writeSidecar({
    sidecarPath: params.sidecarPath,
    result,
    attemptedAt,
    closeoutRef: params.closeoutRef,
    handoffArtifactId: params.handoff.id,
    conversationArtifactPath: params.conversationArtifactPath,
  })

  return { attempted: true, attemptedAt, result }
}
