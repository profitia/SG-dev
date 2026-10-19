import {requestOperationsSourceDigest} from './request-operations.mjs'
import { createHash } from 'node:crypto'
import { OperationDenied } from './operation-context.mjs'
import {requestOperationPolicy} from './request-operations.mjs'

export const REQUEST_LEDGER_CONTRACT = Object.freeze({ id:'profitia.request-ledger', version:'1.0.0', schemaVersion:'1.0.0' })
export const requestReservationSchemaUrl = new URL('../migrations/access/006-request-reservation.sql',import.meta.url).href
export const externalRequestSchemaUrl = new URL('../migrations/access/010-external-request-admission.sql',import.meta.url).href
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const digest=/^[a-f0-9]{64}$/,integer=/^[1-9][0-9]*$/
const text=value=>typeof value==='string'&&value.length>0&&value.length<=256
const record=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
const deny=(reason='POLICY_UNAVAILABLE')=>{throw new OperationDenied(reason)}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const reasons=new Set(['PERMISSION_DENIED','LIMIT_POLICY_UNAVAILABLE','LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT'])
function denied(value){
  if(record(value)&&value.status==='DENIED'){
    if(!exact(value,['status','reasonCode'])||!reasons.has(value.reasonCode))deny()
    deny(value.reasonCode)
  }
}
export function validRequestIdempotencyKey(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{24,128}$/.test(value)}
function receipt(value,id){return exact(value,['requestId','status'])&&value.requestId===id&&value.status==='ACCEPTED'}

/** No connection, new access policy, command payload, compute or queue. This
 * adapter uses the existing host's current scoped SQL transaction only. */
