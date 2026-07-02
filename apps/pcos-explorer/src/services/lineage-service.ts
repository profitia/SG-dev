// PCOS Cognition Explorer — Canonical Lineage Layer
//
// Unifies three H-layer lineage streams into a single logical model:
//   H3: HydrationLineageEvent   (substrate hydration audit trail)
//   H4: ValidationLineageEvent  (cognition validation audit trail)
//   H5: PromotionLineageEvent   (promotion pipeline audit trail)
//
// The Lineage Service can answer:
//   "Skąd pochodzi ten artifact?"
//   "Jaką drogę przeszedł od hydration do promotion?"
//
// Architecture:
//   LineageEvent (canonical) ← unified from 3 source tables
//   LineageChain             ← ordered events for one run/artifact
//   ArtifactProvenance       ← full lineage trace for one artifact
//
// Query patterns:
//   lineagePerRun(hydrationRunId)
//   lineagePerArtifact(artifactType, entityRef)
//   lineagePerDomain(domainId)
//   lineagePerPromotion(promotionRunId)

import { prisma } from "@/lib/prisma";
import { EXPLORER_ORG_ID } from "@/lib/org";

// ── Canonical Lineage Types ───────────────────────────────────────────────────

/** Normalized lineage source — identifies which H-layer emitted the event */
export type LineageSource = "H3_hydration" | "H4_validation" | "H5_promotion";

/** A single immutable lineage event in the canonical model */
export interface CanonicalLineageEvent {
  /** Unique event identifier (source-scoped) */
  id: string;
  /** H-layer that produced this event */
  source: LineageSource;
  /** Org owning this event */
  orgId: string;
  /** Parent run identifier (hydrationRunId, validationRunId, or promotionRunId) */
  runId: string;
  /** Pipeline phase that emitted this event */
  phase: string;
  /** Type of event (e.g. SNAPSHOT_CREATED, ROLLBACK_TRIGGERED) */
  eventType: string;
  /** Optional reference to the primary entity affected */
  entityRef: string | null;
  /** Structured event payload */
  payload: unknown;
  /** Immutable creation timestamp */
  createdAt: Date;
}

/** Ordered sequence of lineage events for a single execution unit */
export interface LineageChain {
  /** Run identifier this chain belongs to */
  runId: string;
  /** Source H-layer */
  source: LineageSource;
  /** Events in chronological order */
  events: CanonicalLineageEvent[];
  /** ISO date of first event */
  startedAt: Date | null;
  /** ISO date of last event */
  completedAt: Date | null;
}

