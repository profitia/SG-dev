import {createPeerOperationSigner,peerOperationIdentityRequest,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import {createHmac} from 'node:crypto'
import {createHash,randomUUID} from 'node:crypto'
import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import {ORGANISATION_LIFECYCLE_OPERATIONS} from '@profitia/platform-contracts/operation-context'
import {createOrganisationLifecycleBackend,createOrganisationLifecycleSql,organisationLifecycleSchemaDigest,organisationAccessProjectionSchemaDigest,organisationEmailKey,sealOrganisationInvitation,type OrganisationLifecycleUnit} from '@profitia/platform-contracts/organisation-lifecycle'
import {createOrganisationInvitationProof,organisationInvitationTokenHash} from '@profitia/platform-contracts/organisation-invitations'
import {normalizeCompanyRecord,normalizeCompanySelection,normalizeInvitationEmail,suggestOrganisationSlug,OrganisationProfileError} from '@profitia/platform-contracts/organisation-profile'
import {ProfileConflict} from '@profitia/platform-contracts/user-profile'
import type {StoredCompanyRecord} from '@profitia/platform-contracts/organisation-bootstrap'
import type {OrganisationConversationSurface} from './organisation-http.js'
import type {OnboardingSnapshot} from './organisation-onboarding.js'
import type {OrganisationInvitationEmail} from './invitation-email.js'
import {verifiedEmailClient,type accountTransactions} from './account-provisioning.js'
import {BoundaryError,type RuntimeConfiguration,type RuntimeSdk} from './contracts.js'
import {readConfiguration} from './config.js'
import {checkRequest} from './session-boundary.js'
type ProviderUser={id:string;primaryEmailAddressId:string;emailAddresses:readonly {id:string;emailAddress:string;verification?:{status?:string}}[]}
type RegistrySnapshot=StoredCompanyRecord&{sourcePolicyRef:string;retrievedAt:string;validUntil:string}
export interface OrganisationCompanySource{
 ready():Promise<void>
 acquire(request:Request,input:Readonly<{nip:string;draftVersion:string;context:Readonly<OperationContext>}>):Promise<RegistrySnapshot|Readonly<{status:'NOT_FOUND'|'UNSUPPORTED_COMPANY'|'UNAVAILABLE'}>>
}
export type OrganisationPackageEntitlements=Readonly<{status:'ACTIVE'|'INACTIVE';userId:string;organisationId:string;applicationId:'spendguru';assignmentRef:string|null;capabilities:readonly string[];expiresAt:string;assignmentUntil:string|null}>
export interface OrganisationWorkspaceAccess{
 entitlements?(request:Request,input:Readonly<{userId:string;organisationId:string;applicationId:string}>):Promise<OrganisationPackageEntitlements>
 ready():Promise<void>
 resolve(request:Request,input:Readonly<{userId:string;organisationId:string;applicationId:string}>):Promise<Readonly<{status:'READY'|'PENDING_PACKAGE'|'UNAVAILABLE'}>>
}
export type OrganisationStore=OrganisationConversationSurface&{
 readStoredCompany(input:Readonly<{nip:string;context:Readonly<OperationContext>}>):Promise<StoredCompanyRecord|null>
 acceptInvitation(request:Request,input:unknown):Promise<Readonly<{status:string}>>
}
/** Official SDK lookup is internal to the server. Never trust partial email
 * search hits, unverified addresses, pagination truncation or browser user IDs. */
export function createOrganisationRecipientLookup(client:unknown){
 const users=(client as {users?:{getUserList?:(input:{emailAddress:string[];limit:number})=>Promise<{data:ProviderUser[];totalCount:number}>}})?.users
 if(typeof users?.getUserList!=='function')throw Error('OFFICIAL_RECIPIENT_LOOKUP_REQUIRED')
 return async(emails:readonly string[]):Promise<ReadonlyMap<string,string|null>>=>{
  const selected=[...new Set(emails.map(normalizeInvitationEmail))];if(selected.length>20)throw Error('RECIPIENT_LOOKUP_LIMIT')
  const result=new Map(selected.map(email=>[email,null as string|null]));if(!selected.length)return result
  const page=await users.getUserList!({emailAddress:selected,limit:100})
  if(!Array.isArray(page?.data)||!Number.isSafeInteger(page.totalCount)||page.totalCount<0||page.totalCount>100||page.data.length!==page.totalCount)throw Error('RECIPIENT_LOOKUP_UNAVAILABLE')
  for(const user of page.data){
   if(typeof user.id!=='string'||!user.id||user.id.length>256)throw Error('RECIPIENT_LOOKUP_UNAVAILABLE')
   for(const address of user.emailAddresses??[]){
    if(address.verification?.status!=='verified')continue
    let email:string;try{email=normalizeInvitationEmail(address.emailAddress)}catch{continue}
    if(!result.has(email))continue
    if(result.get(email)!==null&&result.get(email)!==user.id)throw Error('RECIPIENT_LOOKUP_AMBIGUOUS')
    result.set(email,user.id)
   }
  }
  return result
 }
}
export function createOrganisationStore(options:{
 configuration:RuntimeConfiguration;client:RuntimeSdk;binding:AccessStoreBinding;schemaDigest:string;lifecycleSchemaDigest:string;proofKey:Uint8Array
 encryptionKey:Uint8Array;keyId:string;transact:ReturnType<typeof accountTransactions>;independentQuery:AccessQuery
 accessProjectionSchemaDigest?:string;deploymentId:string;configurationVersion:string;companySource:OrganisationCompanySource;workspaceAccess:OrganisationWorkspaceAccess
 workspaceTargetId:string;workspaceRouteKey:string;findRecipients:(emails:readonly string[])=>Promise<ReadonlyMap<string,string|null>>;now?:()=>number
}):OrganisationStore{
 const configuration=readConfiguration(options.configuration),now=options.now??Date.now,target=configuration.targets[options.workspaceTargetId]
 const workspacePath=target?.routes[options.workspaceRouteKey],proofKey=Buffer.from(options.proofKey),key=Buffer.from(options.encryptionKey)
 if(options.lifecycleSchemaDigest!==organisationLifecycleSchemaDigest()||key.length!==32||proofKey.length!==32
  ||!/^[-A-Za-z0-9._:]{1,100}$/.test(options.keyId)||!target||!workspacePath||!target.origin.startsWith('https:')
  ||typeof options.findRecipients!=='function'||!options.companySource||!options.workspaceAccess)throw Error('ORGANISATION_STORE_CONFIGURATION_REQUIRED')
 const readEntitlements=options.workspaceAccess.entitlements?.bind(options.workspaceAccess)
 if(readEntitlements ? options.accessProjectionSchemaDigest!==organisationAccessProjectionSchemaDigest() : options.accessProjectionSchemaDigest!==undefined)throw Error('ACCESS_PROJECTION_CONFIGURATION_REQUIRED')
 const sql=createOrganisationLifecycleSql({binding:options.binding,issuer:configuration.issuer,schemaDigest:options.schemaDigest,proofKey,now})
 const backend=(request?:Request)=>createOrganisationLifecycleBackend({client:verifiedEmailClient(options.client),binding:options.binding,schemaDigest:options.schemaDigest,proofKey,
  independentQuery:options.independentQuery,now,transact:(run,limits)=>options.transact(run,limits,request?.signal),
  identityApplication:{appId:configuration.applicationId,environment:configuration.environment,issuer:configuration.issuer,authorizedParties:[request&&peerOperationIdentityRequest(request)?new URL(peerOperationIdentityRequest(request)!.url).origin:configuration.origin]},
  application:{appId:configuration.applicationId,profileId:'SPENDGURU_SAAS',environment:configuration.environment,deploymentId:options.deploymentId,
   configurationVersion:options.configurationVersion,identityIssuer:configuration.issuer,organisationId:null,features:['organisation_admin'],operations:ORGANISATION_LIFECYCLE_OPERATIONS.filter(op=>op!=='organisation.access.synchronise'||readEntitlements!==undefined)}})
 const one=async(query:AccessQuery,text:string,args:unknown[]=[]):Promise<Record<string,any>>=>{const rows=(await query(text,args)).rows;if(rows.length!==1)throw Error('ORGANISATION_STORE_UNAVAILABLE');return rows[0]! as Record<string,any>}
 async function checked<T>(request:Request,write:boolean,run:()=>Promise<T>):Promise<T>{
  checkRequest(request,configuration,write)
  try{return await run()}catch(error){
   if(error instanceof BoundaryError)throw error
   if(error instanceof ProfileConflict)throw new BoundaryError(409,'PROFILE_VERSION_CONFLICT')
   if(error instanceof OrganisationProfileError)throw new BoundaryError(400,error.code)
   if(error instanceof TypeError)throw new BoundaryError(400,'INVALID_ORGANISATION_INPUT')
   const reason=(error as {reasonCode?:string})?.reasonCode
   if(reason==='UNVERIFIED_IDENTITY')throw new BoundaryError(401,'ACCOUNT_REQUIRED')
   if(['PERMISSION_DENIED','ACCESS_BASIS_INVALID','EXPLICIT_DENY','PRODUCT_UNAVAILABLE'].includes(reason??''))throw new BoundaryError(403,'ONBOARDING_ACCESS_DENIED')
   throw new BoundaryError(503,'ONBOARDING_UNAVAILABLE')
  }
 }
 async function renew(unit:OrganisationLifecycleUnit){
  const c=unit.context,proof=await sql.attest(unit.query,{operation:'organisation.lifecycle.admit',principal:c.actorId,
   issuer:[c.operation,c.resourceId,c.payloadDigest,c.organisationId??''].join(':'),expiresAt:Math.min(Date.parse(unit.expiresAt),Date.parse(c.actor.expiresAt))})
  await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_admit($1,$2,$3,$4::uuid,$5::bigint,$6) AS policy',
   [c.operation,c.resourceId,c.payloadDigest,c.organisationId,proof.until,proof.signature])
 }
 async function commit(unit:OrganisationLifecycleUnit,functionName:'enqueue'|'accept'|'company_store',payload:unknown){
  await renew(unit)
  const body=JSON.stringify(payload),proof=await sql.attest(unit.query,{operation:unit.context.operation+'.commit',principal:unit.context.actorId,
   issuer:createHash('sha256').update(body).digest('hex'),expiresAt:Math.min(Date.parse(unit.expiresAt),Date.parse(unit.context.actor.expiresAt))})
  return(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_'+functionName+'($1,$2::bigint,$3,$4::uuid) AS result',
   [body,proof.until,proof.signature,unit.context.decisionId])).result
 }
 function stored(value:any,nip:string):StoredCompanyRecord|null{
  if(value===null)return null
  if(!value||Object.keys(value).sort().join(',')!=='company,sourceRef,version'||typeof value.sourceRef!=='string'||!value.sourceRef||value.sourceRef.length>256
   ||typeof value.version!=='string'||!value.version||value.version.length>256)throw Error('STORED_COMPANY_UNAVAILABLE')
  const selection=normalizeCompanySelection({sourceRef:value.sourceRef,version:value.version})!
  return {company:normalizeCompanyRecord(value.company,nip),...selection}
 }
 async function ownUser(unit:OrganisationLifecycleUnit){
  const user=await options.client.users.getUser(unit.identityKey.subject) as unknown as ProviderUser
  if(user.id!==unit.identityKey.subject||!Array.isArray(user.emailAddresses))throw Error('VERIFIED_ACCOUNT_REQUIRED')
  const primary=user.emailAddresses.find(e=>e.id===user.primaryEmailAddressId&&e.verification?.status==='verified')
  if(!primary)throw new BoundaryError(401,'VERIFIED_EMAIL_REQUIRED')
  return {primary:normalizeInvitationEmail(primary.emailAddress),verified:[...new Set(user.emailAddresses.filter(e=>e.verification?.status==='verified').map(e=>normalizeInvitationEmail(e.emailAddress)))]}
 }
 backend()
 const surface:OrganisationStore={
  async ready(){await backend().ready();if(readEntitlements){const d=(await one(options.independentQuery,'SELECT profitia_profile.organisation_access_descriptor() AS d')).d;if(d?.schemaDigest!==options.accessProjectionSchemaDigest)throw Error('ACCESS_PROJECTION_INSTALLATION_REQUIRED')}},
  ...(readEntitlements?{synchroniseAccess:(request:Request,input:unknown)=>checked(request,true,async()=>{
   // Finish the own-context Root transaction BEFORE the cross-service read.
   // Never hold the global authority write fence across a remote service call.
   const scope=await backend(request).execute(request,'organisation.access.synchronise',input,async unit=>({
    userId:unit.context.actorId,organisationId:unit.context.organisationId!,applicationId:target.applicationId}))
   const snapshot=await readEntitlements(request,scope)
   return backend(request).execute(request,'organisation.access.synchronise',input,async unit=>{
   if(unit.context.actorId!==scope.userId||unit.context.organisationId!==scope.organisationId)throw Error('ACCESS_PROJECTION_SCOPE_CHANGED')
   await renew(unit)
   const body=JSON.stringify(snapshot),proof=await sql.attest(unit.query,{operation:'organisation.access.synchronise.commit',principal:unit.context.actorId,
    issuer:createHash('sha256').update(body).digest('hex'),expiresAt:Math.min(Date.parse(unit.expiresAt),Date.parse(unit.context.actor.expiresAt))})
   const result=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_access_project($1,$2::bigint,$3,$4::uuid) AS result',[body,proof.until,proof.signature,unit.context.decisionId])).result
   if(!result||!['SYNCHRONISED','PENDING_PACKAGE','RECONCILIATION_REQUIRED'].includes(result.status))throw Error('ACCESS_PROJECTION_UNAVAILABLE')
   return result as {status:'SYNCHRONISED'|'PENDING_PACKAGE'|'RECONCILIATION_REQUIRED';expiresAt?:string}
  })})}:{}),
  snapshot:request=>checked(request,false,()=>backend(request).execute(request,'organisation.onboarding.read',{},async unit=>{
   const draft=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_snapshot($1::uuid) AS draft',[unit.context.decisionId])).draft
   if(!draft||typeof draft.version!=='string'||!draft.answers||typeof draft.answers!=='object')throw Error('ONBOARDING_DRAFT_UNAVAILABLE')
   const profile=unit.profile.profile??{},organisation=unit.profile.organisation??null,categories=unit.profile.categories??[]
   let company:OnboardingSnapshot['company']=null
   if(typeof draft.answers.nip==='string'){
    const current=stored((await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_stored_company($1) AS company',[draft.answers.nip])).company,draft.answers.nip)
    if(current)company={company:current.company,selection:{sourceRef:current.sourceRef,version:current.version},suggestedSlug:suggestOrganisationSlug(current.company.legalName)}
   }
   return {draft:organisation?{...draft,answers:{...draft.answers,industry:organisation.industry,categories}}:draft,
    avatarSex:['male','female'].includes(profile.avatar_sex)?profile.avatar_sex:null,salutation:profile.name_vocative??null,company,
    organisation:organisation?{organisationId:organisation.organisationId,slug:organisation.slug}:null,
    ...(readEntitlements?{accessProjectionRequired:true}:{}),
    ...(organisation?{categoriesRequired:categories.length===0,procurementVersion:unit.profile.procurementVersion}:{})} as OnboardingSnapshot
  })),
  lookupCompany:(request,input)=>checked(request,true,()=>backend(request).execute(request,'organisation.company.lookup',input,async unit=>{
   const {nip,draftVersion}=unit.input
   const draft=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_lookup_draft($1::uuid) AS draft',[unit.context.decisionId])).draft
   if(draft?.version!==draftVersion||draft.answers?.nip!==nip)throw new ProfileConflict()
   if(draft.organisationExists===true)return {status:'ORGANISATION_ALREADY_EXISTS' as const}
   const current=stored((await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_company($1,$2::uuid) AS company',[nip,unit.context.decisionId])).company,nip)
   let selected=current
   if(!selected){
    const acquired=await options.companySource.acquire(request,{nip,draftVersion,context:unit.context})
    if('status'in acquired)return acquired
    const company=normalizeCompanyRecord(acquired.company,nip)
    await commit(unit,'company_store',{...acquired,company})
    selected=stored({company,sourceRef:acquired.sourceRef,version:acquired.version},nip)
   }
   return {company:selected!.company,selection:{sourceRef:selected!.sourceRef,version:selected!.version},suggestedSlug:suggestOrganisationSlug(selected!.company.legalName)}
  })),
  checkSlug:(request,input)=>checked(request,true,()=>backend(request).execute(request,'organisation.slug.check',input,async unit=>({
   available:(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_slug($1,$2::uuid) AS available',[unit.input.slug,unit.context.decisionId])).available===true
  }))),
  savePersonalCategories:(request,input)=>checked(request,true,()=>backend(request).execute(request,'organisation.procurement.write',input,async unit=>
   (await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_categories($1::bigint,$2::jsonb,$3::uuid) AS saved',
    [unit.input.expectedVersion,JSON.stringify(unit.input.categories),unit.context.decisionId])).saved as {version:string})),
  sendInvitations:(request,input)=>checked(request,true,()=>backend(request).execute(request,'organisation.invitation.create',input,async unit=>{
   const replay=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_invitation_replay($1::uuid,$2::uuid) AS receipt',[unit.input.commandId,unit.context.decisionId])).receipt
   if(replay)return replay as {items:readonly {index:number;status:string}[]}
   const user=await ownUser(unit),emails=unit.input.emails as (string|null)[],subjects=await options.findRecipients(emails.filter((e):e is string=>e!==null))
   const profile=unit.profile.profile??{},org=unit.profile.organisation
   if(!org?.company?.legalName)throw Error('ORGANISATION_PROFILE_REQUIRED')
   await renew(unit)
   const salutationSubjects=[...new Set([...subjects.values()].filter((v):v is string=>v!==null))]
   const salutations=(await one(unit.query,'SELECT profitia_profile.organisation_lifecycle_recipient_salutations($1::text[],$2::uuid) AS profiles',[salutationSubjects,unit.context.decisionId])).profiles??{}
   const items=[]
   for(const [index,email]of emails.entries()){
    if(email===null){items.push({index,recipientKey:null,subject:null,delivery:null});continue}
    if(!subjects.has(email))throw Error('RECIPIENT_LOOKUP_INCOMPLETE')
    const subject=user.verified.includes(email)?unit.identityKey.subject:subjects.get(email)??null
    const invitationId=randomUUID(),proof=createOrganisationInvitationProof({now}),createdAt=new Date(Date.parse(proof.expiresAt)-7*24*60*60*1000).toISOString()
    const recipientProfile=subject?salutations[subject]??null:null
    const message:OrganisationInvitationEmail={token:proof.token,createdAt,expiresAt:proof.expiresAt,inviterName:profile.first_name??null,inviterEmail:user.primary,
     organisationName:org.company.legalName,avatar:profile.avatar_sex==='female'?'female':profile.avatar_sex==='male'?'male':'neutral',
     language:profile.communication_language==='en'?'en':'pl',recipientProfile:recipientProfile as OrganisationInvitationEmail['recipientProfile']}
    const encryptedPayload=sealOrganisationInvitation({recipient:email,inviterUserId:unit.context.actorId,email:message},{key,keyId:options.keyId,invitationId})
    items.push({index,recipientKey:organisationEmailKey(email,proofKey),subject,
     delivery:{invitationId,tokenHash:proof.tokenHash,createdAt,expiresAt:proof.expiresAt,encryptedPayload}})
   }
   return await commit(unit,'enqueue',{commandId:unit.input.commandId,items}) as {items:readonly {index:number;status:string}[]}
  })),
  activation:request=>checked(request,false,()=>backend(request).execute(request,'organisation.activation.read',{},async unit=>{
   if((unit.profile.categories??[]).length===0)return {status:'UNAVAILABLE' as const}
   const decision=await options.workspaceAccess.resolve(request,{userId:unit.context.actorId,organisationId:unit.context.organisationId!,applicationId:target.applicationId})
   return decision.status==='READY'?{status:'READY' as const,workspaceUrl:target.origin+workspacePath}:{status:decision.status}
  })),
  async readStoredCompany({nip,context}){
   if(context.operation!=='organisation.create'||context.mode!=='BOOTSTRAP'||context.organisationId!==null||context.actorKind!=='HUMAN')throw Error('GOVERNED_STORED_COMPANY_READ_REQUIRED')
   return stored((await one(options.independentQuery,'SELECT profitia_profile.organisation_lifecycle_stored_company($1) AS company',[nip])).company,nip)
  },
  acceptInvitation:(request,input)=>checked(request,true,()=>backend(request).execute(request,'organisation.invitation.accept',input,async unit=>{
   const user=await ownUser(unit)
   return await commit(unit,'accept',{commandId:unit.input.commandId,tokenHash:organisationInvitationTokenHash(unit.input.proof),
    recipientKeys:user.verified.map(email=>organisationEmailKey(email,proofKey))}) as {status:string}
  })),
 }
 return Object.freeze(surface)
}


/** Fixed native peers reuse the accepted server-caller signature. A receiver
 * must still verify the original bearer, current private context and its own
 * Source/Package authority. No URL, identity or entitlement comes from a form. */
export function createOrganisationServiceConnections(options:{
 registryPeer:PeerOperationConfiguration;workspacePeer:PeerOperationConfiguration
 accessProjectionSchemaDigest?:string;sourcePolicyRef:string;intentKey:Uint8Array;transport?:typeof fetch;now?:()=>number
}):Readonly<{companySource:OrganisationCompanySource;workspaceAccess:OrganisationWorkspaceAccess}>{
 const registry=structuredClone(options.registryPeer),workspace=structuredClone(options.workspacePeer)
 const sourcePath='/api/organisation-onboarding/company',accessPath='/v1/organisation-access'
 const signRegistry=createPeerOperationSigner(registry),signWorkspace=createPeerOperationSigner(workspace),transport=options.transport??fetch,now=options.now??Date.now
 if(registry.sourceOrigin!==workspace.sourceOrigin||registry.callerApplicationId!==workspace.callerApplicationId
  ||registry.routes.length!==1||registry.routes[0]?.method!=='POST'||registry.routes[0]?.path!==sourcePath||registry.routes[0]?.requireIdempotencyKey!==true
  ||registry.routes[0]?.maximumRequestBytes!==1024||workspace.routes.length!==(options.accessProjectionSchemaDigest?2:1)||workspace.routes[0]?.method!=='GET'||workspace.routes[0]?.path!==accessPath
  ||workspace.routes[0]?.maximumRequestBytes!==0||workspace.routes[0]?.requireIdempotencyKey!==false
  ||typeof options.sourcePolicyRef!=='string'||!/^[-A-Za-z0-9._:]{1,256}$/.test(options.sourcePolicyRef)
  ||!(options.intentKey instanceof Uint8Array)||options.intentKey.byteLength!==32)throw Error('ORGANISATION_CONNECTIONS_CONFIGURATION_REQUIRED')
 if(options.accessProjectionSchemaDigest!==undefined&&(options.accessProjectionSchemaDigest!==organisationAccessProjectionSchemaDigest()
  ||workspace.routes[1]?.method!=='GET'||workspace.routes[1]?.path!=='/v1/organisation-entitlements'||workspace.routes[1]?.maximumRequestBytes!==0||workspace.routes[1]?.requireIdempotencyKey!==false))throw Error('ACCESS_PROJECTION_CONFIGURATION_REQUIRED')
 const intentKey=Buffer.from(options.intentKey)
 async function bounded(response:Response):Promise<any>{
  if(!response.ok){await response.body?.cancel();throw Error('ORGANISATION_PEER_UNAVAILABLE')}
  const reader=response.body?.getReader();if(!reader)throw Error('ORGANISATION_PEER_UNAVAILABLE')
  let total=0;const chunks:Uint8Array[]=[]
  try{for(;;){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;if(total>8192){await reader.cancel();throw Error('ORGANISATION_PEER_UNAVAILABLE')}chunks.push(item.value)}}
  finally{reader.releaseLock()}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
 }
 async function send(request:Request,peer:PeerOperationConfiguration,sign:ReturnType<typeof createPeerOperationSigner>,path:string,body?:unknown,idempotency?:string){
  const authorization=request.headers.get('authorization')
  if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(authorization??''))throw Error('VERIFIED_BEARER_REQUIRED')
  const outgoing=await sign(new Request(peer.targetOrigin+path,{method:body===undefined?'GET':'POST',
   headers:{authorization:authorization!,...(body===undefined?{}:{'content-type':'application/json'}),...(idempotency?{'idempotency-key':idempotency}:{})},
   credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)]),...(body===undefined?{}:{body:JSON.stringify(body)})}))
  return bounded(await transport(outgoing))
 }
 async function ready(peer:PeerOperationConfiguration,path:string){
  const response=await transport(peer.targetOrigin+path,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)})
  const value=await bounded(response);if(value?.ready!==true)throw Error('ORGANISATION_PEER_NOT_READY')
 }
 return Object.freeze({
  companySource:Object.freeze({ready:()=>ready(registry,'/api/organisation-onboarding/ready'),async acquire(request:Request,{nip,draftVersion,context}:Parameters<OrganisationCompanySource['acquire']>[1]){
   if(context.operation!=='organisation.company.lookup'||context.mode!=='BOOTSTRAP'||context.organisationId!==null||context.actorKind!=='HUMAN')throw Error('BOOTSTRAP_SOURCE_CONTEXT_REQUIRED')
   const intent=createHmac('sha256',intentKey).update(JSON.stringify(['organisation-company-v1',context.actorId,nip,draftVersion])).digest('hex')
   const value=await send(request,registry,signRegistry,sourcePath,{nip,draftVersion},intent)
   if(value&&Object.keys(value).join(',')==='status'&&['NOT_FOUND','UNSUPPORTED_COMPANY','UNAVAILABLE'].includes(value.status))return value
   if(!value||Object.keys(value).sort().join(',')!=='company,retrievedAt,sourcePolicyRef,sourceRef,validUntil,version'
    ||value.sourcePolicyRef!==options.sourcePolicyRef||typeof value.sourceRef!=='string'||typeof value.version!=='string'
    ||!Number.isFinite(Date.parse(value.retrievedAt))||Date.parse(value.retrievedAt)>now()+2000
    ||!Number.isFinite(Date.parse(value.validUntil))||Date.parse(value.validUntil)<=now()||Date.parse(value.validUntil)-Date.parse(value.retrievedAt)>7*24*60*60*1000)throw Error('GOVERNED_COMPANY_SNAPSHOT_REQUIRED')
   return {...value,company:normalizeCompanyRecord(value.company,nip)} as RegistrySnapshot
  }}),
  workspaceAccess:Object.freeze({
   ...(options.accessProjectionSchemaDigest?{entitlements:async(request:Request,input:Parameters<OrganisationWorkspaceAccess['resolve']>[1]):Promise<OrganisationPackageEntitlements>=>{
    const value=await send(request,workspace,signWorkspace,'/v1/organisation-entitlements')
    if(!value||Object.keys(value).sort().join(',')!=='applicationId,assignmentRef,assignmentUntil,capabilities,expiresAt,organisationId,status,userId'
     ||value.userId!==input.userId||value.organisationId!==input.organisationId||value.applicationId!==input.applicationId||value.applicationId!=='spendguru'
     ||!['ACTIVE','INACTIVE'].includes(value.status)||!Array.isArray(value.capabilities)||value.capabilities.length>32||new Set(value.capabilities).size!==value.capabilities.length
     ||value.capabilities.some((v:unknown)=>typeof v!=='string'||!['SEATS','BENCHMARK','FORECAST','REPORTS','OPENAI_ASSISTANCE','SUPPLIER_INTELLIGENCE','EXPORTS'].includes(v))
     ||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=now()||Date.parse(value.expiresAt)>now()+6000
     ||(value.status==='INACTIVE'?(value.assignmentRef!==null||value.assignmentUntil!==null||value.capabilities.length!==0)
      :(!/^package-assignment:[a-f0-9-]{36}:[1-9][0-9]*$/.test(value.assignmentRef??'')||!value.capabilities.length||!Number.isFinite(Date.parse(value.assignmentUntil))||Date.parse(value.assignmentUntil)<=now())))
      throw Error('CURRENT_ENTITLEMENT_SCOPE_REQUIRED')
    return value as OrganisationPackageEntitlements
   }}:{}),
   ready:()=>ready(workspace,'/v1/organisation-access/ready'),async resolve(request:Request,input:Parameters<OrganisationWorkspaceAccess['resolve']>[1]){
   const value=await send(request,workspace,signWorkspace,accessPath)
   if(!value||Object.keys(value).sort().join(',')!=='applicationId,expiresAt,organisationId,status,userId'
    ||value.userId!==input.userId||value.organisationId!==input.organisationId||value.applicationId!==input.applicationId
    ||!['READY','PENDING_PACKAGE','UNAVAILABLE'].includes(value.status)||!Number.isFinite(Date.parse(value.expiresAt))
    ||Date.parse(value.expiresAt)<=now()||Date.parse(value.expiresAt)>now()+30000)throw Error('CURRENT_PACKAGE_SCOPE_REQUIRED')
   return {status:value.status} as {status:'READY'|'PENDING_PACKAGE'|'UNAVAILABLE'}
  }})
 })
}


