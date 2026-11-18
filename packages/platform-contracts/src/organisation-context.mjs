import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createAccessStore} from './access-store.mjs'
import {createPrivateOperationHost} from './private-operation-host.mjs'
import {OPERATION_CONTRACT,OperationDenied} from './operation-context.mjs'
export const ORGANISATION_CONTEXT_CONTRACT=Object.freeze({id:'profitia.organisation-context',version:'1.0.0'})
export const organisationContextSchemaUrl=new URL('../migrations/profile/011-application-organisation-context.sql',import.meta.url).href
export const organisationContextSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationContextSchemaUrl))).digest('hex')
export const organisationSelectionSchemaUrl=new URL('../migrations/profile/012-organisation-context-selection.sql',import.meta.url).href
export const organisationSelectionSchemaDigest=()=>createHash('sha256').update(readFileSync(new URL(organisationSelectionSchemaUrl))).digest('hex')
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys
/** Minimal own-account metadata, never a product grant or cached tenant selector.
 * Consumer owns the official identity adapter, actual driver and public boundary.
 * Later module execution independently rechecks all current business authority. */
export function createOrganisationContextReader(options){
 const {binding,schemaDigest,selectionSchemaDigest,independentQuery,transact,createAuthenticator,now=Date.now}=options
 const application=structuredClone(options.application)
 if(schemaDigest!==organisationContextSchemaDigest()||selectionSchemaDigest!==undefined&&selectionSchemaDigest!==organisationSelectionSchemaDigest()
  ||application?.environment!=='development'||application.profileId!=='SPENDGURU_SAAS'||application.organisationId!==null
  ||application.features?.join(',')!=='account'||application.operations?.join(',')!==(selectionSchemaDigest===undefined?'account.settings.read':'account.settings.read,account.settings.write')||binding?.service!==undefined)throw TypeError('Explicit own-account organisation context required')
 const selection=selectionSchemaDigest!==undefined
 const descriptor=async query=>{
  const rows=(await query(selection?'SELECT profitia_profile.organisation_selection_descriptor() AS data':'SELECT profitia_profile.organisation_context_descriptor() AS data')).rows
  const d=rows?.[0]?.data
  if(rows?.length!==1||d?.schemaDigest!==schemaDigest||selection&&d.selectionSchemaDigest!==selectionSchemaDigest
   ||d.applicationId!==application.appId||d.environment!==application.environment
   ||!uuid.test(d.policyId??'')||!/^[1-9][0-9]*$/.test(d.policyVersion??'')||typeof d.sourceRef!=='string'||!d.sourceRef
   ||!Number.isFinite(Date.parse(d.expiresAt))||Date.parse(d.expiresAt)<=now()||Date.parse(d.expiresAt)>now()+30000)fail()
  return d
 }
 const project=(v,context)=>{
  if(!v||v.userId!==context.actorId||typeof v.expiresAt!=='string'
   ||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=now()||Date.parse(v.expiresAt)>now()+30000)fail()
  if(context.resourceId==='organisation-choices'){
   if(!exact(v,'choices,expiresAt,userId')||!Array.isArray(v.choices)||v.choices.length>50)fail()
   const ids=new Set()
   for(const c of v.choices){
    if(!exact(c,'name,organisationId,slug')||!uuid.test(c.organisationId??'')||ids.has(c.organisationId)
     ||c.slug!==null&&!(typeof c.slug==='string'&&/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(c.slug))
     ||c.name!==null&&!(typeof c.name==='string'&&c.name.length>0&&c.name.length<=320))fail()
    ids.add(c.organisationId)
   }
   return Object.freeze({...v,choices:Object.freeze(v.choices.map(c=>Object.freeze({...c})))})
  }
  if(!exact(v,'expiresAt,organisationId,userId')||v.organisationId!==null&&!uuid.test(v.organisationId??''))fail()
  return Object.freeze({...v})
 }
 const units=new WeakMap(),store=createAccessStore({binding,now})
 const boundTransact=(run,limits)=>transact(async unit=>{
  if(!unit?.transaction||typeof unit.query!=='function'||units.has(unit.transaction))fail()
  units.set(unit.transaction,unit.query)
  try{return await run(unit)}finally{units.delete(unit.transaction)}
 },limits)
 const allowed=new Set(['current-organisation-context',...(selection?['organisation-choices','selected-organisation-context','organisation-entry-context']:[])])
 const host=createPrivateOperationHost({application,binding,independentQuery,transact:boundTransact,createAuthenticator,now,
  readResources:async({scope,query,request})=>{
   if(!allowed.has(request.resourceId))fail()
   const d=await descriptor(query)
   return {resource:{id:request.resourceId,type:'account_settings',dataClass:'ACCOUNT_PRIVATE',environment:binding.environment,
    ownerOrganisationId:null,ownerUserId:scope.userId,version:d.policyVersion,projectionVersion:'current-organisation-context-v1'}}
  },projectOutput:project})
 const read=async(request,resourceId,payload,statement,values=[],operation='account.settings.read')=>{
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,
   resourceId,organisationId:null,payload,request},async(context,transaction)=>{
    const query=units.get(transaction);if(!query)fail()
    const rows=(await query(statement,[context.decisionId,...values])).rows
    if(rows?.length!==1)fail();return rows[0].data
   })
  return result.value
 }
 return Object.freeze({contract:ORGANISATION_CONTEXT_CONTRACT,
  ready:async()=>{await store.resolveBinding(independentQuery,{environment:binding.environment,issuer:application.identityIssuer,subject:'__organisation_context_readiness_probe__'});return descriptor(independentQuery)},
  read:request=>read(request,'current-organisation-context',{},'SELECT profitia_profile.read_current_organisation_context($1::uuid) AS data'),
  async choices(request){
   if(!selection)fail()
   return read(request,'organisation-choices',{},'SELECT profitia_profile.read_organisation_choices($1::uuid) AS data')
  },
  async select(request,organisationId){
   if(!selection)fail()
   if(!(request instanceof Request)||request.method!=='POST')throw TypeError('Explicit account preference command required')
   if(typeof organisationId!=='string'||!uuid.test(organisationId))throw TypeError('Explicit organisation selector required')
   const id=organisationId.toLowerCase()
   return read(request,'organisation-entry-context',{organisationId:id},'SELECT profitia_profile.select_own_organisation($1::uuid,$2::uuid) AS data',[id],'account.settings.write')
  },
  async readSelected(request,organisationId){
   if(!selection)fail()
   if(typeof organisationId!=='string'||!uuid.test(organisationId))throw TypeError('Explicit organisation selector required')
   const id=organisationId.toLowerCase()
   return read(request,'selected-organisation-context',{organisationId:id},'SELECT profitia_profile.read_selected_organisation_context($1::uuid,$2::uuid) AS data',[id])
  }})
}
