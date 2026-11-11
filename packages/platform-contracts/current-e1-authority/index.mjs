import {createHash,randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {createOperationExecutor,OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createAccessStore} from '@profitia/platform-contracts/access-store'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
import {createRecurringAuthority} from './recurring.mjs'
import {createFirstPartySourceAuthority} from './first-party.mjs'

export const CURRENT_E1_CONTRACT=Object.freeze({id:'profitia.current-e1-authority',version:'1.0.0'})
export const currentE1AuthoritySchemaUrl=new URL('./migrations/001-authority.sql',import.meta.url).href
export const currentE1ReceiverSchemaUrl=new URL('./migrations/002-receiver.sql',import.meta.url).href
export const currentE1CalendarAuthoritySchemaUrl=new URL('./migrations/005-calendar-authority.sql',import.meta.url).href
export const currentE1CalendarReceiverSchemaUrl=new URL('./migrations/006-calendar-receiver.sql',import.meta.url).href
export const currentE1CalendarSchemaDigest=side=>createHash('sha256').update(readFileSync(new URL(side==='authority'?currentE1CalendarAuthoritySchemaUrl:side==='receiver'?currentE1CalendarReceiverSchemaUrl:invalidSide()))).digest('hex')
export const currentE1SchemaDigest=side=>createHash('sha256').update(readFileSync(new URL(side==='authority'?currentE1AuthoritySchemaUrl:side==='receiver'?currentE1ReceiverSchemaUrl:invalidSide()))).digest('hex')
function invalidSide(){throw TypeError('Explicit authority or receiver schema required')}
const fail=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const denied=()=>{throw new OperationDenied('ACCESS_BASIS_INVALID')}
const clone=value=>structuredClone(value)
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const bearer=request=>request instanceof Request&&/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??'')&&!request.headers.has('cookie')
const bindingMatches=(a,b)=>a&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>a[k]===v)
async function one(query,sql,values=[]){try{const r=await query(sql,values);if(r?.rows?.length!==1)fail();return r.rows[0]}catch{fail()}}
async function boundedJson(response){
 const reader=response.body?.getReader();if(!reader)fail();let size=0;const chunks=[]
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();fail()}chunks.push(value)}}finally{reader.releaseLock()}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{fail()}
}
function receiverResourceAllows(root,operation,resource){
 if(root==='insights-reports')return ['insights.report.start','insights.report.list'].includes(operation)?resource==='oil-asphalt':['insights.report.status','insights.report.download'].includes(operation)&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(resource??'')
 if(root==='economic-calendar')return operation==='knowledge.read'&&resource==='economic-calendar-events'||['personal.list.read','personal.list.write'].includes(operation)&&resource==='economic-calendar-preferences'
 return resource===root||root==='newsfeed-observations'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(resource??'')
}
function receiverDescriptor(value,binding){
 if(value?.contract!==CURRENT_E1_CONTRACT.id+'/'+CURRENT_E1_CONTRACT.version||!bindingMatches(value.binding,binding))fail()
 let u;try{u=new URL(value.authorityOrigin)}catch{fail()}
 if(u.origin!==value.authorityOrigin||u.protocol!=='https:'||u.username||u.password)fail()
 return freeze(clone(value))
}

/** Fresh central E1 authority for one real local SQL transaction. No mirrored
 * directory, mutable shared actor, ALLOW cache, fallback or runtime proof key.
 * The existing operation engine still decides product/permission/resource use.
 */
