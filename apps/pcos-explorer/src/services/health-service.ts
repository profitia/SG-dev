// PCOS Cognition Explorer — Runtime Health Service
// Computes REAL health metrics by querying the database.
// This REPLACES the static declaration-based health-registry computation.
//
// Health is derived from runtime data, not configuration.
//
// Architecture:
//   DB query → row count + timestamps → freshness score → HealthStatus
//
// Used by: API routes, dashboard pages, platform health endpoint.

import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";
import { getAllDomains } from "@/registry/domain-registry";
import { getArtifactsByDomain } from "@/registry/artifact-registry";
import { hasRenderer } from "@/registry/renderer-registry";

// ── Types ────────────────────────────────────────────────────────────────────

export type RuntimeHealthStatus = "healthy" | "degraded" | "empty" | "planned";

export interface ArtifactRuntimeHealth {
  artifactType: string;
  label: string;
  rowCount: number;
  latestUpdatedAt: Date | null;
  freshnessScore: number; // 0–100, 100 = updated <1h ago
  lineageAvailable: boolean;
  validationAvailable: boolean;
}

export interface DomainRuntimeHealth {
  domainId: string;
  domainLabel: string;
  status: RuntimeHealthStatus;
  // Coverage (structural — from registry)
  rendererCoverage: boolean;
  queryCoverage: boolean;
  lineageCoverage: boolean;
  validationCoverage: boolean;
  // Runtime metrics (from DB)
  totalRows: number;
  artifactCount: number;
  latestUpdatedAt: Date | null;
  freshnessScore: number; // 0–100
  artifacts: ArtifactRuntimeHealth[];
}

export interface PlatformRuntimeHealth {
  computedAt: Date;
  totalDomains: number;
  healthyDomains: number;
  degradedDomains: number;
  emptyDomains: number;
  plannedDomains: number;
  totalArtifactTypes: number;
  totalRows: number;
  lineageCoveragePercent: number;
  validationCoveragePercent: number;
  rendererCoveragePercent: number;
  queryCoveragePercent: number;
  overallFreshnessScore: number; // weighted average
  domains: DomainRuntimeHealth[];
}

// ── Freshness computation ────────────────────────────────────────────────────

function computeFreshness(latestAt: Date | null): number {
  if (!latestAt) return 0;
  const ageMs = Date.now() - latestAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 100;
  if (ageHours < 6) return 90;
  if (ageHours < 24) return 75;
  if (ageHours < 72) return 50;
  if (ageHours < 168) return 25;
  return 10;
}

function computeDomainStatus(
  domain: ReturnType<typeof getAllDomains>[number],
  totalRows: number,
  hasRend: boolean
): RuntimeHealthStatus {
  if (domain.readiness === "planned") return "planned";
  if (!hasRend || !domain.coverage.hasQuery) return "degraded";
  if (totalRows === 0) return "empty";
  return "healthy";
}

// ── Per-model row count queries ──────────────────────────────────────────────
// Each returns { count, latestUpdatedAt }

