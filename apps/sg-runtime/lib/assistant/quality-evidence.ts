import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto'
import {readQualityEvidence,type QualityEvidence} from '../../../../packages/assistant-context-contracts/src/quality.mjs'
import type {AccessQuery} from '@profitia/platform-contracts/access-store'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'

type Purpose=QualityEvidence['purpose']
export type QualityEvidenceAuthority=Readonly<{
 applicationId:'spendguru';environment:'development';operation:'assistant.quality.capture'|'assistant.quality.read'
 actorKind:'HUMAN'|'SERVICE';actorId:string;accountId:string;purpose:Purpose
 storageGeneration:string;validUntil:number;sourceScopes:QualityEvidence['sourceScopes']
}>
export type QualityEvidenceDemand=Readonly<{action:'CAPTURE'|'READ';accountId:string;evidenceId:string;sourceScopes?:QualityEvidence['sourceScopes'];inputSha256?:string;occurredAt?:string;earliestInputAt?:string}>
type Demand=QualityEvidenceDemand
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const fail=():never=>{throw Object.assign(Error('Quality evidence unavailable'),{code:'QUALITY_EVIDENCE_UNAVAILABLE'})}
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical((v as Record<string,unknown>)[k])])):v
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
/** Private product storage only. authorize is a trusted fresh E1/purpose/source
 * and storage-generation check; no request-supplied allow/grant is accepted.
 * The caller must keep this role and encryption key outside the repair agent.
 * A missing authorizer/storage witness fails closed, including after recovery. */
export function createQualityEvidenceStore(options:{
 query:AccessQuery;commandKey:string;storageKey:string;schemaDigest:string;serviceId:string;storageGeneration:string
 role:'sg2_assistant_quality_capture'|'sg2_assistant_quality_reader'
 authorize:(demand:Demand)=>Promise<QualityEvidenceAuthority>;now?:()=>number
}){
 if(!digest(options.commandKey)||!digest(options.storageKey)||options.commandKey===options.storageKey
  ||!digest(options.schemaDigest)||!uuid(options.serviceId)||!uuid(options.storageGeneration)
  ||typeof options.authorize!=='function')throw TypeError('Explicit private QA binding required')
 const key=Buffer.from(options.commandKey,'hex'),storage=Buffer.from(options.storageKey,'hex'),now=options.now??Date.now
 async function authority(demand:Demand){
  const a=await options.authorize(demand),at=now()
  if(!a||a.applicationId!=='spendguru'||a.environment!=='development'||a.accountId!==demand.accountId
   ||a.operation!==(demand.action==='CAPTURE'?'assistant.quality.capture':'assistant.quality.read')
   ||a.actorKind!==(demand.action==='CAPTURE'?'HUMAN':'SERVICE')||!uuid(a.actorId)
   ||demand.action==='CAPTURE'&&a.actorId!==a.accountId||a.purpose?.id!=='ASSISTANT_QUALITY'
   ||!uuid(a.purpose.grantId)||!Number.isFinite(Date.parse(a.purpose.validUntil))||Date.parse(a.purpose.validUntil)<=at||!Number.isFinite(a.validUntil)||a.validUntil<=at||a.validUntil>at+30000
   ||a.storageGeneration!==options.storageGeneration
   ||demand.sourceScopes&&!same(a.sourceScopes,demand.sourceScopes))return fail()
  return a
 }
 async function call(action:string,payload:Record<string,unknown>={}){
  const body=JSON.stringify({contract:'QualityEvidenceStore/1.0.0',action,...payload,schemaDigest:options.schemaDigest,
   serviceId:options.serviceId,storageGeneration:options.storageGeneration,until:now()+10000})
  let rows
  try{rows=(await options.query('SELECT sg2_assistant_quality_evidence.apply($1::text,$2::text) AS result',[body,createHmac('sha256',key).update(body).digest('hex')])).rows}catch{return fail()}
  const b=rows?.[0]?.result as Record<string,unknown>|undefined
  if(rows?.length!==1||!b||b.applicationId!=='spendguru'||b.environment!=='development'||b.projectId!=='autumn-waterfall-65938876'
   ||b.branchId!=='br-dry-hall-b294222f'||b.databaseName!=='neondb'||b.runtimeRole!==options.role
   ||b.schemaDigest!==options.schemaDigest||b.serviceId!==options.serviceId||b.storageGeneration!==options.storageGeneration)return fail()
  return b
 }
 const aad=(accountId:string,evidenceId:string)=>Buffer.from(JSON.stringify(['QualityEvidenceStore/1.0.0',options.serviceId,options.storageGeneration,accountId,evidenceId]))
 return Object.freeze({
  descriptor:()=>call('DESCRIPTOR'),
  async capture(value:unknown){
   if(options.role!=='sg2_assistant_quality_capture')return fail()
   const evidence=readQualityEvidence(value,{now:now()}),a=await authority({action:'CAPTURE',accountId:evidence.accountId,evidenceId:evidence.evidenceId,sourceScopes:evidence.sourceScopes,inputSha256:hash(JSON.stringify(evidence.modelInput)),occurredAt:evidence.occurredAt,earliestInputAt:evidence.earliestInputAt})
   if(!same(a.purpose,evidence.purpose))return fail()
   const plain=JSON.stringify(evidence),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',storage,nonce)
   cipher.setAAD(aad(evidence.accountId,evidence.evidenceId))
   const ciphertext=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()])
   const sealed={nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}
   const result=await call('PUT',{accountId:evidence.accountId,evidenceId:evidence.evidenceId,interactionId:evidence.interactionId,
    occurredAt:evidence.occurredAt,earliestInputAt:evidence.earliestInputAt,expiresAt:evidence.expiresAt,purposeGrantId:evidence.purpose.grantId,
    plaintextSha256:hash(plain),sealed})
   if(result.stored!==true)return fail()
   return Object.freeze({evidenceId:evidence.evidenceId,expiresAt:evidence.expiresAt})
  },
  async read(accountId:string,evidenceId:string):Promise<QualityEvidence>{
   if(options.role!=='sg2_assistant_quality_reader'||!uuid(accountId)||!uuid(evidenceId))return fail()
   await authority({action:'READ',accountId,evidenceId})
   const result=await call('GET',{accountId,evidenceId}),s=result.sealed as Record<string,string>|undefined
   if(!s||!digest(result.plaintextSha256)||typeof s.ciphertext!=='string'||s.ciphertext.length>262144
    ||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s.ciphertext))return fail()
   let evidence:QualityEvidence
   try{
    const nonce=Buffer.from(s.nonce,'base64'),tag=Buffer.from(s.tag,'base64')
    if(nonce.length!==12||tag.length!==16)return fail()
    const decipher=createDecipheriv('aes-256-gcm',storage,nonce);decipher.setAAD(aad(accountId,evidenceId));decipher.setAuthTag(tag)
    const plain=Buffer.concat([decipher.update(Buffer.from(s.ciphertext,'base64')),decipher.final()]).toString('utf8')
    if(hash(plain)!==result.plaintextSha256)return fail()
    evidence=readQualityEvidence(JSON.parse(plain),{now:now()})
    if(evidence.accountId!==accountId||evidence.evidenceId!==evidenceId)return fail()
   }catch{return fail()}
   await authority({action:'READ',accountId,evidenceId,sourceScopes:evidence.sourceScopes,inputSha256:hash(JSON.stringify(evidence.modelInput)),occurredAt:evidence.occurredAt,earliestInputAt:evidence.earliestInputAt})
   return evidence
  },
  async purge(){const r=await call('PURGE');if(!Number.isSafeInteger(r.removed)||Number(r.removed)<0)return fail();return Number(r.removed)},
 })
}