/** Full provenance trace for one artifact type */
export interface ArtifactProvenance {
  /** Artifact type (e.g. "OntologyNode") */
  artifactType: string;
  /** Optional entity reference for a specific instance */
  entityRef: string | null;
  /** Hydration chain that produced this artifact */
  hydrationChain: LineageChain | null;
  /** Validation chain that verified this artifact */
  validationChain: LineageChain | null;
  /** Promotion chain that promoted this artifact (if promoted) */
  promotionChain: LineageChain | null;
  /** Human-readable provenance summary */
  summary: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapHydrationLineageEvent(
  e: {
    id: string;
    orgId: string;
    hydrationRunId: string;
    stage: string;
    eventType: string;
    entityRef: string | null;
    payload: unknown;
    createdAt: Date;
  }
): CanonicalLineageEvent {
  return {
    id: e.id,
    source: "H3_hydration",
    orgId: e.orgId,
    runId: e.hydrationRunId,
    phase: e.stage,
    eventType: e.eventType,
    entityRef: e.entityRef,
    payload: e.payload,
    createdAt: e.createdAt,
  };
}

function mapValidationLineageEvent(
  e: {
    id: string;
    orgId: string;
    validationRunId: string;
    phase: string;
    eventType: string;
    entityRef: string | null;
    payload: unknown;
    createdAt: Date;
  }
): CanonicalLineageEvent {
  return {
    id: e.id,
    source: "H4_validation",
    orgId: e.orgId,
    runId: e.validationRunId,
    phase: e.phase,
    eventType: e.eventType,
    entityRef: e.entityRef,
    payload: e.payload,
    createdAt: e.createdAt,
  };
}

function mapPromotionLineageEvent(
  e: {
    id: string;
    orgId: string;
    promotionRunId: string;
    phase: string;
    eventType: string;
    entityRef: string | null;
    payload: unknown;
    createdAt: Date;
  }
): CanonicalLineageEvent {
  return {
    id: e.id,
    source: "H5_promotion",
    orgId: e.orgId,
    runId: e.promotionRunId,
    phase: e.phase,
    eventType: e.eventType,
    entityRef: e.entityRef,
    payload: e.payload,
    createdAt: e.createdAt,
  };
}

function buildChain(
  events: CanonicalLineageEvent[],
  runId: string,
  source: LineageSource
): LineageChain {
  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  return {
    runId,
    source,
    events: sorted,
    startedAt: sorted[0]?.createdAt ?? null,
    completedAt: sorted[sorted.length - 1]?.createdAt ?? null,
  };
}

// ── Query functions ───────────────────────────────────────────────────────────

/** Get all lineage events for one H3 hydration run */
export async function getLineageByRun(
  hydrationRunId: string
): Promise<LineageChain> {
  const orgId = EXPLORER_ORG_ID;
  const raw = await prisma.hydrationLineageEvent.findMany({
    where: { orgId, hydrationRunId },
    orderBy: { createdAt: "asc" },
  });
  const events = raw.map(mapHydrationLineageEvent);
  return buildChain(events, hydrationRunId, "H3_hydration");
}

/** Get all H4 lineage events for one validation run */
export async function getValidationLineageByRun(
  validationRunId: string
): Promise<LineageChain> {
  const orgId = EXPLORER_ORG_ID;
  const raw = await prisma.validationLineageEvent.findMany({
    where: { orgId, validationRunId },
    orderBy: { createdAt: "asc" },
  });
  const events = raw.map(mapValidationLineageEvent);
  return buildChain(events, validationRunId, "H4_validation");
}

/** Get all H5 lineage events for one promotion run */
export async function getPromotionLineageByRun(
  promotionRunId: string
): Promise<LineageChain> {
  const orgId = EXPLORER_ORG_ID;
  const raw = await prisma.promotionLineageEvent.findMany({
    where: { orgId, promotionRunId },
    orderBy: { createdAt: "asc" },
  });
  const events = raw.map(mapPromotionLineageEvent);
  return buildChain(events, promotionRunId, "H5_promotion");
}

/** Get lineage events related to a specific entity (any layer) */
export async function getLineageByArtifact(
  entityRef: string
): Promise<CanonicalLineageEvent[]> {
  const orgId = EXPLORER_ORG_ID;
  const [h3, h4, h5] = await Promise.all([
    prisma.hydrationLineageEvent.findMany({
      where: { orgId, entityRef },
      orderBy: { createdAt: "asc" },
    }),
    prisma.validationLineageEvent.findMany({
      where: { orgId, entityRef },
      orderBy: { createdAt: "asc" },
    }),
    prisma.promotionLineageEvent.findMany({
      where: { orgId, entityRef },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return [
    ...h3.map(mapHydrationLineageEvent),
    ...h4.map(mapValidationLineageEvent),
    ...h5.map(mapPromotionLineageEvent),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Get all lineage for a domain (by domainId → source mapping) */
export async function getLineageByDomain(
  domainId: string,
  limit = 100
): Promise<CanonicalLineageEvent[]> {
  const orgId = EXPLORER_ORG_ID;

  const hydrationDomains = [
    "hydration",
    "ontology",
    "memory",
    "intelligence",
    "retrieval",
    "embeddings",
    "supplier",
    "benchmark",
  ];

  const events: CanonicalLineageEvent[] = [];

  if (hydrationDomains.includes(domainId)) {
    const raw = await prisma.hydrationLineageEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    events.push(...raw.map(mapHydrationLineageEvent));
  }

  if (domainId === "validation") {
    const raw = await prisma.validationLineageEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    events.push(...raw.map(mapValidationLineageEvent));
  }

  if (domainId === "promotion") {
    const raw = await prisma.promotionLineageEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    events.push(...raw.map(mapPromotionLineageEvent));
  }

  return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Build full artifact provenance — follows the chain from H3 → H4 → H5 */
export async function resolveArtifactProvenance(
  artifactType: string,
  entityRef?: string
): Promise<ArtifactProvenance> {
  const orgId = EXPLORER_ORG_ID;

  // Resolve hydration chain
  let hydrationChain: LineageChain | null = null;
  const h3Raw = await prisma.hydrationLineageEvent.findMany({
    where: entityRef ? { orgId, entityRef } : { orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  if (h3Raw.length > 0) {
    const events = h3Raw.map(mapHydrationLineageEvent);
    hydrationChain = buildChain(events, events[0].runId, "H3_hydration");
  }

  // Resolve validation chain (linked via hydrationRunId from H4 runs)
  let validationChain: LineageChain | null = null;
  if (hydrationChain) {
    const validationRun = await prisma.cognitionValidationRun.findFirst({
      where: { orgId, hydrationRunId: hydrationChain.runId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (validationRun) {
      validationChain = await getValidationLineageByRun(validationRun.id);
    }
  }

  // Resolve promotion chain (linked via sourceValidationRunId)
  let promotionChain: LineageChain | null = null;
  if (validationChain) {
    const promotionExecution = await prisma.promotionExecution.findFirst({
      where: {
        orgId,
        sourceValidationRunId: validationChain.runId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (promotionExecution) {
      promotionChain = await getPromotionLineageByRun(promotionExecution.id);
    }
  }

  // Build provenance summary
  const parts: string[] = [];
  if (hydrationChain && hydrationChain.events.length > 0)
    parts.push(`H3 hydration (${hydrationChain.events.length} events)`);
  if (validationChain && validationChain.events.length > 0)
    parts.push(`H4 validation (${validationChain.events.length} events)`);
  if (promotionChain && promotionChain.events.length > 0)
    parts.push(`H5 promotion (${promotionChain.events.length} events)`);

  const summary =
    parts.length > 0
      ? `${artifactType} traced through: ${parts.join(" → ")}`
      : `${artifactType}: no lineage events found`;

  return {
    artifactType,
    entityRef: entityRef ?? null,
    hydrationChain,
    validationChain,
    promotionChain,
    summary,
  };
}

/** Get platform-wide lineage coverage statistics */
export async function getLineageCoverageStats(): Promise<{
  h3Events: number;
  h4Events: number;
  h5Events: number;
  totalEvents: number;
  uniqueHydrationRuns: number;
  uniqueValidationRuns: number;
  uniquePromotionRuns: number;
}> {
  const orgId = EXPLORER_ORG_ID;
  const [h3Events, h4Events, h5Events, h3Runs, h4Runs, h5Runs] =
    await Promise.all([
      prisma.hydrationLineageEvent.count({ where: { orgId } }),
      prisma.validationLineageEvent.count({ where: { orgId } }),
      prisma.promotionLineageEvent.count({ where: { orgId } }),
      prisma.hydrationLineageEvent
        .groupBy({ by: ["hydrationRunId"], where: { orgId } })
        .then((r) => r.length),
      prisma.validationLineageEvent
        .groupBy({ by: ["validationRunId"], where: { orgId } })
        .then((r) => r.length),
      prisma.promotionLineageEvent
        .groupBy({ by: ["promotionRunId"], where: { orgId } })
        .then((r) => r.length),
    ]);

  return {
    h3Events,
    h4Events,
    h5Events,
    totalEvents: h3Events + h4Events + h5Events,
    uniqueHydrationRuns: h3Runs,
    uniqueValidationRuns: h4Runs,
    uniquePromotionRuns: h5Runs,
  };
}
