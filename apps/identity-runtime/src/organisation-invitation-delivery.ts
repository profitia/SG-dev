import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {createClerkAccountStatusReader,type ExternalIdentityKey} from '@profitia/platform-contracts/identity-provider'
import {createOrganisationLifecycleSql as createProfileSql,organisationEmailKey,openOrganisationInvitation,organisationLifecycleSchemaDigest,type OrganisationInvitationEnvelope} from '@profitia/platform-contracts/organisation-lifecycle'
import {organisationInvitationProofMatches} from '@profitia/platform-contracts/organisation-invitations'
import type {AccessQuery,AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import {createMailgunOrganisationInvitationSender,mailbox,type TransactionalMailgunConfig,type EmailContent} from './mailgun-delivery.js'
import {prepareOrganisationInvitationEmail,attachOrganisationInvitationAssets,type OrganisationInvitationEmail} from './invitation-email.js'
import type {RuntimeSdk} from './contracts.js'
import type {accountTransactions} from './account-provisioning.js'
type Claim={invitationId:string;organisationId:string;inviterUserId:string;recipientKey:string;tokenHash:string;createdAt:string;expiresAt:string;encryptedPayload:OrganisationInvitationEnvelope;leaseId:string;nonce:string;identity:ExternalIdentityKey|null}
type Payload={recipient:string;inviterUserId:string;email:OrganisationInvitationEmail}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
export function organisationInvitationMessageDigest(message:EmailContent&{recipient:string}):string{
 return hash(JSON.stringify({recipient:mailbox(message.recipient),subject:message.subject,html:message.html,text:message.text,
  inline:(message.inline??[]).map(asset=>({filename:asset.filename,sha256:hash(asset.bytes)}))}))
}
/** Same existing Identity process, ordinary SQL role and Mailgun transport.
 * Only a durable encrypted invitation claim may reach delivery. The final SQL
 * begin repeats current inviter rights under the authority fence immediately
 * before the single provider attempt. SENDING uncertainty never auto-resends. */
export function createOrganisationInvitationDelivery(options:{
 query:AccessQuery;transact:ReturnType<typeof accountTransactions>;client:RuntimeSdk;binding:AccessStoreBinding;issuer:string;schemaDigest:string
 proofKey:Uint8Array;encryptionKey:Uint8Array;keyId:string;identityOrigin:string;allowedIdentityOrigins:readonly string[]
 mailgun:Omit<TransactionalMailgunConfig,'recipientPolicy'>;fetch?:typeof fetch;prepare?:(input:OrganisationInvitationEmail)=>Promise<EmailContent>;pollMs?:number;autoStart?:boolean;now?:()=>number
 diagnostic?:(code:'organisation-mail-unavailable'|'organisation-mail-unknown')=>void
}){
 if(!(options.encryptionKey instanceof Uint8Array)||options.encryptionKey.byteLength!==32||!/^[A-Za-z0-9._:-]{1,100}$/.test(options.keyId))throw Error('ORGANISATION_DELIVERY_CONFIGURATION_REQUIRED')
 const now=options.now??Date.now,poll=options.pollMs??5000,key=Buffer.from(options.encryptionKey),proofKey=Buffer.from(options.proofKey)
 if(!Number.isInteger(poll)||poll<100||poll>60000||new URL(options.identityOrigin).origin!==options.identityOrigin
  ||!options.allowedIdentityOrigins.includes(options.identityOrigin))throw Error('ORGANISATION_DELIVERY_CONFIGURATION_REQUIRED')
 const sql=createProfileSql({binding:options.binding,issuer:options.issuer,schemaDigest:options.schemaDigest,proofKey,now})
 let stopped=false,running:Promise<void>|null=null
 const one=async(query:AccessQuery,text:string,args:unknown[]=[])=>{const result=await query(text,args);if(result.rows.length!==1)throw Error('ORGANISATION_DELIVERY_UNAVAILABLE');return result.rows[0]!}
 const ready=async()=>{
  await sql.descriptor(options.query)
  const d=(await one(options.query,'SELECT profitia_profile.organisation_lifecycle_descriptor() AS descriptor')).descriptor as {schemaDigest?:string}
  if(d?.schemaDigest!==organisationLifecycleSchemaDigest())throw Error('ORGANISATION_DELIVERY_UNAVAILABLE')
 }
 const settle=(claim:Claim,status:string,providerId:string|null=null)=>one(options.query,
  'SELECT profitia_profile.organisation_lifecycle_delivery_settle($1::uuid,$2::uuid,$3,$4,$5) AS settled',[claim.invitationId,claim.leaseId,claim.nonce,status,providerId])
 const processOne=async()=>{
  let claim:Claim|null=null,started=false,corruptPayload=false
  try{
   await ready()
   claim=(await one(options.query,'SELECT profitia_profile.organisation_lifecycle_delivery_claim($1::uuid,$2) AS claim',[randomUUID(),randomBytes(32).toString('hex')])).claim as Claim|null
   if(!claim)return
   const c=claim
   if(![c.invitationId,c.organisationId,c.inviterUserId,c.leaseId].every(v=>uuid.test(v??''))||!c.identity||c.identity.issuer!==options.issuer
    ||c.identity.environment!=='development'||typeof c.identity.subject!=='string'||c.identity.subject.length<1||c.identity.subject.length>256||/[\x00-\x1f\x7f]/.test(c.identity.subject)||!/^[a-f0-9]{64}$/.test(c.nonce??'')
    ||!/^[a-f0-9]{64}$/.test(c.recipientKey??'')||!/^[a-f0-9]{64}$/.test(c.tokenHash??''))throw Error('ORGANISATION_DELIVERY_UNAVAILABLE')
   if(stopped){await settle(c,'RELEASE');return}
   if(Date.parse(c.expiresAt)<=now()){await settle(c,'CANCELLED');return}
   corruptPayload=true
   const payload=openOrganisationInvitation(c.encryptedPayload,{key,keyId:options.keyId,invitationId:c.invitationId}) as Payload
   if(!payload||Object.keys(payload).sort().join(',')!=='email,inviterUserId,recipient'||payload.inviterUserId!==c.inviterUserId
    ||organisationEmailKey(payload.recipient,proofKey)!==c.recipientKey
    ||!organisationInvitationProofMatches(payload.email?.token,c.tokenHash)
    ||Date.parse(payload.email.createdAt)!==Date.parse(c.createdAt)||Date.parse(payload.email.expiresAt)!==Date.parse(c.expiresAt))throw Error('ORGANISATION_DELIVERY_UNAVAILABLE')
   corruptPayload=false
   // Fresh provider account observation; no invented HUMAN/session is issued.
   const user=await options.client.users.getUser(c.identity.subject)
   const observation=await createClerkAccountStatusReader({client:{users:{getUser:async()=>user}},environment:'development',issuer:options.issuer,now})(c.identity)
   const current=user as typeof user&{primaryEmailAddressId?:string;emailAddresses?:{id:string;emailAddress:string;verification?:{status?:string}}[]}
   const primary=current.emailAddresses?.find(e=>e.id===current.primaryEmailAddressId&&e.verification?.status==='verified')
   if(!observation||!primary||mailbox(primary.emailAddress).toLowerCase()!==mailbox(payload.email.inviterEmail).toLowerCase()){await settle(c,'CANCELLED');return}
   const content=options.prepare?await options.prepare(payload.email):await attachOrganisationInvitationAssets(await prepareOrganisationInvitationEmail(payload.email,{identityOrigin:options.identityOrigin,allowedIdentityOrigins:options.allowedIdentityOrigins,now}),options.fetch??fetch)
   const message={...content,recipient:mailbox(payload.recipient)}
   const messageDigest=organisationInvitationMessageDigest(message)
   const sender=createMailgunOrganisationInvitationSender(options.mailgun,async value=>{
    if(stopped||organisationInvitationMessageDigest(value)!==messageDigest)return false
    const allowed=await options.transact(async({query})=>{
     const proof=await sql.attest(query,{operation:'organisation.invitation.delivery',principal:c.invitationId,
      issuer:c.leaseId+':'+c.nonce+':'+messageDigest,expiresAt:Math.min(now()+4500,Date.parse(c.expiresAt),Date.parse(observation.expiresAt))})
     return(await one(query,'SELECT profitia_profile.organisation_lifecycle_delivery_begin($1::uuid,$2::uuid,$3,$4,$5::bigint,$6) AS allowed',
      [c.invitationId,c.leaseId,c.nonce,messageDigest,proof.until,proof.signature])).allowed===true
    },{timeoutMs:15000,maxWaitMs:3000})
    started=allowed;return allowed
   },options.fetch??fetch)
   const result=await sender(message)
   if(!started){await settle(c,stopped?'RELEASE':'CANCELLED');return}
   await settle(c,result.status==='accepted'?'ACCEPTED':result.status==='rejected'?'REJECTED':'UNKNOWN',result.status==='accepted'?result.providerId:null)
   if(result.status==='unknown')options.diagnostic?.('organisation-mail-unknown')
  }catch{
   if(claim)try{await settle(claim,started?'UNKNOWN':corruptPayload?'CANCELLED':'RELEASE')}catch{/* expired SENDING becomes UNKNOWN under durable reconciliation */}
   options.diagnostic?.('organisation-mail-unavailable')
  }
 }
 const tick=async()=>{if(stopped)return;if(!running)running=processOne().finally(()=>{running=null});await running}
 const timer=options.autoStart===false?null:setInterval(()=>{void tick()},poll);timer?.unref()
 return Object.freeze({ready,tick,async stop(){stopped=true;if(timer)clearInterval(timer);await running}})
}
