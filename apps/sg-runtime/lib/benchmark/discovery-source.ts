import {createHmac} from 'node:crypto'
import type {Prisma,PrismaClient} from '@prisma/client'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createExternalCallHost,externalNativeResponse,ExternalCallUnavailable,type NativePathRule} from '@profitia/platform-contracts/external-call'
import {discoveryQuery} from './discovery-host'
type Root=Parameters<typeof createPlatformIngestionHost<Prisma.TransactionClient>>[0]
export type FinderSource='MACROBOND_TOKEN'|'MACROBOND_API'|'OPENAI'
const origins={MACROBOND_TOKEN:'https://apiauth.macrobondfinancial.com',MACROBOND_API:'https://api.macrobondfinancial.com',OPENAI:'https://api.openai.com'} as const
const postPaths=['/v1/series/fetchentities','/v1/search/entities','/v1/search/entitiesfordisplay']
const getPaths=['/v1/metadata/getattributeinformation','/v1/metadata/listattributevalues']
const refuse=():never=>{throw new ExternalCallUnavailable('NOT_SENT')}
export function finderSourcePolicy(provider:FinderSource){
 if(!Object.hasOwn(origins,provider))throw TypeError('Explicit Finder source required')
 const pathRules:NativePathRule[]=provider==='MACROBOND_TOKEN'?[{method:'POST',path:'/mbauth/connect/token',requestFormat:'FORM'}]
  :provider==='OPENAI'?[{method:'POST',path:'/v1/responses',requestFormat:'JSON'}]
  :[...postPaths.map(path=>({method:'POST' as const,path,requestFormat:'JSON' as const})),...getPaths.map(path=>({method:'GET' as const,path,requestFormat:'NONE' as const}))]
 return Object.freeze({source:{id:'sg2.provider.'+provider.toLowerCase(),payloadSchema:'external-call-control-v1',qualityVersion:'sg2-source-control-v1',classificationVersion:'technical-source-control-v1'},
  resourceId:'sg2-provider:'+provider.toLowerCase(),origin:origins[provider],pathRules,
  basePathRules:pathRules.map(r=>({method:r.method,path:'path'in r?r.path:refuse()})),credentialMode:provider==='MACROBOND_TOKEN'?'NONE' as const:'SERVER_HEADERS' as const})
}
export type FinderSourceOptions={application:Root['application'];binding:Root['binding'];prisma:PrismaClient;auditPrisma:PrismaClient;
 external:{configurationVersion:string;schemaDigest:string;nativeSchemaDigest:string};operationKey:string;
 credentials:{macrobondClientId:string|null;macrobondClientSecret:string|null;openAiKey:string|null;openAiModel:string};syntheticOrigin?:string;now?:()=>number}
type Command={url:string;method:'GET'|'POST';body:string|null}
const exact=(value:unknown,keys:string):value is Record<string,unknown>=>!!value&&Object.getPrototypeOf(value)===Object.prototype
 &&Reflect.ownKeys(value).length===Object.keys(value).length&&Object.keys(value).sort().join(',')===keys
 &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d&&d.enumerable)

/** Original clients supply their ordinary native requests; only this closed
 * adapter selects source policy/credentials. The shared host is the sole send,
 * effect control writer and independent Source audit/budget authority. */
