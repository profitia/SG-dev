import {createHash} from 'node:crypto'

const DAY=86400000
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const safeCode=error=>/^[A-Z0-9_]{1,64}$/.test(error?.code??'')?error.code:'CONTROL_PLANE_UNAVAILABLE'

/** @typedef {{dependency:string,kind:string,source:string,expiresAt:string|null,observedAt:string,reason:string,severity:string,action:string,thresholdDays?:number,remainingDays?:number,fingerprint?:string,delivery?:string,simulatedThresholdDays?:number}} AccessNotice */
/** Control-plane metadata only. This never obtains data or authorises a read.
 * @returns {AccessNotice[]}
 */
export function expiryNotices(dependencies,at=new Date()){
 const now=new Date(at).getTime()
 if(!Number.isFinite(now)||!Array.isArray(dependencies)||dependencies.length>100||new Set(dependencies.map(d=>d?.id)).size!==dependencies.length)throw Error('INVALID_ACCESS_SNAPSHOT')
 return dependencies.flatMap(d=>{
  if(!d||typeof d.id!=='string'||!/^[a-zA-Z0-9._:-]{1,180}$/.test(d.id)||typeof d.kind!=='string')throw Error('INVALID_ACCESS_DEPENDENCY')
  const base={dependency:d.id,kind:d.kind,source:d.source??'ECR',expiresAt:d.expiresAt??null,observedAt:new Date(now).toISOString()}
  if(d.status==='ERROR')return [{...base,reason:'TECHNICAL_FAILURE',severity:'ERROR',action:'Check the named control plane and the renewal result; do not recreate or widen grants.'}]
  if(d.status!=='ACTIVE')return [{...base,reason:'ACCESS_LOST',severity:'ERROR',action:'The responsible owner must resolve the inactive or revoked admission; automatic renewal must not restore it.'}]
  if(d.expiryMode==='NO_FIXED_EXPIRY'&&d.expiresAt===null)return []
  const end=Date.parse(d.expiresAt??'')
  if(!Number.isFinite(end))return [{...base,reason:'VALIDITY_UNKNOWN',severity:'ERROR',action:'The source or licence owner must establish the actual validity; a missing date is not perpetual permission.'}]
  const remainingMs=end-now,remainingDays=Math.ceil(remainingMs/DAY)
  if(remainingMs<=0)return [{...base,remainingDays:0,reason:'ACCESS_EXPIRED',severity:'ERROR',action:'Owner recovery is required; automatic renewal must not revive expired rights.'}]
  const threshold=[1,3,7,14].find(days=>remainingMs<=days*DAY)
  return threshold?[{...base,remainingDays,thresholdDays:threshold,reason:'EXPIRING',severity:threshold<=1?'ERROR':'WARNING',action:d.action??'The responsible owner must renew the real prerequisite before this deadline; do not extend a provider contract automatically.'}]:[]
 })
}

/** One signal per validity epoch and threshold. Successful renewal clears the
 * previous incident; continuing failures get a daily reminder, not a 15m storm.
 */
