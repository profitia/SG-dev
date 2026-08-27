import fs from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import { CloseoutState, ExecutionTrailStatus, type FlightRecordMetadata, type FlightRecordV1, type PendingArtifact, validatePendingArtifact } from "../../../../../packages/governance/src/index.js"

import { atomicWriteJsonFile, readJsonFileSafe } from "./atomic-io.js"
import { createCanonicalFlightRecordPayload } from "./flight-record-snapshot.js"

export type BootstrapInput = Omit<FlightRecordV1, "completionEvidence"> & {
  metadata: Omit<FlightRecordMetadata, "timestamp"> & { timestamp?: string }
  completionEvidence?: never
}

export interface PrepareExecutionHandoffParams {
  inputPath: string
  outputPath?: string
  outputDir?: string
}

export interface PreparedExecutionHandoff {
  bootstrapInput: BootstrapInput
  outputPath: string
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_BOOTSTRAP_OUTPUT_DIR = path.resolve(MODULE_DIR, "../../../.pmos/recovery/bootstrap-inputs")

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

function createValidationArtifact(input: BootstrapInput): PendingArtifact {
  return {
    ...input,
    metadata: {
      ...input.metadata,
      timestamp: input.metadata.timestamp ?? new Date().toISOString(),
    },
    completionEvidence: {
      closeoutState: CloseoutState.PENDING_ARTIFACT_CREATED,
      pmosSaveStatus: "NOT_STARTED",
      vectorRebuildStatus: "NOT_STARTED",
      archiveCompletenessStatus: "UNKNOWN",
      executionTrailStatus: ExecutionTrailStatus.MISSING,
    },
  }
}

function assertBootstrapExecutionEvidence(input: BootstrapInput): void {
  if (!Array.isArray(input.findings.findings) || input.findings.findings.length === 0) {
    throw new Error("Execution handoff input must include at least one factual finding. Empty findings are not lawful Stage 4 completion evidence.")
  }
}

function defaultBootstrapFileName(input: BootstrapInput): string {
  const timestamp = input.metadata.timestamp ?? new Date().toISOString()
  const datePart = timestamp.slice(0, 10)
  const slug = input.metadata.taskId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${datePart}_${slug}.json`
}

export function validateBootstrapInputOrThrow(raw: unknown): BootstrapInput {
  assertObject(raw, "Execution handoff input")
  if (Object.hasOwn(raw, "completionEvidence")) {
    throw new Error("Execution handoff input must not provide completionEvidence. Stage 5 preflight owns initial closeout state materialization.")
  }

  const input = createCanonicalFlightRecordPayload(raw) as BootstrapInput
  assertObject(input.metadata, "metadata")
  input.metadata.timestamp = input.metadata.timestamp ?? new Date().toISOString()
  assertBootstrapExecutionEvidence(input)

  const validation = validatePendingArtifact(createValidationArtifact(input))
  if (!validation.valid) {
    throw new Error(`Execution handoff input is not a lawful BootstrapInput: ${validation.errors.join(" | ")}`)
  }

  return input
}

export function readExecutionHandoffInput(inputPath: string): BootstrapInput {
  const resolvedInputPath = path.resolve(inputPath)
  const parsed = readJsonFileSafe<unknown>(resolvedInputPath)
  if (parsed.error || parsed.value === null) {
    throw new Error(`Execution handoff input file is not valid JSON: ${resolvedInputPath}${parsed.error ? ` (${parsed.error})` : ""}`)
  }
  return validateBootstrapInputOrThrow(parsed.value)
}

export function prepareExecutionHandoff(params: PrepareExecutionHandoffParams): PreparedExecutionHandoff {
  const bootstrapInput = readExecutionHandoffInput(params.inputPath)
  const outputDir = params.outputDir ? path.resolve(params.outputDir) : DEFAULT_BOOTSTRAP_OUTPUT_DIR
  const outputPath = path.resolve(params.outputPath ?? path.join(outputDir, defaultBootstrapFileName(bootstrapInput)))

  if (fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite existing bootstrap input artifact: ${outputPath}`)
  }

  atomicWriteJsonFile(outputPath, bootstrapInput, { label: `execution-handoff:${bootstrapInput.metadata.taskId}` })
  return { bootstrapInput, outputPath }
}