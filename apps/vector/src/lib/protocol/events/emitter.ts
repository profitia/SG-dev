import { db } from "@/lib/db/prisma"
import type { EventCategory, ExecutionEventType } from "../schemas/event.schema"

// ── Emit a structured execution event to the DB ───────────────────────────────

export interface EmitEventInput {
  category: EventCategory
  type: ExecutionEventType
  workspaceId?: string
  projectId?: string
  payload?: Record<string, unknown>
  source?: string
}

export async function emitEvent(input: EmitEventInput) {
  return db.executionEvent.create({
    data: {
      category: input.category,
      type: input.type,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      payload: (input.payload ?? {}) as object,
      source: input.source ?? "vector",
    },
  })
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getRecentEvents(options?: {
  workspaceId?: string
  projectId?: string
  category?: EventCategory
  limit?: number
}) {
  return db.executionEvent.findMany({
    where: {
      workspaceId: options?.workspaceId,
      projectId: options?.projectId,
      category: options?.category,
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  })
}

export async function getEventCountByCategory() {
  const events = await db.executionEvent.groupBy({
    by: ["category"],
    _count: { id: true },
  })
  return events.map((e) => ({ category: e.category, count: e._count.id }))
}
