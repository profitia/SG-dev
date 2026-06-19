import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'

export type EventSourceTable =
  | 'conversation_artifacts'
  | 'prompt_executions'
  | 'execution_logs'
  | 'decisions'
  | 'architecture_warnings'
  | 'changed_files'
  | 'archive_artifacts'

export type EventType =
  | 'CONVERSATION_SAVED'
  | 'PROMPT_EXECUTION_SAVED'
  | 'EXECUTION_LOG_SAVED'
  | 'DECISION_CREATED'
  | 'WARNING_CREATED'
  | 'FILE_CHANGED'
  | 'CLOSEOUT_SAVED'
  | 'EXECUTION_TRAIL_RECORDED'

export type EventRow = {
  id: string
  eventType: EventType
  timestamp: Date
  sourceTable: EventSourceTable
  taskId: string | null
  title: string
  rawRecordId: string
}

export type EventLedgerStats = {
  eventCount: number
  taskCount: number
  conversationCount: number
  closeoutCount: number
  executionTrailCount: number
}

export type EventLedgerSourceRecord = {
  sourceTable: EventSourceTable
  record: Prisma.JsonObject
  rawJson: Prisma.JsonValue | null
}

export type EventLedgerData = {
  events: EventRow[]
  stats: EventLedgerStats
  sourceRecords: Record<string, EventLedgerSourceRecord>
}

type ArchiveEventSourceKind = 'PMOS_CLOSEOUTS' | 'PMOS_EXECUTION_TRAILS'

type ArchiveArtifactEventRecord = {
  id: string
  artifactKey: string
  recordId: string | null
  path: string | null
  rawPayload: Prisma.JsonValue | null
  metadata: Prisma.JsonValue | null
  observedAt: Date | null
  createdAt: Date
  source: {
    sourceKind: string
    sourceKey: string
  }
}

const ARCHIVE_EVENT_SOURCE_KINDS = [
  'PMOS_CLOSEOUTS',
  'PMOS_EXECUTION_TRAILS',
] as const

function toJsonObject(value: unknown): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.JsonObject
}

function getArchiveArtifactTitle(artifact: {
  path: string | null
  artifactKey: string
  source: { sourceKind: string }
}): string {
  const pathPart = artifact.path?.split('/').pop() ?? artifact.artifactKey
  if (artifact.source.sourceKind === 'PMOS_CLOSEOUTS') {
    return pathPart
  }
  if (artifact.source.sourceKind === 'PMOS_EXECUTION_TRAILS') {
    return pathPart
  }
  return artifact.artifactKey
}

function getArchiveArtifactTaskId(rawPayload: Prisma.JsonValue | null, pathValue: string | null): string | null {
  if (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    const payload = rawPayload as Record<string, unknown>
    const directTaskId = payload.taskId
    if (typeof directTaskId === 'string' && directTaskId.length > 0) {
      return directTaskId
    }

    const closeoutTaskId = payload.pmosSaveDbRecordId
    if (typeof closeoutTaskId === 'string' && closeoutTaskId.length > 0) {
      return closeoutTaskId
    }
  }

  if (!pathValue) return null

  const fileName = pathValue.split('/').pop() ?? ''
  const match = fileName.match(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}_(.+?)(?:\.closeout\.json|\.execution-trail\.(?:jsonl|md))$/)
  return match?.[1] ?? null
}

