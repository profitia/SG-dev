import { AsyncLocalStorage } from 'node:async_hooks'
import { monitorEventLoopDelay } from 'node:perf_hooks'

import type { NextRequest } from 'next/server'

type DiagnosticContext = {
  route: string
  requestId: string | null
  scenarioId: string | null
  stressRunId: string | null
  virtualUserId: string | null
  sampled: boolean
}

type DiagnosticFields = Record<string, boolean | number | string | null>

const DIAGNOSTIC_PREFIX = '[FORECAST_PHASE_2_2C_DIAGNOSTIC] '
const C01_DIAGNOSTIC_PREFIX = '[FORECAST_PHASE_2_3_C01_DIAGNOSTIC] '
const diagnosticStorage = new AsyncLocalStorage<DiagnosticContext>()
const activeRequests = new Map<string, number>()
const peakActiveRequests = new Map<string, number>()
const eventLoopDelay = phase22cDiagnosticsEnabled() ? monitorEventLoopDelay({ resolution: 20 }) : null

eventLoopDelay?.enable()

export function phase22cDiagnosticsEnabled() {
  return process.env.FORECAST_PHASE_2_2C_DIAGNOSTICS === '1'
}

export function phase23C01DiagnosticsEnabled() {
  return process.env.FORECAST_PHASE_2_3_C01_DIAGNOSTICS === '1'
}

function shouldSample(virtualUserId: string | null) {
  const virtualUserNumber = Number(virtualUserId?.replace(/^vu-/, ''))
  return !Number.isInteger(virtualUserNumber) || virtualUserNumber <= 10 || virtualUserNumber % 50 === 0
}

function emit(event: string, fields: DiagnosticFields = {}) {
  if (!phase22cDiagnosticsEnabled()) return

  const context = diagnosticStorage.getStore()
  if (context && !context.sampled) return

  process.stdout.write(`${DIAGNOSTIC_PREFIX}${JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    monotonicMs: performance.now(),
    route: context?.route ?? null,
    stressRunId: context?.stressRunId ?? null,
    scenarioId: context?.scenarioId ?? null,
    virtualUserId: context?.virtualUserId ?? null,
    requestId: context?.requestId ?? null,
    ...fields,
  })}\n`)
}

export function phase22cDiagnosticEvent(event: string, fields: DiagnosticFields = {}) {
  emit(event, fields)
}

export function phase23C01DiagnosticEvent(event: string, fields: DiagnosticFields = {}) {
  if (!phase23C01DiagnosticsEnabled()) return

  const context = diagnosticStorage.getStore()
  process.stdout.write(`${C01_DIAGNOSTIC_PREFIX}${JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    monotonicMs: performance.now(),
    route: context?.route ?? null,
    stressRunId: context?.stressRunId ?? null,
    scenarioId: context?.scenarioId ?? null,
    virtualUserId: context?.virtualUserId ?? null,
    requestId: context?.requestId ?? null,
    ...fields,
  })}\n`)
}

export async function runPhase22cDiagnosticRequest<T>(
  request: NextRequest,
  route: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!phase22cDiagnosticsEnabled() && !phase23C01DiagnosticsEnabled()) return operation()

  const virtualUserId = request.headers.get('x-sg-stress-virtual-user-id')
  const context: DiagnosticContext = {
    route,
    requestId: request.headers.get('x-request-id'),
    scenarioId: request.headers.get('x-sg-stress-scenario-id'),
    stressRunId: request.headers.get('x-sg-stress-run-id'),
    virtualUserId,
    sampled: shouldSample(virtualUserId),
  }

  return diagnosticStorage.run(context, async () => {
    const startedAt = performance.now()
    const active = (activeRequests.get(route) ?? 0) + 1
    const peak = Math.max(peakActiveRequests.get(route) ?? 0, active)
    activeRequests.set(route, active)
    peakActiveRequests.set(route, peak)
    emit('http_request_received', { activeRequests: active, peakActiveRequests: peak })

    try {
      return await operation()
    } finally {
      const remaining = Math.max(0, (activeRequests.get(route) ?? 1) - 1)
      const cpuUsage = process.cpuUsage()
      activeRequests.set(route, remaining)
      emit('http_request_completed', {
        activeRequests: remaining,
        cpuSystemMicros: cpuUsage.system,
        cpuUserMicros: cpuUsage.user,
        durationMs: performance.now() - startedAt,
        eventLoopDelayMaxMs: eventLoopDelay ? eventLoopDelay.max / 1_000_000 : null,
        eventLoopDelayMeanMs: eventLoopDelay ? eventLoopDelay.mean / 1_000_000 : null,
        peakActiveRequests: peakActiveRequests.get(route) ?? peak,
        rssBytes: process.memoryUsage().rss,
      })
    }
  })
}

export async function phase22cDiagnosticSpan<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (!phase22cDiagnosticsEnabled()) return operation()

  const startedAt = performance.now()
  emit('span_started', { name })
  try {
    const value = await operation()
    emit('span_completed', { durationMs: performance.now() - startedAt, name, status: 'PASS' })
    return value
  } catch (error) {
    emit('span_completed', { durationMs: performance.now() - startedAt, name, status: 'FAIL' })
    throw error
  }
}

export function phase22cDiagnosticSyncSpan<T>(name: string, operation: () => T): T {
  if (!phase22cDiagnosticsEnabled()) return operation()

  const startedAt = performance.now()
  const value = operation()
  emit('span_completed', { durationMs: performance.now() - startedAt, name, status: 'PASS' })
  return value
}