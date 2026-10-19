import {requestOperationsSourceDigest} from './request-operations.mjs'
import {createHash} from 'node:crypto'
import {requestOperationPolicy} from './request-operations.mjs'
import {OperationDenied} from './operation-context.mjs'

export const REQUEST_WORK_CONTRACT=Object.freeze({id:'profitia.request-work',version:'1.0.0',effect:'PRIVATE_SQL_WORK',replayOwner:'EXISTING_DOMAIN_STATE'})
export const requestWorkSchemaUrl=new URL('../migrations/access/016-delegated-native-work.sql',import.meta.url).href
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,digest=/^[a-f0-9]{64}$/,integer=/^[1-9][0-9]*$/
const unit=/^[A-Z][A-Z0-9_]{1,63}$/
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const exact=(v,keys)=>!!v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length
 &&Object.keys(v).sort().join(',')===[...keys].sort().join(',')&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const deny=(reason='POLICY_UNAVAILABLE')=>{throw new OperationDenied(reason)}
export async function requestWorkSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(requestWorkSchemaUrl))).digest('hex')}
export async function requestWorkSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./request-work.mjs',import.meta.url))).update(fs.readFileSync(new URL('./request-work.d.mts',import.meta.url))).update(await requestWorkSchemaDigest()).update(await requestOperationsSourceDigest()).digest('hex')}

/** One short native SQL unit, under the current original job authority. The
 * existing domain lifecycle owns replay and external uncertainty. This store
 * creates neither a second effect ledger nor a permission to call a provider. */
export function createRequestWorkScope({binding,work,now=Date.now}){
 const targetOperation=work?.targetOperation??'supplier.report.refresh',target=requestOperationPolicy(targetOperation)
 const extra=target?.additional?['targetOperation','operationSchemaDigest']:[]
 if(!target?.nativeWork||!binding?.service||typeof now!=='function'||!exact(work,['requestId','unitId','accessMode','inputDigest','schemaDigest',...extra])
  ||target.additional&&!digest.test(work.operationSchemaDigest??'')
  ||!uuid.test(work.requestId??'')||!unit.test(work.unitId??'')||!['READ','WRITE'].includes(work.accessMode)
  ||!digest.test(work.inputDigest??'')||!digest.test(work.schemaDigest??''))throw TypeError('Explicit current native SQL work unit required')
 const b=freeze(structuredClone(binding)),c=freeze(structuredClone(work)),handles=new WeakMap()
 const one=async(query,sql,args)=>{const r=await query(sql,args);if(!Array.isArray(r?.rows)||r.rows.length!==1)deny();return r.rows[0]}
 const read=async query=>{
  const d=(await one(query,'SELECT profitia_request_work.descriptor($1::uuid,$2) AS descriptor',[c.requestId,c.unitId])).descriptor
  if(!d||d.schemaVersion!=='1.0.0'||d.schemaDigest!==c.schemaDigest||d.owner!=='profitia_access_owner'
   ||!['applicationId','environment','projectId','branchId','databaseName','role'].every(k=>d[k]===b[k])
   ||d.requestId!==c.requestId||d.unitId!==c.unitId||d.accessMode!==c.accessMode||d.effect!=='PRIVATE_SQL_WORK'
   ||d.operation!==targetOperation||target.additional&&(d.operationSchemaVersion!=='1.0.0'||d.operationSchemaDigest!==c.operationSchemaDigest)||!digest.test(d.payloadDigest??'')||!integer.test(d.policyVersion??'')
   ||!integer.test(d.transactionId??'')||!['executorServiceId','subjectUserId','organisationId','delegationId'].every(k=>uuid.test(d[k]??''))
   ||typeof d.parentApplicationId!=='string'||!d.parentApplicationId.length||typeof d.resourceId!=='string'||!d.resourceId.length
   ||typeof d.sourceRef!=='string'||d.sourceRef.length<1||d.sourceRef.length>256
   ||!(Date.parse(d.policyExpiresAt)>now())||!(Date.parse(d.expiresAt)>now()))deny('ACCESS_BASIS_INVALID')
  return freeze(structuredClone(d))
 }
 const stable=(a,b)=>['applicationId','environment','projectId','branchId','databaseName','role','requestId','unitId','accessMode','payloadDigest','policyVersion','transactionId','parentApplicationId','executorServiceId','subjectUserId','organisationId','delegationId','resourceId','schemaDigest','sourceRef','policyExpiresAt'].every(k=>a[k]===b[k])
 function evidence(h){if(!handles.has(h))deny();return freeze({requestId:c.requestId,unitId:c.unitId,accessMode:c.accessMode,inputDigest:c.inputDigest,policyVersion:h.policyVersion,policySourceRef:h.sourceRef,policyExpiresAt:h.policyExpiresAt,transactionId:h.transactionId,schemaDigest:c.schemaDigest})}
 const owned=(query,h,context)=>{
  if(handles.get(h)?.query!==query||context.actorKind!=='SERVICE'||context.operation!=='job.execute'||context.applicationId!==b.applicationId
   ||context.environment!==b.environment||context.actorId!==h.executorServiceId||context.subjectUserId!==h.subjectUserId
   ||context.organisationId!==h.organisationId||context.resourceId!==c.requestId||context.payloadDigest!==h.payloadDigest
   ||context.delegation?.requestId!==c.requestId||context.delegation.delegationId!==h.delegationId
   ||context.delegation.target.application.appId!==h.parentApplicationId||context.delegation.target.operation!==targetOperation
   ||context.delegation.target.resourceId!==h.resourceId||JSON.stringify(context.requestWork)!==JSON.stringify(evidence(h))
   ||context.requestContinuation!==undefined||context.requestInspection!==undefined||!(Date.parse(h.expiresAt)>now()))deny('RESOURCE_SCOPE_MISMATCH')
 }
 return Object.freeze({
  async load(query,{request,lease}){
   if(request.operation!=='job.execute'||request.resourceId!==c.requestId||lease.state?.delegation?.target?.operation!==targetOperation)deny('RESOURCE_SCOPE_MISMATCH')
   const h=await read(query);handles.set(h,{query});return h
  },evidence,
  async bind(query,h,context){
   owned(query,h,context);if(!stable(await read(query),h))deny('ACCESS_BASIS_INVALID')
   const result=await one(query,'SELECT profitia_request_work.bind_scope($1::uuid,$2,$3,$4::uuid,$5::uuid) AS allowed',[c.requestId,c.unitId,c.inputDigest,context.decisionId,context.correlationId])
   if(result.allowed!==true)deny('AUDIT_UNAVAILABLE')
  },
  async verify(query,h,context){
   owned(query,h,context);if(!stable(await read(query),h))deny('ACCESS_BASIS_INVALID')
   const result=await one(query,'SELECT profitia_request_work.scope_allows($1::uuid,$2,$3::uuid,$4::uuid,$5) AS allowed',[c.requestId,c.unitId,context.organisationId,context.subjectUserId,c.accessMode])
   if(result.allowed!==true)deny('ACCESS_BASIS_INVALID')
  },
 })
}
