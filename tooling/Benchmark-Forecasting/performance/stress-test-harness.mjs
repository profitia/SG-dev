import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

export const STRESS_TEST_CONTRACT_VERSION = 1
export const MAXIMUM_RELEASE_SPREAD_MS = 250
export const MANDATORY_CONCURRENCY_LEVELS = Object.freeze([10, 100, 1000])

export function createStartBarrier() {
  let release
  const waiting = new Promise((resolve) => {
    release = resolve
  })

  return {
    wait: () => waiting,
    release: () => release(),
  }
}

export async function runBarrierDryRun({ virtualUsers = 4 } = {}) {
  if (!Number.isInteger(virtualUsers) || virtualUsers < 2 || virtualUsers >= 10) {
    throw new Error('Phase 2.0 dry-run virtualUsers must be an integer from 2 through 9')
  }

  const stressRunId = `phase-2-0-dry-run-${Date.now()}`
  const barrier = createStartBarrier()
  const requests = Array.from({ length: virtualUsers }, (_, index) => ({
    stressRunId,
    scenarioId: 'HARNESS_BARRIER_DRY_RUN',
    virtualUserId: `vu-${index + 1}`,
    requestId: `${stressRunId}-request-${index + 1}`,
  }))

  const waiting = requests.map(async (request) => {
    await barrier.wait()
    return {
      ...request,
      startedMonotonicMs: performance.now(),
    }
  })

  barrier.release()
  const released = await Promise.all(waiting)
  const starts = released.map((request) => request.startedMonotonicMs)
  const releaseSpreadMs = Math.max(...starts) - Math.min(...starts)

  return {
    contractVersion: STRESS_TEST_CONTRACT_VERSION,
    mode: 'DRY_RUN_NO_NETWORK',
    virtualUsers,
    actualRequests: released.length,
    releaseSpreadMs,
    releaseWindowMsMaximum: MAXIMUM_RELEASE_SPREAD_MS,
    passed: releaseSpreadMs <= MAXIMUM_RELEASE_SPREAD_MS,
    requests: released,
    fullStressExecuted: false,
  }
}

export async function runSynchronizedBurst({
  virtualUsers,
  stressRunId,
  scenarioId,
  operation,
}) {
  if (!MANDATORY_CONCURRENCY_LEVELS.includes(virtualUsers)) {
    throw new Error('Phase 2.1 synchronized burst concurrency must be exactly 10, 100, or 1000')
  }
  if (typeof stressRunId !== 'string' || stressRunId.trim() === '') {
    throw new Error('Phase 2.1 synchronized burst requires a non-empty stressRunId')
  }
  if (!/^P(0[1-9]|1[01])$/.test(scenarioId)) {
    throw new Error('Phase 2.1 synchronized burst requires scenarioId P01 through P11')
  }
  if (typeof operation !== 'function') {
    throw new Error('Phase 2.1 synchronized burst requires an operation function')
  }

  const barrier = createStartBarrier()
  const waiting = Array.from({ length: virtualUsers }, (_, index) => {
    const virtualUserId = `vu-${index + 1}`
    const requestId = `${stressRunId}-request-${index + 1}`
    return (async () => {
      await barrier.wait()
      const startedMonotonicMs = performance.now()
      try {
        const value = await operation({ stressRunId, scenarioId, virtualUserId, requestId })
        return {
          stressRunId,
          scenarioId,
          virtualUserId,
          requestId,
          startedMonotonicMs,
          endedMonotonicMs: performance.now(),
          ok: true,
          value,
        }
      } catch (error) {
        return {
          stressRunId,
          scenarioId,
          virtualUserId,
          requestId,
          startedMonotonicMs,
          endedMonotonicMs: performance.now(),
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })()
  })

  barrier.release()
  const results = await Promise.all(waiting)
  const starts = results.map(({ startedMonotonicMs }) => startedMonotonicMs)
  const releaseSpreadMs = Math.max(...starts) - Math.min(...starts)

  return {
    contractVersion: STRESS_TEST_CONTRACT_VERSION,
    stressRunId,
    scenarioId,
    virtualUsers,
    releaseSpreadMs,
    releaseWindowMsMaximum: MAXIMUM_RELEASE_SPREAD_MS,
    releaseWindowPassed: releaseSpreadMs <= MAXIMUM_RELEASE_SPREAD_MS,
    successCount: results.filter(({ ok }) => ok).length,
    failureCount: results.filter(({ ok }) => !ok).length,
    results,
  }
}

async function main() {
  if (process.argv[2] !== '--dry-run') {
    throw new Error('Phase 2.0 harness permits only --dry-run; full stress execution is not authorized')
  }

  const result = await runBarrierDryRun()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.passed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}