async function queryModelHealth(
  modelName: string
): Promise<{ count: number; latestUpdatedAt: Date | null }> {
  const orgId = EXPLORER_ORG_ID;

  try {
    switch (modelName) {
      case "HydrationRun": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationRun.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationRun.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationOntologyNode": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationOntologyNode.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationOntologyNode.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationCognitionMemory": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationCognitionMemory.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationCognitionMemory.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationIntelligenceUnit": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationIntelligenceUnit.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationIntelligenceUnit.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationRetrievalDocument": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationRetrievalDocument.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationRetrievalDocument.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationEmbeddingRecord": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationEmbeddingRecord.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationEmbeddingRecord.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "HydrationLineageEvent": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationLineageEvent.count({ where: { orgId } }),
          prisma.hydrationLineageEvent.findFirst({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.createdAt ?? null };
      }
      case "HydrationIngestBatch": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationIngestBatch.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationIngestBatch.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "CognitionValidationRun": {
        const [agg, latest] = await Promise.all([
          prisma.cognitionValidationRun.count({ where: { orgId, deletedAt: null } }),
          prisma.cognitionValidationRun.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "CognitionQualityScore": {
        const [agg, latest] = await Promise.all([
          prisma.cognitionQualityScore.count({ where: { orgId } }),
          prisma.cognitionQualityScore.findFirst({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.createdAt ?? null };
      }
      case "CognitionMaturityScore": {
        const [agg, latest] = await Promise.all([
          prisma.cognitionMaturityScore.count({ where: { orgId } }),
          prisma.cognitionMaturityScore.findFirst({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.createdAt ?? null };
      }
      case "PromotionReadinessEvaluation": {
        const [agg, latest] = await Promise.all([
          prisma.promotionReadinessEvaluation.count({ where: { orgId } }),
          prisma.promotionReadinessEvaluation.findFirst({
            where: { orgId },
            orderBy: { evaluatedAt: "desc" },
            select: { evaluatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.evaluatedAt ?? null };
      }
      case "PromotionExecution": {
        const [agg, latest] = await Promise.all([
          prisma.promotionExecution.count({ where: { orgId, deletedAt: null } }),
          prisma.promotionExecution.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "CognitionSnapshot": {
        const [agg, latest] = await Promise.all([
          prisma.cognitionSnapshot.count({ where: { orgId, deletedAt: null } }),
          prisma.cognitionSnapshot.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "CognitionVersion": {
        const [agg, latest] = await Promise.all([
          prisma.cognitionVersion.count({ where: { orgId, deletedAt: null } }),
          prisma.cognitionVersion.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      case "ValidationLineageEvent": {
        const [agg, latest] = await Promise.all([
          prisma.validationLineageEvent.count({ where: { orgId } }),
          prisma.validationLineageEvent.findFirst({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.createdAt ?? null };
      }
      case "PromotionLineageEvent": {
        const [agg, latest] = await Promise.all([
          prisma.promotionLineageEvent.count({ where: { orgId } }),
          prisma.promotionLineageEvent.findFirst({
            where: { orgId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.createdAt ?? null };
      }
      // Cross-domain: use HydrationRun as proxy
      case "HydrationRun_supplier":
      case "HydrationRun_benchmark": {
        const [agg, latest] = await Promise.all([
          prisma.hydrationRun.count({ where: { orgId, deletedAt: null } }),
          prisma.hydrationRun.findFirst({
            where: { orgId, deletedAt: null },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return { count: agg, latestUpdatedAt: latest?.updatedAt ?? null };
      }
      default:
        return { count: 0, latestUpdatedAt: null };
    }
  } catch {
    return { count: 0, latestUpdatedAt: null };
  }
}

// ── Lineage event count per domain ───────────────────────────────────────────

async function queryLineageCount(domainId: string): Promise<number> {
  const orgId = EXPLORER_ORG_ID;
  try {
    switch (domainId) {
      case "hydration":
      case "ontology":
      case "memory":
      case "intelligence":
      case "retrieval":
      case "embeddings":
        return prisma.hydrationLineageEvent.count({ where: { orgId } });
      case "validation":
        return prisma.validationLineageEvent.count({ where: { orgId } });
      case "promotion":
        return prisma.promotionLineageEvent.count({ where: { orgId } });
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

// ── Per-artifact health ──────────────────────────────────────────────────────

async function computeArtifactHealth(
  artifact: ReturnType<typeof getArtifactsByDomain>[number]
): Promise<ArtifactRuntimeHealth> {
  const { count, latestUpdatedAt } = await queryModelHealth(artifact.sourceModel);
  const lineageCount = await queryLineageCount(artifact.domainId);

  return {
    artifactType: artifact.artifactType,
    label: artifact.label,
    rowCount: count,
    latestUpdatedAt,
    freshnessScore: computeFreshness(latestUpdatedAt),
    lineageAvailable: lineageCount > 0,
    validationAvailable: artifact.lineage.producedBy === "H4" || artifact.isCrossDomain,
  };
}

// ── Main compute functions ───────────────────────────────────────────────────

export async function computeDomainRuntimeHealth(
  domainId: string
): Promise<DomainRuntimeHealth | null> {
  const domain = getAllDomains().find((d) => d.id === domainId);
  if (!domain) return null;

  const registeredArtifacts = getArtifactsByDomain(domainId);
  const hasRend = hasRenderer(domainId);
  const lineageCount = await queryLineageCount(domainId);

  // Query primaryModel for domain-level stats
  const { count: totalRows, latestUpdatedAt } = await queryModelHealth(
    domain.primaryModel
  );

  // Per-artifact health
  const artifacts = await Promise.all(
    registeredArtifacts.map(computeArtifactHealth)
  );

  const freshnessScore = computeFreshness(latestUpdatedAt);
  const status = computeDomainStatus(domain, totalRows, hasRend);

  return {
    domainId: domain.id,
    domainLabel: domain.label,
    status,
    rendererCoverage: hasRend,
    queryCoverage: domain.coverage.hasQuery,
    lineageCoverage: lineageCount > 0,
    validationCoverage: domain.coverage.hasValidation,
    totalRows,
    artifactCount: registeredArtifacts.length,
    latestUpdatedAt,
    freshnessScore,
    artifacts,
  };
}

export async function computePlatformRuntimeHealth(): Promise<PlatformRuntimeHealth> {
  const domains = getAllDomains();
  const domainHealths = await Promise.all(
    domains.map((d) => computeDomainRuntimeHealth(d.id))
  );
  const resolved = domainHealths.filter(Boolean) as DomainRuntimeHealth[];

  const healthy = resolved.filter((d) => d.status === "healthy").length;
  const degraded = resolved.filter((d) => d.status === "degraded").length;
  const empty = resolved.filter((d) => d.status === "empty").length;
  const planned = resolved.filter((d) => d.status === "planned").length;

  const totalRows = resolved.reduce((s, d) => s + d.totalRows, 0);
  const totalArtifactTypes = resolved.reduce((s, d) => s + d.artifactCount, 0);

  const readyDomains = resolved.filter((d) => d.status !== "planned");
  const lineageCoveragePercent =
    readyDomains.length > 0
      ? Math.round(
          (readyDomains.filter((d) => d.lineageCoverage).length /
            readyDomains.length) *
            100
        )
      : 0;
  const validationCoveragePercent =
    readyDomains.length > 0
      ? Math.round(
          (readyDomains.filter((d) => d.validationCoverage).length /
            readyDomains.length) *
            100
        )
      : 0;
  const rendererCoveragePercent =
    domains.length > 0
      ? Math.round(
          (resolved.filter((d) => d.rendererCoverage).length / domains.length) *
            100
        )
      : 0;
  const queryCoveragePercent =
    domains.length > 0
      ? Math.round(
          (resolved.filter((d) => d.queryCoverage).length / domains.length) *
            100
        )
      : 0;

  const overallFreshnessScore =
    readyDomains.length > 0
      ? Math.round(
          readyDomains.reduce((s, d) => s + d.freshnessScore, 0) /
            readyDomains.length
        )
      : 0;

  return {
    computedAt: new Date(),
    totalDomains: domains.length,
    healthyDomains: healthy,
    degradedDomains: degraded,
    emptyDomains: empty,
    plannedDomains: planned,
    totalArtifactTypes,
    totalRows,
    lineageCoveragePercent,
    validationCoveragePercent,
    rendererCoveragePercent,
    queryCoveragePercent,
    overallFreshnessScore,
    domains: resolved,
  };
}
