import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCurrentLogicalArtifactKey,
  type CurrentLogicalArtifactIdentity,
} from '../lib/forecast/current-single-flight'
import {
  buildVerificationLogicalArtifactKey,
  type VerificationLogicalArtifactIdentity,
} from '../lib/forecast/verification-single-flight'

const PERSISTENCE_OWNERSHIP_KEY_FIELDS = [
  'namespace',
  'artifactFamily',
  'artifactLogicalKey',
  'persistenceOperation',
  'persistenceSchemaVersion',
] as const

type PersistenceOwnershipIdentity = {
  artifactFamily: 'CURRENT' | 'VERIFICATION'
  artifactLogicalKey: string
  persistenceOperation: string
  persistenceSchemaVersion: string
}

function buildPersistenceOwnershipKey(identity: PersistenceOwnershipIdentity) {
  const completeIdentity: Record<(typeof PERSISTENCE_OWNERSHIP_KEY_FIELDS)[number], string | undefined> = {
    namespace: 'PERSISTENCE',
    ...identity,
  }
  const missingFields = PERSISTENCE_OWNERSHIP_KEY_FIELDS.filter(
    (fieldName) => completeIdentity[fieldName] === undefined || completeIdentity[fieldName] === '',
  )
  if (missingFields.length > 0) {
    throw new Error(`Missing persistence ownership key fields: ${missingFields.join(', ')}`)
  }
  const serializeField = (fieldName: string, value: string) =>
    `${Buffer.byteLength(fieldName, 'utf8')}:${fieldName}${Buffer.byteLength(value, 'utf8')}:${value}`
  return PERSISTENCE_OWNERSHIP_KEY_FIELDS.map((fieldName) =>
    serializeField(fieldName, completeIdentity[fieldName]!),
  ).join('|')
}

const currentIdentity: CurrentLogicalArtifactIdentity = {
  seriesId: 'b3.current',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  modelId: 'naive',
  inputSource: 'B3_CONTROLLED_FIXTURE',
  historyFingerprint: 'b3-current-history',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  forecastOrigin: '2026-04-01T00:00:00.000Z',
  horizonConfigurationId: '1M:1:2026-05-01|3M:3:2026-07-01',
}

const verificationIdentity: VerificationLogicalArtifactIdentity = {
  seriesId: 'b3.verification',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  modelId: 'naive',
  inputSource: 'B3_CONTROLLED_FIXTURE',
  historyFingerprint: 'b3-verification-history',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  verificationHorizonSetId: '{"1M":1,"3M":3}',
  verificationConfigurationId: '{"minTrainingWindow":36}',
  originPolicyId: 'EXPANDING_WINDOW_ROLLING_ORIGIN@expanding-window-rolling-origin-v1',
}

test('PERSISTENCE_OWNERSHIP_KEY_V1 preserves the frozen field order and complete Current identity', () => {
  assert.deepEqual(PERSISTENCE_OWNERSHIP_KEY_FIELDS, [
    'namespace',
    'artifactFamily',
    'artifactLogicalKey',
    'persistenceOperation',
    'persistenceSchemaVersion',
  ])
  const artifactLogicalKey = buildCurrentLogicalArtifactKey(currentIdentity)
  const key = buildPersistenceOwnershipKey({
    artifactFamily: 'CURRENT',
    artifactLogicalKey,
    persistenceOperation: 'UPSERT_REPLACE_CURRENT_POINTS',
    persistenceSchemaVersion: 'forecast-library-prisma-v1',
  })

  assert.match(key, /^9:namespace11:PERSISTENCE\|/)
  assert.ok(key.includes(artifactLogicalKey))
  assert.equal(buildPersistenceOwnershipKey({
    artifactFamily: 'CURRENT',
    artifactLogicalKey,
    persistenceOperation: 'UPSERT_REPLACE_CURRENT_POINTS',
    persistenceSchemaVersion: 'forecast-library-prisma-v1',
  }), key)
})

test('PERSISTENCE_OWNERSHIP_KEY_V1 embeds complete Verification identity and isolates artifact families', () => {
  const verificationLogicalKey = buildVerificationLogicalArtifactKey(verificationIdentity)
  const verificationKey = buildPersistenceOwnershipKey({
    artifactFamily: 'VERIFICATION',
    artifactLogicalKey: verificationLogicalKey,
    persistenceOperation: 'UPSERT_REPLACE_VERIFICATION_CHILDREN',
    persistenceSchemaVersion: 'forecast-library-prisma-v1',
  })
  const currentFamilyKey = buildPersistenceOwnershipKey({
    artifactFamily: 'CURRENT',
    artifactLogicalKey: verificationLogicalKey,
    persistenceOperation: 'UPSERT_REPLACE_VERIFICATION_CHILDREN',
    persistenceSchemaVersion: 'forecast-library-prisma-v1',
  })

  assert.ok(verificationKey.includes(verificationLogicalKey))
  assert.notEqual(verificationKey, currentFamilyKey)
})

test('PERSISTENCE_OWNERSHIP_KEY_V1 isolates operation and schema version and fails closed', () => {
  const artifactLogicalKey = buildCurrentLogicalArtifactKey(currentIdentity)
  const base = {
    artifactFamily: 'CURRENT' as const,
    artifactLogicalKey,
    persistenceOperation: 'UPSERT_REPLACE_CURRENT_POINTS',
    persistenceSchemaVersion: 'forecast-library-prisma-v1',
  }
  const key = buildPersistenceOwnershipKey(base)

  assert.notEqual(key, buildPersistenceOwnershipKey({ ...base, persistenceOperation: 'READ_CURRENT' }))
  assert.notEqual(key, buildPersistenceOwnershipKey({ ...base, persistenceSchemaVersion: 'forecast-library-prisma-v2' }))
  assert.throws(
    () => buildPersistenceOwnershipKey({ ...base, artifactLogicalKey: '' }),
    /artifactLogicalKey/,
  )
})