import {createHash,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createClerkIdentityAuthenticator} from './identity-provider.mjs'
import {createPrivateOperationHost} from './private-operation-host.mjs'
import {OPERATION_CONTRACT,OperationDenied} from './operation-context.mjs'
import {createProfileSql,ProfileConflict} from './identity-profile-sql.mjs'

/** Platform data contract only. This module grants no access and performs no I/O.
 * Identity owns the workflow; consumers use an authorised platform projection.
 */
export const ORGANISATION_PROFILE_CONTRACT=Object.freeze({id:'profitia.organisation-profile',version:'1.0.0'})
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
const closed=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype
 &&Reflect.ownKeys(value).length===Object.keys(value).length
 &&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d&&d.enumerable)
const exact=(value,keys)=>closed(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
export class OrganisationProfileError extends Error{
 constructor(code){super('Invalid organisation profile input');this.name='OrganisationProfileError';this.code=code}
}
const fail=code=>{throw new OrganisationProfileError(code)}
function label(value,max,code){
 if(typeof value!=='string'||value.length>max*4||/[\p{Cc}\p{Cf}]/u.test(value))fail(code)
 const result=value.normalize('NFC').trim().replace(/ {2,}/g,' ')
 if(!result||[...result].length>max)fail(code)
 return result
}
export function normalizePolishNip(value){
 if(typeof value!=='string'||value.length>40||! /^(?:PL)?[0-9 -]+$/i.test(value))fail('INVALID_NIP')
 const nip=value.replace(/^PL/i,'').replace(/[ -]/g,'')
 if(!/^[0-9]{10}$/.test(nip)||/^([0-9])\1{9}$/.test(nip))fail('INVALID_NIP')
 const checksum=[6,5,7,2,3,4,5,6,7].reduce((n,w,i)=>n+w*Number(nip[i]),0)%11
 if(checksum===10||checksum!==Number(nip[9]))fail('INVALID_NIP')
 return nip
}
const reserved=new Set(['www','app','api','admin','auth','identity','account','accounts','login','register','registration','onboarding','mail','email','smtp','support','help','docs','status','billing','payments','assets','static','cdn','staging','development','production','localhost','root','system'])
export function normalizeOrganisationSlug(value){
 if(typeof value!=='string'||value.length>48)fail('INVALID_ORGANISATION_SLUG')
 const slug=value.trim().toLowerCase()
 if(!/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug)||slug.includes('--')||reserved.has(slug))fail('INVALID_ORGANISATION_SLUG')
 return slug
}
export function suggestOrganisationSlug(legalName){
 const name=label(legalName,240,'INVALID_COMPANY_NAME')
 const shortened=name.replace(/\s+(?:sp[oó]łka\s+akcyjna|s\.?\s*a\.?|sp\.?\s*z\s*o\.?\s*o\.?)$/i,'')
 const ascii=shortened.replace(/[Łł]/g,'l').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'')
 try{return normalizeOrganisationSlug(ascii)}catch{return 'moja-organizacja'}
}
export const PROCUREMENT_INDUSTRIES=freeze([
 {id:'construction',label:'Budownictwo',categories:[
  {id:'construction.concrete',label:'Beton i prefabrykaty'},{id:'construction.asphalt',label:'Asfalt i lepiszcza'},
  {id:'construction.aggregate',label:'Kruszywa'},{id:'construction.steel',label:'Stal zbrojeniowa'},{id:'construction.services',label:'Usługi budowlane'}]},
 {id:'manufacturing',label:'Przemysł i produkcja',categories:[
  {id:'manufacturing.metals',label:'Metale i półprodukty'},{id:'manufacturing.components',label:'Tworzywa i komponenty'},
  {id:'manufacturing.maintenance',label:'Części i utrzymanie ruchu'},{id:'manufacturing.energy',label:'Energia'},{id:'manufacturing.logistics',label:'Transport i logistyka'}]},
 {id:'food',label:'Żywność i napoje',categories:[
  {id:'food.ingredients',label:'Surowce spożywcze'},{id:'food.packaging',label:'Opakowania'},
  {id:'food.additives',label:'Dodatki i składniki'},{id:'food.hygiene',label:'Higiena i środki myjące'},{id:'food.logistics',label:'Transport i chłodnictwo'}]},
 {id:'other',label:'Inna',categories:[]}
])
const industries=new Map(PROCUREMENT_INDUSTRIES.map(i=>[i.id,i]))
const catalogue=new Map(PROCUREMENT_INDUSTRIES.flatMap(i=>i.categories).map(c=>[c.id,c]))
export const PROCUREMENT_TEAM_RANGES=freeze([
 {id:'1-5',label:'1–5 osób',minimum:1,maximum:5},
 {id:'6-10',label:'6–10 osób',minimum:6,maximum:10},
 {id:'11+',label:'11 osób lub więcej',minimum:11,maximum:null}
])
export function normalizeIndustry(value){
 if(!closed(value)||!exact(value,value.id==='other'?['id','label']:['id'])||!industries.has(value.id))fail('INVALID_INDUSTRY')
 return freeze({id:value.id,label:value.id==='other'?label(value.label,100,'INVALID_INDUSTRY'):industries.get(value.id).label,source:'USER'})
}
export function normalizeProcurementCategories(value){
 if(!Array.isArray(value)||value.length<1||value.length>50)fail('INVALID_CATEGORIES')
 const normalized=new Map()
 for(const item of value){
  let selected
  if(exact(item,['catalogueId'])&&catalogue.has(item.catalogueId)){
   const c=catalogue.get(item.catalogueId);selected={catalogueId:c.id,label:c.label,source:'USER'}
  }else if(exact(item,['customName']))selected={catalogueId:null,label:label(item.customName,100,'INVALID_CATEGORIES'),source:'USER'}
  else fail('INVALID_CATEGORIES')
  const key=selected.label.toLocaleLowerCase('pl-PL')
  const previous=normalized.get(key)
  if(!previous||selected.catalogueId&&!previous.catalogueId)normalized.set(key,{...selected,key})
 }
 if(normalized.size>20)fail('TOO_MANY_CATEGORIES')
 return freeze([...normalized.values()])
}
export function normalizeTeamRange(value){
 const range=PROCUREMENT_TEAM_RANGES.find(r=>r.id===value)
 if(!range)fail('INVALID_TEAM_RANGE')
 return freeze({...range,includesRespondent:true,source:'USER'})
}
/** Call only with a server-owned registry result, never a submitted company DTO.
 * A KRS identifier alone does not prove that a registry entity is a company.
 */
