// VECTOR Workspace Generator — Instantiates a full execution workspace from an archetype
// Creates: Workspace → Projects + ETAPs → Execution Domains → Topology → Conventions

import { db } from "@/lib/db/prisma"
import { ARCHETYPES, type WorkspaceArchetype } from "./archetypes"

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export interface GeneratorInput {
  name: string
  archetype: WorkspaceArchetype
  description?: string
}

export async function generateWorkspace(input: GeneratorInput) {
  const template = ARCHETYPES[input.archetype]
  const workspaceSlug = toSlug(input.name)

  return db.$transaction(async (tx) => {
    // ── 1. Create workspace record ───────────────────────────────────────────
    const workspace = await tx.workspace.create({
      data: {
        name: input.name,
        slug: workspaceSlug,
        // Prisma enums are string-typed in practice; cast via "as any" is safe here
        archetype: input.archetype as any,
        description: input.description ?? template.description,
      },
    })

    // ── 2. Create projects + ETAPs ───────────────────────────────────────────
    const projectMap = new Map<string, string>() // template project name → db ID

    for (let pi = 0; pi < template.projects.length; pi++) {
      const pDef = template.projects[pi]
      const projectSlug = `${workspaceSlug}--${toSlug(pDef.name)}`

      const project = await tx.project.create({
        data: {
          name: pDef.name,
          slug: projectSlug,
          description: pDef.description,
          workspaceId: workspace.id,
        },
      })

      projectMap.set(pDef.name, project.id)

      // Create ETAPs in order
      for (let ei = 0; ei < pDef.etaps.length; ei++) {
        await tx.etap.create({
          data: {
            name: pDef.etaps[ei],
            order: ei,
            projectId: project.id,
          },
        })
      }
    }

    // ── 3. Execution domains (upsert by name — shared globally) ─────────────
    for (const domainDef of template.executionDomains) {
      const domain = await tx.executionDomain.upsert({
        where: { name: domainDef.name },
        update: {},
        create: { name: domainDef.name },
      })

      for (const projectName of domainDef.projectNames) {
        const projectId = projectMap.get(projectName)
        if (!projectId) continue

        await tx.projectExecutionDomain.upsert({
          where: {
            projectId_executionDomainId: { projectId, executionDomainId: domain.id },
          },
          update: {},
          create: { projectId, executionDomainId: domain.id },
        })
      }
    }

    // ── 4. Topology — project-to-project dependencies ────────────────────────
    for (const edge of template.topology) {
      const sourceProjectId = projectMap.get(edge.from)
      const targetProjectId = projectMap.get(edge.to)
      if (!sourceProjectId || !targetProjectId) continue

      await tx.projectDependency.upsert({
        where: {
          sourceProjectId_targetProjectId_dependencyType: {
            sourceProjectId,
            targetProjectId,
            dependencyType: edge.type as any,
          },
        },
        update: {},
        create: {
          sourceProjectId,
          targetProjectId,
          dependencyType: edge.type as any,
          criticality: edge.criticality as any,
        },
      })
    }

    // ── 5. Workspace conventions ─────────────────────────────────────────────
    for (const [key, value] of Object.entries(template.conventions)) {
      await tx.workspaceConvention.create({
        data: { workspaceId: workspace.id, key, value },
      })
    }

    return workspace
  })
}
