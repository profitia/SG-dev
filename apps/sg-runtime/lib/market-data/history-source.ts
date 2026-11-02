import {createHmac,createHash} from 'node:crypto'
import type {Prisma,PrismaClient} from '@prisma/client'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createExternalCallHost,externalNativeResponse,externalCallEvidence,ExternalCallUnavailable,type NativePathRule} from '@profitia/platform-contracts/external-call'
import {discoveryQuery} from '@/lib/benchmark/discovery-host'
import {HISTORY_MAX_BYTES,MARKET_HISTORY_APPLICATION,seriesName,validateProviderHistory} from './history-contract'

type Root=Parameters<typeof createPlatformIngestionHost<Prisma.TransactionClient>>[0]
export type HistorySourceKind='TOKEN'|'API'
const origins={TOKEN:'https://apiauth.macrobondfinancial.com',API:'https://api.macrobondfinancial.com'} as const
const refuse=():never=>{throw new ExternalCallUnavailable('NOT_SENT')}
export function historySourcePolicy(kind:HistorySourceKind){
 if(!Object.hasOwn(origins,kind))return refuse()
 const pathRules:NativePathRule[]=kind==='TOKEN'?[{method:'POST',path:'/mbauth/connect/token',requestFormat:'FORM'}]
  :[{method:'POST',path:'/v1/series/fetchseries',requestFormat:'JSON'},{method:'POST',path:'/v1/series/fetchentities',requestFormat:'JSON'}]
 return {source:{id:'sg2.market.history.'+kind.toLowerCase(),payloadSchema:'external-call-control-v1',qualityVersion:'sg2-source-control-v1',classificationVersion:'technical-source-control-v1'},resourceId:'sg2-market-history:'+kind.toLowerCase(),origin:origins[kind],pathRules,basePathRules:pathRules.map(r=>({method:r.method,path:'path'in r?r.path:refuse()})),credentialMode:kind==='TOKEN'?'NONE' as const:'SERVER_HEADERS' as const}
}
export type HistorySourceOptions={application:Root['application'];binding:Root['binding'];prisma:PrismaClient;auditPrisma:PrismaClient;external:{configurationVersion:string;schemaDigest:string;nativeSchemaDigest:string};seriesId:string;operationKey:string;credentials:{clientId:string;clientSecret:string};syntheticOrigin?:string;now?:()=>number}
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===Object.keys(v).length&&Object.keys(v).sort().join(',')===keys&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const plainInit=(value:unknown):boolean=>!!value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===Object.keys(value).length&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d&&d.enumerable)
/** A dedicated receiver of the EXISTING native Source engine. The original
 * Macrobond client still owns OAuth, decoding and history formatting. Finder is unchanged. */
