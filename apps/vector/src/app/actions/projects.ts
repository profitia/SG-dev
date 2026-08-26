"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { z } from "zod"

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  description: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "DONE", "ARCHIVED"]).default("ACTIVE").optional(),
})

const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string(),
})

export async function createProject(data: z.infer<typeof CreateProjectSchema>) {
  const parsed = CreateProjectSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Check slug uniqueness
  const existing = await db.project.findUnique({
    where: { slug: parsed.data.slug },
  })
  if (existing) {
    return { error: { slug: ["Slug already taken"] } }
  }

  const project = await db.project.create({ data: parsed.data })
  revalidatePath("/projects")
  revalidatePath("/")
  return { data: project }
}

export async function updateProject(data: z.infer<typeof UpdateProjectSchema>) {
  const { id, ...rest } = UpdateProjectSchema.parse(data)
  const project = await db.project.update({
    where: { id },
    data: rest,
  })
  revalidatePath("/projects")
  revalidatePath(`/projects/${project.slug}`)
  revalidatePath("/")
  return { data: project }
}

export async function deleteProject(id: string) {
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return { error: "Project not found" }

  await db.project.delete({ where: { id } })
  revalidatePath("/projects")
  revalidatePath("/")
  return { success: true }
}

export async function archiveProject(id: string) {
  const project = await db.project.update({
    where: { id },
    data: { status: "ARCHIVED" },
  })
  revalidatePath("/projects")
  revalidatePath(`/projects/${project.slug}`)
  revalidatePath("/")
  return { data: project }
}

export async function getProjects() {
  return db.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tasks: true, etaps: true } },
    },
  })
}

export async function getAllProjects() {
  return db.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tasks: true, etaps: true } },
    },
  })
}

export async function getProjectBySlug(slug: string) {
  return db.project.findUnique({
    where: { slug },
    include: {
      etaps: {
        orderBy: { order: "asc" },
        include: {
          subetaps: {
            orderBy: { order: "asc" },
            include: {
              tasks: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
          tasks: {
            where: { subetapId: null },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { tasks: true } },
        },
      },
      tasks: {
        where: { etapId: null },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { tasks: true, etaps: true } },
    },
  })
}

export async function getAllEtaps() {
  return db.etap.findMany({
    where: { project: { status: { not: "ARCHIVED" } } },
    orderBy: [{ project: { updatedAt: "desc" } }, { order: "asc" }],
    include: {
      project: { select: { id: true, name: true, slug: true, status: true } },
      tasks: {
        select: { id: true, status: true },
      },
      _count: { select: { tasks: true } },
    },
  })
}

export type EtapWithProgress = Awaited<ReturnType<typeof getAllEtaps>>[number]
