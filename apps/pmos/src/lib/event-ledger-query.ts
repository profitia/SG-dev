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
  runtimeContext: string | null
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
  linkedConversation: {
    record: Prisma.JsonObject
    rawJson: Prisma.JsonValue | null
  } | null
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

type ArchiveSourceEventRecord = {
  sourceKind: string
  sourceKey: string
  artifacts: ArchiveArtifactEventRecord[]
}

type ConversationEventRecord = {
  id: string
  conversationId: string
  timestamp: Date
  taskId: string | null
  scope: string | null
  etap: string | null
  subetap: string | null
  summary: string
  flightRecordJson: Prisma.JsonValue | null
  filesPath?: string | null
}

type LinkedConversationRecord = {
  conversation: {
    id: string
    conversationId: string
    timestamp: Date
    taskId: string | null
    scope: string | null
    etap: string | null
    subetap: string | null
    summary: string
    flightRecordJson: Prisma.JsonValue | null
    filesPath: string | null
  }
}

type PromptExecutionEventRecord = {
  id: string
  createdAt: Date
  title: string
  etap: string | null
  subetap: string | null
  node: string | null
  domain: string | null
  conversations?: LinkedConversationRecord[]
}

type ExecutionLogEventRecord = {
  id: string
  createdAt: Date
  title: string
  conversations?: LinkedConversationRecord[]
}

type DecisionEventRecord = {
  id: string
  createdAt: Date
  title: string
  conversations?: LinkedConversationRecord[]
}

type WarningEventRecord = {
  id: string
  createdAt: Date
  title: string
  conversations?: LinkedConversationRecord[]
}

type ChangedFileEventRecord = {
  id: string
  createdAt: Date
  path: string
}

const ARCHIVE_EVENT_SOURCE_KINDS = [
  'PMOS_CLOSEOUTS',
  'PMOS_EXECUTION_TRAILS',
] as const

async function findManyIfAvailable<T>(
  delegate: { findMany?: (args: unknown) => Promise<T[]> } | undefined,
  args: unknown,
): Promise<T[]> {
  if (!delegate || typeof delegate.findMany !== 'function') {
    return []
  }

  return delegate.findMany(args)
}

