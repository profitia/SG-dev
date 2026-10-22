import { createHash, randomUUID } from 'node:crypto'
import {requestOperationPolicy} from './request-operations.mjs'
import {SUPPLIER_LOCATION_OPERATIONS,normalizeSupplierLocationEvidence,isSupplierLocationAdmission} from './supplier-location.mjs'

export const OPERATION_CONTRACT = Object.freeze({ id: 'profitia.operation-context', version: '1.0.0', implementation: '1.0.0-candidate.16' })
export const SUPPLIER_LOCATION_ROOT_CONTRACT=Object.freeze({...OPERATION_CONTRACT,implementation:'1.0.0-candidate.17'})
const denialBrand = Symbol.for('profitia.operation-context.denial.v1')
const denialCodes = new Set(['UNSUPPORTED_CONTRACT', 'UNVERIFIED_IDENTITY', 'CONTEXT_INVALID', 'ENVIRONMENT_MISMATCH', 'APPLICATION_FEATURE_UNAVAILABLE', 'ACCESS_BASIS_INVALID', 'PERMISSION_DENIED', 'PRODUCT_UNAVAILABLE', 'RESOURCE_SCOPE_MISMATCH', 'DATA_CLASSIFICATION_UNKNOWN', 'DELEGATION_INVALID', 'DELIVERY_UNCERTAIN', 'RESOURCE_VERSION_CONFLICT', 'LIMIT_POLICY_UNAVAILABLE', 'LIMIT_EXCEEDED', 'IDEMPOTENCY_CONFLICT', 'AUDIT_UNAVAILABLE', 'POLICY_UNAVAILABLE', 'EXPLICIT_DENY'])

