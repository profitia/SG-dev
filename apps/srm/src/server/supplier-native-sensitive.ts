import {OperationDenied,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {ExternalCallUnavailable} from '@profitia/platform-contracts/external-call'
import {platformDeliveryEvidence} from '@profitia/platform-contracts/platform-ingestion'
import {isRestrictedRegistrationStatus,type SectionEnvelope,type JdgRegistryData} from '@profitia/srm-xray'
import {createSrmSupplierNativeWork,type SupplierNativeWorkOptions,type SupplierNativeWorkSelection} from './supplier-request-work'
import {createSrmSensitiveNativeStore} from './supplier-native-sensitive-store'
import {createSrmSupplierSourceLink} from './supplier-source-link'
import type {createSrmSupplierSourceRequest} from './supplier-source-request'
import {createSrmProviderSourceTransport,guardOriginalProviderCall} from './provider-source-transport'
import {createJdgLookup,type JdgLookupPorts} from './jdg-lookup'
import {createXrayKysLookup,type XrayKysPorts} from './xray-lookup'
import {fetchCeidgJdg} from './integrations/ceidg'
import {fetchVerclyKys} from './vercly-kys'
import {getOrFetchKys,type KysEntityType,type KysSection} from './kys-cache'
import {readSupplierRequest} from './supplier-request-operation'

type ProviderOptions=Omit<Parameters<typeof createSrmProviderSourceTransport>[0],'provider'|'providerOrigin'|'nip'|'operationKey'|'headers'>
type Options=Readonly<{work:SupplierNativeWorkOptions;namedInterestBoundaryDigest:string;source:ReturnType<typeof createSrmSupplierSourceRequest>;
 entityType:KysEntityType;section:'jdg'|'kys';provider:{apiKey:string;origin:string;source:ProviderOptions}}>
export const SENSITIVE_NATIVE_COMPOSITION_VERSION='srm-native-sensitive-v1'
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const codes=(warnings:readonly string[])=>warnings.filter(v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(v))
/** Private bodies stay in the private store. A separate current HUMAN read is
 * mandatory before an HTTP adapter can deliver even a cached personal report. */
export type SensitiveLookupOutcome=Readonly<{snapshotId:string|null;status:string;warningCodes:readonly string[];replayed:boolean}>
export function createSrmNativeSensitiveLookup(options:Options){
 if(typeof window!=='undefined'||!options||Object.keys(options).sort().join(',')!=='entityType,namedInterestBoundaryDigest,provider,section,source,work'
  ||!['kys','jdg'].includes(options.section)||!['COMPANY','JDG'].includes(options.entityType)
  ||options.section==='jdg'&&options.entityType!=='JDG'||!options.provider?.apiKey?.trim())return refuse()
 if(options.work.privateAcquisition&&(options.work.privateAcquisition.entityType!==options.entityType
  ||options.work.privateAcquisition.section!==options.section||options.work.job.targetOperation!=='supplier.private.refresh'))return refuse()
 const evidence=platformDeliveryEvidence(options.source?.port)
 if(!evidence||['applicationId','environment','projectId','branchId','databaseName','schemaDigest'].some(k=>
  options.provider.source.binding[k as keyof ProviderOptions['binding']]!==evidence[k as keyof typeof evidence]))return refuse()
 let origin:URL;try{origin=new URL(options.provider.origin)}catch{return refuse()}
 if(origin.protocol!=='https:'||origin.origin!==options.provider.origin||origin.username||origin.password
  ||options.section==='jdg'&&origin.origin!=='https://dane.biznes.gov.pl'
  ||options.work.application.environment!==options.provider.source.application.environment)return refuse()
 const section=options.section,entityType=options.entityType,apiKey=options.provider.apiKey.trim(),providerOrigin=origin.origin
 const work=createSrmSupplierNativeWork(options.work),store=createSrmSensitiveNativeStore({work,entityType,section})
 const link=createSrmSupplierSourceLink({work:options.work,namedInterestBoundaryDigest:options.namedInterestBoundaryDigest,source:options.source,
  registration:{unitId:'SRM_SENSITIVE_REGISTER',run:(current,s)=>createSrmSensitiveNativeStore({work:current,entityType,section}).register(s)}})
 const {pool,auditPool,now}=options.provider.source
 const fixed=structuredClone({application:options.provider.source.application,binding:options.provider.source.binding,
  external:options.provider.source.external,syntheticOrigin:options.provider.source.syntheticOrigin})
 const clock=now?()=>new Date(now()):()=>new Date()
 return Object.freeze({async run(input:SupplierNativeWorkSelection,signal?:AbortSignal):Promise<SensitiveLookupOutcome>{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==3
   ||Object.keys(input).sort().join(',')!=='command,organisationId,requestId'
   ||Object.values(Object.getOwnPropertyDescriptors(input)).some(d=>!('value'in d)||!d.enumerable))return refuse()
  const selected=Object.freeze({...input,command:Object.freeze(readSupplierRequest(input.command))})
  signal?.throwIfAborted()
  const previous=await store.replay(selected)
  if(previous){
   if(section==='kys'&&isRestrictedRegistrationStatus(await store.status(selected)))return Object.freeze({snapshotId:null,status:'EMPTY',warningCodes:[],replayed:true})
   return Object.freeze({snapshotId:previous.snapshotId,status:previous.envelope?.status??(previous.status==='NO_DATA'?'EMPTY':'ERROR'),
    warningCodes:previous.envelope?codes(previous.envelope.warnings):[],replayed:true})
  }
  let lookup:Readonly<{supplierId:string;requestId:string}>|undefined,operationKey:string|undefined,snapshotId:string|null=null
  let jdgEnvelope:SectionEnvelope<JdgRegistryData>|undefined,transport:ReturnType<typeof createSrmProviderSourceTransport>|undefined
  const scope=(org:string,nip:string)=>{if(org!==selected.organisationId||nip!==selected.command.nip)return refuse()}
  const register=async(org:string,nip:string)=>{
   scope(org,nip);if(lookup)return refuse()
   const admitted=await link.registerAndAdmit(selected)
   if(admitted.sourceStatus!=='CONFIRMED'||!admitted.sourceRequest)throw new OperationDenied('DELIVERY_UNCERTAIN')
   if(admitted.lookup.requestId!==selected.requestId)return refuse();lookup=Object.freeze(admitted.lookup)
   operationKey=operationPayloadDigest({version:SENSITIVE_NATIVE_COMPOSITION_VERSION,section,entityType,nip,sourceEffectId:admitted.sourceRequest.effectId})
   return lookup
  }
  const sourceTransport=()=>{
   if(!lookup||!operationKey)return refuse()
   return transport??=createSrmProviderSourceTransport({provider:section==='jdg'?'CEIDG':'VERCLY',providerOrigin,nip:selected.command.nip,operationKey,
    application:fixed.application,binding:fixed.binding,external:fixed.external,syntheticOrigin:fixed.syntheticOrigin,pool,auditPool,now,
    headers:section==='jdg'?{authorization:'Bearer '+apiKey,accept:'application/json'}:{authorization:'Bearer '+apiKey,'content-type':'application/json'}})
  }
  if(section==='jdg'){
   const ports:JdgLookupPorts={
    createLookup:async(org,identifier,actualEntity)=>{if(identifier.type!=='NIP'||actualEntity!=='JDG')return refuse();return register(org,identifier.value)},
    startAttempt:async(org,request,actualSection)=>{scope(org,selected.command.nip);if(request!==selected.requestId||actualSection!=='jdg')return refuse();return store.startJdg(selected)},
    fetchCeidgJdg:async nip=>{scope(selected.organisationId,nip);const result=await guardOriginalProviderCall(sourceTransport().fetcher,fetcher=>fetchCeidgJdg(nip,{token:apiKey,fetcher,url:'https://dane.biznes.gov.pl/api/ceidg/v3/firma'}));jdgEnvelope=structuredClone(result.section);return result},
    appendSnapshot:async(org,value)=>{scope(org,selected.command.nip);if(!lookup||value.supplierId!==lookup.supplierId)return refuse();snapshotId=await store.snapshotJdg(selected,value);return snapshotId},
    appendSectionProjection:async(org,value)=>{scope(org,selected.command.nip);if(!jdgEnvelope||value.snapshotId!==snapshotId)return refuse();return store.projectJdg(selected,value,jdgEnvelope)},
    finishAttempt:async(org,attempt,status,details)=>{scope(org,selected.command.nip);return store.finishJdg(selected,attempt,status,details??{})},
   }
   try{const result=await createJdgLookup(ports)(selected.organisationId,selected.command.nip)
    return Object.freeze({snapshotId,status:result.status,warningCodes:Object.freeze(codes(result.warnings)),replayed:false})
   }finally{jdgEnvelope=undefined}
  }
  const cache=store.cache(selected);let purge:Promise<void>|undefined
  const purgeOnce=(org:string)=>{scope(org,selected.command.nip);return purge??=store.purge(selected)}
  const ports:XrayKysPorts={
   readSupplierRegistrationStatus:async(org,nip,entity)=>{scope(org,nip);if(entity!==entityType)return refuse();return store.status(selected)},
   purgeExpiredKysPersonal:purgeOnce,purgeExpiredSharedKys:purgeOnce,
   createLookup:async(org,identifier,entity)=>{if(identifier.type!=='NIP'||entity!==entityType)return refuse();return register(org,identifier.value)},
   getOrFetchKys:async(org,nip,entity,fetchReport,persist,args)=>{
    scope(org,nip);if(entity!==entityType||!args||Object.keys(args).some(k=>k!=='signal'))return refuse()
    return getOrFetchKys(org,nip,entity,fetchReport,persist,{signal:args.signal,store:cache.store,now:clock})
   },
   fetchVerclyKys:async(request,args)=>{
    scope(selected.organisationId,request.identifier.value)
    if(request.identifier.type!=='NIP'||!args||Object.keys(args).some(k=>k!=='signal'))return refuse()
    if(args.signal?.aborted){await cache.releaseUnsent();throw new ExternalCallUnavailable('NOT_SENT')}
    // Commit the existing uncertainty fence BEFORE the first possible paid POST.
    // Native renewal preserves it until a successful cache save clears the lease.
    await cache.arm();let invoked=false
    try{
     if(args.signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
     const fetcher:typeof fetch=(...values)=>{invoked=true;return sourceTransport().fetcher(...values)}
     const result=await guardOriginalProviderCall(fetcher,guarded=>fetchVerclyKys(request,{apiKey,baseUrl:providerOrigin,fetcher:guarded,signal:args.signal,now:clock}))
     if(!invoked&&args.signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
     return result
    }catch(error){
     if(error instanceof ExternalCallUnavailable&&error.certainty==='NOT_SENT')await cache.releaseUnsent().catch(()=>{})
     throw error
    }
   },
   persistSection:async(org,actual,actualSection,envelope,errorCode,facts,correlation,payload,method)=>{
    scope(org,selected.command.nip)
    if(!lookup||actual.requestId!==lookup.requestId||actual.supplierId!==lookup.supplierId||actualSection!=='kys'
     ||facts?.length||payload!==undefined)return refuse()
    snapshotId=await store.storeKys(selected,actual,envelope as KysSection,errorCode,correlation??null,method??'PROVIDER')
    return snapshotId
   },
  }
  const result=await createXrayKysLookup(ports)(selected.organisationId,{identifier:{type:'NIP',value:selected.command.nip}},entityType,signal)
  return Object.freeze({snapshotId:result.snapshotId,status:result.section.status,warningCodes:Object.freeze(codes(result.section.warnings)),replayed:false})
 }})
}
