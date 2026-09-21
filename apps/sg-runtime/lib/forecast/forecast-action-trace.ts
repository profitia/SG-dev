import { Prisma, type ForecastTargetBasis, type PrismaClient } from '@/generated/market-data-client'

import { getMarketDataPrisma } from '@/lib/market-data/client'

export const FORECAST_ACTION_TRACE_SCHEMA_VERSION = 'forecast-action-trace-v1' as const

export type ForecastActionType = 'CURRENT_PREPARATION' | 'VERIFICATION_PREPARATION'
export type ForecastActionLayer = 'CURRENT' | 'VERIFICATION'
export type ForecastActionTraceEventType =
  | 'ACTION_REQUESTED'
  | 'ADMISSION_STAGE_COMPLETED'
  | 'QUEUE_ACCEPTED'
  | 'ARTIFACT_READY'
  | 'DASHBOARD_READY_OBSERVED'
  | 'UI_VISIBLE_ACKNOWLEDGED'
  | 'RESOURCE_SUMMARY_LINKED'

export type ForecastActionIdentity = {
  seriesId: string
  targetBasis: ForecastTargetBasis
  targetSemantics: string
  modelId: string
}

export type ForecastActionTraceEvent = {
  schemaVersion: typeof FORECAST_ACTION_TRACE_SCHEMA_VERSION
  eventType: ForecastActionTraceEventType
  observedAt: string
  correlationId: string
  payload: Record<string, unknown>
}

export type ForecastUiVisibleAck = ForecastActionIdentity & {
  correlationId: string
  layer: ForecastActionLayer
  pageInstanceId: string
  clientVisibleAt: string
  responseToVisibleMs: number | null
}

function requirePrisma(prisma?: PrismaClient | null) {
  const resolved = prisma ?? getMarketDataPrisma()
  if (!resolved) throw new Error('MARKET_DATA_DATABASE_URL is required for Forecast action telemetry.')
  return resolved
}

export function buildForecastActionTraceEvent(
  eventType: ForecastActionTraceEventType,
  correlationId: string,
  observedAt: Date,
  payload: Record<string, unknown> = {},
): ForecastActionTraceEvent {
  return {
    schemaVersion: FORECAST_ACTION_TRACE_SCHEMA_VERSION,
    eventType,
    observedAt: observedAt.toISOString(),
    correlationId,
    payload,
  }
}