// Explicit implementation, not an interpreter of the target specification JSON.
// Everything outside this bounded candidate is denied, including billing.
const rule = (feature, resourceType, dataClass, effect, product = null, mode = 'ORGANISATION') => Object.freeze({ feature, resourceType, dataClass, effect, product, mode })
const rules = Object.freeze({
  'account.settings.read': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'READ', null, 'ACCOUNT'),
  'account.settings.write': rule('account', 'account_settings', 'ACCOUNT_PRIVATE', 'WRITE', null, 'ACCOUNT'),
  'knowledge.read': rule('market', 'market_knowledge', 'SHARED_KNOWLEDGE', 'READ', 'SPENDGURU'),
  'benchmark.selection.read': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  'benchmark.selection.write': rule('benchmark', 'benchmark_selection', 'ORGANISATION_PRIVATE', 'WRITE', 'SPENDGURU'),
  'category.read': rule('category', 'category', 'ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  'category.write': rule('category', 'category', 'ORGANISATION_PRIVATE', 'WRITE', 'SPENDGURU'),
  'supplier.assignment.read': rule('supplier_workspace', 'supplier_assignment', 'ORGANISATION_PRIVATE', 'READ'),
  'supplier.assignment.write': rule('supplier_workspace', 'supplier_assignment', 'ORGANISATION_PRIVATE', 'WRITE'),
  'forecast.read': rule('forecast', 'market_forecast', 'SHARED_KNOWLEDGE', 'READ', 'SPENDGURU'),
  // Bounded HUMAN AM20: private request acceptance, never external execution.
  'forecast.request': rule('forecast', 'forecast_request', 'OPERATION_AUDIT', 'REQUEST_COMPUTE', 'SPENDGURU'),
  // AM23 accepts a private intent and explicitly installed PRIVATE_SQL_PHASE
  // continuations of that accepted parent; no remote acquisition is executed.
  'supplier.report.refresh': rule('supplier_report', 'supplier_report_request', 'OPERATION_AUDIT', 'REQUEST_EXTERNAL', 'SUPPLIER_INTELLIGENCE'),
  'supplier.private.refresh': rule('supplier_report', 'supplier_private_request', 'OPERATION_AUDIT', 'REQUEST_EXTERNAL', 'SUPPLIER_INTELLIGENCE'),
  'benchmark.discovery.request': rule('benchmark', 'benchmark_discovery_request', 'OPERATION_AUDIT', 'REQUEST_EXTERNAL', 'SPENDGURU'),
  'supplier.location.read': rule('supplier_report','supplier_location_collection','ORGANISATION_PRIVATE','READ','SUPPLIER_INTELLIGENCE'),
  'supplier.location.write': rule('supplier_report','supplier_location','ORGANISATION_PRIVATE','WRITE','SUPPLIER_INTELLIGENCE'),
  'supplier.location.sync': rule('supplier_report','supplier_location_sync_request','OPERATION_AUDIT','REQUEST_COMPUTE','SUPPLIER_INTELLIGENCE'),
  'supplier.location.geocode': rule('supplier_report','supplier_location_geocode_request','OPERATION_AUDIT','REQUEST_EXTERNAL','SUPPLIER_INTELLIGENCE'),
  'benchmark.discovery.read': rule('benchmark', 'benchmark_discovery_result', 'USER_IN_ORGANISATION_PRIVATE', 'READ', 'SPENDGURU'),
  // AM27 authorises the private dispatch boundary. Publication of shared
  // effects requires its own AM26 source authority and durable receipt.
  'job.execute': rule('job_execution', 'job', 'ORGANISATION_PRIVATE', 'EXECUTE_BOUND_OPERATION'),
  'knowledge.ingest': rule('knowledge_ingestion','shared_knowledge','SHARED_KNOWLEDGE','WRITE',null,'PLATFORM'),
  'personal.list.read': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'READ'),
  'personal.list.write': rule('personal_workspace', 'personal_list', 'USER_IN_ORGANISATION_PRIVATE', 'WRITE'),
  'supplier.report.read': rule('supplier_report', 'supplier_report', 'SHARED_KNOWLEDGE', 'READ', 'SUPPLIER_INTELLIGENCE'),
  'supplier.report.project': rule('supplier_report', 'supplier_projection', 'ORGANISATION_PRIVATE', 'WRITE', 'SUPPLIER_INTELLIGENCE'),
  // Bounded AM24: one organisation report and its explicit shared/private
  // inputs. Personal exports and external acquisition remain unsupported.
  'supplier.report.export': rule('supplier_report', 'supplier_export', 'ORGANISATION_PRIVATE', 'EXPORT', 'SUPPLIER_INTELLIGENCE'),
  // Private personal reports never inherit the shared catalogue read grant.
  'supplier.private.read': rule('supplier_report', 'supplier_private_report', 'ORGANISATION_PRIVATE', 'READ', 'SUPPLIER_INTELLIGENCE'),
  'supplier.private.reveal': rule('supplier_report', 'supplier_private_identifier', 'ORGANISATION_PRIVATE', 'READ', 'SUPPLIER_INTELLIGENCE'),
  'supplier.private.export': rule('supplier_report', 'supplier_private_export', 'ORGANISATION_PRIVATE', 'EXPORT', 'SUPPLIER_INTELLIGENCE'),
})
export const IMPLEMENTED_OPERATIONS = Object.freeze(Object.keys(rules))
const profiles = Object.freeze({
  PLATFORM_INTERNAL: { features: ['job_execution','knowledge_ingestion'], products: [] },
  PORR_SUITE: { features: ['account', 'market', 'benchmark', 'category', 'supplier_workspace', 'forecast', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'], fixed: true },
  SPENDGURU_SAAS: { features: ['account', 'market', 'benchmark', 'category', 'supplier_workspace', 'forecast', 'personal_workspace', 'supplier_report'], products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'] },
  SUPPLIER_INTELLIGENCE_STANDALONE: { features: ['account', 'supplier_workspace', 'personal_workspace', 'supplier_report'], products: ['SUPPLIER_INTELLIGENCE'] },
})

export class OperationDenied extends Error {
  constructor(reasonCode, decisionId = randomUUID()) {
    super('Operation unavailable')
    this.name = 'OperationDenied'
    this.reasonCode = reasonCode
    this.decisionId = decisionId
    Object.defineProperty(this, denialBrand, { value: true })
  }
}
// ESM/CJS, bundlers and an installed file dependency can have distinct class
// identities. Error transport is branded, never authorized from a JSON flag.
export function isOperationDenied(error) {
  return error instanceof Error && error[denialBrand] === true && denialCodes.has(error.reasonCode) && /^[a-f0-9-]{36}$/.test(error.decisionId)
}
const deny = (reason) => { throw new OperationDenied(reason) }
const nonempty = (v) => typeof v === 'string' && v.length > 0 && v.length <= 256
const validUntil = (v, now) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && Date.parse(v) > now
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }

/** Server-owned module provenance, never a permission or a token. Shared by the
 * executor and its single audit adapter; SQL independently enforces the shape. */
export function normalizeModuleEvidence(value, { now = Date.now, allowExpired = false } = {}) {
  const keys = ['moduleId','moduleBindingId','version','sourceRef','expiresAt','transactionId','moduleSchemaDigest','auditSchemaDigest']
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !nonempty(value[key])) || Object.keys(value).some(key => !keys.includes(key))
    || !['benchmark','category','supplier_report'].includes(value.moduleId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.moduleBindingId)
    || !/^[1-9][0-9]*$/.test(value.version) || !/^[0-9]+$/.test(value.transactionId)
    || !['moduleSchemaDigest','auditSchemaDigest'].every(key => /^[a-f0-9]{64}$/.test(value[key]))
    || keys.some(key => /gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(value[key]))
    || !Number.isFinite(Date.parse(value.expiresAt))) deny('POLICY_UNAVAILABLE')
  if (!allowExpired && !validUntil(value.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
  return freeze(structuredClone(value))
}

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  throw new TypeError('Only finite JSON payloads are supported')
}

export function operationPayloadDigest(payload) {
  return createHash('sha256').update(canonical(payload)).digest('hex')
}

function permission(access, operation, feature, resourceId) {
  if (!Array.isArray(access.permissions) || !Array.isArray(access.denies)) return false
  const matches = p => p.operation === operation && p.feature === feature && (p.resourceId === null || p.resourceId === resourceId)
  return !access.denies.some(matches) && access.permissions.some(matches)
}

const privateSupplierOperations = new Set(['supplier.private.read','supplier.private.reveal','supplier.private.export'])
const privateSupplierKeys = ['entityType','nip','retentionUntil','snapshotId']
/** Only technical metadata selected by the native adapter. No personal value,
 * client-selected owner or provider response enters this authority envelope. */
function privateSupplierDescriptor(resource, time) {
  const d = resource?.privateSupplier
  if (!d || Object.getPrototypeOf(d) !== Object.prototype
    || Object.keys(d).sort().join(',') !== privateSupplierKeys.join(',')
    || Reflect.ownKeys(d).length !== privateSupplierKeys.length
    || Object.values(Object.getOwnPropertyDescriptors(d)).some(v => !('value' in v) || !v.enumerable)
    || !['COMPANY','JDG'].includes(d.entityType) || typeof d.nip !== 'string' || !/^[0-9]{10}$/.test(d.nip)
    || typeof d.snapshotId !== 'string' || !computeUuid.test(d.snapshotId) || resource.version !== d.snapshotId || resource.ownerUserId !== null
    || !validUntil(d.retentionUntil, time) || new Date(d.retentionUntil).toISOString() !== d.retentionUntil) deny('RESOURCE_SCOPE_MISMATCH')
  return d
}

function locationEvidence(state,request,context,identity,config,moduleEvidence,time,delegatedSubject=null){
 if(!SUPPLIER_LOCATION_OPERATIONS.includes(request.operation)){
  if(state.resource?.supplierLocation!==undefined)deny('RESOURCE_SCOPE_MISMATCH')
  return null
 }
 if((identity.kind!=='HUMAN'&&!(identity.kind==='SERVICE'&&computeUuid.test(delegatedSubject??'')&&context.subjectUserId===delegatedSubject))||moduleEvidence?.moduleId!=='supplier_report')deny('DELEGATION_INVALID')
 let e;try{e=normalizeSupplierLocationEvidence(state.resource.supplierLocation,{environment:context.environment,organisationId:context.organisationId,now:()=>time})}catch{deny('RESOURCE_SCOPE_MISMATCH')}
 const p=request.payload,keys=['action','supplierId','locationId','addressVersion','expectedVersion','command']
 if(!p||Object.getPrototypeOf(p)!==Object.prototype||Object.keys(p).sort().join(',')!==keys.sort().join(',')
  ||p.supplierId!==e.supplierId||p.locationId!==e.locationId||p.addressVersion!==e.addressVersion
  ||operationPayloadDigest(p.command)!==e.commandDigest||Buffer.byteLength(canonical(p))>16384)deny('RESOURCE_SCOPE_MISMATCH')
 const op=request.operation
 if(op==='supplier.location.read'&&(p.action!=='READ'||e.origin!=='COLLECTION'||e.locationId!==null||p.expectedVersion!==null||p.command!==null||e.executorApplicationId!==null))deny('RESOURCE_SCOPE_MISMATCH')
 if(op==='supplier.location.write'&&(!['CREATE','UPDATE','DEACTIVATE'].includes(p.action)||e.origin!=='MANUAL'||e.locationId!==state.resource.id||e.executorApplicationId!==null
  ||(p.action==='CREATE'?(e.serverAssignedId!==true||p.expectedVersion!==null):(!e.exists||!nonempty(p.expectedVersion)))))deny('RESOURCE_SCOPE_MISMATCH')
 if(op==='supplier.location.sync'&&(p.action!=='SYNC'||e.origin!=='COLLECTION'||e.locationId!==null||!e.sources.length||!nonempty(p.expectedVersion)||e.executorApplicationId!==null))deny('RESOURCE_SCOPE_MISMATCH')
 if(op==='supplier.location.sync'){
  if(!p.command||Object.getPrototypeOf(p.command)!==Object.prototype||Object.keys(p.command).join(',')!=='sources'||!Array.isArray(p.command.sources)
   ||p.command.sources.length!==e.sources.length||p.command.sources.some((s,i)=>!s||Object.getPrototypeOf(s)!==Object.prototype
    ||Object.keys(s).sort().join(',')!=='id,version'||s.id!==e.sources[i].resource.id||s.version!==e.sources[i].resource.version))deny('RESOURCE_SCOPE_MISMATCH')
 }
 if(op==='supplier.location.geocode'&&(p.action!=='GEOCODE'||!e.exists||e.locationId===null||!nonempty(e.addressVersion)||!nonempty(p.expectedVersion)||!nonempty(e.executorApplicationId)
  ||!p.command||Object.keys(p.command).sort().join(',')!=='address,executorApplicationId'||p.command.executorApplicationId!==e.executorApplicationId
  ||typeof p.command.address!=='string'||p.command.address.trim().length<1||p.command.address.length>512))deny('RESOURCE_SCOPE_MISMATCH')
 for(const source of e.sources){
  const operation=source.kind==='MGBI'?'supplier.report.read':'supplier.private.read'
  if(!config.operations.includes(operation)||!permission(state.access,operation,'supplier_report',source.resource.id))deny('PERMISSION_DENIED')
  checkResource(source.resource,{...context,operation},rules[operation])
  if(source.kind==='KYS')privateSupplierDescriptor(source.resource,time)
 }
 return e
}

function checkResource(resource, context, expected) {
  if (resource?.privateSupplier !== undefined && !privateSupplierOperations.has(context.operation)) deny('RESOURCE_SCOPE_MISMATCH')
  if (!resource || resource.environment !== context.environment || resource.type !== expected.resourceType || resource.dataClass !== expected.dataClass || !nonempty(resource.id) || !nonempty(resource.version) || !nonempty(resource.projectionVersion)) deny('RESOURCE_SCOPE_MISMATCH')
  if (resource.dataClass === 'SHARED_KNOWLEDGE') {
    if (resource.ownerOrganisationId !== null || resource.ownerUserId !== null || resource.approvedSharedProjection !== true) deny('RESOURCE_SCOPE_MISMATCH')
  } else if (resource.dataClass === 'ACCOUNT_PRIVATE') {
    if (resource.ownerOrganisationId !== null || resource.ownerUserId !== context.subjectUserId) deny('RESOURCE_SCOPE_MISMATCH')
  } else {
    if (resource.ownerOrganisationId !== context.organisationId) deny('RESOURCE_SCOPE_MISMATCH')
    if (resource.dataClass === 'USER_IN_ORGANISATION_PRIVATE' && resource.ownerUserId !== context.subjectUserId) deny('RESOURCE_SCOPE_MISMATCH')
    if (resource.dataClass === 'ORGANISATION_PRIVATE' && resource.ownerUserId !== null) deny('RESOURCE_SCOPE_MISMATCH')
  }
}

function productAvailable(state, product, feature, config, ceiling, now) {
  if (!ceiling.products.includes(product)) deny('PRODUCT_UNAVAILABLE')
  const grant = state.products?.find(g => g.product === product && g.features?.includes(feature))
  if (!grant || grant.organisationId !== state.access.organisationId || grant.environment !== config.environment || grant.applicationId !== config.appId || grant.status !== 'ACTIVE' || !nonempty(grant.version) || !nonempty(grant.sourceRef) || !['CONTRACT', 'VERIFIED_BILLING', 'EXPLICIT_OFFER'].includes(grant.source) || !validUntil(grant.expiresAt, now)) deny('PRODUCT_UNAVAILABLE')
  return { product, feature, version: grant.version, sourceRef: grant.sourceRef, source: grant.source, expiresAt: grant.expiresAt }
}

const computeUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
function computePolicy(value, context, now) {
  let policy
  try { policy = freeze(structuredClone(value)) } catch { deny('LIMIT_POLICY_UNAVAILABLE') }
  if (!policy || policy.status !== 'AVAILABLE' || !computeUuid.test(policy.policyId ?? '')
    || !/^[1-9][0-9]*$/.test(policy.version ?? '') || !nonempty(policy.sourceRef)
    || policy.applicationId !== context.applicationId || policy.environment !== context.environment
    || policy.organisationId !== context.organisationId || policy.operation !== context.operation
    || policy.transactionId !== context.moduleEvidence?.transactionId
    || !Number.isSafeInteger(policy.capacity) || policy.capacity < 1 || policy.capacity > 1000000
    || !Number.isSafeInteger(policy.used) || policy.used < 0 || policy.used > policy.capacity
    || !(Date.parse(policy.windowStart) <= now) || !validUntil(policy.windowEnd, now)
    || !validUntil(policy.expiresAt, now) || Date.parse(policy.expiresAt) > Date.parse(policy.windowEnd)) deny('LIMIT_POLICY_UNAVAILABLE')
  return policy
}
function computeReservation(value, policy) {
  const keys = ['status','requestId','policyId','policyVersion','transactionId',...(value?.status === 'REPLAY' ? ['value'] : [])]
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).sort().join(',') !== keys.sort().join(',')
    || !['NEW','REPLAY'].includes(value.status) || !computeUuid.test(value.requestId ?? '')
    || value.policyId !== policy.policyId || value.policyVersion !== policy.version || value.transactionId !== policy.transactionId
    || value.status === 'REPLAY' && !computeReceipt(value.value, value.requestId)) deny('LIMIT_POLICY_UNAVAILABLE')
  return freeze(structuredClone(value))
}
function computeReceipt(value, id) {
  return value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join(',') === 'requestId,status'
    && value.requestId === id && value.status === 'ACCEPTED'
}