/** Canonical E1 purpose client. The database authenticates the actual ordinary
 * role, enrolled controlled-input hash, current grants and independent deletion
 * epoch. A SERVICE cannot submit a HUMAN decision or invalidate user history.
 * This port carries only metadata; raw prompts/output never enter E1. */
export function createQualityEvidencePurposeClient(options:{
 query:AccessQuery;commandKey:string;schemaDigest:string;serviceId:string;storageGeneration:string
 role:'sg2_private_development_runtime'|'sg2_assistant_quality_authority';now?:()=>number
}){
 if(!digest(options.commandKey)||!digest(options.schemaDigest)||!uuid(options.serviceId)||!uuid(options.storageGeneration)
  ||!['sg2_private_development_runtime','sg2_assistant_quality_authority'].includes(options.role))throw TypeError('Explicit canonical QA purpose binding required')
 const key=Buffer.from(options.commandKey,'hex'),now=options.now??Date.now
 function human(context:Readonly<OperationContext>|undefined,accountId:string){
  if(options.role!=='sg2_private_development_runtime'||!context||context.applicationId!=='spendguru'||context.environment!=='development'
   ||context.operation!=='assistant.history.write'||context.organisationId!==null||context.actor?.kind!=='HUMAN'
   ||context.actorId!==accountId||context.actor.actorId!==accountId||!uuid(context.decisionId)
   ||!Number.isFinite(Date.parse(context.actor.expiresAt))||Date.parse(context.actor.expiresAt)<=now())return fail()
  return context.decisionId
 }
 async function call(action:'DESCRIPTOR'|'CAPTURE'|'READ'|'INVALIDATE',fields:Record<string,unknown>={}){
  const body=JSON.stringify({contract:'QualityPurposeAuthority/1.0.0',action,schemaDigest:options.schemaDigest,
   storageGeneration:options.storageGeneration,serviceId:options.serviceId,until:now()+10000,...fields})
  if(Buffer.byteLength(body)>32768)return fail()
  let rows
  try{rows=(await options.query('SELECT profitia_assistant_quality_access.apply($1::text,$2::text) AS result',
   [body,createHmac('sha256',key).update(body).digest('hex')])).rows}catch{return fail()}
  const result=rows?.[0]?.result as Record<string,unknown>|undefined
  if(rows?.length!==1||!result||result.applicationId!=='spendguru'||result.environment!=='development'
   ||result.projectId!=='spring-bread-28217539'||result.branchId!=='br-sparkling-term-b99l107x'||result.databaseName!=='platform_private'
   ||result.runtimeRole!==options.role||result.schemaDigest!==options.schemaDigest||result.serviceId!==options.serviceId
   ||result.storageGeneration!==options.storageGeneration||result.dataMode!=='CONTROLLED_ACCEPTANCE')return fail()
  return result
 }
 return Object.freeze({
  descriptor:()=>call('DESCRIPTOR'),
  async authorize(demand:Demand,context?:Readonly<OperationContext>):Promise<QualityEvidenceAuthority & {expiresAt:string;inputSha256:string}>{
   if(!['CAPTURE','READ'].includes(demand.action)||!uuid(demand.accountId)||!uuid(demand.evidenceId))return fail()
   let fields:Record<string,unknown>
   if(demand.action==='CAPTURE'){
    const decisionId=human(context,demand.accountId)
    if(!digest(demand.inputSha256)||!demand.occurredAt||!demand.earliestInputAt)return fail()
    fields={accountId:demand.accountId,evidenceId:demand.evidenceId,decisionId,inputSha256:demand.inputSha256,
     sourceScopes:demand.sourceScopes??null,occurredAt:demand.occurredAt,earliestInputAt:demand.earliestInputAt}
   }else{
    if(options.role!=='sg2_assistant_quality_authority'||context)return fail()
    fields={accountId:demand.accountId,evidenceId:demand.evidenceId,sourceScopes:demand.sourceScopes??null}
   }
   const result=await call(demand.action,fields),authority=result as unknown as QualityEvidenceAuthority
   if(authority.accountId!==demand.accountId||authority.operation!==(demand.action==='CAPTURE'?'assistant.quality.capture':'assistant.quality.read')
    ||authority.actorKind!==(demand.action==='CAPTURE'?'HUMAN':'SERVICE')
    ||authority.actorId!==(demand.action==='CAPTURE'?demand.accountId:options.serviceId)
    ||!digest(result.inputSha256)||demand.inputSha256&&result.inputSha256!==demand.inputSha256
    ||typeof result.expiresAt!=='string'||!Number.isFinite(Date.parse(result.expiresAt))||Date.parse(result.expiresAt)<=now()
    ||!Number.isFinite(authority.validUntil)||authority.validUntil<=now()||authority.validUntil>now()+30000
    ||authority.purpose?.id!=='ASSISTANT_QUALITY'||authority.purpose.policyVersion!=='1.0.0'||!uuid(authority.purpose.grantId)
    ||!Number.isFinite(Date.parse(authority.purpose.validUntil))||Date.parse(authority.purpose.validUntil)<=now()||!Array.isArray(authority.sourceScopes)||authority.sourceScopes.length>64)return fail()
   return Object.freeze({...authority,expiresAt:String(result.expiresAt),inputSha256:String(result.inputSha256)})
  },
  async invalidate(context:Readonly<OperationContext>){
   if(!context||!uuid(context.actorId))return fail()
   const decisionId=human(context,context.actorId),r=await call('INVALIDATE',{accountId:context.actorId,decisionId})
   if(r.invalidated!==true||typeof r.epoch!=='string'||!/^[1-9][0-9]*$/.test(r.epoch))return fail()
   return Object.freeze({invalidated:true as const,epoch:r.epoch})
  },
 })
}

