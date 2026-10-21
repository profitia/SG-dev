import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { OperationDenied } from './operation-context.mjs'

export const profileSchemaUrl = new URL('../migrations/profile/001-user-profile.sql', import.meta.url).href
export const profileSchemaDigest = () => createHash('sha256').update(readFileSync(new URL(profileSchemaUrl))).digest('hex')
export class ProfileConflict extends Error {
  constructor() { super('Profile version conflict'); this.name = 'ProfileConflict'; this.code = 'PROFILE_VERSION_CONFLICT' }
}
export const deny = () => { throw new OperationDenied('ACCESS_BASIS_INVALID') }
export const unavailable = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
export const closedObject = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).length === Object.keys(value).length
  && Object.values(Object.getOwnPropertyDescriptors(value)).every(d => 'value' in d && d.enumerable)

// A DB scope attestation is not a login credential. It binds the existing
// backend's verified decision to one SQL transaction, role, operation and user.
// Ordinary SQL login/GUC manipulation alone cannot mint one. Never log this key.
export function createProfileSql({ binding, issuer, schemaDigest, proofKey, now = Date.now }) {
  const config = structuredClone(binding)
  if (!config || !/^[a-f0-9]{64}$/.test(schemaDigest ?? '') || !(proofKey instanceof Uint8Array) || proofKey.byteLength !== 32 || typeof now !== 'function') throw new TypeError('Explicit profile installation and private backend attestation key required')
  const key = Buffer.from(proofKey)
  const queryOne = async (query, sql, values = []) => {
    try {
      const r = await query(sql, values)
      if (r?.rows?.length !== 1) unavailable()
      return r.rows[0]
    } catch (error) {
      if (error?.code === 'PT409') throw new ProfileConflict()
      if (error?.code === 'PT403') deny()
      unavailable()
    }
  }
  const descriptor = async query => {
    const { descriptor: d } = await queryOne(query, 'SELECT profitia_profile.runtime_descriptor() AS descriptor')
    if (!d || d.issuer !== issuer || d.profileSchemaDigest !== schemaDigest || d.schemaDigest !== config.schemaDigest
      || ['applicationId', 'environment', 'projectId', 'branchId', 'databaseName', 'role'].some(k => d[k] !== config[k]) || d.enabled !== true) deny()
    return d
  }
  return Object.freeze({
    queryOne, descriptor,
    async attest(query, { operation, principal, issuer = '', identityUntil = 0, expiresAt }) {
      await descriptor(query)
      const { transaction_id: tx } = await queryOne(query, 'SELECT txid_current()::text AS transaction_id')
      const until = Math.min(now() + 5000, expiresAt)
      const parts = [config.environment, config.applicationId, config.role, operation, tx, principal, issuer, String(until), String(identityUntil)]
      if (!/^[1-9][0-9]*$/.test(tx ?? '') || !Number.isSafeInteger(until) || until <= now()
        || parts.some(v => typeof v !== 'string' || /[\u0000-\u001f\u007f]/u.test(v))) deny()
      return Object.freeze({ until, signature: createHmac('sha256', key).update(parts.join('\u001f')).digest('hex') })
    },
  })
}
