import { db } from "@/lib/db/prisma"
import type { RuntimeExportPayload } from "../schemas/runtime.schema"

// ── Export current VECTOR execution state as a runtime export payload ─────────
//
// This creates a structured snapshot of all execution state for a workspace
// (or globally), ready to be stored as a RuntimeExport record or exported
// to the .vector/runtime/ format for consumption by external repositories.

export async function exportRuntimePayload(options?: {
  workspaceId?: string
}): Promise<RuntimeExportPayload> {
  const workspaceId = options?.workspaceId

  // ── Workspace identity ────────────────────────────────────────────────────
  let workspaceIdentity = {
    slug: "global",
    name: "Global",
    type: "SaaS" as const,
    protocolVersion: "1.0.0",
    runtimeVersion: "1.0.0",
    conventions: {} as Record<string, string>,
  }

  if (workspaceId) {
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: { conventions: true, protocol: true },
    })
    if (ws) {
      workspaceIdentity = {
        slug: ws.slug,
        name: ws.name,
        type: ws.archetype as typeof workspaceIdentity.type,
        protocolVersion: ws.protocol?.protocolVersion ?? "1.0.0",
        runtimeVersion: ws.protocol?.runtimeVersion ?? "1.0.0",
        conventions: Object.fromEntries(
          ws.conventions.map((c) => [c.key, c.value])
        ),
      }
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = await db.project.findMany({
    where: workspaceId ? { workspaceId } : {},
    include: {
      etaps: { include: { subetaps: true }, orderBy: { order: "asc" } },
      tasks: true,
      sourceDependencies: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const projectRefs = projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
  }))

  const etaps = projects.flatMap((p) =>
    p.etaps.map((e) => ({
      id: e.id,
      name: e.name,
      order: e.order,
      projectId: e.projectId,
    }))
  )

  const subetaps = projects.flatMap((p) =>
    p.etaps.flatMap((e) =>
      e.subetaps.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        etapId: s.etapId,
      }))
    )
  )

  const tasks = projects.flatMap((p) =>
    p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      projectId: t.projectId,
      etapId: t.etapId ?? undefined,
    }))
  )

  const dependencies = projects.flatMap((p) =>
    p.sourceDependencies.map((d) => ({
      id: d.id,
      sourceProjectId: d.sourceProjectId,
      targetProjectId: d.targetProjectId,
      dependencyType: d.dependencyType,
      criticality: d.criticality,
      description: d.description ?? undefined,
      createdAt: d.createdAt,
    }))
  )

  // ── Recent events ─────────────────────────────────────────────────────────
  const recentEvents = await db.executionEvent.findMany({
    where: workspaceId ? { workspaceId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const events = recentEvents.map((e) => ({
    id: e.id,
    category: e.category,
    type: e.type as import("../schemas/event.schema").ExecutionEventType,
    workspaceId: e.workspaceId ?? undefined,
    projectId: e.projectId ?? undefined,
    payload: (e.payload as Record<string, unknown>) ?? {},
    source: e.source,
    createdAt: e.createdAt,
  }))

  return {
    workspace: workspaceIdentity,
    projects: projectRefs,
    etaps,
    subetaps,
    tasks,
    dependencies,
    signals: [],
    recommendations: [],
    events,
    exportedAt: new Date(),
  }
}

// ── Persist a runtime export to DB ───────────────────────────────────────────

export async function createRuntimeExport(options?: {
  workspaceId?: string
  source?: string
}) {
  const payload = await exportRuntimePayload({ workspaceId: options?.workspaceId })

  return db.runtimeExport.create({
    data: {
      workspaceId: options?.workspaceId,
      source: options?.source ?? "vector",
      version: "1.0.0",
      payload: payload as object,
      status: "PENDING",
    },
  })
}