export const QUALITY_EVIDENCE_VERSION='sg2-assistant-quality-evidence-development-v1'
export type QualityCaptureInput=Readonly<{
 accountId:string;interactionId:string;occurredAt:string;earliestInputAt:string;timeZone:string
 interpretedPeriod:QualityEvidence['interpretedPeriod'];versions:QualityEvidence['versions']
 modelInput:QualityEvidence['modelInput'];output:QualityEvidence['output']
}>
/** A host-only composition. The native authority resolves an independently
 * enrolled input's exact scopes, then checks them again immediately before
 * encrypted persistence. No caller chooses its own grant or rights version. */
export function createAssistantQualityCapture(options:{
 purposeQuery:AccessQuery;evidenceQuery:AccessQuery;purposeKey:string;evidenceKey:string;storageKey:string
 purposeSchemaDigest:string;evidenceSchemaDigest:string;serviceId:string;storageGeneration:string;accountId:string;now?:()=>number
}){
 if(!uuid(options.accountId)||new Set([options.purposeKey,options.evidenceKey,options.storageKey]).size!==3)return fail()
 const now=options.now??Date.now
 const purpose=createQualityEvidencePurposeClient({query:options.purposeQuery,commandKey:options.purposeKey,
  schemaDigest:options.purposeSchemaDigest,serviceId:options.serviceId,storageGeneration:options.storageGeneration,
  role:'sg2_private_development_runtime',now})
 const store=(context?:Readonly<OperationContext>)=>createQualityEvidenceStore({query:options.evidenceQuery,commandKey:options.evidenceKey,
  storageKey:options.storageKey,schemaDigest:options.evidenceSchemaDigest,serviceId:options.serviceId,storageGeneration:options.storageGeneration,
  role:'sg2_assistant_quality_capture',authorize:demand=>purpose.authorize(demand,context),now})
 return Object.freeze({
  async ready(){await purpose.descriptor();await store().descriptor()},
  purge:()=>store().purge(),
  async invalidate(context:Readonly<OperationContext>){
   if(context.actorId!==options.accountId)return fail()
   return purpose.invalidate(context)
  },
  async capture(context:Readonly<OperationContext>,input:QualityCaptureInput){
   if(input.accountId!==options.accountId||context.actorId!==input.accountId)return fail()
   const evidenceId=input.interactionId,inputSha256=hash(JSON.stringify(input.modelInput))
   const a=await purpose.authorize({action:'CAPTURE',accountId:input.accountId,evidenceId,inputSha256,
    occurredAt:input.occurredAt,earliestInputAt:input.earliestInputAt},context)
   const evidence=readQualityEvidence({schemaVersion:'QA_EVIDENCE_V1',evidenceId,...input,
    applicationId:'spendguru',environment:'development',purpose:a.purpose,sourceScopes:a.sourceScopes,expiresAt:a.expiresAt},{now:now()})
   return store(context).capture(evidence)
  },
 })
}

