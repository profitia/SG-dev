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
    vectorRebuildStatus: string | null
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
      vectorRebuildStatus: asString(flightRecord.completionEvidence.vectorRebuildStatus),
      archiveCompletenessStatus: asString(flightRecord.completionEvidence.archiveCompletenessStatus),
      executionTrailStatus: asString(flightRecord.completionEvidence.executionTrailStatus),
    },
  }
}