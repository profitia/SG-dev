"use server"

import { db } from "@/lib/db"
import { runCognition } from "@/lib/cognition/recommendations"
import type { CognitionInput, CognitionOutput } from "@/lib/cognition/signals"

export async function getCognitionOutput(): Promise<CognitionOutput> {
  const [projects, tasks, etaps] = await Promise.all([
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true, slug: true, status: true },
    }),
    db.task.findMany({
      where: { status: { notIn: ["ARCHIVED"] } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        type: true,
        projectId: true,
        etapId: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true, slug: true } },
      },
    }),
    db.etap.findMany({
      where: { project: { status: { not: "ARCHIVED" } } },
      select: {
        id: true,
        name: true,
        order: true,
        projectId: true,
        project: { select: { id: true, name: true, slug: true } },
      },
    }),
  ])

  const input: CognitionInput = {
    projects: projects.map((p) => ({ ...p, status: p.status as string })),
    tasks: tasks.map((t) => ({
      ...t,
      status: t.status as string,
      priority: t.priority as string,
      type: t.type as string,
    })),
    etaps,
  }

  const output = runCognition(input)

  // Store snapshot for observability — fire-and-forget
  db.cognitionSnapshot
    .create({ data: { output: JSON.parse(JSON.stringify(output)) } })
    .catch(() => {})

  return output
}

export async function getCognitionHistory(limit = 20) {
  return db.cognitionSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      output: true,
      createdAt: true,
    },
  })
}
