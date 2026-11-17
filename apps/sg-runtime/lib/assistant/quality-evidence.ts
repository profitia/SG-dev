import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes} from 'node:crypto'
import {readQualityEvidence,type QualityEvidence} from '../../../../packages/assistant-context-contracts/src/quality.mjs'
import type {AccessQuery} from '@profitia/platform-contracts/access-store'

type Purpose=QualityEvidence['purpose']
export type QualityEvidenceAuthority=Readonly<{
 applicationId:'spendguru';environment:'development';operation:'assistant.quality.capture'|'assistant.quality.read'
 actorKind:'HUMAN'|'SERVICE';actorId:string;accountId:string;purpose:Purpose
 storageGeneration:string;validUntil:number;sourceScopes:QualityEvidence['sourceScopes']
}>
type Demand=Readonly<{action:'CAPTURE'|'READ';accountId:string;evidenceId:string;sourceScopes?:QualityEvidence['sourceScopes']}>
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const fail=():never=>{throw Object.assign(Error('Quality evidence unavailable'),{code:'QUALITY_EVIDENCE_UNAVAILABLE'})}
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
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
   ||!uuid(a.purpose.grantId)||Date.parse(a.purpose.validUntil)<=at||!Number.isFinite(a.validUntil)||a.validUntil<=at||a.validUntil>at+30000
   ||a.storageGeneration!==options.storageGeneration
   ||demand.sourceScopes&&JSON.stringify(a.sourceScopes)!==JSON.stringify(demand.sourceScopes))return fail()
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
   const evidence=readQualityEvidence(value,{now:now()}),a=await authority({action:'CAPTURE',accountId:evidence.accountId,evidenceId:evidence.evidenceId,sourceScopes:evidence.sourceScopes})
   if(JSON.stringify(a.purpose)!==JSON.stringify(evidence.purpose))return fail()
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
   await authority({action:'READ',accountId,evidenceId,sourceScopes:evidence.sourceScopes})
   return evidence
  },
  async purge(){const r=await call('PURGE');if(!Number.isSafeInteger(r.removed)||Number(r.removed)<0)return fail();return Number(r.removed)},
 })
}