export function createFinderSourceTransport(options:FinderSourceOptions){
 const optionKeys=['application','auditPrisma','binding','credentials','external','now','operationKey','prisma','syntheticOrigin']
 if(typeof window!=='undefined'||!options||Object.getPrototypeOf(options)!==Object.prototype
  ||Reflect.ownKeys(options).length!==Object.keys(options).length||Object.keys(options).some(k=>!optionKeys.includes(k))
  ||Object.values(Object.getOwnPropertyDescriptors(options)).some(d=>!('value'in d)||!d.enumerable)
  ||!options.prisma||!options.auditPrisma||options.prisma===options.auditPrisma||!/^[a-f0-9]{64}$/.test(options.operationKey)
  ||options.application.appId!=='spendguru-benchmark-source'||options.binding.applicationId!==options.application.appId
  ||!exact(options.credentials,'macrobondClientId,macrobondClientSecret,openAiKey,openAiModel')
  ||Object.values(options.credentials).some(v=>v!==null&&(typeof v!=='string'||!v.trim()||v.length>8192||/[\r\n\0]/.test(v)))
  ||typeof options.credentials.openAiModel!=='string'
  ||(options.credentials.macrobondClientId===null)!==(options.credentials.macrobondClientSecret===null))throw TypeError('Explicit server-owned Finder Source binding required')
 const {prisma,auditPrisma,now=Date.now}=options
 const fixed=structuredClone({application:options.application,binding:options.binding,external:options.external,
  credentials:options.credentials,operationKey:options.operationKey,syntheticOrigin:options.syntheticOrigin})
 if(!exact(fixed.external,'configurationVersion,nativeSchemaDigest,schemaDigest')
  ||!['schemaDigest','nativeSchemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(fixed.external[k as 'schemaDigest'|'nativeSchemaDigest']))
  ||!fixed.external.configurationVersion||fixed.external.configurationVersion.length>128)throw TypeError('Explicit accepted native external installation required')
 if(fixed.syntheticOrigin!==undefined){
  let u:URL;try{u=new URL(fixed.syntheticOrigin)}catch{throw TypeError('Development fixture origin required')}
  if(fixed.application.environment!=='development'||u.origin!==fixed.syntheticOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port)throw TypeError('Development fixture origin required')
 }
 const knownTokens=new Set<string>(),ordinals=new Map<FinderSource,number>();let failed=false
 const sourceHosts=new Map<FinderSource,ReturnType<typeof createPlatformIngestionHost<Prisma.TransactionClient>>>()
 const sourceHost=(provider:FinderSource)=>{
  let host=sourceHosts.get(provider);if(host)return host
  host=createPlatformIngestionHost<Prisma.TransactionClient>({application:fixed.application,binding:fixed.binding,source:finderSourcePolicy(provider).source,now,
   independentQuery:discoveryQuery(auditPrisma),transact:(work,limits)=>prisma.$transaction(tx=>work({query:discoveryQuery(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
   validateSharedPayload:v=>exact(v,'action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status')})
  sourceHosts.set(provider,host);return host
 }
 function parse(provider:FinderSource,value:unknown):Command{
  if(!exact(value,'body,method,url'))return refuse()
  const c=value as unknown as Command
  if(typeof c.url!=='string'||c.url.length>8192||!['GET','POST'].includes(c.method)||!(c.body===null||typeof c.body==='string')
   ||c.method==='GET'&&c.body!==null||Buffer.byteLength(c.body??'')>65536)return refuse()
  let u:URL;try{u=new URL(c.url)}catch{return refuse()}
  if(u.origin!==origins[provider]||u.href!==c.url||u.username||u.password||u.hash)return refuse()
  if(provider==='MACROBOND_TOKEN'){
   if(!fixed.credentials.macrobondClientId||!fixed.credentials.macrobondClientSecret)return refuse()
   const expected=new URLSearchParams({grant_type:'client_credentials',client_id:fixed.credentials.macrobondClientId,client_secret:fixed.credentials.macrobondClientSecret})
   if(c.method!=='POST'||u.pathname!=='/mbauth/connect/token'||u.search||c.body!==expected.toString())return refuse()
  }else if(provider==='OPENAI'){
   if(c.method!=='POST'||u.pathname!=='/v1/responses'||u.search||!c.body)return refuse()
   let body:unknown;try{body=JSON.parse(c.body)}catch{return refuse()}
   if(!body||Object.getPrototypeOf(body)!==Object.prototype||(body as Record<string,unknown>).model!==fixed.credentials.openAiModel
    ||(body as Record<string,unknown>).store!==false)return refuse()
  }else if(c.method==='POST'){
   if(!postPaths.includes(u.pathname)||u.search||!c.body)return refuse()
  }else{
   if(!getPaths.includes(u.pathname)||u.searchParams.getAll('n').length!==1||!u.searchParams.get('n')
    ||[...u.searchParams].some(([k,v])=>!k||k.length>120||v.length>4096)||[...u.searchParams].length>401)return refuse()
  }
  return Object.freeze({...c})
 }
 async function execute(provider:FinderSource,input:Parameters<typeof fetch>[0],init:RequestInit={}):Promise<Response>{
  if(failed||!(typeof input==='string'||input instanceof URL)||!init||Object.getPrototypeOf(init)!==Object.prototype
   ||Reflect.ownKeys(init).length!==Object.keys(init).length||Object.values(Object.getOwnPropertyDescriptors(init)).some(d=>!('value'in d)||!d.enumerable)
   ||Object.keys(init).some(k=>!['method','headers','body','signal','cache','redirect'].includes(k))
   ||init.redirect!==undefined&&!['manual','error'].includes(init.redirect)||init.cache!==undefined&&init.cache!=='no-store'
   ||init.body!=null&&typeof init.body!=='string'&&!(init.body instanceof URLSearchParams))return refuse()
  const command=parse(provider,{url:typeof input==='string'?input:input.href,method:init.method??'GET',body:init.body==null?null:String(init.body)})
  const headers=new Headers(init.headers),authorisation=headers.get('authorization')
  for(const[k,v]of headers){
   const technical=provider==='OPENAI'&&['user-agent','x-stainless-lang','x-stainless-package-version','x-stainless-os','x-stainless-arch','x-stainless-runtime','x-stainless-runtime-version','x-stainless-retry-count','x-stainless-timeout'].includes(k)
   if(!['authorization','accept','content-type'].includes(k)&&!technical||v.length>8192||/[\r\n\0]/.test(v))return refuse()
  }
  if(provider==='MACROBOND_TOKEN'?authorisation!==null:provider==='OPENAI'?!fixed.credentials.openAiKey||authorisation!=='Bearer '+fixed.credentials.openAiKey
   :!authorisation?.startsWith('Bearer ')||!knownTokens.has(authorisation.slice(7)))return refuse()
  const ordinal=ordinals.get(provider)??0;if(ordinal>=256)return refuse();ordinals.set(provider,ordinal+1)
  const policy=finderSourcePolicy(provider),networkOrigin=fixed.syntheticOrigin??policy.origin
  const native={schemaDigest:fixed.external.nativeSchemaDigest,pathRules:policy.pathRules,redirectOrigins:[],maximumResponseBytes:4000000,completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT' as const}
  const credential=policy.credentialMode==='NONE'?{nativeTransport:{...native,credentialMode:'NONE' as const}}
   :{nativeTransport:{...native,credentialMode:'SERVER_HEADERS' as const},getHeaders:()=>({authorization:authorisation!})}
  const host=createExternalCallHost<Prisma.TransactionClient,Command>({sourceHost:sourceHost(provider),sourceId:policy.source.id,resourceId:policy.resourceId,now,
   binding:{role:fixed.binding.role,configurationVersion:fixed.external.configurationVersion,schemaDigest:fixed.external.schemaDigest,origin:networkOrigin,
    transport:fixed.syntheticOrigin?'LOCAL_SYNTHETIC_HTTP':'HTTPS',pathRules:policy.basePathRules},...credential,
   independentQuery:discoveryQuery(auditPrisma),query:(tx,sql,values)=>discoveryQuery(tx)(sql,values),parseCommand:v=>parse(provider,v),
   buildRequest:c=>({method:c.method,url:networkOrigin+new URL(c.url).pathname+new URL(c.url).search,body:c.body})})
  const intentKey=createHmac('sha256',Buffer.from(fixed.operationKey,'hex')).update(JSON.stringify({sourceId:policy.source.id,ordinal})).digest('hex')
  try{
   const result=externalNativeResponse(await host.execute({command,intentKey},{signal:init.signal??undefined}))
   if(provider==='MACROBOND_TOKEN'&&result.ok){
    const v=await result.clone().json() as Record<string,unknown>,access=v?.access_token
    if(typeof access!=='string'||!access||access.length>8192||/[\s\0]/.test(access))return refuse()
    knownTokens.add(access)
   }
   return result
  }catch(error){failed=true;throw error}
 }
 const fetcher=(kind:'macrobond'|'openai'):typeof fetch=>async(input,init)=>{
  let provider:FinderSource
  if(kind==='openai')provider='OPENAI'
  else{let u:URL;try{u=new URL(typeof input==='string'?input:input instanceof URL?input.href:refuse())}catch{return refuse()}
   provider=u.origin===origins.MACROBOND_TOKEN?'MACROBOND_TOKEN':'MACROBOND_API'}
  return execute(provider,input,init)
 }
 return Object.freeze({macrobond:fetcher('macrobond'),openai:fetcher('openai')})
}
