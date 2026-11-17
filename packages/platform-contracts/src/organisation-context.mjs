import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createAccessStore} from './access-store.mjs'
import {createPrivateOperationHost} from './private-operation-host.mjs'
import {OPERATION_CONTRACT,OperationDenied} from './operation-context.mjs'
export const ORGANISATION_CONTEXT_CONTRACT=Object.freeze({id:'profitia.organisation-context',version:'1.0.0'})
export const organisationContextSchemaUrl=new URL('../migrations/profile/011-application-organisation-context.sql',import.meta.url).href
export const organisationContextSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationContextSchemaUrl))).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
/** Minimal own-account metadata, never a product grant or cached tenant selector.
 * Consumer owns the official identity adapter, actual driver and public boundary.
 * Later module execution independently rechecks all current business authority. */
export function createOrganisationContextReader(options){
 const {binding,schemaDigest,independentQuery,transact,createAuthenticator,now=Date.now}=options
 const application=structuredClone(options.application)
 if(schemaDigest!==organisationContextSchemaDigest()||application?.environment!=='development'
  ||application.profileId!=='SPENDGURU_SAAS'||application.organisationId!==null||application.features?.join(',')!=='account'
  ||application.operations?.join(',')!=='account.settings.read'||binding?.service!==undefined)throw TypeError('Explicit own-account organisation context required')
 const descriptor=async query=>{
  const rows=(await query('SELECT profitia_profile.organisation_context_descriptor() AS data')).rows
  const d=rows?.[0]?.data
  if(rows?.length!==1||d?.schemaDigest!==schemaDigest||d.applicationId!==application.appId||d.environment!==application.environment
   ||!uuid.test(d.policyId??'')||!/^[1-9][0-9]*$/.test(d.policyVersion??'')||typeof d.sourceRef!=='string'||!d.sourceRef
   ||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(d.expiresAt)<=now()||Date.parse(d.expiresAt)>now()+30000)fail()
  return d
 }
 const project=(v,context)=>{
  if(!v||Object.keys(v).sort().join(',')!=='expiresAt,organisationId,userId'||v.userId!==context.actorId
   ||v.organisationId!==null&&!uuid.test(v.organisationId??'')||typeof v.expiresAt!=='string'
   ||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=now()||Date.parse(v.expiresAt)>now()+30000)fail()
  return Object.freeze({...v})
 }
 const units=new WeakMap(),store=createAccessStore({binding,now})
 const boundTransact=(run,limits)=>transact(async unit=>{
  if(!unit?.transaction||typeof unit.query!=='function'||units.has(unit.transaction))fail()
  units.set(unit.transaction,unit.query)
  try{return await run(unit)}finally{units.delete(unit.transaction)}
 },limits)
 const host=createPrivateOperationHost({application,binding,independentQuery,transact:boundTransact,createAuthenticator,now,
  readResources:async({scope,query})=>{
   const d=await descriptor(query)
   return {resource:{id:'current-organisation-context',type:'account_settings',dataClass:'ACCOUNT_PRIVATE',environment:binding.environment,
    ownerOrganisationId:null,ownerUserId:scope.userId,version:d.policyVersion,projectionVersion:'current-organisation-context-v1'}}
  },projectOutput:project})
 return Object.freeze({contract:ORGANISATION_CONTEXT_CONTRACT,
  ready:async()=>{await store.resolveBinding(independentQuery,{environment:binding.environment,issuer:application.identityIssuer,subject:'__organisation_context_readiness_probe__'});return descriptor(independentQuery)},
  async read(request){
   const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'account.settings.read',
    resourceId:'current-organisation-context',organisationId:null,payload:{},request},async(context,transaction)=>{
     // The actual query is transaction-bound by the consumer, not an independent
     // reader. Obtain it through the same host-owned transaction adapter below.
     const query=units.get(transaction);if(!query)fail()
     const rows=(await query('SELECT profitia_profile.read_current_organisation_context($1::uuid) AS data',[context.decisionId])).rows
     if(rows?.length!==1)fail();return rows[0].data
    })
   return result.value
  }})
}
