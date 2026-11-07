import {createHash} from 'node:crypto'
import {createReadonlyMissReportHost,readonlyMissReportSourceDigest} from '@profitia/platform-readonly-miss-report'
import {createDelegatedJobHost,privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'

export const ROOT_ATOMIC_CLAIM_CONTRACT=Object.freeze({id:'profitia.root-atomic-claim',version:'1.0.0'})
export const rootAtomicClaimSchemaUrl=new URL('../migrations/001-root-atomic-claim.sql',import.meta.url).href
const claims=new WeakMap()
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const digest=/^[a-f0-9]{64}$/
const denied=(reason='POLICY_UNAVAILABLE')=>{throw new OperationDenied(reason)}
const data=v=>!!v&&Object.getPrototypeOf(v)===Object.prototype
 &&Reflect.ownKeys(v).length===Object.keys(v).length
 &&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const exact=(v,keys)=>data(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const copy=v=>freeze(structuredClone(v))
const fingerprint=r=>operationPayloadDigest([r.url,r.method,[...r.headers].sort((a,b)=>a[0].localeCompare(b[0]))])
const current=owner=>{
 if(!owner||owner.phase!=='WORK'||owner.signal.aborted||fingerprint(owner.request)!==owner.transport)denied('ACCESS_BASIS_INVALID')
}

async function claim(query,context,binding,schemaDigest,now){
 if(typeof query!=='function'||context.actorKind!=='HUMAN'||context.operation!=='supplier.report.refresh'
  ||context.environment!=='development'||!uuid.test(context.actorId??'')||!uuid.test(context.organisationId??'')
  ||!uuid.test(context.decisionId??'')||context.requestReservation?.replay!==false
  ||!uuid.test(context.requestReservation?.requestId??''))denied()
 let row
 try{
  const result=await query('SELECT current_database() AS database_name,current_user AS role,session_user AS login,'+
   'txid_current()::text AS transaction_id,profitia_root_claim.runtime_descriptor() AS descriptor,'+
   'profitia_root_claim.claim_dispatch($1::uuid,$2::uuid,$3,$4) AS admission',
   [context.requestReservation.requestId,context.decisionId,context.configurationVersion,schemaDigest])
  if(!Array.isArray(result?.rows)||result.rows.length!==1)denied()
  row=result.rows[0]
 }catch(error){if(error?.code==='PT403')denied('ACCESS_BASIS_INVALID');denied()}
 const d=row.descriptor,a=row.admission
 if(row.database_name!==binding.databaseName||row.role!==binding.role||row.login!==binding.role||!d
  ||['applicationId','environment','projectId','branchId','databaseName','role','schemaDigest'].some(k=>d[k]!==binding[k])
  ||d.rootClaimSchemaVersion!=='1.0.0'||d.rootClaimSchemaDigest!==schemaDigest
  ||row.transaction_id!==context.moduleEvidence?.transactionId||!a||a.status!=='READY'
  ||a.jobId!==context.requestReservation.requestId||a.requestId!==a.jobId||!uuid.test(a.leaseId??'')
  ||a.rootDecisionId!==context.decisionId||a.rootTransactionId!==row.transaction_id
  ||a.organisationId!==context.organisationId||a.userId!==context.actorId||a.payloadDigest!==context.payloadDigest
  ||a.foregroundRole!==binding.role||a.applicationId!==binding.applicationId||a.environment!==binding.environment
  ||a.executorRole!==d.executorRole||a.executorApplicationId!==d.executorApplicationId
  ||typeof a.sourceId!=='string'||!a.sourceId||a.sourceId.length>128||!digest.test(a.deliveryKey??'')
  ||a.attempt!==1||!(Date.parse(a.expiresAt)>now())||Date.parse(a.expiresAt)>now()+30000)denied('DELEGATION_INVALID')
 return copy({admission:{status:'READY',jobId:a.jobId,requestId:a.requestId,sourceId:a.sourceId,
  deliveryKey:a.deliveryKey,leaseId:a.leaseId,expiresAt:a.expiresAt,attempt:a.attempt},
  rootDecisionId:a.rootDecisionId,rootTransactionId:a.rootTransactionId,userId:a.userId,
  organisationId:a.organisationId,payloadDigest:a.payloadDigest,binding:copy(binding),
  executorRole:a.executorRole,executorApplicationId:a.executorApplicationId,rootClaimSchemaDigest:schemaDigest})
}

/** Explicit opt-in. The canonical composer owns authentication, fresh H3,
 * OUTCOME, actual COMMIT and H4. Only the Root projection is extended, after
 * completeRequest. No claim or query port is exposed through that projection.
 * A replay deliberately retains the old admit/deliver recovery path. */
export function createRootAtomicClaimReportHost(options){
 const keys=['clerk','identity','receiverBoundary','probe','probeReadOnly','refresh','read','now','atomicClaim']
 if(!data(options)||Object.keys(options).some(k=>!keys.includes(k))
  ||!exact(options.atomicClaim,['schemaDigest'])||!digest.test(options.atomicClaim.schemaDigest??'')
  ||options.identity?.environment!=='development'
  ||!data(options.refresh)||typeof options.refresh.transact!=='function'||typeof options.refresh.projectOutput!=='function')
  throw TypeError('Explicit optional atomic Root claim configuration required')
 const {atomicClaim,...base}=options,root=options.refresh,binding=copy(root.binding)
 const schemaDigest=atomicClaim.schemaDigest,now=options.now??Date.now
 const transact=root.transact,project=root.projectOutput
 let used=false,active=null,prepared=null,projectionCalled=false
 const host=createReadonlyMissReportHost({...base,refresh:{...root,
  transact:(action,limits)=>transact(async session=>{
   if(active||!session||typeof session.query!=='function')denied()
   active=session
   try{return await action(session)}finally{active=null}
  },limits),
  projectOutput:async(value,context,transaction)=>{
   if(projectionCalled||!active||active.transaction!==transaction)denied()
   projectionCalled=true
   const output=await project(value,context,transaction)
   if(!active||active.transaction!==transaction)denied()
   if(context.requestReservation?.replay===false)prepared=await claim(active.query,context,binding,schemaDigest,now)
   else if(context.requestReservation?.replay!==true)denied()
   return output
  },
 }})
 return Object.freeze({hostContract:ROOT_ATOMIC_CLAIM_CONTRACT,
  async execute(input,actions){
   if(used)denied('ACCESS_BASIS_INVALID')
   used=true
   if(!exact(input,['request','organisationId','nip','idempotencyKey'])||!(input.request instanceof Request)
    ||!exact(actions,['probe','refresh','work','read','ready'])||Object.values(actions).some(v=>typeof v!=='function'))denied('CONTEXT_INVALID')
   const request=input.request,owner={request,signal:request.signal,transport:fingerprint(request),now,phase:'OPEN'}
   const work=actions.work
   try{
    return await host.execute(input,{...actions,work:async(selection,signal)=>{
     // The unchanged canonical host has awaited the actual driver COMMIT.
     if(owner.phase!=='OPEN'||signal!==owner.signal||active)denied()
     owner.phase='WORK';current(owner)
     let proof=null
     if(prepared){
      if(prepared.admission.requestId!==selection.requestId||prepared.organisationId!==selection.organisationId
       ||prepared.payloadDigest!==operationPayloadDigest(selection.command)||Date.parse(prepared.admission.expiresAt)<=now())denied('DELEGATION_INVALID')
      proof=Object.freeze({})
      claims.set(proof,{...prepared,owner,used:false})
     }
     try{return await work(Object.freeze({...selection,rootClaim:proof}),signal)}
     finally{if(proof)claims.delete(proof);owner.phase='AFTER_WORK'}
    }})
   }finally{owner.phase='CLOSED';prepared=null;active=null}
  },
 })
}

/** Normal delegated delivery, with a once-only post-COMMIT Root handoff.
 * This never substitutes a HUMAN for the real SERVICE, changes Source,
 * installs a capability admission, or modifies either native Work host. */
export function createRootAtomicClaimDeliveryHost(options){
 const keys=['application','binding','job','now','transactionTimeoutMs','independentQuery','transact','readExternalAccount','sourceDelivery']
 if(!data(options)||Object.keys(options).some(k=>!keys.includes(k))||!options.sourceDelivery
  ||options.application?.environment!=='development'||options.binding?.environment!=='development'
  ||options.job?.targetOperation!=='supplier.report.refresh')throw TypeError('Explicit existing Supplier delivery configuration required')
 const base={...options,application:copy(options.application),binding:copy(options.binding),job:copy(options.job)}
 const binding=base.binding,validate=createDelegatedJobHost(base),transact=base.transact
 if(typeof validate.deliver!=='function')throw TypeError('Existing canonical Source delivery required')
 return Object.freeze({hostContract:ROOT_ATOMIC_CLAIM_CONTRACT,
  async deliver(input,proof){
   const p=claims.get(proof)
   if(!p||p.used)denied('DELEGATION_INVALID')
   current(p.owner)
   if(Date.parse(p.admission.expiresAt)<=p.owner.now())denied('ACCESS_BASIS_INVALID')
   if(binding.role!==p.executorRole||binding.applicationId!==p.executorApplicationId
    ||['environment','projectId','branchId','databaseName','schemaDigest'].some(k=>binding[k]!==p.binding[k])
    ||input?.contractId!==OPERATION_CONTRACT.id||input.contractVersion!==OPERATION_CONTRACT.version
    ||input.operation!=='job.execute'||input.resourceId!==p.admission.jobId||input.organisationId!==p.organisationId
    ||operationPayloadDigest(input.payload)!==p.payloadDigest)denied('DELEGATION_INVALID')
   p.used=true
   const host=createDelegatedJobHost({...base,transact:(action,limits)=>transact(async session=>{
    current(p.owner)
    let result
    try{result=await session.query('SELECT current_database() AS database_name,current_user AS role,session_user AS login,'+
      'profitia_root_claim.bind_delivery($1::uuid,$2::uuid,$3::uuid,$4) AS allowed',
      [p.admission.jobId,p.admission.leaseId,p.rootDecisionId,p.rootClaimSchemaDigest])}
    catch{denied('DELEGATION_INVALID')}
    if(result?.rows?.length!==1||result.rows[0].allowed!==true||result.rows[0].database_name!==binding.databaseName
     ||result.rows[0].role!==binding.role||result.rows[0].login!==binding.role)denied('DELEGATION_INVALID')
    current(p.owner)
    return action(session)
   },limits)})
   const result=await host.deliver(input,p.admission)
   current(p.owner)
   if(result?.value?.status!=='CONFIRMED')denied('DELIVERY_UNCERTAIN')
   return result
  },
 })
}

export async function rootAtomicClaimSchemaDigest(){
 const fs=await import('node:fs')
 return createHash('sha256').update(fs.readFileSync(new URL(rootAtomicClaimSchemaUrl))).digest('hex')
}
export async function rootAtomicClaimSourceDigest(){
 const fs=await import('node:fs')
 return createHash('sha256').update(fs.readFileSync(new URL('./root-atomic-claim.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./root-atomic-claim.d.mts',import.meta.url)))
  .update(fs.readFileSync(new URL('../package.json',import.meta.url)))
  .update(await rootAtomicClaimSchemaDigest()).update(await readonlyMissReportSourceDigest())
  .update(await privateOperationHostSourceDigest()).digest('hex')
}
