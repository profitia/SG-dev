import { createHash } from 'node:crypto'
import { OperationDenied } from './operation-context.mjs'

export const ACCESS_STORE_CONTRACT = Object.freeze({ id: 'profitia.access-store', version: '1.0.0', schemaVersion: '1.0.0' })
export const accessSchemaUrl = new URL('../migrations/access/001-internal-access.sql', import.meta.url).href
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (value, maximum = 256) => typeof value === 'string' && value.length > 0 && value.length <= maximum
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
const fail = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
const eventKeys = new Set(['decisionId', 'contractId', 'contractVersion', 'implementationVersion', 'applicationId', 'applicationProfile', 'deploymentId', 'configurationVersion', 'environment', 'operationStartedAt', 'occurredAt', 'operation', 'actorId', 'actorKind', 'subjectUserId', 'organisationId', 'identityProofRef', 'identityIssuer', 'identityAudience', 'resourceId', 'payloadDigest', 'mode', 'policyVersion', 'accessBasisType', 'accessVersion', 'accessSourceRef', 'feature', 'effect', 'correlationId', 'resourceType', 'dataClass', 'ownerOrganisationId', 'ownerUserId', 'resourceVersion', 'projectionVersion', 'productEvidence', 'usagePolicy', 'phase', 'decision', 'reasonCode'])
const productKeys = new Set(['product','version','sourceRef','source','expiresAt','feature'])
const sensitive = value => /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(value)
function validAuditValue(key, value) {
  if (key !== 'productEvidence') return value === null || (text(value,512) && !sensitive(value))
  return Array.isArray(value) && value.length <= 32 && value.every(item => item && Object.getPrototypeOf(item) === Object.prototype && Object.entries(item).every(([k,v]) => productKeys.has(k) && text(v) && !sensitive(v)))
}

/** SQL primitives for a host-owned transaction. Never a transaction emulator or
 * identity issuer. The query function must remain bound to the SAME transaction
 * for lockAccess, product effects and OUTCOME; host commit/rollback is separate.
 */
