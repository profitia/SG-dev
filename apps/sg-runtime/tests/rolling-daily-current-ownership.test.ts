import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRollingDailyCurrentHorizonConfigurationId,
  prepareRollingDailyCurrentOwnership,
} from '@/lib/forecast/rolling-daily-current-ownership'
import {
  getActiveCurrentForecastSingleFlightEntryCount,
  runCurrentForecastSingleFlight,
} from '@/lib/forecast/service'

const history = {
  seriesId: 'daily-series',
  displayName: 'Daily series',
  description: null,
  frequency: 'DAILY',
  source: 'test',
  points: [
    { date: '2026-01-30T00:00:00.000Z', value: 99 },
    { date: '2026-01-31T00:00:00.000Z', value: 100 },
    { date: '2026-02-01T00:00:00.000Z', value: null },
  ],
}

test('Daily Current ownership prepares the complete frozen identity before compute', async () => {
  const prepared = await prepareRollingDailyCurrentOwnership({
    seriesId: history.seriesId,
    modelId: 'ets',
    loadHistory: async () => history,
  })
  const horizon = JSON.parse(prepared.identity.horizonConfigurationId)

  assert.equal(prepared.history, history)
  assert.equal(prepared.identity.forecastOrigin, '2026-01-31')
  assert.equal(prepared.identity.historyFingerprint.length, 64)
  assert.equal(prepared.identity.frequencyIdentity, 'FORECAST_CADENCE_V1|source=DAILY|target=DAILY')
  assert.equal(horizon.anchorTargetDates['1M'], '2026-02-28')
  assert.equal(horizon.anchorTargetDates['12M'], '2027-01-31')
  assert.equal(horizon.path.startDate, '2026-02-01')
  assert.equal(horizon.path.endDate, '2027-01-31')
  assert.match(prepared.logicalArtifactKey, /^9:namespace7:CURRENT\|/)
})

test('Daily callers share the accepted Current owner and release the entry after settlement', async () => {
  const logicalArtifactKey = `daily-test|${buildRollingDailyCurrentHorizonConfigurationId('2026-01-31')}`
  const events: string[] = []
  let computes = 0
  let releaseOwner: (() => void) | undefined
  const ownerGate = new Promise<void>((resolve) => {
    releaseOwner = resolve
  })
  const callers = Array.from({ length: 4 }, (_, index) => runCurrentForecastSingleFlight({
    logicalArtifactKey,
    requestId: `daily-request-${index + 1}`,
    emit: (event) => events.push(event),
    operation: async () => {
      computes += 1
      await ownerGate
      return { status: 'SUCCEEDED' }
    },
  }))

  await new Promise<void>((resolve) => setImmediate(resolve))
  releaseOwner?.()
  const results = await Promise.all(callers)

  assert.equal(computes, 1)
  assert.equal(events.filter((event) => event === 'single_flight_owner_acquired').length, 1)
  assert.equal(events.filter((event) => event === 'single_flight_waiter_joined').length, 3)
  assert.equal(events.filter((event) => event === 'single_flight_entry_released').length, 1)
  assert.deepEqual(results, Array.from({ length: 4 }, () => ({ status: 'SUCCEEDED' })))
  assert.equal(getActiveCurrentForecastSingleFlightEntryCount(), 0)
})