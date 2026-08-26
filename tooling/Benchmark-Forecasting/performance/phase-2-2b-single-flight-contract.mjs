import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const contractPath = path.join(directory, 'phase-2-2b-single-flight-experiment-contract.json')

export const singleFlightExperimentContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))

export function serializeLogicalKey(fieldNames, identity) {
  return fieldNames.map((fieldName) => {
    const value = identity[fieldName] === null ? '<NULL>' : String(identity[fieldName])
    return `${Buffer.byteLength(fieldName, 'utf8')}:${fieldName}${Buffer.byteLength(value, 'utf8')}:${value}`
  }).join('|')
}

export function buildLogicalKey(family, identity) {
  const definition = singleFlightExperimentContract.logicalKeys[family]
  if (!definition) {
    throw new Error(`Unknown logical key family: ${family}`)
  }

  const completeIdentity = { ...identity, namespace: definition.namespace }
  const missing = definition.fields.filter((fieldName) => completeIdentity[fieldName] === undefined)
  if (missing.length > 0) {
    throw new Error(`Missing ${family} logical key fields: ${missing.join(', ')}`)
  }

  return serializeLogicalKey(definition.fields, completeIdentity)
}

export const canonicalCurrentIdentity = Object.freeze({
  seriesId: 'wocaes0280',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  modelId: 'naive',
  inputSource: 'MACROBOND',
  historyFingerprint: '7afe5dd3e125915ed483a9ba0bf28ae4',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  forecastOrigin: '2026-08-21T00:00:00Z',
  horizonConfigurationId: 'CURRENT_DEFAULT_6M_12M_V1',
})

export const canonicalVerificationIdentity = Object.freeze({
  seriesId: 'wocaes0280',
  targetBasis: 'MONTHLY_AVERAGE',
  targetSemantics: 'MONTHLY_AVERAGE',
  methodId: 'MONTHLY_AVERAGE',
  methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
  modelId: 'naive',
  inputSource: 'MACROBOND',
  historyFingerprint: '7afe5dd3e125915ed483a9ba0bf28ae4',
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  frequencyIdentity: 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY',
  verificationHorizonSetId: 'VERIFICATION_DEFAULT_6M_12M_V1',
  verificationConfigurationId: 'EXPANDING_ORIGIN_V1',
  originPolicyId: 'CANONICAL_EXPANDING_ORIGIN_V1',
})