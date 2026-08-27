/**
 * Canonical Governance Validation — SpendGuru 2.0
 * @package @sg/governance
 *
 * This module is the authority for executable governance validation.
 * The package root re-exports these symbols for consumer convenience only.
 *
 * Hard validation functions. These throw GovernanceError on FAIL — not warnings.
 *
 * Usage:
 *   import { assertCanonicalEtap } from "@sg/governance/validation"
 *   assertCanonicalEtap(etapName) // throws if invalid
 */

import {
  CANONICAL_ETAP_NAMES,
  CANONICAL_PIPELINE_NAMES,
  CANONICAL_ROADMAP_POSITIONS,
  CANONICAL_READINESS_STATES,
  CANONICAL_SCOPE_CLASSIFICATIONS,
  LEGACY_ETAP_PREFIXES,
} from "../registries/index.js"
import {
  CloseoutState,
  ArtifactKind,
  ArtifactNature,
  ArtifactStatus,
  ConversationType,
  ExecutionTrailEventSeverity,
  ExecutionTrailEventStatus,
  ExecutionTrailEventType,
  ExecutionTrailStatus,
  ImportanceLevel,
  FlightRecordFinalStatus,
  GovernanceState,
  ScopeClassification,
} from "../enums/index.js"
import type {
  ArtifactRecord,
  AuditFinding,
  ExecutionTrailEvent,
  GptHandoffArtifactV1,
  GovernanceResult,
  PendingArtifact,
  PendingState,
} from "../types/index.js"

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceError — hard fail signal
// ─────────────────────────────────────────────────────────────────────────────

