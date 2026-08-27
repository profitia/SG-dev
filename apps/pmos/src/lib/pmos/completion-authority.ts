import fs from "node:fs"
import path from "node:path"

import { CloseoutState, ExecutionTrailStatus, type PendingArtifact } from "../../../../../packages/governance/src/index.js"

import { atomicWriteJsonFile, readJsonFileSafe } from "./atomic-io.js"
import { createCanonicalFlightRecordPayload } from "./flight-record-snapshot.js"
import { type BootstrapInput, validateBootstrapInputOrThrow } from "./execution-handoff.js"

type PendingArtifactState = { kind: "MISSING" } | { kind: "EMPTY" } | { kind: "OCCUPIED" } | { kind: "INVALID" }

type MaterializePendingArtifactParams = {
  bootstrapInputPath: string
  pendingFilePath: string
}

export function readBootstrapInput(bootstrapInputPath: string): BootstrapInput {
  const resolvedInputPath = path.resolve(bootstrapInputPath)
  const parsed = readJsonFileSafe<unknown>(resolvedInputPath)
  if (parsed.error || !parsed.value) {
    throw new Error(`Bootstrap input file is not valid JSON: ${resolvedInputPath}${parsed.error ? ` (${parsed.error})` : ""}`)
  }
  return validateBootstrapInputOrThrow(parsed.value)
}

function resolvePendingArtifactState(filePath: string): PendingArtifactState {
  if (!fs.existsSync(filePath)) return { kind: "MISSING" }

  const raw = fs.readFileSync(filePath, "utf-8").trim()
  if (raw.length === 0) return { kind: "EMPTY" }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return { kind: "INVALID" }
    return Object.keys(parsed).length === 0 ? { kind: "EMPTY" } : { kind: "OCCUPIED" }
  } catch {
    return { kind: "INVALID" }
  }
}

function buildPendingArtifact(input: BootstrapInput): PendingArtifact {
  const artifact: PendingArtifact = {
    ...input,
    metadata: {
      ...input.metadata,
      timestamp: new Date().toISOString(),
    },
    completionEvidence: {
      closeoutState: CloseoutState.PENDING_ARTIFACT_CREATED,
      pmosSaveStatus: "NOT_STARTED",
      vectorRebuildStatus: "NOT_STARTED",
      archiveCompletenessStatus: "UNKNOWN",
      executionTrailStatus: ExecutionTrailStatus.MISSING,
    },
  }

  return createCanonicalFlightRecordPayload(artifact)
}

export function validatePendingSlot(filePath: string): void {
  const state = resolvePendingArtifactState(filePath)
  if (state.kind === "MISSING" || state.kind === "EMPTY") return
  if (state.kind === "INVALID") {
    throw new Error(`Pending artifact slot is malformed and cannot be reused safely: ${filePath}`)
  }
  throw new Error(`Pending artifact slot is already occupied by another live task: ${filePath}`)
}

export function materializePendingArtifactFromBootstrap(params: MaterializePendingArtifactParams): PendingArtifact {
  const input = readBootstrapInput(params.bootstrapInputPath)
  validatePendingSlot(params.pendingFilePath)
  const artifact = buildPendingArtifact(input)
  atomicWriteJsonFile(params.pendingFilePath, artifact, { label: `completion-authority:${artifact.metadata.taskId}` })
  return artifact
}