function toJsonObject(value: unknown): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.JsonObject
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function getJsonStringField(value: Prisma.JsonValue | null, fieldName: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = (value as Record<string, unknown>)[fieldName]
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

function getArchiveArtifactRuntimeContext(record: ArchiveArtifactEventRecord): string | null {
  return firstNonEmptyString(
    getJsonStringField(record.rawPayload, 'runtimeContext'),
    getJsonStringField(record.rawPayload, 'runtime_context'),
    getJsonStringField(record.rawPayload, 'scope'),
    getJsonStringField(record.rawPayload, 'domain'),
    getJsonStringField(record.metadata, 'runtimeContext'),
    getJsonStringField(record.metadata, 'runtime_context'),
    getJsonStringField(record.metadata, 'scope'),
    record.source.sourceKind,
  )
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

function toLinkedConversationRecord(conversations: LinkedConversationRecord[] | undefined): EventLedgerSourceRecord['linkedConversation'] {
  const linkedConversation = conversations?.[0]?.conversation
  if (!linkedConversation) {
    return null
  }

  return {
    record: toJsonObject(linkedConversation),
    rawJson: linkedConversation.flightRecordJson,
  }
}

export async function eventLedgerQuery(): Promise<EventLedgerData> {
  const conversationArtifactDelegate = (db as unknown as {
    conversationArtifact?: {
      findMany: (args: unknown) => Promise<ConversationEventRecord[]>
    }
  }).conversationArtifact

  const promptExecutionDelegate = (db as unknown as {
    promptExecution?: {
      findMany: (args: unknown) => Promise<PromptExecutionEventRecord[]>
    }
  }).promptExecution

  const executionLogDelegate = (db as unknown as {
    executionLog?: {
      findMany: (args: unknown) => Promise<ExecutionLogEventRecord[]>
    }
  }).executionLog

  const decisionDelegate = (db as unknown as {
    decision?: {
      findMany: (args: unknown) => Promise<DecisionEventRecord[]>
    }
  }).decision

  const architectureWarningDelegate = (db as unknown as {
    architectureWarning?: {
      findMany: (args: unknown) => Promise<WarningEventRecord[]>
    }
  }).architectureWarning

  const changedFileDelegate = (db as unknown as {
    changedFile?: {
      findMany: (args: unknown) => Promise<ChangedFileEventRecord[]>
    }
  }).changedFile

  const archiveSourceDelegate = (db as unknown as {
    archiveSource?: {
      findMany: (args: unknown) => Promise<ArchiveSourceEventRecord[]>
    }
  }).archiveSource

  const [
    conversations,
    prompts,
    logs,
    decisions,
    warnings,
    changedFiles,
    archiveSources,
  ] = await Promise.all([
    findManyIfAvailable(conversationArtifactDelegate, {
      orderBy: { timestamp: 'desc' },
      take: 250,
    }),
    findManyIfAvailable(promptExecutionDelegate, {
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        conversations: {
          take: 1,
          include: {
            conversation: true,
          },
        },
      },
    }),
    findManyIfAvailable(executionLogDelegate, {
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        conversations: {
          take: 1,
          include: {
            conversation: true,
          },
        },
      },
    }),
    findManyIfAvailable(decisionDelegate, {
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        conversations: {
          take: 1,
          include: {
            conversation: true,
          },
        },
      },
    }),
    findManyIfAvailable(architectureWarningDelegate, {
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: {
        conversations: {
          take: 1,
          include: {
            conversation: true,
          },
        },
      },
    }),
    findManyIfAvailable(changedFileDelegate, {
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    findManyIfAvailable(archiveSourceDelegate, {
      where: {
        sourceKind: {
          in: [...ARCHIVE_EVENT_SOURCE_KINDS],
        },
      },
      include: {
        artifacts: {
          orderBy: { observedAt: 'desc' },
          take: 250,
        },
      },
    }),
  ])

  const archiveArtifacts = archiveSources.flatMap((source) =>
    source.artifacts.map((artifact) => ({
      ...artifact,
      source: {
        sourceKind: source.sourceKind,
        sourceKey: source.sourceKey,
      },
    })),
  )

  const sourceRecords: Record<string, EventLedgerSourceRecord> = {}

  const conversationEvents: EventRow[] = conversations.map((record) => {
    sourceRecords[`conversation_artifacts:${record.id}`] = {
      sourceTable: 'conversation_artifacts',
      record: toJsonObject(record),
      rawJson: record.flightRecordJson,
      linkedConversation: null,
    }
    return {
      id: `conversation_artifacts:${record.id}`,
      eventType: 'CONVERSATION_SAVED',
      timestamp: record.timestamp,
      runtimeContext: firstNonEmptyString(record.scope, record.etap, record.subetap),
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
      linkedConversation: toLinkedConversationRecord(record.conversations),
    }
    return {
      id: `prompt_executions:${record.id}`,
      eventType: 'PROMPT_EXECUTION_SAVED',
      timestamp: record.createdAt,
      runtimeContext: firstNonEmptyString(record.domain, record.etap, record.subetap, record.node),
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
      linkedConversation: toLinkedConversationRecord(record.conversations),
    }
    return {
      id: `execution_logs:${record.id}`,
      eventType: 'EXECUTION_LOG_SAVED',
      timestamp: record.createdAt,
      runtimeContext: null,
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
      linkedConversation: toLinkedConversationRecord(record.conversations),
    }
    return {
      id: `decisions:${record.id}`,
      eventType: 'DECISION_CREATED',
      timestamp: record.createdAt,
      runtimeContext: null,
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
      linkedConversation: toLinkedConversationRecord(record.conversations),
    }
    return {
      id: `architecture_warnings:${record.id}`,
      eventType: 'WARNING_CREATED',
      timestamp: record.createdAt,
      runtimeContext: null,
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
      linkedConversation: null,
    }
    return {
      id: `changed_files:${record.id}`,
      eventType: 'FILE_CHANGED',
      timestamp: record.createdAt,
      runtimeContext: null,
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
        linkedConversation: null,
      }

      const isCloseout = record.source.sourceKind === 'PMOS_CLOSEOUTS'
      return {
        id: `archive_artifacts:${record.id}`,
        eventType: isCloseout ? 'CLOSEOUT_SAVED' : 'EXECUTION_TRAIL_RECORDED',
        timestamp: record.observedAt ?? record.createdAt,
        runtimeContext: getArchiveArtifactRuntimeContext(record),
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