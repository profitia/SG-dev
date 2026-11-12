import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createAccessStore} from './access-store.mjs'
import {createClerkIdentityAuthenticator} from './identity-provider.mjs'
import {createProfileSql} from './identity-profile-sql.mjs'
import {createOperationExecutor,OPERATION_CONTRACT,ORGANISATION_LIFECYCLE_OPERATIONS,OperationDenied,operationPayloadDigest} from './operation-context.mjs'
import {normalizeInvitationEmail,normalizePolishNip,normalizeOrganisationSlug,normalizeProcurementCategories} from './organisation-profile.mjs'

export const ORGANISATION_LIFECYCLE_CONTRACT=Object.freeze({id:'profitia.organisation-lifecycle',version:'1.0.0'})
export const organisationLifecycleSchemaUrl=new URL('../migrations/profile/009-organisation-lifecycle.sql',import.meta.url).href
export const organisationLifecycleSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationLifecycleSchemaUrl))).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const exact=(v,keys)=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype
 &&Reflect.ownKeys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k))
 &&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d&&d.enumerable)
const unavailable=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const account=new Set(['organisation.onboarding.read','organisation.invitation.accept'])
const bootstrap=new Set(['organisation.company.lookup','organisation.slug.check'])
const resources=Object.freeze({
 'organisation.onboarding.read':['organisation_onboarding','ACCOUNT_PRIVATE'],
 'organisation.company.lookup':['organisation_bootstrap','ACCOUNT_PRIVATE'],
 'organisation.slug.check':['organisation_bootstrap','ACCOUNT_PRIVATE'],
 'organisation.procurement.write':['user_procurement_profile','USER_IN_ORGANISATION_PRIVATE'],
 'organisation.invitation.create':['organisation_invitation_batch','ORGANISATION_PRIVATE'],
 'organisation.invitation.accept':['organisation_invitation_acceptance','ACCOUNT_PRIVATE'],
 'organisation.activation.read':['organisation_activation','ORGANISATION_PRIVATE'],
})
function version(v){return typeof v==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(v)&&BigInt(v)<=9223372036854775806n}
export function normalizeOrganisationLifecycleInput(operation,value){
 if(!ORGANISATION_LIFECYCLE_OPERATIONS.includes(operation))throw TypeError('Unsupported organisation operation')
 if(['organisation.onboarding.read','organisation.activation.read'].includes(operation)){
  if(!exact(value,[]))throw TypeError('Empty current-account input required');return Object.freeze({})
 }
 if(operation==='organisation.company.lookup'){
  if(!exact(value,['nip','draftVersion'])||!version(value.draftVersion))throw TypeError('Versioned company lookup required')
  return Object.freeze({nip:normalizePolishNip(value.nip),draftVersion:value.draftVersion})
 }
 if(operation==='organisation.slug.check'){
  if(!exact(value,['slug']))throw TypeError('Explicit slug required')
  return Object.freeze({slug:normalizeOrganisationSlug(value.slug)})
 }
 if(operation==='organisation.procurement.write'){
  if(!exact(value,['expectedVersion','categories'])||!version(value.expectedVersion))throw TypeError('Versioned procurement categories required')
  return Object.freeze({expectedVersion:value.expectedVersion,categories:normalizeProcurementCategories(value.categories)})
 }
 if(operation==='organisation.invitation.create'){
  if(!exact(value,['commandId','emails'])||!uuid.test(value.commandId??'')||!Array.isArray(value.emails)||value.emails.length<1||value.emails.length>20)throw TypeError('Bounded invitation command required')
  // Retain positions, invalid values and duplicates for per-recipient outcomes.
  const emails=value.emails.map(v=>{try{return normalizeInvitationEmail(v)}catch{return null}})
  return Object.freeze({commandId:value.commandId.toLowerCase(),emails:Object.freeze(emails)})
 }
 if(!exact(value,['commandId','proof'])||!uuid.test(value.commandId??'')||!/^sgi1_[A-Za-z0-9_-]{43}$/.test(value.proof??''))throw TypeError('Explicit invitation proof required')
 return Object.freeze({commandId:value.commandId.toLowerCase(),proof:value.proof})
}
/** Domain-separated keyed index, never an unsalted email digest in telemetry. */
export function organisationEmailKey(email,key){
 if(!(key instanceof Uint8Array)||key.byteLength!==32)throw TypeError('Private email-index key required')
 return createHmac('sha256',key).update('profitia.organisation-email-index.v1\0').update(normalizeInvitationEmail(email)).digest('hex')
}
/** One encrypted immutable delivery payload. Raw proof/email never enters audit. */
export function sealOrganisationInvitation(payload,{key,keyId,invitationId}){
 if(!(key instanceof Uint8Array)||key.byteLength!==32||!uuid.test(invitationId??'')||!/^[-A-Za-z0-9._:]{1,100}$/.test(keyId??''))throw TypeError('Bound encryption configuration required')
 const plaintext=Buffer.from(JSON.stringify(payload));if(plaintext.length>24000)throw TypeError('Invitation payload too large')
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv)
 cipher.setAAD(Buffer.from('profitia.organisation-invitation-outbox.v1\0'+keyId+'\0'+invitationId))
 const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()])
 return Object.freeze({keyId,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('base64')})
}
export function openOrganisationInvitation(envelope,{key,keyId,invitationId}){
 if(!exact(envelope,['keyId','iv','tag','ciphertext'])||envelope.keyId!==keyId||!(key instanceof Uint8Array)||key.byteLength!==32
  ||!uuid.test(invitationId??'')||!/^[-A-Za-z0-9._:]{1,100}$/.test(keyId??'')||!/^[a-f0-9]{24}$/.test(envelope.iv??'')
  ||!/^[a-f0-9]{32}$/.test(envelope.tag??'')||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>32000)throw TypeError('Invalid invitation envelope')
 const bytes=Buffer.from(envelope.ciphertext,'base64');if(bytes.toString('base64')!==envelope.ciphertext)throw TypeError('Invalid invitation envelope')
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'hex'))
 decipher.setAAD(Buffer.from('profitia.organisation-invitation-outbox.v1\0'+keyId+'\0'+invitationId));decipher.setAuthTag(Buffer.from(envelope.tag,'hex'))
 return JSON.parse(Buffer.concat([decipher.update(bytes),decipher.final()]).toString('utf8'))
}
/** Same verified Clerk/AccessStore/Root and physical transaction as the rest of
 * the platform. The native adapter supplies business effects, never identity,
 * organisation IDs, permissions, products or an ALLOW object from the browser.
 * SQL009 independently checks attestation and the actual Root INTENT. */