/** @param {any} previous @param {any[]} dependencies @param {{at?:Date|string,deliveryTest?:{id:string,until:string}|null}} options */
export function reconcileExpiryNotices(previous,dependencies,{at=new Date(),deliveryTest=null}={}){
 const now=new Date(at),notices=expiryNotices(dependencies,now),old=previous?.version===1?previous.incidents??{}:{},incidents={},alerts=[],resolved=[]
 for(const n of notices){
  const fingerprint=digest([n.dependency,n.reason,n.expiresAt,n.thresholdDays??null]),prior=old[n.dependency]
  const reminder=n.reason!=='EXPIRING'&&prior&&now.getTime()-Date.parse(prior.lastSignalledAt)>=DAY
  const notify=!prior||prior.fingerprint!==fingerprint||reminder
  incidents[n.dependency]={fingerprint,lastSignalledAt:notify?now.toISOString():prior.lastSignalledAt}
  if(notify)alerts.push({...n,fingerprint,delivery:'RENDER_CRON_FAILURE_NOTIFICATION_WITH_LOG_DETAILS'})
 }
 for(const id of Object.keys(old))if(!incidents[id])resolved.push(id)
 let testId=previous?.version===1?previous.deliveryTestId??null:null
 if(deliveryTest){
  if(!/^[a-f0-9-]{36}$/.test(deliveryTest.id)||!Number.isFinite(Date.parse(deliveryTest.until)))throw Error('INVALID_DELIVERY_TEST')
  if(new Date(deliveryTest.until)>now&&new Date(deliveryTest.until).getTime()-now.getTime()<=3600000&&testId!==deliveryTest.id){
   const d=dependencies.find(x=>x.kind==='SOURCE_ADMISSION'&&x.expiresAt)
   if(!d)throw Error('REAL_SOURCE_METADATA_REQUIRED_FOR_DELIVERY_TEST')
   alerts.push({dependency:d.id,kind:d.kind,source:d.source,expiresAt:d.expiresAt,observedAt:now.toISOString(),reason:'CONTROLLED_DELIVERY_TEST',severity:'WARNING',remainingDays:Math.ceil((Date.parse(d.expiresAt)-now.getTime())/DAY),simulatedThresholdDays:14,action:'Delivery test only. No real right was expired, revoked or modified for this test.',fingerprint:digest(['DELIVERY_TEST',deliveryTest.id]),delivery:'RENDER_CRON_FAILURE_NOTIFICATION_WITH_LOG_DETAILS'})
   testId=deliveryTest.id
  }
 }
 return {alerts,resolved,state:{version:1,lastCheckedAt:now.toISOString(),incidents,deliveryTestId:testId}}
}

export async function maintainSourceAccess(query){
 try{
  const {rows:[r]}=await query('SELECT source_hub.maintain_ecr_source_access() AS result')
  if(!r?.result||!Array.isArray(r.result.dependencies))throw Error('SOURCE_ACCESS_SNAPSHOT_REQUIRED')
  return r.result
 }catch(error){
  let dependencies=[]
  try{const {rows:[r]}=await query('SELECT source_hub.ecr_source_access_status() AS result');dependencies=r?.result?.dependencies??[]}catch{}
  return {status:'FAILED',dependencies:[...dependencies,{id:'source-renewal',kind:'RENEWAL',source:'SourceHub',status:'ERROR',expiresAt:null,errorCode:safeCode(error)}]}
 }
}

export async function monitorAccess({database,sourceState,identityQuery,serviceRenewal,deliveryTest=null,at=new Date()}){
 let identity
 try{const {rows:[r]}=await identityQuery('SELECT profitia_e1_authority.ecr_access_expiry_status() AS result');identity=r?.result;if(!Array.isArray(identity?.dependencies))throw Error('IDENTITY_ACCESS_SNAPSHOT_REQUIRED')}
 catch(error){identity={dependencies:[{id:'identity-status',kind:'CONTROL_PLANE',source:'Identity',status:'ERROR',expiresAt:null,errorCode:safeCode(error)}]}}
 const dependencies=[...sourceState.dependencies,...identity.dependencies]
 if(!['CURRENT','RENEWED'].includes(serviceRenewal?.status))dependencies.push({id:'service-renewal',kind:'RENEWAL',source:'ECR SERVICE',status:'ERROR',expiresAt:null})
 const jobs=await database.query('SELECT job_id,provider_id,status,last_error_code FROM economic_calendar.sync_jobs ORDER BY job_id')
 for(const job of jobs.rows)if(job.status!=='ACTIVE'||job.last_error_code)dependencies.push({id:'sync:'+job.job_id,kind:'SOURCE_ACQUISITION',source:job.provider_id,status:'ERROR',expiresAt:null})
 const result=await database.transact(async t=>{
  const {rows:[job]}=await t.query("SELECT last_result FROM economic_calendar.sync_jobs WHERE job_id='eia-wpsr-results' FOR UPDATE")
  if(!job)throw Error('EXISTING_MONITOR_STATE_ANCHOR_REQUIRED')
  const checked=reconcileExpiryNotices(job.last_result?.accessMonitoring,dependencies,{at,deliveryTest})
  await t.query("UPDATE economic_calendar.sync_jobs SET last_result=jsonb_set(coalesce(last_result,'{}'::jsonb),'{accessMonitoring}',$1::jsonb) WHERE job_id='eia-wpsr-results'",[JSON.stringify(checked.state)])
  return checked
 })
 return {sourceRenewal:sourceState.status,serviceRenewal:serviceRenewal?.status??'FAILED',dependenciesChecked:dependencies.length,...result}
}