/** Always installed independently of optional capture configuration. Only a fresh
 * native HUMAN account-history intent can invalidate its own QA epoch. */
export function createQualityHistoryContainment(query:AccessQuery,now:()=>number=Date.now){
 return Object.freeze({
  async ready(){
   let rows;try{rows=(await query("SELECT current_database() AS database_name,current_user AS role,session_user AS login,coalesce(has_function_privilege(session_user,to_regprocedure('profitia_assistant_quality_access.invalidate_history(uuid)'),'EXECUTE'),false) AS installed")).rows}catch{return fail()}
   const r=rows?.[0]
   if(rows?.length!==1||r?.database_name!=='platform_private'||r.role!=='sg2_private_development_runtime'||r.login!==r.role||r.installed!==true)return fail()
  },
  async invalidate(context:Readonly<OperationContext>){
   if(!context||context.applicationId!=='spendguru'||context.environment!=='development'||context.operation!=='assistant.history.write'
    ||context.organisationId!==null||context.actor?.kind!=='HUMAN'||!uuid(context.actorId)||context.actor.actorId!==context.actorId
    ||!uuid(context.decisionId)||!Number.isFinite(Date.parse(context.actor.expiresAt))||Date.parse(context.actor.expiresAt)<=now())return fail()
   let rows;try{rows=(await query('SELECT profitia_assistant_quality_access.invalidate_history($1::uuid) AS result',[context.decisionId])).rows}catch{return fail()}
   const r=rows?.[0]?.result as Record<string,unknown>|undefined
   if(rows?.length!==1||!r||r.applicationId!=='spendguru'||r.environment!=='development'||r.projectId!=='spring-bread-28217539'
    ||r.branchId!=='br-sparkling-term-b99l107x'||r.databaseName!=='platform_private'||r.runtimeRole!=='sg2_private_development_runtime'
    ||r.containmentVersion!=='QUALITY_HISTORY_CONTAINMENT_V1'||r.accountId!==context.actorId||r.invalidated!==true
    ||typeof r.epoch!=='string'||!/^[1-9][0-9]*$/.test(r.epoch))return fail()
   return Object.freeze({invalidated:true as const,epoch:r.epoch})
  },
 })
}