export function createRequestLedger({binding,schemaDigest,operation='forecast.request',externalSchemaDigest,operationSchemaDigest,now=Date.now}){
  const target=requestOperationPolicy(operation),external=target?.external
  if(!target||(target.additional?!digest.test(operationSchemaDigest??''):operationSchemaDigest!==undefined)||(external?!digest.test(externalSchemaDigest??''):externalSchemaDigest!==undefined))throw new TypeError('Explicit accepted request operation/schema extension required')
  const config=freeze(structuredClone(binding))
  if(!config||config.service!==undefined||!digest.test(schemaDigest??'')||typeof now!=='function'
    ||!['applicationId','projectId','branchId','databaseName','role'].every(k=>text(config[k]))
    ||!['development','staging','production'].includes(config.environment))throw new TypeError('Explicit private request ledger binding required')
  const policies=new WeakMap(),reservations=new WeakMap()
  const one=async(query,sql,values=[])=>{
    if(typeof query!=='function')deny()
    const result=await query(sql,values)
    if(!result||!Array.isArray(result.rows)||result.rows.length!==1)deny()
    return result.rows[0]
  }
  async function descriptor(query){
    const d=(await one(query,target.additional?'SELECT profitia_requests.operation_runtime_descriptor() AS descriptor':external?'SELECT profitia_requests.external_runtime_descriptor() AS descriptor':'SELECT profitia_requests.runtime_descriptor() AS descriptor')).descriptor
    if(!d||d.schemaVersion!==REQUEST_LEDGER_CONTRACT.schemaVersion||d.schemaDigest!==schemaDigest||!text(d.sourceRef)
      ||external&&(d.externalSchemaVersion!=='1.0.0'||d.externalSchemaDigest!==externalSchemaDigest)
      ||target.additional&&(d.operationSchemaVersion!=='1.0.0'||d.operationSchemaDigest!==operationSchemaDigest)
      ||d.owner!=='profitia_access_owner'||['applicationId','environment','projectId','branchId','databaseName','role'].some(k=>d[k]!==config[k]))deny()
  }
  function scope(actor,request){
    if(!actor||actor.kind!=='HUMAN'||!uuid.test(actor.actorId??'')||actor.userId!==actor.actorId
      ||actor.environment!==config.environment||actor.audience!==config.applicationId
      ||!(Date.parse(actor.expiresAt)>now())||!request||request.operation!==operation
      ||!uuid.test(request.organisationId??'')||!text(request.resourceId)||!digest.test(request.payloadDigest??'')
      ||!validRequestIdempotencyKey(request.idempotencyKey))deny('CONTEXT_INVALID')
    const keyDigest=hash(['profitia.request-key@1',config.applicationId,config.environment,actor.actorId,request.operation,request.idempotencyKey])
    const bindingFingerprint=hash(['profitia.request-binding@1',config.applicationId,config.environment,request.organisationId,
      actor.actorId,request.operation,request.resourceId,request.payloadDigest,request.idempotencyKey])
    return freeze({actorId:actor.actorId,organisationId:request.organisationId,resourceId:request.resourceId,
      payloadDigest:request.payloadDigest,keyDigest,bindingFingerprint})
  }
  function current(policy,query,context){
    const owned=policies.get(policy)
    if(!owned||owned.query!==query||!context||context.operation!==operation||context.actorKind!=='HUMAN'
      ||context.applicationId!==config.applicationId||context.environment!==config.environment
      ||context.actorId!==owned.scope.actorId||context.subjectUserId!==owned.scope.actorId
      ||context.organisationId!==owned.scope.organisationId||context.resourceId!==owned.scope.resourceId
      ||context.payloadDigest!==owned.scope.payloadDigest||!uuid.test(context.decisionId??'')
      ||context.moduleEvidence?.moduleId!==target.module||context.moduleEvidence.transactionId!==policy.transactionId
      ||!(Date.parse(policy.expiresAt)>now())||!(Date.parse(policy.windowEnd)>now()))deny('LIMIT_POLICY_UNAVAILABLE')
    return owned.scope
  }
  return Object.freeze({
    contract:REQUEST_LEDGER_CONTRACT,
    async loadPolicy(query,{actor,request}){
      const selected=scope(actor,request);await descriptor(query)
      const value=(await one(query,external?'SELECT profitia_requests.policy($1,$2::uuid,$3::uuid,$4) AS policy':'SELECT profitia_requests.policy($1::uuid,$2::uuid,$3) AS policy',
        [...(external?[operation]:[]),selected.organisationId,selected.actorId,selected.resourceId])).policy
      denied(value)
      if(!exact(value,['status','policyId','version','sourceRef','expiresAt','windowStart','windowEnd','capacity','used',
        'applicationId','environment','organisationId','operation','transactionId'])||value.status!=='AVAILABLE'
        ||!uuid.test(value.policyId??'')||!integer.test(value.version??'')||!text(value.sourceRef)
        ||!integer.test(value.transactionId??'')||value.applicationId!==config.applicationId||value.environment!==config.environment
        ||value.organisationId!==selected.organisationId||value.operation!==operation
        ||!Number.isSafeInteger(value.capacity)||value.capacity<1||value.capacity>1000000
        ||!Number.isSafeInteger(value.used)||value.used<0||value.used>value.capacity
        ||!(Date.parse(value.windowStart)<=now())||!(Date.parse(value.windowEnd)>now())
        ||!(Date.parse(value.expiresAt)>now())||Date.parse(value.expiresAt)>Date.parse(value.windowEnd))deny('LIMIT_POLICY_UNAVAILABLE')
      const policy=freeze(structuredClone(value));policies.set(policy,{query,scope:selected});return policy
    },
    async reserve(query,policy,context){
      const selected=current(policy,query,context);await descriptor(query)
      const value=(await one(query,external?'SELECT profitia_requests.reserve($1,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::uuid,$9::uuid,$10::bigint) AS reservation':'SELECT profitia_requests.reserve($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid,$8::uuid,$9::bigint) AS reservation',
        [...(external?[operation]:[]),selected.organisationId,selected.actorId,selected.resourceId,selected.payloadDigest,selected.keyDigest,
          selected.bindingFingerprint,context.decisionId,policy.policyId,policy.version])).reservation
      denied(value)
      const keys=['status','requestId','policyId','policyVersion','transactionId',...(value?.status==='REPLAY'?['value']:[])]
      if(!exact(value,keys)||!['NEW','REPLAY'].includes(value.status)||!uuid.test(value.requestId??'')
        ||value.policyId!==policy.policyId||value.policyVersion!==policy.version||value.transactionId!==policy.transactionId
        ||value.status==='REPLAY'&&!receipt(value.value,value.requestId))deny()
      const reservation=freeze(structuredClone(value));reservations.set(reservation,{query,policy,decisionId:context.decisionId,used:false});return reservation
    },
    async complete(query,policy,reservation,context,value){
      current(policy,query,context)
      const owned=reservations.get(reservation)
      if(!owned||owned.used||owned.query!==query||owned.policy!==policy||owned.decisionId!==context.decisionId
        ||reservation.status!=='NEW'||!receipt(value,reservation.requestId))deny()
      owned.used=true;await descriptor(query)
      const accepted=(await one(query,external?'SELECT profitia_requests.accept($1,$2::uuid,$3::uuid) AS receipt':'SELECT profitia_requests.accept($1::uuid,$2::uuid) AS receipt',
        [...(external?[operation]:[]),reservation.requestId,context.decisionId])).receipt
      if(!receipt(accepted,reservation.requestId))deny()
    },
  })
}
export async function requestLedgerSourceDigest(){
  const fs=await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./request-ledger.mjs',import.meta.url)))
    .update(fs.readFileSync(new URL('./request-ledger.d.mts',import.meta.url)))
    .update(fs.readFileSync(new URL(requestReservationSchemaUrl)))
    .update(fs.readFileSync(new URL(externalRequestSchemaUrl))).update(await requestOperationsSourceDigest()).digest('hex')
}
export async function requestReservationSchemaDigest(){
  const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(requestReservationSchemaUrl))).digest('hex')
}

export async function externalRequestSchemaDigest(){
  const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(externalRequestSchemaUrl))).digest('hex')
}
