import { createHash } from "crypto"
import type { PrismaClient } from "@prisma/client"

import { createTextIntegrityMetadata } from "../../../../../packages/governance/src/index.ts"

type RuntimeAuthorityDb = Pick<PrismaClient, "executionLog" | "conversationArtifact" | "canonicalPrinciple" | "architectureWarning">

export interface RuntimeWarningSnapshot {
  title: string
  severity: string
  type: string
}

export interface RuntimeExecutionSnapshot {
  title: string
  summary: string | null
  recordedAt: string
}

export interface RuntimeAuthoritySnapshot {
  generatedAt: string
  relatedPrinciples: string[]
  recentExecutions: RuntimeExecutionSnapshot[]
  activeWarnings: RuntimeWarningSnapshot[]
}

function hashRuntimeState(snapshot: Omit<RuntimeAuthoritySnapshot, "generatedAt">): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
}

export async function readRuntimeAuthoritySnapshot(db: RuntimeAuthorityDb): Promise<RuntimeAuthoritySnapshot> {
  const [recentLogs, recentConversations, principles, warnings] = await Promise.all([
    db.executionLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { title: true, summary: true, createdAt: true } }),
    db.conversationArtifact.findMany({ orderBy: { timestamp: "desc" }, take: 6, select: { taskId: true, summary: true, timestamp: true } }),
    db.canonicalPrinciple.findMany({ where: { priority: "high" }, select: { title: true }, orderBy: { createdAt: "asc" }, take: 6 }),
    db.architectureWarning.findMany({ where: { resolved: false }, select: { title: true, severity: true, type: true }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }], take: 5 }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    relatedPrinciples: principles.map((principle) => principle.title),
    recentExecutions: [
      ...recentLogs.map((log) => ({ title: log.title, summary: log.summary ?? null, recordedAt: log.createdAt.toISOString() })),
      ...recentConversations.map((conversation) => ({
        title: conversation.taskId ? `[PMOS] ${conversation.taskId}` : "[PMOS] Saved conversation artifact",
        summary: conversation.summary ?? null,
        recordedAt: conversation.timestamp.toISOString(),
      })),
    ].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)).slice(0, 3),
    activeWarnings: warnings.map((warning) => ({ title: warning.title, severity: warning.severity, type: warning.type })),
  }
}

export function renderRuntimeAuthorityMarkdown(snapshot: RuntimeAuthoritySnapshot): string {
  const runtimeStateHash = hashRuntimeState({
    relatedPrinciples: snapshot.relatedPrinciples,
    recentExecutions: snapshot.recentExecutions,
    activeWarnings: snapshot.activeWarnings,
  })

  const lines: string[] = [
    `<!-- PMOS Runtime Authority | state-hash: ${runtimeStateHash} -->`,
    "# PMOS Runtime Context - SpendGuru 2.0",
    "",
    `> Generated: ${snapshot.generatedAt}`,
    "> Authority: PMOS DB -> runtime authority -> runtime-context.md",
    "> Ownership: PMOS",
    "",
    "---",
    "",
    "## GUIDING PRINCIPLES",
    "",
  ]

  if (snapshot.relatedPrinciples.length > 0) snapshot.relatedPrinciples.forEach((principle) => lines.push(`- ${principle}`))
  else lines.push("_none_")

  lines.push("", "## ACTIVE WARNINGS", "")
  if (snapshot.activeWarnings.length > 0) snapshot.activeWarnings.forEach((warning) => lines.push(`- [${warning.severity}] ${warning.title} (${warning.type})`))
  else lines.push("_none_")

  lines.push("", "## RECENT EXECUTION SIGNALS", "")
  if (snapshot.recentExecutions.length > 0) {
    snapshot.recentExecutions.forEach((execution, index) => {
      lines.push(`${index + 1}. ${execution.title}`)
      if (execution.summary) lines.push(`   ${execution.summary}`)
    })
  } else {
    lines.push("_none_")
  }

  lines.push("", "---", "", "_Derived execution snapshot only. PMOS DB remains canonical._")
  return lines.join("\n")
}

export function buildRuntimeAuthorityIntegrity(snapshot: RuntimeAuthoritySnapshot, content: string) {
  const runtimeStateHash = hashRuntimeState({
    relatedPrinciples: snapshot.relatedPrinciples,
    recentExecutions: snapshot.recentExecutions,
    activeWarnings: snapshot.activeWarnings,
  })

  return {
    ...createTextIntegrityMetadata(content, {
      generatedBy: "apps/pmos/scripts/build-runtime-context.ts",
      sourceRuntime: "PMOS",
      sourceProjection: "runtime-context.md",
    }),
    runtimeStateHash,
  }
}