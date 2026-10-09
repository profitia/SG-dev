import { findHistoricalPmosProjectProfile } from './project-profile'
import { validatePersistedLifecycle, type PersistedLifecycleRow, type PersistedLifecycleSource } from './sg2-immutable-lifecycle'

type FlightRecordLike = {
  metadata: Record<string, unknown>
  task: Record<string, unknown>
  analysis: Record<string, unknown>
  findings: Record<string, unknown>
  decisions: Record<string, unknown>
  actions: Record<string, unknown>
  result: Record<string, unknown>
  completionEvidence: Record<string, unknown>
}

export interface CanonicalConversationReadModel {
  available: boolean
  flightRecord: FlightRecordLike | null
  metadata: {
    conversationId: string | null
    taskId: string | null
    etap: string | null
    subetap: string | null
    scope: string | null
    timestamp: string | null
    conversationType: string | null
    importanceLevel: string | null
  }
  task: {
    originalTaskRequest: string | null
  }
  analysis: {
    executionSummary: string | null
    reasoningSummary: string | null
  }
  findings: {
    findings: string[]
    blockers: string[]
    residualRisks: string[]
  }
  decisions: {
    decisions: string[]
  }
  actions: {
    recommendations: string[]
    validationsExecuted: string[]
    validationsNotExecuted: string[]
    artifactsCreated: string[]
    artifactsModified: string[]
  }
  result: {
    finalStatus: string | null
  }
  completionEvidence: {
    closeoutState: string | null
    pmosSaveStatus: string | null
    runtimeContextRefreshStatus: string | null
    archiveCompletenessStatus: string | null
    executionTrailStatus: string | null
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readCanonicalFlightRecord(value: unknown): FlightRecordLike | null {
  if (!isRecord(value)) return null

  const candidate = value as Record<string, unknown>
  const sections = [
    'metadata',
    'task',
    'analysis',
    'findings',
    'decisions',
    'actions',
    'result',
    'completionEvidence',
  ]

  if (sections.some((section) => !isRecord(candidate[section]))) {
    return null
  }

  return candidate as FlightRecordLike
}

export function buildCanonicalConversationReadModel(value: unknown): CanonicalConversationReadModel {
  const flightRecord = readCanonicalFlightRecord(value)

  if (!flightRecord) {
    return {
      available: false,
      flightRecord: null,
      metadata: {
        conversationId: null,
        taskId: null,
        etap: null,
        subetap: null,
        scope: null,
        timestamp: null,
        conversationType: null,
        importanceLevel: null,
      },
      task: {
        originalTaskRequest: null,
      },
      analysis: {
        executionSummary: null,
        reasoningSummary: null,
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
        recommendations: [],
        validationsExecuted: [],
        validationsNotExecuted: [],
        artifactsCreated: [],
        artifactsModified: [],
      },
      result: {
        finalStatus: null,
      },
      completionEvidence: {
        closeoutState: null,
        pmosSaveStatus: null,
        runtimeContextRefreshStatus: null,
        archiveCompletenessStatus: null,
        executionTrailStatus: null,
      },
    }
  }

  return {
    available: true,
    flightRecord,
    metadata: {
      conversationId: asString(flightRecord.metadata.conversationId),
      taskId: asString(flightRecord.metadata.taskId),
      etap: asString(flightRecord.metadata.etap),
      subetap: asString(flightRecord.metadata.subetap),
      scope: typeof flightRecord.metadata.scope === 'string' ? flightRecord.metadata.scope : null,
      timestamp: asString(flightRecord.metadata.timestamp),
      conversationType: typeof flightRecord.metadata.conversationType === 'string' ? flightRecord.metadata.conversationType : null,
      importanceLevel: typeof flightRecord.metadata.importanceLevel === 'string' ? flightRecord.metadata.importanceLevel : null,
    },
    task: {
      originalTaskRequest: asString(flightRecord.task.originalTaskRequest),
    },
    analysis: {
      executionSummary: asString(flightRecord.analysis.executionSummary),
      reasoningSummary: asString(flightRecord.analysis.reasoningSummary),
    },
    findings: {
      findings: isStringArray(flightRecord.findings.findings) ? flightRecord.findings.findings : [],
      blockers: isStringArray(flightRecord.findings.blockers) ? flightRecord.findings.blockers : [],
      residualRisks: isStringArray(flightRecord.findings.residualRisks) ? flightRecord.findings.residualRisks : [],
    },
    decisions: {
      decisions: isStringArray(flightRecord.decisions.decisions) ? flightRecord.decisions.decisions : [],
    },
    actions: {
      recommendations: isStringArray(flightRecord.actions.recommendations) ? flightRecord.actions.recommendations : [],
      validationsExecuted: isStringArray(flightRecord.actions.validationsExecuted) ? flightRecord.actions.validationsExecuted : [],
      validationsNotExecuted: isStringArray(flightRecord.actions.validationsNotExecuted) ? flightRecord.actions.validationsNotExecuted : [],
      artifactsCreated: isStringArray(flightRecord.actions.artifactsCreated) ? flightRecord.actions.artifactsCreated : [],
      artifactsModified: isStringArray(flightRecord.actions.artifactsModified) ? flightRecord.actions.artifactsModified : [],
    },
    result: {
      finalStatus: typeof flightRecord.result.finalStatus === 'string' ? flightRecord.result.finalStatus : null,
    },
    completionEvidence: {
      closeoutState: typeof flightRecord.completionEvidence.closeoutState === 'string' ? flightRecord.completionEvidence.closeoutState : null,
      pmosSaveStatus: asString(flightRecord.completionEvidence.pmosSaveStatus),
      runtimeContextRefreshStatus: asString(
        flightRecord.completionEvidence.runtimeContextRefreshStatus
          ?? flightRecord.completionEvidence.vectorRebuildStatus,
      ),
      archiveCompletenessStatus: asString(flightRecord.completionEvidence.archiveCompletenessStatus),
      executionTrailStatus: asString(flightRecord.completionEvidence.executionTrailStatus),
    },
  }
}

export interface Sg2LifecycleReadModel {
  mode: 'APPEND_ONLY' | 'HISTORICAL_SNAPSHOT_ONLY'
  currentState: 'CLOSEOUT_COMPLETE' | 'PARTIAL' | 'RECOVERY_REQUIRED' | 'NOT_VERIFIED'
  evidenceIntegrity: 'PASS' | 'FAIL' | 'NOT_VERIFIED'
  verificationScope: 'POSTGRESQL_EVIDENCE_ONLY'
  immutableIntegrity: 'FAIL' | 'NOT_VERIFIED'
  snapshotState: CanonicalConversationReadModel['completionEvidence']
  memorosPublication: 'DELIVERED' | 'NOT_VERIFIED'
  memorosConsumerReadiness: 'NOT_VERIFIED'
  phrPublication: 'PUBLISHED' | 'IDEMPOTENT' | 'NOT_VERIFIED'
  recoveryRequired: boolean
  eventCount: number
  sourceFingerprint: string | null
  historicalException: string | null
  verificationError: string | null
}

// The existing canonical helper remains a point-in-time projection for every
// project. Only SG2 gets an additional current-state view, never a JSON rewrite.
export function buildSg2LifecycleReadModel(source: PersistedLifecycleSource, rows: PersistedLifecycleRow[]): Sg2LifecycleReadModel | null {
  const snapshot = buildCanonicalConversationReadModel(source.flightRecordJson)
  const snapshotProject = snapshot.flightRecord?.metadata.project
  const rowProfile = typeof source.project === 'string' ? findHistoricalPmosProjectProfile(source.project) : null
  const snapshotProfile = typeof snapshotProject === 'string' ? findHistoricalPmosProjectProfile(snapshotProject) : null
  if (rowProfile?.projectKey !== 'SG2' && snapshotProfile?.projectKey !== 'SG2') return null // SRM/CIC unchanged.
  const historicalException = source.taskId === 'SG2-RELEASE-HARDENING-STAGE1-20261008'
    ? 'Canon/audits/sg2-stage1-pmos-integrity-exception-20261009.md' : null
  const model: Sg2LifecycleReadModel = {
    mode: rows.length ? 'APPEND_ONLY' : 'HISTORICAL_SNAPSHOT_ONLY', currentState: 'NOT_VERIFIED',
    evidenceIntegrity: 'NOT_VERIFIED', verificationScope: 'POSTGRESQL_EVIDENCE_ONLY',
    immutableIntegrity: historicalException ? 'FAIL' : 'NOT_VERIFIED', snapshotState: snapshot.completionEvidence,
    memorosPublication: 'NOT_VERIFIED', memorosConsumerReadiness: 'NOT_VERIFIED', phrPublication: 'NOT_VERIFIED',
    recoveryRequired: false, eventCount: rows.length, sourceFingerprint: null, historicalException, verificationError: null,
  }
  try {
    const events = validatePersistedLifecycle(source, rows)
    if (!events.length) return model // Display historical claims with their original source, not new-contract PASS.
    model.evidenceIntegrity = 'PASS'
    model.sourceFingerprint = events[0].source.fingerprint
    model.recoveryRequired = events.some(event => event.step === 'RECOVERY_REQUIRED') && events.at(-1)?.step !== 'CLOSEOUT_COMPLETE'
    model.currentState = events.at(-1)?.step === 'CLOSEOUT_COMPLETE' ? 'CLOSEOUT_COMPLETE'
      : model.recoveryRequired ? 'RECOVERY_REQUIRED' : 'PARTIAL'
    if (events.some(event => event.step === 'MEMOROS_ACK')) model.memorosPublication = 'DELIVERED'
    const phr = events.find(event => event.step === 'PHR_ACK')
    if (phr) model.phrPublication = (phr.receipt as { publication: { result: { status: 'PUBLISHED' | 'IDEMPOTENT' } } }).publication.result.status
    // ACK is delivery proof at publication time, not a current downstream readiness probe.
    return model
  } catch (error) {
    model.evidenceIntegrity = 'FAIL'
    model.verificationError = error instanceof Error ? error.message : 'SG2 lifecycle evidence invalid.'
    return model
  }
}
