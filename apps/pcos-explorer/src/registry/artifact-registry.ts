// PCOS Cognition Explorer — Artifact Registry
// Artifact is a FIRST-CLASS ENTITY in the PCOS platform.
// Domains aggregate artifacts. Artifacts do not belong to domains — they are
// consumed by domains.
//
// Canonical model defined in: packages/pcos-contracts/src/artifacts/artifact-contract.ts
// Explorer imports types from @sg/pcos-contracts — no local model ownership.

import type {
  ArtifactReadinessState,
  ArtifactViewMode,
  ArtifactLineage,
} from "@sg/pcos-contracts";

// ── Artifact Definition (Explorer runtime representation) ─────────────────────
//
// This extends the canonical ArtifactContract with runtime bindings
// (renderer key, domain association) needed by the Explorer engine.

export interface ArtifactDefinition {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Globally unique artifact type identifier (e.g. "OntologyNode") */
  artifactType: string;

  // ── Domain association ────────────────────────────────────────────────────
  /** Primary domain this artifact is surfaced under */
  domainId: string;

  // ── Source ────────────────────────────────────────────────────────────────
  /** Prisma model name that backs this artifact */
  sourceModel: string;

  // ── Renderer binding ──────────────────────────────────────────────────────
  /** Renderer ID that handles rendering this artifact */
  renderer: string;

  // ── Metadata ──────────────────────────────────────────────────────────────
  /** Human-readable label */
  label: string;
  /** Description of what this artifact represents in cognition terms */
  description: string;
  /** View modes this artifact supports */
  supportedViews: ArtifactViewMode[];
  /** Whether this artifact type is searchable */
  isSearchable: boolean;
  /** Whether this artifact carries vector embeddings */
  hasEmbeddings: boolean;
  /** Whether this artifact is shared across multiple domains */
  isCrossDomain: boolean;

  // ── Readiness ─────────────────────────────────────────────────────────────
  /** Current readiness state of this artifact in the Explorer */
  readiness: ArtifactReadinessState;

  // ── Lineage ───────────────────────────────────────────────────────────────
  /** Provenance and lineage metadata */
  lineage: ArtifactLineage;
}

// ── Registry store ────────────────────────────────────────────────────────────

const _artifacts = new Map<string, ArtifactDefinition>();

export function registerArtifact(def: ArtifactDefinition): void {
  if (_artifacts.has(def.artifactType)) {
    throw new Error(
      `[ArtifactRegistry] Artifact already registered: ${def.artifactType}`
    );
  }
  _artifacts.set(def.artifactType, def);
}

export function getArtifact(type: string): ArtifactDefinition | undefined {
  return _artifacts.get(type);
}

export function getAllArtifacts(): ArtifactDefinition[] {
  return Array.from(_artifacts.values());
}

export function getArtifactsByDomain(domainId: string): ArtifactDefinition[] {
  return getAllArtifacts().filter((a) => a.domainId === domainId);
}

export function getReadyArtifacts(): ArtifactDefinition[] {
  return getAllArtifacts().filter(
    (a) => a.readiness === "ready" || a.readiness === "partial"
  );
}
