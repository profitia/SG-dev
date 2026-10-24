import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { EmailStoreConfig } from './email-store.js'
import {requireVocative} from './vocative.js'
export const registrationSchemaDigest = () => createHash('sha256').update(readFileSync(new URL('../migrations/profile/005-registration.sql', import.meta.resolve('@profitia/platform-contracts/user-profile')))).digest('hex')
export type RegistrationDraft = { email: string; firstName: string; lastName: string; avatar: 'male'|'female'; language: 'pl'|'en' }
export type RegistrationReceipt = { attemptId: string; token: string }
export type RegistrationQuery = (sql: string, values?: unknown[]) => Promise<{rows: Record<string, unknown>[]}>
type Transact = <T>(run: (tx: {query: RegistrationQuery}) => Promise<T>) => Promise<T>
export interface RegistrationStore {
 ready(): Promise<void>
 start(draft: RegistrationDraft): Promise<Record<string, unknown> & Partial<RegistrationReceipt>>
 command(op: string, receipt: RegistrationReceipt, extra?: Record<string, unknown>): Promise<Record<string, unknown>>
 decrypt(attemptId: string, ciphertext: string): RegistrationDraft
 finish(query: RegistrationQuery, userId: string, token: string|null): Promise<void>
}
export function createRegistrationStore(config: EmailStoreConfig, transact: Transact, now = Date.now): RegistrationStore {
 const c=structuredClone(config),proof=Buffer.from(c.proofKey),key=Buffer.from(c.encryptionKey)
 if(c.binding.environment!=='development'||proof.length!==32||key.length!==32||proof.equals(key))throw Error('REGISTRATION_CONFIGURATION')
 const mac=(domain:string,value:string)=>createHmac('sha256',key).update(domain+'\x1f'+c.instanceId+'\x1f'+value).digest('hex')
 const descriptor=async(query:RegistrationQuery)=>{
  await requireVocative(query)
  const d=(await query('SELECT profitia_profile.registration_descriptor() AS d')).rows[0]?.d as Record<string,unknown>|undefined
  if(!d||d.enabled!==true||d.registrationEnabled!==true||d.registrationSchemaDigest!==registrationSchemaDigest()||d.issuer!==c.issuer||d.instanceId!==c.instanceId||d.serviceId!==c.serviceId
   ||Object.entries(c.binding).some(([k,v])=>d[k]!==v))throw Error('REGISTRATION_UNAVAILABLE')
 }
 const execute=async(query:RegistrationQuery,value:Record<string,unknown>)=>{
  await descriptor(query)
  const tx=(await query('SELECT txid_current()::text AS tx')).rows[0]?.tx
  if(typeof tx!=='string'||!/^\d+$/.test(tx))throw Error('REGISTRATION_UNAVAILABLE')
  const until=now()+4500,body=JSON.stringify(value),sig=createHmac('sha256',proof).update(['registration-v1',c.binding.environment,c.binding.applicationId,c.binding.role,c.serviceId,c.instanceId,tx,until,body].join('\x1f')).digest('hex')
  const r=(await query('SELECT profitia_profile.registration_command($1,$2,$3) AS r',[body,until,sig])).rows[0]?.r
  if(!r||typeof r!=='object')throw Error('REGISTRATION_UNAVAILABLE')
  return r as Record<string,unknown>
 }
 const aad=(id:string)=>Buffer.from(['registration-v1',c.binding.applicationId,c.instanceId,c.keyId,id].join('\x1f'))
 return Object.freeze({
  ready:()=>transact(async({query})=>descriptor(query)),
  async start(draft:RegistrationDraft){
   const attemptId=randomUUID(),token=randomBytes(32).toString('base64url'),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad(attemptId))
   const encrypted=Buffer.concat([cipher.update(JSON.stringify(draft),'utf8'),cipher.final()])
   const ciphertext=[c.keyId,nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.')
   const r=await transact(({query})=>execute(query,{op:'start',emailKey:mac('email',draft.email),attemptId,tokenHash:mac('token',token),ciphertext,avatar:draft.avatar,language:draft.language,firstName:draft.firstName}))
   return {...r,...(r.status==='preparing'?{attemptId,token}:{})}
  },
  command:(op:string,receipt:RegistrationReceipt,extra:Record<string,unknown>={})=>transact(({query})=>execute(query,{...extra,op,attemptId:receipt.attemptId,tokenHash:mac('token',receipt.token)})),
  decrypt(attemptId:string,ciphertext:string){
   const[k,n,t,b,extra]=ciphertext.split('.');if(k!==c.keyId||!n||!t||!b||extra!==undefined)throw Error('REGISTRATION_CIPHER')
   const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(n,'base64url'));decipher.setAAD(aad(attemptId));decipher.setAuthTag(Buffer.from(t,'base64url'))
   return JSON.parse(Buffer.concat([decipher.update(Buffer.from(b,'base64url')),decipher.final()]).toString('utf8')) as RegistrationDraft
  },
  async finish(query:RegistrationQuery,userId:string,token:string|null){await execute(query,{op:'finish',userId,tokenHash:token===null?null:mac('token',token)})}
 })
}
