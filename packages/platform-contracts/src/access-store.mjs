import {boundedDatabaseLease} from './database-lease.mjs'
import { createHash } from 'node:crypto'
import { OperationDenied, normalizeModuleEvidence } from './operation-context.mjs'

export const ACCESS_STORE_CONTRACT = Object.freeze({ id: 'profitia.access-store', version: '1.2.0', schemaVersion: '1.0.0' })
export const DATABASE_SERVICE_ISSUER = 'urn:profitia:database-service-runtime:v1'
export const accessSchemaUrl = new URL('../migrations/access/001-internal-access.sql', import.meta.url).href
export const moduleAuditSchemaUrl = new URL('../migrations/access/003-module-audit.sql', import.meta.url).href
export const serviceReadSchemaUrl = new URL('../migrations/access/005-service-read.sql', import.meta.url).href
const serviceReads = new Set(['knowledge.read','forecast.read','supplier.report.read'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (value, maximum = 256) => typeof value === 'string' && value.length > 0 && value.length <= maximum
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
const fail = () => { throw new OperationDenied('POLICY_UNAVAILABLE') }
const eventKeys = new Set(['decisionId', 'contractId', 'contractVersion', 'implementationVersion', 'applicationId', 'applicationProfile', 'deploymentId', 'configurationVersion', 'environment', 'operationStartedAt', 'occurredAt', 'operation', 'actorId', 'actorKind', 'subjectUserId', 'organisationId', 'identityProofRef', 'identityIssuer', 'identityAudience', 'resourceId', 'payloadDigest', 'mode', 'policyVersion', 'accessBasisType', 'accessVersion', 'accessSourceRef', 'feature', 'effect', 'correlationId', 'resourceType', 'dataClass', 'ownerOrganisationId', 'ownerUserId', 'resourceVersion', 'projectionVersion', 'productEvidence', 'moduleEvidence', 'usagePolicy', 'phase', 'decision', 'reasonCode'])
const productKeys = new Set(['product','version','sourceRef','source','expiresAt','feature'])
const sensitive = value => /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(value)
function validAuditValue(key, value) {
  if (key === 'moduleEvidence') {
    try { normalizeModuleEvidence(value, { allowExpired: true }); return true } catch { return false }
  }
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
  if (config.service !== undefined && (!config.service || Object.getPrototypeOf(config.service) !== Object.prototype
    || Object.keys(config.service).sort().join(',') !== 'configurationVersion,deploymentId,profileId,schemaDigest'
    || !/^[a-f0-9]{64}$/.test(config.service.schemaDigest ?? '')
    || !['PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE','PLATFORM_INTERNAL'].includes(config.service.profileId)
    || !text(config.service.deploymentId) || !text(config.service.configurationVersion))) throw new TypeError('Explicit service-read binding required')
  freeze(config)
  const leases = new WeakSet()
  const invoke = async (query, sql, values = []) => {
    try {
      if (typeof query !== 'function') fail()
      const result = await query(sql, values)
      if (!Array.isArray(result?.rows)) fail()
      return result.rows
    } catch (error) {
      // SQL003 uses this dedicated, redacted state only for an expired module
      // deadline. pg exposes code; Prisma preserves it in P2010 meta.code.
      if (error?.code === 'PT403' || (error?.code === 'P2010' && error?.meta?.code === 'PT403')) throw new OperationDenied('ACCESS_BASIS_INVALID')
      fail()
    }
  }
  const one = async (query, sql, values = []) => {
    const rows = await invoke(query, sql, values)
    if (rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object' || Array.isArray(rows[0])) fail()
    return rows[0]
  }
  const authority = async (query, extra = '', values = []) => {
    const startedMs=now()
    const row = await one(query, `SELECT current_database() AS database_name,current_user AS role,session_user AS login,
      r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,
      profitia_access.runtime_descriptor() AS descriptor${extra},extract(epoch from clock_timestamp())*1000 AS descriptor_observed_ms FROM pg_roles r WHERE r.rolname=current_user`, values)
    const d = row?.descriptor
    if (!row || row.database_name !== config.databaseName || row.role !== config.role || row.login !== config.role || ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolinherit'].some(key => row[key] !== false) || !d || d.schemaVersion !== ACCESS_STORE_CONTRACT.schemaVersion || d.schemaDigest !== config.schemaDigest || d.applicationId !== config.applicationId || d.environment !== config.environment || d.projectId !== config.projectId || d.branchId !== config.branchId || d.databaseName !== config.databaseName || d.role !== config.role) fail()
    if(Object.hasOwn(row,'service_descriptor')&&row.service_descriptor!==null){
      const bounded=boundedDatabaseLease(row.service_descriptor,row.descriptor_observed_ms,startedMs,now())
      if(!bounded)fail()
      return {...row,service_descriptor:bounded}
    }
    return row
  }
  const descriptor = async query => (await authority(query)).descriptor
  const verifyScope = async (query, lease) => {
    if (!lease || !leases.has(lease)) fail()
    if (!(Date.parse(lease.expiresAt) > now())) throw new OperationDenied('ACCESS_BASIS_INVALID')
    if (lease.serviceId !== undefined) {
      const row = await authority(query, `,profitia_services.runtime_descriptor() AS service_descriptor,txid_current()::text AS transaction_id,
        profitia_services.scope_allows($1,$2::uuid,$3,$4) AS allowed`,
      [config.applicationId, lease.organisationId, lease.operation, lease.resourceId])
      if (!validateServiceDescriptor(row.service_descriptor)) throw new OperationDenied('ACCESS_BASIS_INVALID')
      if (row.transaction_id !== lease.transactionId) fail()
      if (row.allowed !== true) throw new OperationDenied('ACCESS_BASIS_INVALID')
      return
    }
    const row = await authority(query, `,txid_current()::text AS transaction_id,
      profitia_access.scope_allows($1,$2::uuid,$3::uuid) AS allowed`,
    [config.applicationId, lease.organisationId, lease.userId])
    if (row?.transaction_id !== lease.transactionId) fail()
    if (row.allowed === false) throw new OperationDenied('ACCESS_BASIS_INVALID')
    if (row.allowed !== true) fail()
  }
  const validateServiceDescriptor = d => {
    if (!config.service) fail()
    if (d === null) return null
    if (!d || d.schemaVersion !== '1.0.0' || d.schemaDigest !== config.service.schemaDigest
      || d.profileId !== config.service.profileId || d.deploymentId !== config.service.deploymentId
      || d.configurationVersion !== config.service.configurationVersion || !uuid.test(d.serviceId)
      || !/^database-service:[a-f0-9-]{36}:[1-9][0-9]*$/i.test(d.proofRef ?? '')
      || !text(d.sourceRef) || sensitive(d.sourceRef) || !(Date.parse(d.expiresAt)>now())
      || Date.parse(d.expiresAt)>now()+30000) fail()
    return d
  }
  const serviceDescriptor = async query => validateServiceDescriptor((await authority(query, ',profitia_services.runtime_descriptor() AS service_descriptor')).service_descriptor)
  return Object.freeze({
    contract: ACCESS_STORE_CONTRACT,
    async resolveBinding(query, key) {
      if (config.service !== undefined) fail()
      key = { environment: key?.environment, issuer: key?.issuer, subject: key?.subject }
      if (!key || key.environment !== config.environment || !text(key.issuer) || !text(key.subject)) fail()
      await descriptor(query)
      const row = await one(query, 'SELECT profitia_access.identity_binding($1,$2) AS binding', [key.issuer, key.subject])
      const value = row?.binding
      if (value === null) return null
      if (!value || value.environment !== config.environment || value.issuer !== key.issuer || value.subject !== key.subject || !uuid.test(value.userId) || value.status !== 'ACTIVE' || !text(value.version) || !text(value.sourceRef) || !(Date.parse(value.expiresAt) > now())) fail()
      return freeze(structuredClone(value))
    },
    async lockAccess(query, { actor, identityBinding, organisationId }) {
      if (config.service !== undefined) fail()
      try { ({ actor, identityBinding } = structuredClone({ actor, identityBinding })) }
      catch { fail() }
      if (!actor || actor.kind !== 'HUMAN' || !uuid.test(actor.actorId) || actor.userId !== actor.actorId || actor.environment !== config.environment || actor.audience !== config.applicationId || !(Date.parse(actor.expiresAt) > now()) || !(organisationId === null || uuid.test(organisationId))) fail()
      if (identityBinding === null) throw new OperationDenied('ACCESS_BASIS_INVALID')
      if (!identityBinding || identityBinding.userId !== actor.userId || identityBinding.environment !== config.environment || identityBinding.issuer !== actor.issuer || identityBinding.status !== 'ACTIVE' || !text(identityBinding.subject) || !text(identityBinding.version) || !(Date.parse(identityBinding.expiresAt) > now())) fail()
      await descriptor(query)
      const row = await one(query, 'SELECT profitia_access.lock_access($1::uuid,$2::uuid,$3,$4,$5) AS state', [actor.userId, organisationId, identityBinding.issuer, identityBinding.subject, identityBinding.version])
      const state = row?.state
      if (row && state === null) throw new OperationDenied('ACCESS_BASIS_INVALID')
      if (!state || state.applicationId !== config.applicationId || state.environment !== config.environment || state.identityBindingVersion !== identityBinding.version || state.access?.actorId !== actor.userId || state.access.organisationId !== organisationId || !/^access-v1:[1-9][0-9]*$/.test(state.policyVersion) || !/^[0-9]+$/.test(state.transactionId)) fail()
      const expiry = Math.min(Date.parse(actor.expiresAt), Date.parse(identityBinding.expiresAt), Date.parse(state.access.expiresAt))
      if (!Number.isFinite(expiry) || !(expiry > now())) fail()
      const expiresAt = new Date(expiry).toISOString()
      state.access.expiresAt = expiresAt
      const bound = await one(query, `SELECT
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
    async resolveServiceActor(query) {
      const d = await serviceDescriptor(query)
      if (d === null) return null
      return freeze({ kind:'SERVICE', actorId:d.serviceId, serviceId:d.serviceId,
        proofRef:d.proofRef, issuer:DATABASE_SERVICE_ISSUER, audience:config.applicationId,
        environment:config.environment, expiresAt:d.expiresAt })
    },
    async lockAdmittedReport(query,{actor,request,admission,proof}) {
      if(config.service!==undefined || actor.kind!=='HUMAN')fail()
      await descriptor(query)
      const r=await admission.bindHuman(query,proof,request),state=r.state
      if(state.applicationId!==config.applicationId || state.environment!==config.environment || state.access.actorId!==actor.userId
        || state.access.organisationId!==request.organisationId || !(Date.parse(state.access.expiresAt)>now()))fail()
      const lease=freeze({state:structuredClone(state),userId:actor.userId,organisationId:request.organisationId,
        expiresAt:state.access.expiresAt,transactionId:state.transactionId})
      leases.add(lease);return lease
    },
    async lockServiceRead(query, input) {
      let actor, organisationId, operation, resourceId
      try { ({ actor, organisationId, operation, resourceId } = structuredClone(input)) } catch { fail() }
      if (!config.service || !actor || actor.kind!=='SERVICE' || !uuid.test(actor.actorId)
        || actor.serviceId!==actor.actorId || actor.userId!=null || actor.onBehalfOf!=null
        || actor.issuer!==DATABASE_SERVICE_ISSUER || actor.audience!==config.applicationId
        || actor.environment!==config.environment || !(Date.parse(actor.expiresAt)>now())
        || !uuid.test(organisationId) || !serviceReads.has(operation) || !text(resourceId)) fail()
      const d = await serviceDescriptor(query)
      if (!d || d.serviceId!==actor.actorId || d.proofRef!==actor.proofRef) throw new OperationDenied('ACCESS_BASIS_INVALID')
      const row = await one(query, 'SELECT profitia_services.lock_read($1::uuid,$2,$3,$4) AS state',
        [organisationId,operation,resourceId,actor.proofRef])
      const state = row.state
      if (state===null) throw new OperationDenied('ACCESS_BASIS_INVALID')
      if (!state || state.applicationId!==config.applicationId || state.environment!==config.environment
        || state.serviceBindingVersion!==actor.proofRef || state.access?.actorId!==actor.actorId
        || state.access.organisationId!==organisationId || state.access.type!=='SERVICE_GRANT'
        || !/^access-v1:[1-9][0-9]*$/.test(state.policyVersion) || !/^[0-9]+$/.test(state.transactionId)) fail()
      const expiry = Math.min(Date.parse(actor.expiresAt),Date.parse(d.expiresAt),Date.parse(state.access.expiresAt))
      if (!Number.isFinite(expiry) || !(expiry>now())) fail()
      const expiresAt = new Date(expiry).toISOString(); state.access.expiresAt=expiresAt
      const bound = await one(query, `SELECT
        set_config('profitia.service.environment',$1,true),set_config('profitia.service.application_id',$2,true),
        set_config('profitia.service.service_id',$3,true),set_config('profitia.service.proof_ref',$4,true),
        set_config('profitia.service.organisation_id',$5,true),set_config('profitia.service.operation',$6,true),
        set_config('profitia.service.resource_id',$7,true),set_config('profitia.service.policy_version',$8,true),
        set_config('profitia.service.transaction_id',$9,true),set_config('profitia.service.expires_at',$10,true),
        set_config('profitia.service.schema_digest',$11,true),txid_current()::text AS transaction_id
        WHERE txid_current()::text=$9`,
      [config.environment,config.applicationId,actor.actorId,actor.proofRef,organisationId,operation,resourceId,
        state.policyVersion,state.transactionId,expiresAt,config.service.schemaDigest])
      if (bound.transaction_id!==state.transactionId) fail()
      const lease = freeze({ state:structuredClone(state), userId:null, serviceId:actor.actorId,
        organisationId, operation, resourceId, expiresAt, transactionId:state.transactionId })
      leases.add(lease)
      return lease
    },
    verifyScope,
    async verifyModuleAudit(query, expectedDigest) {
      if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? '')) fail()
      await descriptor(query)
      const row = await one(query, 'SELECT profitia_modules.audit_descriptor() AS descriptor')
      if (!row?.descriptor || row.descriptor.version !== '1.0.0' || row.descriptor.schemaDigest !== expectedDigest) fail()
    },
    async appendAudit(query, event, lease) {
      if (!event || Object.getPrototypeOf(event) !== Object.prototype || Object.entries(event).some(([key,value]) => !eventKeys.has(key) || !validAuditValue(key,value)) || event.applicationId !== config.applicationId || event.environment !== config.environment || !uuid.test(event.decisionId) || !['INTENT', 'OUTCOME', 'DECISION', 'FAILURE'].includes(event.phase) || !['ALLOW', 'DENY'].includes(event.decision) || !/^[A-Z_]{1,64}$/.test(event.reasonCode ?? '')) fail()
      const encoded = JSON.stringify(event)
      if (Buffer.byteLength(encoded) > 16384) fail()
      if (event.moduleEvidence) normalizeModuleEvidence(event.moduleEvidence, { now, allowExpired: event.decision === 'DENY' })
      if (event.phase === 'OUTCOME') {
        if (!lease || event.actorId !== (lease.serviceId ?? lease.userId) || event.organisationId !== lease.organisationId || event.policyVersion !== lease.state.policyVersion) fail()
        if (lease.serviceId !== undefined && (event.actorKind!=='SERVICE' || event.subjectUserId!==null
          || event.operation!==lease.operation || event.resourceId!==lease.resourceId || event.moduleEvidence!==undefined)) fail()
        await verifyScope(query, lease)
      } else await descriptor(query)
      await invoke(query, config.service ? 'SELECT profitia_services.append_audit($1::jsonb)' : 'SELECT profitia_access.append_audit($1::jsonb)', [encoded])
    },
  })
}

export function accessStoreSourceDigest() {
  return import('node:fs').then(fs => createHash('sha256')
    .update(fs.readFileSync(new URL('./access-store.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./access-store.d.mts', import.meta.url)))
    .update(fs.readFileSync(new URL(accessSchemaUrl)))
    .update(fs.readFileSync(new URL(moduleAuditSchemaUrl)))
    .update(fs.readFileSync(new URL(serviceReadSchemaUrl)))
    .update(fs.readFileSync(new URL('./database-lease.mjs',import.meta.url))).digest('hex'))
}
export function accessSchemaDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL(accessSchemaUrl))).digest('hex'))
}
export function moduleAuditSchemaDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL(moduleAuditSchemaUrl))).digest('hex'))
}
export function serviceReadSchemaDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL(serviceReadSchemaUrl)))
    .update(fs.readFileSync(new URL('./database-lease.mjs',import.meta.url))).digest('hex'))
}