export function createHistorySourceTransport(options:HistorySourceOptions){
 const {prisma,auditPrisma,now=Date.now}=options,id=seriesName.parse(options.seriesId)
 if(typeof window!=='undefined'||prisma===auditPrisma||options.application.appId!==MARKET_HISTORY_APPLICATION||options.binding.applicationId!==MARKET_HISTORY_APPLICATION
  ||!options.binding.unmeteredSchemaDigest||!/^[a-f0-9]{64}$/.test(options.operationKey)||!exact(options.credentials,'clientId,clientSecret')
  ||Object.values(options.credentials).some(v=>typeof v!=='string'||!v||v!==v.trim()||/[\r\n\0]/.test(v)))return refuse()
 const fixed=structuredClone({application:options.application,binding:options.binding,external:options.external,credentials:options.credentials,operationKey:options.operationKey,syntheticOrigin:options.syntheticOrigin})
 if(fixed.syntheticOrigin!==undefined){const u=new URL(fixed.syntheticOrigin);if(fixed.application.environment!=='development'||u.origin!==fixed.syntheticOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port)return refuse()}
 const tokens=new Set<string>(),ordinals=new Map<HistorySourceKind,number>();let failed=false
 let metadata:Record<string,unknown>={},acquired:{callId:string;responseSha256:string;rawCount:number}|null=null
 const macrobond:typeof fetch=async(input,init={})=>{
  try{
   if(failed||!(typeof input==='string'||input instanceof URL)||!plainInit(init)||Object.keys(init).some(k=>!['method','headers','body','signal','cache','redirect'].includes(k))
    ||init.method!=='POST'||init.redirect!==undefined&&!['manual','error'].includes(init.redirect)||init.cache!==undefined&&init.cache!=='no-store'
    ||typeof init.body!=='string'&&!(init.body instanceof URLSearchParams))return refuse()
   const u=new URL(String(input)),kind:HistorySourceKind=u.origin===origins.TOKEN?'TOKEN':'API',policy=historySourcePolicy(kind)
   if(u.origin!==policy.origin||u.username||u.password||u.search||u.hash||!policy.pathRules.some(r=>'path'in r&&r.path===u.pathname))return refuse()
   const headers=new Headers(init.headers);for(const[k,v]of headers)if(!['authorization','accept','content-type'].includes(k)||v.length>8192||/[\r\n\0]/.test(v))return refuse()
   if(kind==='TOKEN'){
    if(headers.has('authorization')||String(init.body)!==new URLSearchParams({grant_type:'client_credentials',client_id:fixed.credentials.clientId,client_secret:fixed.credentials.clientSecret}).toString())return refuse()
   }else{
    if(!headers.get('authorization')?.startsWith('Bearer ')||!tokens.has(headers.get('authorization')!.slice(7)))return refuse()
    let body:unknown;try{body=JSON.parse(String(init.body))}catch{return refuse()}
    if(!Array.isArray(body)||body.length!==1||!exact(body[0],u.pathname.endsWith('fetchseries')?'dateEndOfPeriod,name':'name')||body[0].name!==id||u.pathname.endsWith('fetchseries')&&body[0].dateEndOfPeriod!==true)return refuse()
   }
   const ordinal=ordinals.get(kind)??0;ordinals.set(kind,ordinal+1)
   const sourceHost=createPlatformIngestionHost<Prisma.TransactionClient>({application:fixed.application,binding:fixed.binding,source:policy.source,now,independentQuery:discoveryQuery(auditPrisma),transact:(work,limits)=>prisma.$transaction(tx=>work({query:discoveryQuery(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),validateSharedPayload:v=>exact(v,'action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status')})
   const origin=fixed.syntheticOrigin??policy.origin,native={schemaDigest:fixed.external.nativeSchemaDigest,pathRules:policy.pathRules,redirectOrigins:[],maximumResponseBytes:HISTORY_MAX_BYTES,completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT' as const}
   const credential=kind==='TOKEN'?{nativeTransport:{...native,credentialMode:'NONE' as const}}:{nativeTransport:{...native,credentialMode:'SERVER_HEADERS' as const},getHeaders:()=>({authorization:headers.get('authorization')!})}
   const host=createExternalCallHost<Prisma.TransactionClient,{url:string;method:'POST';body:string}>({sourceHost,sourceId:policy.source.id,resourceId:policy.resourceId,now,binding:{role:fixed.binding.role,configurationVersion:fixed.external.configurationVersion,schemaDigest:fixed.external.schemaDigest,origin,transport:fixed.syntheticOrigin?'LOCAL_SYNTHETIC_HTTP':'HTTPS',pathRules:policy.basePathRules},...credential,independentQuery:discoveryQuery(auditPrisma),query:(tx,sql,values)=>discoveryQuery(tx)(sql,values),parseCommand:v=>v as {url:string;method:'POST';body:string},buildRequest:c=>({method:c.method,url:origin+new URL(c.url).pathname,body:c.body})})
   const intentKey=createHmac('sha256',Buffer.from(fixed.operationKey,'hex')).update(JSON.stringify({seriesId:id,kind,ordinal})).digest('hex')
   const nativeResult=await host.execute({command:{url:u.href,method:'POST',body:String(init.body)},intentKey},{signal:init.signal??undefined}),response=externalNativeResponse(nativeResult)
   if(response.ok){
    const raw=await response.clone().text(),body=JSON.parse(raw)
    if(kind==='TOKEN'){if(typeof body.access_token!=='string'||!body.access_token||body.access_token.length>8192||/\s/.test(body.access_token))return refuse();tokens.add(body.access_token)}
    else if(u.pathname.endsWith('fetchseries')){const row=validateProviderHistory(body,id,now());metadata={...metadata,...row.metadata};const proof=externalCallEvidence(nativeResult);if(!proof)return refuse();acquired={callId:proof.callId,responseSha256:createHash('sha256').update(raw).digest('hex'),rawCount:row.dates.length}}
    else{if(!Array.isArray(body)||body.length!==1||body[0]?.errorCode||body[0]?.metadata?.Name!==id)return refuse();metadata={...metadata,...body[0].metadata}}
   }
   return response
  }catch(error){failed=true;throw error}
 }
 return Object.freeze({macrobond,openai:(async()=>refuse()) as typeof fetch,loadMetadataClient:async()=>refuse(),evidence:()=>{if(failed||!acquired)return refuse();return structuredClone({metadata,...acquired})}})
}
