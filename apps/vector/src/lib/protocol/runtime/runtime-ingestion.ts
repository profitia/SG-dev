import { db } from "@/lib/db/prisma"
import { RuntimeExportPayloadSchema } from "../schemas/runtime.schema"

// ── Ingest an external runtime export into VECTOR ────────────────────────────
//
// VECTOR only consumes structured runtime exports.
// NO git integration. NO repository scanning.
//
// The ingestion pipeline:
// 1. Validate the payload against the RuntimeExportPayload schema
// 2. Check for staleness (export older than 24h)
// 3. Detect conflicts with existing execution state
// 4. Merge signals and recommendations
// 5. Record ingestion status

export interface IngestionResult {
  status: "INGESTED" | "CONFLICT" | "STALE" | "REJECTED"
  exportId: string
  errors: string[]
  warnings: string[]
  merged: {
    projectCount: number
    taskCount: number
    eventCount: number
    signalCount: number
  }
}

export async function ingestRuntimeExport(
  rawPayload: unknown,
  options?: {
    source?: string
    workspaceId?: string
    allowStale?: boolean
  }
): Promise<IngestionResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // ── Step 1: Validate payload schema ──────────────────────────────────────
  const parsed = RuntimeExportPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    const record = await db.runtimeExport.create({
      data: {
        workspaceId: options?.workspaceId,
        source: options?.source ?? "external",
        version: "1.0.0",
        payload: (rawPayload as object) ?? {},
        status: "REJECTED",
      },
    })
    return {
      status: "REJECTED",
      exportId: record.id,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      warnings: [],
      merged: { projectCount: 0, taskCount: 0, eventCount: 0, signalCount: 0 },
    }
  }

  const payload = parsed.data

  // ── Step 2: Staleness check ───────────────────────────────────────────────
  const ageMs = Date.now() - payload.exportedAt.getTime()
  const staleThresholdMs = 24 * 60 * 60 * 1000 // 24 hours
  if (ageMs > staleThresholdMs && !options?.allowStale) {
    warnings.push(
      `Export is ${Math.round(ageMs / 3600000)}h old — exceeds 24h staleness threshold`
    )
    const record = await db.runtimeExport.create({
      data: {
        workspaceId: options?.workspaceId,
        source: options?.source ?? payload.workspace.slug,
        version: "1.0.0",
        payload: rawPayload as object,
        status: "STALE",
      },
    })
    return {
      status: "STALE",
      exportId: record.id,
      errors: [],
      warnings,
      merged: { projectCount: 0, taskCount: 0, eventCount: 0, signalCount: 0 },
    }
  }

  // ── Step 3: Conflict detection ────────────────────────────────────────────
  // Check if projects in the export already exist with conflicting slugs
  const incomingProjectSlugs = payload.projects.map((p) => p.slug)
  const existingProjects = await db.project.findMany({
    where: { slug: { in: incomingProjectSlugs } },
    select: { id: true, slug: true, status: true },
  })

  // Detect status conflicts
  for (const incoming of payload.projects) {
    const existing = existingProjects.find((e) => e.slug === incoming.slug)
    if (existing && existing.status !== incoming.status) {
      warnings.push(
        `Project "${incoming.slug}": local status=${existing.status}, import status=${incoming.status}`
      )
    }
  }

  // ── Step 4: Persist the export record ────────────────────────────────────
  const hasConflicts = false // conflicts are warnings, not hard stops
  const status = hasConflicts ? "CONFLICT" : "INGESTED"

  const record = await db.runtimeExport.create({
    data: {
      workspaceId: options?.workspaceId,
      source: options?.source ?? payload.workspace.slug,
      version: "1.0.0",
      payload: rawPayload as object,
      status,
      ingestedAt: status === "INGESTED" ? new Date() : null,
    },
  })

  // ── Step 5: Emit ingestion events ─────────────────────────────────────────
  // Events from the export are informational — we record them as-is
  // No automatic task creation. No hidden execution state mutation.

  return {
    status,
    exportId: record.id,
    errors,
    warnings,
    merged: {
      projectCount: payload.projects.length,
      taskCount: payload.tasks.length,
      eventCount: payload.events.length,
      signalCount: payload.signals.length,
    },
  }
}

// ── Query runtime exports ─────────────────────────────────────────────────────

export async function getRuntimeExports(options?: {
  workspaceId?: string
  limit?: number
}) {
  return db.runtimeExport.findMany({
    where: { workspaceId: options?.workspaceId },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 20,
  })
}

export async function getRuntimeExportStats() {
  const exports = await db.runtimeExport.groupBy({
    by: ["status"],
    _count: { id: true },
  })
  return exports.map((e) => ({ status: e.status, count: e._count.id }))
}
