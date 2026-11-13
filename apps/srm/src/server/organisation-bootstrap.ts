import {createHash} from 'node:crypto'
import type pg from 'pg'
import {createClerkClient} from '@clerk/backend'
import {readClerkConfiguration} from '@profitia/platform-contracts/clerk-configuration'
import {createPeerOperationVerifier,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import {createOrganisationLifecycleBackend,createOrganisationLifecycleSql,organisationLifecycleSchemaDigest} from '@profitia/platform-contracts/organisation-lifecycle'
import {profileSchemaDigest} from '@profitia/platform-contracts/user-profile'
import {normalizeCompanyRecord} from '@profitia/platform-contracts/organisation-profile'
import type {AccessStoreBinding,AccessQuery} from '@profitia/platform-contracts/access-store'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {createSrmNativePgDriver} from './native-pg-driver'
import {createSrmOrganisationBootstrapSourceTransport,guardOriginalProviderCall} from './provider-source-transport'
import {fetchMgbiGeneral,type MgbiGeneralResult} from './mgbi-general'
import targets from '../../deployment/organisation-bootstrap-development.json'
import sourceTargets from '../../deployment/supplier-native-targets.json'
type SourceOptions=Omit<Parameters<typeof createSrmOrganisationBootstrapSourceTransport>[0],'nip'|'operationKey'|'headers'>
type Options={
 peer:PeerOperationConfiguration;client:ClerkIdentityClient;binding:AccessStoreBinding;profileSchemaDigest:string;proofKey:Uint8Array
 pool:pg.Pool;auditPool:pg.Pool;deploymentId:string;configurationVersion:string;sourcePolicyRef:string;freshnessMs:number
 source:SourceOptions;mgbi:{apiKey:string;authScheme:'raw'|'bearer'};now?:()=>number
}
/** Only the original continuity-checked General selection becomes the eight
 * account-creation fields. No raw/private archive or financial section escapes. */
export function basicOrganisationCompany(result:MgbiGeneralResult,nip:string){
 const data=result.section.data
 if(result.errorCode||!data||!['SUCCESS','PARTIAL'].includes(result.section.status))return {status:result.section.status==='EMPTY'?'NOT_FOUND':'UNAVAILABLE'} as const
 if(!/sp[óo]łka|spolka/iu.test(data.legalForm??'')||data.registrationStatus==='DEREGISTERED')return {status:'UNSUPPORTED_COMPANY'} as const
 const raw=result.rawRecord as any,address=raw?.content?.current_excerpt?.dane?.dzial1?.siedzibaIAdres?.adres
 try{return {company:normalizeCompanyRecord({entityType:'COMPANY',country:'PL',nip:data.nip,krs:data.krs,regon:data.regon,legalName:data.legalName,address:data.registeredAddress,postalCode:address?.kodPocztowy},nip)}}catch{return {status:'UNAVAILABLE'} as const}
}
export function createSrmOrganisationBootstrapGateway(options:Options){
 const now=options.now??Date.now,driver=createSrmNativePgDriver(options.pool,options.auditPool)
 if(options.peer.callerApplicationId!=='identity-runtime-development'||options.peer.receiverApplicationId!=='srm-onboarding-development'
  ||options.peer.routes.length!==1||options.peer.routes[0]?.path!=='/api/organisation-onboarding/company'||options.peer.routes[0]?.method!=='POST'
  ||options.peer.routes[0]?.maximumRequestBytes!==1024||!options.peer.routes[0]?.requireIdempotencyKey
  ||!Number.isSafeInteger(options.freshnessMs)||options.freshnessMs<60000||options.freshnessMs>7*86400000
  ||!/^[-A-Za-z0-9._:]{1,150}$/.test(options.sourcePolicyRef)||!options.mgbi.apiKey||options.profileSchemaDigest!==profileSchemaDigest()
  ||options.binding.applicationId!=='srm-onboarding-development')throw Error('BOOTSTRAP_GATEWAY_CONFIGURATION_REQUIRED')
 const verify=createPeerOperationVerifier(options.peer)
 // Verified primary email is a purpose precondition; official Clerk still owns
 // signed identity/current session/account. This never manufactures an Actor.
 const client:ClerkIdentityClient={...options.client,users:{getUser:async subject=>{
  const user=await options.client.users.getUser(subject),value=user as any
  const verified=Array.isArray(value.emailAddresses)&&value.emailAddresses.some((e:any)=>e.id===value.primaryEmailAddressId&&e.verification?.status==='verified')
  return verified?user:{...user,deprovisioned:true}
 }}}
 const sql=createOrganisationLifecycleSql({binding:options.binding,issuer:targets.issuer,schemaDigest:options.profileSchemaDigest,proofKey:options.proofKey,now})
 const backend=createOrganisationLifecycleBackend({...driver,client,binding:options.binding,schemaDigest:options.profileSchemaDigest,proofKey:options.proofKey,now,
  identityApplication:{appId:'srm-onboarding-development',environment:'development',issuer:targets.issuer,authorizedParties:[options.peer.sourceOrigin]},
  application:{appId:'srm-onboarding-development',profileId:'SPENDGURU_SAAS',environment:'development',identityIssuer:targets.issuer,organisationId:null,
   features:['organisation_admin'],operations:['organisation.company.lookup'],deploymentId:options.deploymentId,configurationVersion:options.configurationVersion}})
 const one=async(query:AccessQuery,text:string,values:unknown[]=[])=>{const r=await query(text,values);if(r.rows.length!==1)throw Error('BOOTSTRAP_GATEWAY_UNAVAILABLE');return r.rows[0]! as Record<string,any>}
 const ready=async()=>{
  await backend.ready()
  const d=(await options.source.pool.query('SELECT profitia_external_native.descriptor($1,$2) AS d',['srm.provider.mgbi-onboarding','srm-provider:mgbi-onboarding'])).rows[0]?.d
  if(!d||d.sourceId!=='srm.provider.mgbi-onboarding'||d.resourceId!=='srm-provider:mgbi-onboarding'||d.role!==options.source.binding.role
   ||d.environment!=='development'||d.applicationId!=='srm-provider-source'||Date.parse(d.expiresAt)<=now())throw Error('BOOTSTRAP_SOURCE_ADMISSION_REQUIRED')
 }
 const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','content-type':'application/json','x-content-type-options':'nosniff',vary:'Authorization'}
 return Object.freeze({ready,async handle(request:Request):Promise<Response>{
  try{
   const url=new URL(request.url)
   if(url.pathname!=='/api/organisation-onboarding/company'||url.search||url.hash)return Response.json({status:'UNAVAILABLE'},{status:404,headers})
   if(request.method!=='POST')return Response.json({status:'UNAVAILABLE'},{status:405,headers})
   if(!await verify(request))return Response.json({status:'UNAVAILABLE'},{status:401,headers})
   const intent=request.headers.get('idempotency-key')
   if(!/^[a-f0-9]{64}$/.test(intent??''))return Response.json({status:'UNAVAILABLE'},{status:400,headers})
   const input=await request.clone().json()
   const result=await backend.execute(request,'organisation.company.lookup',input,async unit=>{
    const draft=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_lookup_draft($1::uuid) AS draft',[unit.context.decisionId])).draft
    if(draft?.version!==unit.input.draftVersion||draft.answers?.nip!==unit.input.nip||draft.organisationExists)return {status:'UNAVAILABLE'}
    const cached=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_company_envelope($1,$2::uuid) AS value',[unit.input.nip,unit.context.decisionId])).value
    if(cached)return cached
    const fetcher=createSrmOrganisationBootstrapSourceTransport({...options.source,nip:unit.input.nip,operationKey:intent!,
     headers:{authorization:options.mgbi.authScheme==='bearer'?'Bearer '+options.mgbi.apiKey:options.mgbi.apiKey,accept:'application/json'}}).fetcher
    const original=await guardOriginalProviderCall(fetcher,guarded=>fetchMgbiGeneral({type:'NIP',value:unit.input.nip},
     {apiKey:options.mgbi.apiKey,authScheme:options.mgbi.authScheme,fetcher:guarded,now:()=>new Date(now()),timeoutMs:8000}))
    const basic=basicOrganisationCompany(original,unit.input.nip)
    if('status'in basic)return basic
    const retrievedAt=original.section.retrievedAt
    if(!retrievedAt||!Number.isFinite(Date.parse(retrievedAt))||Date.parse(retrievedAt)>now()+2000)throw Error('BOOTSTRAP_SOURCE_UNAVAILABLE')
    const recordId=original.section.source.recordId
    if(typeof recordId!=='string'||!/^[-A-Za-z0-9._:]{1,150}$/.test(recordId))throw Error('BOOTSTRAP_SOURCE_REFERENCE_REQUIRED')
    const selected={company:basic.company,sourceRef:'mgbi:pl-krs-wp-record:'+recordId,
     version:createHash('sha256').update(JSON.stringify({company:basic.company,recordId,retrievedAt,policy:options.sourcePolicyRef})).digest('hex'),
     sourcePolicyRef:options.sourcePolicyRef,retrievedAt,validUntil:new Date(Date.parse(retrievedAt)+options.freshnessMs).toISOString()}
    // Persist the licensed minimum before returning a response. A lost HTTP
    // response can read this governed cache instead of buying another query.
    const c=unit.context,until=Math.min(Date.parse(unit.expiresAt),Date.parse(c.actor.expiresAt))
    const admit=await sql.attest(unit.query,{operation:'organisation.lifecycle.admit',principal:c.actorId,issuer:[c.operation,c.resourceId,c.payloadDigest,''].join(':'),expiresAt:until})
    await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_admit($1,$2,$3,NULL,$4::bigint,$5) AS policy',[c.operation,c.resourceId,c.payloadDigest,admit.until,admit.signature])
    const payload=JSON.stringify(selected),proof=await sql.attest(unit.query,{operation:'organisation.company.lookup.commit',principal:c.actorId,issuer:createHash('sha256').update(payload).digest('hex'),expiresAt:until})
    await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_company_store($1,$2::bigint,$3,$4::uuid) AS stored',[payload,proof.until,proof.signature,c.decisionId])
    return selected
   })
   return Response.json(result,{headers})
  }catch{return Response.json({status:'UNAVAILABLE'},{status:503,headers})}
 }})
}
function rolePool(raw:string|undefined,role:string){
 if(!raw)throw Error('BOOTSTRAP_PRIVATE_CONFIGURATION_REQUIRED')
 const u=new URL(raw)
 if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.username)!==role||!u.password||decodeURIComponent(u.pathname.slice(1))!=='platform_private'
  ||!targets.hosts.includes(u.hostname)||u.port&&u.port!=='5432'||u.hash||[...u.searchParams].some(([k,v])=>!((k==='sslmode'&&['require','verify-full'].includes(v))||(k==='channel_binding'&&v==='require'))))
  throw Error('BOOTSTRAP_EXACT_DATABASE_REQUIRED')
 return {host:u.hostname,user:role,password:decodeURIComponent(u.password),database:'platform_private',port:5432,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,idleTimeoutMillis:10000}
}
let runtime:Promise<ReturnType<typeof createSrmOrganisationBootstrapGateway>|null>|null=null
/** Existing SRM process only; no new service, source key copy or startup DDL. */
export function organisationBootstrapRuntime(env:Readonly<Record<string,string|undefined>>=process.env){
 if(runtime)return runtime
 runtime=(async()=>{
  const flag=env.PROFITIA_ORGANISATION_BOOTSTRAP_ENABLED
  if(flag===undefined||flag==='false')return null
  if(flag!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!==targets.serviceId
   ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??'')||env.PROFITIA_ORGANISATION_BOOTSTRAP_CONFIGURATION_VERSION!==targets.configurationVersion
   ||env.PROFITIA_ORGANISATION_BOOTSTRAP_SCHEMA_DIGEST!==organisationLifecycleSchemaDigest()
   ||!/^[a-f0-9]{64}$/.test(env.PROFITIA_ORGANISATION_BOOTSTRAP_PROFILE_KEY??'')||!/^[a-f0-9]{64}$/.test(env.PROFITIA_ORGANISATION_BOOTSTRAP_PEER_KEY??'')
   ||env.MGBI_AUTH_SCHEME!==undefined&&!['raw','bearer'].includes(env.MGBI_AUTH_SCHEME)
   ||!env.MGBI_API_KEY?.trim()||!env.PROFITIA_CLERK_SECRET_KEY||!env.PROFITIA_CLERK_PUBLISHABLE_KEY)throw Error('BOOTSTRAP_PRIVATE_CONFIGURATION_REQUIRED')
  const identity=readClerkConfiguration({applicationId:'srm-onboarding-development',environment:'development',issuer:env.PROFITIA_CLERK_ISSUER,publishableKey:env.PROFITIA_CLERK_PUBLISHABLE_KEY,secretKey:env.PROFITIA_CLERK_SECRET_KEY,authorizedParties:[targets.sourceOrigin]})
  if(identity.application.issuer!==targets.issuer)throw Error('BOOTSTRAP_EXACT_IDENTITY_REQUIRED')
  const {Pool}=await import('pg'),privateConnection=rolePool(env.PROFITIA_ORGANISATION_BOOTSTRAP_DATABASE_URL,targets.runtimeRole)
  const sourceConnection=rolePool(env.PROFITIA_SUPPLIER_SOURCE_DATABASE_URL,sourceTargets.runtimeRoles.providerSource)
  const pool=new Pool({...privateConnection,max:4}),auditPool=new Pool({...privateConnection,max:1}),sourcePool=new Pool({...sourceConnection,max:2}),sourceAudit=new Pool({...sourceConnection,max:1})
  for(const p of [pool,auditPool,sourcePool,sourceAudit])p.on('error',()=>{})
  const deploymentId=targets.serviceId+':'+env.RENDER_GIT_COMMIT,sourceDeployment=deploymentId+':srm-provider-source'
  const peer:PeerOperationConfiguration={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:'srm-onboarding-development',
   sourceOrigin:targets.sourceOrigin,targetOrigin:targets.publicOrigin,keyId:targets.peerKeyId,key:Buffer.from(env.PROFITIA_ORGANISATION_BOOTSTRAP_PEER_KEY!,'hex'),
   routes:[{method:'POST',path:'/api/organisation-onboarding/company',maximumRequestBytes:1024,requireIdempotencyKey:true}],
   internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']}
  const core=sourceTargets.coreSchemaDigests
  const gateway=createSrmOrganisationBootstrapGateway({peer,client:createClerkClient({secretKey:env.PROFITIA_CLERK_SECRET_KEY,publishableKey:env.PROFITIA_CLERK_PUBLISHABLE_KEY,telemetry:{disabled:true}}),
   binding:{applicationId:'srm-onboarding-development',environment:'development',projectId:targets.projectId,branchId:targets.branchId,databaseName:'platform_private',role:targets.runtimeRole,schemaDigest:core['001-internal-access.sql']},
   profileSchemaDigest:profileSchemaDigest(),proofKey:Buffer.from(env.PROFITIA_ORGANISATION_BOOTSTRAP_PROFILE_KEY!,'hex'),pool,auditPool,deploymentId,configurationVersion:targets.configurationVersion,
   sourcePolicyRef:targets.sourcePolicyRef,freshnessMs:targets.freshnessMs,mgbi:{apiKey:env.MGBI_API_KEY!.trim(),authScheme:env.MGBI_AUTH_SCHEME==='bearer'?'bearer':'raw'},
   source:{pool:sourcePool,auditPool:sourceAudit,application:{appId:'srm-provider-source',profileId:'PLATFORM_INTERNAL',environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest'],deploymentId:sourceDeployment,configurationVersion:sourceTargets.configurationVersion},
    binding:{applicationId:'srm-provider-source',environment:'development',projectId:targets.projectId,branchId:targets.branchId,databaseName:'platform_private',role:sourceTargets.runtimeRoles.providerSource,deploymentId:sourceDeployment,configurationVersion:sourceTargets.configurationVersion,schemaDigest:core['008-platform-ingestion.sql']},
    external:{configurationVersion:sourceTargets.configurationVersion,schemaDigest:core['009-external-call-admission.sql'],nativeSchemaDigest:core['012-native-external-transport.sql'],maximumResponseBytes:4194304}}})
  return gateway
 })().catch(error=>{runtime=null;throw error})
 return runtime
}
