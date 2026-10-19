import {createHash} from 'node:crypto'
import {OperationDenied} from './operation-context.mjs'

export const REQUEST_INSPECTION_CONTRACT=Object.freeze({id:'profitia.request-inspection',version:'1.0.0',effect:'PRIVATE_SQL_READ',anchor:'ACCEPTED_PRIVATE_PHASE'})
export const requestInspectionSchemaUrl=new URL('../migrations/access/015-delegated-private-inspection.sql',import.meta.url).href
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,digest=/^[a-f0-9]{64}$/,integer=/^[1-9][0-9]*$/
const phases=['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST']
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const exact=(v,keys)=>!!v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length
 &&Object.keys(v).sort().join(',')===[...keys].sort().join(',')&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const deny=(reason='POLICY_UNAVAILABLE')=>{throw new OperationDenied(reason)}
export async function requestInspectionSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(requestInspectionSchemaUrl))).digest('hex')}
export async function requestInspectionSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./request-inspection.mjs',import.meta.url))).update(fs.readFileSync(new URL('./request-inspection.d.mts',import.meta.url))).update(await requestInspectionSchemaDigest()).digest('hex')}

/** Current server/transaction inspection of an already committed phase. This
 * reads the existing ledger, binds its physical canonical INTENT, and never
 * reserves a phase, parent, dispatch, quota or provider transaction. */
export function createRequestInspection({binding,inspection,now=Date.now}){
 if(!binding?.service||typeof now!=='function'||!exact(inspection,['requestId','phaseId','schemaDigest','continuationSchemaDigest','delegatedSchemaDigest'])
  ||!uuid.test(inspection.requestId??'')||!phases.includes(inspection.phaseId)
  ||!['schemaDigest','continuationSchemaDigest','delegatedSchemaDigest'].every(k=>digest.test(inspection[k]??'')))throw TypeError('Explicit current delegated phase inspection required')
 const b=freeze(structuredClone(binding)),c=freeze(structuredClone(inspection)),handles=new WeakMap()
 const one=async(query,sql,args)=>{const result=await query(sql,args);if(!Array.isArray(result?.rows)||result.rows.length!==1)deny();return result.rows[0]}
 const read=async(query)=>{
  const d=(await one(query,'SELECT profitia_request_inspection.descriptor($1::uuid,$2) AS descriptor',[c.requestId,c.phaseId])).descriptor
  if(!d||d.schemaVersion!=='1.0.0'||d.delegatedSchemaVersion!=='1.0.0'||d.inspectionSchemaVersion!=='1.0.0'||d.inspectionSchemaDigest!==c.schemaDigest||d.schemaDigest!==c.continuationSchemaDigest
   ||d.delegatedSchemaDigest!==c.delegatedSchemaDigest||d.effect!=='PRIVATE_SQL_READ'||d.owner!=='profitia_access_owner'
   ||!['applicationId','environment','projectId','branchId','databaseName','role'].every(k=>d[k]===b[k])
   ||d.requestId!==c.requestId||d.phaseId!==c.phaseId||d.operation!=='supplier.report.refresh'
   ||!digest.test(d.inputDigest??'')||!digest.test(d.payloadDigest??'')||!integer.test(d.policyVersion??'')
   ||!integer.test(d.transactionId??'')||!integer.test(d.acceptedTransactionId??'')||d.transactionId===d.acceptedTransactionId
   ||!['executorServiceId','subjectUserId','organisationId','delegationId'].every(k=>uuid.test(d[k]??''))
   ||typeof d.parentApplicationId!=='string'||!d.parentApplicationId.length||typeof d.resourceId!=='string'||!d.resourceId.length
   ||!(Date.parse(d.expiresAt)>now()))deny('ACCESS_BASIS_INVALID')
  return freeze(structuredClone(d))
 }
 const stable=(a,b)=>['applicationId','environment','projectId','branchId','databaseName','role','requestId','phaseId','inputDigest','payloadDigest','policyVersion','transactionId','acceptedTransactionId','parentApplicationId','executorServiceId','subjectUserId','organisationId','delegationId','resourceId','schemaDigest','delegatedSchemaDigest','inspectionSchemaDigest'].every(k=>a[k]===b[k])
 const owned=(query,handle,context)=>{
  const h=handles.get(handle)
  if(!h||h.query!==query||context.actorKind!=='SERVICE'||context.operation!=='job.execute'||context.applicationId!==b.applicationId
   ||context.environment!==b.environment||context.actorId!==handle.executorServiceId||context.subjectUserId!==handle.subjectUserId
   ||context.organisationId!==handle.organisationId||context.resourceId!==c.requestId||context.payloadDigest!==handle.payloadDigest
   ||context.delegation?.requestId!==c.requestId||context.delegation.delegationId!==handle.delegationId
   ||context.delegation.target.application.appId!==handle.parentApplicationId||context.delegation.target.operation!=='supplier.report.refresh'||context.delegation.target.resourceId!==handle.resourceId
   ||JSON.stringify(context.requestInspection)!==JSON.stringify(evidence(handle))||context.requestContinuation!==undefined
   ||!(Date.parse(handle.expiresAt)>now()))deny('RESOURCE_SCOPE_MISMATCH')
  return h
 }
 function evidence(handle){if(!handles.has(handle))deny();return freeze({requestId:c.requestId,phaseId:c.phaseId,inputDigest:handle.inputDigest,
  policyVersion:handle.policyVersion,schemaDigest:c.schemaDigest,continuationSchemaDigest:c.continuationSchemaDigest,
  delegatedSchemaDigest:c.delegatedSchemaDigest,transactionId:handle.transactionId,acceptedTransactionId:handle.acceptedTransactionId})}
 return Object.freeze({
  async load(query,{request,lease}){
   if(request.operation!=='job.execute'||request.resourceId!==c.requestId||lease.state?.delegation?.target?.operation!=='supplier.report.refresh')deny('RESOURCE_SCOPE_MISMATCH')
   const d=await read(query);handles.set(d,{query});return d
  },evidence,
  async bind(query,handle,context){
   owned(query,handle,context);const current=await read(query);if(!stable(current,handle))deny('ACCESS_BASIS_INVALID')
   const result=await one(query,'SELECT profitia_request_inspection.bind_scope($1::uuid,$2,$3,$4::uuid,$5::uuid) AS allowed',
    [c.requestId,c.phaseId,handle.inputDigest,context.decisionId,context.correlationId]);if(result.allowed!==true)deny('AUDIT_UNAVAILABLE')
  },
  async verify(query,handle,context){
   owned(query,handle,context);const current=await read(query);if(!stable(current,handle))deny('ACCESS_BASIS_INVALID')
   const result=await one(query,'SELECT profitia_request_inspection.scope_allows($1::uuid,$2,$3::uuid,$4::uuid) AS allowed',
    [c.requestId,c.phaseId,context.organisationId,context.subjectUserId]);if(result.allowed!==true)deny('ACCESS_BASIS_INVALID')
  },
 })
}
