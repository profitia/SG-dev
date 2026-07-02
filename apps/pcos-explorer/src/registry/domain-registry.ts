// PCOS Cognition Explorer — Domain Registry
// SINGLE SOURCE OF TRUTH for all cognition domains.
//
// Domain is an AGGREGATION of artifacts — not an owner.
// Navigation, routing, artifact assignment, health, and renderer binding
// all derive from this registry.
//
// Adding a new domain: register here + add query.ts + renderer.tsx + page.tsx
// No sidebar/layout/router changes required.

export type NavigationGroup = "cognition" | "lifecycle" | "cross-domain";

// ── Domain Readiness ──────────────────────────────────────────────────────────

export type DomainReadinessState =
  | "ready"      // Renderer + query + artifacts all confirmed working
  | "partial"    // Renderer exists, some artifacts may be sparse
  | "registered" // Registered, renderer/query not yet wired
  | "planned";   // Future domain — definition only, no implementation

// ── Domain Coverage ───────────────────────────────────────────────────────────

export interface DomainCoverage {
  /** At least one artifact with real data in the DB */
  hasData: boolean;
  /** Renderer is registered and functional */
  hasRenderer: boolean;
  /** Query module is registered */
  hasQuery: boolean;
  /** At least one lineage event exists for this domain's artifacts */
  hasLineage: boolean;
  /** Domain has at least one validation-linked artifact */
  hasValidation: boolean;
}

// ── Domain Definition ─────────────────────────────────────────────────────────

export interface DomainDefinition {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Unique domain identifier — route key and registry key */
  id: string;
  /** Human-readable label */
  label: string;
  /** Short description shown in UI */
  description: string;

  // ── Visual ────────────────────────────────────────────────────────────────
  /** lucide-react icon name */
  iconName: string;

  // ── Routing ───────────────────────────────────────────────────────────────
  /** Route href — MUST match Next.js app directory path */
  href: string;

  // ── Navigation grouping ────────────────────────────────────────────────────
  /** Sidebar navigation group this domain appears under */
  navigationGroup: NavigationGroup;

  // ── Artifacts ─────────────────────────────────────────────────────────────
  /** Artifact types aggregated by this domain (from ArtifactRegistry) */
  artifactTypes: string[];

  // ── Renderer & Query binding ───────────────────────────────────────────────
  /** Renderer IDs supported by this domain */
  supportedRenderers: string[];
  /** Primary Prisma model backing this domain */
  primaryModel: string;

  // ── Readiness ─────────────────────────────────────────────────────────────
  /** Current readiness state */
  readiness: DomainReadinessState;

  // ── Coverage ──────────────────────────────────────────────────────────────
  /** Static coverage declaration — verified at definition time */
  coverage: DomainCoverage;
}

// ── Registry store ────────────────────────────────────────────────────────────

const _domains = new Map<string, DomainDefinition>();

export function registerDomain(def: DomainDefinition): void {
  if (_domains.has(def.id)) {
    throw new Error(`[DomainRegistry] Domain already registered: ${def.id}`);
  }
  _domains.set(def.id, def);
}

export function getDomain(id: string): DomainDefinition | undefined {
  return _domains.get(id);
}

export function getAllDomains(): DomainDefinition[] {
  return Array.from(_domains.values());
}

export function getDomainsByGroup(group: NavigationGroup): DomainDefinition[] {
  return getAllDomains().filter((d) => d.navigationGroup === group);
}

export function getReadyDomains(): DomainDefinition[] {
  return getAllDomains().filter(
    (d) => d.readiness === "ready" || d.readiness === "partial"
  );
}
