"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { z } from "zod"

const TaskTypeEnum = z.enum([
  "TASK", "BLOCKER", "IDEA", "DECISION", "BUG", "NOTE", "REFACTOR",
])

const PREFIX_MAP: Record<string, string> = {
  "/task": "TASK",
  "/blocker": "BLOCKER",
  "/idea": "IDEA",
  "/decision": "DECISION",
  "/note": "NOTE",
  "/bug": "BUG",
  "/refactor": "REFACTOR",
}

function parseCapture(raw: string): {
  type: string
  title: string
} {
  const trimmed = raw.trim()
  for (const [prefix, type] of Object.entries(PREFIX_MAP)) {
    if (trimmed.toLowerCase().startsWith(prefix + " ") || trimmed.toLowerCase() === prefix) {
      const title = trimmed.slice(prefix.length).trim()
      return { type, title: title || trimmed }
    }
  }
  return { type: "TASK", title: trimmed }
}

export async function captureToInbox(rawInput: string, projectId?: string) {
  if (!rawInput.trim()) return { error: "Empty input" }

  const { type, title } = parseCapture(rawInput)

  const item = await db.inboxItem.create({
    data: {
      rawInput: rawInput.trim(),
      interpretedTitle: title,
      type: type as "TASK" | "BLOCKER" | "IDEA" | "DECISION" | "BUG" | "NOTE" | "REFACTOR",
      processed: false,
      projectId: projectId ?? null,
    },
  })

  revalidatePath("/inbox")
  revalidatePath("/")
  return { data: item }
}

export async function getInboxItems(showProcessed = false) {
  return db.inboxItem.findMany({
    where: showProcessed ? {} : { processed: false },
    orderBy: { createdAt: "desc" },
  })
}

export async function processInboxItem(
  id: string,
  opts: {
    projectId: string
    etapId?: string
    subetapId?: string
    status?: string
    priority?: string
  }
) {
  const inboxItem = await db.inboxItem.findUnique({ where: { id } })
  if (!inboxItem) return { error: "Item not found" }

  // Create the real task
  const task = await db.task.create({
    data: {
      title: inboxItem.interpretedTitle,
      type: inboxItem.type,
      status: (opts.status as "PLANNED") ?? "PLANNED",
      priority: (opts.priority as "MEDIUM") ?? "MEDIUM",
      projectId: opts.projectId,
      etapId: opts.etapId ?? null,
      subetapId: opts.subetapId ?? null,
    },
  })

  // Mark inbox item as processed
  await db.inboxItem.update({
    where: { id },
    data: {
      processed: true,
      processedAt: new Date(),
      projectId: opts.projectId,
      taskId: task.id,
    },
  })

  revalidatePath("/inbox")
  revalidatePath("/")
  revalidatePath("/focus")
  return { data: task }
}

export async function deleteInboxItem(id: string) {
  await db.inboxItem.delete({ where: { id } })
  revalidatePath("/inbox")
  return { success: true }
}

export async function getInboxCount() {
  return db.inboxItem.count({ where: { processed: false } })
}