export class GovernanceError extends Error {
  constructor(
    public readonly area: string,
    message: string,
    public readonly detail?: string
  ) {
    super(`[GOVERNANCE FAIL] [${area}] ${message}${detail ? ` → ${detail}` : ""}`)
    this.name = "GovernanceError"
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-value validators (hard fail)
// ─────────────────────────────────────────────────────────────────────────────

export function assertCanonicalEtap(etapName: string, area = "ETAP"): void {
  if (!CANONICAL_ETAP_NAMES.has(etapName)) {
    throw new GovernanceError(
      area,
      `Invalid ETAP name: "${etapName}"`,
      `Valid ETAPs: ${[...CANONICAL_ETAP_NAMES].join(", ")}`
    )
  }
}

export function assertCanonicalPipeline(pipelineName: string, area = "PIPELINE"): void {
  if (!CANONICAL_PIPELINE_NAMES.has(pipelineName)) {
    throw new GovernanceError(
      area,
      `Invalid pipeline: "${pipelineName}"`,
      `Valid pipelines: ${[...CANONICAL_PIPELINE_NAMES].join(", ")}`
    )
  }
}

export function assertCanonicalRoadmapPosition(position: string, area = "ROADMAP_POSITION"): void {
  if (!CANONICAL_ROADMAP_POSITIONS.has(position)) {
    throw new GovernanceError(
      area,
      `Invalid roadmapPosition: "${position}"`,
      `Valid positions: ${[...CANONICAL_ROADMAP_POSITIONS].join(", ")}`
    )
  }
}

export function assertCanonicalReadiness(readiness: string, area = "READINESS"): void {
  if (!CANONICAL_READINESS_STATES.has(readiness)) {
    throw new GovernanceError(
      area,
      `Invalid readiness state: "${readiness}"`,
      `Valid states: ${[...CANONICAL_READINESS_STATES].join(", ")}`
    )
  }
}

export function assertCanonicalConversationType(type: string, area = "CONVERSATION_TYPE"): void {
  const valid = Object.values(ConversationType) as string[]
  if (!valid.includes(type)) {
    throw new GovernanceError(
      area,
      `Invalid conversationType: "${type}"`,
      `Valid types: ${valid.join(", ")}`
    )
  }
}

export function assertCanonicalImportanceLevel(level: string, area = "IMPORTANCE_LEVEL"): void {
  const valid = Object.values(ImportanceLevel) as string[]
  if (!valid.includes(level)) {
    throw new GovernanceError(
      area,
      `Invalid importanceLevel: "${level}"`,
      `Valid levels: ${valid.join(", ")}`
    )
  }
}

export function assertCanonicalScopeClassification(scope: string, area = "SCOPE"): void {
  const valid = Object.values(ScopeClassification) as string[]
  if (!valid.includes(scope)) {
    throw new GovernanceError(
      area,
      `Invalid scope: "${scope}"`,
      `Valid scope classifications: ${valid.join(", ")}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Soft validators (return boolean, for audit scripts)
// ─────────────────────────────────────────────────────────────────────────────

export function isCanonicalEtap(name: string): boolean {
  return CANONICAL_ETAP_NAMES.has(name)
}

export function isCanonicalPipeline(name: string): boolean {
  return CANONICAL_PIPELINE_NAMES.has(name)
}

export function isCanonicalRoadmapPosition(position: string): boolean {
  return CANONICAL_ROADMAP_POSITIONS.has(position)
}

export function isCanonicalReadiness(readiness: string): boolean {
  return CANONICAL_READINESS_STATES.has(readiness)
}

export function isLegacyEtap(name: string): boolean {
  return LEGACY_ETAP_PREFIXES.some((prefix) => name.startsWith(prefix))
}

export function isCanonicalScopeClassification(scope: string): boolean {
  return CANONICAL_SCOPE_CLASSIFICATIONS.has(scope)
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite validators — pending-artifact.json
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingArtifactValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePendingArtifact(artifact: PendingArtifact): PendingArtifactValidationResult {
  const errors: string[] = []

  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
  const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
  const validateStringArray = (value: unknown, field: string): void => {
    if (!Array.isArray(value)) {
      errors.push(`${field} must be an array`)
      return
    }
    value.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`${field}[${index}] must be a non-empty string`)
      }
    })
  }

  if (!isObject(artifact.metadata)) {
    errors.push("metadata is required and must be an object")
  } else {
    if (!isNonEmptyString(artifact.metadata.conversationId)) errors.push("metadata.conversationId is required")
    if (!isNonEmptyString(artifact.metadata.timestamp)) {
      errors.push("metadata.timestamp is required")
    } else if (Number.isNaN(new Date(artifact.metadata.timestamp).getTime())) {
      errors.push(`metadata.timestamp is invalid: ${artifact.metadata.timestamp}`)
    }
    if (!isNonEmptyString(artifact.metadata.project)) errors.push("metadata.project is required")
    if (!isNonEmptyString(artifact.metadata.taskId)) errors.push("metadata.taskId is required")
    if (!isNonEmptyString(artifact.metadata.etap)) {
      errors.push("metadata.etap is required")
    } else if (!isCanonicalEtap(artifact.metadata.etap)) {
      errors.push(`metadata.etap "${artifact.metadata.etap}" is not a canonical ETAP name`)
    }

    if (!isNonEmptyString(artifact.metadata.scope)) {
      errors.push("metadata.scope is required")
    } else if (!isCanonicalScopeClassification(artifact.metadata.scope)) {
      errors.push(`metadata.scope "${artifact.metadata.scope}" is invalid — valid: ${[...CANONICAL_SCOPE_CLASSIFICATIONS].join(", ")}`)
    }

    if (
      artifact.metadata.conversationType !== undefined &&
      !(Object.values(ConversationType) as string[]).includes(String(artifact.metadata.conversationType))
    ) {
      errors.push(`metadata.conversationType "${String(artifact.metadata.conversationType)}" is invalid — valid: ${(Object.values(ConversationType) as string[]).join(", ")}`)
    }

    if (
      artifact.metadata.importanceLevel !== undefined &&
      !(Object.values(ImportanceLevel) as string[]).includes(String(artifact.metadata.importanceLevel))
    ) {
      errors.push(`metadata.importanceLevel "${String(artifact.metadata.importanceLevel)}" is invalid — valid: ${(Object.values(ImportanceLevel) as string[]).join(", ")}`)
    }
  }

  if (!isObject(artifact.task)) {
    errors.push("task is required and must be an object")
  } else if (!isNonEmptyString(artifact.task.originalTaskRequest)) {
    errors.push("task.originalTaskRequest is required")
  }

  if (!isObject(artifact.analysis)) {
    errors.push("analysis is required and must be an object")
  } else {
    if (!isNonEmptyString(artifact.analysis.executionSummary)) {
      errors.push("analysis.executionSummary is required")
    }
    if (!isNonEmptyString(artifact.analysis.reasoningSummary)) {
      errors.push("analysis.reasoningSummary is required")
    }
  }

  if (!isObject(artifact.findings)) {
    errors.push("findings is required and must be an object")
  } else {
    validateStringArray(artifact.findings.findings, "findings.findings")
    validateStringArray(artifact.findings.blockers, "findings.blockers")
    validateStringArray(artifact.findings.residualRisks, "findings.residualRisks")
  }

  if (!isObject(artifact.decisions)) {
    errors.push("decisions is required and must be an object")
  } else {
    validateStringArray(artifact.decisions.decisions, "decisions.decisions")
  }

  if (!isObject(artifact.actions)) {
    errors.push("actions is required and must be an object")
  } else {
    validateStringArray(artifact.actions.recommendations, "actions.recommendations")
    validateStringArray(artifact.actions.validationsExecuted, "actions.validationsExecuted")
    validateStringArray(artifact.actions.validationsNotExecuted, "actions.validationsNotExecuted")
    validateStringArray(artifact.actions.artifactsCreated, "actions.artifactsCreated")
    validateStringArray(artifact.actions.artifactsModified, "actions.artifactsModified")
  }

  if (!isObject(artifact.result)) {
    errors.push("result is required and must be an object")
  } else if (!(Object.values(FlightRecordFinalStatus) as string[]).includes(String(artifact.result.finalStatus))) {
    errors.push(`result.finalStatus "${String(artifact.result.finalStatus)}" is invalid — valid: ${(Object.values(FlightRecordFinalStatus) as string[]).join(", ")}`)
  }

  if (!isObject(artifact.completionEvidence)) {
    errors.push("completionEvidence is required and must be an object")
  } else {
    const closeoutStateValues = Object.values(CloseoutState) as string[]
    const phaseStatusValues = ["NOT_STARTED", "STARTED", "SUCCEEDED", "FAILED", "PARTIAL", "UNKNOWN"]
    const archiveStatusValues = ["PASS", "WARNING", "FAIL", "UNKNOWN"]
    const executionTrailStatusValues = Object.values(ExecutionTrailStatus) as string[]

    if (!isNonEmptyString(artifact.completionEvidence.closeoutState)) {
      errors.push("completionEvidence.closeoutState is required")
    } else if (!closeoutStateValues.includes(artifact.completionEvidence.closeoutState)) {
      errors.push(`completionEvidence.closeoutState "${artifact.completionEvidence.closeoutState}" is invalid — valid: ${closeoutStateValues.join(", ")}`)
    }

    if (!isNonEmptyString(artifact.completionEvidence.pmosSaveStatus)) {
      errors.push("completionEvidence.pmosSaveStatus is required")
    } else if (!phaseStatusValues.includes(artifact.completionEvidence.pmosSaveStatus)) {
      errors.push(`completionEvidence.pmosSaveStatus "${artifact.completionEvidence.pmosSaveStatus}" is invalid — valid: ${phaseStatusValues.join(", ")}`)
    }

    if (!isNonEmptyString(artifact.completionEvidence.vectorRebuildStatus)) {
      errors.push("completionEvidence.vectorRebuildStatus is required")
    } else if (!phaseStatusValues.includes(artifact.completionEvidence.vectorRebuildStatus)) {
      errors.push(`completionEvidence.vectorRebuildStatus "${artifact.completionEvidence.vectorRebuildStatus}" is invalid — valid: ${phaseStatusValues.join(", ")}`)
    }

    if (!isNonEmptyString(artifact.completionEvidence.archiveCompletenessStatus)) {
      errors.push("completionEvidence.archiveCompletenessStatus is required")
    } else if (!archiveStatusValues.includes(artifact.completionEvidence.archiveCompletenessStatus)) {
      errors.push(`completionEvidence.archiveCompletenessStatus "${artifact.completionEvidence.archiveCompletenessStatus}" is invalid — valid: ${archiveStatusValues.join(", ")}`)
    }

    if (!isNonEmptyString(artifact.completionEvidence.executionTrailStatus)) {
      errors.push("completionEvidence.executionTrailStatus is required")
    } else if (!executionTrailStatusValues.includes(artifact.completionEvidence.executionTrailStatus)) {
      errors.push(`completionEvidence.executionTrailStatus "${artifact.completionEvidence.executionTrailStatus}" is invalid — valid: ${executionTrailStatusValues.join(", ")}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite validators — pending-state.json
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingStateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact validators
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtifactValidationResult {
  valid: boolean
  errors: string[]
}

export function validateArtifactRecord<TPayload extends object>(artifact: ArtifactRecord<TPayload>): ArtifactValidationResult {
  const errors: string[] = []

  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
  const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
  const validateStringArray = (value: unknown, field: string): void => {
    if (!Array.isArray(value)) {
      errors.push(`${field} must be an array`)
      return
    }
    value.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`${field}[${index}] must be a non-empty string`)
      }
    })
  }

  if (!isNonEmptyString(artifact.id)) errors.push("id is required")
  if (!isNonEmptyString(artifact.taskId)) errors.push("taskId is required")
  if (!isNonEmptyString(artifact.conversationId)) errors.push("conversationId is required")
  if (!isNonEmptyString(artifact.version)) errors.push("version is required")

  if (!isNonEmptyString(artifact.createdAt)) {
    errors.push("createdAt is required")
  } else if (Number.isNaN(new Date(artifact.createdAt).getTime())) {
    errors.push(`createdAt is invalid: ${artifact.createdAt}`)
  }

  if (!(Object.values(ArtifactKind) as string[]).includes(String(artifact.artifactKind))) {
    errors.push(`artifactKind \"${String(artifact.artifactKind)}\" is invalid — valid: ${(Object.values(ArtifactKind) as string[]).join(", ")}`)
  }

  if (!(Object.values(ArtifactNature) as string[]).includes(String(artifact.artifactNature))) {
    errors.push(`artifactNature \"${String(artifact.artifactNature)}\" is invalid — valid: ${(Object.values(ArtifactNature) as string[]).join(", ")}`)
  }

  if (!(Object.values(ArtifactStatus) as string[]).includes(String(artifact.status))) {
    errors.push(`status \"${String(artifact.status)}\" is invalid — valid: ${(Object.values(ArtifactStatus) as string[]).join(", ")}`)
  }

  if (!Array.isArray(artifact.sourceRefs) || artifact.sourceRefs.length === 0) {
    errors.push("sourceRefs must be a non-empty array")
  } else {
    artifact.sourceRefs.forEach((sourceRef, index) => {
      if (!isObject(sourceRef)) {
        errors.push(`sourceRefs[${index}] must be an object`)
        return
      }
      if (!isNonEmptyString(sourceRef.sourceArtifactKind)) {
        errors.push(`sourceRefs[${index}].sourceArtifactKind is required`)
      }
      if (!isNonEmptyString(sourceRef.sourceArtifactRef)) {
        errors.push(`sourceRefs[${index}].sourceArtifactRef is required`)
      }
    })
  }

  if (!isObject(artifact.payload)) {
    errors.push("payload must be an object")
  }

  return { valid: errors.length === 0, errors }
}

export function validateGptHandoffArtifact(artifact: GptHandoffArtifactV1): ArtifactValidationResult {
  const base = validateArtifactRecord(artifact)
  const errors = [...base.errors]

  const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
  const validateStringArray = (value: unknown, field: string): void => {
    if (!Array.isArray(value)) {
      errors.push(`${field} must be an array`)
      return
    }
    value.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`${field}[${index}] must be a non-empty string`)
      }
    })
  }

  if (String(artifact.artifactKind) !== ArtifactKind.HANDOFF) {
    errors.push(`artifactKind must be ${ArtifactKind.HANDOFF}`)
  }
  if (String(artifact.artifactNature) !== ArtifactNature.DERIVED) {
    errors.push(`artifactNature must be ${ArtifactNature.DERIVED}`)
  }

  const closeoutSourceRef = Array.isArray(artifact.sourceRefs)
    ? artifact.sourceRefs.find((sourceRef) => sourceRef.sourceArtifactKind === ArtifactKind.CLOSEOUT)
    : null
  if (!closeoutSourceRef) {
    errors.push(`sourceRefs must include ${ArtifactKind.CLOSEOUT}`)
  }

  if (!artifact.payload || typeof artifact.payload !== "object") {
    errors.push("payload must be an object")
  } else {
    if (!isNonEmptyString(artifact.payload.originalObjective)) {
      errors.push("payload.originalObjective is required")
    }
    if (!isNonEmptyString(artifact.payload.resultStatus)) {
      errors.push("payload.resultStatus is required")
    }
    if (artifact.payload.currentState !== undefined) {
      validateStringArray(artifact.payload.currentState, "payload.currentState")
    }
    validateStringArray(artifact.payload.completedWork, "payload.completedWork")
    validateStringArray(artifact.payload.notCompleted, "payload.notCompleted")
    validateStringArray(artifact.payload.keyFindings, "payload.keyFindings")
    validateStringArray(artifact.payload.decisions, "payload.decisions")
    validateStringArray(artifact.payload.blockers, "payload.blockers")
    validateStringArray(artifact.payload.residualRisks, "payload.residualRisks")
    validateStringArray(artifact.payload.openQuestions, "payload.openQuestions")
    validateStringArray(artifact.payload.outstandingTopics, "payload.outstandingTopics")
    validateStringArray(artifact.payload.unresolvedAreas, "payload.unresolvedAreas")
    if (!isNonEmptyString(artifact.payload.recommendedNextDecision)) {
      errors.push("payload.recommendedNextDecision is required")
    }
    if (!isNonEmptyString(artifact.payload.bridgePayloadText)) {
      errors.push("payload.bridgePayloadText is required")
    }
    if (!isNonEmptyString(artifact.payload.copyReadyText)) {
      errors.push("payload.copyReadyText is required")
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validatePendingState(state: PendingState): PendingStateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (state.activeEtap && state.activeEtap !== "Unknown") {
    if (!isCanonicalEtap(state.activeEtap)) {
      errors.push(`activeEtap "${state.activeEtap}" is not a canonical ETAP`)
    }
  }

  if (state.activePipeline && !isCanonicalPipeline(state.activePipeline)) {
    errors.push(`activePipeline "${state.activePipeline}" is not a canonical pipeline`)
  }

  if (!state.activeEtap) warnings.push("activeEtap is not set in pending-state.json")
  if (!state.activePipeline) warnings.push("activePipeline is not set in pending-state.json")

  return { valid: errors.length === 0, errors, warnings }
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution trail validators
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionTrailEventValidationResult {
  valid: boolean
  errors: string[]
}

export function validateExecutionTrailEvent(event: ExecutionTrailEvent): ExecutionTrailEventValidationResult {
  const errors: string[] = []

  if (!event.eventId) errors.push("eventId is required")
  if (!event.taskId) errors.push("taskId is required")
  if (!event.timestamp) {
    errors.push("timestamp is required")
  } else if (Number.isNaN(new Date(event.timestamp).getTime())) {
    errors.push(`timestamp is invalid: ${event.timestamp}`)
  }

  const validEventTypes = Object.values(ExecutionTrailEventType) as string[]
  if (!event.eventType || !validEventTypes.includes(event.eventType)) {
    errors.push(`eventType \"${event.eventType}\" is invalid — valid: ${validEventTypes.join(", ")}`)
  }

  if (!event.actor) errors.push("actor is required")
  if (!event.summary) errors.push("summary is required")

  const validStatuses = Object.values(ExecutionTrailEventStatus) as string[]
  if (!event.status || !validStatuses.includes(event.status)) {
    errors.push(`status \"${event.status}\" is invalid — valid: ${validStatuses.join(", ")}`)
  }

  const validSeverities = Object.values(ExecutionTrailEventSeverity) as string[]
  if (!event.severity || !validSeverities.includes(event.severity)) {
    errors.push(`severity \"${event.severity}\" is invalid — valid: ${validSeverities.join(", ")}`)
  }

  if (!event.correlationId) errors.push("correlationId is required")
  if (!event.source) errors.push("source is required")
  if (!Array.isArray(event.relatedFiles)) errors.push("relatedFiles must be an array")
  if (!Array.isArray(event.relatedCommands)) errors.push("relatedCommands must be an array")

  const forbiddenKeys = ["chainOfThought", "privateReasoning", "thoughts", "hiddenReasoning"]
  if (event.details && typeof event.details === "object") {
    for (const key of forbiddenKeys) {
      if (key in event.details) {
        errors.push(`details must not contain private reasoning field: ${key}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance result builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildGovernanceResult(findings: AuditFinding[]): GovernanceResult {
  const errorCount = findings.filter((f) => f.severity === "ERROR").length
  const warnCount = findings.filter((f) => f.severity === "WARN").length
  const passCount = findings.filter((f) => f.severity === "OK").length

  let state: GovernanceState
  if (errorCount > 0) {
    state = GovernanceState.FAIL
  } else if (warnCount > 0) {
    state = GovernanceState.WARNING
  } else {
    state = GovernanceState.VALID
  }

  return {
    state,
    findings,
    errorCount,
    warnCount,
    passCount,
    timestamp: new Date().toISOString(),
  }
}
