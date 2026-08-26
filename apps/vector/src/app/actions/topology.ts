"use server"

import { db } from "@/lib/db/prisma"
import { runTopologyAnalysis } from "@/lib/topology/recommendations"
import type {
  TopologyInput,
  TopologyAnalysis,
  DependencyType,
  Criticality,
} from "@/lib/topology/types"
import { revalidatePath } from "next/cache"

// ── Fetch + analyse topology --------------------------------------------------

export async function getTopologyData(): Promise<TopologyAnalysis> {
  const [projects, dependencies, executionDomains, sharedBlockers] = await Promise.all([
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { name: "asc" },
    }),
    db.projectDependency.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.executionDomain.findMany({
      include: { projectDomains: { select: { projectId: true } } },
      orderBy: { name: "asc" },
    }),
    db.sharedBlocker.findMany({
      include: { affectedProjects: { select: { projectId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const input: TopologyInput = {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
    })),
    dependencies: dependencies.map((d) => ({
      id: d.id,
      sourceProjectId: d.sourceProjectId,
      targetProjectId: d.targetProjectId,
      dependencyType: d.dependencyType as DependencyType,
      criticality: d.criticality as Criticality,
      description: d.description,
    })),
    domains: executionDomains.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      projectIds: d.projectDomains.map((pd) => pd.projectId),
    })),
    sharedBlockers: sharedBlockers.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity as Criticality,
      description: b.description,
      resolved: b.resolved,
      affectedProjectIds: b.affectedProjects.map((ap) => ap.projectId),
    })),
  }

  return runTopologyAnalysis(input)
}

// ── Project Dependency CRUD ---------------------------------------------------

export async function createProjectDependency(formData: FormData) {
  const sourceProjectId = formData.get("sourceProjectId") as string
  const targetProjectId = formData.get("targetProjectId") as string
  const dependencyType = formData.get("dependencyType") as DependencyType
  const criticality = formData.get("criticality") as Criticality
  const description = (formData.get("description") as string) || null

  if (!sourceProjectId || !targetProjectId || sourceProjectId === targetProjectId) return

  await db.projectDependency.upsert({
    where: {
      sourceProjectId_targetProjectId_dependencyType: {
        sourceProjectId,
        targetProjectId,
        dependencyType,
      },
    },
    update: { criticality, description },
    create: { sourceProjectId, targetProjectId, dependencyType, criticality, description },
  })

  revalidatePath("/topology")
}

export async function deleteProjectDependency(id: string) {
  await db.projectDependency.delete({ where: { id } })
  revalidatePath("/topology")
}

// ── Execution Domain CRUD -----------------------------------------------------

export async function createExecutionDomain(formData: FormData) {
  const name = formData.get("name") as string
  const description = (formData.get("description") as string) || null

  if (!name?.trim()) return

  await db.executionDomain.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  })

  revalidatePath("/topology")
}

export async function assignProjectToDomain(formData: FormData) {
  const projectId = formData.get("projectId") as string
  const executionDomainId = formData.get("executionDomainId") as string

  if (!projectId || !executionDomainId) return

  await db.projectExecutionDomain.upsert({
    where: { projectId_executionDomainId: { projectId, executionDomainId } },
    update: {},
    create: { projectId, executionDomainId },
  })

  revalidatePath("/topology")
}

export async function removeProjectFromDomain(projectId: string, executionDomainId: string) {
  await db.projectExecutionDomain.deleteMany({
    where: { projectId, executionDomainId },
  })
  revalidatePath("/topology")
}

// ── Shared Blocker CRUD -------------------------------------------------------

export async function createSharedBlocker(formData: FormData) {
  const title = formData.get("title") as string
  const severity = (formData.get("severity") as Criticality) ?? "MEDIUM"
  const description = (formData.get("description") as string) || null
  const projectIdsRaw = formData.get("projectIds") as string

  if (!title?.trim()) return

  const projectIds = projectIdsRaw
    ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : []

  const blocker = await db.sharedBlocker.create({
    data: {
      title,
      severity,
      description,
      affectedProjects: {
        create: projectIds.map((projectId) => ({ projectId })),
      },
    },
  })

  revalidatePath("/topology")
}

export async function resolveSharedBlocker(id: string) {
  await db.sharedBlocker.update({
    where: { id },
    data: { resolved: true },
  })
  revalidatePath("/topology")
}

export async function deleteSharedBlocker(id: string) {
  await db.sharedBlocker.delete({ where: { id } })
  revalidatePath("/topology")
}