export function normalizeCompanyRecord(value,expectedNip){
 if(!exact(value,['entityType','country','nip','krs','regon','legalName','address','postalCode'])
   ||value.entityType!=='COMPANY'||value.country!=='PL')fail('COMPANY_REQUIRED')
 const nip=normalizePolishNip(value.nip)
 if(nip!==normalizePolishNip(expectedNip))fail('COMPANY_NIP_MISMATCH')
 if(typeof value.krs!=='string'||!/^\d{10}$/.test(value.krs)||/^0+$/.test(value.krs)
  ||typeof value.regon!=='string'||!/^\d{9}(?:\d{5})?$/.test(value.regon)||/^0+$/.test(value.regon))fail('INVALID_COMPANY_IDENTIFIERS')
 if(typeof value.postalCode!=='string'||!/^\d{2}-\d{3}$/.test(value.postalCode))fail('INVALID_COMPANY_ADDRESS')
 return freeze({entityType:'COMPANY',country:'PL',nip,krs:value.krs,regon:value.regon,
  legalName:label(value.legalName,240,'INVALID_COMPANY_NAME'),address:label(value.address,400,'INVALID_COMPANY_ADDRESS'),postalCode:value.postalCode})
}
export function normalizeInvitationEmail(input){
 if(typeof input!=='string'||input.length>254||/[\p{Cc}\p{Cf}]/u.test(input)||/\s/u.test(input.trim()))fail('INVALID_INVITATION_EMAILS')
 const email=input.trim().toLowerCase()
 if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)
  ||email.split('@')[0].length>64||email.includes('..')||email.startsWith('.')||email.includes('.@')
  ||email.split('@')[1].split('.').some(part=>!part||part.length>63||part.startsWith('-')||part.endsWith('-')))fail('INVALID_INVITATION_EMAILS')
 return email
}
export function normalizeInvitationEmails(value,ownEmail){
 if(!Array.isArray(value)||value.length<1||value.length>20)fail('INVALID_INVITATION_EMAILS')
 const own=normalizeInvitationEmail(ownEmail),emails=[...new Set(value.map(normalizeInvitationEmail))]
 if(emails.includes(own))fail('CANNOT_INVITE_SELF')
 return freeze(emails)
}
/** Idempotency fingerprints stay server-private; never use unsalted email/NIP
 * digests in telemetry. The operation key is persisted separately by the owner.
 */
