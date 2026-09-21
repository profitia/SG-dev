import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildForecastActionTraceEvent,
  FORECAST_ACTION_TRACE_SCHEMA_VERSION,
} from '@/lib/forecast/forecast-action-trace'

test('action telemetry event contract is versioned and correlation scoped', () => {
  const observedAt = new Date('2026-09-20T20:00:00.000Z')
  const event = buildForecastActionTraceEvent('ARTIFACT_READY', 'corr-1', observedAt, {
    jobKey: 'job-1',
    layer: 'CURRENT',
  })

  assert.deepEqual(event, {
    schemaVersion: FORECAST_ACTION_TRACE_SCHEMA_VERSION,
    eventType: 'ARTIFACT_READY',
    observedAt: observedAt.toISOString(),
    correlationId: 'corr-1',
    payload: { jobKey: 'job-1', layer: 'CURRENT' },
  })
})

test('admission-stage telemetry exposes the previously opaque request-to-queue work', () => {
  const event = buildForecastActionTraceEvent(
    'ADMISSION_STAGE_COMPLETED',
    'corr-admission',
    new Date('2026-09-21T20:00:01.000Z'),
    { stage: 'INTERACTIVE_CAPABILITY', durationMs: 1_000 },
  )

  assert.equal(event.eventType, 'ADMISSION_STAGE_COMPLETED')
  assert.deepEqual(event.payload, { stage: 'INTERACTIVE_CAPABILITY', durationMs: 1_000 })
})

test('action telemetry migration stores lifecycle events and resource summaries', async () => {
  const migration = await readFile(new URL('../prisma-market-data/migrations/20260920233000_forecast_action_trace_and_resource_summary/migration.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE "forecast_action_trace"/)
  assert.match(migration, /"correlationId" TEXT NOT NULL/)
  assert.match(migration, /"artifactReadyAt" TIMESTAMP\(3\)/)
  assert.match(migration, /"uiAckReceivedAt" TIMESTAMP\(3\)/)
  assert.match(migration, /"resourceSummaryJson" JSONB/)
})
