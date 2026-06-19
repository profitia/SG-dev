/**
 * Canonical Governance Types — SpendGuru 2.0
 * @package @sg/governance
 */

import {
  ArtifactKind,
  ArtifactNature,
  ArtifactStatus,
  CloseoutState,
  ConversationType,
  DryRunActionType,
  DryRunBlockReason,
  DryRunMode,
  DryRunMutationSurface,
  DryRunScope,
  DryRunVerdict,
  ExecutionTrailEventSeverity,
  ExecutionTrailEventStatus,
  ExecutionTrailEventType,
  ExecutionTrailStatus,
  FactPreservationStatus,
  FlightRecordFinalStatus,
  GovernanceState,
  ImportanceLevel,
  KillSwitchFailureMode,
  ScopeClassification,
  SkillExecutionMode,
  SkillKillSwitchLevel,
} from "../enums/index.js"

// ─────────────────────────────────────────────────────────────────────────────
// Audit Finding
// ─────────────────────────────────────────────────────────────────────────────

export type AuditSeverity = "ERROR" | "WARN" | "INFO" | "OK"

export interface AuditFinding {
  severity: AuditSeverity
  area: string
  message: string
  detail?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance Result
// ─────────────────────────────────────────────────────────────────────────────

export interface GovernanceResult {
  state: GovernanceState
  findings: AuditFinding[]
  errorCount: number
  warnCount: number
  passCount: number
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Flight Record / Pending Artifact V2 (PMOS)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlightRecordMetadata {
  conversationId: string
  project: string
  taskId: string
  etap: string
  scope: ScopeClassification | string
  timestamp: string
  subetap?: string
  conversationType?: ConversationType | string
  importanceLevel?: ImportanceLevel | string
}

export interface FlightRecordTask {
  originalTaskRequest: string
}

export interface FlightRecordAnalysis {
  executionSummary: string
  reasoningSummary: string
}

export interface FlightRecordFindings {
  findings: string[]
  blockers: string[]
  residualRisks: string[]
}

export interface FlightRecordDecisions {
  decisions: string[]
}

export interface FlightRecordActions {
  recommendations: string[]
  validationsExecuted: string[]
  validationsNotExecuted: string[]
  artifactsCreated: string[]
  artifactsModified: string[]
}

export interface FlightRecordResult {
  finalStatus: FlightRecordFinalStatus
}

export interface FlightRecordCompletionEvidence {
  closeoutState: CloseoutState | string
  pmosSaveStatus: CloseoutPhaseStatus
  vectorRebuildStatus: CloseoutPhaseStatus
  archiveCompletenessStatus: ArchiveCompletenessStatus
  executionTrailStatus: ExecutionTrailStatus
}

export interface FlightRecordContextLinks {
  decisionIds?: string[]
  warningIds?: string[]
  nodeIds?: string[]
  logIds?: string[]
  principleIds?: string[]
  promptExecutionIds?: string[]
}

export interface FlightRecordV1 {
  metadata: FlightRecordMetadata
  task: FlightRecordTask
  analysis: FlightRecordAnalysis
  findings: FlightRecordFindings
  decisions: FlightRecordDecisions
  actions: FlightRecordActions
  result: FlightRecordResult
  completionEvidence: FlightRecordCompletionEvidence
  contextLinks?: FlightRecordContextLinks
}

export interface PendingArtifactV2 extends FlightRecordV1 {}

// Backward-compatible exported name for the canonical PMOS input contract.
export type PendingArtifact = PendingArtifactV2

// ─────────────────────────────────────────────────────────────────────────────
// Artifact / GPT Handoff (PMOS)
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtifactSourceRef {
  sourceArtifactKind: ArtifactKind | string
  sourceArtifactRef: string
}

export interface ArtifactRecord<TPayload extends object = Record<string, unknown>> {
  id: string
  artifactKind: ArtifactKind | string
  artifactNature: ArtifactNature | string
  version: string
  status: ArtifactStatus | string
  taskId: string
  conversationId: string
  createdAt: string
  sourceRefs: ArtifactSourceRef[]
  payload: TPayload
}

export interface GptHandoffPayloadV1 {
  originalObjective: string
  resultStatus: string
  currentState?: string[]
  completedWork: string[]
  notCompleted: string[]
  keyFindings: string[]
  decisions: string[]
  blockers: string[]
  residualRisks: string[]
  openQuestions: string[]
  outstandingTopics: string[]
  unresolvedAreas: string[]
  recommendedNextDecision: string
  bridgePayloadText: string
  copyReadyText: string
}

export type GptHandoffArtifactV1 = ArtifactRecord<GptHandoffPayloadV1>

// ─────────────────────────────────────────────────────────────────────────────
// Pending State (PMOS)
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingState {
  activeEtap?: string
  activePipeline?: string
  activeBuildNode?: string
  readinessState?: string
  blockers?: string[]
  risks?: string[]
  nextActions?: string[]
  buildThread?: Array<{ task: string; title: string; status: string }>
  domains?: string[]
  architecturalState?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance Topology Report
// ─────────────────────────────────────────────────────────────────────────────

export interface TopologyReport {
  timestamp: string
  vectorEtapCount: number
  vectorPipelineCount: number
  pmosArtifactCount: number
  orphanEtaps: string[]
  orphanPipelines: string[]
  invalidTasks: string[]
  pmosVectorParity: boolean
  runtimeDrift: boolean
  governanceHealth: GovernanceState
  registryHealth: GovernanceState
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery / Closeout Baseline
// ─────────────────────────────────────────────────────────────────────────────

export type CloseoutPhaseStatus =
  | "NOT_STARTED"
  | "STARTED"
  | "SUCCEEDED"
  | "FAILED"
  | "PARTIAL"
  | "UNKNOWN"

export type ArchiveCompletenessStatus = "PASS" | "WARNING" | "FAIL" | "UNKNOWN"

export type RuntimeContextIntegrityStatus = "PASS" | "FAIL" | "INCONSISTENT" | "UNKNOWN"

export interface CloseoutEvidence {
  closeoutState: CloseoutState
  closeoutStartedAt: string | null
  closeoutCompletedAt: string | null
  pmosSaveStatus: CloseoutPhaseStatus
  pmosSaveStartedAt: string | null
  pmosSaveCompletedAt: string | null
  pmosSaveError: string | null
  pmosSaveArtifactPaths: string[]
  pmosSaveDbRecordId: string | null
  pmosSaveConversationMdPath: string | null
  pmosSaveConversationJsonPath: string | null
  pmosSaveIntegrityPath: string | null
  pmosSaveLockPath: string | null
  vectorRebuildStatus: CloseoutPhaseStatus
  vectorRebuildStartedAt: string | null
  vectorRebuildCompletedAt: string | null
  vectorRebuildError: string | null
  runtimeContextPath: string | null
  runtimeContextIntegrityPath: string | null
  runtimeContextIntegrityStatus: RuntimeContextIntegrityStatus
  runtimeContextVerificationSource: string | null
  archiveCompletenessStatus: ArchiveCompletenessStatus
  archiveCompletenessErrors: string[]
  executionTrailPath: string | null
  executionTrailMarkdownPath: string | null
  executionTrailStatus: ExecutionTrailStatus
  factPreservationStatus: FactPreservationStatus
  factPreservationNotes: string[]
  pendingArtifactBackupPath: string | null
  recoveryRequired: boolean
  recoveryReason: string | null
  manualRecoveryInstructions: string[]
  stateHistory?: CloseoutState[]
}

export interface ActiveCloseoutPointer {
  conversationId: string
  taskId: string
  closeoutEvidencePath: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills Kill Switch
// ─────────────────────────────────────────────────────────────────────────────

export type SkillId =
  | "SKILL_1_CANONICAL_PROMPT_PROTOCOL"
  | "SKILL_2_GOVERNANCE_IMPACT_ANALYZER"
  | "SKILL_3_PMOS_FACT_PRESERVATION_AUDITOR"
  | "SKILL_4_EXECUTION_COMPLIANCE_AUDITOR"

export interface SkillKillSwitchEntry {
  enabled: boolean
  reason: string
  updatedAt: string
  updatedBy: string
}

export interface SkillKillSwitchSkillConfig {
  skillId: SkillId
  mode: SkillExecutionMode
  disabled: boolean
  readOnly: boolean
  dryRunOnly: boolean
  manualApprovalRequired: boolean
  blockedLevels: SkillKillSwitchLevel[]
  notes?: string[]
}

export interface SkillKillSwitchApproval {
  status: "REQUIRED" | "APPROVED" | "NOT_REQUIRED"
  approvedBy: string | null
  approvedAt: string | null
  reference: string | null
}

export interface SkillKillSwitchChangeRecord {
  timestamp: string
  actor: string
  reason: string
  scope: "GLOBAL" | "SKILL"
  affectedSkills: SkillId[] | ["ALL"]
  previousState: string
  newState: string
  approval: SkillKillSwitchApproval
  recordedInPmos: boolean
  closeoutEvidencePath?: string | null
}

export interface SkillKillSwitchConfig {
  version: string
  configId: string
  updatedAt: string
  updatedBy: string
  reason: string
  failureMode: KillSwitchFailureMode
  canonicalContractPath: string
  runtimeConfigPath: string
  humanProtocolPath: string
  defaultMode: SkillExecutionMode
  global: Record<SkillKillSwitchLevel, SkillKillSwitchEntry>
  skills: SkillKillSwitchSkillConfig[]
  manualOverride: {
    allowed: boolean
    canBeSetBy: string[]
    requiresApprovalToDeactivate: boolean
    approval: SkillKillSwitchApproval
  }
  audit: {
    activationRecordedInPmos: boolean
    deactivationRequiresPmosRecord: boolean
    closeoutEvidenceRequired: boolean
    latestChange: SkillKillSwitchChangeRecord
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skills Dry Run
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillDryRunConfig {
  version: string
  configId: string
  updatedAt: string
  updatedBy: string
  reason: string
  dryRunEnabled: boolean
  mode: DryRunMode
  dryRunScope: DryRunScope[]
  linkedKillSwitchConfigPath: string
  linkedRecoveryProtocolPath: string
  linkedFactPreservationAuditPath: string
  failClosedIfConfigUnreadable: boolean
  failClosedIfKillSwitchUnreadable: boolean
  failClosedIfCheckerDisagreement: boolean
  runtimeContextAuthorityAllowed: boolean
  pendingStateAuthorityAllowed: boolean
  blockedWrites: DryRunMutationSurface[]
  allowedReads: string[]
  simulatedActions: DryRunActionType[]
  proposedMutations: DryRunMutationSurface[]
  proposedFiles: string[]
  proposedCommands: string[]
  proposedPMOSWrites: string[]
  proposedVECTORWrites: string[]
  proposedGovernanceWrites: string[]
  proposedRuntimeContextWrites: string[]
  requiredApprovals: string[]
  killSwitchState: string
  recoveryState: string
  factPreservationLimitations: string[]
  finalVerdict: DryRunVerdict
}

export interface SkillDryRunOutput {
  label: "SIMULATION ONLY - NO MUTATIONS EXECUTED"
  taskId: string
  skillId: SkillId
  mode: DryRunMode
  timestamp: string
  sourceOfTruthInputs: string[]
  runtimeContextUsed: boolean
  runtimeContextStatus: string
  killSwitchStatus: string
  recoveryStatus: string
  factPreservationStatus: string
  factPreservationLimitation: boolean
  plannedAction: string
  plannedWrites: string[]
  plannedReads: string[]
  blockedActions: DryRunBlockReason[]
  requiredApprovals: string[]
  wouldModifyFiles: string[]
  wouldModifyPMOS: boolean
  wouldModifyVECTOR: boolean
  wouldModifyGovernance: boolean
  wouldModifyRuntimeContext: boolean
  wouldRunCommands: string[]
  wouldCreatePendingArtifact: boolean
  wouldRunPmosSave: boolean
  wouldRunVectorRebuild: boolean
  risks: string[]
  finalVerdict: DryRunVerdict
  humanDecisionRequired: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// PMOS Fact Preservation / Execution Trail
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionTrailEvent {
  eventId: string
  taskId: string
  timestamp: string
  eventType: ExecutionTrailEventType
  actor: string
  summary: string
  details: string | Record<string, unknown> | null
  relatedFiles: string[]
  relatedCommands: string[]
  status: ExecutionTrailEventStatus
  severity: ExecutionTrailEventSeverity
  correlationId: string
  source: string
}

export interface ExecutionTrailAppendInput {
  baseName: string
  taskId: string
  eventType: ExecutionTrailEventType
  actor?: string
  summary: string
  details?: string | Record<string, unknown> | null
  relatedFiles?: string[]
  relatedCommands?: string[]
  status?: ExecutionTrailEventStatus
  severity?: ExecutionTrailEventSeverity
  correlationId?: string
  source?: string
  timestamp?: string
}

export interface ExecutionTrailPaths {
  jsonlPath: string
  markdownPath: string
}

export interface ExecutionTrailValidationIssue {
  severity: "ERROR" | "WARN"
  message: string
}

export interface ExecutionTrailValidationResult {
  baseName: string
  status: ExecutionTrailStatus
  factPreservationStatus: FactPreservationStatus
  jsonlPath: string
  markdownPath: string
  issues: ExecutionTrailValidationIssue[]
  eventCount: number
  presentEventTypes: ExecutionTrailEventType[]
}
