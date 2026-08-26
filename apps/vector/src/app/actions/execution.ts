"use server"

import { db } from "@/lib/db"

// ─────────────────────────────────────────────────────────────────────────────
// ETAP 09 — Execution Actions
// Task decomposition, readiness matrix, execution queue, wave management
// ─────────────────────────────────────────────────────────────────────────────

export async function getExecutionQueue() {
  const tasks = await db.implementationTask.findMany({
    include: {
      system: { select: { name: true, criticality: true } },
      stream: { select: { name: true, color: true } },
      wave:   { select: { name: true, order: true } },
      blockingDependencies: {
        include: {
          blockingTask: { select: { localId: true, title: true, readiness: true } },
        },
      },
    },
    orderBy: [
      { readiness: "asc" },
      { complexity: "asc" },
      { effort: "asc" },
    ],
  })

  const ready    = tasks.filter(t => t.readiness === "READY")
  const blocked  = tasks.filter(t => t.readiness === "BLOCKED")
  const planning = tasks.filter(t => t.readiness === "PLANNING")
  const notReady = tasks.filter(t => t.readiness === "NOT_READY")
  const inProg   = tasks.filter(t => t.readiness === "IN_PROGRESS")

  return { ready, blocked, planning, notReady, inProgress: inProg, all: tasks }
}

export async function getImplementationWaves() {
  return db.implementationWave.findMany({
    include: {
      tasks: {
        select: {
          id: true, localId: true, title: true, readiness: true,
          complexity: true, effort: true, status: true,
        },
      },
    },
    orderBy: { order: "asc" },
  })
}

export async function getTaskReadinessMatrix() {
  const tasks = await db.implementationTask.findMany({
    include: {
      system: { select: { name: true } },
      stream: { select: { name: true, color: true } },
      wave:   { select: { name: true, order: true } },
      blockingDependencies: {
        include: {
          blockingTask: { select: { localId: true, title: true, readiness: true } },
        },
      },
      blockedDependencies: {
        include: {
          blockedTask: { select: { localId: true, title: true } },
        },
      },
    },
    orderBy: { localId: "asc" },
  })

  const byReadiness = {
    READY:       tasks.filter(t => t.readiness === "READY"),
    BLOCKED:     tasks.filter(t => t.readiness === "BLOCKED"),
    IN_PROGRESS: tasks.filter(t => t.readiness === "IN_PROGRESS"),
    VALIDATION:  tasks.filter(t => t.readiness === "VALIDATION"),
    PLANNING:    tasks.filter(t => t.readiness === "PLANNING"),
    NOT_READY:   tasks.filter(t => t.readiness === "NOT_READY"),
    COMPLETE:    tasks.filter(t => t.readiness === "COMPLETE"),
  }

  return { tasks, byReadiness }
}

export async function getNextBuildableTasks() {
  return db.implementationTask.findMany({
    where: { readiness: "READY" },
    include: {
      system: { select: { name: true, criticality: true } },
      stream: { select: { name: true, color: true } },
      wave:   { select: { name: true, order: true } },
    },
    orderBy: [{ complexity: "asc" }, { effort: "asc" }],
  })
}

export async function getExecutionReadiness() {
  const [tasks, waves] = await Promise.all([
    db.implementationTask.findMany({ select: { readiness: true, effort: true, complexity: true } }),
    db.implementationWave.findMany({ select: { status: true } }),
  ])

  const readyCt    = tasks.filter(t => t.readiness === "READY").length
  const blockedCt  = tasks.filter(t => t.readiness === "BLOCKED").length
  const notReadyCt = tasks.filter(t => t.readiness === "NOT_READY").length
  const completeCt = tasks.filter(t => t.readiness === "COMPLETE").length
  const criticalCt = tasks.filter(t => t.complexity === "CRITICAL").length
  const totalEffort= tasks.reduce((s, t) => s + t.effort, 0)
  const readyEffort= tasks.filter(t => t.readiness === "READY").reduce((s, t) => s + t.effort, 0)

  return {
    totalTasks:   tasks.length,
    readyTasks:   readyCt,
    blockedTasks: blockedCt,
    notReadyTasks:notReadyCt,
    completeTasks:completeCt,
    criticalTasks:criticalCt,
    totalEffort,
    readyEffort,
    activeWaves:  waves.filter(w => w.status === "ACTIVE").length,
    healthScore:  Math.round((completeCt / Math.max(tasks.length, 1)) * 100),
    readinessRate:Math.round((readyCt / Math.max(tasks.length, 1)) * 100),
  }
}

