"use server"

import { db } from "@/lib/db/prisma"
import { revalidatePath } from "next/cache"
import { emitEvent, getRecentEvents, getEventCountByCategory } from "@/lib/protocol/events/emitter"
import { createRuntimeExport } from "@/lib/protocol/runtime/runtime-exporter"
import { ingestRuntimeExport, getRuntimeExports, getRuntimeExportStats } from "@/lib/protocol/runtime/runtime-ingestion"
import { getWorkspaceIdentityMap, ensureWorkspaceProtocol } from "@/lib/protocol/workspaces/workspace-identity"
import { getPromptTemplates, seedBuiltInTemplates } from "@/lib/protocol/templates/execution-templates"
import { EVENT_TAXONOMY, EVENTS_BY_CATEGORY, EVENT_CATEGORIES } from "@/lib/protocol/events/taxonomy"
import { BUILT_IN_TEMPLATES } from "@/lib/protocol/prompts/prompt-generator"

// ── Protocol overview data ────────────────────────────────────────────────────

export async function getProtocolOverview() {
  const [
    eventCounts,
    exportStats,
    identityMap,
    recentEvents,
    templates,
  ] = await Promise.all([
    getEventCountByCategory(),
    getRuntimeExportStats(),
    getWorkspaceIdentityMap(),
    getRecentEvents({ limit: 20 }),
    getPromptTemplates(),
  ])

  return {
    eventCounts,
    exportStats,
    identityMap,
    recentEvents,
    templates,
    taxonomy: EVENT_TAXONOMY,
    taxonomyByCategory: EVENTS_BY_CATEGORY,
    categories: EVENT_CATEGORIES,
    builtInTemplates: BUILT_IN_TEMPLATES,
  }
}

// ── Emit a manual test event ──────────────────────────────────────────────────

export async function emitTestEvent(formData: FormData) {
  const type = formData.get("type") as string
  const category = formData.get("category") as string
  const projectId = formData.get("projectId") as string | null
  const workspaceId = formData.get("workspaceId") as string | null

  if (!type || !category) return

  await emitEvent({
    category: category as import("@/lib/protocol/schemas/event.schema").EventCategory,
    type: type as import("@/lib/protocol/schemas/event.schema").ExecutionEventType,
    projectId: projectId ?? undefined,
    workspaceId: workspaceId ?? undefined,
    payload: { manual: true, emittedAt: new Date().toISOString() },
    source: "vector:manual",
  })

  revalidatePath("/protocol")
}

// ── Create a runtime export snapshot ─────────────────────────────────────────

export async function triggerRuntimeExport(formData: FormData) {
  const workspaceId = formData.get("workspaceId") as string | null

  await createRuntimeExport({
    workspaceId: workspaceId ?? undefined,
    source: "vector",
  })

  revalidatePath("/protocol")
}

// ── Seed built-in prompt templates ───────────────────────────────────────────

export async function seedTemplates() {
  await seedBuiltInTemplates()
  revalidatePath("/protocol")
}

// ── Refresh workspace protocol identity ──────────────────────────────────────

export async function refreshWorkspaceProtocol(formData: FormData) {
  const workspaceId = formData.get("workspaceId") as string | null
  if (!workspaceId) return

  await ensureWorkspaceProtocol(workspaceId)
  revalidatePath("/protocol")
}

// ── Get recent events ─────────────────────────────────────────────────────────

export async function getProtocolEvents(options?: {
  workspaceId?: string
  category?: import("@/lib/protocol/schemas/event.schema").EventCategory
  limit?: number
}) {
  return getRecentEvents(options)
}

// ── Get runtime exports ───────────────────────────────────────────────────────

export async function getProtocolRuntimeExports(workspaceId?: string) {
  return getRuntimeExports({ workspaceId, limit: 20 })
}
