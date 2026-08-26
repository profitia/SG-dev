"use server"

import { db } from "@/lib/db/prisma"
import { generateWorkspace } from "@/lib/workspaces/generator"
import type { WorkspaceArchetype } from "@/lib/workspaces/archetypes"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

// ── Create workspace from archetype ──────────────────────────────────────────

export async function createWorkspace(formData: FormData) {
  const name = (formData.get("name") as string)?.trim()
  const archetype = formData.get("archetype") as WorkspaceArchetype
  const description = (formData.get("description") as string) || undefined

  if (!name || !archetype) return

  const workspace = await generateWorkspace({ name, archetype, description })

  redirect(`/workspaces/${workspace.slug}`)
}

// ── Workspace queries ─────────────────────────────────────────────────────────

export async function getWorkspaces() {
  return db.workspace.findMany({
    include: {
      projects: {
        select: {
          id: true,
          status: true,
          tasks: { select: { id: true, status: true } },
        },
      },
      conventions: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getWorkspace(slug: string) {
  return db.workspace.findUnique({
    where: { slug },
    include: {
      projects: {
        include: {
          etaps: { orderBy: { order: "asc" } },
          tasks: {
            select: { id: true, status: true, priority: true, type: true },
          },
          sourceDependencies: true,
          targetDependencies: true,
          executionDomains: {
            include: { executionDomain: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      conventions: { orderBy: { key: "asc" } },
    },
  })
}

// ── Workspace management ─────────────────────────────────────────────────────

export async function deleteWorkspace(id: string) {
  await db.workspace.delete({ where: { id } })
  revalidatePath("/workspaces")
}

export async function updateWorkspaceConvention(
  workspaceId: string,
  key: string,
  value: string
) {
  await db.workspaceConvention.upsert({
    where: { workspaceId_key: { workspaceId, key } },
    update: { value },
    create: { workspaceId, key, value },
  })
  revalidatePath("/workspaces")
}
