import { type FlightRecordV1, validatePendingArtifact } from '../../../../../packages/governance/src'

export interface CanonicalConversationReadModel {
  available: boolean
  flightRecord: FlightRecordV1 | null
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
    vectorRebuildStatus: string | null
    archiveCompletenessStatus: string | null
    executionTrailStatus: string | null
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function readCanonicalFlightRecord(value: unknown): FlightRecordV1 | null {
  if (typeof value !== 'object' || value === null) return null

  const candidate = value as FlightRecordV1
  const validation = validatePendingArtifact(candidate)
  if (!validation.valid) return null

  return candidate
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
        vectorRebuildStatus: null,
        archiveCompletenessStatus: null,
        executionTrailStatus: null,
      },
    }
  }

  return {
    available: true,
    flightRecord,
    metadata: {
      conversationId: flightRecord.metadata.conversationId ?? null,
      taskId: flightRecord.metadata.taskId ?? null,
      etap: flightRecord.metadata.etap ?? null,
      subetap: flightRecord.metadata.subetap ?? null,
      scope: typeof flightRecord.metadata.scope === 'string' ? flightRecord.metadata.scope : null,
      timestamp: flightRecord.metadata.timestamp ?? null,
      conversationType: typeof flightRecord.metadata.conversationType === 'string' ? flightRecord.metadata.conversationType : null,
      importanceLevel: typeof flightRecord.metadata.importanceLevel === 'string' ? flightRecord.metadata.importanceLevel : null,
    },
    task: {
      originalTaskRequest: flightRecord.task.originalTaskRequest ?? null,
    },
    analysis: {
      executionSummary: flightRecord.analysis.executionSummary ?? null,
      reasoningSummary: flightRecord.analysis.reasoningSummary ?? null,
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
      pmosSaveStatus: flightRecord.completionEvidence.pmosSaveStatus ?? null,
      vectorRebuildStatus: flightRecord.completionEvidence.vectorRebuildStatus ?? null,
      archiveCompletenessStatus: flightRecord.completionEvidence.archiveCompletenessStatus ?? null,
      executionTrailStatus: flightRecord.completionEvidence.executionTrailStatus ?? null,
    },
  }
}