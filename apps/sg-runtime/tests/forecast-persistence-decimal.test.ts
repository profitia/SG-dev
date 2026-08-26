import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildVerificationPersistenceDecimals,
  normalizeForecastLibraryDecimal,
} from '../lib/forecast/persistence-decimal'

test('forecast persistence normalization keeps positive delta exact at persisted scale', () => {
  const result = buildVerificationPersistenceDecimals({
    originValue: 0,
    forecastValue: 100.12345678,
    actualValue: 99.12345678,
  })

  assert.equal(result.forecastValue.toString(), '100.12345678')
  assert.equal(result.actualValue.toString(), '99.12345678')
  assert.equal(result.deltaValue.toString(), '1')
  assert.equal(result.errorValue.toString(), '1')
  assert.equal(result.absoluteErrorValue.toString(), '1')
})

test('forecast persistence normalization keeps negative delta exact at persisted scale', () => {
  const result = buildVerificationPersistenceDecimals({
    originValue: 0,
    forecastValue: 99.12345678,
    actualValue: 100.12345678,
  })

  assert.equal(result.deltaValue.toString(), '-1')
  assert.equal(result.errorValue.toString(), '-1')
  assert.equal(result.absoluteErrorValue.toString(), '1')
})

test('forecast persistence normalization collapses near-zero invisible residue to zero', () => {
  const result = buildVerificationPersistenceDecimals({
    originValue: 0,
    forecastValue: 10.1234567841,
    actualValue: 10.1234567842,
  })

  assert.equal(result.forecastValue.toString(), '10.12345678')
  assert.equal(result.actualValue.toString(), '10.12345678')
  assert.equal(result.deltaValue.toString(), '0')
})

test('forecast persistence normalization reproduces and fixes the historical rounding-boundary residue class', () => {
  const oldPersistedForecast = normalizeForecastLibraryDecimal('100.123456785')
  const oldPersistedActual = normalizeForecastLibraryDecimal('100.123456784')
  const oldPersistedDelta = normalizeForecastLibraryDecimal('1e-9')
  const corrected = buildVerificationPersistenceDecimals({
    originValue: 0,
    forecastValue: 100.123456785,
    actualValue: 100.123456784,
  })

  assert.equal(oldPersistedForecast.toString(), '100.12345679')
  assert.equal(oldPersistedActual.toString(), '100.12345678')
  assert.equal(oldPersistedDelta.toString(), '0')
  assert.equal(corrected.deltaValue.toFixed(8), '0.00000001')
  assert.notEqual(oldPersistedDelta.toString(), corrected.deltaValue.toString())
})