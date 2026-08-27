export const INTEGRITY_VERSION = "1.0" as const

export interface IntegrityMetadata {
  readonly integrityVersion: typeof INTEGRITY_VERSION
  readonly generatedAt: string
  readonly generatedBy: string
  readonly sourceRuntime: string
  readonly sourceProjection: string
  readonly contentHash: string
  readonly canonicalHash: string
}

export interface ArtifactLockMetadata {
  readonly immutable: true
  readonly immutableSince: string
  readonly integrityHash: string
}

export type IntegrityStatus = "PASS" | "WARNING" | "FAIL"

export interface IntegrityFinding {
  readonly severity: "ERROR" | "WARN" | "INFO" | "OK"
  readonly area: string
  readonly message: string
  readonly detail?: string
}

export interface IntegrityResult {
  readonly valid: boolean
  readonly status: IntegrityStatus
  readonly contentHashMatch: boolean
  readonly canonicalHashMatch: boolean
  readonly findings: IntegrityFinding[]
  readonly computedContentHash: string
  readonly storedContentHash: string
  readonly computedCanonicalHash: string
  readonly storedCanonicalHash: string
}

export interface ArtifactLockResult {
  readonly valid: boolean
  readonly status: IntegrityStatus
  readonly mutationDetected: boolean
  readonly finding: IntegrityFinding
  readonly computedHash: string
  readonly storedHash: string
}

export interface ProjectionDeterminismResult {
  readonly deterministic: boolean
  readonly hash1: string
  readonly hash2: string
  readonly driftDetected: boolean
  readonly finding: IntegrityFinding
}