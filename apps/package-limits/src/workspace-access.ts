import {createHash,createHmac} from 'node:crypto'
import fs from 'node:fs'
import type {Pool} from 'pg'
import {createPeerOperationVerifier,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import type {WithIdentity} from './auth.js'
import {Fault} from './domain.js'
export const workspaceAccessDigest=createHash('sha256').update(fs.readFileSync(new URL('../migrations/005-workspace-access.sql',import.meta.url))).digest('hex')
export const workspaceIdentityDigest=createHash('sha256').update(fs.readFileSync(new URL('../migrations/006-workspace-identity-read.sql',import.meta.url))).digest('hex')
export type WorkspaceConfiguration=Readonly<{peer:PeerOperationConfiguration;commandKey:Uint8Array}>
export interface WorkspaceAccessSurface{ready():Promise<void>;read(request:Request):Promise<unknown>}
export function readWorkspaceConfiguration(env:Readonly<Record<string,string|undefined>>,targetOrigin:string):WorkspaceConfiguration|undefined{
 const enabled=env.LIMITS_WORKSPACE_ACCESS_ENABLED
 if(enabled===undefined||enabled==='false')return undefined
 if(enabled!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.LIMITS_WORKSPACE_SCHEMA_DIGEST!==workspaceAccessDigest
  ||env.LIMITS_WORKSPACE_IDENTITY_SCHEMA_DIGEST!==workspaceIdentityDigest
  ||!/^[a-f0-9]{64}$/.test(env.LIMITS_WORKSPACE_PEER_KEY??'')||!/^[a-f0-9]{64}$/.test(env.LIMITS_WORKSPACE_COMMAND_KEY??'')
  ||!/^https:\/\/[a-z0-9.-]+$/.test(env.LIMITS_WORKSPACE_SOURCE_ORIGIN??'')
  ||!/^[-a-z0-9]{2,64}$/.test(env.LIMITS_WORKSPACE_KEY_ID??''))throw Error('WORKSPACE_ACCESS_CONFIGURATION_REQUIRED')
 const peer:PeerOperationConfiguration={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:'package-limits-development',
  sourceOrigin:env.LIMITS_WORKSPACE_SOURCE_ORIGIN!,targetOrigin,keyId:env.LIMITS_WORKSPACE_KEY_ID!,key:Buffer.from(env.LIMITS_WORKSPACE_PEER_KEY!,'hex'),
  routes:[{method:'GET',path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false}],internalOrigins:[]}
 createPeerOperationVerifier(peer)
 return Object.freeze({peer,commandKey:Buffer.from(env.LIMITS_WORKSPACE_COMMAND_KEY!,'hex')})
}
export function workspaceSignature(key:Uint8Array,actor:string,organisation:string,application:string,until:number,tx:string,projectionRef:string){
 return createHmac('sha256',key).update(['workspace-access-v1','profitia_limits_runtime',actor,organisation,application,until,tx,projectionRef].join('\u001f')).digest('hex')
}
/** Read-only consumer; it cannot call operator commands or create E1 grants. */
export function createWorkspaceAccess(options:{configuration:WorkspaceConfiguration;limits:Pool;identity:Pool;withIdentity:WithIdentity;now?:()=>number}):WorkspaceAccessSurface{
 const verify=createPeerOperationVerifier(options.configuration.peer),now=options.now??Date.now,key=Buffer.from(options.configuration.commandKey)
 if(key.length!==32)throw Error('WORKSPACE_ACCESS_CONFIGURATION_REQUIRED')
 const ready=async()=>{
  const [l,i]=await Promise.all([options.limits.query('SELECT profitia_limits.workspace_access_descriptor() AS d'),options.identity.query('SELECT profitia_limits_identity_read.workspace_descriptor() AS d')])
  if(l.rows.length!==1||i.rows.length!==1||l.rows[0].d?.schemaDigest!==workspaceAccessDigest
   ||l.rows[0].d?.commandKeyFingerprint!==createHash('sha256').update(key).digest('hex')||i.rows[0].d?.schemaDigest!==workspaceIdentityDigest)
   throw Error('WORKSPACE_ACCESS_INSTALLATION_REQUIRED')
 }
 return Object.freeze({ready,async read(request:Request){
  if(!await verify(request))throw new Fault(401,'PEER_AUTHENTICATION_REQUIRED')
  return options.withIdentity(request,async scope=>{
   if(!scope.workspaceContext)throw new Fault(503,'WORKSPACE_IDENTITY_UNAVAILABLE')
   const current=await scope.workspaceContext()
   if(!current||current.userId!==scope.actor.userId||current.applicationId!=='spendguru')throw new Fault(503,'WORKSPACE_IDENTITY_UNAVAILABLE')
   const until=Math.min(Date.parse(scope.actor.expiresAt),now()+4500)
   if(!Number.isFinite(until)||until<=now())throw new Fault(503,'WORKSPACE_IDENTITY_UNAVAILABLE')
   const c=await options.limits.connect();let committed=false
   try{
    await c.query("BEGIN; SET LOCAL statement_timeout='4000ms'; SET LOCAL lock_timeout='2000ms'; SET LOCAL idle_in_transaction_session_timeout='5000ms'")
    const tx=(await c.query('SELECT pg_current_xact_id()::text AS tx')).rows[0].tx as string
    const result=(await c.query('SELECT profitia_limits.workspace_access($1::uuid,$2::uuid,$3,$4::bigint,$5,$6,$7) AS data',
     [scope.actor.userId,current.organisationId,'spendguru',until,tx,current.projectionRef,workspaceSignature(key,scope.actor.userId!,current.organisationId,'spendguru',until,tx,current.projectionRef)])).rows[0]?.data
    if(!result||result.userId!==scope.actor.userId||result.organisationId!==current.organisationId||result.applicationId!=='spendguru'
     ||!['READY','PENDING_PACKAGE'].includes(result.status)||Date.parse(result.expiresAt)>until||Date.parse(result.expiresAt)<=now())throw new Fault(503,'WORKSPACE_ACCESS_UNAVAILABLE')
    await c.query('COMMIT');committed=true;return result
   }finally{if(!committed)await c.query('ROLLBACK').catch(()=>{});c.release()}
  })
 }})
}