/** Reuses this engine's permission, resource and product checks for the exact
 * initiating target. A SERVICE remains a SERVICE; the subject is separate.
 * Host SQL supplies current control rows, and holds their revocation fence. */
// Closed target policies for the SAME AM27 interpreter. The store/host also
// selects its explicit target; adding Supplier never widens a Forecast host.

function delegatedJob(state, identity, request, config, time) {
  const d=state.delegation, t=d?.target, a=t?.application, ceiling=profiles[a?.profileId]
  const subject=d?.subjectUserId, observation=d?.externalAccountObservation, key=d?.identityKey
  const target=requestOperationPolicy(t?.operation)
  if (request.operation!=='job.execute' || identity.kind!=='SERVICE' || config.profileId!=='PLATFORM_INTERNAL'
    || !d || !target || !computeUuid.test(d.delegationId??'') || d.jobId!==request.resourceId || d.requestId!==d.jobId
    || !computeUuid.test(d.jobId??'') || !computeUuid.test(subject??'')
    || d.organisationId!==request.organisationId || d.executorApplicationId!==config.appId
    || !nonempty(d.sourceId) || !/^[a-f0-9]{64}$/.test(d.deliveryKey??'') || d.payloadDigest!==request.payloadDigest
    || !d.sourceBinding||Object.keys(d.sourceBinding).sort().join(',')!=='applicationId,branchId,classificationVersion,databaseName,payloadSchema,projectId,qualityVersion,schemaDigest'
    || !Object.values(d.sourceBinding).every(nonempty)||!/^[a-f0-9]{64}$/.test(d.sourceBinding.schemaDigest??'')
    || !computeUuid.test(d.bindingId??'') || !/^[1-9][0-9]*$/.test(d.bindingVersion??'')
    || !['PENDING','READY','CONFIRMED','UNCERTAIN'].includes(d.status)
    || !validUntil(d.expiresAt,time) || Date.parse(d.expiresAt)>time+30000
    || !key || key.environment!==config.environment || !nonempty(key.issuer) || !nonempty(key.subject)
    || !observation || observation.status!=='ACTIVE' || observation.environment!==key.environment
    || observation.issuer!==key.issuer || observation.subject!==key.subject
    || !(Date.parse(observation.observedAt)<=time) || !validUntil(observation.expiresAt,time)
    || Date.parse(observation.expiresAt)>Date.parse(observation.observedAt)+5000
    || !a || !target.profiles.includes(a.profileId) || !ceiling
    || !nonempty(a.appId) || a.appId===config.appId || a.environment!==config.environment
    || !nonempty(a.configurationVersion) || !Array.isArray(a.operations) || !a.operations.includes(t.operation)
    || !Array.isArray(a.features) || !a.features.includes(target.feature) || a.features.some(f=>!ceiling.features.includes(f))
    || (ceiling.fixed ? a.organisationId!==request.organisationId : a.organisationId!==null)
    || !nonempty(t.resourceId) || !nonempty(t.policyVersion)
    || t.policyVersion!==state.policyVersion || t.access?.type!=='MEMBERSHIP' || t.access.actorId!==subject
    || t.access.organisationId!==request.organisationId || t.access.status!=='ACTIVE'
    || !nonempty(t.access.version) || !nonempty(t.access.sourceRef) || !validUntil(t.access.expiresAt,time)
    || t.module?.id!==target.module || !computeUuid.test(t.module.bindingId??'')
    || !nonempty(t.module.version) || !nonempty(t.module.sourceRef) || !validUntil(t.module.expiresAt,time)
    || state.resource.ownerUserId!==null) deny('DELEGATION_INVALID')
  const selected=rules[t.operation]
  if (!permission(t.access,t.operation,selected.feature,t.resourceId)) deny('PERMISSION_DENIED')
  const context={organisationId:request.organisationId,subjectUserId:subject,environment:config.environment}
  checkResource(t.resource,context,selected)
  if(t.resource.id!==t.resourceId || t.resource.ownerUserId!==subject) deny('RESOURCE_SCOPE_MISMATCH')
  const products=productAvailable({access:t.access,products:t.products},selected.product,selected.feature,a,ceiling,time)
  if(target.location)locationEvidence({resource:t.resource,access:t.access},{...request,operation:t.operation,resourceId:t.resourceId},{...context,subjectUserId:subject},identity,a,{moduleId:t.module.id},time,subject)
  return {delegation:freeze(structuredClone(d)),subjectUserId:subject,products}
}

