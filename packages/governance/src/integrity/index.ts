import { computeCanonicalGovernanceHash, hashObject, hashText } from "./hash.js"
import { INTEGRITY_VERSION } from "./types.js"
import type { ArtifactLockMetadata, IntegrityMetadata } from "./types.js"

export function createTextIntegrityMetadata(
  content: string,
  options: { generatedBy: string; sourceRuntime: string; sourceProjection: string },
): IntegrityMetadata {
  return {
    integrityVersion: INTEGRITY_VERSION,
    generatedAt: new Date().toISOString(),
    generatedBy: options.generatedBy,
    sourceRuntime: options.sourceRuntime,
    sourceProjection: options.sourceProjection,
    contentHash: hashText(content),
    canonicalHash: computeCanonicalGovernanceHash(),
  }
}

export function createObjectIntegrityMetadata(
  obj: unknown,
  options: { generatedBy: string; sourceRuntime: string; sourceProjection: string },
): IntegrityMetadata {
  return {
    integrityVersion: INTEGRITY_VERSION,
    generatedAt: new Date().toISOString(),
    generatedBy: options.generatedBy,
    sourceRuntime: options.sourceRuntime,
    sourceProjection: options.sourceProjection,
    contentHash: hashObject(obj),
    canonicalHash: computeCanonicalGovernanceHash(),
  }
}

export function createArtifactLock(artifactContent: unknown): ArtifactLockMetadata {
  return {
    immutable: true,
    immutableSince: new Date().toISOString(),
    integrityHash: hashObject(artifactContent),
  }
}

export * from "./types.js"
export { computeCanonicalGovernanceHash, hashObject, hashText, sha256, stableStringify } from "./hash.js"
export { verifyArtifactLock, verifyGovernanceIntegrity, verifyObjectIntegrity, verifyProjectionDeterminism, verifyTextIntegrity } from "./verify.js"
export type { GovernanceIntegrityResult } from "./verify.js"