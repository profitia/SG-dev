"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { z } from "zod"

const CreateEtapSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string(),
  order: z.number().int().default(0),
})

const CreateSubetapSchema = z.object({
  name: z.string().min(1).max(200),
  etapId: z.string(),
  order: z.number().int().default(0),
})

export async function createEtap(data: z.infer<typeof CreateEtapSchema>) {
  const parsed = CreateEtapSchema.parse(data)

  // Auto-set order to last
  const lastEtap = await db.etap.findFirst({
    where: { projectId: parsed.projectId },
    orderBy: { order: "desc" },
  })
  const order = lastEtap ? lastEtap.order + 1 : 0

  const etap = await db.etap.create({
    data: { ...parsed, order },
  })

  const project = await db.project.findUnique({
    where: { id: parsed.projectId },
    select: { slug: true },
  })
  if (project) revalidatePath(`/projects/${project.slug}`)
  revalidatePath("/")
  return { data: etap }
}

export async function updateEtap(id: string, name: string) {
  const etap = await db.etap.update({
    where: { id },
    data: { name },
    include: { project: { select: { slug: true } } },
  })
  revalidatePath(`/projects/${etap.project.slug}`)
  return { data: etap }
}

export async function deleteEtap(id: string) {
  const etap = await db.etap.findUnique({
    where: { id },
    include: { project: { select: { slug: true } } },
  })
  if (!etap) return { error: "Etap not found" }

  await db.etap.delete({ where: { id } })
  revalidatePath(`/projects/${etap.project.slug}`)
  revalidatePath("/")
  return { success: true }
}

export async function reorderEtaps(
  projectId: string,
  etapIds: string[]
) {
  await Promise.all(
    etapIds.map((id, index) =>
      db.etap.update({ where: { id }, data: { order: index } })
    )
  )

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  })
  if (project) revalidatePath(`/projects/${project.slug}`)
  return { success: true }
}

export async function createSubetap(data: z.infer<typeof CreateSubetapSchema>) {
  const parsed = CreateSubetapSchema.parse(data)

  const lastSub = await db.subetap.findFirst({
    where: { etapId: parsed.etapId },
    orderBy: { order: "desc" },
  })
  const order = lastSub ? lastSub.order + 1 : 0

  const subetap = await db.subetap.create({
    data: { ...parsed, order },
    include: { etap: { include: { project: { select: { slug: true } } } } },
  })

  revalidatePath(`/projects/${subetap.etap.project.slug}`)
  return { data: subetap }
}

export async function deleteSubetap(id: string) {
  const sub = await db.subetap.findUnique({
    where: { id },
    include: { etap: { include: { project: { select: { slug: true } } } } },
  })
  if (!sub) return { error: "Subetap not found" }

  await db.subetap.delete({ where: { id } })
  revalidatePath(`/projects/${sub.etap.project.slug}`)
  return { success: true }
}
