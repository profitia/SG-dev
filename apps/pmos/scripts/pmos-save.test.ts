import assert from 'node:assert/strict'
import test from 'node:test'

import { CloseoutState } from '../../../packages/governance/src'

import {
  applySrmPhrPublicationOutcome,
  buildConversationArtifactSummary,
  buildSrmPhrPublicationCandidate,
} from './pmos-save'

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