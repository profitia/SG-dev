import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { createPrivateOperationHost } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import type pg from 'pg'
interface UserProfile {user_id:string;communication_language:'pl'|'en';language_source:'default'|'migration'|'browser'|'user';version:string}
import { BoundaryError } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import { readConfiguration } from './config.js'
import { verifiedEmailClient } from './account-provisioning.js'
import type { createAssistantAvatarSurface } from './assistant-avatar.js'
export type CommunicationLanguage = 'pl' | 'en'
export const languageSchemaDigest = () => createHash('sha256').update(readFileSync(new URL('../migrations/profile/004-communication-language.sql', import.meta.resolve('@profitia/platform-contracts/user-profile')))).digest('hex')
/** Primary browser preference, never country or a secondary accepted language. */
export function browserCommunicationLanguage(value: unknown): CommunicationLanguage {
  return typeof value === 'string' && /^pl(?:-[a-z0-9]{1,8})*$/i.test(value) ? 'pl' : 'en'
}
export interface LanguagePreference { userId: string; language: CommunicationLanguage; source: 'default'|'migration'|'browser'|'user'; version: string }
export interface CommunicationLanguageSurface {
  ready(): Promise<void>
  read(request: Request): Promise<LanguagePreference | null>
  update(request: Request, input: unknown): Promise<LanguagePreference>
}
export function createCommunicationLanguageSurface(options: Parameters<typeof createAssistantAvatarSurface>[0]): CommunicationLanguageSurface {
  const configuration=readConfiguration(options.configuration)
  const ready=async()=>{
    const result=await options.independentQuery('SELECT profitia_profile.language_descriptor() AS d')
    const rows=Array.isArray(result)?result:result.rows
    if (rows[0]?.d?.languageSchemaDigest!==languageSchemaDigest()) throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE')
  }
  const binding=structuredClone(options.binding),key=Buffer.from(options.proofKey),now=options.now??Date.now
  if(key.length!==32)throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE')
  const execute=async(request:Request,patch?:{communication_language:CommunicationLanguage;language_source:'browser'|'user'},version?:string)=>{
    const queries=new WeakMap<pg.PoolClient,AccessQuery>();let conflict=false
    const identityApplication={appId:configuration.applicationId,environment:configuration.environment,issuer:configuration.issuer,authorizedParties:[configuration.origin]}
    const host=createPrivateOperationHost<pg.PoolClient>({binding,now,independentQuery:options.independentQuery,
      application:{appId:configuration.applicationId,profileId:'SPENDGURU_SAAS',environment:configuration.environment,
        deploymentId:options.deploymentId,configurationVersion:options.configurationVersion,identityIssuer:configuration.issuer,
        organisationId:null,features:['account'],operations:['account.settings.read','account.settings.write']},
      createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:verifiedEmailClient(options.client),application:identityApplication,resolveBinding,now}),
      transact:(run,limits)=>options.transact(async session=>{queries.set(session.transaction,session.query);try{return await run(session)}finally{queries.delete(session.transaction)}},limits,request.signal),
      readResources:async({actor,request:bound,query})=>{
        const d=(await query('SELECT profitia_profile.language_descriptor() AS d')).rows[0]?.d as Record<string,unknown>|undefined
        if(!d||d.enabled!==true||d.issuer!==configuration.issuer||d.profileSchemaDigest!==options.schemaDigest||d.languageSchemaDigest!==languageSchemaDigest()
          ||['applicationId','environment','projectId','branchId','databaseName','role','schemaDigest'].some(k=>d[k]!==binding[k as keyof typeof binding]))throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE')
        const tx=(await query('SELECT txid_current()::text AS tx')).rows[0]?.tx
        if(actor.kind!=='HUMAN'||!actor.userId||typeof tx!=='string')throw new BoundaryError(403,'PROFILE_ACCESS_DENIED')
        const until=Math.min(now()+5000,Date.parse(actor.expiresAt)),operation=bound.operation
        const parts=[binding.environment,binding.applicationId,binding.role,operation,tx,actor.userId,'',String(until),'0']
        if(!/^[1-9][0-9]*$/.test(tx??'')||!Number.isSafeInteger(until)||until<=now()||parts.some(v=>typeof v!=='string'||/[\u0000-\u001f\u007f]/u.test(v)))throw new BoundaryError(403,'PROFILE_ACCESS_DENIED')
        const signature=createHmac('sha256',key).update(parts.join('\u001f')).digest('hex')
        await query("SELECT set_config('profitia.profile.operation',$1,true),set_config('profitia.profile.expires_ms',$2,true),set_config('profitia.profile.signature',$3,true)",[operation,String(until),signature])
        return{resource:{id:'current-user-profile',type:'account_settings',dataClass:'ACCOUNT_PRIVATE',ownerOrganisationId:null,
          ownerUserId:actor.userId,environment:binding.environment,version:'profile-v1',projectionVersion:'profile-v1'}}
      },projectOutput:value=>value,
    })
    try{return(await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
      operation:patch?'account.settings.write':'account.settings.read',resourceId:'current-user-profile',organisationId:null,request,
      payload:{changeId:randomUUID(),fields:patch?Object.keys(patch):[],expectedVersion:version??null}},async(_context,transaction)=>{
        try{const result=await queries.get(transaction)!(patch?'SELECT profitia_profile.update_current($1::bigint,$2::jsonb) AS profile':'SELECT profitia_profile.read_current() AS profile',patch?[version,JSON.stringify(patch)]:[])
          if(result.rows.length!==1)throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE');return result.rows[0]!.profile as UserProfile|null
        }catch(error){conflict=(error as {code?:string}).code==='PT409';throw error}
      })).value as UserProfile|null}catch(error){if(conflict)throw new BoundaryError(409,'PROFILE_VERSION_CONFLICT');throw error}
  }
  const project=(p:UserProfile|null):LanguagePreference|null=>{
    if(p===null)return null
    if(!['pl','en'].includes(p.communication_language??'')||!['default','migration','browser','user'].includes(p.language_source??''))throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE')
    return {userId:p.user_id,language:p.communication_language!,source:p.language_source!,version:p.version}
  }
  const check=(request:Request,write=false)=>{
    checkRequest(request,configuration,write)
    const u=new URL(request.url)
    if(u.pathname!=='/v1/account/communication-language'||u.search||u.hash)throw new BoundaryError(403,'REQUEST_ORIGIN_REJECTED')
  }
  async function checked<T>(run:()=>Promise<T>):Promise<T>{try{await ready();return await run()}catch(e){
    if(e instanceof BoundaryError)throw e
    const reason=(e as {reasonCode?:string})?.reasonCode
    if(reason==='UNVERIFIED_IDENTITY')throw new BoundaryError(401,'ACCOUNT_REQUIRED')
    if(reason&&reason!=='POLICY_UNAVAILABLE')throw new BoundaryError(403,'PROFILE_ACCESS_DENIED')
    throw new BoundaryError(503,'LANGUAGE_UNAVAILABLE')
  }}
  return Object.freeze({ready,
    async read(request:Request){check(request);return checked(async()=>project(await execute(request)))},
    async update(request:Request,input:unknown){
      check(request,true)
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='expectedVersion,language,source')throw new BoundaryError(400,'INVALID_LANGUAGE_PREFERENCE')
      const v=input as Record<string,unknown>
      if(!['pl','en'].includes(String(v.language))||!['browser','user'].includes(String(v.source))||typeof v.expectedVersion!=='string'
        ||!/^[1-9][0-9]{0,18}$/.test(v.expectedVersion)||BigInt(v.expectedVersion)>9223372036854775807n)throw new BoundaryError(400,'INVALID_LANGUAGE_PREFERENCE')
      return checked(async()=>project(await execute(request,{communication_language:v.language as CommunicationLanguage,language_source:v.source as 'browser'|'user'},v.expectedVersion as string))!)
    },
  })
}
