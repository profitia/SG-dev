import { createHash } from 'node:crypto'
import { OperationDenied } from './operation-context.mjs'

export const MODULE_SCOPE_CONTRACT = Object.freeze({ id: 'profitia.module-scope', version: '1.0.0' })
export const moduleSchemaUrl = new URL('../migrations/access/002-module-scope.sql', import.meta.url).href
const modules = new Set(['benchmark', 'category', 'supplier_report'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 128
const unavailable = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }

/** Additional data boundary INSIDE an accepted private-host transaction. This
 * does not authenticate, grant permissions or run a second decision engine. */
export function createModuleScopeGuard({ applicationId, environment, moduleId, schemaDigest, now = Date.now }) {
  if (!text(applicationId) || !['development', 'staging', 'production'].includes(environment)
    || !modules.has(moduleId) || !/^[a-f0-9]{64}$/.test(schemaDigest ?? '') || typeof now !== 'function') {
    throw new TypeError('Explicit application, module and accepted schema required')
  }
  return Object.freeze({
    contract: MODULE_SCOPE_CONTRACT,
    async bind(query, { organisationId, userId }) {
      if (typeof query !== 'function' || !uuid.test(organisationId ?? '') || !uuid.test(userId ?? '')) unavailable()
      let rows
      try { rows = (await query('SELECT profitia_modules.bind_scope($1) AS module,txid_current()::text AS transaction_id', [moduleId]))?.rows }
      catch { unavailable() }
      if (!Array.isArray(rows) || rows.length !== 1) unavailable()
      const d = rows[0]?.module
      if (d === null) throw new OperationDenied('APPLICATION_FEATURE_UNAVAILABLE')
      if (!d || d.applicationId !== applicationId || d.environment !== environment || d.moduleId !== moduleId
        || d.moduleContractId !== MODULE_SCOPE_CONTRACT.id || d.moduleContractVersion !== MODULE_SCOPE_CONTRACT.version
        || d.moduleSchemaDigest !== schemaDigest || d.organisationId !== organisationId || d.userId !== userId
        || !uuid.test(d.moduleBindingId ?? '') || !/^[1-9][0-9]*$/.test(d.moduleBindingVersion ?? '')
        || typeof d.moduleSourceRef !== 'string' || !d.moduleSourceRef.length || d.moduleSourceRef.length > 256
        || !/^[0-9]+$/.test(d.transactionId ?? '') || d.transactionId !== rows[0].transaction_id
        || !Number.isFinite(Date.parse(d.expiresAt)) || Date.parse(d.expiresAt) <= now()) unavailable()
      return Object.freeze({ moduleId, moduleBindingId: d.moduleBindingId, version: d.moduleBindingVersion,
        sourceRef: d.moduleSourceRef, expiresAt: d.expiresAt, transactionId: d.transactionId })
    },
  })
}

export function moduleSchemaDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL(moduleSchemaUrl))).digest('hex'))
}
export function moduleScopeSourceDigest() {
  return import('node:fs').then(fs => createHash('sha256')
    .update(fs.readFileSync(new URL('./module-scope.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./module-scope.d.mts', import.meta.url)))
    .update(fs.readFileSync(new URL(moduleSchemaUrl))).digest('hex'))
}
