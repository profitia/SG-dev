"use server"

import { db } from "@/lib/db/prisma"

export async function getExecutionStreams() {
  return db.executionStream.findMany({
    orderBy: { order: "asc" },
    include: {
      coreSystems: {
        orderBy: { criticality: "asc" },
        include: {
          domain: { select: { name: true } },
          phase:  { select: { name: true, order: true } },
        },
      },
      subetaps: {
        orderBy: { order: "asc" },
        include: {
          etap: { select: { name: true, order: true } },
        },
      },
    },
  })
}

export async function getExecutionPhases() {
  return db.executionPhase.findMany({
    orderBy: { order: "asc" },
    include: {
      coreSystems: {
        orderBy: { criticality: "asc" },
        include: {
          domain:  { select: { name: true } },
          stream:  { select: { name: true, label: true, color: true } },
          phase:   { select: { name: true } },
        },
      },
      etaps: {
        orderBy: { order: "asc" },
        include: {
          tasks:    { select: { status: true } },
          subetaps: { select: { id: true } },
        },
      },
    },
  })
}

export async function getCriticalPath() {
  return db.criticalPathNode.findMany({
    orderBy: { order: "asc" },
    include: {
      system: {
        include: {
          domain:  { select: { name: true } },
          stream:  { select: { name: true, label: true, color: true } },
          phase:   { select: { name: true, order: true } },
          targetDependencies: {
            include: { targetSystem: { select: { name: true } } },
          },
        },
      },
    },
  })
}

export async function getCoreSystems() {
  return db.coreSystem.findMany({
    orderBy: [{ criticality: "asc" }, { name: "asc" }],
    include: {
      domain:  { select: { name: true, description: true } },
      stream:  { select: { name: true, label: true, color: true } },
      phase:   { select: { name: true, order: true } },
      sourceDependencies: {
        include: { targetSystem: { select: { id: true, name: true } } },
      },
      targetDependencies: {
        include: { sourceSystem: { select: { id: true, name: true } } },
      },
      criticalPathNodes: { select: { order: true, isBlocker: true } },
    },
  })
}

export async function getTopologyPressure() {
  const [systems, deps, criticalPath] = await Promise.all([
    db.coreSystem.findMany({
      include: {
        domain:  { select: { name: true } },
        stream:  { select: { name: true } },
        sourceDependencies: true,
        targetDependencies: true,
      },
    }),
    db.systemDependency.findMany(),
    db.criticalPathNode.findMany({ orderBy: { order: "asc" } }),
  ])

  // Domain load
  const domainLoad: Record<string, number> = {}
  for (const s of systems) {
    const d = s.domain?.name ?? "UNKNOWN"
    domainLoad[d] = (domainLoad[d] ?? 0) + 1
  }

  // Stream load
  const streamLoad: Record<string, number> = {}
  for (const s of systems) {
    const st = s.stream?.name ?? "UNKNOWN"
    streamLoad[st] = (streamLoad[st] ?? 0) + 1
  }

  // Dependency concentration
  const depConcentration = systems
    .map((s) => ({
      name:       s.name,
      inDegree:   s.targetDependencies.length,  // systems that depend on this
      outDegree:  s.sourceDependencies.length,   // systems this depends on
      total:      s.targetDependencies.length + s.sourceDependencies.length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const overloadedDomains = Object.entries(domainLoad)
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => ({ name, count }))

  const overloadedStreams = Object.entries(streamLoad)
    .filter(([, count]) => count >= 4)
    .map(([name, count]) => ({ name, count }))

  const criticalDeps = deps.filter((d) => d.criticality === "CRITICAL").length
  const blockers = criticalPath.filter((n) => n.isBlocker).length

  return {
    domainLoad,
    streamLoad,
    overloadedDomains,
    overloadedStreams,
    depConcentration,
    totalSystems:     systems.length,
    totalDeps:        deps.length,
    criticalDeps,
    criticalPathLen:  criticalPath.length,
    blockers,
    orchestrationPressure: criticalDeps > 8 ? "HIGH" : criticalDeps > 4 ? "MEDIUM" : "LOW",
    fragmentationRisk:     systems.filter(s => s.sourceDependencies.length === 0 && s.targetDependencies.length === 0).length > 2 ? "HIGH" : "LOW",
  }
}