/** Deployment opt-in only. Schema installation and peer enrolment are explicit
 * release operations; malformed or partially configured enablement fails shut. */
export function readOrganisationConnectionsConfiguration(env:Readonly<Record<string,string|undefined>>,configuration:RuntimeConfiguration){
 if(env.IDENTITY_ORGANISATION_BOOTSTRAP_ENABLED!=='true')return null
 const projection=env.IDENTITY_ORGANISATION_ACCESS_PROJECTION_ENABLED
 if(projection!==undefined&&!['true','false'].includes(projection)||projection==='true'&&env.IDENTITY_ORGANISATION_ACCESS_PROJECTION_SCHEMA_DIGEST!==organisationAccessProjectionSchemaDigest())throw Error('ACCESS_PROJECTION_CONFIGURATION_REQUIRED')
 const raw=JSON.parse(env.IDENTITY_ORGANISATION_CONNECTIONS??'null')
 const keys=['schemaVersion','lifecycleSchemaDigest','workspaceTargetId','workspaceRouteKey','registryOrigin','registryApplicationId','registryKeyId','registryPolicyRef','limitsOrigin','limitsKeyId']
 if(!raw||Object.getPrototypeOf(raw)!==Object.prototype||Object.keys(raw).sort().join(',')!==keys.sort().join(',')
  ||raw.schemaVersion!=='1.0.0'||raw.lifecycleSchemaDigest!==organisationLifecycleSchemaDigest()
  ||typeof raw.workspaceTargetId!=='string'||typeof raw.workspaceRouteKey!=='string'
  ||!configuration.targets[raw.workspaceTargetId]?.routes[raw.workspaceRouteKey]
  ||raw.registryApplicationId!=='srm-onboarding-development'||raw.limitsOrigin!=='https://limits-development.onrender.com'
  ||!/^https:\/\/[a-z0-9.-]+$/.test(raw.registryOrigin??'')||raw.registryOrigin===configuration.origin
  ||raw.registryOrigin===raw.limitsOrigin||typeof raw.registryPolicyRef!=='string'||!/^[-A-Za-z0-9._:]{1,256}$/.test(raw.registryPolicyRef)
  ||!/^[-a-z0-9]{2,64}$/.test(raw.registryKeyId??'')||!/^[-a-z0-9]{2,64}$/.test(raw.limitsKeyId??'')
  ||!/^[a-f0-9]{64}$/.test(env.IDENTITY_ORGANISATION_REGISTRY_PEER_KEY??'')
  ||!/^[a-f0-9]{64}$/.test(env.IDENTITY_ORGANISATION_LIMITS_PEER_KEY??''))throw Error('ORGANISATION_CONNECTIONS_CONFIGURATION_REQUIRED')
 const peer=(receiverApplicationId:string,targetOrigin:string,keyId:string,key:string,method:'GET'|'POST',path:string,maximumRequestBytes:number,requireIdempotencyKey:boolean):PeerOperationConfiguration=>({
  environment:'development',callerApplicationId:configuration.applicationId,receiverApplicationId,sourceOrigin:configuration.origin,targetOrigin,keyId,key:Buffer.from(key,'hex'),
  routes:[{method,path,maximumRequestBytes,requireIdempotencyKey}],internalOrigins:[]})
 return Object.freeze({...(projection==='true'?{accessProjectionSchemaDigest:organisationAccessProjectionSchemaDigest()}:{}),lifecycleSchemaDigest:raw.lifecycleSchemaDigest as string,workspaceTargetId:raw.workspaceTargetId as string,workspaceRouteKey:raw.workspaceRouteKey as string,
  sourcePolicyRef:raw.registryPolicyRef as string,
  registryPeer:peer(raw.registryApplicationId,raw.registryOrigin,raw.registryKeyId,env.IDENTITY_ORGANISATION_REGISTRY_PEER_KEY!,'POST','/api/organisation-onboarding/company',1024,true),
  workspacePeer:{...peer('package-limits-development',raw.limitsOrigin,raw.limitsKeyId,env.IDENTITY_ORGANISATION_LIMITS_PEER_KEY!,'GET','/v1/organisation-access',0,false),
   routes:[{method:'GET' as const,path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false},...(projection==='true'?[{method:'GET' as const,path:'/v1/organisation-entitlements',maximumRequestBytes:0,requireIdempotencyKey:false}]:[])]}})
}
