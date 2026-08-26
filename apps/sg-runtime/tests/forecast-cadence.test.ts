import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCalendarTargetPeriod,
  createForecastCadence,
  createForecastTargetPeriod,
  createFutureForecastTargetPeriods,
  getLawfulObservationsInForecastTargetPeriod,
  isObservationInForecastTargetPeriod,
  mapLegacyCalendarMonthHorizonToNativeSteps,
  reduceForecastPeriodAverage,
  reduceForecastPeriodEndOfPeriod,
} from '../lib/forecast/cadence'

test('keeps source frequency and target cadence as explicit separate dimensions', () => {
  assert.deepEqual(createForecastCadence('QUARTERLY', 'SEMIANNUAL'), {
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'SEMIANNUAL',
  })
})

test('calendar periods use half-open UTC boundaries for accepted sparse cadences', () => {
  const cases = [
    ['DAILY', '2026-06-15T00:00:00.000Z', '2026-06-16T00:00:00.000Z'],
    ['WEEKLY', '2026-06-15T00:00:00.000Z', '2026-06-22T00:00:00.000Z'],
    ['MONTHLY', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['BIMONTHLY', '2026-05-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['QUARTERLY', '2026-04-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['QUADMONTHLY', '2026-05-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'],
    ['SEMIANNUAL', '2026-01-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'],
    ['ANNUAL', '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ] as const

  for (const [cadence, expectedStart, expectedEnd] of cases) {
    const period = createCalendarTargetPeriod('2026-06-15T12:00:00.000Z', cadence)
    assert.equal(period.start.toISOString(), expectedStart)
    assert.equal(period.endExclusive.toISOString(), expectedEnd)
    assert.equal(isObservationInForecastTargetPeriod(expectedStart, period), true)
    assert.equal(isObservationInForecastTargetPeriod(new Date(Date.parse(expectedEnd) - 1), period), true)
    assert.equal(isObservationInForecastTargetPeriod(expectedEnd, period), false)
    assert.equal(isObservationInForecastTargetPeriod(new Date(Date.parse(expectedStart) - 1), period), false)
  }
})

test('generic membership and reducers encode the canonical Q1 plus Q2 to H1 example', () => {
  const h1 = createForecastTargetPeriod(
    'SEMIANNUAL',
    '2026-01-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
  )
  const lawful = getLawfulObservationsInForecastTargetPeriod([
    { date: '2026-07-01T00:00:00.000Z', value: 999 },
    { date: '2026-06-30T00:00:00.000Z', value: 5 },
    { date: '2026-04-01T00:00:00.000Z', value: null },
    { date: '2026-03-31T00:00:00.000Z', value: 10 },
    { date: '2025-12-31T00:00:00.000Z', value: 777 },
  ], h1)

  assert.deepEqual(lawful.map((observation) => observation.value), [10, 5])
  assert.equal(reduceForecastPeriodAverage(lawful), 7.5)
  assert.deepEqual(reduceForecastPeriodEndOfPeriod(lawful), {
    observedAt: new Date('2026-06-30T00:00:00.000Z'),
    value: 5,
  })
})

test('single and empty target periods remain truthful without synthetic observations', () => {
  const period = createCalendarTargetPeriod('2026-03-15T00:00:00.000Z', 'MONTHLY')
  const single = getLawfulObservationsInForecastTargetPeriod([
    { date: '2026-02-28T00:00:00.000Z', value: 99 },
    { date: '2026-03-10T00:00:00.000Z', value: 10 },
    { date: '2026-03-31T00:00:00.000Z', value: null },
    { date: '2026-04-01T00:00:00.000Z', value: 101 },
  ], period)

  assert.equal(reduceForecastPeriodAverage(single), 10)
  assert.equal(reduceForecastPeriodEndOfPeriod(single)?.value, 10)
  assert.equal(reduceForecastPeriodAverage([]), null)
  assert.equal(reduceForecastPeriodEndOfPeriod([]), null)
})

test('non-finite in-period observations fail closed', () => {
  const period = createCalendarTargetPeriod('2026-03-15T00:00:00.000Z', 'MONTHLY')
  assert.throws(
    () => getLawfulObservationsInForecastTargetPeriod([
      { date: '2026-03-10T00:00:00.000Z', value: Number.NaN },
    ], period),
    /non-finite observation/i,
  )
})

test('future native target periods cross calendar boundaries without intermediate months', () => {
  const cases = [
    ['DAILY', '2026-08-23', 1, ['2026-08-24']],
    ['WEEKLY', '2026-08-24', 2, ['2026-08-31', '2026-09-07']],
    ['MONTHLY', '2026-12-01', 1, ['2027-01-01']],
    ['QUARTERLY', '2026-10-01', 2, ['2027-01-01', '2027-04-01']],
    ['SEMIANNUAL', '2026-07-01', 1, ['2027-01-01']],
    ['ANNUAL', '2026-01-01', 1, ['2027-01-01']],
  ] as const

  for (const [cadence, origin, horizonSteps, expectedStarts] of cases) {
    const targetPeriods = createFutureForecastTargetPeriods(origin, cadence, horizonSteps)
    assert.deepEqual(
      targetPeriods.map((period) => period.start.toISOString().slice(0, 10)),
      expectedStarts,
    )
  }
})

test('legacy calendar-month horizons map only to exact native-step counts', () => {
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('MONTHLY', 1), 1)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('QUARTERLY', 3), 1)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('QUARTERLY', 12), 4)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('SEMIANNUAL', 6), 1)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('ANNUAL', 12), 1)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('QUARTERLY', 1), null)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('ANNUAL', 6), null)
  assert.equal(mapLegacyCalendarMonthHorizonToNativeSteps('WEEKLY', 1), null)
})