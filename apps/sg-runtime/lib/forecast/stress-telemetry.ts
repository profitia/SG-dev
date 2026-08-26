import { AsyncLocalStorage } from 'node:async_hooks'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'

const EXPECTED_ENVIRONMENT_ID = 'phase-2-1-local-isolated-v1'
const EXPECTED_DATABASES = new Set(['sg_phase_2_1_app', 'sg_phase_2_1_market_data'])
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export type ForecastStressContext = {
  stressRunId: string
  scenarioId: string
  virtualUserId: string
  requestId: string
  forecastIdentity: string
  logicalArtifactKey: string
}

export type ForecastStressEvent = ForecastStressContext & {
  event: string
  timestamp: string
  metrics: Record<string, string | number | boolean | null>
}

type StressTelemetryEnvironment = Readonly<Record<string, string | undefined>>

type StressTelemetryOptions = {
  env?: StressTelemetryEnvironment
  sink?: (event: ForecastStressEvent) => void
}

function isIsolatedDatabaseUrl(value: string | undefined, expectedDatabase: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && LOOPBACK_HOSTS.has(url.hostname)
      && decodeURIComponent(url.pathname.slice(1)) === expectedDatabase
      && EXPECTED_DATABASES.has(expectedDatabase)
  } catch {
    return false
  }
}

export function resolveForecastStressTelemetryEnabled(env: StressTelemetryEnvironment = process.env) {
  if (env.FORECAST_STRESS_TELEMETRY_ENABLED !== 'true') return false
  if (env.APP_ENV === 'production') throw new Error('Forecast stress telemetry is forbidden in production.')
  if (env.FORECAST_STRESS_ENVIRONMENT_ID !== EXPECTED_ENVIRONMENT_ID) {
    throw new Error('Forecast stress telemetry requires the approved isolated environment identity.')
  }
  if (env.FORECAST_STRESS_DATABASE_CLONE_ALIAS !== 'phase-2-1-local-clone-v1') {
    throw new Error('Forecast stress telemetry requires the approved isolated database clone alias.')
  }
  if (!isIsolatedDatabaseUrl(env.SG_RUNTIME_DATABASE_URL, 'sg_phase_2_1_app')) {
    throw new Error('Forecast stress telemetry requires the isolated local application database.')
  }
  if (!isIsolatedDatabaseUrl(env.MARKET_DATA_DATABASE_URL, 'sg_phase_2_1_market_data')) {
    throw new Error('Forecast stress telemetry requires the isolated local market-data database.')
  }
  return true
}

function assertContext(context: ForecastStressContext) {
  for (const [key, value] of Object.entries(context)) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Forecast stress telemetry requires non-empty ${key}.`)
    }
  }
}

export function createForecastStressTelemetry(options: StressTelemetryOptions = {}) {
  const env = options.env ?? process.env
  const enabled = resolveForecastStressTelemetryEnabled(env)
  const storage = new AsyncLocalStorage<ForecastStressContext>()
  const sink = options.sink ?? ((event: ForecastStressEvent) => {
    console.info(`[FORECAST_STRESS_TELEMETRY] ${JSON.stringify(event)}`)
  })
  let previousCpu = process.cpuUsage()
  let previousEventLoopUtilization = performance.eventLoopUtilization()
  const eventLoopDelay = enabled ? monitorEventLoopDelay({ resolution: 20 }) : null
  eventLoopDelay?.enable()

  function emit(event: string, metrics: ForecastStressEvent['metrics'] = {}) {
    if (!enabled) return
    const context = storage.getStore()
    if (!context) return
    sink({
      ...context,
      event,
      timestamp: new Date().toISOString(),
      metrics,
    })
  }

  return {
    enabled,
    run<T>(context: ForecastStressContext, operation: () => T): T {
      if (!enabled) return operation()
      assertContext(context)
      return storage.run(context, operation)
    },
    currentContext() {
      return enabled ? storage.getStore() ?? null : null
    },
    emit,
    assertProviderAllowed(seriesId: string) {
      if (!enabled) return
      const allowlist = new Set((env.FORECAST_STRESS_PROVIDER_ALLOWLIST ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean))
      if (env.FORECAST_STRESS_PROVIDER_ENABLED !== 'true' || !allowlist.has(seriesId.toLowerCase())) {
        throw new Error(`Provider access is denied for Phase 2.1 stress identity: ${seriesId}`)
      }
    },
    sampleResources() {
      if (!enabled) return null
      const context = storage.getStore()
      if (!context) return null
      const cpu = process.cpuUsage(previousCpu)
      previousCpu = process.cpuUsage()
      const memory = process.memoryUsage()
      const utilization = performance.eventLoopUtilization(previousEventLoopUtilization)
      previousEventLoopUtilization = performance.eventLoopUtilization()
      const metrics = {
        cpuUserMicros: cpu.user,
        cpuSystemMicros: cpu.system,
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
        eventLoopUtilization: utilization.utilization,
        eventLoopDelayMeanMs: eventLoopDelay && Number.isFinite(eventLoopDelay.mean)
          ? eventLoopDelay.mean / 1_000_000
          : 0,
        eventLoopDelayMaxMs: eventLoopDelay ? eventLoopDelay.max / 1_000_000 : 0,
      }
      emit('resource_sample', metrics)
      eventLoopDelay?.reset()
      return metrics
    },
    close() {
      eventLoopDelay?.disable()
    },
  }
}

export type ForecastStressTelemetry = ReturnType<typeof createForecastStressTelemetry>

export const forecastStressTelemetry = createForecastStressTelemetry()

export function summarizeDuplicateCompute(events: ForecastStressEvent[]) {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.event !== 'current_compute_start') continue
    const key = `${event.stressRunId}|${event.logicalArtifactKey}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts, ([key, actualComputeCount]) => {
    const separator = key.indexOf('|')
    const expectedLogicalComputeCount = 1
    const duplicateComputeCount = Math.max(actualComputeCount - expectedLogicalComputeCount, 0)
    return {
      stressRunId: key.slice(0, separator),
      logicalArtifactKey: key.slice(separator + 1),
      expectedLogicalComputeCount,
      actualComputeCount,
      duplicateComputeCount,
      duplicateComputeRatio: duplicateComputeCount / expectedLogicalComputeCount,
    }
  })
}

export function forecastStressContextFromHeaders(
  request: Request,
  identity: { seriesId: string; modelId: string; targetBasis: string },
): ForecastStressContext {
  return {
    stressRunId: request.headers.get('x-sg-stress-run-id') ?? '',
    scenarioId: request.headers.get('x-sg-stress-scenario-id') ?? '',
    virtualUserId: request.headers.get('x-sg-stress-virtual-user-id') ?? '',
    requestId: request.headers.get('x-request-id') ?? '',
    forecastIdentity: `${identity.seriesId}|${identity.targetBasis}|${identity.modelId}`,
    logicalArtifactKey: request.headers.get('x-sg-stress-logical-artifact-key')
      ?? `${identity.seriesId}|${identity.targetBasis}|${identity.modelId}`,
  }
}