import type {PoolClient} from 'pg'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import type {Json,OperationContext} from '@profitia/platform-contracts/operation-context'
import {createPlatformIngestionHost,platformReceiptEvidence} from '@profitia/platform-contracts/platform-ingestion'
import {canonical,sha256,validateCompanySnapshot,validateIdentityEvidence,krs} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot,VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {Catalog,storeSnapshot} from './catalog.js'
import {resolveIdentity} from './identity.js'
import {createKrsClient,krsResponseEvidence,buildRequest} from './client.js'
import type {KrsResponse} from './client.js'
import {normalizeExtract} from './normalizer.js'

export const REGISTRY_REPORT_PROJECTION='profitia.krs-report-projection/1.0.0'
const deny=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
type Host=Parameters<typeof createPrivateOperationHost<PoolClient>>[0]
type Ingestion=Parameters<typeof createPlatformIngestionHost<PoolClient>>[0]
type Selector={action:'SEARCH';query:string;limit:10}|{action:'SELECTED';krs:string;reference:string|null}
export type AcceptedCompany={snapshot:CompanySnapshot;identity:VerifiedIdentityV1}

function selector(input:unknown):Selector{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype)return deny()
  const v=input as Record<string,unknown>
  if(v.action==='SEARCH'&&Object.keys(v).sort().join(',')==='action,limit,query'
    &&typeof v.query==='string'&&v.query===v.query.trim()&&v.query.length>=2&&v.query.length<=150&&v.limit===10)return v as Selector
  if(v.action==='SELECTED'&&Object.keys(v).sort().join(',')==='action,krs,reference'&&krs(v.krs)
    &&(v.reference===null||typeof v.reference==='string'&&new RegExp('^KRS:'+v.krs+':[a-f0-9]{64}$').test(v.reference)))return v as Selector
  return deny()
}
const resourceId=(value:Selector)=>value.action==='SEARCH'?'supplier-report:KRS:catalog':'supplier-report:KRS:'+value.krs

/** Existing AM21, limited to the canonical registry-report projection. The
 * accepted private host still resolves real identity/access/product/module and
 * audits INTENT/OUTCOME. This module issues no identity, grant or permission. */
export function createNativeRegistryAccess(options:{
  host:Omit<Host,'readResources'|'projectOutput'>;catalog:Catalog;organisationId:string;now?:()=>number
}){
  const {catalog}=options,now=options.now??Date.now,organisationId=options.organisationId
  if(options.host.application.environment!=='development'||!options.host.module
    ||options.host.module.id!=='supplier_report'||!options.host.application.operations.includes('supplier.report.read')
    ||!organisationId||organisationId.length>128)return deny()
  const observe=async(s:Selector)=>{
    if(s.action==='SEARCH'){
      const generation=(await catalog.pool.query('SELECT generation::text FROM krs_registry.metadata')).rows[0]?.generation
      if(typeof generation!=='string'||!/^\d+$/.test(generation))return deny()
      return 'catalog:'+generation
    }
    const snapshot=await catalog.read(s.krs)
    if(!snapshot||s.reference!==null&&snapshot.evidenceRef!==s.reference)return deny()
    await validateCompanySnapshot(snapshot)
    return snapshot.evidenceRef
  }
  const host=createPrivateOperationHost<PoolClient>({...options.host,
    readResources:async({actor,request})=>{
      if(actor.kind!=='HUMAN'||request.operation!=='supplier.report.read'||request.organisationId!==organisationId)return deny()
      const s=selector(request.payload)
      if(request.resourceId!==resourceId(s))return deny()
      return {resource:{id:resourceId(s),type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',
        ownerOrganisationId:null,ownerUserId:null,version:await observe(s),projectionVersion:REGISTRY_REPORT_PROJECTION,approvedSharedProjection:true}}
    },
    projectOutput:async(value,context)=>{
      const s=selector(context.payload)
      if(context.resource.projectionVersion!==REGISTRY_REPORT_PROJECTION||context.resource.version!==await observe(s))return deny()
      // Only the fixed domain methods below can supply output, never an HTTP callback.
      if(Buffer.byteLength(JSON.stringify(value))>1024*1024)return deny()
      return value
    },
  })
  async function execute<T>(request:unknown,s:Selector,read:()=>Promise<T>):Promise<T>{
    const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
      operation:'supplier.report.read',organisationId,resourceId:resourceId(s),payload:s as unknown as Json,request},read)
    return result.value as T
  }
  async function selected(request:unknown,id:string,reference:string|null=null):Promise<AcceptedCompany>{
    return execute(request,selector({action:'SELECTED',krs:id,reference}),async()=>{
      const snapshot=await catalog.read(id)
      if(!snapshot||reference!==null&&snapshot.evidenceRef!==reference)return deny()
      const identity=await resolveIdentity({selectedKrs:id},catalog,now())
      if(identity.status!=='VERIFIED')return deny()
      await validateCompanySnapshot(snapshot);await validateIdentityEvidence(identity,now())
      if(snapshot.evidenceRef!==identity.evidenceRef)return deny()
      return {snapshot,identity}
    })
  }
  return Object.freeze({
    async search(request:unknown,query:string){
      const s=selector({action:'SEARCH',query:query.trim(),limit:10})
      if(s.action!=='SEARCH')return deny()
      return execute(request,s,()=>catalog.search({query:s.query,limit:10}))
    },
    selected,
    async accepted(request:unknown,reference:string){
      const match=/^KRS:([0-9]{10}):[a-f0-9]{64}$/.exec(reference)
      if(!match)return deny();return selected(request,match[1]!,reference)
    },
  })
}