export function organisationCommandDigest(value){
 if(!closed(value))fail('INVALID_COMMAND')
 const encode=v=>{
  if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v)
  if(typeof v==='number'&&Number.isSafeInteger(v))return JSON.stringify(v)
  if(Array.isArray(v))return '['+v.map(encode).join(',')+']'
  if(closed(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+encode(v[k])).join(',')+'}'
  fail('INVALID_COMMAND')
 }
 return createHash('sha256').update(encode(value)).digest('hex')
}

export function normalizeOnboardingDraftPatch(value){
 if(!closed(value)||Object.keys(value).length===0||Object.keys(value).some(k=>!['nip','slug','industry','categories','teamRange'].includes(k)))fail('INVALID_ONBOARDING_DRAFT')
 const out={}
 for(const [key,item]of Object.entries(value)){
  if(key==='nip')out.nip=normalizePolishNip(item)
  else if(key==='slug')out.slug=normalizeOrganisationSlug(item)
  else if(key==='industry')out.industry=normalizeIndustry(item)
  else if(key==='categories')out.categories=normalizeProcurementCategories(item)
  else out.teamRange=normalizeTeamRange(item)
 }
 return freeze(out)
}
export const organisationOnboardingSchemaUrl=new URL('../migrations/profile/007-organisation-onboarding.sql',import.meta.url).href
export const organisationOnboardingSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationOnboardingSchemaUrl))).digest('hex')
/** Own-account registration draft only. It cannot create an organisation,
 * membership, permission, invitation or product grant. Those require their
 * independently authorised bootstrap/organisation operations.
 */
export function createOrganisationOnboardingDraftBackend(options){
 const {client,identityApplication,application,binding,independentQuery,transact,schemaDigest,proofKey,now=Date.now}=options
 if(identityApplication?.appId!==application?.appId||identityApplication?.issuer!==application?.identityIssuer
  ||identityApplication?.environment!==application?.environment||application?.organisationId!==null
  ||application?.operations?.join(',')!=='account.settings.read,account.settings.write'||application?.features?.join(',')!=='account'
  ||identityApplication?.bearerPeerReads?.length)throw TypeError('Same-receiver account-self draft application required')
 const sql=createProfileSql({binding,issuer:identityApplication.issuer,schemaDigest,proofKey,now})
 const queries=new WeakMap()
 async function descriptor(query){
  await sql.descriptor(query)
  const {descriptor:d}=await sql.queryOne(query,'SELECT profitia_profile.organisation_onboarding_descriptor() AS descriptor')
  if(d?.schemaDigest!==organisationOnboardingSchemaDigest()||d?.enabled!==true)throw new OperationDenied('POLICY_UNAVAILABLE')
 }
 const host=createPrivateOperationHost({application,binding,independentQuery,now,
  createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client,application:identityApplication,resolveBinding,now}),
  transact:(run,limits)=>transact(async session=>{
   if(!session?.transaction||typeof session.query!=='function')throw new OperationDenied('POLICY_UNAVAILABLE')
   queries.set(session.transaction,session.query)
   try{return await run(session)}finally{queries.delete(session.transaction)}
  },limits),
  readResources:async({actor,request,query})=>{
   await descriptor(query)
   const proof=await sql.attest(query,{operation:request.operation,principal:actor.userId,expiresAt:Date.parse(actor.expiresAt)})
   await query("SELECT set_config('profitia.profile.operation',$1,true),set_config('profitia.profile.expires_ms',$2,true),set_config('profitia.profile.signature',$3,true)",[request.operation,String(proof.until),proof.signature])
   return {resource:{id:'current-organisation-onboarding',type:'account_settings',dataClass:'ACCOUNT_PRIVATE',
    ownerOrganisationId:null,ownerUserId:actor.userId,environment:binding.environment,version:'organisation-draft-v1',projectionVersion:'organisation-draft-v1'}}
  },projectOutput:value=>value})
 async function execute(request,input){
  if(!(request instanceof Request)||request.method!==(input?'POST':'GET'))throw new OperationDenied('PERMISSION_DENIED')
  let patch,expectedVersion
  if(input){
   if(!exact(input,['expectedVersion','patch'])||typeof input.expectedVersion!=='string'||! /^(0|[1-9][0-9]{0,18})$/.test(input.expectedVersion)
    ||BigInt(input.expectedVersion)>9223372036854775806n)fail('INVALID_ONBOARDING_DRAFT')
   patch=normalizeOnboardingDraftPatch(input.patch);expectedVersion=input.expectedVersion
  }
  const operation=input?'account.settings.write':'account.settings.read'
  let conflict=false,result
  try{result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,
   resourceId:'current-organisation-onboarding',organisationId:null,request,
   payload:{changeId:randomUUID(),fields:patch?Object.keys(patch):[],expectedVersion:expectedVersion??null}},async(_context,transaction)=>{
    const query=queries.get(transaction)
    try{return(await sql.queryOne(query,input?'SELECT profitia_profile.organisation_onboarding_save($1::bigint,$2::jsonb) AS draft':'SELECT profitia_profile.organisation_onboarding_read() AS draft',input?[expectedVersion,JSON.stringify(patch)]:[])).draft}
    catch(error){if(error instanceof ProfileConflict)conflict=true;throw error}
   })}catch(error){if(conflict&&error?.reasonCode==='POLICY_UNAVAILABLE')throw new ProfileConflict();throw error}
  return result.value
 }
 return Object.freeze({ready:()=>descriptor(independentQuery),readCurrentDraft:request=>execute(request),saveCurrentDraft:(request,input)=>execute(request,input)})
}