function ingestionPolicy(value,context,request,time){
  let p;try{p=freeze(structuredClone(value))}catch{deny('LIMIT_POLICY_UNAVAILABLE')}
  if(!p||p.effectKind!=='STORED_SQL_TRANSACTION'||!nonempty(p.sourceId)||p.sourceId!==request.payload?.sourceId
    ||!/^[1-9][0-9]*$/.test(p.sourceVersion??'')||!nonempty(p.sourceRef)||!nonempty(p.payloadSchema)||!nonempty(p.qualityVersion)
    ||!nonempty(p.classificationVersion)||!computeUuid.test(p.policyId??'')||!/^[1-9][0-9]*$/.test(p.policyVersion??'')||!nonempty(p.policySourceRef)
    ||p.unit!=='SOURCE_TRANSACTION'||!Number.isSafeInteger(p.capacity)||p.capacity<1||p.capacity>1000000
    ||!Number.isSafeInteger(p.used)||p.used<0||p.used>p.capacity||!(Date.parse(p.windowStart)<=time)
    ||!validUntil(p.windowEnd,time)||!validUntil(p.expiresAt,time)||Date.parse(p.expiresAt)>Date.parse(p.windowEnd)
    ||Date.parse(p.expiresAt)>time+30000||context.organisationId!==null
    ||!request.payload||Object.getPrototypeOf(request.payload)!==Object.prototype
    ||Object.keys(request.payload).sort().join(',')!=='content,sourceId')deny('LIMIT_POLICY_UNAVAILABLE')
  return p
}
function ingestionReceipt(value,id){return value&&Object.getPrototypeOf(value)===Object.prototype
  &&Object.keys(value).sort().join(',')==='effectId,status'&&value.effectId===id&&value.status==='COMMITTED'}
function ingestionReservation(value,policy){
  if(!value||!['NEW','REPLAY'].includes(value.status)||!computeUuid.test(value.effectId??'')
    ||value.policyId!==policy.policyId||value.policyVersion!==policy.policyVersion
    ||value.status==='REPLAY'&&!ingestionReceipt(value.receipt,value.effectId))deny('LIMIT_POLICY_UNAVAILABLE')
  return freeze(structuredClone(value))
}

