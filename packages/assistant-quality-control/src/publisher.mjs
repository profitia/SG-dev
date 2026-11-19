/** Independent publisher's fixed metadata-only database ports.
 * These adapters install no role, schema, key, policy or release authority.
 * Durable callers retain one operation ID through delivery uncertainty.
 */
const fail=code=>{throw Object.assign(Error('Quality publisher bindings unavailable'),{code})}
const require=(v,code='PUBLISHER_BINDING_INVALID')=>{if(!v)fail(code)}
const plain=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const exact=(v,fields)=>plain(v)&&Reflect.ownKeys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k))
 &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&'value'in Object.getOwnPropertyDescriptor(v,k))
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const expiry=Date.parse('2026-11-27T23:59:59.000Z')
const profiles=['canonical','product']
const statusFields=['schemaVersion','applicationId','environment','profile','currentSourceSha','bindingsFresh','publishingEnabled',
 'recoveryEnabled','authorisedUntil','operation','rawQaReadPerformed','permissionMutationPerformed']
const operationFields=['operationId','fromSourceSha','toSourceSha','restoreOf']
const resultFields=['applicationId','environment','profile','operationId','status','fromSourceSha','toSourceSha','updatedBindings',
 'rawQaReadPerformed','permissionMutationPerformed']
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const operation=(v,id,from,to,restore=null)=>exact(v,operationFields)&&v.operationId===id&&v.fromSourceSha===from&&v.toSourceSha===to&&v.restoreOf===restore
function input(v,recovery=false){
 require(exact(v,['operationId','fromSourceSha','toSourceSha',...(recovery?['restoreOperationId']:[])]))
 require(uuid(v.operationId)&&sha(v.fromSourceSha)&&sha(v.toSourceSha)&&v.fromSourceSha!==v.toSourceSha
  &&(!recovery||uuid(v.restoreOperationId)&&v.restoreOperationId!==v.operationId))
 return Object.freeze({...v})
}
export function createQualityPublisherBindings({canonicalQuery,productQuery,promotionEnabled=false,recoveryEnabled=true,now=Date.now}={}){
 require(typeof canonicalQuery==='function'&&typeof productQuery==='function'&&typeof promotionEnabled==='boolean'
  &&typeof recoveryEnabled==='boolean'&&typeof now==='function','PUBLISHER_BINDING_CONFIGURATION_REQUIRED')
 const queries={canonical:canonicalQuery,product:productQuery}
 const clock=()=>{const at=now();require(Number.isFinite(at)&&at>=0&&at<expiry,'PUBLISHER_BINDING_AUTHORITY_EXPIRED');return at}
 async function status(profile,id=null){
  require(profiles.includes(profile)&&(id===null||uuid(id)))
  clock()
  let r
  try{r=await queries[profile]('SELECT profitia_quality_release.quality_deployment_cas_status($1::uuid) AS result',[id])}
  catch{fail('PUBLISHER_BINDING_READ_UNAVAILABLE')}
  require(Array.isArray(r?.rows)&&r.rows.length===1&&exact(r.rows[0],['result']),'PUBLISHER_BINDING_STATUS_INVALID')
  const v=r.rows[0].result,at=clock()
  require(exact(v,statusFields)&&v.schemaVersion==='AQC_PUBLISHER_CAS_STATUS_V1'&&v.applicationId==='spendguru'
   &&v.environment==='development'&&v.profile===profile&&(v.currentSourceSha===null||sha(v.currentSourceSha))
   &&['bindingsFresh','publishingEnabled','recoveryEnabled'].every(k=>typeof v[k]==='boolean')
   &&v.rawQaReadPerformed===false&&v.permissionMutationPerformed===false
   &&typeof v.authorisedUntil==='string'&&Number.isFinite(Date.parse(v.authorisedUntil))&&new Date(v.authorisedUntil).toISOString()===v.authorisedUntil
   &&Date.parse(v.authorisedUntil)>at&&Date.parse(v.authorisedUntil)<=expiry,'PUBLISHER_BINDING_STATUS_INVALID')
  if(v.operation!==null)require(exact(v.operation,operationFields)&&uuid(v.operation.operationId)&&v.operation.operationId===id
   &&sha(v.operation.fromSourceSha)&&sha(v.operation.toSourceSha)&&v.operation.fromSourceSha!==v.operation.toSourceSha
   &&(v.operation.restoreOf===null||uuid(v.operation.restoreOf)),'PUBLISHER_BINDING_STATUS_INVALID')
  return freeze(structuredClone(v))
 }
 async function snapshots(id){const result=[];for(const profile of profiles)result.push(await status(profile,id));return result}
 function classify(v,request){
  const {operationId,fromSourceSha:from,toSourceSha:to}=request
  if(v.operation!==null){
   require(operation(v.operation,operationId,from,to),'PUBLISHER_BINDING_OPERATION_CONFLICT')
   require(v.currentSourceSha===to,'PUBLISHER_BINDING_FOREIGN_VERSION')
   return 'APPLIED'
  }
  require(v.currentSourceSha===from,'PUBLISHER_BINDING_FOREIGN_VERSION')
  return 'UNAPPLIED'
 }
 function report(states){
  const applied=states.filter(x=>x==='APPLIED').length
  return Object.freeze({status:applied===2?'BINDINGS_APPLIED':applied===0?'BINDINGS_UNCHANGED':'BINDINGS_PARTIALLY_APPLIED',
   updatedBindings:applied*3,rawQaReadPerformed:false,permissionMutationPerformed:false})
 }
 async function mutate(profile,request,restoreOf=null){
  const at=clock(),until=new Date(Math.min(at+10*60000,expiry)).toISOString()
  let r
  try{r=await queries[profile]('SELECT profitia_quality_release.quality_deployment_cas($1::uuid,$2::text,$3::text,$4::uuid,$5::timestamptz) AS result',
   [request.operationId,request.fromSourceSha,request.toSourceSha,restoreOf,until])}
  catch{fail('PUBLISHER_BINDING_CAS_UNCERTAIN')}
  require(Array.isArray(r?.rows)&&r.rows.length===1&&exact(r.rows[0],['result']),'PUBLISHER_BINDING_CAS_UNCERTAIN')
  const v=r.rows[0].result
  require(exact(v,resultFields)&&v.applicationId==='spendguru'&&v.environment==='development'&&v.profile===profile
   &&v.operationId===request.operationId&&v.fromSourceSha===request.fromSourceSha&&v.toSourceSha===request.toSourceSha
   &&[restoreOf===null?'APPLIED':'RESTORED','REPLAY'].includes(v.status)&&v.updatedBindings===3
   &&v.rawQaReadPerformed===false&&v.permissionMutationPerformed===false,'PUBLISHER_BINDING_CAS_UNCERTAIN')
 }
 return Object.freeze({
  async check(request){
   require(exact(request,['sourceSha']));const {sourceSha}=request;require(sha(sourceSha));const values=await snapshots(null)
   require(values.every(v=>v.currentSourceSha===sourceSha),'PUBLISHER_BINDING_FOREIGN_VERSION')
   return freeze({status:'BINDINGS_VERIFIED',sourceSha,bindingsFresh:values.every(v=>v.bindingsFresh),
    publishingEnabled:promotionEnabled&&values.every(v=>v.publishingEnabled),
    recoveryEnabled:recoveryEnabled&&values.every(v=>v.recoveryEnabled),updatedBindings:0,
    rawQaReadPerformed:false,permissionMutationPerformed:false})
  },
  async reconcile(request){
   const v=input(request),values=await snapshots(v.operationId)
   return report(values.map(s=>classify(s,v)))
  },
  async advance(request){
   if(!promotionEnabled)fail('PROMOTION_DISABLED')
   const v=input(request),values=await snapshots(v.operationId),states=values.map(s=>classify(s,v))
   // Validate both installations before the first write. A previously applied
   // native operation is never dispatched again after a lost response.
   require(values.every(s=>s.publishingEnabled&&s.bindingsFresh),'PUBLISHER_BINDING_PROMOTION_UNAVAILABLE')
   for(let i=0;i<profiles.length;i++)if(states[i]==='UNAPPLIED')await mutate(profiles[i],v)
   return report((await snapshots(v.operationId)).map(s=>classify(s,v)))
  },
  async restore(request){
   if(!recoveryEnabled)fail('RECOVERY_DISABLED')
   const v=input(request,true),original=await snapshots(v.operationId),restored=await snapshots(v.restoreOperationId)
   const states=original.map((s,i)=>{
    require(s.recoveryEnabled&&restored[i].recoveryEnabled,'RECOVERY_DISABLED')
    if(restored[i].operation!==null){
     require(operation(restored[i].operation,v.restoreOperationId,v.toSourceSha,v.fromSourceSha,v.operationId)
      &&restored[i].currentSourceSha===v.fromSourceSha&&s.currentSourceSha===v.fromSourceSha,'PUBLISHER_BINDING_RECOVERY_UNVERIFIED')
     return 'RESTORED'
    }
    if(s.operation===null){require(s.currentSourceSha===v.fromSourceSha&&restored[i].currentSourceSha===v.fromSourceSha,
     'PUBLISHER_BINDING_FOREIGN_VERSION');return 'UNAPPLIED'}
    require(operation(s.operation,v.operationId,v.fromSourceSha,v.toSourceSha)&&s.currentSourceSha===v.toSourceSha
     &&restored[i].currentSourceSha===v.toSourceSha,'PUBLISHER_BINDING_RECOVERY_UNVERIFIED')
    return 'APPLIED'
   })
   // Recovery remains available when promotion or source grants are disabled.
   // Only the recorded original CAS may be reversed; no role/grant is renewed.
   for(let i=0;i<profiles.length;i++)if(states[i]==='APPLIED')await mutate(profiles[i],
    {operationId:v.restoreOperationId,fromSourceSha:v.toSourceSha,toSourceSha:v.fromSourceSha},v.operationId)
   const final=await snapshots(v.restoreOperationId)
   require(final.every((s,i)=>s.currentSourceSha===v.fromSourceSha&&(states[i]==='UNAPPLIED'&&s.operation===null
    ||operation(s.operation,v.restoreOperationId,v.toSourceSha,v.fromSourceSha,v.operationId))),'PUBLISHER_BINDING_RECOVERY_UNVERIFIED')
   return Object.freeze({status:'BINDINGS_RESTORED',sourceSha:v.fromSourceSha,updatedBindings:states.filter(s=>s!=='UNAPPLIED').length*3,
    rawQaReadPerformed:false,permissionMutationPerformed:false})
  },
 })
}
