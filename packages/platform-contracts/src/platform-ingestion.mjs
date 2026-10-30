import {boundedDatabaseLease} from './database-lease.mjs'
import {diagnosticAsync,diagnosticSync,diagnosticAuditCategory,diagnosticPhaseSourceDigest} from './diagnostic-phase.mjs'
import {createHash} from 'node:crypto'
import {createOperationExecutor,OperationDenied,OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from './operation-context.mjs'

export const PLATFORM_INGESTION_CONTRACT=Object.freeze({id:'profitia.platform-ingestion',version:'1.0.0'})
export const unmeteredSourceSchemaUrl=new URL('../migrations/access/024-unmetered-public-sources.sql',import.meta.url).href
export async function unmeteredSourceSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(unmeteredSourceSchemaUrl))).digest('hex')}
export const platformIngestionSchemaUrl=new URL('../migrations/access/008-platform-ingestion.sql',import.meta.url).href
const proofs=new WeakMap(),hosts=new WeakMap(),ports=new WeakMap(),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256&&!/gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\/|Bearer\s/i.test(v)
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const keyDigest=(key)=>createHash('sha256').update(key).digest('hex')
const receipt=(v,id)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')==='effectId,status'&&v.effectId===id&&v.status==='COMMITTED'

/** Evidence exists only after THIS source driver's real transaction committed.
 * A serialized receipt/old ALLOW cannot mint this observation. Never a session
 * or permission token; private observation still requires its own current lease. */
export function platformReceiptEvidence(value){return value&&typeof value==='object'?proofs.get(value)??null:null}
export function platformDeliveryEvidence(value){return value&&typeof value==='object'?ports.get(value)??null:null}
/** Fixed native receiver adapter. Only a host constructed by this SDK can mint
 * it; inspecting its binding before delivery never relies on a caller's JSON. */
export function createPlatformDeliveryPort({host,resourceId,write}){
  const binding=hosts.get(host)
  if(!binding||typeof resourceId!=='function'||typeof write!=='function')throw TypeError('Accepted source host and fixed native delivery required')
  const port=Object.freeze({deliver:async input=>{
    if(!input||input.sourceId!==binding.sourceId)throw new OperationDenied('CONTEXT_INVALID')
    return(await host.ingest({resourceId:resourceId(input.payload),payload:input.payload,idempotencyKey:input.deliveryKey},write)).value
  }})
  ports.set(port,binding);return port
}

/** Source-local native SQL composition around the SAME operation executor.
 * It admits a bounded stored-data write; no paid fetch, network acquisition,
 * long-running computation or claim that a SQL rollback undoes such an effect.
 */
