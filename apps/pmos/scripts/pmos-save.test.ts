import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { CloseoutState } from '../../../packages/governance/src'

import {
  applySrmPhrPublicationOutcome,
  buildConversationArtifactSummary,
  buildPhrPublicationReadyHandoff,
  buildSrmPhrPublicationCandidate,
  publishOptionalSpendGuruPhrAfterPendingClear,
} from './pmos-save'
import { buildPhrPublicationInput, publishPhrPublicationOnCompletedCloseout, writePhrPublicationAttempt } from '../src/lib/pmos/phr-publication'
import { DEFAULT_PMOS_PROJECT_NAME, resolvePmosProjectProfile } from '../src/lib/pmos/project-profile'

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`)
  }
}

function createHistoryLayoutPhrRepo(originRemote: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pmos-phr-history-layout-'))
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
    'const slug = String(publication.publicationId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")',
    'const stamp = new Date(publication.publishedAt).toISOString().replace(/\\.\\d{3}Z$/, "Z").replace("T", "-").replace(/:/g, "-")',
    'const date = new Date(publication.publishedAt)',
    'const yyyy = String(date.getUTCFullYear())',
    'const mm = String(date.getUTCMonth() + 1).padStart(2, "0")',
    'const dd = String(date.getUTCDate()).padStart(2, "0")',
    'const historyRoot = path.join(process.env.PHR_REPOSITORY_PATH, "history", yyyy, mm, dd, `${stamp}__${slug}`)',
    'const fingerprint = createHash("sha256").update(JSON.stringify(publication)).digest("hex")',
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
    'console.error("Bundle conflict detected for immutable publication input")',
    'process.exit(1)',
  ].join('\n'), 'utf8')
  runGit(repoPath, ['add', '.'])
  runGit(repoPath, ['commit', '-m', 'init history layout phr'])
  runGit(repoPath, ['remote', 'add', 'origin', originRemote])

  return { tempRoot, repoPath }
}

function makeArtifact() {
  return {
    metadata: {
      conversationId: 'conversation',
      taskId: 'SRM-BOOTSTRAP-0001',
      project: 'SRM / PORR',
      timestamp: '2026-09-14T09:00:00.000Z',
      workspace: 'SG-dev Codespaces SRM',
    },
    task: {
      originalTaskRequest: 'Fix SRM closeout ordering',
    },
    result: {
      finalStatus: 'SUCCESS',
    },
    analysis: {
      reasoningSummary: 'summary',
    },
    findings: {
      findings: [],
      blockers: [],
      residualRisks: [],
    },
    decisions: {
      decisions: [],
    },
    actions: {
      artifactsCreated: [],
      artifactsModified: [],
      validationsExecuted: [],
      validationsNotExecuted: [],
      recommendations: [],
    },
  } as never
}

function makeSpendGuruArtifact() {
  return {
    ...makeArtifact(),
    metadata: {
      ...makeArtifact().metadata,
      project: DEFAULT_PMOS_PROJECT_NAME,
    },
  } as never
}

function makeEvidence() {
  return {
    closeoutState: CloseoutState.HANDOFF_PUBLICATION_STARTED,
    closeoutStartedAt: '2026-09-14T09:00:00.000Z',
    closeoutCompletedAt: null,
    pmosSaveStatus: 'SUCCEEDED',
    pmosSaveStartedAt: '2026-09-14T09:00:00.000Z',
    pmosSaveCompletedAt: '2026-09-14T09:01:00.000Z',
    pmosSaveError: null,
    pmosSaveArtifactPaths: [],
    pmosSaveDbRecordId: 'db-id',
    pmosSaveConversationMdPath: 'conversation.md',
    pmosSaveConversationJsonPath: 'conversation.json',
    pmosSaveIntegrityPath: 'conversation.integrity.json',
    pmosSaveLockPath: 'conversation.lock.json',
    vectorRebuildStatus: 'SUCCEEDED',
    vectorRebuildStartedAt: '2026-09-14T09:01:00.000Z',
    vectorRebuildCompletedAt: '2026-09-14T09:02:00.000Z',
    vectorRebuildError: null,
    handoffPublicationStatus: 'STARTED',
    handoffPublicationStartedAt: '2026-09-14T09:02:00.000Z',
    handoffPublicationCompletedAt: null,
    handoffPublicationError: null,
    runtimeContextPath: 'runtime-context.md',
    runtimeContextIntegrityPath: 'runtime-context.integrity.json',
    runtimeContextIntegrityStatus: 'PASS',
    runtimeContextIntegrityDetails: [],
    pendingArtifactBackupPath: 'pending.json',
    executionTrailPath: 'trail.jsonl',
    executionTrailMarkdownPath: 'trail.md',
    factPreservationStatus: 'PASS',
    factPreservationNotes: [],
    manualRecoveryInstructions: [],
    recoveryRequired: false,
    recoveryReason: null,
    stateHistory: [CloseoutState.HANDOFF_PUBLICATION_STARTED],
  } as never
}

function makeRetryEvidence(params: {
  closeoutStartedAt: string
  pmosSaveStartedAt: string
  pmosSaveCompletedAt: string
  vectorRebuildStartedAt: string
  vectorRebuildCompletedAt: string
  handoffPublicationStartedAt: string
  pendingArtifactBackupPath: string
  executionTrailPath: string
  executionTrailMarkdownPath: string
  dbRecordId: string
  factPreservationNotes: string[]
  stateHistory: CloseoutState[]
  retryTelemetryProbe: string
}) {
  return {
    ...makeEvidence(),
    closeoutStartedAt: params.closeoutStartedAt,
    pmosSaveStartedAt: params.pmosSaveStartedAt,
    pmosSaveCompletedAt: params.pmosSaveCompletedAt,
    vectorRebuildStartedAt: params.vectorRebuildStartedAt,
    vectorRebuildCompletedAt: params.vectorRebuildCompletedAt,
    handoffPublicationStartedAt: params.handoffPublicationStartedAt,
    pendingArtifactBackupPath: params.pendingArtifactBackupPath,
    executionTrailPath: params.executionTrailPath,
    executionTrailMarkdownPath: params.executionTrailMarkdownPath,
    pmosSaveDbRecordId: params.dbRecordId,
    factPreservationNotes: params.factPreservationNotes,
    stateHistory: params.stateHistory,
    retryTelemetryProbe: params.retryTelemetryProbe,
  } as never
}

function makeFinalizationContext(status: 'PUBLISHED' | 'IDEMPOTENT' | 'FAILED' | 'FAILED_RETRYABLE', pending: 'CLEAR' | 'OCCUPIED') {
  return {
    publicationArtifact: null,
    publicationAck: null,
    pendingArtifactSlotFinal: pending,
    memorosMode: 'disabled',
    memorosAuditStatus: 'MEMOROS_DISABLED_BY_PROJECT_PROFILE',
    phrPublicationStatus: status,
    phrRequiredForCompletion: true,
  } as const
}

function makeSpendGuruFinalizationContext(params?: {
  pendingArtifactSlotFinal?: 'CLEAR' | 'OCCUPIED'
  phrPublicationStatus?: 'NOT_ATTEMPTED' | 'FAILED' | 'PUBLISHED' | 'IDEMPOTENT'
}) {
  return {
    publicationArtifact: {
      id: 'conversation:PUBLICATION:MEMOROS:v1',
      status: 'DELIVERED',
      payload: {
        ack: {
          threadId: 'thread-1',
          sourceRecordId: 'source-1',
          knowledgeProcessingStatus: 'knowledge_ready',
          consumerReadinessStatus: 'ready',
        },
      },
    },
    publicationAck: {
      threadId: 'thread-1',
      sourceRecordId: 'source-1',
      knowledgeProcessingStatus: 'knowledge_ready',
      consumerReadinessStatus: 'ready',
    },
    pendingArtifactSlotFinal: params?.pendingArtifactSlotFinal ?? 'OCCUPIED',
    memorosMode: 'required',
    memorosAuditStatus: 'MEMOROS_REQUIRED',
    phrPublicationStatus: params?.phrPublicationStatus ?? 'NOT_ATTEMPTED',
    phrRequiredForCompletion: false,
  } as never
}

test('SRM bundle passed to PHR is already canonical and gated', () => {
  const candidate = buildSrmPhrPublicationCandidate({
    artifact: makeArtifact(),
    closeout: makeEvidence(),
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    pendingArtifactSlotFinal: 'OCCUPIED',
  })

  assert.equal(candidate.closeout.closeoutState, CloseoutState.CLOSEOUT_COMPLETE)
  assert.equal(candidate.closeout.handoffPublicationStatus, 'SUCCEEDED')
  assert.equal(candidate.closeout.factPreservationNotes.includes('MEMOROS_DISABLED_BY_PROJECT_PROFILE'), true)
  assert.equal(candidate.handoff.payload.currentState.includes('closeoutState = CLOSEOUT_COMPLETE'), true)
  assert.equal(candidate.handoff.payload.currentState.includes('PHR_COMPLETION_GATE = REQUIRED'), true)
  assert.equal(candidate.handoff.payload.currentState.includes('PENDING_ARTIFACT_SLOT_FINAL = OCCUPIED'), true)
  assert.equal(candidate.handoff.payload.currentState.includes('PHR_PUBLICATION_POSTCONDITION = SATISFIED_ON_PUBLISHER_SUCCESS'), true)
  assert.equal(candidate.handoff.payload.currentState.includes('FINAL_VERDICT = PASS'), true)
  assert.equal(candidate.handoff.payload.completedWork.includes('Finalized: MEMOROS_DISABLED_BY_PROJECT_PROFILE'), true)
  assert.equal(candidate.closeout.closeoutCompletedAt, '2026-09-14T09:00:00.000Z')
  assert.equal(candidate.closeout.handoffPublicationCompletedAt, '2026-09-14T09:00:00.000Z')
  assert.equal(candidate.handoff.createdAt, '2026-09-14T09:00:00.000Z')
})

test('SpendGuru publishes one optional PHR handoff only after pending clear and preserves final success', () => {
  const artifact = makeSpendGuruArtifact()
  const spendGuruProfile = resolvePmosProjectProfile({ projectName: DEFAULT_PMOS_PROJECT_NAME })
  const statuses = ['PUBLISHED', 'IDEMPOTENT', 'FAILED', 'FAILED_RETRYABLE'] as const

  for (const status of statuses) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `pmos-spendguru-${status.toLowerCase()}-`))
    const pendingArtifactPath = path.join(tempDir, 'pending-artifact.json')
    const sidecarPath = path.join(tempDir, 'phr-sidecar.json')
    fs.writeFileSync(pendingArtifactPath, '{"pending":true}\n', 'utf8')

    const evidence = {
      ...makeEvidence(),
      closeoutState: CloseoutState.CLOSEOUT_COMPLETE,
      closeoutCompletedAt: '2026-09-14T09:03:00.000Z',
      handoffPublicationStatus: 'SUCCEEDED',
      handoffPublicationCompletedAt: '2026-09-14T09:03:00.000Z',
    } as never

    const phaseOrder: string[] = ['memoros-succeeded']
    let publisherCalls = 0

    const optionalPhr = publishOptionalSpendGuruPhrAfterPendingClear({
      pendingArtifactPath,
      artifact,
      closeout: evidence,
      closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
      conversationArtifactPath: 'apps/pmos/.pmos/conversations/test.json',
      sidecarPath,
      repositoryPath: '/tmp/phr',
      projectProfile: spendGuruProfile,
      publicationArtifact: makeSpendGuruFinalizationContext().publicationArtifact,
      publicationAck: makeSpendGuruFinalizationContext().publicationAck,
      clearPendingArtifact: (targetPath) => {
        phaseOrder.push('pending-cleared')
        fs.unlinkSync(targetPath)
      },
      publishPhr: (params) => {
        publisherCalls += 1
        phaseOrder.push('phr-published')
        assert.equal(fs.existsSync(pendingArtifactPath), false)
        assert.equal(params.handoff?.payload.currentState.includes('PENDING_ARTIFACT_SLOT_FINAL = CLEAR'), true)
        assert.equal(params.handoff?.payload.currentState.includes('FINAL_VERDICT = PASS'), true)
        assert.equal(params.handoff?.payload.currentState.includes('MEMOROS Publication: SUCCEEDED'), true)
        return {
          attempted: true,
          attemptedAt: '2026-09-14T09:03:30.000Z',
          result: {
            status,
            retryable: status === 'FAILED_RETRYABLE',
            bundlePath: null,
            manifestPath: null,
            commitSha: null,
            publicationId: artifact.metadata.taskId,
            taskId: artifact.metadata.taskId,
            artifactCount: 5,
            repositoryPath: '/tmp/phr',
            error: status.startsWith('FAILED') ? 'optional downstream failure' : null,
          },
        }
      },
    })

    const finalContext = makeSpendGuruFinalizationContext({
      pendingArtifactSlotFinal: 'CLEAR',
      phrPublicationStatus: status,
    })
    const finalHandoff = buildPhrPublicationReadyHandoff({
      artifact,
      closeout: evidence,
      closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
      finalizationContext: finalContext,
      createdAt: evidence.closeoutCompletedAt,
    })
    const finalSummary = buildConversationArtifactSummary(artifact, evidence, finalContext)

    assert.deepEqual(phaseOrder, ['memoros-succeeded', 'pending-cleared', 'phr-published'])
    assert.equal(fs.existsSync(pendingArtifactPath), false)
    assert.equal(optionalPhr.handoffForPublication.payload.currentState.includes('PENDING_ARTIFACT_SLOT_FINAL = CLEAR'), true)
    assert.equal(optionalPhr.publication.attempted, true)
    assert.equal(optionalPhr.publication.result?.status, status)
    assert.equal(publisherCalls, 1)
    assert.equal(finalHandoff.payload.currentState.includes('PENDING_ARTIFACT_SLOT_FINAL = CLEAR'), true)
    assert.equal(finalSummary.includes('PENDING_ARTIFACT_SLOT_FINAL = CLEAR'), true)
    assert.equal(finalSummary.includes(`PHR Publication: ${status}`), true)
    assert.equal(finalSummary.includes('FINAL_VERDICT = PASS'), true)
    assert.equal(evidence.recoveryRequired, false)
  }

  assert.equal(spendGuruProfile.memorosEnabled, true)
  assert.equal(spendGuruProfile.phrRequiredForCloseout, false)
})

test('PUBLISHED gives final SRM summary and handoff state with PASS and pending CLEAR', () => {
  const artifact = makeArtifact()
  const evidence = makeEvidence()

  applySrmPhrPublicationOutcome({
    evidence,
    publication: { status: 'PUBLISHED', error: null },
    projectName: 'SRM / PORR',
  })

  const summary = buildConversationArtifactSummary(artifact, evidence, makeFinalizationContext('PUBLISHED', 'CLEAR'))
  assert.match(summary, /PHR Publication: PUBLISHED/)
  assert.match(summary, /FINAL_VERDICT = PASS/)
  assert.match(summary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)
  assert.match(summary, /MEMOROS_DISABLED_BY_PROJECT_PROFILE/)
})

test('IDEMPOTENT gives final SRM summary and handoff state with PASS and pending CLEAR', () => {
  const artifact = makeArtifact()
  const evidence = makeEvidence()

  applySrmPhrPublicationOutcome({
    evidence,
    publication: { status: 'IDEMPOTENT', error: null },
    projectName: 'SRM / PORR',
  })

  const summary = buildConversationArtifactSummary(artifact, evidence, makeFinalizationContext('IDEMPOTENT', 'CLEAR'))
  assert.match(summary, /PHR Publication: IDEMPOTENT/)
  assert.match(summary, /FINAL_VERDICT = PASS/)
  assert.match(summary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)
  assert.match(summary, /MEMOROS_DISABLED_BY_PROJECT_PROFILE/)
})

test('successful SRM publication stays OCCUPIED before pending removal and becomes CLEAR only after explicit finalization', () => {
  const artifact = makeArtifact()
  const evidence = makeEvidence()

  applySrmPhrPublicationOutcome({
    evidence,
    publication: { status: 'PUBLISHED', error: null },
    projectName: 'SRM / PORR',
  })

  const preClearSummary = buildConversationArtifactSummary(artifact, evidence, makeFinalizationContext('PUBLISHED', 'OCCUPIED'))
  assert.match(preClearSummary, /FINAL_VERDICT = PASS/)
  assert.match(preClearSummary, /PENDING_ARTIFACT_SLOT_FINAL = OCCUPIED/)
  assert.doesNotMatch(preClearSummary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)

  const postClearSummary = buildConversationArtifactSummary(artifact, evidence, makeFinalizationContext('PUBLISHED', 'CLEAR'))
  assert.match(postClearSummary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)
})

test('SRM retry builds identical publication input and maps to one history bundle with real layout semantics', () => {
  const evidenceOne = makeRetryEvidence({
    closeoutStartedAt: '2026-09-14T09:00:00.000Z',
    pmosSaveStartedAt: '2026-09-14T09:00:10.000Z',
    pmosSaveCompletedAt: '2026-09-14T09:00:20.000Z',
    vectorRebuildStartedAt: '2026-09-14T09:00:30.000Z',
    vectorRebuildCompletedAt: '2026-09-14T09:00:40.000Z',
    handoffPublicationStartedAt: '2026-09-14T09:00:50.000Z',
    pendingArtifactBackupPath: 'pending-attempt-1.json',
    executionTrailPath: 'trail-attempt-1.jsonl',
    executionTrailMarkdownPath: 'trail-attempt-1.md',
    dbRecordId: 'db-record-attempt-1',
    factPreservationNotes: [
      'runtime quarantine: /attempt-1/quarantine/closeout.json',
      'MEMOROS_DISABLED_BY_PROJECT_PROFILE',
      'runtime quarantine: /attempt-1/quarantine/closeout.json',
    ],
    stateHistory: [
      CloseoutState.INITIATED,
      CloseoutState.PENDING_ARTIFACT_CREATED,
      CloseoutState.PENDING_ARTIFACT_VALIDATED,
      CloseoutState.PMOS_SAVE_STARTED,
      CloseoutState.PMOS_SAVE_SUCCEEDED,
      CloseoutState.VECTOR_REBUILD_STARTED,
      CloseoutState.VECTOR_REBUILD_SUCCEEDED,
      CloseoutState.RUNTIME_CONTEXT_VERIFIED,
      CloseoutState.HANDOFF_PUBLICATION_STARTED,
      CloseoutState.HANDOFF_PUBLICATION_STARTED,
    ],
    retryTelemetryProbe: 'attempt-1',
  })
  const evidenceTwo = makeRetryEvidence({
    closeoutStartedAt: '2026-09-14T10:10:00.000Z',
    pmosSaveStartedAt: '2026-09-14T10:10:10.000Z',
    pmosSaveCompletedAt: '2026-09-14T10:10:20.000Z',
    vectorRebuildStartedAt: '2026-09-14T10:10:30.000Z',
    vectorRebuildCompletedAt: '2026-09-14T10:10:40.000Z',
    handoffPublicationStartedAt: '2026-09-14T10:10:50.000Z',
    pendingArtifactBackupPath: 'pending-attempt-2.json',
    executionTrailPath: 'trail-attempt-2.jsonl',
    executionTrailMarkdownPath: 'trail-attempt-2.md',
    dbRecordId: 'db-record-attempt-2',
    factPreservationNotes: [
      'recovery evidence: /attempt-2/recovery/closeout.json',
      'MEMOROS_DISABLED_BY_PROJECT_PROFILE',
    ],
    stateHistory: [
      CloseoutState.HANDOFF_PUBLICATION_STARTED,
      CloseoutState.RUNTIME_CONTEXT_VERIFIED,
      CloseoutState.VECTOR_REBUILD_SUCCEEDED,
      CloseoutState.VECTOR_REBUILD_STARTED,
      CloseoutState.PMOS_SAVE_SUCCEEDED,
      CloseoutState.PMOS_SAVE_STARTED,
      CloseoutState.PENDING_ARTIFACT_VALIDATED,
      CloseoutState.PENDING_ARTIFACT_CREATED,
      CloseoutState.INITIATED,
      CloseoutState.PMOS_SAVE_STARTED,
    ],
    retryTelemetryProbe: 'attempt-2',
  })

  assert.notDeepEqual(evidenceOne, evidenceTwo)
  assert.notEqual(JSON.stringify(evidenceOne).includes('attempt-1'), JSON.stringify(evidenceTwo).includes('attempt-1'))
  assert.notEqual(JSON.stringify(evidenceOne).includes('retryTelemetryProbe'), false)
  assert.notEqual(JSON.stringify(evidenceTwo).includes('retryTelemetryProbe'), false)

  const candidateOne = buildSrmPhrPublicationCandidate({
    artifact: makeArtifact(),
    closeout: evidenceOne,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    pendingArtifactSlotFinal: 'OCCUPIED',
  })
  const candidateTwo = buildSrmPhrPublicationCandidate({
    artifact: makeArtifact(),
    closeout: evidenceTwo,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    pendingArtifactSlotFinal: 'OCCUPIED',
  })

  const publicationOne = buildPhrPublicationInput({
    artifact: makeArtifact(),
    handoff: candidateOne.handoff,
    closeout: candidateOne.closeout,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    conversationArtifactPath: 'apps/pmos/.pmos/conversations/test.json',
  })
  const publicationTwo = buildPhrPublicationInput({
    artifact: makeArtifact(),
    handoff: candidateTwo.handoff,
    closeout: candidateTwo.closeout,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    conversationArtifactPath: 'apps/pmos/.pmos/conversations/test.json',
  })

  assert.deepEqual(candidateOne.closeout, candidateTwo.closeout)
  assert.deepEqual(publicationTwo, publicationOne)

  const serializedPublication = JSON.stringify(publicationOne)
  assert.equal(serializedPublication.includes('attempt-1'), false)
  assert.equal(serializedPublication.includes('attempt-2'), false)
  assert.equal(serializedPublication.includes('retryTelemetryProbe'), false)
  assert.equal(serializedPublication.includes('runtime quarantine:'), false)
  assert.equal(serializedPublication.includes('recovery evidence:'), false)
  assert.deepEqual(candidateOne.closeout.factPreservationNotes, ['MEMOROS_DISABLED_BY_PROJECT_PROFILE'])
  assert.deepEqual(candidateOne.closeout.stateHistory, [
    CloseoutState.INITIATED,
    CloseoutState.PENDING_ARTIFACT_CREATED,
    CloseoutState.PENDING_ARTIFACT_VALIDATED,
    CloseoutState.PMOS_SAVE_STARTED,
    CloseoutState.PMOS_SAVE_SUCCEEDED,
    CloseoutState.VECTOR_REBUILD_STARTED,
    CloseoutState.VECTOR_REBUILD_SUCCEEDED,
    CloseoutState.RUNTIME_CONTEXT_VERIFIED,
    CloseoutState.HANDOFF_PUBLICATION_STARTED,
    CloseoutState.HANDOFF_PUBLICATION_SUCCEEDED,
    CloseoutState.CLOSEOUT_COMPLETE,
  ])

  const { repoPath } = createHistoryLayoutPhrRepo('https://github.com/profitia/project-history-repository.git')
  const first = writePhrPublicationAttempt({ publication: publicationOne, repositoryPath: repoPath })
  const second = writePhrPublicationAttempt({ publication: publicationTwo, repositoryPath: repoPath })
  assert.equal(first.status, 'PUBLISHED')
  assert.equal(second.status, 'IDEMPOTENT')
  assert.equal(first.bundlePath, second.bundlePath)
  assert.match(first.bundlePath ?? '', /history\/2026\/09\/14\/2026-09-14-09-00-00Z__srm-bootstrap-0001$/)

  const conflictingPublication = buildPhrPublicationInput({
    artifact: makeArtifact(),
    handoff: {
      ...candidateOne.handoff,
      payload: {
        ...candidateOne.handoff.payload,
        bridgePayloadText: 'conflicting retry payload',
      },
    } as never,
    closeout: candidateOne.closeout,
    closeoutRef: 'apps/pmos/.pmos/recovery/closeouts/test.closeout.json',
    conversationArtifactPath: 'apps/pmos/.pmos/conversations/test.json',
  })
  const conflict = writePhrPublicationAttempt({ publication: conflictingPublication, repositoryPath: repoPath })
  assert.equal(conflict.status, 'CONFLICT')
})

test('FAILED and FAILED_RETRYABLE do not satisfy the SRM completion gate', () => {
  const failedEvidence = makeEvidence()
  const failed = applySrmPhrPublicationOutcome({
    evidence: failedEvidence,
    publication: { status: 'FAILED', error: 'publish failed' },
    projectName: 'SRM / PORR',
  })

  assert.equal(failed.canCompleteTask, false)
  assert.equal(failed.canClearPending, false)
  assert.equal(failedEvidence.closeoutState, CloseoutState.RECOVERY_REQUIRED)
  assert.equal(failedEvidence.recoveryRequired, true)
  const failedSummary = buildConversationArtifactSummary(makeArtifact(), failedEvidence, makeFinalizationContext('FAILED', 'OCCUPIED'))
  assert.doesNotMatch(failedSummary, /FINAL_VERDICT = PASS/)
  assert.doesNotMatch(failedSummary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)

  const retryableEvidence = makeEvidence()
  const retryable = applySrmPhrPublicationOutcome({
    evidence: retryableEvidence,
    publication: { status: 'FAILED_RETRYABLE', error: 'retry later' },
    projectName: 'SRM / PORR',
  })

  assert.equal(retryable.canCompleteTask, false)
  assert.equal(retryable.canClearPending, false)
  assert.equal(retryableEvidence.closeoutState, CloseoutState.RECOVERY_REQUIRED)
  const retryableSummary = buildConversationArtifactSummary(makeArtifact(), retryableEvidence, makeFinalizationContext('FAILED_RETRYABLE', 'OCCUPIED'))
  assert.doesNotMatch(retryableSummary, /FINAL_VERDICT = PASS/)
  assert.doesNotMatch(retryableSummary, /PENDING_ARTIFACT_SLOT_FINAL = CLEAR/)
})

test('PUBLISHED and IDEMPOTENT satisfy the SRM completion gate and only then allow pending clear', () => {
  const publishedEvidence = makeEvidence()
  const published = applySrmPhrPublicationOutcome({
    evidence: publishedEvidence,
    publication: { status: 'PUBLISHED', error: null },
    projectName: 'SRM / PORR',
  })

  assert.equal(published.canCompleteTask, true)
  assert.equal(published.canClearPending, true)
  assert.equal(publishedEvidence.closeoutState, CloseoutState.CLOSEOUT_COMPLETE)
  assert.equal(publishedEvidence.recoveryRequired, false)

  const idempotentEvidence = makeEvidence()
  const idempotent = applySrmPhrPublicationOutcome({
    evidence: idempotentEvidence,
    publication: { status: 'IDEMPOTENT', error: null },
    projectName: 'SRM / PORR',
  })

  assert.equal(idempotent.canCompleteTask, true)
  assert.equal(idempotent.canClearPending, true)
  assert.equal(idempotentEvidence.closeoutState, CloseoutState.CLOSEOUT_COMPLETE)
})