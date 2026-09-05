import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { buildPhrPublicationInput, publishPhrPublicationOnCompletedCloseout, validatePhrRepositoryPath, writePhrPublicationAttempt } from './phr-publication'

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`)
  }
}

function createTempPhrRepo(originRemote: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-adapter-'))
  const originPath = path.join(tempRoot, 'origin.git')
  const repoPath = path.join(tempRoot, 'phr')

  runGit(tempRoot, ['init', '--bare', originPath])
  runGit(tempRoot, ['clone', originPath, repoPath])
  runGit(repoPath, ['config', 'user.email', 'phr-test@example.com'])
  runGit(repoPath, ['config', 'user.name', 'PHR Test'])
  runGit(repoPath, ['checkout', '-b', 'main'])
  fs.mkdirSync(path.join(repoPath, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(repoPath, 'schemas'), { recursive: true })
  fs.mkdirSync(path.join(repoPath, 'history'), { recursive: true })
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# temp phr\n', 'utf8')
  fs.writeFileSync(path.join(repoPath, 'history', 'README.md'), 'history\n', 'utf8')
  fs.writeFileSync(path.join(repoPath, 'schemas', 'publication-manifest-v1.schema.json'), '{}\n', 'utf8')
  fs.writeFileSync(path.join(repoPath, 'scripts', 'publish-bundle.mjs'), '#!/usr/bin/env node\nconsole.log(JSON.stringify({ status: "IDEMPOTENT", bundlePath: "history/x", manifestPath: "history/x/manifest.json", commitSha: "abc", publicationId: "test", taskId: "test", artifactCount: 3 }))\n', 'utf8')
  runGit(repoPath, ['add', '.'])
  runGit(repoPath, ['commit', '-m', 'init phr'])
  runGit(repoPath, ['remote', 'set-url', 'origin', originRemote])

  return { tempRoot, repoPath }
}

function makePublication() {
  return buildPhrPublicationInput({
    artifact: {
      metadata: {
        taskId: 'phr-adapter-test',
        project: 'Project History Repository',
        timestamp: '2026-09-05T12:00:00.000Z',
      },
      result: { finalStatus: 'SUCCESS' },
    } as never,
    handoff: {
      id: 'test:HANDOFF:v1',
      artifactKind: 'HANDOFF',
      artifactNature: 'DERIVED',
      version: 'v1',
      status: 'GENERATED',
      taskId: 'phr-adapter-test',
      conversationId: 'conversation',
      createdAt: '2026-09-05T12:00:00.000Z',
      sourceRefs: [],
      payload: {
        originalObjective: 'test',
        currentState: [],
        resultStatus: 'SUCCESS',
        completedWork: [],
        notCompleted: [],
        keyFindings: [],
        unresolvedAreas: [],
        decisions: [],
        blockers: [],
        residualRisks: [],
        recommendedNextDecision: 'test',
        openQuestions: [],
        outstandingTopics: [],
        bridgePayloadText: 'test',
        copyReadyText: 'test',
      },
    },
    closeout: {
      closeoutState: 'CLOSEOUT_COMPLETE',
      closeoutCompletedAt: '2026-09-05T12:01:00.000Z',
    } as never,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    conversationArtifactPath: 'apps/pmos/.pmos/conversations/test.json',
  })
}

test('validatePhrRepositoryPath accepts a canonical local PHR checkout', () => {
  const { repoPath } = createTempPhrRepo('https://github.com/profitia/project-history-repository.git')
  const validation = validatePhrRepositoryPath(repoPath)
  assert.equal(validation.ok, true)
  assert.equal(validation.retryable, false)
  assert.equal(validation.originUrl?.includes('profitia/project-history-repository'), true)
})

test('validatePhrRepositoryPath rejects missing and wrong repositories', () => {
  const missing = validatePhrRepositoryPath('')
  assert.equal(missing.ok, false)
  assert.match(missing.error ?? '', /not configured/)

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-wrong-'))
  const repoPath = path.join(tempRoot, 'phr')
  runGit(tempRoot, ['init', repoPath])
  runGit(repoPath, ['config', 'user.email', 'phr-test@example.com'])
  runGit(repoPath, ['config', 'user.name', 'PHR Test'])
  fs.writeFileSync(path.join(repoPath, 'README.md'), '# wrong repo\n', 'utf8')
  runGit(repoPath, ['add', 'README.md'])
  runGit(repoPath, ['commit', '-m', 'init'])
  runGit(repoPath, ['remote', 'add', 'origin', 'https://github.com/example/not-phr.git'])

  const wrong = validatePhrRepositoryPath(repoPath)
  assert.equal(wrong.ok, false)
  assert.match(wrong.error ?? '', /does not match/)
})

test('writePhrPublicationAttempt is retryable when configuration is missing', () => {
  const result = writePhrPublicationAttempt({
    publication: makePublication(),
    repositoryPath: '',
  })

  assert.equal(result.status, 'FAILED_RETRYABLE')
  assert.equal(result.retryable, true)
  assert.match(result.error ?? '', /not configured/)
})

test('publishPhrPublicationOnCompletedCloseout skips incomplete closeouts', () => {
  let attemptCalls = 0
  let sidecarCalls = 0
  const result = publishPhrPublicationOnCompletedCloseout({
    artifact: {
      metadata: {
        taskId: 'phr-adapter-test',
        project: 'Project History Repository',
        timestamp: '2026-09-05T12:00:00.000Z',
      },
      result: { finalStatus: 'SUCCESS' },
    } as never,
    handoff: null,
    closeout: {
      closeoutState: 'CLOSEOUT_PARTIAL',
    } as never,
    closeoutRef: 'closeout.json',
    conversationArtifactPath: 'conversation.json',
    sidecarPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-skip-')), 'phr.json'),
    repositoryPath: '/tmp/phr',
    writeAttempt: () => {
      attemptCalls += 1
      return makeFailedResult()
    },
    writeSidecar: () => {
      sidecarCalls += 1
    },
  })

  assert.equal(result.attempted, false)
  assert.equal(result.result, null)
  assert.equal(attemptCalls, 0)
  assert.equal(sidecarCalls, 0)
})

test('publishPhrPublicationOnCompletedCloseout writes sidecar on lawful closeout', () => {
  let attemptCalls = 0
  let sidecarCalls = 0
  const result = publishPhrPublicationOnCompletedCloseout({
    artifact: {
      metadata: {
        taskId: 'phr-adapter-test',
        project: 'Project History Repository',
        timestamp: '2026-09-05T12:00:00.000Z',
      },
      result: { finalStatus: 'SUCCESS' },
    } as never,
    handoff: {
      id: 'test:HANDOFF:v1',
      artifactKind: 'HANDOFF',
      artifactNature: 'DERIVED',
      version: 'v1',
      status: 'GENERATED',
      taskId: 'phr-adapter-test',
      conversationId: 'conversation',
      createdAt: '2026-09-05T12:00:00.000Z',
      sourceRefs: [],
      payload: {
        originalObjective: 'test',
        currentState: [],
        resultStatus: 'SUCCESS',
        completedWork: [],
        notCompleted: [],
        keyFindings: [],
        unresolvedAreas: [],
        decisions: [],
        blockers: [],
        residualRisks: [],
        recommendedNextDecision: 'test',
        openQuestions: [],
        outstandingTopics: [],
        bridgePayloadText: 'test',
        copyReadyText: 'test',
      },
    } as never,
    closeout: {
      closeoutState: 'CLOSEOUT_COMPLETE',
      closeoutCompletedAt: '2026-09-05T12:01:00.000Z',
    } as never,
    closeoutRef: 'closeout.json',
    conversationArtifactPath: 'conversation.json',
    sidecarPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-run-')), 'phr.json'),
    repositoryPath: '/tmp/phr',
    attemptedAt: '2026-09-05T12:02:00.000Z',
    writeAttempt: () => {
      attemptCalls += 1
      return {
        status: 'PUBLISHED',
        retryable: false,
        bundlePath: 'history/2026/09/05/bundle',
        manifestPath: 'history/2026/09/05/bundle/manifest.json',
        commitSha: 'abc123',
        publicationId: 'phr-adapter-test',
        taskId: 'phr-adapter-test',
        artifactCount: 5,
        repositoryPath: '/tmp/phr',
        error: null,
      }
    },
    writeSidecar: () => {
      sidecarCalls += 1
    },
  })

  assert.equal(result.attempted, true)
  assert.equal(result.result?.status, 'PUBLISHED')
  assert.equal(attemptCalls, 1)
  assert.equal(sidecarCalls, 1)
})

function makeFailedResult() {
  return {
    status: 'FAILED_RETRYABLE' as const,
    retryable: true,
    bundlePath: null,
    manifestPath: null,
    commitSha: null,
    publicationId: 'phr-adapter-test',
    taskId: 'phr-adapter-test',
    artifactCount: 0,
    repositoryPath: null,
    error: 'missing',
  }
}
