import { db } from "@/lib/db/prisma"
import type { WorkspaceArchetype } from "@/lib/workspaces/archetypes"

// ── Workspace identity model ──────────────────────────────────────────────────
//
// Each workspace has an identity record (WorkspaceProtocol) that stores:
// - protocol version (schema contract version)
// - runtime version (execution state version)
// - identity snapshot (slug, name, type, conventions)
//
// This model is the bridge between VECTOR's workspace system and
// external repositories consuming runtime exports.

export interface WorkspaceIdentityData {
  slug: string
  name: string
  type: WorkspaceArchetype
  protocolVersion: string
  runtimeVersion: string
  conventions: Record<string, string>
}

export async function ensureWorkspaceProtocol(workspaceId: string): Promise<WorkspaceIdentityData> {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: { conventions: true, protocol: true },
  })

  const conventions = Object.fromEntries(
    workspace.conventions.map((c) => [c.key, c.value])
  )

  const identity: WorkspaceIdentityData = {
    slug: workspace.slug,
    name: workspace.name,
    type: workspace.archetype as WorkspaceArchetype,
    protocolVersion: workspace.protocol?.protocolVersion ?? "1.0.0",
    runtimeVersion: workspace.protocol?.runtimeVersion ?? "1.0.0",
    conventions,
  }

  // Upsert the protocol record
  await db.workspaceProtocol.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      protocolVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      identity: identity as object,
      conventions: conventions as object,
    },
    update: {
      identity: identity as object,
      conventions: conventions as object,
    },
  })

  return identity
}

export async function getWorkspaceIdentityMap() {
  const workspaces = await db.workspace.findMany({
    include: {
      conventions: true,
      protocol: true,
      projects: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return workspaces.map((ws) => ({
    id: ws.id,
    slug: ws.slug,
    name: ws.name,
    archetype: ws.archetype,
    projectCount: ws.projects.length,
    activeProjectCount: ws.projects.filter((p) => p.status === "ACTIVE").length,
    protocolVersion: ws.protocol?.protocolVersion ?? "1.0.0",
    runtimeVersion: ws.protocol?.runtimeVersion ?? "1.0.0",
    conventionCount: ws.conventions.length,
    hasProtocol: ws.protocol !== null,
  }))
}