export async function eventLedgerQuery(): Promise<EventLedgerData> {
  const archiveArtifactDelegate = (db as unknown as {
    archiveArtifact: {
      findMany: (args: unknown) => Promise<ArchiveArtifactEventRecord[]>
    }
  }).archiveArtifact

  const [
    conversations,
    prompts,
    logs,
    decisions,
    warnings,
    changedFiles,
    archiveArtifacts,
  ] = await Promise.all([
    db.conversationArtifact.findMany({
      orderBy: { timestamp: 'desc' },
      take: 250,
    }),
    db.promptExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    db.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    db.decision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    db.architectureWarning.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    db.changedFile.findMany({
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    archiveArtifactDelegate.findMany({
      where: {
        source: {
          sourceKind: {
            in: [...ARCHIVE_EVENT_SOURCE_KINDS],
          },
        },
      },
      orderBy: { observedAt: 'desc' },
      take: 250,
      include: {
        source: { select: { sourceKind: true, sourceKey: true } },
      },
    }),
  ])

  const sourceRecords: Record<string, EventLedgerSourceRecord> = {}

  const conversationEvents: EventRow[] = conversations.map((record) => {
    sourceRecords[`conversation_artifacts:${record.id}`] = {
      sourceTable: 'conversation_artifacts',
      record: toJsonObject(record),
      rawJson: record.flightRecordJson,
    }
    return {
      id: `conversation_artifacts:${record.id}`,
      eventType: 'CONVERSATION_SAVED',
      timestamp: record.timestamp,
      sourceTable: 'conversation_artifacts',
      taskId: record.taskId ?? null,
      title: record.summary || record.conversationId,
      rawRecordId: record.id,
    }
  })

  const promptEvents: EventRow[] = prompts.map((record) => {
    sourceRecords[`prompt_executions:${record.id}`] = {
      sourceTable: 'prompt_executions',
      record: toJsonObject(record),
      rawJson: null,
    }
    return {
      id: `prompt_executions:${record.id}`,
      eventType: 'PROMPT_EXECUTION_SAVED',
      timestamp: record.createdAt,
      sourceTable: 'prompt_executions',
      taskId: null,
      title: record.title,
      rawRecordId: record.id,
    }
  })

  const logEvents: EventRow[] = logs.map((record) => {
    sourceRecords[`execution_logs:${record.id}`] = {
      sourceTable: 'execution_logs',
      record: toJsonObject(record),
      rawJson: null,
    }
    return {
      id: `execution_logs:${record.id}`,
      eventType: 'EXECUTION_LOG_SAVED',
      timestamp: record.createdAt,
      sourceTable: 'execution_logs',
      taskId: null,
      title: record.title,
      rawRecordId: record.id,
    }
  })

  const decisionEvents: EventRow[] = decisions.map((record) => {
    sourceRecords[`decisions:${record.id}`] = {
      sourceTable: 'decisions',
      record: toJsonObject(record),
      rawJson: null,
    }
    return {
      id: `decisions:${record.id}`,
      eventType: 'DECISION_CREATED',
      timestamp: record.createdAt,
      sourceTable: 'decisions',
      taskId: null,
      title: record.title,
      rawRecordId: record.id,
    }
  })

  const warningEvents: EventRow[] = warnings.map((record) => {
    sourceRecords[`architecture_warnings:${record.id}`] = {
      sourceTable: 'architecture_warnings',
      record: toJsonObject(record),
      rawJson: null,
    }
    return {
      id: `architecture_warnings:${record.id}`,
      eventType: 'WARNING_CREATED',
      timestamp: record.createdAt,
      sourceTable: 'architecture_warnings',
      taskId: null,
      title: record.title,
      rawRecordId: record.id,
    }
  })

  const changedFileEvents: EventRow[] = changedFiles.map((record) => {
    sourceRecords[`changed_files:${record.id}`] = {
      sourceTable: 'changed_files',
      record: toJsonObject(record),
      rawJson: null,
    }
    return {
      id: `changed_files:${record.id}`,
      eventType: 'FILE_CHANGED',
      timestamp: record.createdAt,
      sourceTable: 'changed_files',
      taskId: null,
      title: record.path,
      rawRecordId: record.id,
    }
  })

  const archiveEvents: EventRow[] = archiveArtifacts
    .filter((record) => record.observedAt)
    .map((record) => {
      sourceRecords[`archive_artifacts:${record.id}`] = {
        sourceTable: 'archive_artifacts',
        record: toJsonObject(record),
        rawJson: record.rawPayload,
      }

      const isCloseout = record.source.sourceKind === 'PMOS_CLOSEOUTS'
      return {
        id: `archive_artifacts:${record.id}`,
        eventType: isCloseout ? 'CLOSEOUT_SAVED' : 'EXECUTION_TRAIL_RECORDED',
        timestamp: record.observedAt ?? record.createdAt,
        sourceTable: 'archive_artifacts',
        taskId: getArchiveArtifactTaskId(record.rawPayload, record.path),
        title: getArchiveArtifactTitle(record),
        rawRecordId: record.id,
      }
    })

  const events = [
    ...conversationEvents,
    ...promptEvents,
    ...logEvents,
    ...decisionEvents,
    ...warningEvents,
    ...changedFileEvents,
    ...archiveEvents,
  ].sort((left, right) => {
    const timeDiff = right.timestamp.getTime() - left.timestamp.getTime()
    if (timeDiff !== 0) return timeDiff
    return left.id.localeCompare(right.id)
  })

  const taskIds = new Set(events.map((event) => event.taskId).filter((taskId): taskId is string => Boolean(taskId)))
  const closeoutCount = archiveEvents.filter((event) => event.eventType === 'CLOSEOUT_SAVED').length
  const executionTrailCount = archiveEvents.filter((event) => event.eventType === 'EXECUTION_TRAIL_RECORDED').length

  return {
    events,
    stats: {
      eventCount: events.length,
      taskCount: taskIds.size,
      conversationCount: conversationEvents.length,
      closeoutCount,
      executionTrailCount,
    },
    sourceRecords,
  }
}