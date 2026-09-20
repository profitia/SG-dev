import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

export type ForecastPythonResourceMeasurement = {
  script: string
  wallMs: number
  userCpuMs: number
  systemCpuMs: number
  maxRssBytes: number
}

export type ForecastWorkerResourceSummary = {
  schemaVersion: 'forecast-worker-resource-v1'
  correlationId: string
  jobKey: string
  startedAt: string
  completedAt: string
  wallMs: number
  node: {
    userCpuMs: number
    systemCpuMs: number
    maxRssBytes: number
    peakSampledRssBytes: number
    fsRead: number
    fsWrite: number
    voluntaryContextSwitches: number
    involuntaryContextSwitches: number
    eventLoopUtilization: number
  }
  python: {
    processCount: number
    wallMs: number
    userCpuMs: number
    systemCpuMs: number
    maxRssBytes: number
    invocations: ForecastPythonResourceMeasurement[]
  }
  attributionQuality: {
    node: 'SEQUENTIAL_WORKER_JOB_WINDOW'
    python: 'EXACT_PROCESS'
    render: 'SERVICE_LEVEL_CONTEXT_ONLY'
  }
}

type ResourceCollection = {
  python: ForecastPythonResourceMeasurement[]
}

const storage = new AsyncLocalStorage<ResourceCollection>()

export function isForecastWorkerResourceMeasurementActive() {
  return Boolean(storage.getStore())
}

export function recordForecastPythonResourceMeasurement(measurement: ForecastPythonResourceMeasurement) {
  storage.getStore()?.python.push(measurement)
}

export async function measureForecastWorkerJob<T>(
  input: { correlationId: string, jobKey: string },
  operation: () => Promise<T>,
): Promise<{ value: T, summary: ForecastWorkerResourceSummary }> {
  const startedAt = new Date()
  const startedMs = performance.now()
  const cpuStarted = process.cpuUsage()
  const resourceStarted = process.resourceUsage()
  const eluStarted = performance.eventLoopUtilization()
  let peakSampledRssBytes = process.memoryUsage.rss()
  const sampler = setInterval(() => {
    peakSampledRssBytes = Math.max(peakSampledRssBytes, process.memoryUsage.rss())
  }, 250)
  sampler.unref()

  const collection: ResourceCollection = { python: [] }
  try {
    const value = await storage.run(collection, operation)
    const completedAt = new Date()
    const cpu = process.cpuUsage(cpuStarted)
    const resource = process.resourceUsage()
    const elu = performance.eventLoopUtilization(eluStarted)
    const python = collection.python
    return {
      value,
      summary: {
        schemaVersion: 'forecast-worker-resource-v1',
        correlationId: input.correlationId,
        jobKey: input.jobKey,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        wallMs: Math.max(0, performance.now() - startedMs),
        node: {
          userCpuMs: cpu.user / 1_000,
          systemCpuMs: cpu.system / 1_000,
          maxRssBytes: resource.maxRSS * 1_024,
          peakSampledRssBytes,
          fsRead: Math.max(0, resource.fsRead - resourceStarted.fsRead),
          fsWrite: Math.max(0, resource.fsWrite - resourceStarted.fsWrite),
          voluntaryContextSwitches: Math.max(0, resource.voluntaryContextSwitches - resourceStarted.voluntaryContextSwitches),
          involuntaryContextSwitches: Math.max(0, resource.involuntaryContextSwitches - resourceStarted.involuntaryContextSwitches),
          eventLoopUtilization: elu.utilization,
        },
        python: {
          processCount: python.length,
          wallMs: python.reduce((sum, item) => sum + item.wallMs, 0),
          userCpuMs: python.reduce((sum, item) => sum + item.userCpuMs, 0),
          systemCpuMs: python.reduce((sum, item) => sum + item.systemCpuMs, 0),
          maxRssBytes: python.reduce((max, item) => Math.max(max, item.maxRssBytes), 0),
          invocations: python,
        },
        attributionQuality: {
          node: 'SEQUENTIAL_WORKER_JOB_WINDOW',
          python: 'EXACT_PROCESS',
          render: 'SERVICE_LEVEL_CONTEXT_ONLY',
        },
      },
    }
  } finally {
    clearInterval(sampler)
  }
}
