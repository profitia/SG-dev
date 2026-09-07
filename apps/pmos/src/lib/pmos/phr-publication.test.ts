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

function createReplayableTempPhrRepo(originRemote: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-replay-'))
  const repoPath = path.join(tempRoot, 'phr')

  runGit(tempRoot, ['init', repoPath])
  runGit(repoPath, ['config', 'user.email', 'phr-test@example.com'])
  runGit(repoPath, ['config', 'user.name', 'PHR Test'])

  fs.mkdirSync(path.join(repoPath, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(repoPath, 'schemas'), { recursive: true })
  fs.mkdirSync(path.join(repoPath, 'history'), { recursive: true })
  fs.writeFileSync(path.join(repoPath, 'history', 'README.md'), 'history\n', 'utf8')
  fs.writeFileSync(path.join(repoPath, 'schemas', 'publication-manifest-v1.schema.json'), '{}\n', 'utf8')
  fs.writeFileSync(path.join(repoPath, 'scripts', 'publish-bundle.mjs'), [
    '#!/usr/bin/env node',
    'import fs from "node:fs"',
    'import path from "node:path"',
    'import { createHash } from "node:crypto"',
    'const inputIndex = process.argv.indexOf("--input")',
    'if (inputIndex === -1 || !process.argv[inputIndex + 1]) {',
    '  console.error("Missing --input")',
    '  process.exit(1)',
    '}',
    'const publication = JSON.parse(fs.readFileSync(process.argv[inputIndex + 1], "utf8"))',
    'const historyRoot = path.join(process.env.PHR_REPOSITORY_PATH, "history", publication.publicationId)',
    'const fingerprint = createHash("sha256").update(JSON.stringify({',
    '  publicationId: publication.publicationId,',
    '  handoff: publication.artifacts.find((artifact) => artifact.type === "handoff.md")?.content ?? null,',
    '})).digest("hex")',
    'const fingerprintPath = path.join(historyRoot, "fingerprint.json")',
    'const manifestPath = path.join(historyRoot, "manifest.json")',
    'if (!fs.existsSync(historyRoot)) {',
    '  fs.mkdirSync(historyRoot, { recursive: true })',
    '  fs.writeFileSync(fingerprintPath, JSON.stringify({ fingerprint }, null, 2))',
    '  fs.writeFileSync(manifestPath, JSON.stringify({ fingerprint, publicationId: publication.publicationId }, null, 2))',
    '  console.log(JSON.stringify({ status: "PUBLISHED", bundlePath: historyRoot, manifestPath, commitSha: "abc123", publicationId: publication.publicationId, taskId: publication.taskId, artifactCount: publication.artifacts.length }))',
    '  process.exit(0)',
    '}',
    'const existing = JSON.parse(fs.readFileSync(fingerprintPath, "utf8")).fingerprint',
    'if (existing === fingerprint) {',
    '  console.log(JSON.stringify({ status: "IDEMPOTENT", bundlePath: historyRoot, manifestPath, commitSha: "abc123", publicationId: publication.publicationId, taskId: publication.taskId, artifactCount: publication.artifacts.length }))',
    '  process.exit(0)',
    '}',
    'console.error("Bundle conflict detected for handoff.md")',
    'process.exit(1)',
  ].join('\n'), 'utf8')
  runGit(repoPath, ['add', '.'])
  runGit(repoPath, ['commit', '-m', 'init replayable phr'])
  runGit(repoPath, ['remote', 'add', 'origin', originRemote])

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

function makeRefreshedPublication(options?: { pendingArtifactSlotFinal?: 'CLEAR' | 'OCCUPIED' }) {
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
      id: 'conversation:HANDOFF:v1',
      artifactKind: 'HANDOFF',
      artifactNature: 'DERIVED',
      version: 'v1',
      status: 'GENERATED',
      taskId: 'phr-adapter-test',
      conversationId: 'conversation',
      createdAt: '2026-09-05T12:00:00.000Z',
      sourceRefs: [],
      payload: {
        finalizationContext: {
          pendingArtifactSlotFinal: options?.pendingArtifactSlotFinal ?? 'CLEAR',
        },
        bridgePayloadText: 'refreshed',
      },
    } as never,
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

test('buildPhrPublicationInput carries the refreshed handoff slot state', () => {
  const publication = makeRefreshedPublication({ pendingArtifactSlotFinal: 'CLEAR' })

  assert.equal(publication.artifacts[0].sourceId, 'conversation:HANDOFF:v1')
  assert.equal(
    (publication.artifacts[0].content as { payload?: { finalizationContext?: { pendingArtifactSlotFinal?: string } } }).payload?.finalizationContext?.pendingArtifactSlotFinal,
    'CLEAR',
  )
})

test('writePhrPublicationAttempt publishes once, replays idempotently, and conflicts on immutable bundle drift', () => {
  const { repoPath } = createReplayableTempPhrRepo('https://github.com/profitia/project-history-repository.git')
  const publication = makeRefreshedPublication({ pendingArtifactSlotFinal: 'CLEAR' })

  const first = writePhrPublicationAttempt({ publication, repositoryPath: repoPath })
  assert.equal(first.status, 'PUBLISHED')

  const second = writePhrPublicationAttempt({ publication, repositoryPath: repoPath })
  assert.equal(second.status, 'IDEMPOTENT')

  const bundleEntries = fs.readdirSync(path.join(repoPath, 'history', publication.publicationId))
  assert.equal(bundleEntries.filter((entry) => entry === 'manifest.json').length, 1)
  assert.equal(bundleEntries.filter((entry) => entry === 'fingerprint.json').length, 1)

  const conflictingPublication = makeRefreshedPublication({ pendingArtifactSlotFinal: 'OCCUPIED' })
  const conflict = writePhrPublicationAttempt({ publication: conflictingPublication, repositoryPath: repoPath })
  assert.equal(conflict.status, 'CONFLICT')
  assert.equal(conflict.retryable, false)
})

test('publishPhrPublicationOnCompletedCloseout keeps PMOS closeout independent from publication failure', () => {
  let attemptCalls = 0
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
      id: 'conversation:HANDOFF:v1',
      artifactKind: 'HANDOFF',
      artifactNature: 'DERIVED',
      version: 'v1',
      status: 'GENERATED',
      taskId: 'phr-adapter-test',
      conversationId: 'conversation',
      createdAt: '2026-09-05T12:00:00.000Z',
      sourceRefs: [],
      payload: {
        finalizationContext: {
          pendingArtifactSlotFinal: 'CLEAR',
        },
        bridgePayloadText: 'refreshed',
      },
    } as never,
    closeout: {
      closeoutState: 'CLOSEOUT_COMPLETE',
      closeoutCompletedAt: '2026-09-05T12:01:00.000Z',
    } as never,
    closeoutRef: 'closeout.json',
    conversationArtifactPath: 'conversation.json',
    sidecarPath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-failure-')), 'phr.json'),
    repositoryPath: '/tmp/phr',
    writeAttempt: () => {
      attemptCalls += 1
      return {
        status: 'FAILED',
        retryable: false,
        bundlePath: null,
        manifestPath: null,
        commitSha: null,
        publicationId: 'phr-adapter-test',
        taskId: 'phr-adapter-test',
        artifactCount: 5,
        repositoryPath: '/tmp/phr',
        error: 'immutable bundle conflict',
      }
    },
    writeSidecar: () => undefined,
  })

  assert.equal(result.attempted, true)
  assert.equal(result.result?.status, 'FAILED')
  assert.equal(attemptCalls, 1)
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
