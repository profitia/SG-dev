import {createHash} from 'node:crypto'
import {OperationDenied} from './operation-context.mjs'

export const REQUEST_CONTINUATION_CONTRACT=Object.freeze({id:'profitia.request-continuation',version:'1.0.0',effect:'PRIVATE_SQL_PHASE'})
export const requestContinuationSchemaUrl=new URL('../migrations/access/011-request-continuation.sql',import.meta.url).href
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const digest=/^[a-f0-9]{64}$/,integer=/^[1-9][0-9]*$/,phase=/^[A-Z][A-Z0-9_]{0,63}$/
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const deny=(reason='POLICY_UNAVAILABLE')=>{throw new OperationDenied(reason)}
const receipt=(v,id)=>exact(v,['requestId','status'])&&v.requestId===id&&v.status==='ACCEPTED'

/** Same ledger, current authority and audit; no independently usable receipt,
 * cached actor, network adapter, source permission or second quota mechanism. */
export function createRequestContinuationLedger({ledger,binding,continuation,now=Date.now}){
 const c=freeze(structuredClone(continuation)),b=freeze(structuredClone(binding))
 if(!ledger||['loadPolicy','reserve','complete'].some(k=>typeof ledger[k]!=='function')||typeof now!=='function'
   ||!exact(c,['requestId','phaseId','inputDigest','schemaDigest'])||!uuid.test(c.requestId??'')
   ||!phase.test(c.phaseId??'')||!digest.test(c.inputDigest??'')||!digest.test(c.schemaDigest??'')
   ||!b||b.service!==undefined||!['applicationId','environment','projectId','branchId','databaseName','role'].every(k=>typeof b[k]==='string'&&b[k].length>0))throw TypeError('Explicit same-store private continuation required')
 const policies=new WeakMap(),reservations=new WeakMap()
 const one=async(q,sql,args)=>{const r=await q(sql,args);if(!r||!Array.isArray(r.rows)||r.rows.length!==1)deny();return r.rows[0]}
 const read=async(q)=>{
  const d=(await one(q,'SELECT profitia_request_phases.descriptor($1) AS descriptor',[c.phaseId])).descriptor
  if(!d||d.schemaVersion!=='1.0.0'||d.schemaDigest!==c.schemaDigest||d.owner!=='profitia_access_owner'
    ||Object.keys(b).filter(k=>['applicationId','environment','projectId','branchId','databaseName','role'].includes(k)).some(k=>d[k]!==b[k])
    ||d.phaseId!==c.phaseId||d.operation!=='supplier.report.refresh'||d.effect!=='PRIVATE_SQL_PHASE'
    ||!integer.test(d.policyVersion??'')||typeof d.sourceRef!=='string'||!d.sourceRef.length||d.sourceRef.length>256
    ||!integer.test(d.transactionId??'')||!(Date.parse(d.expiresAt)>now()))deny('LIMIT_POLICY_UNAVAILABLE')
  return d
 }
 const owned=(policy,q,context)=>{
  const p=policies.get(policy)
  if(!p||p.query!==q||context.operation!=='supplier.report.refresh'||context.actorKind!=='HUMAN'
    ||context.moduleEvidence?.moduleId!=='supplier_report'||context.moduleEvidence.transactionId!==policy.transactionId
    ||context.applicationId!==b.applicationId||context.environment!==b.environment
    ||context.actorId!==p.scope.actorId||context.subjectUserId!==p.scope.actorId
    ||context.organisationId!==p.scope.organisationId||context.resourceId!==p.scope.resourceId
    ||context.payloadDigest!==p.scope.payloadDigest
    ||!(Date.parse(p.descriptor.expiresAt)>now()))deny('LIMIT_POLICY_UNAVAILABLE')
  return p
 }
 return Object.freeze({
  contract:ledger.contract,
  async loadPolicy(query,identity){
   if(identity.request.operation!=='supplier.report.refresh')deny('PERMISSION_DENIED')
   const policy=await ledger.loadPolicy(query,identity),d=await read(query)
   if(d.transactionId!==policy.transactionId)deny()
   const parent=(await one(query,'SELECT profitia_request_phases.parent_available($1::uuid,$2::uuid,$3::uuid,$4,$5) AS available',
    [c.requestId,identity.request.organisationId,identity.actor.actorId,identity.request.resourceId,identity.request.payloadDigest])).available
   if(parent!==true)deny('RESOURCE_SCOPE_MISMATCH')
   policies.set(policy,{query,descriptor:freeze(structuredClone(d)),scope:freeze({actorId:identity.actor.actorId,
    organisationId:identity.request.organisationId,resourceId:identity.request.resourceId,payloadDigest:identity.request.payloadDigest})});return policy
  },
  evidence(policy){
   const p=policies.get(policy);if(!p)deny()
   return freeze({requestId:c.requestId,phaseId:c.phaseId,inputDigest:c.inputDigest,schemaDigest:c.schemaDigest,
    policyVersion:p.descriptor.policyVersion,transactionId:p.descriptor.transactionId})
  },
  async reserve(query,policy,context){
   const p=owned(policy,query,context),d=await read(query)
   if(d.policyVersion!==p.descriptor.policyVersion)deny('LIMIT_POLICY_UNAVAILABLE')
   // The base ledger alone verifies actor/key/command binding. A mismatching
   // key can never commit a new parent: reject NEW before any phase action.
   const parent=await ledger.reserve(query,policy,context)
   if(parent.status!=='REPLAY'||parent.requestId!==c.requestId)deny('IDEMPOTENCY_CONFLICT')
   const r=(await one(query,'SELECT profitia_request_phases.reserve($1::uuid,$2,$3,$4::uuid,$5::bigint) AS reservation',
    [c.requestId,c.phaseId,c.inputDigest,context.decisionId,d.policyVersion])).reservation
   if(r?.status==='DENIED')deny(['IDEMPOTENCY_CONFLICT','RESOURCE_SCOPE_MISMATCH','LIMIT_POLICY_UNAVAILABLE'].includes(r.reasonCode)?r.reasonCode:'POLICY_UNAVAILABLE')
   if(!exact(r,['status','phaseId','inputDigest','decisionId','transactionId'])||!['NEW','REPLAY'].includes(r.status)
     ||r.phaseId!==c.phaseId||r.inputDigest!==c.inputDigest||r.transactionId!==policy.transactionId
     ||!uuid.test(r.decisionId??''))deny()
   const reservation=freeze({status:r.status,requestId:c.requestId,policyId:policy.policyId,policyVersion:policy.version,
    transactionId:policy.transactionId,...(r.status==='REPLAY'?{value:{requestId:c.requestId,status:'ACCEPTED'}}:{})})
   reservations.set(reservation,{query,policy,decisionId:context.decisionId,used:false});return reservation
  },
  async complete(query,policy,reservation,context,value){
   owned(policy,query,context);const r=reservations.get(reservation)
   if(!r||r.used||r.query!==query||r.policy!==policy||r.decisionId!==context.decisionId||reservation.status!=='NEW'||!receipt(value,c.requestId))deny()
   r.used=true;const d=await read(query)
   if(d.policyVersion!==policies.get(policy).descriptor.policyVersion)deny('LIMIT_POLICY_UNAVAILABLE')
   const ok=(await one(query,'SELECT profitia_request_phases.accept($1::uuid,$2,$3,$4::uuid,$5::bigint) AS accepted',
    [c.requestId,c.phaseId,c.inputDigest,context.decisionId,d.policyVersion])).accepted
   if(ok!==true)deny('RESOURCE_SCOPE_MISMATCH')
  },
 })
}
export async function requestContinuationSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(requestContinuationSchemaUrl))).digest('hex')}
export async function requestContinuationSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./request-continuation.mjs',import.meta.url))).update(fs.readFileSync(new URL('./request-continuation.d.mts',import.meta.url))).update(await requestContinuationSchemaDigest()).digest('hex')}
