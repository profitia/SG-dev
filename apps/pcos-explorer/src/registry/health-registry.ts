// PCOS Cognition Explorer — Domain Health Registry
// Computes and exposes health metrics for each registered domain.
// The Explorer reads this to render domain status in the sidebar and dashboard.
//
// Health is derived from DomainDefinition.coverage + ArtifactRegistry state.
// This is a STATIC computation based on registration declarations.
// Live data health (actual DB row counts) is computed in query.ts per domain.

import { getAllDomains, type DomainDefinition } from "./domain-registry";
import { getArtifactsByDomain, type ArtifactDefinition } from "./artifact-registry";
import { hasRenderer } from "./renderer-registry";

// ── Domain Health Model ───────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "empty" | "planned";

export interface DomainHealth {
  /** Domain identifier */
  domainId: string;
  /** Human-readable domain label */
  domainLabel: string;
  /** Computed health status */
  status: HealthStatus;
  /** Number of registered artifacts for this domain */
  artifactCount: number;
  /** Whether a renderer is registered */
  rendererCoverage: boolean;
  /** Whether a query module is declared (via domain.coverage.hasQuery) */
  queryCoverage: boolean;
  /** Whether lineage events exist for this domain's artifacts */
  lineageCoverage: boolean;
  /** Whether this domain has validation-linked artifacts */
  validationCoverage: boolean;
  /** Artifacts registered under this domain */
  artifacts: Array<{
    type: string;
    label: string;
    readiness: string;
    hasEmbeddings: boolean;
    isCrossDomain: boolean;
  }>;
}

// ── Health computation ────────────────────────────────────────────────────────

function computeStatus(
  domain: DomainDefinition,
  artifacts: ArtifactDefinition[],
  hasRend: boolean
): HealthStatus {
  if (domain.readiness === "planned") return "planned";
  if (!hasRend || !domain.coverage.hasQuery) return "degraded";
  if (!domain.coverage.hasData) return "empty";
  if (artifacts.length === 0) return "degraded";
  return "healthy";
}

export function getDomainHealth(domainId: string): DomainHealth | undefined {
  const all = getAllDomainHealthReport();
  return all.find((h) => h.domainId === domainId);
}

export function getAllDomainHealthReport(): DomainHealth[] {
  const domains = getAllDomains();

  return domains.map((domain) => {
    const artifacts = getArtifactsByDomain(domain.id);
    const hasRend = hasRenderer(domain.id);
    const status = computeStatus(domain, artifacts, hasRend);

    return {
      domainId: domain.id,
      domainLabel: domain.label,
      status,
      artifactCount: artifacts.length,
      rendererCoverage: hasRend,
      queryCoverage: domain.coverage.hasQuery,
      lineageCoverage: domain.coverage.hasLineage,
      validationCoverage: domain.coverage.hasValidation,
      artifacts: artifacts.map((a) => ({
        type: a.artifactType,
        label: a.label,
        readiness: a.readiness,
        hasEmbeddings: a.hasEmbeddings,
        isCrossDomain: a.isCrossDomain,
      })),
    };
  });
}

// ── Platform-level coverage summary ──────────────────────────────────────────

export interface PlatformHealthSummary {
  totalDomains: number;
  healthyDomains: number;
  degradedDomains: number;
  totalArtifacts: number;
  rendererCoverage: number;  // percentage 0–100
  queryCoverage: number;     // percentage 0–100
  lineageCoverage: number;   // percentage 0–100
  validationCoverage: number; // percentage 0–100
}

export function getPlatformHealthSummary(): PlatformHealthSummary {
  const report = getAllDomainHealthReport();
  const total = report.length;
  if (total === 0) {
    return {
      totalDomains: 0,
      healthyDomains: 0,
      degradedDomains: 0,
      totalArtifacts: 0,
      rendererCoverage: 0,
      queryCoverage: 0,
      lineageCoverage: 0,
      validationCoverage: 0,
    };
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return {
    totalDomains: total,
    healthyDomains: report.filter((d) => d.status === "healthy").length,
    degradedDomains: report.filter((d) => d.status === "degraded").length,
    totalArtifacts: report.reduce((sum, d) => sum + d.artifactCount, 0),
    rendererCoverage: pct(report.filter((d) => d.rendererCoverage).length),
    queryCoverage: pct(report.filter((d) => d.queryCoverage).length),
    lineageCoverage: pct(report.filter((d) => d.lineageCoverage).length),
    validationCoverage: pct(report.filter((d) => d.validationCoverage).length),
  };
}
