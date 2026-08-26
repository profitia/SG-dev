import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLogicalKey,
  canonicalCurrentIdentity,
  canonicalVerificationIdentity,
  singleFlightExperimentContract,
} from './phase-2-2b-single-flight-contract.mjs'

const currentKey = (overrides = {}) => buildLogicalKey('current', { ...canonicalCurrentIdentity, ...overrides })
const verificationKey = (overrides = {}) => buildLogicalKey('verification', { ...canonicalVerificationIdentity, ...overrides })

test('same exact Current identity produces the same deterministic key', () => {
  assert.equal(currentKey(), currentKey())
})

test('Current logical key isolates model', () => {
  assert.notEqual(currentKey(), currentKey({ modelId: 'arima' }))
})

test('Current logical key isolates history fingerprint', () => {
  assert.notEqual(currentKey(), currentKey({ historyFingerprint: 'fingerprint-b' }))
})

test('Current logical key isolates semantic and target basis', () => {
  assert.notEqual(currentKey(), currentKey({ targetBasis: 'END_OF_PERIOD', targetSemantics: 'END_OF_PERIOD', methodId: 'END_OF_PERIOD' }))
})

test('Current logical key isolates source and target cadence identity', () => {
  assert.notEqual(currentKey(), currentKey({
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
    frequencyIdentity: 'FORECAST_CADENCE_V1|source=QUARTERLY|target=QUARTERLY',
  }))
})

test('Current logical key isolates forecast origin and horizon configuration', () => {
  assert.notEqual(currentKey(), currentKey({ forecastOrigin: '2026-08-22T00:00:00Z' }))
  assert.notEqual(currentKey(), currentKey({ horizonConfigurationId: 'CURRENT_ALTERNATE_V1' }))
})

test('Verification logical key isolates horizon and origin policy configuration', () => {
  assert.notEqual(verificationKey(), verificationKey({ verificationHorizonSetId: 'VERIFICATION_12M_ONLY_V1' }))
  assert.notEqual(verificationKey(), verificationKey({ originPolicyId: 'ALTERNATE_ORIGIN_POLICY_V1' }))
})

test('Current and Verification namespaces cannot collide', () => {
  assert.notEqual(currentKey(), verificationKey())
  assert.notEqual(singleFlightExperimentContract.logicalKeys.current.namespace, singleFlightExperimentContract.logicalKeys.verification.namespace)
})

test('incomplete identity is rejected instead of weakened', () => {
  assert.throws(() => buildLogicalKey('current', { seriesId: 'wocaes0280' }), /Missing current logical key fields/)
})

test('experiment contract cannot enable implementation or load', () => {
  assert.equal(Object.values(singleFlightExperimentContract.implementation).some(Boolean), false)
  assert.equal(Object.values(singleFlightExperimentContract.loadBoundary).some((value) => value !== 0), false)
})