/** All authority callbacks are server-owned. No context/role/ALLOW from HTTP is accepted. */
export function createOperationExecutor(options) {
  if(options.locationAdmissionSchemaDigest!==undefined&&!/^[a-f0-9]{64}$/.test(options.locationAdmissionSchemaDigest))throw TypeError('Explicit accepted SQL020 digest required')
  const executionContract=options.locationAdmissionSchemaDigest===undefined?OPERATION_CONTRACT:SUPPLIER_LOCATION_ROOT_CONTRACT
  const { authenticate, withTransaction, recordAudit, now = Date.now } = options
  const config = freeze(structuredClone(options.application))
  const ceiling = Object.hasOwn(profiles, config.profileId) ? profiles[config.profileId] : null
  if (!ceiling || !['development', 'staging', 'production'].includes(config.environment) || !['appId', 'deploymentId', 'configurationVersion', 'identityIssuer'].every(k => nonempty(config[k])) || !Array.isArray(config.operations) || config.operations.some(op => !Object.hasOwn(rules, op)) || !Array.isArray(config.features) || config.features.some(f => !ceiling.features.includes(f)) || (ceiling.fixed && !nonempty(config.organisationId)) || (!ceiling.fixed && config.organisationId !== null) || [authenticate, withTransaction, recordAudit, now].some(f => typeof f !== 'function')) throw new TypeError('Explicit supported application and server authority adapters required')
  const stamp = event => ({ ...event, occurredAt: new Date(now()).toISOString() })

  return Object.freeze({
    contract: executionContract,
    async execute(input, action) {
      const decisionId = randomUUID()
      const operationStartedAt = new Date(now()).toISOString()
      let audit = { decisionId, contractId: executionContract.id, contractVersion: executionContract.version, implementationVersion: executionContract.implementation, applicationId: config.appId, applicationProfile: config.profileId, deploymentId: config.deploymentId, configurationVersion: config.configurationVersion, environment: config.environment, operationStartedAt, occurredAt: operationStartedAt, operation: typeof input?.operation === 'string' && input.operation.length < 128 ? input.operation : null, actorId: null, actorKind: null, subjectUserId: null, organisationId: null }
      let intentRecorded = false
      const preparationAudits = []
      try {
        // Snapshot inputs before the first await; never execute a later, mutated payload.
        if (!input || input.contractId !== executionContract.id || input.contractVersion !== executionContract.version) deny('UNSUPPORTED_CONTRACT')
        const selected = Object.hasOwn(rules, input.operation) ? rules[input.operation] : null
        if (!selected || !config.operations.includes(input.operation)) deny('PERMISSION_DENIED')
        if (!config.features.includes(selected.feature)) deny('APPLICATION_FEATURE_UNAVAILABLE')
        if (typeof action !== 'function' || !nonempty(input.resourceId) || !(input.organisationId === null || nonempty(input.organisationId))) deny('CONTEXT_INVALID')
        const payload = freeze(JSON.parse(canonical(input.payload)))
        // Manual WRITE uses the same atomic private request ledger for replay, never external permission.
        const compute = ['REQUEST_COMPUTE','REQUEST_EXTERNAL'].includes(selected.effect)||input.operation==='supplier.location.write'
        const platform=selected.mode==='PLATFORM'
        if (compute||platform ? typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{24,128}$/.test(input.idempotencyKey)
          : input.idempotencyKey != null) deny('CONTEXT_INVALID')
        const request = freeze({ operation: input.operation, resourceId: input.resourceId, organisationId: input.organisationId, payload,
          payloadDigest: operationPayloadDigest(payload), ...(compute||platform ? { idempotencyKey: input.idempotencyKey } : {}) })
        audit = { ...audit, resourceId: request.resourceId, payloadDigest: request.payloadDigest }
        const actor = await authenticate(input.request)
        const time = now()
        if (!actor || !['HUMAN', 'SERVICE'].includes(actor.kind) || !nonempty(actor.actorId) || !nonempty(actor.proofRef) || actor.issuer !== config.identityIssuer || actor.audience !== config.appId || !validUntil(actor.expiresAt, time) || (actor.kind === 'HUMAN' && actor.userId !== actor.actorId) || (actor.kind === 'SERVICE' && (actor.serviceId !== actor.actorId || actor.userId != null))) deny('UNVERIFIED_IDENTITY')
        if (actor.environment !== config.environment) deny('ENVIRONMENT_MISMATCH')
        if (actor.onBehalfOf != null || compute && actor.kind !== 'HUMAN' || platform&&actor.kind!=='SERVICE') deny('DELEGATION_INVALID')
        const identity = freeze({ kind: actor.kind, actorId: actor.actorId, ...(actor.kind === 'HUMAN' ? { userId: actor.userId } : { serviceId: actor.serviceId }), proofRef: actor.proofRef, issuer: actor.issuer, audience: actor.audience, environment: actor.environment, expiresAt: actor.expiresAt })
        audit = { ...audit, actorId: identity.actorId, actorKind: identity.kind, subjectUserId: identity.kind === 'HUMAN' ? identity.userId : null, identityProofRef: identity.proofRef, identityIssuer: identity.issuer, identityAudience: identity.audience }
        return await withTransaction({ actor: identity, request }, async session => {
          const state = session.state
          if (!state || !nonempty(state.policyVersion) || state.environment !== config.environment || state.applicationId !== config.appId || typeof session.recordOutcome !== 'function' || typeof session.projectOutput !== 'function' || (session.describeOutcome !== undefined && typeof session.describeOutcome !== 'function')) deny('POLICY_UNAVAILABLE')
          const access = state.access
          if (!access || access.actorId !== identity.actorId || access.status !== 'ACTIVE' || !nonempty(access.version) || !nonempty(access.sourceRef) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
          const delegated=request.operation==='job.execute' ? delegatedJob(state,identity,request,config,now()) : null
          if (access.type === 'DELEGATED_USER' && !delegated) deny('DELEGATION_INVALID')
          const organisationId = request.organisationId
          if(platform){
            if(identity.kind!=='SERVICE'||config.profileId!=='PLATFORM_INTERNAL'||organisationId!==null
              ||access.organisationId!==null||access.type!=='SERVICE_GRANT')deny('CONTEXT_INVALID')
          } else if (selected.mode === 'ACCOUNT') {
            if (identity.kind !== 'HUMAN' || access.type !== 'ACCOUNT_SELF' || organisationId !== null || access.organisationId !== null) deny('CONTEXT_INVALID')
          } else {
            if (!nonempty(organisationId) || organisationId !== access.organisationId || (ceiling.fixed && organisationId !== config.organisationId)) deny('CONTEXT_INVALID')
            if (access.type !== (delegated ? 'DELEGATED_USER' : identity.kind === 'HUMAN' ? 'MEMBERSHIP' : 'SERVICE_GRANT')) deny('ACCESS_BASIS_INVALID')
          }
          const moduleEvidence = session.moduleEvidence === undefined ? undefined : normalizeModuleEvidence(session.moduleEvidence, { now })
          if (moduleEvidence && selected.mode !== 'ORGANISATION') deny('CONTEXT_INVALID')
          if (compute && moduleEvidence?.moduleId !== requestOperationPolicy(request.operation)?.module) deny('APPLICATION_FEATURE_UNAVAILABLE')
          let context = { ...audit, ...(delegated ? {subjectUserId:delegated.subjectUserId} : {}), organisationId, mode: selected.mode, policyVersion: state.policyVersion, accessBasisType: access.type, accessVersion: access.version, accessSourceRef: access.sourceRef, feature: selected.feature, effect: selected.effect, resourceId: request.resourceId, ...(moduleEvidence ? { moduleEvidence } : {}) }
          const platformPolicy=platform?ingestionPolicy(state.ingestion,context,request,now()):null
          if(platformPolicy)context={...context,sourceId:platformPolicy.sourceId,sourceVersion:platformPolicy.sourceVersion,
            qualityVersion:platformPolicy.qualityVersion,classificationVersion:platformPolicy.classificationVersion,payloadSchema:platformPolicy.payloadSchema,
            budgetPolicyId:platformPolicy.policyId,budgetPolicyVersion:platformPolicy.policyVersion,budgetUnit:platformPolicy.unit}
          audit = { ...context }
          const admission=state.requestPolicy?.locationAdmission
          if(admission!==undefined){
            if(options.locationAdmissionSchemaDigest!==admission.schemaDigest||!isSupplierLocationAdmission(admission)
              ||admission.organisationId!==organisationId||admission.userId!==identity.actorId||admission.resourceId!==request.resourceId
              ||admission.payloadDigest!==request.payloadDigest||admission.operation!==request.operation||admission.action!==payload.action
              ||admission.transactionId!==moduleEvidence?.transactionId)deny('RESOURCE_SCOPE_MISMATCH')
          }
          if(admission?.action==='CREATE'){
            if(!access.permissions?.some(p=>p.operation===request.operation&&p.feature===selected.feature&&p.resourceId===admission.parent.collectionId)
              ||access.denies?.some(p=>p.operation===request.operation&&p.feature===selected.feature&&(p.resourceId===null||[request.resourceId,admission.parent.collectionId].includes(p.resourceId))))deny('PERMISSION_DENIED')
          }else if (!permission(access, request.operation, selected.feature, request.resourceId)) deny('PERMISSION_DENIED')
          checkResource(state.resource, context, selected)
          if (state.resource.id !== request.resourceId || compute && request.operation!=='supplier.location.write' && state.resource.ownerUserId !== identity.userId) deny('RESOURCE_SCOPE_MISMATCH')
          if(request.operation==='benchmark.discovery.read'&&(identity.kind!=='HUMAN'||moduleEvidence?.moduleId!=='benchmark'))deny('APPLICATION_FEATURE_UNAVAILABLE')
          const location=locationEvidence(state,request,context,identity,config,moduleEvidence,now())
          let privateSupplierInput
          if (privateSupplierOperations.has(request.operation)) {
            if (identity.kind !== 'HUMAN') deny('DELEGATION_INVALID')
            if (moduleEvidence?.moduleId !== 'supplier_report') deny('APPLICATION_FEATURE_UNAVAILABLE')
            const descriptor = privateSupplierDescriptor(state.resource, now())
            if (request.operation !== 'supplier.private.read') {
              if (!config.operations.includes('supplier.private.read') || !Array.isArray(state.inputs) || state.inputs.length !== 1) deny('PERMISSION_DENIED')
              const report = state.inputs[0]
              checkResource(report, context, rules['supplier.private.read'])
              const inputDescriptor = privateSupplierDescriptor(report, now())
              if (privateSupplierKeys.some(key => descriptor[key] !== inputDescriptor[key])) deny('RESOURCE_SCOPE_MISMATCH')
              if (!permission(access, 'supplier.private.read', 'supplier_report', report.id)) deny('PERMISSION_DENIED')
              privateSupplierInput = freeze(structuredClone(report))
            }
          }
          const productEvidence = []
          if(delegated) productEvidence.push(delegated.products)
          if (selected.product) productEvidence.push(productAvailable(state, selected.product, selected.feature, config, ceiling, now()))
          if (selected.feature === 'supplier_workspace') {
            // An explicit offer must grant this feature in an eligible product;
            // neither a role name nor merely owning another feature is enough.
            const eligible = ['SPENDGURU','SUPPLIER_INTELLIGENCE'].find(product => ceiling.products.includes(product) && state.products?.some(grant => grant.product === product && grant.features?.includes(selected.feature) && grant.organisationId === organisationId && grant.applicationId === config.appId && grant.environment === config.environment && grant.status === 'ACTIVE' && ['CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER'].includes(grant.source) && validUntil(grant.expiresAt, now()) && nonempty(grant.version) && nonempty(grant.sourceRef)))
            if (!eligible) deny('PRODUCT_UNAVAILABLE')
            productEvidence.push(productAvailable(state, eligible, selected.feature, config, ceiling, now()))
          }
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') {
            if (identity.kind !== 'HUMAN') deny('DELEGATION_INVALID')
            const requirements = state.resource.contentRequirements
            if (!Array.isArray(requirements) || !requirements.length) deny('PRODUCT_UNAVAILABLE')
            for (const requirement of requirements) {
              if (!ceiling.features.includes(requirement.feature) || !config.features.includes(requirement.feature)) deny('APPLICATION_FEATURE_UNAVAILABLE')
              productEvidence.push(productAvailable(state, requirement.product, requirement.feature, config, ceiling, now()))
            }
          }
          if (request.operation === 'supplier.report.project') {
            if (!config.operations.includes('supplier.report.read') || !permission(access, 'supplier.report.read', 'supplier_report', request.resourceId) || !Array.isArray(state.inputs) || state.inputs.length === 0) deny('PERMISSION_DENIED')
            for (const resource of state.inputs) checkResource(resource, context, { resourceType: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE' })
          }
          let preparationResource
          if (request.operation === 'supplier.report.export') {
            // Export never grants preparation or source access. The current
            // projection capability is required for the private source and for
            // its separately audited SQL restoration. This bounded candidate
            // does not infer personal, account or arbitrary input permissions.
            for (const operation of ['supplier.report.read', 'supplier.report.project']) {
              if (!config.operations.includes(operation) || !permission(access, operation, 'supplier_report', request.resourceId)) deny('PERMISSION_DENIED')
            }
            if (!Array.isArray(state.inputs) || state.inputs.length !== 2) deny('RESOURCE_SCOPE_MISMATCH')
            const shared = state.inputs.filter(resource => resource?.type === 'supplier_report')
            const privateInputs = state.inputs.filter(resource => resource?.type === 'supplier_projection')
            if (shared.length !== 1 || privateInputs.length !== 1 || state.inputs.some(resource => resource?.id !== request.resourceId)) deny('RESOURCE_SCOPE_MISMATCH')
            checkResource(shared[0], context, rules['supplier.report.read'])
            checkResource(privateInputs[0], context, rules['supplier.report.project'])
            if (typeof session.prepareInputs !== 'function') deny('POLICY_UNAVAILABLE')
            preparationResource = privateInputs[0]
          }
          // Ordinary reads/writes explicitly have NOT_APPLICABLE usage policy.
          // Export preparation is scoped private SQL, not paid refresh, global
          // ingestion or private request admission with an omitted limit.
          const requestPolicy = compute ? computePolicy(state.requestPolicy, context, now()) : null
          if (platform?state.usagePolicy!=='PLATFORM_BUDGET'||typeof session.reserveIngestion!=='function'||typeof session.completeIngestion!=='function': compute ? state.usagePolicy !== 'PRODUCT_POLICY' || typeof session.reserveUsage !== 'function' || typeof session.completeRequest !== 'function'
            : state.usagePolicy !== 'NOT_APPLICABLE') deny('LIMIT_POLICY_UNAVAILABLE')
          if (session.transactionalEffects !== true || session.outputBoundaryVersion !== state.resource.projectionVersion) deny('POLICY_UNAVAILABLE')
          const continuation=state.requestContinuation
          const delegatedPhase=delegated!==null&&continuation!==undefined
          if(continuation!==undefined && (!(compute&&request.operation==='supplier.report.refresh'||delegatedPhase&&delegated.delegation.target.operation==='supplier.report.refresh')
            ||!continuation||Object.getPrototypeOf(continuation)!==Object.prototype
            ||Object.keys(continuation).sort().join(',')!==(delegatedPhase?'delegatedSchemaDigest,inputDigest,phaseId,policyVersion,requestId,schemaDigest,transactionId':'inputDigest,phaseId,policyVersion,requestId,schemaDigest,transactionId')
            ||!computeUuid.test(continuation.requestId??'')||!/^[A-Z][A-Z0-9_]{0,63}$/.test(continuation.phaseId??'')
            ||!['inputDigest','schemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(continuation[k]??''))
            ||!/^[1-9][0-9]*$/.test(continuation.policyVersion??'')
            ||continuation.transactionId!==(delegatedPhase?state.transactionId:moduleEvidence?.transactionId)
            ||delegatedPhase&&(!/^[a-f0-9]{64}$/.test(continuation.delegatedSchemaDigest??'')||continuation.requestId!==request.resourceId
              ||!['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'].includes(continuation.phaseId)
              ||typeof session.reservePrivatePhase!=='function'||typeof session.completePrivatePhase!=='function')))deny('POLICY_UNAVAILABLE')
          const inspection=state.requestInspection
          const inspecting=delegated!==null&&inspection!==undefined
          if(inspection!==undefined&&(!inspecting||continuation!==undefined||delegated.delegation.target.operation!=='supplier.report.refresh'
            ||!inspection||Object.getPrototypeOf(inspection)!==Object.prototype
            ||Object.keys(inspection).sort().join(',')!=='acceptedTransactionId,continuationSchemaDigest,delegatedSchemaDigest,inputDigest,phaseId,policyVersion,requestId,schemaDigest,transactionId'
            ||inspection.requestId!==request.resourceId||!['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'].includes(inspection.phaseId)
            ||!['inputDigest','schemaDigest','continuationSchemaDigest','delegatedSchemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(inspection[k]??''))
            ||!['policyVersion','transactionId','acceptedTransactionId'].every(k=>/^[1-9][0-9]*$/.test(inspection[k]??''))
            ||inspection.transactionId!==state.transactionId||inspection.transactionId===inspection.acceptedTransactionId
            ||typeof session.recordInspectionIntent!=='function'||typeof session.bindInspection!=='function'||typeof session.verifyInspection!=='function'))deny('POLICY_UNAVAILABLE')
          const work=state.requestWork
          const working=delegated!==null&&work!==undefined
          if(work!==undefined&&(!working||continuation!==undefined||inspection!==undefined||!requestOperationPolicy(delegated.delegation.target.operation)?.nativeWork
            ||!work||Object.getPrototypeOf(work)!==Object.prototype||Reflect.ownKeys(work).length!==9
            ||Object.values(Object.getOwnPropertyDescriptors(work)).some(d=>!('value'in d)||!d.enumerable)
            ||Object.keys(work).sort().join(',')!=='accessMode,inputDigest,policyExpiresAt,policySourceRef,policyVersion,requestId,schemaDigest,transactionId,unitId'
            ||typeof work.policySourceRef!=='string'||work.policySourceRef.length<1||work.policySourceRef.length>256||!(Date.parse(work.policyExpiresAt)>now())
            ||work.requestId!==request.resourceId||!/^[A-Z][A-Z0-9_]{1,63}$/.test(work.unitId??'')||!['READ','WRITE'].includes(work.accessMode)
            ||!['inputDigest','schemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(work[k]??''))
            ||!['policyVersion','transactionId'].every(k=>/^[1-9][0-9]*$/.test(work[k]??''))||work.transactionId!==state.transactionId
            ||typeof session.recordWorkIntent!=='function'||typeof session.bindWork!=='function'||typeof session.verifyWork!=='function'))deny('POLICY_UNAVAILABLE')
          let bound = freeze({ ...context, actor: identity, resource: structuredClone(state.resource), productEvidence, usagePolicy: state.usagePolicy, payload, payloadDigest: request.payloadDigest, correlationId: randomUUID(), ...(delegated ? {delegation:delegated.delegation} : {}),...(delegatedPhase?{requestContinuation:structuredClone(continuation)}:{}),...(inspecting?{requestInspection:structuredClone(inspection)}:{}),...(working?{requestWork:structuredClone(work)}:{}) })
          audit = { ...audit, ...(delegatedPhase?{requestContinuation:structuredClone(continuation)}:{}),...(inspecting?{requestInspection:structuredClone(inspection)}:{}),...(working?{requestWork:structuredClone(work)}:{}), correlationId: bound.correlationId, resourceType: bound.resource.type, dataClass: bound.resource.dataClass, ownerOrganisationId: bound.resource.ownerOrganisationId, ownerUserId: bound.resource.ownerUserId, resourceVersion: bound.resource.version, projectionVersion: bound.resource.projectionVersion, productEvidence, usagePolicy: state.usagePolicy }
          // Work and inspection bind their actual transaction scope to a physical
          // INTENT. Its deferred audit constraint verifies OUTCOME at COMMIT.
          // Other operations retain the independent durable INTENT boundary.
          try { await (working ? session.recordWorkIntent : inspecting ? session.recordInspectionIntent : recordAudit)(stamp({ ...audit, phase: 'INTENT', decision: 'ALLOW', reasonCode: 'AUTHORIZED' })) }
          catch (error) {
            if (isOperationDenied(error) && error.reasonCode === 'ACCESS_BASIS_INVALID') throw error
            deny('AUDIT_UNAVAILABLE')
          }
          intentRecorded = true
          if (preparationResource) {
            const preparationContext = freeze({ ...bound, decisionId: randomUUID(), operation: 'supplier.report.project', effect: 'WRITE', resource: structuredClone(preparationResource) })
            const preparationAudit = { ...audit, decisionId: preparationContext.decisionId, operation: preparationContext.operation,
              effect: 'WRITE', resourceType: preparationResource.type, dataClass: preparationResource.dataClass,
              ownerOrganisationId: preparationResource.ownerOrganisationId, ownerUserId: preparationResource.ownerUserId,
              resourceVersion: preparationResource.version, projectionVersion: preparationResource.projectionVersion }
            try { await recordAudit(stamp({ ...preparationAudit, phase: 'INTENT', decision: 'ALLOW', reasonCode: 'AUTHORIZED' })) }
            catch (error) {
              if (isOperationDenied(error) && error.reasonCode === 'ACCESS_BASIS_INVALID') throw error
              deny('AUDIT_UNAVAILABLE')
            }
            preparationAudits.push(preparationAudit)
            await session.prepareInputs(preparationContext)
            if (!validUntil(identity.expiresAt, now()) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
            productAvailable(state, selected.product, selected.feature, config, ceiling, now())
            if (moduleEvidence) normalizeModuleEvidence(moduleEvidence, { now })
            try { await session.recordOutcome(stamp({ ...preparationAudit, phase: 'OUTCOME', decision: 'ALLOW', reasonCode: 'SUCCEEDED' })) }
            catch (error) {
              if (isOperationDenied(error) && ['ACCESS_BASIS_INVALID','PRODUCT_UNAVAILABLE','APPLICATION_FEATURE_UNAVAILABLE'].includes(error.reasonCode)) throw error
              deny('AUDIT_UNAVAILABLE')
            }
          }
          let reservation
          let sourceReservation
          let privateReservation
          if(delegatedPhase){
            privateReservation=await session.reservePrivatePhase(bound)
            if(!privateReservation||!['NEW','REPLAY'].includes(privateReservation.status)||privateReservation.requestId!==request.resourceId
              ||privateReservation.transactionId!==continuation.transactionId||privateReservation.status==='REPLAY'&&!computeReceipt(privateReservation.value,request.resourceId))deny('POLICY_UNAVAILABLE')
          }
          if(inspecting)await session.bindInspection(bound)
          if(working)await session.bindWork(bound)
          if(delegated&&!delegatedPhase&&!inspecting&&!working){
            if(typeof session.admitDispatch!=='function')deny('POLICY_UNAVAILABLE')
            const admission=await session.admitDispatch(bound)
            if(!admission||admission.jobId!==request.resourceId||!['READY','BUSY','CONFIRMED','RECONCILE_REQUIRED'].includes(admission.status))deny('POLICY_UNAVAILABLE')
            bound=freeze({...bound,dispatchAdmission:structuredClone(admission)})
          }
          if (compute) {
            reservation = computeReservation(await session.reserveUsage(bound), requestPolicy)
            if(continuation!==undefined&&continuation.requestId!==reservation.requestId)deny('RESOURCE_SCOPE_MISMATCH')
            bound = freeze({ ...bound, ...(continuation===undefined?{}:{requestContinuation:structuredClone(continuation)}), requestReservation: { requestId: reservation.requestId,
              replay: reservation.status === 'REPLAY', policyId: requestPolicy.policyId, policyVersion: requestPolicy.version } })
          }
          if(platform){
            sourceReservation=ingestionReservation(await session.reserveIngestion(bound),platformPolicy)
            bound=freeze({...bound,platformReservation:{effectId:sourceReservation.effectId,replay:sourceReservation.status==='REPLAY',
              policyId:sourceReservation.policyId,policyVersion:sourceReservation.policyVersion}})
          }
          if(location&&reservation?.status==='NEW'){
            if(request.operation==='supplier.location.write'&&payload.action==='CREATE'?location.exists:payload.expectedVersion!==location.targetVersion)deny('RESOURCE_VERSION_CONFLICT')
          }
          const value = privateReservation?.status==='REPLAY'?privateReservation.value:reservation?.status === 'REPLAY' ? reservation.value : sourceReservation?.status==='REPLAY'?sourceReservation.receipt:await action(bound, session.transaction)
          if(working){if(!computeReceipt(value,request.resourceId))deny('POLICY_UNAVAILABLE');await session.verifyWork(bound)}
          if(inspecting){if(!computeReceipt(value,request.resourceId))deny('POLICY_UNAVAILABLE');await session.verifyInspection(bound)}
          if(delegatedPhase){
            if(!computeReceipt(value,request.resourceId))deny('POLICY_UNAVAILABLE')
            if(privateReservation.status==='NEW')await session.completePrivatePhase(bound,value)
          }
          if(platform){
            if(!ingestionReceipt(value,sourceReservation.effectId))deny('POLICY_UNAVAILABLE')
            if(sourceReservation.status==='NEW')await session.completeIngestion(bound,value)
            ingestionPolicy(platformPolicy,context,request,now())
          }
          if (compute) {
            if (!computeReceipt(value, reservation.requestId)) deny('POLICY_UNAVAILABLE')
            if (reservation.status === 'NEW') await session.completeRequest(bound, value)
            computePolicy(requestPolicy, context, now())
          }
          const output = await session.projectOutput(value, bound)
          if (privateSupplierOperations.has(request.operation)) {
            privateSupplierDescriptor(bound.resource, now())
            if (privateSupplierInput) privateSupplierDescriptor(privateSupplierInput, now())
          }
          if(location)locationEvidence(state,request,context,identity,config,moduleEvidence,now())
          const outcome = session.describeOutcome === undefined ? 'SUCCEEDED' : await session.describeOutcome(output, bound)
          if (!['SUCCEEDED', 'NO_DATA', 'SELECTION_UNAVAILABLE'].includes(outcome)) deny('POLICY_UNAVAILABLE')
          if (!validUntil(identity.expiresAt, now()) || !validUntil(access.expiresAt, now())) deny('ACCESS_BASIS_INVALID')
          if (selected.product) productAvailable(state, selected.product, selected.feature, config, ceiling, now())
          if (selected.feature === 'supplier_workspace') productAvailable(state, productEvidence[0].product, selected.feature, config, ceiling, now())
          if (selected.dataClass === 'USER_IN_ORGANISATION_PRIVATE') for (const requirement of state.resource.contentRequirements) productAvailable(state, requirement.product, requirement.feature, config, ceiling, now())
          if (moduleEvidence) normalizeModuleEvidence(moduleEvidence, { now })
          if (compute) computePolicy(requestPolicy, context, now())
          if (delegated) delegatedJob(state,identity,request,config,now())
          if(platform)ingestionPolicy(platformPolicy,context,request,now())
          try { await session.recordOutcome(stamp({ ...audit, phase: 'OUTCOME', decision: 'ALLOW', reasonCode: outcome })) }
          catch (error) {
            // A current scope denial is different from an unavailable writer.
            // Both roll back the effect; only the latter is a technical failure.
            if (isOperationDenied(error) && ['ACCESS_BASIS_INVALID','PRODUCT_UNAVAILABLE','APPLICATION_FEATURE_UNAVAILABLE'].includes(error.reasonCode)) throw error
            deny('AUDIT_UNAVAILABLE')
          }
          return Object.freeze({ decision: 'ALLOW', decisionId, contractId: executionContract.id, contractVersion: executionContract.version, value: output })
        })
      } catch (error) {
        const rejected = isOperationDenied(error) ? error : new OperationDenied('POLICY_UNAVAILABLE', decisionId)
        rejected.decisionId = decisionId
        let preparationAuditFailed = false
        for (const preparation of preparationAudits) {
          try { await recordAudit(stamp({ ...preparation, phase: 'FAILURE', decision: 'DENY', reasonCode: rejected.reasonCode })) }
          catch { preparationAuditFailed = true }
        }
        try { await recordAudit(stamp({ ...audit, phase: intentRecorded ? 'FAILURE' : 'DECISION', decision: 'DENY', reasonCode: rejected.reasonCode })) }
        catch { throw new OperationDenied('AUDIT_UNAVAILABLE', decisionId) }
        if (preparationAuditFailed) throw new OperationDenied('AUDIT_UNAVAILABLE', decisionId)
        throw rejected
      }
    },
  })
}

export function operationSourceDigest() {
  // Kept outside the decision path: consumers bind the implementation and types.
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL('./operation-context.mjs', import.meta.url))).update(fs.readFileSync(new URL('./operation-context.d.mts', import.meta.url))).update(fs.readFileSync(new URL('./request-operations.mjs',import.meta.url))).update(fs.readFileSync(new URL('./request-operations.d.mts',import.meta.url))).update(fs.readFileSync(new URL('../migrations/access/017-additional-request-operations.sql',import.meta.url))).update(fs.readFileSync(new URL('./supplier-location.mjs',import.meta.url))).update(fs.readFileSync(new URL('./supplier-location.d.mts',import.meta.url))).update(fs.readFileSync(new URL('../migrations/access/019-supplier-location-operations.sql',import.meta.url))).digest('hex'))
}