/** Plan against a server-owned snapshot from the TARGET organisation only.
 * This is not authorization or a delivery receipt. The repository must repeat
 * current membership/pending-invitation checks inside the enqueue transaction.
 * A registered account in another organisation is intentionally not a blocker.
 */
export function classifyOrganisationInvitations(input,{now=Date.now}={}){
 if(!exact(input,['organisationId','ownEmail','candidates','observations'])
  ||typeof input.organisationId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.organisationId)
  ||!exact(input.observations,['organisationId','members','pendingInvitations'])
  ||input.observations.organisationId!==input.organisationId)fail('INVITATION_OBSERVATION_SCOPE_MISMATCH')
 if(!Array.isArray(input.candidates)||input.candidates.length<1||input.candidates.length>20
  ||!Array.isArray(input.observations.members)||input.observations.members.length>2000
  ||!Array.isArray(input.observations.pendingInvitations)||input.observations.pendingInvitations.length>2000)fail('INVALID_INVITATION_BATCH')
 const own=normalizeInvitationEmail(input.ownEmail),members=new Map(),pending=new Set(),seen=new Set(),time=now()
 if(!Number.isSafeInteger(time))fail('INVALID_INVITATION_BATCH')
 for(const member of input.observations.members){
  if(!exact(member,['email','status'])||!['ACTIVE','SUSPENDED','EXPIRED'].includes(member.status))fail('INVALID_INVITATION_OBSERVATION')
  const email=normalizeInvitationEmail(member.email),old=members.get(email)
  if(old&&old!==member.status)fail('INVALID_INVITATION_OBSERVATION')
  members.set(email,member.status)
 }
 for(const invitation of input.observations.pendingInvitations){
  if(!exact(invitation,['email','expiresAt'])||typeof invitation.expiresAt!=='string'||!Number.isFinite(Date.parse(invitation.expiresAt)))fail('INVALID_INVITATION_OBSERVATION')
  const email=normalizeInvitationEmail(invitation.email)
  if(Date.parse(invitation.expiresAt)>time)pending.add(email)
 }
 const items=input.candidates.map((value,index)=>{
  let email
  try{email=normalizeInvitationEmail(value)}catch(error){if(!(error instanceof OrganisationProfileError))throw error;return {index,email:null,status:'INVALID_EMAIL'}}
  if(seen.has(email))return {index,email,status:'DUPLICATE'}
  seen.add(email)
  const member=members.get(email)
  const status=email===own?'SELF':member==='ACTIVE'?'ALREADY_MEMBER':member?'MEMBERSHIP_REQUIRES_REVIEW':pending.has(email)?'ALREADY_INVITED':'READY'
  return {index,email,status}
 })
 const readyEmails=items.filter(i=>i.status==='READY').map(i=>i.email)
 return freeze({organisationId:input.organisationId,items,readyEmails,counts:{ready:readyEmails.length,skipped:items.length-readyEmails.length}})
}
