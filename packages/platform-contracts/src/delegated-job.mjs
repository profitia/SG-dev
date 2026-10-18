import { createHash } from 'node:crypto'
import { OperationDenied, operationPayloadDigest } from './operation-context.mjs'
import {platformReceiptEvidence,platformDeliveryEvidence,platformIngestionSourceDigest} from './platform-ingestion.mjs'

export const DELEGATED_JOB_CONTRACT=Object.freeze({id:'profitia.delegated-job',version:'1.0.0'})
export const delegatedJobSchemaUrl=new URL('../migrations/access/007-delegated-jobs.sql',import.meta.url).href
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const text=value=>typeof value==='string'&&value.length>0&&value.length<=256
const frozen=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value)}return value}
const fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}

/** Closed SQL ports. All methods use the host's real, single transaction;
 * leases never become a serialized access token. No queue, timer or worker. */
export function createDelegatedJobStore({binding,schemaDigest,now=Date.now}){
  const b=frozen(structuredClone(binding)),leases=new WeakSet()
  if(!b||!['development','staging','production'].includes(b.environment)
    || !['applicationId','projectId','branchId','databaseName','role'].every(k=>text(b[k]))
    || !/^[a-z][a-z0-9_]*$/.test(b.role)||!/^[a-f0-9]{64}$/.test(schemaDigest??'')||typeof now!=='function')throw TypeError('Explicit private dispatch binding required')
  const one=async(query,sql,values=[])=>{
    try{if(typeof query!=='function')fail();const r=await query(sql,values)
      if(!Array.isArray(r?.rows)||r.rows.length!==1)fail();return r.rows[0]
    }catch(error){if(error?.code==='PT403')throw new OperationDenied('ACCESS_BASIS_INVALID');fail()}
  }
  const descriptor=async query=>{
    const r=await one(query,'SELECT current_database() AS database_name,current_user AS role,session_user AS login,profitia_jobs.runtime_descriptor() AS descriptor')
    const d=r.descriptor
    if(!d||r.database_name!==b.databaseName||r.role!==b.role||r.login!==b.role||d.applicationId!==b.applicationId
      ||d.environment!==b.environment||d.projectId!==b.projectId||d.branchId!==b.branchId||d.databaseName!==b.databaseName
      ||d.role!==b.role||d.schemaDigest!==b.schemaDigest||d.jobSchemaVersion!=='1.0.0'||d.jobSchemaDigest!==schemaDigest)fail()
    return d
  }
  const verifyScope=async(query,lease)=>{
    if(!leases.has(lease))fail()
    if(!(Date.parse(lease.expiresAt)>now()))throw new OperationDenied('ACCESS_BASIS_INVALID')
    await descriptor(query)
    const r=await one(query,'SELECT txid_current()::text AS transaction_id,profitia_jobs.scope_allows($1::uuid) AS allowed',[lease.resourceId])
    if(r.transaction_id!==lease.transactionId)fail()
    if(r.allowed!==true)throw new OperationDenied('ACCESS_BASIS_INVALID')
  }
  return Object.freeze({contract:DELEGATED_JOB_CONTRACT,
    async createDispatch(query,context){
      if(b.service!==undefined||context?.actor?.kind!=='HUMAN'||context.applicationId!==b.applicationId
        ||context.environment!==b.environment||context.operation!=='forecast.request'||!text(context.configurationVersion)||!uuid.test(context.decisionId??'')
        ||!uuid.test(context.requestReservation?.requestId??'')||context.requestReservation.replay!==false)fail()
      await descriptor(query)
      const r=await one(query,'SELECT profitia_jobs.create_dispatch($1::uuid,$2::uuid,$3) AS result',[context.requestReservation.requestId,context.decisionId,context.configurationVersion])
      if(!r.result||r.result.jobId!==context.requestReservation.requestId||r.result.requestId!==r.result.jobId||r.result.status!=='PENDING')throw new OperationDenied('DELEGATION_INVALID')
      return frozen(structuredClone(r.result))
    },
    async lockJob(query,{actor,request}){
      if(b.service?.profileId!=='PLATFORM_INTERNAL'||actor?.kind!=='SERVICE'||actor.actorId!==actor.serviceId
        ||actor.userId!=null||actor.onBehalfOf!=null||actor.audience!==b.applicationId||actor.environment!==b.environment
        ||actor.issuer!=='urn:profitia:database-service-runtime:v1'||!uuid.test(actor.actorId??'')
        ||!(Date.parse(actor.expiresAt)>now())||request?.operation!=='job.execute'||!uuid.test(request.resourceId??'')
        ||!uuid.test(request.organisationId??'')||request.payloadDigest!==operationPayloadDigest(request.payload))fail()
      await descriptor(query)
      const r=await one(query,'SELECT profitia_jobs.lock_job($1::uuid,$2) AS state',[request.resourceId,actor.proofRef]),s=r.state
      if(s===null)throw new OperationDenied('DELEGATION_INVALID')
      if(!s||s.applicationId!==b.applicationId||s.environment!==b.environment||s.serviceBindingVersion!==actor.proofRef
        ||s.access?.actorId!==actor.actorId||s.access.type!=='DELEGATED_USER'||s.access.organisationId!==request.organisationId
        ||s.resource?.id!==request.resourceId||s.delegation?.payloadDigest!==request.payloadDigest
        ||!/^access-v1:[1-9][0-9]*$/.test(s.policyVersion??'')||!/^[0-9]+$/.test(s.transactionId??''))fail()
      const expiry=Math.min(Date.parse(actor.expiresAt),Date.parse(s.access.expiresAt))
      if(!(expiry>now()))throw new OperationDenied('ACCESS_BASIS_INVALID')
      s.access.expiresAt=new Date(expiry).toISOString()
      const lease=frozen({state:structuredClone(s),serviceId:actor.actorId,userId:s.delegation.subjectUserId,
        organisationId:request.organisationId,operation:'job.execute',resourceId:request.resourceId,
        transactionId:s.transactionId,expiresAt:s.access.expiresAt})
      leases.add(lease);return lease
    },
    verifyScope,
    async claimDispatch(query,lease){
      await verifyScope(query,lease)
      const r=await one(query,'SELECT profitia_jobs.claim_dispatch($1::uuid) AS result',[lease.resourceId]),v=r.result
      if(!v||v.jobId!==lease.resourceId||!['READY','BUSY','CONFIRMED','RECONCILE_REQUIRED'].includes(v.status))fail()
      if(v.status==='READY'&&(!uuid.test(v.leaseId??'')||v.sourceId!==lease.state.delegation.sourceId
        ||v.deliveryKey!==lease.state.delegation.deliveryKey||!(Date.parse(v.expiresAt)>now())
        ||!Number.isInteger(v.attempt)||v.attempt<1||v.attempt>10))fail()
      return frozen(structuredClone(v))
    },
    async prepareDelivery(query,lease,admission,port){
      await verifyScope(query,lease)
      const actual=platformDeliveryEvidence(port),expected=lease.state.delegation.sourceBinding
      if(!actual||!expected||actual.sourceId!==lease.state.delegation.sourceId||actual.environment!==b.environment
        ||Object.keys(expected).some(k=>actual[k]!==expected[k]))throw new OperationDenied('DELEGATION_INVALID')
      if(!admission||admission.status!=='READY'||admission.jobId!==lease.resourceId||admission.requestId!==lease.resourceId
        ||!uuid.test(admission.leaseId??'')||admission.sourceId!==lease.state.delegation.sourceId
        ||admission.deliveryKey!==lease.state.delegation.deliveryKey)throw new OperationDenied('DELEGATION_INVALID')
      const r=await one(query,'SELECT profitia_jobs.delivery_state($1::uuid,$2::uuid) AS result',[lease.resourceId,admission.leaseId])
      if(!r.result||r.result.jobId!==lease.resourceId||!['READY','CONFIRMED'].includes(r.result.status))throw new OperationDenied('DELEGATION_INVALID')
      return frozen(structuredClone(r.result))
    },
    async observeCommitted(query,lease,admission,receipt){
      await verifyScope(query,lease)
      const proof=platformReceiptEvidence(receipt),d=lease.state.delegation
      if(!proof||proof.sourceId!==d.sourceId||proof.environment!==b.environment||!d.sourceBinding
        ||Object.keys(d.sourceBinding).some(k=>proof[k]!==d.sourceBinding[k])||proof.contentDigest!==d.payloadDigest
        ||proof.idempotencyKeyDigest!==createHash('sha256').update(d.deliveryKey).digest('hex')
        ||proof.effectId!==receipt?.effectId||proof.status!=='COMMITTED'
        ||!(Date.parse(proof.verifiedAt)<=now())||Date.parse(proof.verifiedAt)<now()-30000
        ||admission?.jobId!==lease.resourceId||!uuid.test(admission.leaseId??''))throw new OperationDenied('DELIVERY_UNCERTAIN')
      const r=await one(query,'SELECT profitia_jobs.observe_delivery($1::uuid,$2::uuid,$3,$4::uuid,$5,$6) AS result',
        [lease.resourceId,admission.leaseId,d.sourceId,proof.effectId,operationPayloadDigest({sourceId:d.sourceId,effectId:proof.effectId,
          contentDigest:proof.contentDigest,idempotencyKeyDigest:proof.idempotencyKeyDigest}),'COMMITTED'])
      if(!r.result||r.result.jobId!==lease.resourceId||r.result.status!=='CONFIRMED')throw new OperationDenied('DELIVERY_UNCERTAIN')
      return frozen(structuredClone(r.result))
    },
    async appendAudit(query,event,lease){
      if(!event||Object.getPrototypeOf(event)!==Object.prototype||event.applicationId!==b.applicationId
        ||event.environment!==b.environment||!uuid.test(event.decisionId??''))fail()
      if(event.phase==='OUTCOME'){
        if(!lease||event.actorKind!=='SERVICE'||event.actorId!==lease.serviceId||event.subjectUserId!==lease.userId
          ||event.organisationId!==lease.organisationId||event.operation!=='job.execute'||event.resourceId!==lease.resourceId
          ||event.policyVersion!==lease.state.policyVersion)fail()
        await verifyScope(query,lease)
      }else await descriptor(query)
      const encoded=JSON.stringify(event);if(Buffer.byteLength(encoded)>16384)fail()
      // Project a real scalar column: native Prisma cannot deserialize PostgreSQL
      // void. The VOLATILE writer still runs once and must succeed before a row
      // is returned; no adapter fabricates an audit result or skips the writer.
      const result=await one(query,'SELECT true AS recorded FROM profitia_jobs.append_audit($1::jsonb)',[encoded])
      if(result.recorded!==true)fail()
    },
  })
}

export async function delegatedJobSchemaDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL(delegatedJobSchemaUrl))).digest('hex')}
export async function delegatedJobSourceDigest(){const fs=await import('node:fs');return createHash('sha256')
  .update(fs.readFileSync(new URL('./delegated-job.mjs',import.meta.url))).update(fs.readFileSync(new URL('./delegated-job.d.mts',import.meta.url)))
  .update(await delegatedJobSchemaDigest()).update(await platformIngestionSourceDigest()).digest('hex')}