export function createAccessStore({ binding, now = Date.now }) {
  const config = structuredClone(binding)
  if (!config || !['development', 'staging', 'production'].includes(config.environment) || !['applicationId', 'projectId', 'branchId', 'databaseName', 'role'].every(key => text(config[key], 128)) || !/^[a-z][a-z0-9_]*$/.test(config.role) || !/^[a-f0-9]{64}$/.test(config.schemaDigest ?? '') || typeof now !== 'function') throw new TypeError('Explicit server-owned access-store binding required')
  freeze(config)
  const leases = new WeakSet()
  const invoke = async (query, sql, values = []) => {
    try {
      if (typeof query !== 'function') fail()
      const result = await query(sql, values)
      if (!Array.isArray(result?.rows)) fail()
      return result.rows
    } catch { fail() }
  }
  const descriptor = async query => {
    const [row] = await invoke(query, `SELECT current_database() AS database_name,current_user AS role,session_user AS login,
      r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,
      profitia_access.runtime_descriptor() AS descriptor FROM pg_roles r WHERE r.rolname=current_user`)
    const d = row?.descriptor
    if (!row || row.database_name !== config.databaseName || row.role !== config.role || row.login !== config.role || ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolinherit'].some(key => row[key] !== false) || !d || d.schemaVersion !== ACCESS_STORE_CONTRACT.schemaVersion || d.schemaDigest !== config.schemaDigest || d.applicationId !== config.applicationId || d.environment !== config.environment || d.projectId !== config.projectId || d.branchId !== config.branchId || d.databaseName !== config.databaseName || d.role !== config.role) fail()
    return d
  }
  const verifyScope = async (query, lease) => {
    if (!lease || !leases.has(lease) || !(Date.parse(lease.expiresAt) > now())) fail()
    await descriptor(query)
    const [row] = await invoke(query, `SELECT txid_current()::text AS transaction_id,
      profitia_access.scope_allows($1,$2::uuid,$3::uuid) AS allowed`,
    [config.applicationId, lease.organisationId, lease.userId])
    if (row?.transaction_id !== lease.transactionId || row.allowed !== true) fail()
  }
  return Object.freeze({
    contract: ACCESS_STORE_CONTRACT,
    async resolveBinding(query, key) {
      key = { environment: key?.environment, issuer: key?.issuer, subject: key?.subject }
      if (!key || key.environment !== config.environment || !text(key.issuer) || !text(key.subject)) fail()
      await descriptor(query)
      const [row] = await invoke(query, 'SELECT profitia_access.identity_binding($1,$2) AS binding', [key.issuer, key.subject])
      const value = row?.binding
      if (value === null) return null
      if (!value || value.environment !== config.environment || value.issuer !== key.issuer || value.subject !== key.subject || !uuid.test(value.userId) || value.status !== 'ACTIVE' || !text(value.version) || !text(value.sourceRef) || !(Date.parse(value.expiresAt) > now())) fail()
      return freeze(structuredClone(value))
    },
    async lockAccess(query, { actor, identityBinding, organisationId }) {
      try { ({ actor, identityBinding } = structuredClone({ actor, identityBinding })) }
      catch { fail() }
      if (!actor || actor.kind !== 'HUMAN' || !uuid.test(actor.actorId) || actor.userId !== actor.actorId || actor.environment !== config.environment || actor.audience !== config.applicationId || !(Date.parse(actor.expiresAt) > now()) || !identityBinding || identityBinding.userId !== actor.userId || identityBinding.environment !== config.environment || identityBinding.issuer !== actor.issuer || identityBinding.status !== 'ACTIVE' || !text(identityBinding.subject) || !text(identityBinding.version) || !(Date.parse(identityBinding.expiresAt) > now()) || !(organisationId === null || uuid.test(organisationId))) fail()
      await descriptor(query)
      const [row] = await invoke(query, 'SELECT profitia_access.lock_access($1::uuid,$2::uuid,$3,$4,$5) AS state', [actor.userId, organisationId, identityBinding.issuer, identityBinding.subject, identityBinding.version])
      const state = row?.state
      if (!state || state.applicationId !== config.applicationId || state.environment !== config.environment || state.identityBindingVersion !== identityBinding.version || state.access?.actorId !== actor.userId || state.access.organisationId !== organisationId || !/^access-v1:[1-9][0-9]*$/.test(state.policyVersion) || !/^[0-9]+$/.test(state.transactionId)) fail()
      const expiry = Math.min(Date.parse(actor.expiresAt), Date.parse(identityBinding.expiresAt), Date.parse(state.access.expiresAt))
      if (!Number.isFinite(expiry) || !(expiry > now())) fail()
      const expiresAt = new Date(expiry).toISOString()
      state.access.expiresAt = expiresAt
      const [bound] = await invoke(query, `SELECT
        set_config('profitia.user_id',$1,true),set_config('profitia.organisation_id',$2,true),
        set_config('profitia.application_id',$3,true),set_config('profitia.environment',$4,true),
        set_config('profitia.policy_version',$5,true),set_config('profitia.identity_binding_version',$6,true),
        set_config('profitia.scope_expires_at',$7,true),set_config('profitia.transaction_id',$8,true),
        txid_current()::text AS transaction_id WHERE txid_current()::text=$8`,
      [actor.userId, organisationId ?? '', config.applicationId, config.environment, state.policyVersion, identityBinding.version, expiresAt, state.transactionId])
      // A pool-level/autocommit query would have already released the fence.
      if (bound?.transaction_id !== state.transactionId) fail()
      const lease = freeze({ state: structuredClone(state), userId: actor.userId, organisationId, expiresAt, transactionId: state.transactionId })
      leases.add(lease)
      return lease
    },
    verifyScope,
    async appendAudit(query, event, lease) {
      if (!event || Object.getPrototypeOf(event) !== Object.prototype || Object.entries(event).some(([key,value]) => !eventKeys.has(key) || !validAuditValue(key,value)) || event.applicationId !== config.applicationId || event.environment !== config.environment || !uuid.test(event.decisionId) || !['INTENT', 'OUTCOME', 'DECISION', 'FAILURE'].includes(event.phase) || !['ALLOW', 'DENY'].includes(event.decision) || !/^[A-Z_]{1,64}$/.test(event.reasonCode ?? '')) fail()
      const encoded = JSON.stringify(event)
      if (Buffer.byteLength(encoded) > 16384) fail()
      if (event.phase === 'OUTCOME') {
        if (!lease || event.actorId !== lease.userId || event.organisationId !== lease.organisationId || event.policyVersion !== lease.state.policyVersion) fail()
        await verifyScope(query, lease)
      } else await descriptor(query)
      await invoke(query, 'SELECT profitia_access.append_audit($1::jsonb)', [encoded])
    },
  })
}

export function accessStoreSourceDigest() {
  return import('node:fs').then(fs => createHash('sha256')
    .update(fs.readFileSync(new URL('./access-store.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./access-store.d.mts', import.meta.url)))
    .update(fs.readFileSync(new URL(accessSchemaUrl))).digest('hex'))
}
export function accessSchemaDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL(accessSchemaUrl))).digest('hex'))
}