export function createPlatformIngestionHost(options){
  const a=freeze(structuredClone(options.application)),b=freeze(structuredClone(options.binding)),s=freeze(structuredClone(options.source))
  const {independentQuery,transact,validateSharedPayload,now=Date.now,transactionTimeoutMs=15000}=options
  if(!a||a.profileId!=='PLATFORM_INTERNAL'||a.identityIssuer!=='urn:profitia:database-service-runtime:v1'
    ||a.organisationId!==null||a.features?.join(',')!=='knowledge_ingestion'||a.operations?.join(',')!=='knowledge.ingest'
    ||!b||b.applicationId!==a.appId||b.environment!==a.environment
    ||!['applicationId','projectId','branchId','databaseName','role','deploymentId','configurationVersion'].every(k=>text(b[k]))
    ||b.deploymentId!==a.deploymentId||b.configurationVersion!==a.configurationVersion||!/^[a-z][a-z0-9_]*$/.test(b.role)
    ||!/^[a-f0-9]{64}$/.test(b.schemaDigest??'')||b.unmeteredSchemaDigest!==undefined&&!/^[a-f0-9]{64}$/.test(b.unmeteredSchemaDigest)||!s||Object.keys(s).sort().join(',')!=='classificationVersion,id,payloadSchema,qualityVersion'
    ||!Object.values(s).every(text)||[independentQuery,transact,validateSharedPayload,now].some(v=>typeof v!=='function')
    ||!Number.isInteger(transactionTimeoutMs)||transactionTimeoutMs<100||transactionTimeoutMs>15000)throw TypeError('Explicit native stored-source authority required')
  const one=async(query,sql,values=[])=>{
    try{const r=await query(sql,values);if(!Array.isArray(r?.rows)||r.rows.length!==1)fail();return r.rows[0]}
    catch(error){if(isOperationDenied(error))throw error;fail()}
  }
  // Read independent current evidence in one statement. No observation survives
  // this checkpoint, and the existing scope lock and all validators remain.
  const authority=async(query,resourceId)=>{
    const scoped=resourceId!==undefined,startedMs=now()
    const r=await one(query,'SELECT current_database() AS database_name,current_user AS role,session_user AS login,profitia_ingestion.runtime_descriptor() AS descriptor,extract(epoch from clock_timestamp())*1000 AS descriptor_observed_ms'+
      (scoped?',txid_current()::text AS transaction_id,profitia_ingestion.scope_allows($1,$2) AS allowed':''),scoped?[s.id,resourceId]:[]),receivedMs=now(),raw=r.descriptor,d=raw===null?null:boundedDatabaseLease(raw,r.descriptor_observed_ms,startedMs,receivedMs)
    if(r.database_name!==b.databaseName||r.role!==b.role||r.login!==b.role)fail()
    if(raw===null)return {descriptor:null,row:r}
    if(!d||d.schemaVersion!=='1.0.0'||d.schemaDigest!==b.schemaDigest||d.applicationId!==b.applicationId||d.environment!==b.environment
      ||d.projectId!==b.projectId||d.branchId!==b.branchId||d.databaseName!==b.databaseName||d.role!==b.role
      ||d.profileId!=='PLATFORM_INTERNAL'||d.deploymentId!==b.deploymentId||d.configurationVersion!==b.configurationVersion
      ||!uuid.test(d.serviceId??'')||!/^database-service:[a-f0-9-]{36}:[1-9][0-9]*$/i.test(d.proofRef??'')
      ||!text(d.sourceRef)||!(Date.parse(d.expiresAt)>now()))fail()
    return {descriptor:d,row:r}
  }
  const descriptor=async query=>(await diagnosticAsync('E1_DESCRIPTOR',()=>authority(query))).descriptor
  const append=async(query,event)=>{const encoded=JSON.stringify(event);if(Buffer.byteLength(encoded)>16384)fail()
    // A genuine scalar result is portable to pg and Prisma; do not decode void.
    const result=await one(query,'SELECT true AS recorded FROM profitia_ingestion.append_audit($1::jsonb)',[encoded])
    if(result.recorded!==true)fail()}
  // Validate static policy configuration before touching a database.
  createOperationExecutor({application:a,authenticate:async()=>null,withTransaction:fail,recordAudit:fail,now})
  const host=Object.freeze({contract:PLATFORM_INGESTION_CONTRACT,
    async ingest(input,write){
      let supplied;try{supplied=structuredClone(input)}catch{supplied=null}
      const validInput=input&&Object.getPrototypeOf(input)===Object.prototype&&supplied&&Object.keys(supplied).sort().join(',')==='idempotencyKey,payload,resourceId'&&typeof write==='function'
      let completedContentDigest
      const executor=createOperationExecutor({application:a,now,
        authenticate:async()=>{
          if(!validInput)throw new OperationDenied('CONTEXT_INVALID')
          const d=await descriptor(independentQuery);if(!d)return null
          return freeze({kind:'SERVICE',actorId:d.serviceId,serviceId:d.serviceId,issuer:a.identityIssuer,audience:a.appId,
            environment:a.environment,proofRef:d.proofRef,expiresAt:d.expiresAt})
        },recordAudit:event=>diagnosticAsync(diagnosticAuditCategory(event),()=>append(independentQuery,event)),
        withTransaction:async({actor,request},run)=>{
          let entered=false,closed=false,finished=false,ownedResult
          try{
            const result=await transact(async({query,transaction})=>{
              if(entered||closed||typeof query!=='function'||query===independentQuery||transaction==null)fail();entered=true
              await query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$1,true)",
                [`${transactionTimeoutMs}ms`,`${Math.min(transactionTimeoutMs,3000)}ms`])
              const d=await descriptor(query)
              if(!d||d.serviceId!==actor.actorId||d.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID')
              const lockStartedMs=now(),r=await one(query,'SELECT profitia_ingestion.lock_ingestion($1,$2,$3) AS state,extract(epoch from clock_timestamp())*1000 AS descriptor_observed_ms',[s.id,request.resourceId,actor.proofRef]),lockReceivedMs=now()
              const state=r.state==null?r.state:{...r.state,ingestion:boundedDatabaseLease(r.state.ingestion,r.descriptor_observed_ms,lockStartedMs,lockReceivedMs)}
              if(state===null)throw new OperationDenied('PERMISSION_DENIED')
              if(!state||state.applicationId!==a.appId||state.environment!==a.environment||state.serviceBindingVersion!==actor.proofRef
                ||state.access?.actorId!==actor.actorId||state.access.organisationId!==null||state.resource?.id!==request.resourceId
                ||!/^source-v1:[1-9][0-9]*$/.test(state.policyVersion??'')||!/^[0-9]+$/.test(state.transactionId??''))fail()
              const policy=state.ingestion
              if(policy?.quotaMode==='UNMETERED'&&(!b.unmeteredSchemaDigest||d.unmeteredSchemaDigest!==b.unmeteredSchemaDigest
                ||policy.unmeteredSchemaDigest!==b.unmeteredSchemaDigest))fail()
              if(policy?.sourceId!==s.id||policy.payloadSchema!==s.payloadSchema||policy.qualityVersion!==s.qualityVersion
                ||policy.classificationVersion!==s.classificationVersion||request.payload.sourceId!==s.id
                ||await validateSharedPayload(request.payload.content,{query,transaction})!==true)throw new OperationDenied('DATA_CLASSIFICATION_UNKNOWN')
              const verify=async()=>{
                if(closed||!(Date.parse(actor.expiresAt)>now()))throw new OperationDenied('ACCESS_BASIS_INVALID')
                const {descriptor:c,row:v}=await diagnosticAsync('E1_SCOPE',()=>authority(query,request.resourceId))
                if(!c||c.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID')
                if(v.transaction_id!==state.transactionId)fail();if(v.allowed!==true)throw new OperationDenied('ACCESS_BASIS_INVALID')
              }
              await verify()
              let reserved=false,completed=false,ownedReservation
              ownedResult=await run({state,transaction,transactionalEffects:true,outputBoundaryVersion:state.resource.projectionVersion,
                reserveIngestion:async context=>{
                  if(closed||reserved)fail();reserved=true;await verify()
                  const key=operationPayloadDigest({applicationId:a.appId,environment:a.environment,serviceId:actor.actorId,sourceId:s.id,key:request.idempotencyKey})
                  const v=await one(query,'SELECT profitia_ingestion.reserve($1,$2,$3,$4,$5::uuid) AS reservation',[s.id,request.resourceId,request.payloadDigest,key,context.decisionId])
                  if(v.reservation?.status==='DENIED'){
                    if(['LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT'].includes(v.reservation.reasonCode))throw new OperationDenied(v.reservation.reasonCode);fail()
                  }
                  ownedReservation=v.reservation;return ownedReservation
                },
                completeIngestion:async(context,value)=>{
                  if(closed||completed||!ownedReservation||ownedReservation.status!=='NEW'||!receipt(value,ownedReservation.effectId))fail();completed=true
                  await verify();const v=await one(query,'SELECT profitia_ingestion.complete($1::uuid,$2::uuid) AS receipt',[ownedReservation.effectId,context.decisionId])
                  if(!receipt(v.receipt,ownedReservation.effectId))fail()
                },
                projectOutput:value=>{if(!ownedReservation||!receipt(value,ownedReservation.effectId))fail();return freeze(structuredClone(value))},
                recordOutcome:async event=>{await verify();await diagnosticAsync('E1_OUTCOME',()=>append(query,event))},
              })
              if(!reserved||!ownedReservation||ownedReservation.status==='NEW'&&!completed)fail()
              await verify();if(closed)fail();finished=true
              completedContentDigest=operationPayloadDigest(request.payload.content)
              return ownedResult
            },Object.freeze({timeoutMs:transactionTimeoutMs,maxWaitMs:Math.min(transactionTimeoutMs,3000)}))
            if(!entered||!finished||result!==ownedResult)fail();return result
          }finally{closed=true}
        },
      })
      const result=await executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
        operation:'knowledge.ingest',organisationId:null,resourceId:supplied?.resourceId,payload:{sourceId:s.id,content:supplied?.payload},
        idempotencyKey:supplied?.idempotencyKey,request:null},async(context,transaction)=>{
          await diagnosticAsync('SOURCE_PUBLISH',async()=>write(context.payload.content,transaction,context))
          return{effectId:context.platformReservation.effectId,status:'COMMITTED'}
        })
      // Reached only AFTER the real host transaction, including OUTCOME, committed.
      proofs.set(result.value,freeze({...hosts.get(host),resourceId:supplied.resourceId,contentDigest:completedContentDigest,
        idempotencyKeyDigest:keyDigest(supplied.idempotencyKey),effectId:result.value.effectId,status:'COMMITTED',verifiedAt:new Date(now()).toISOString()}))
      return result
    },
  })
  hosts.set(host,freeze({sourceId:s.id,applicationId:a.appId,environment:a.environment,projectId:b.projectId,branchId:b.branchId,databaseName:b.databaseName,
    schemaDigest:b.schemaDigest,...(b.unmeteredSchemaDigest?{unmeteredSchemaDigest:b.unmeteredSchemaDigest}:{}),payloadSchema:s.payloadSchema,qualityVersion:s.qualityVersion,classificationVersion:s.classificationVersion}))
  return host
}
export async function platformIngestionSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(platformIngestionSchemaUrl))).digest('hex')}
export async function platformIngestionSourceDigest(){const fs=await import('node:fs');return createHash('sha256')
  .update(fs.readFileSync(new URL('./platform-ingestion.mjs',import.meta.url))).update(fs.readFileSync(new URL('./platform-ingestion.d.mts',import.meta.url)))
  .update(await platformIngestionSchemaDigest()).update(await unmeteredSourceSchemaDigest()).update(await diagnosticPhaseSourceDigest()).digest('hex')}
