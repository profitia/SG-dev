"use server"

import { db } from "@/lib/db"
import { interpretInput } from "@/lib/ai/interpreter"
import { getAllProjects } from "./projects"
import { interpretationToTaskPayload, findPossibleDuplicates } from "@/lib/ai/mapper"
import { revalidatePath } from "next/cache"

export async function interpretCapture(rawInput: string) {
  const trimmed = rawInput.trim()
  if (!trimmed) return { ok: false as const, error: "Empty input" }

  // Run AI interpretation
  const result = await interpretInput(trimmed)
  if (!result.ok) return result

  const { data: interpretation } = result

  // Fetch projects for slug → id mapping
  const projects = await getAllProjects()

  // Map to task payload suggestion
  const taskPayload = interpretationToTaskPayload(interpretation, projects)

  // Keyword duplicate detection against active tasks
  const activeTasks = await db.task.findMany({
    where: { status: { notIn: ["DONE", "ARCHIVED"] } },
    select: { id: true, title: true, type: true, status: true },
    take: 200,
  })
  const possibleDuplicates = findPossibleDuplicates(interpretation, activeTasks)

  // Store interpretation in history (fire-and-forget)
  db.aiInterpretation
    .create({
      data: {
        rawInput: trimmed,
        result: interpretation as object,
        accepted: false,
      },
    })
    .catch((err) => console.error("[VECTOR AI] Failed to store interpretation:", err))

  return {
    ok: true as const,
    interpretation,
    taskPayload,
    possibleDuplicates,
  }
}

export async function acceptInterpretation(interpretationId: string, taskId: string) {
  await db.aiInterpretation.update({
    where: { id: interpretationId },
    data: { accepted: true, taskId },
  })
  revalidatePath("/")
}

export async function getAiHistory() {
  return db.aiInterpretation.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