async function appendEventByCorrelation(
  prisma: PrismaClient,
  correlationId: string,
  traceEvent: ForecastActionTraceEvent,
) {
  const eventJson = JSON.stringify(traceEvent)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "forecast_action_trace"
    SET "eventsJson" = COALESCE("eventsJson", '[]'::jsonb) || jsonb_build_array(CAST(${eventJson} AS jsonb)),
        "eventCount" = "eventCount" + 1,
        "updatedAt" = NOW()
    WHERE "correlationId" = ${correlationId}
  `)
}

export async function recordForecastActionRequested(
  input: ForecastActionIdentity & { correlationId: string, actionType: ForecastActionType, requestedAt?: Date },
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const requestedAt = input.requestedAt ?? new Date()
  const requestedEvent = buildForecastActionTraceEvent('ACTION_REQUESTED', input.correlationId, requestedAt, {
    actionType: input.actionType,
    seriesId: input.seriesId,
    targetBasis: input.targetBasis,
    targetSemantics: input.targetSemantics,
    modelId: input.modelId,
  })

  return db.forecastActionTrace.upsert({
    where: { correlationId: input.correlationId },
    create: {
      correlationId: input.correlationId,
      actionType: input.actionType,
      seriesId: input.seriesId,
      targetBasis: input.targetBasis,
      targetSemantics: input.targetSemantics,
      modelId: input.modelId,
      actionRequestedAt: requestedAt,
      eventsJson: [requestedEvent] as Prisma.InputJsonValue,
      eventCount: 1,
    },
    update: {
      actionType: input.actionType,
      seriesId: input.seriesId,
      targetBasis: input.targetBasis,
      targetSemantics: input.targetSemantics,
      modelId: input.modelId,
    },
  })
}

export async function recordForecastQueueAccepted(
  correlationId: string,
  jobKey: string,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const updated = await db.forecastActionTrace.updateMany({
    where: { correlationId },
    data: {
      jobKey,
      queueAcceptedAt: observedAt,
    },
  })
  if (updated.count === 1) {
    await appendEventByCorrelation(db, correlationId, buildForecastActionTraceEvent('QUEUE_ACCEPTED', correlationId, observedAt, { jobKey }))
  }
}

export async function recordForecastAdmissionStage(
  correlationId: string,
  stage: 'INTERACTIVE_CAPABILITY' | 'EXACT_CAPABILITY' | 'CURRENT_DEPENDENCY' | 'JOB_UPSERT',
  startedAt: Date,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  await appendEventByCorrelation(db, correlationId, buildForecastActionTraceEvent(
    'ADMISSION_STAGE_COMPLETED',
    correlationId,
    observedAt,
    {
      stage,
      durationMs: Math.max(0, observedAt.getTime() - startedAt.getTime()),
    },
  ))
}

export async function recordForecastArtifactReady(
  jobKey: string,
  layer: ForecastActionLayer,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const traces = await db.forecastActionTrace.findMany({
    where: { jobKey, artifactReadyAt: null },
    select: { correlationId: true },
  })
  if (traces.length === 0) return 0

  await db.forecastActionTrace.updateMany({
    where: { jobKey, artifactReadyAt: null },
    data: { artifactReadyAt: observedAt },
  })
  await Promise.all(traces.map(({ correlationId }) => appendEventByCorrelation(
    db,
    correlationId,
    buildForecastActionTraceEvent('ARTIFACT_READY', correlationId, observedAt, { jobKey, layer }),
  )))
  return traces.length
}

export async function recordDashboardFirstReadyObservation(
  correlationId: string,
  layer: ForecastActionLayer,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const updated = await db.forecastActionTrace.updateMany({
    where: { correlationId, dashboardFirstReadyObservedAt: null },
    data: { dashboardFirstReadyObservedAt: observedAt },
  })
  if (updated.count === 1) {
    await appendEventByCorrelation(db, correlationId, buildForecastActionTraceEvent('DASHBOARD_READY_OBSERVED', correlationId, observedAt, { layer }))
  }
  return updated.count === 1
}

export async function recordDashboardReadyObservationForSnapshot(
  correlationId: string,
  readiness: { currentReady: boolean, verificationReady: boolean },
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const trace = await db.forecastActionTrace.findUnique({
    where: { correlationId },
    select: { actionType: true },
  })
  if (!trace) return false
  const layer: ForecastActionLayer = trace.actionType === 'VERIFICATION_PREPARATION' ? 'VERIFICATION' : 'CURRENT'
  const ready = layer === 'VERIFICATION' ? readiness.verificationReady : readiness.currentReady
  if (!ready) return false
  return recordDashboardFirstReadyObservation(correlationId, layer, observedAt, db)
}

export async function recordForecastUiVisibleAck(
  input: ForecastUiVisibleAck,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const clientVisibleAt = new Date(input.clientVisibleAt)
  if (!Number.isFinite(clientVisibleAt.getTime())) throw new Error('clientVisibleAt must be an ISO timestamp.')

  const updated = await db.forecastActionTrace.updateMany({
    where: {
      correlationId: input.correlationId,
      seriesId: input.seriesId,
      targetBasis: input.targetBasis,
      targetSemantics: input.targetSemantics,
      modelId: input.modelId,
      uiAckReceivedAt: null,
    },
    data: {
      uiVisibleClientAt: clientVisibleAt,
      uiAckReceivedAt: observedAt,
      uiVisibilityState: 'VISIBLE',
      pageInstanceId: input.pageInstanceId,
      responseToVisibleMs: input.responseToVisibleMs,
    },
  })
  if (updated.count === 1) {
    await appendEventByCorrelation(db, input.correlationId, buildForecastActionTraceEvent('UI_VISIBLE_ACKNOWLEDGED', input.correlationId, observedAt, {
      layer: input.layer,
      pageInstanceId: input.pageInstanceId,
      clientVisibleAt: clientVisibleAt.toISOString(),
      responseToVisibleMs: input.responseToVisibleMs,
    }))
  }
  return updated.count === 1
}

export async function linkForecastActionExecution(
  correlationId: string,
  executionId: string,
  observedAt = new Date(),
  prisma?: PrismaClient | null,
) {
  const db = requirePrisma(prisma)
  const updated = await db.forecastActionTrace.updateMany({
    where: { correlationId },
    data: { executionId },
  })
  if (updated.count === 1) {
    await appendEventByCorrelation(db, correlationId, buildForecastActionTraceEvent('RESOURCE_SUMMARY_LINKED', correlationId, observedAt, { executionId }))
  }
}

export async function readForecastActionTimeline(correlationId: string, prisma?: PrismaClient | null) {
  const db = requirePrisma(prisma)
  const trace = await db.forecastActionTrace.findUnique({ where: { correlationId } })
  if (!trace) return null

  const [job, executions] = await Promise.all([
    trace.jobKey ? db.forecastPreparationJob.findUnique({ where: { jobKey: trace.jobKey } }) : Promise.resolve(null),
    db.forecastPreparationExecutionLedger.findMany({
      where: {
        OR: [
          { executionId: trace.executionId ?? '__none__' },
          { ownerRequestId: correlationId },
          { latestRequestId: correlationId },
          { resourceCorrelationId: correlationId },
        ],
      },
      orderBy: { startedAt: 'asc' },
    }),
  ])

  const delta = (left: Date | null, right: Date | null) => (
    left && right ? Math.max(0, right.getTime() - left.getTime()) : null
  )

  return {
    schemaVersion: FORECAST_ACTION_TRACE_SCHEMA_VERSION,
    correlationId,
    identity: {
      actionType: trace.actionType,
      seriesId: trace.seriesId,
      targetBasis: trace.targetBasis,
      targetSemantics: trace.targetSemantics,
      modelId: trace.modelId,
      jobKey: trace.jobKey,
      executionId: trace.executionId,
    },
    timestamps: {
      actionRequestedAt: trace.actionRequestedAt.toISOString(),
      queueAcceptedAt: trace.queueAcceptedAt?.toISOString() ?? null,
      jobStartedAt: job?.startedAt?.toISOString() ?? null,
      artifactReadyAt: trace.artifactReadyAt?.toISOString() ?? null,
      dashboardFirstReadyObservedAt: trace.dashboardFirstReadyObservedAt?.toISOString() ?? null,
      uiVisibleClientAt: trace.uiVisibleClientAt?.toISOString() ?? null,
      uiAckReceivedAt: trace.uiAckReceivedAt?.toISOString() ?? null,
    },
    durationsMs: {
      requestToQueueAccepted: delta(trace.actionRequestedAt, trace.queueAcceptedAt),
      queueAcceptedToWorkerStart: delta(trace.queueAcceptedAt, job?.startedAt ?? null),
      requestToArtifactReady: delta(trace.actionRequestedAt, trace.artifactReadyAt),
      artifactReadyToDashboardObservation: delta(trace.artifactReadyAt, trace.dashboardFirstReadyObservedAt),
      artifactReadyToUiAckReceived: delta(trace.artifactReadyAt, trace.uiAckReceivedAt),
      responseToVisibleClient: trace.responseToVisibleMs,
    },
    uiVisibilityState: trace.uiVisibilityState,
    events: trace.eventsJson,
    job,
    executions,
  }
}
