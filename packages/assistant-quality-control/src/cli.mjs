import {SOURCE_PATHS,documentDigest} from './manifest.mjs'

/** Prepare reviewable unsigned metadata. These builders create no signature,
 * role, permission, resource, wallet, installation or runtime activation. The
 * owner and independent exporter must attest through their separate channels. */
export function ownerMandateBody({id,issuedAt,expiresAt,targetServiceId,gateSetSha256}){
 return {id,version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',issuedAt,expiresAt,
  projectKey:'SG2',repository:'profitia/SG-dev',targetServiceId,classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256,
  controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,maxAttemptSeconds:1800,
  maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
}
export function repairManifestBody({mandate,incidentId,correlationId,baseSha,repairClass,exportReceiptId,fixtureSha256}){
 const b=mandate.body
 return {schemaVersion:'REPAIR_MANIFEST_V1',incidentId,repairClass,projectKey:'SG2',repository:'profitia/SG-dev',baseSha,
  allowedPaths:[SOURCE_PATHS[repairClass],`apps/sg-runtime/tests/assistant-quality-regressions/${incidentId}.test.ts`],
  mandate:{id:b.id,version:b.version,sha256:documentDigest(b),issuedAt:b.issuedAt,expiresAt:b.expiresAt,attestation:mandate.attestation},gateSetSha256:b.gateSetSha256,
  synthetic:{fixtureId:'qa_synthetic_'+fixtureSha256,sha256:fixtureSha256,exportReceiptId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId}
}

const unavailable=code=>{throw Object.assign(Error('Quality readiness unavailable'),{code})}
const hash64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const uuidValue=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const controlHosts=['ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech','ep-muddy-pine-b22pdyqd-pooler.c-6.eu-central-1.aws.neon.tech']
const limitsHosts=['ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech','ep-muddy-surf-b9vpyy2d-pooler.c-7.eu-central-1.aws.neon.tech']
function database(value,role,hosts){
 try{
  const u=new URL(value)
  if(!['postgres:','postgresql:'].includes(u.protocol)||!hosts.includes(u.hostname)||u.port&&u.port!=='5432'
   ||decodeURIComponent(u.username)!==role||!u.password||u.pathname!=='/neondb'||u.hash
   ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
   ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')throw Error()
  // Construct pg options explicitly: a URL parser cannot override strict TLS.
  return Object.freeze({host:u.hostname,port:5432,user:role,password:decodeURIComponent(u.password),database:'neondb',ssl:Object.freeze({rejectUnauthorized:true})})
 }catch{unavailable('READINESS_DATABASE_BINDING_INVALID')}
}
/** This process has no repair/publish mode or model credential. Installation
 * status probes do not reserve spend, start the pilot or dispatch an executor. */
export function readQualityReadinessConfiguration(env){
 if(env.TARGET_ENVIRONMENT!=='development'||env.AQC_MODE!=='TECHNICAL_READINESS'
  ||env.AQC_PAID_REPAIRS_ENABLED!=='false'||env.AQC_PROMOTION_ENABLED!=='false'
  ||!/^srv-[a-z0-9]{10,40}$/.test(env.RENDER_SERVICE_ID??'')
  ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??'')
  ||!uuidValue(env.AQC_SERVICE_UUID)||!hash64(env.AQC_CONTROL_COMMAND_KEY)||!hash64(env.AQC_LIMITS_COMMAND_KEY)
  ||env.AQC_CONTROL_COMMAND_KEY===env.AQC_LIMITS_COMMAND_KEY
  ||['OPENAI_API_KEY','RENDER_API_KEY','GH_TOKEN','GITHUB_TOKEN','AQC_OWNER_PRIVATE_KEY','AQC_PUBLISHER_PRIVATE_KEY'].some(k=>env[k]))unavailable('READINESS_CONFIGURATION_INVALID')
 return Object.freeze({sourceSha:env.RENDER_GIT_COMMIT,renderServiceId:env.RENDER_SERVICE_ID,serviceId:env.AQC_SERVICE_UUID,
  controlKey:env.AQC_CONTROL_COMMAND_KEY,limitsKey:env.AQC_LIMITS_COMMAND_KEY,
  control:database(env.AQC_CONTROL_DATABASE_URL,'sg2_assistant_quality_controller',controlHosts),
  limits:database(env.AQC_LIMITS_DATABASE_URL,'profitia_limits_quality_controller',limitsHosts)})
}
export function createQualityReadiness({store,budget,sourceSha,serviceId,now=Date.now}){
 if(typeof store?.descriptor!=='function'||typeof budget?.status!=='function'||!/^[a-f0-9]{40}$/.test(sourceSha??'')
  ||!uuidValue(serviceId)||typeof now!=='function')unavailable('READINESS_CONFIGURATION_INVALID')
 return Object.freeze({async check(){
  const [control,limits]=await Promise.all([store.descriptor(),budget.status()])
  if(control.enabled!==false||limits.status!=='DISABLED'||limits.pilotStartedAt!==null||limits.pilotExpiresAt!==null
   ||limits.maximumNanoUsd!=='50000000000'||!/^[0-9]+$/.test(limits.committedNanoUsd??'')
   ||BigInt(limits.committedNanoUsd)!==0n)unavailable('READINESS_SAFETY_STATE_INVALID')
  return Object.freeze({schemaVersion:'AQC_TECHNICAL_READINESS_V1',status:'MONITORING_READY',sourceSha,serviceId,
   observedAt:new Date(now()).toISOString(),controlStore:'CONNECTED_DISABLED',nativeLimits:'CONNECTED_DISABLED',
   paidRepairsEnabled:false,promotionEnabled:false,pilotStartedAt:null,acceptanceRepairsCompleted:0})
 }})
}
async function readinessMain(){
 const config=readQualityReadinessConfiguration(process.env)
 const [{default:pg},{createQualityStore},{createQualityBudget},{readFileSync},{createHash}]=await Promise.all([
  import('pg'),import('./store.mjs'),import('./budget.mjs'),import('node:fs'),import('node:crypto')])
 const digest=url=>createHash('sha256').update(readFileSync(url)).digest('hex')
 const controlDigest=digest(new URL('../migrations/001-control.sql',import.meta.url))
 const limitsDigest=digest(new URL('../../../apps/package-limits/migrations/005-assistant-quality-usage.sql',import.meta.url))
 const pools=[new pg.Pool({...config.control,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true}),
  new pg.Pool({...config.limits,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true})]
 const stop=new AbortController(),abort=()=>stop.abort()
 process.once('SIGTERM',abort);process.once('SIGINT',abort)
 // Capture transport failures as metadata only; node-postgres must not emit an
 // uncaught idle-pool error containing connection details into provider logs.
 let poolError=false;for(const p of pools)p.on('error',()=>{poolError=true})
 const store=createQualityStore({query:(q,v)=>pools[0].query(q,v),commandKey:config.controlKey,schemaDigest:controlDigest,serviceId:config.serviceId})
 const budget=createQualityBudget({query:(q,v)=>pools[1].query(q,v),commandKey:config.limitsKey,schemaDigest:limitsDigest,serviceId:config.serviceId,role:'profitia_limits_quality_controller'})
 const readiness=createQualityReadiness({store,budget,sourceSha:config.sourceSha,serviceId:config.serviceId})
 try{
  while(!stop.signal.aborted){
   if(poolError)unavailable('READINESS_PROVIDER_UNAVAILABLE')
   const result=await readiness.check()
   console.log(JSON.stringify({event:'aqc.technical.heartbeat',...result,renderServiceId:config.renderServiceId}))
   // This is technical monitoring only. It is not the regular QA schedule.
   await new Promise(resolve=>{
    const finish=()=>{clearTimeout(timer);stop.signal.removeEventListener('abort',finish);resolve()}
    const timer=setTimeout(finish,15*60000);stop.signal.addEventListener('abort',finish,{once:true})
    if(stop.signal.aborted)finish()
   })
  }
 }finally{
  process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)
  await Promise.all(pools.map(p=>p.end()))
 }
}
if(process.argv[1]){
 const {fileURLToPath}=await import('node:url'),path=await import('node:path')
 if(path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==3||process.argv[2]!=='readiness')unavailable('READINESS_MODE_REQUIRED');await readinessMain()}
  catch(error){console.error(JSON.stringify({event:'aqc.technical.failure',code:/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'READINESS_UNAVAILABLE'}));process.exitCode=1}
 }
}
