import assert from 'node:assert/strict'
import test from 'node:test'

import {
  measureForecastWorkerJob,
  recordForecastPythonResourceMeasurement,
} from '@/lib/forecast/worker-resource-telemetry'

test('worker resource summary combines the sequential Node window and exact Python processes', async () => {
  const measured = await measureForecastWorkerJob({ correlationId: 'corr-1', jobKey: 'job-1' }, async () => {
    recordForecastPythonResourceMeasurement({
      script: 'forecast.py',
      wallMs: 120,
      userCpuMs: 80,
      systemCpuMs: 10,
      maxRssBytes: 42_000,
    })
    return 'done'
  })

  assert.equal(measured.value, 'done')
  assert.equal(measured.summary.correlationId, 'corr-1')
  assert.equal(measured.summary.python.processCount, 1)
  assert.equal(measured.summary.python.userCpuMs, 80)
  assert.equal(measured.summary.python.maxRssBytes, 42_000)
  assert.equal(measured.summary.attributionQuality.python, 'EXACT_PROCESS')
  assert.ok(measured.summary.node.peakSampledRssBytes > 0)
})
