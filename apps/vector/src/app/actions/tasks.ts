"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { z } from "zod"

const TaskTypeEnum = z.enum([
  "TASK", "BLOCKER", "IDEA", "DECISION", "BUG", "NOTE", "REFACTOR",
])
const TaskStatusEnum = z.enum([
  "PLANNED", "ACTIVE", "BLOCKED", "REVIEW", "DONE", "ARCHIVED",
])
const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  type: TaskTypeEnum.optional().default("TASK"),
  status: TaskStatusEnum.optional().default("PLANNED"),
  priority: PriorityEnum.optional().default("MEDIUM"),
  projectId: z.string(),
  etapId: z.string().optional().nullable(),
  subetapId: z.string().optional().nullable(),
})

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string(),
})

async function getProjectSlug(projectId: string) {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  })
  return p?.slug
}

function revalidateAll(slug?: string) {
  revalidatePath("/")
  revalidatePath("/focus")
  revalidatePath("/backlog")
  revalidatePath("/blockers")
  if (slug) revalidatePath(`/projects/${slug}`)
}

export async function createTask(data: z.input<typeof CreateTaskSchema>) {
  const parsed = CreateTaskSchema.parse(data)
  const task = await db.task.create({ data: parsed })
  const slug = await getProjectSlug(parsed.projectId)
  revalidateAll(slug)
  return { data: task }
}

export async function updateTask(data: z.infer<typeof UpdateTaskSchema>) {
  const { id, ...rest } = UpdateTaskSchema.parse(data)
  const task = await db.task.update({
    where: { id },
    data: rest,
  })
  const slug = await getProjectSlug(task.projectId)
  revalidateAll(slug)
  return { data: task }
}

export async function updateTaskStatus(id: string, status: string) {
  const parsed = TaskStatusEnum.parse(status)
  const task = await db.task.update({
    where: { id },
    data: { status: parsed },
  })
  const slug = await getProjectSlug(task.projectId)
  revalidateAll(slug)
  return { data: task }
}

export async function updateTaskPriority(id: string, priority: string) {
  const parsed = PriorityEnum.parse(priority)
  const task = await db.task.update({
    where: { id },
    data: { priority: parsed },
  })
  const slug = await getProjectSlug(task.projectId)
  revalidateAll(slug)
  return { data: task }
}

export async function deleteTask(id: string) {
  const task = await db.task.findUnique({ where: { id } })
  if (!task) return { error: "Task not found" }

  await db.task.delete({ where: { id } })
  const slug = await getProjectSlug(task.projectId)
  revalidateAll(slug)
  return { success: true }
}

export async function moveTask(
  id: string,
  opts: { etapId?: string | null; subetapId?: string | null; projectId?: string }
) {
  const task = await db.task.update({
    where: { id },
    data: opts,
  })
  const slug = await getProjectSlug(task.projectId)
  revalidateAll(slug)
  return { data: task }
}

export async function getAllTasks() {
  return db.task.findMany({
    where: { status: { not: "ARCHIVED" }, project: { status: { not: "ARCHIVED" } } },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    include: { project: { select: { id: true, name: true, slug: true } } },
  })
}

export async function getActiveTasks() {
  return db.task.findMany({
    where: { status: "ACTIVE", project: { status: { not: "ARCHIVED" } } },
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { name: true, slug: true } } },
  })
}

export async function getBlockers() {
  return db.task.findMany({
    where: { status: "BLOCKED", project: { status: { not: "ARCHIVED" } } },
    orderBy: { priority: "desc" },
    include: { project: { select: { name: true, slug: true } } },
  })
}

export async function getBacklog() {
  return db.task.findMany({
    where: { status: "PLANNED", project: { status: { not: "ARCHIVED" } } },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { name: true, slug: true } } },
  })
}

export async function getDashboardData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [projects, activeTasks, blockers, recentTasks, staleTasks, etaps] =
    await Promise.all([
      db.project.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { tasks: true, etaps: true } } },
      }),
      db.task.findMany({
        where: { status: "ACTIVE", project: { status: { not: "ARCHIVED" } } },
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: { project: { select: { name: true, slug: true } } },
      }),
      db.task.findMany({
        where: { status: "BLOCKED", project: { status: { not: "ARCHIVED" } } },
        orderBy: { priority: "desc" },
        include: { project: { select: { name: true, slug: true } } },
      }),
      db.task.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        where: { status: { in: ["ACTIVE", "DONE", "REVIEW"] }, project: { status: { not: "ARCHIVED" } } },
        include: { project: { select: { name: true, slug: true } } },
      }),
      db.task.findMany({
        where: {
          status: { in: ["ACTIVE", "PLANNED"] },
          updatedAt: { lt: sevenDaysAgo },
          project: { status: { not: "ARCHIVED" } },
        },
        take: 5,
        orderBy: { updatedAt: "asc" },
        include: { project: { select: { name: true, slug: true } } },
      }),
      db.etap.findMany({
        where: {
          project: { status: "ACTIVE" },
        },
        include: {
          project: { select: { name: true, slug: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { order: "asc" },
        take: 10,
      }),
    ])

  return { projects, activeTasks, blockers, recentTasks, staleTasks, etaps }
}

export async function addDependency(
  blockingTaskId: string,
  blockedTaskId: string
) {
  const dep = await db.dependency.create({
    data: { blockingTaskId, blockedTaskId },
  })
  revalidatePath("/dependencies")
  revalidatePath("/")
  return { data: dep }
}

export async function removeDependency(id: string) {
  await db.dependency.delete({ where: { id } })
  revalidatePath("/dependencies")
  return { success: true }
}

export async function getDependencies() {
  return db.dependency.findMany({
    include: {
      blockingTask: {
        include: { project: { select: { name: true, slug: true } } },
      },
      blockedTask: {
        include: { project: { select: { name: true, slug: true } } },
      },
    },
  })
}
