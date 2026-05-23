import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
// Cache-friendly: revalidate every 60s in future CDN setups
export const revalidate = 0

export async function GET() {
  const [activeEtap, recentLogs, principles, warnings] = await Promise.all([
    // Active ETAP: first in_progress root node in active scope
    db.roadmapNode.findFirst({
      where: { parentId: null, status: 'in_progress', scope: 'active' },
      orderBy: { sortKey: 'asc' },
      include: {
        tags: { include: { tag: true } },
        children: {
          orderBy: { order: 'asc' },
          where: { status: { in: ['in_progress', 'backlog'] } },
          include: { tags: { include: { tag: true } } },
          take: 8,
        },
      },
    }),
    // Recent execution logs — last 3
    db.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { title: true, summary: true },
    }),
    // High-priority principles
    db.canonicalPrinciple.findMany({
      where: { priority: 'high' },
      select: { title: true },
      orderBy: { createdAt: 'asc' },
      take: 6,
    }),
    // Active (unresolved) warnings
    db.architectureWarning.findMany({
      where: { resolved: false },
      select: { title: true, severity: true, type: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  // ── Derive active node (first in_progress child, or ETAP itself) ──
  const activeChild = activeEtap?.children.find((c) => c.status === 'in_progress')
  const activeNode = activeChild ?? null

  // ── Derive active domains from tags on ETAP + active child ──
  const domainSet = new Set<string>()
  if (activeEtap) {
    activeEtap.tags.forEach((t) => domainSet.add(t.tag.name))
  }
  if (activeChild) {
    activeChild.tags.forEach((t) => domainSet.add(t.tag.name))
  }
  const activeDomains = Array.from(domainSet)

  // ── Suggested next step: first backlog child of active ETAP ──
  const nextChild = activeEtap?.children.find((c) => c.status === 'backlog')
  const nextSuggestedStep = nextChild?.title ?? null

  // ── Extract ETAP label (strip "ETAP N — " prefix nicely) ──
  const etapLabel = activeEtap?.title ?? null

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      activeEtap: etapLabel,
      activeNode: activeNode?.title ?? null,
      activeDomains,
      relatedPrinciples: principles.map((p) => p.title),
      recentExecutions: recentLogs.map((l) => ({
        title: l.title,
        summary: l.summary ?? null,
      })),
      activeWarnings: warnings.map((w) => ({
        title: w.title,
        severity: w.severity,
        type: w.type,
      })),
      nextSuggestedStep,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  )
}