export function createCurrentE1OperationHost(options){
 const {independentQuery,transact,readResources,projectOutput,now=Date.now,fetch:send=globalThis.fetch}=options
 const application=freeze(clone(options.application)),binding=freeze(clone(options.binding))
 const calendarMode=application.features?.join(',')==='market,personal_workspace'&&application.operations?.join(',')==='knowledge.read,personal.list.read,personal.list.write'
 const reportMode=application.features?.join(',')==='market'&&application.operations?.join(',')==='insights.report.start,insights.report.status,insights.report.list,insights.report.download'
 const personalMode=application.features?.join(',')==='personal_workspace'&&application.operations?.join(',')==='personal.list.read,personal.list.write'
 if(application?.environment!=='development'||binding?.environment!=='development'||binding.applicationId!==application.appId||binding.service!==undefined
 ||application.profileId!=='SPENDGURU_SAAS'||!personalMode&&!calendarMode&&!reportMode
 ||[independentQuery,transact,readResources,projectOutput,send,now].some(f=>typeof f!=='function'))throw TypeError('Explicit Development current E1 human host required')
 const audit=createAccessStore({binding,now})
 const validate=createOperationExecutor({application,now,authenticate:async()=>null,withTransaction:fail,recordAudit:fail})
 const descriptor=async query=>{const d=receiverDescriptor((await one(query,'SELECT profitia_e1_receiver.descriptor() AS descriptor')).descriptor,binding);if(calendarMode!==(d.resourceId==='economic-calendar')||reportMode!==(d.resourceId==='insights-reports'))fail();return d}
 async function remote(d,request,challenge,previous=null){
  // Only an owner-enrolled HTTPS origin. No caller URL, redirects, cookies,
  // automatic retry, provider acquisition or credentials in error diagnostics.
  const url=new URL(request.url),authorization=request.headers.get('authorization')
  let response
  try{response=await send(d.authorityOrigin+'/v1/e1/authorize',{method:'POST',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)]),headers:{authorization,'content-type':'application/json'},
   body:JSON.stringify({applicationId:application.appId,challenge,previous,requestOrigin:url.origin})})}catch{fail()}
  if(response.status===401||response.status===403)denied()
  if(response.status!==200)fail()
  return boundedJson(response)
 }
 return Object.freeze({contract:validate.contract,hostContract:CURRENT_E1_CONTRACT,
  async ready(){try{const d=await descriptor(independentQuery);const r=await send(d.authorityOrigin+'/v1/e1/ready',{redirect:'error',signal:AbortSignal.timeout(3000)});return r.status===200&&(await boundedJson(r)).ready===true}catch{return false}},
  async execute(input,action){
   if(typeof action!=='function')throw TypeError('Explicit transaction action required')
   const original=input?.request
   if(!bearer(original))throw new OperationDenied('IDENTITY_REQUIRED')
   const request=new Request(original.url,{method:original.method,headers:new Headers(original.headers),signal:original.signal})
   const captured=freeze(clone(Object.fromEntries(Object.entries(input).filter(([k])=>k!=='request'))))
   const d=await descriptor(independentQuery)
   let entered=false,closed=false,engineEntered=false,engineCompleted=false,lastOutcome=null
   try{return await transact(async({query,transaction})=>{
    if(entered||closed||typeof query!=='function'||query===independentQuery||transaction==null)fail();entered=true
    const local=await descriptor(query);if(JSON.stringify(local)!==JSON.stringify(d))fail()
    const challenge=(await one(query,'SELECT profitia_e1_receiver.challenge($1,$2::uuid,$3,$4,$5) AS challenge',
     [randomBytes(32).toString('hex'),captured.organisationId,captured.operation,captured.resourceId,digest({...captured,method:request.method,origin:new URL(request.url).origin,tokenDigest:digest(request.headers.get('authorization'))})])).challenge
    let proof=await remote(d,request,challenge)
    const accepted=(await one(query,'SELECT profitia_e1_receiver.accept($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
    if(closed||!accepted?.actor||!accepted?.state)fail()
    const actor=freeze(clone(accepted.actor))
    const executor=createOperationExecutor({application,now,authenticate:async()=>actor,
     recordAudit:event=>audit.appendAudit(independentQuery,event),
     withTransaction:async({request:bound},run)=>{
      const scope=freeze({applicationId:binding.applicationId,environment:binding.environment,userId:actor.userId,organisationId:accepted.state.access.organisationId})
      const resources=await readResources({actor,request:bound,scope,query,transaction})
      return run({state:{...clone(accepted.state),...resources},transaction,transactionalEffects:true,outputBoundaryVersion:resources.resource?.projectionVersion,
       projectOutput:(value,context)=>projectOutput(value,context,transaction),recordOutcome:async event=>{await one(query,'SELECT profitia_e1_receiver.append_audit($1::jsonb) AS audit',[JSON.stringify(event)]);lastOutcome=clone(event)}})
     }})
    engineEntered=true
    const result=await executor.execute({...clone(captured),request},action)
    engineCompleted=true
    // The operation linearizes at this new central observation, never at a
    // cached signed lease. Changed/revoked authority rolls back local effects.
    proof=await remote(d,request,challenge,proof)
    const final=(await one(query,'SELECT profitia_e1_receiver.accept($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
    if(request.signal.aborted)fail()
    if(closed||final?.fingerprint!==accepted.fingerprint||final?.actor?.proofRef!==actor.proofRef)denied()
    return result
   },{timeoutMs:15000,maxWaitMs:3000})}catch(error){
    if(engineCompleted&&lastOutcome)await audit.appendAudit(independentQuery,{...lastOutcome,occurredAt:new Date(now()).toISOString(),phase:'FAILURE',decision:'DENY',reasonCode:error?.reasonCode==='ACCESS_BASIS_INVALID'?'ACCESS_BASIS_INVALID':'POLICY_UNAVAILABLE'})
    if(!engineEntered){const rejected=createOperationExecutor({application,now,authenticate:async()=>{throw error},withTransaction:fail,recordAudit:event=>audit.appendAudit(independentQuery,event)});return rejected.execute({...clone(captured),request},fail)}
    throw error
   }finally{closed=true}
  }
 })
}

/** Existing Identity Runtime is the sole issuer. Each admission AND outcome
 * observes current Clerk session/account and current authoritative SQL rows.
 * HTTP carries no claimed user ID, account status, membership or product grant.
 */
export function createCurrentE1Authority({query,client,binding,now=Date.now}){
 const store=createAccessStore({binding,now})
 if(binding.applicationId!=='identity-runtime-development'||binding.environment!=='development')throw TypeError('Existing Development Identity owner required')
 const source=createFirstPartySourceAuthority({query,client,binding,now})
 const authority={
  sourceReady:source.ready,authorizeSource:source.authorize,
  async ready(){try{for(const app of ['profitia-source-hub-development','profitia-newsfeed-api-development'])if(!(await one(query,'SELECT profitia_e1_authority.receiver($1) AS receiver',[app])).receiver)return false;return true}catch{return false}},
  async authorize(request,input){
   if(!bearer(request)||!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join(',')!=='applicationId,challenge,previous,requestOrigin')denied()
   const captured=freeze(clone(input)),row=await one(query,'SELECT profitia_e1_authority.receiver($1) AS receiver',[captured.applicationId]),d=row.receiver
   if(!d||!d.authorizedParties?.includes(captured.requestOrigin)||!bindingMatches(captured.challenge?.binding,d.binding)||!receiverResourceAllows(d.resourceId,captured.challenge?.operation,captured.challenge?.resourceId))denied()
   let identity=null
   const authenticate=createClerkIdentityAuthenticator({client,application:{appId:captured.applicationId,environment:'development',issuer:d.issuer,authorizedParties:d.authorizedParties,
    bearerPeerReads:d.authorizedParties.filter(sourceOrigin=>sourceOrigin!==captured.requestOrigin).map(sourceOrigin=>({sourceOrigin,targetOrigin:captured.requestOrigin,path:'/'}))},now,
    resolveBinding:async key=>{identity=freeze(clone(key));return store.resolveBinding(query,key)}})
   // A closed, receiving origin is all the SDK needs; original query/body and
   // user data are neither forwarded nor stored in the Identity service.
   const actor=await authenticate(new Request(captured.requestOrigin+'/',{headers:{authorization:request.headers.get('authorization')}}))
   if(!actor||!identity)denied()
   const result=(await one(query,'SELECT profitia_e1_authority.issue($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb) AS proof',
    [captured.applicationId,JSON.stringify(identity),JSON.stringify(actor),JSON.stringify(captured.challenge),captured.previous===null?null:JSON.stringify(captured.previous)])).proof
   if(!result)denied()
   return freeze(clone(result))
  }
 }
 const recurring=createRecurringAuthority({query,client,binding,now,authorizeHuman:(request,input)=>authority.authorize(request,input)})
 return Object.freeze({...authority,recurringReady:recurring.ready,recurringConsent:recurring.consent,authorizeRecurring:recurring.authorize})
}

export const currentE1InsightsAuthoritySchemaUrl=new URL('./migrations/007-insights-authority.sql',import.meta.url).href;
export const currentE1InsightsReceiverSchemaUrl=new URL('./migrations/008-insights-receiver.sql',import.meta.url).href;
