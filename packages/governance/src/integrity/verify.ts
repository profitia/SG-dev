import { CANONICAL_ETAPS, CANONICAL_PIPELINES } from "../registries/index.js"
import type { ArtifactLockMetadata, ArtifactLockResult, IntegrityFinding, IntegrityMetadata, IntegrityResult, IntegrityStatus, ProjectionDeterminismResult } from "./types.js"
import { computeCanonicalGovernanceHash, hashObject, hashText } from "./hash.js"

function resolveStatus(contentMatch: boolean, canonicalMatch: boolean): IntegrityStatus {
  if (!contentMatch) return "FAIL"
  if (!canonicalMatch) return "WARNING"
  return "PASS"
}

export function verifyTextIntegrity(content: string, metadata: IntegrityMetadata): IntegrityResult {
  const findings: IntegrityFinding[] = []
  const computedContentHash = hashText(content)
  const computedCanonicalHash = computeCanonicalGovernanceHash()
  const contentHashMatch = computedContentHash === metadata.contentHash
  const canonicalHashMatch = computedCanonicalHash === metadata.canonicalHash

  findings.push(contentHashMatch
    ? { severity: "OK", area: "CONTENT_INTEGRITY", message: "Content hash verified — artifact intact", detail: `sha256: ${computedContentHash}` }
    : { severity: "ERROR", area: "CONTENT_INTEGRITY", message: "Content hash MISMATCH — artifact may have been tampered with", detail: `Expected: ${metadata.contentHash}\nActual:   ${computedContentHash}` })

  findings.push(canonicalHashMatch
    ? { severity: "OK", area: "CANONICAL_HASH", message: "Canonical governance hash matches — artifact is from current governance version" }
    : { severity: "WARN", area: "CANONICAL_HASH", message: "Canonical governance hash DRIFT — governance package updated since artifact generation", detail: `Artifact: ${metadata.canonicalHash}\nCurrent:  ${computedCanonicalHash}` })

  return {
    valid: contentHashMatch,
    status: resolveStatus(contentHashMatch, canonicalHashMatch),
    contentHashMatch,
    canonicalHashMatch,
    findings,
    computedContentHash,
    storedContentHash: metadata.contentHash,
    computedCanonicalHash,
    storedCanonicalHash: metadata.canonicalHash,
  }
}

export function verifyObjectIntegrity(obj: unknown, metadata: IntegrityMetadata): IntegrityResult {
  const findings: IntegrityFinding[] = []
  const computedContentHash = hashObject(obj)
  const computedCanonicalHash = computeCanonicalGovernanceHash()
  const contentHashMatch = computedContentHash === metadata.contentHash
  const canonicalHashMatch = computedCanonicalHash === metadata.canonicalHash

  findings.push(contentHashMatch
    ? { severity: "OK", area: "CONTENT_INTEGRITY", message: "Object integrity verified — no mutation detected" }
    : { severity: "ERROR", area: "CONTENT_INTEGRITY", message: "Object integrity MISMATCH — artifact content has changed", detail: `Expected: ${metadata.contentHash}\nActual:   ${computedContentHash}` })

  findings.push(canonicalHashMatch
    ? { severity: "OK", area: "CANONICAL_HASH", message: "Canonical governance hash matches" }
    : { severity: "WARN", area: "CANONICAL_HASH", message: "Canonical governance hash DRIFT — governance updated since artifact generation", detail: `Artifact: ${metadata.canonicalHash}\nCurrent:  ${computedCanonicalHash}` })

  return {
    valid: contentHashMatch,
    status: resolveStatus(contentHashMatch, canonicalHashMatch),
    contentHashMatch,
    canonicalHashMatch,
    findings,
    computedContentHash,
    storedContentHash: metadata.contentHash,
    computedCanonicalHash,
    storedCanonicalHash: metadata.canonicalHash,
  }
}

export function verifyArtifactLock(artifactContent: unknown, lock: ArtifactLockMetadata): ArtifactLockResult {
  const computedHash = hashObject(artifactContent)
  const mutationDetected = computedHash !== lock.integrityHash

  if (!mutationDetected) {
    return {
      valid: true,
      status: "PASS",
      mutationDetected: false,
      finding: {
        severity: "OK",
        area: "ARTIFACT_LOCK",
        message: "Artifact lock verified — no mutation since lock",
        detail: `Locked: ${lock.immutableSince} | sha256: ${computedHash}`,
      },
      computedHash,
      storedHash: lock.integrityHash,
    }
  }

  return {
    valid: false,
    status: "FAIL",
    mutationDetected: true,
    finding: {
      severity: "ERROR",
      area: "ARTIFACT_LOCK",
      message: "ARTIFACT MUTATION DETECTED — artifact content changed after lock",
      detail: `Locked: ${lock.immutableSince}\nExpected: ${lock.integrityHash}\nActual:   ${computedHash}`,
    },
    computedHash,
    storedHash: lock.integrityHash,
  }
}

export interface GovernanceIntegrityResult {
  valid: boolean
  status: IntegrityStatus
  canonicalHash: string
  findings: IntegrityFinding[]
}

export function verifyGovernanceIntegrity(): GovernanceIntegrityResult {
  const findings: IntegrityFinding[] = []
  let hasError = false

  if (!CANONICAL_ETAPS.length) {
    findings.push({ severity: "ERROR", area: "ETAP_REGISTRY", message: "CANONICAL_ETAPS is empty" })
    hasError = true
  }

  if (!CANONICAL_PIPELINES.length) {
    findings.push({ severity: "ERROR", area: "PIPELINE_REGISTRY", message: "CANONICAL_PIPELINES is empty" })
    hasError = true
  }

  const canonicalHash = computeCanonicalGovernanceHash()
  findings.push({ severity: hasError ? "ERROR" : "INFO", area: "CANONICAL_HASH", message: `Governance fingerprint: ${canonicalHash}` })

  return {
    valid: !hasError,
    status: hasError ? "FAIL" : "PASS",
    canonicalHash,
    findings,
  }
}

export function verifyProjectionDeterminism(projection1: string, projection2: string, label?: string): ProjectionDeterminismResult {
  const hash1 = hashText(projection1)
  const hash2 = hashText(projection2)
  const deterministic = hash1 === hash2

  return {
    deterministic,
    hash1,
    hash2,
    driftDetected: !deterministic,
    finding: deterministic
      ? { severity: "OK", area: "PROJECTION_DETERMINISM", message: `Projection determinism verified${label ? ` (${label})` : ""}`, detail: `sha256: ${hash1}` }
      : { severity: "ERROR", area: "PROJECTION_DETERMINISM", message: `PROJECTION DRIFT DETECTED${label ? ` (${label})` : ""} — non-deterministic output`, detail: `Hash 1: ${hash1}\nHash 2: ${hash2}` },
  }
}