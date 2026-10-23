import type {PoolClient} from 'pg'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import type {Json,OperationContext} from '@profitia/platform-contracts/operation-context'
import {createPlatformIngestionHost,platformReceiptEvidence} from '@profitia/platform-contracts/platform-ingestion'
import {canonical,sha256,validateCompanySnapshot,validateIdentityEvidence,krs,parseJson} from '@profitia/krs-registry-contracts'
import type {CompanySnapshot,VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {Catalog,storeSnapshot} from './catalog.js'
import {resolveIdentity} from './identity.js'
import {createKrsClient,krsResponseEvidence,buildRequest} from './client.js'
import type {KrsResponse} from './client.js'
import {createAdmittedKrsSource} from './e1.js'
import {normalizeExtract} from './normalizer.js'
import {gusMappingEvidence} from './gus-bir.js'
import type {GusMapping} from './gus-bir.js'

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
    async snapshot(request:unknown,id:string):Promise<CompanySnapshot>{
      return execute(request,selector({action:'SELECTED',krs:id,reference:null}),async()=>{
        const value=await catalog.read(id);if(!value)return deny();return validateCompanySnapshot(value)
      })
    },
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
    if(!proof||proof.source.applicationId!==options.host.application.appId||proof.source.sourceId!==options.acceptedSourceId||proof.source.environment!==options.host.application.environment
      ||proof.rawDigest!==snapshot.source.rawDigest||proof.rawDigest!==await sha256(input.response.bytes)
      ||proof.retrievedAt!==snapshot.source.retrievedAt||proof.url!==buildRequest({operation:snapshot.source.extract==='CURRENT'?'CURRENT':'FULL',krs:snapshot.canonicalKrs,register:snapshot.source.register}).url)return deny()
    const rebuilt=await normalizeExtract(input.response.bytes,{krs:snapshot.canonicalKrs,register:snapshot.source.register,
      extract:snapshot.source.extract,retrievedAt:proof.retrievedAt})
    if(canonical(rebuilt)!==canonical(snapshot))return deny()
    // The validated DTO deliberately uses null-prototype records. Its bounded
    // canonical JSON has the same bytes as Root JSON, without weakening Root's
    // plain-record boundary or changing the admitted snapshot.
    const digest=await sha256(canonical(snapshot))
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


export const NATIVE_KRS_SOURCES=Object.freeze({official:'krs.registry.official',catalog:'krs.registry.catalog',resource:'krs-official:current'})
/** Complete native Source wiring. SQL008/009/012 and its ordinary-role bindings
 * remain installation prerequisites. No fixture network or alternate fetch. */
async function nativeSourceParts(options:{host:Omit<Ingestion,'source'|'validateSharedPayload'>;externalSchemaDigest:string}){
 const sourceHost=createPlatformIngestionHost<PoolClient>({...options.host,
  source:{id:NATIVE_KRS_SOURCES.official,payloadSchema:'external-call-control-v1',qualityVersion:'krs-source-control-v1',classificationVersion:'technical-source-control-v1'},
  validateSharedPayload:value=>!!value&&typeof value==='object'&&!Array.isArray(value)
   &&Object.keys(value).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status',
 })
 const source=await createAdmittedKrsSource<PoolClient>({sourceHost,sourceId:NATIVE_KRS_SOURCES.official,resourceId:NATIVE_KRS_SOURCES.resource,
  binding:{role:options.host.binding.role,configurationVersion:options.host.binding.configurationVersion,schemaDigest:options.externalSchemaDigest,
   origin:'https://api-krs.ms.gov.pl',transport:'HTTPS',pathRules:[{method:'GET',path:'/api/krs/OdpisAktualny'}]},
  independentQuery:options.host.independentQuery,query:async(tx,sql,args)=>({rows:(await tx.query(sql,args)).rows}),now:options.host.now??Date.now,
 })
 const client=createKrsClient({source,externalEnabled:true,maximumCalls:options.host.binding.unmeteredSchemaDigest?null:20,now:options.host.now??Date.now})
 const publication=createNativeCatalogPublication({acceptedSourceId:NATIVE_KRS_SOURCES.official,host:{...options.host,
  source:{id:NATIVE_KRS_SOURCES.catalog,payloadSchema:REGISTRY_REPORT_PROJECTION,qualityVersion:'krs-normalizer/1.0.1',classificationVersion:'krs-public-company-v1'}}})
 return {client,publication}
}

export async function createNativeRegistrySource(options:{host:Omit<Ingestion,'source'|'validateSharedPayload'>;externalSchemaDigest:string;approvedKrs:readonly string[];approvalRef:string}){
 const parts=await nativeSourceParts(options)
 return createOfficialSeed({...parts,approvedKrs:options.approvedKrs,approvalRef:options.approvalRef})
}
/** On-demand acquisition requires process-owned proof of a settled GUS mapping.
 * It is not a numeric scanner, arbitrary KRS endpoint or replacement identity engine. */
export type NativeContinuity=Readonly<{currentEvidenceRef:string;records:readonly Readonly<{snapshot:CompanySnapshot;excerpt:unknown}>[]}>
const continuityProofs=new WeakSet<object>()
/** Copied or serialized evidence cannot substitute for settled native Source. */
export const nativeContinuityEvidence=(value:unknown):value is NativeContinuity=>!!value&&typeof value==='object'&&continuityProofs.has(value)
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const items=(v:unknown):unknown[]=>Array.isArray(v)?v:v==null?[]:[v]
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v}
function formationExcerpt(response:KrsResponse,snapshot:CompanySnapshot){
 const raw=rec(rec(parseJson(new TextDecoder().decode(response.bytes),4*1024*1024)).odpis),section=rec(rec(raw.dane).dzial1)
 const formation=rec(section.sposobPowstaniaPodmiotu),kinds=items(formation.okolicznosciPowstania).map(v=>typeof v==='string'?v:rec(v).okolicznosciPowstania)
 const transformation=kinds.length>0&&kinds.every(v=>v==='PRZEKSZTAŁCENIE')
 const ids=transformation?[...new Set(items(formation.podmioty).flatMap(v=>{const p=rec(v);return [...items(p.krs).map(k=>typeof k==='string'?k:rec(k).krs),...items(p.numerWRejestrzeAlboEwidencji).map(k=>typeof k==='string'?k:rec(k).numerWRejestrzeAlboEwidencji)].filter(krs)}))]:[]
 if(ids.length>1||ids.includes(snapshot.canonicalKrs))return deny()
 const header=rec(raw[snapshot.source.extract==='CURRENT'?'naglowekA':'naglowekP'])
 const entries=items(header.wpis).map(v=>{const e=rec(v);return {numerWpisu:e.numerWpisu,dataWpisu:e.dataWpisu,opis:typeof e.opis==='string'&&e.opis.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().replace(/\s+/g,' ').toUpperCase()==='WYKRESLENIE Z KRAJOWEGO REJESTRU SADOWEGO'?'WYKRESLENIE Z KRAJOWEGO REJESTRU SADOWEGO':''}})
 // Company-only projection for the existing consumer continuity resolver.
 const excerpt={ [snapshot.source.extract==='CURRENT'?'naglowekA':'naglowekP']:{numerKRS:snapshot.canonicalKrs,stanPozycji:header.stanPozycji,dataRejestracjiWKRS:header.dataRejestracjiWKRS,wpis:entries},
  dane:{dzial1:{danePodmiotu:{nazwa:snapshot.source.extract==='CURRENT'?snapshot.officialName:snapshot.names.map(v=>({nazwa:v.name})),formaPrawna:snapshot.source.extract==='CURRENT'?snapshot.legalForm:snapshot.history.legalForms.map(v=>({formaPrawna:v.name})),identyfikatory:{nip:snapshot.nip,regon:snapshot.regon}},
   sposobPowstaniaPodmiotu:{okolicznosciPowstania:transformation?'PRZEKSZTAŁCENIE':'',podmioty:ids.map(id=>({krs:{krs:id}}))}}}}
 return {ids,excerpt}
}
export async function createNativeNipRegistrySource(options:{host:Omit<Ingestion,'source'|'validateSharedPayload'>;externalSchemaDigest:string}){
 const {client,publication}=await nativeSourceParts(options)
 const acquired=new Map<string,{snapshot:CompanySnapshot;response:KrsResponse;history?:Promise<NativeContinuity>}>(),now=options.host.now??Date.now
 return Object.freeze({async acquire(mapping:GusMapping,requestKey:string,signal:AbortSignal){
  const proof=gusMappingEvidence(mapping)
  if(mapping.status!=='MATCH'||!proof||proof.requestKey!==requestKey||proof.nip!==mapping.nip||mapping.register!=='P')return deny()
  signal.throwIfAborted()
  const response=await client.get({operation:'CURRENT',krs:mapping.krs,register:'P'},'krs-nip-'+requestKey)
  signal.throwIfAborted()
  const snapshot=await normalizeExtract(response.bytes,{krs:mapping.krs,register:'P',extract:'CURRENT',retrievedAt:response.retrievedAt})
  if(snapshot.nip!==mapping.nip||snapshot.canonicalKrs!==mapping.krs)return deny()
  // Missing/withheld KRS REGON is not evidence of REGON equality. Valid
  // differing parents/local units remain conflicts; no REGON14 truncation.
  // BIR12OsPrawna proves the legal unit's REGON9, NIP and KRS. KRS can
  // retain REGON9 + five zeroes even when REGON14 passes checksum. Only
  // reconcile that exact suffix after the independent NIP/KRS checks and
  // process-owned GUS proof above. Preserve the original REGON14; never
  // truncate it or equate a different parent/nonzero local-unit suffix.
  if(snapshot.regon!==null&&snapshot.regon!==mapping.regon
    &&snapshot.regon!==mapping.regon+'00000')return deny()
  signal.throwIfAborted()
  const receipt=await publication.publish({snapshot,response},'krs-nip-publication-'+requestKey)
  signal.throwIfAborted()
  for(const [ref,value] of acquired)if(now()-Date.parse(value.snapshot.source.retrievedAt)>300000)acquired.delete(ref)
  if(acquired.size>=100)return deny()
  acquired.set(snapshot.evidenceRef,{snapshot,response});return {snapshot,receipt}
 },async continuity(reference:string,signal:AbortSignal):Promise<NativeContinuity|null>{
  const current=acquired.get(reference)
  if(!current)return null
  if(now()-Date.parse(current.snapshot.source.retrievedAt)>300000)return deny()
  signal.throwIfAborted()
  // Public Source evidence cache, never an account/access decision cache.
  // Consumers must recheck HUMAN authorization before every read/publication.
  return current.history??=(async()=>{
   const records:Array<{snapshot:CompanySnapshot;excerpt:unknown}>=[]
   let value={snapshot:current.snapshot,response:current.response}
   for(;;){
    signal.throwIfAborted()
    const {ids,excerpt}=formationExcerpt(value.response,value.snapshot)
    records.push(freeze({snapshot:value.snapshot,excerpt:JSON.parse(JSON.stringify(excerpt))}))
    if(!ids.length)break
    if(records.length>=5||records.some(r=>r.snapshot.canonicalKrs===ids[0]))return deny()
    const id=ids[0]!,key=await sha256(canonical({reference,krs:id,operation:'FULL'}))
    const response=await client.get({operation:'FULL',krs:id,register:'P'},'krs-continuity-'+key)
    signal.throwIfAborted()
    const snapshot=await normalizeExtract(response.bytes,{krs:id,register:'P',extract:'FULL',retrievedAt:response.retrievedAt})
    const nips=[...new Set(snapshot.identifiers.filter(i=>i.kind==='NIP').map(i=>i.value))]
    if(nips.length!==1||nips[0]!==current.snapshot.nip||snapshot.identifiers.some(i=>i.kind==='NIP'&&!i.valid))return deny()
    await publication.publish({snapshot,response},'krs-continuity-publication-'+key)
    value={snapshot,response}
   }
   const result=Object.freeze({currentEvidenceRef:reference,records:Object.freeze(records)})
   continuityProofs.add(result);return result
  })()
 }})
}