export async function getExecutionPressure() {
  const tasks = await db.implementationTask.findMany({
    include: {
      stream: { select: { name: true, color: true } },
      wave:   { select: { name: true } },
    },
  })

  const streamLoad: Record<string, { count: number; effort: number; color: string }> = {}
  for (const t of tasks) {
    const key = t.stream?.name ?? "UNASSIGNED"
    if (!streamLoad[key]) streamLoad[key] = { count: 0, effort: 0, color: t.stream?.color ?? "#666" }
    streamLoad[key].count++
    streamLoad[key].effort += t.effort
  }

  const waveLoad: Record<string, { count: number; ready: number; blocked: number }> = {}
  for (const t of tasks) {
    const key = t.wave?.name ?? "UNASSIGNED"
    if (!waveLoad[key]) waveLoad[key] = { count: 0, ready: 0, blocked: 0 }
    waveLoad[key].count++
    if (t.readiness === "READY") waveLoad[key].ready++
    if (t.readiness === "BLOCKED") waveLoad[key].blocked++
  }

  const externalBlockers = [
    { id: "EXT-001", title: "Clerk production keys", blocks: ["RBAC-4", "SESSION-1"], severity: "CRITICAL" },
    { id: "EXT-002", title: "Render deployment config", blocks: ["production access"], severity: "HIGH" },
  ]

  return { streamLoad, waveLoad, externalBlockers }
}

// ─────────────────────────────────────────────────────────────────────────────
// ETAP 10 — BUILD Thread Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveBuildThread() {
  // Active build thread = ETAP 10 ORG tasks
  const [etap10, wave, orgTasks, readyTasksAll] = await Promise.all([
    db.etap.findFirst({
      where: { name: { contains: "ETAP 10" } },
      select: { id: true, name: true, description: true },
    }),
    db.implementationWave.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, order: true, status: true },
    }),
    db.implementationTask.findMany({
      where: { localId: { startsWith: "ORG-" } },
      include: {
        stream: { select: { name: true, color: true } },
        wave:   { select: { name: true, order: true } },
        blockingDependencies: {
          include: { blockingTask: { select: { localId: true, title: true, readiness: true } } },
        },
      },
      orderBy: { localId: "asc" },
    }),
    db.implementationTask.findMany({
      where: { readiness: "READY" },
      select: { localId: true, title: true, complexity: true, effort: true },
    }),
  ])

  const currentBuildNode = orgTasks.find(t => t.readiness === "READY") ?? orgTasks[0]
  const blockedNodes     = orgTasks.filter(t => t.readiness === "BLOCKED")
  const completedNodes   = orgTasks.filter(t => t.readiness === "COMPLETE")
  const notReadyNodes    = orgTasks.filter(t => t.readiness === "NOT_READY")

  return {
    etap10,
    wave,
    orgTasks,
    currentBuildNode,
    blockedNodes,
    completedNodes,
    notReadyNodes,
    allReadyTasks: readyTasksAll,
    externalBlockers: [
      { id: "EXT-001", title: "Clerk production keys", severity: "CRITICAL", impact: "Blocks RBAC-4 + SESSION-1 (auth stack incomplete)" },
      { id: "EXT-002", title: "Render deployment config", severity: "HIGH",     impact: "VECTOR not yet in production" },
    ],
    deploymentStatus: {
      github:    "COMPLETE — profitia/vector@main (4 commits)",
      render:    "PENDING — user action required",
      database:  "OPERATIONAL — Neon PostgreSQL",
      prisma:    "OPERATIONAL — 8 migrations applied",
      topology:  "OPERATIONAL — 15 systems, 18 deps",
      cognition: "OPERATIONAL — snapshot v1.3.0",
    },
  }
}