export function createOrganisationLifecycleBackend(options){
 const {client,independentQuery,transact,schemaDigest,proofKey,now=Date.now}=options
 const binding=structuredClone(options.binding),application=structuredClone(options.application),identityApplication=structuredClone(options.identityApplication)
 if(binding.service!==undefined||application?.environment!=='development'||application.profileId!=='SPENDGURU_SAAS'
  ||application.organisationId!==null||application.features?.join(',')!=='organisation_admin'
  ||application.operations?.length!==ORGANISATION_LIFECYCLE_OPERATIONS.length||application.operations.some(op=>!ORGANISATION_LIFECYCLE_OPERATIONS.includes(op))
  ||identityApplication?.appId!==application.appId||identityApplication?.issuer!==application.identityIssuer
  ||identityApplication?.environment!==application.environment||identityApplication?.bearerPeerReads?.length
  ||typeof independentQuery!=='function'||typeof transact!=='function')throw TypeError('Same-receiver isolated organisation lifecycle required')
 const store=createAccessStore({binding,now}),sql=createProfileSql({binding,issuer:identityApplication.issuer,schemaDigest,proofKey,now}),digest=organisationLifecycleSchemaDigest()
 const descriptor=async query=>{
  await sql.descriptor(query)
  const {descriptor:d}=await sql.queryOne(query,'SELECT profitia_profile.organisation_lifecycle_descriptor() AS descriptor')
  if(d?.schemaDigest!==digest||!uuid.test(d?.policyId??'')||!/^[1-9][0-9]*$/.test(d?.policyVersion??'')
   ||!Array.isArray(d.operations)||ORGANISATION_LIFECYCLE_OPERATIONS.some(op=>!d.operations.includes(op)))unavailable()
  return d
 }
 return Object.freeze({contract:ORGANISATION_LIFECYCLE_CONTRACT,ready:()=>descriptor(independentQuery),
  async execute(httpRequest,operation,input,effect){
   const normalized=normalizeOrganisationLifecycleInput(operation,input)
   const expectedMethod=['organisation.onboarding.read','organisation.activation.read'].includes(operation)?'GET':'POST'
   if(!(httpRequest instanceof Request)||httpRequest.method!==expectedMethod||typeof effect!=='function')throw TypeError('Native current-account receiver required')
   let identityKey,selectedOrganisationId=null
   const authenticate=createClerkIdentityAuthenticator({client,application:identityApplication,now,resolveBinding:async key=>{
    identityKey=structuredClone(key);return store.resolveBinding(independentQuery,key)
   }})
   // The proof-bearing input is withheld from Root/audit payload entirely.
   const payload=operation==='organisation.invitation.accept'?{commandId:normalized.commandId,proofDigest:createHmac('sha256',proofKey).update('invitation.accept\0'+normalized.proof).digest('hex')}:normalized
   const resourceId='current-'+operation.replaceAll('.','-'),requests=new WeakMap()
   let externalActor
   const executor=createOperationExecutor({application,organisationLifecycleSchemaDigest:digest,now,
    authenticate:async request=>{externalActor=await authenticate(request);return externalActor},
    recordAudit:event=>store.appendAudit(independentQuery,event),
    withTransaction:async({actor,request},run)=>{
     let result,entered=false,finished=false,closed=false
     try{
      const committed=await transact(async session=>{
       if(entered||!session?.transaction||typeof session.query!=='function'||!identityKey)unavailable();entered=true
       const query=async(text,args)=>{if(closed)unavailable();const value=await session.query(text,args);if(closed)unavailable();return value}
       await query("SET LOCAL statement_timeout='12000ms'");await query("SET LOCAL lock_timeout='5000ms'")
       await query("SET LOCAL idle_in_transaction_session_timeout='15000ms'")
       await descriptor(query)
       if(operation==='organisation.invitation.accept')await sql.queryOne(query,'SELECT profitia_profile.organisation_lifecycle_lock() AS locked')
       const observedBinding=await store.resolveBinding(query,identityKey)
       let lease=await store.lockAccess(query,{actor,identityBinding:observedBinding,organisationId:null})
       const contextProof=await sql.attest(query,{operation:'organisation.lifecycle.context',principal:actor.userId,expiresAt:Math.min(Date.parse(actor.expiresAt),Date.parse(lease.expiresAt))})
       const {context}=await sql.queryOne(query,'SELECT profitia_profile.organisation_lifecycle_context($1::bigint,$2) AS context',[contextProof.until,contextProof.signature])
       if(!context||context.userId!==actor.userId||context.organisationId!==null&&!uuid.test(context.organisationId??''))unavailable()
       const orgMode=!account.has(operation)&&!bootstrap.has(operation)
       selectedOrganisationId=orgMode?context.organisationId:null
       if(orgMode){if(!selectedOrganisationId)throw new OperationDenied('PERMISSION_DENIED');lease=await store.lockAccess(query,{actor,identityBinding:observedBinding,organisationId:selectedOrganisationId})}
       const proof=await sql.attest(query,{operation:'organisation.lifecycle.admit',principal:actor.userId,
        issuer:[operation,resourceId,request.payloadDigest,selectedOrganisationId??''].join(':'),expiresAt:Math.min(Date.parse(actor.expiresAt),Date.parse(lease.expiresAt))})
       const {policy}=await sql.queryOne(query,'SELECT profitia_profile.organisation_lifecycle_admit($1,$2,$3,$4::uuid,$5::bigint,$6) AS policy',
        [operation,resourceId,request.payloadDigest,selectedOrganisationId,proof.until,proof.signature])
       if(!policy||policy.schemaDigest!==digest)unavailable()
       policy.expiresAt=new Date(Math.min(Date.parse(policy.expiresAt),Date.parse(lease.expiresAt),now()+29000)).toISOString()
       const [type,dataClass]=resources[operation],own=dataClass==='ACCOUNT_PRIVATE'||dataClass==='USER_IN_ORGANISATION_PRIVATE'
       const state={...lease.state,lifecyclePolicy:policy,resource:{id:resourceId,type,dataClass,environment:binding.environment,
        ownerOrganisationId:selectedOrganisationId,ownerUserId:own?actor.userId:null,version:context.version??'1',projectionVersion:'organisation-lifecycle-v1',...(operation==='organisation.procurement.write'?{contentRequirements:[]}:{} )}}
       if(!orgMode)state.access={...state.access,type:bootstrap.has(operation)?'BOOTSTRAP':'ACCOUNT_SELF',version:policy.policyVersion,sourceRef:policy.sourceRef,
        permissions:[{operation,feature:'organisation_admin',resourceId}],denies:state.access.denies}
       if(bootstrap.has(operation))state.usagePolicy='ONBOARDING_POLICY'
       state.access={...state.access,expiresAt:policy.expiresAt}
       requests.set(session.transaction,{query,context,lease,actor:externalActor,identityKey:structuredClone(identityKey)})
       const recheck=createClerkIdentityAuthenticator({client,application:identityApplication,now,resolveBinding:key=>store.resolveBinding(query,key)})
       try{
        result=await run({state,transaction:session.transaction,transactionalEffects:true,outputBoundaryVersion:'organisation-lifecycle-v1',projectOutput:value=>value,
         recordOutcome:async event=>{
          const current=await recheck(httpRequest);if(!current||current.userId!==actor.userId||current.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID')
          await descriptor(query);await store.appendAudit(query,event,lease)
         }})
        await store.verifyScope(query,lease);finished=true;return result
       }finally{requests.delete(session.transaction)}
      },{timeoutMs:15000,maxWaitMs:5000})
      if(!entered||!finished||committed!==result)unavailable();return committed
     }finally{closed=true}
    }})
   // Resolve organisation only within the host transaction. This getter is read
   // after withTransaction by Root; a browser can never supply tenant selection.
   // Root snapshots input before awaits, so resolve it through a verified own
   // context transaction first, then require exact equality under the real lease.
   let target=null
   if(!account.has(operation)&&!bootstrap.has(operation)){
    const actor=await authenticate(httpRequest);if(!actor?.userId)throw new OperationDenied('UNVERIFIED_IDENTITY')
    target=await transact(async({query})=>{
     const observed=await store.resolveBinding(query,identityKey),lease=await store.lockAccess(query,{actor,identityBinding:observed,organisationId:null})
     const proof=await sql.attest(query,{operation:'organisation.lifecycle.context',principal:actor.userId,expiresAt:Math.min(Date.parse(actor.expiresAt),Date.parse(lease.expiresAt))})
     const {context}=await sql.queryOne(query,'SELECT profitia_profile.organisation_lifecycle_context($1::bigint,$2) AS context',[proof.until,proof.signature])
     await store.verifyScope(query,lease);return context?.organisationId??null
    },{timeoutMs:15000,maxWaitMs:5000})
    if(!uuid.test(target??''))throw new OperationDenied('PERMISSION_DENIED')
   }
   const value=await executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,resourceId,organisationId:target,
    payload,...(bootstrap.has(operation)?{idempotencyKey:randomUUID()}:{}),request:httpRequest},async(context,transaction)=>{
     const unit=requests.get(transaction);if(!unit||context.organisationId!==selectedOrganisationId)unavailable()
     return effect(Object.freeze({context,query:unit.query,profile:unit.context,actor:unit.actor,identityKey:unit.identityKey,input:normalized,products:unit.lease.state.products}))
    })
   return value.value
  }
 })
}