/** Source and catalog use one existing native ingestion transaction. A real
 * receipt is returned only after the domain write and canonical OUTCOME commit. */
export function createNativeCatalogPublication(options:{host:Omit<Ingestion,'validateSharedPayload'>;acceptedSourceId:string}){
  const pending=new Map<string,CompanySnapshot>()
  const host=createPlatformIngestionHost<PoolClient>({...options.host,
    validateSharedPayload:async(payload)=>{
      if(!payload||typeof payload!=='object'||Array.isArray(payload))return false
      const v=payload as Record<string,Json>,snapshot=pending.get(String(v.digest))
      return Object.keys(v).sort().join(',')==='digest,evidenceRef,krs,version'&&v.version===REGISTRY_REPORT_PROJECTION
        &&!!snapshot&&snapshot.evidenceRef===v.evidenceRef&&snapshot.canonicalKrs===v.krs
    },
  })
  return Object.freeze({async publish(input:{snapshot:unknown;response:KrsResponse},intentKey:string){
    const snapshot=await validateCompanySnapshot(input.snapshot),proof=krsResponseEvidence(input.response)
    if(!proof||proof.source.sourceId!==options.acceptedSourceId||proof.source.environment!==options.host.application.environment
      ||proof.rawDigest!==snapshot.source.rawDigest||proof.rawDigest!==await sha256(input.response.bytes)
      ||proof.retrievedAt!==snapshot.source.retrievedAt||proof.url!==buildRequest({operation:snapshot.source.extract==='CURRENT'?'CURRENT':'FULL',krs:snapshot.canonicalKrs,register:snapshot.source.register}).url)return deny()
    const rebuilt=await normalizeExtract(input.response.bytes,{krs:snapshot.canonicalKrs,register:snapshot.source.register,
      extract:snapshot.source.extract,retrievedAt:proof.retrievedAt})
    if(canonical(rebuilt)!==canonical(snapshot))return deny()
    const digest=operationPayloadDigest(snapshot as unknown as Json)
    const manifest={version:REGISTRY_REPORT_PROJECTION,krs:snapshot.canonicalKrs,evidenceRef:snapshot.evidenceRef,digest}
    if(pending.has(digest))throw new OperationDenied('POLICY_UNAVAILABLE')
    pending.set(digest,snapshot)
    try{
      const result=await host.ingest({resourceId:'krs-catalog:'+snapshot.canonicalKrs,payload:manifest,idempotencyKey:intentKey},async(_payload,tx,context:Readonly<OperationContext>)=>{
        const effect=context.platformReservation?.effectId;if(!effect)return deny()
        await storeSnapshot(tx,snapshot,effect)
      })
      const evidence=platformReceiptEvidence(result.value)
      if(!evidence||evidence.contentDigest!==operationPayloadDigest(manifest))return deny()
      return Object.freeze({evidenceRef:snapshot.evidenceRef,effectRef:evidence.effectId})
    }finally{pending.delete(digest)}
  }})
}

/** Finite explicit official records only, no numeric enumeration or schedule.
 * The supplied client is the existing admitted KRS Source client, not fetch. */
export function createOfficialSeed(options:{client:ReturnType<typeof createKrsClient>;publication:ReturnType<typeof createNativeCatalogPublication>;approvedKrs:readonly string[];approvalRef:string}){
  const ids=Object.freeze([...options.approvedKrs])
  if(!options.approvalRef||ids.length<1||ids.length>10||new Set(ids).size!==ids.length||!ids.every(krs))return deny()
  return Object.freeze({async acquire(id:string,register:'P'|'S',runReference:string){
    if(!ids.includes(id)||!['P','S'].includes(register)||!runReference||runReference.length>128)return deny()
    const key=await sha256(canonical({approval:options.approvalRef,krs:id,register,run:runReference}))
    const response=await options.client.get({operation:'CURRENT',krs:id,register},'krs-source-'+key)
    const snapshot=await normalizeExtract(response.bytes,{krs:id,register,extract:'CURRENT',retrievedAt:response.retrievedAt})
    const receipt=await options.publication.publish({snapshot,response},'krs-publication-'+key)
    return {snapshot,receipt}
  }})
}
