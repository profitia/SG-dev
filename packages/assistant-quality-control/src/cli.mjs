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
function database(value,role,hosts,databaseName='neondb'){
 try{
  const u=new URL(value)
  if(!['postgres:','postgresql:'].includes(u.protocol)||!hosts.includes(u.hostname)||u.port&&u.port!=='5432'
   ||decodeURIComponent(u.username)!==role||!u.password||u.pathname!=='/'+databaseName||u.hash
   ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
   ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')throw Error()
  // Construct pg options explicitly: a URL parser cannot override strict TLS.
  return Object.freeze({host:u.hostname,port:5432,user:role,password:decodeURIComponent(u.password),database:databaseName,ssl:Object.freeze({rejectUnauthorized:true}),
   ...(u.searchParams.get('channel_binding')==='require'?{enableChannelBinding:true}:{})})
 }catch{unavailable('READINESS_DATABASE_BINDING_INVALID')}
}
const qaRoleBindings=Object.freeze({
 purpose:Object.freeze({role:'sg2_assistant_quality_authority',database:'platform_private',schema:'profitia_assistant_quality_access',
  owner:'profitia_access_owner',hosts:['ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech','ep-late-heart-b9mxo8oi-pooler.c-7.eu-central-1.aws.neon.tech']}),
 evidence:Object.freeze({role:'sg2_assistant_quality_reader',database:'neondb',schema:'sg2_assistant_quality_evidence',
  owner:'sg2_assistant_history_owner',hosts:controlHosts}),
})
/** Approved ordinary role connections only. No QA HMAC/storage key or data
 * reader is admitted in this preflight; it cannot issue a grant or GET QA. */
export function readQualityQaRolePreflightConfiguration(env){
 const names=['AQC_QA_ROLE_PREFLIGHT_VERSION','AQC_QA_PURPOSE_DATABASE_URL','AQC_QA_EVIDENCE_DATABASE_URL']
 const forbidden=['AQC_QA_PURPOSE_COMMAND_KEY','AQC_QA_EVIDENCE_COMMAND_KEY','AQC_QA_STORAGE_KEY']
 if(forbidden.some(k=>env[k]))unavailable('QA_ROLE_PREFLIGHT_CONFIGURATION_INVALID')
 if(names.every(k=>env[k]===undefined))return null
 if(env.TARGET_ENVIRONMENT!=='development'||!['TECHNICAL_READINESS','CONTROLLER_STANDBY'].includes(env.AQC_MODE)
  ||env.AQC_PAID_REPAIRS_ENABLED!=='false'||env.AQC_PROMOTION_ENABLED!=='false'||env.AQC_QA_ROLE_PREFLIGHT_VERSION!=='1.0.0'
  ||names.some(k=>typeof env[k]!=='string'||!env[k]))unavailable('QA_ROLE_PREFLIGHT_CONFIGURATION_INVALID')
 return Object.freeze({
  purpose:database(env.AQC_QA_PURPOSE_DATABASE_URL,qaRoleBindings.purpose.role,qaRoleBindings.purpose.hosts,qaRoleBindings.purpose.database),
  evidence:database(env.AQC_QA_EVIDENCE_DATABASE_URL,qaRoleBindings.evidence.role,qaRoleBindings.evidence.hosts,qaRoleBindings.evidence.database),
 })
}
export function qualityQaRolePreflightQuery(kind){
 if(!Object.hasOwn(qaRoleBindings,kind))unavailable('QA_ROLE_PREFLIGHT_CONFIGURATION_INVALID')
 const b=qaRoleBindings[kind]
 return "SELECT current_database() AS database_name,current_user AS role,session_user AS login,"+
  "r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,r.rolcanlogin,r.rolconnlimit,r.rolvaliduntil,"+
  "pg_has_role(session_user,'"+b.owner+"','MEMBER') AS owner_member,"+
  "has_schema_privilege(session_user,'"+b.schema+"','USAGE') AS schema_usage,"+
  "has_schema_privilege(session_user,'"+b.schema+"','CREATE') AS schema_create,"+
  "coalesce(has_function_privilege(session_user,to_regprocedure('"+b.schema+".apply(text,text)'),'EXECUTE'),false) AS installed,"+
  "(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='"+b.schema+"' AND c.relkind IN('r','p')) AS schema_tables,"+
  "coalesce((SELECT bool_or(has_table_privilege(session_user,c.oid,'SELECT') OR has_table_privilege(session_user,c.oid,'INSERT') "+
  "OR has_table_privilege(session_user,c.oid,'UPDATE') OR has_table_privilege(session_user,c.oid,'DELETE')) "+
  "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='"+b.schema+"' AND c.relkind IN('r','p')),false) AS direct_table_access "+
  "FROM pg_roles r WHERE r.rolname=current_user"
}
export function createQualityQaRolePreflight({purposeQuery,evidenceQuery,now=Date.now}){
 if(typeof purposeQuery!=='function'||typeof evidenceQuery!=='function'||typeof now!=='function')unavailable('QA_ROLE_PREFLIGHT_CONFIGURATION_INVALID')
 return Object.freeze({async check(){
  const at=now();if(!Number.isFinite(at))unavailable('QA_ROLE_PREFLIGHT_BINDING_INVALID')
  for(const [kind,query]of [['purpose',purposeQuery],['evidence',evidenceQuery]]){
   let rows;try{rows=(await query(qualityQaRolePreflightQuery(kind))).rows}catch{unavailable('QA_ROLE_PREFLIGHT_UNAVAILABLE')}
   const v=rows?.[0],b=qaRoleBindings[kind],expiry=v?.rolvaliduntil instanceof Date?v.rolvaliduntil.getTime():
    typeof v?.rolvaliduntil==='string'?Date.parse(v.rolvaliduntil):NaN
   if(rows?.length!==1||v.database_name!==b.database||v.role!==b.role||v.login!==b.role
    ||['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolinherit','rolreplication','owner_member','schema_create','direct_table_access'].some(k=>v[k]!==false)
    ||v.rolcanlogin!==true||v.rolconnlimit!==3||v.schema_usage!==true||v.installed!==true
    ||!Number.isInteger(v.schema_tables)||v.schema_tables<1||!Number.isFinite(expiry)||expiry<=at
    ||expiry>Date.parse('2026-11-27T23:59:59.000Z'))unavailable('QA_ROLE_PREFLIGHT_BINDING_INVALID')
  }
  return Object.freeze({schemaVersion:'AQC_QA_ROLE_PREFLIGHT_V1',status:'QA_ROLES_VERIFIED',
   qaAuthority:'CONNECTED_READ_ONLY_ROLE',qaEvidence:'CONNECTED_READ_ONLY_ROLE',
   rawQaReadPerformed:false,permissionMutationPerformed:false})
 }})
}
/** Public deployment-source capability only: never environment values, remote
 * URLs, credentials, a directory listing or private QA content. */
export async function qualityWorkerSourceCapabilities(sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))unavailable('READINESS_CONFIGURATION_INVALID')
 const [fs,{fileURLToPath},{spawnSync}]=await Promise.all([import('node:fs'),import('node:url'),import('node:child_process')])
 const root=fileURLToPath(new URL('../../../',import.meta.url))
 const ordinary=(path,fileOnly=false)=>{try{const s=fs.lstatSync(path);return !s.isSymbolicLink()&&(s.isFile()||!fileOnly&&s.isDirectory())}catch{return false}}
 const checkout=ordinary(root+'/.git'),hostCodec=ordinary(root+'/apps/sg-runtime/lib/assistant/quality-evidence.ts',true)
 let gitExecutable=false,gitHeadMatches=false
 try{fs.accessSync('/usr/bin/git',fs.constants.X_OK);gitExecutable=true}catch{}
 if(checkout&&gitExecutable){
  try{const v=spawnSync('/usr/bin/git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',timeout:3000,maxBuffer:1024,
   env:{PATH:'/usr/bin:/bin',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}})
   gitHeadMatches=v.status===0&&v.stdout.trim()===sourceSha}catch{}
 }
 return Object.freeze({checkoutMetadataPresent:checkout,gitExecutableAvailable:gitExecutable,gitHeadMatchesSource:gitHeadMatches,
  hostQaCodecPresent:hostCodec,nodeMajorSupported:Number(process.versions.node.split('.')[0])>=24})
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
  ||['OPENAI_API_KEY','RENDER_API_KEY','GH_TOKEN','GITHUB_TOKEN','AQC_OWNER_PRIVATE_KEY','AQC_PUBLISHER_PRIVATE_KEY','AQC_CONTROLLER_GITHUB_TOKEN','AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT'].some(k=>env[k]))unavailable('READINESS_CONFIGURATION_INVALID')
 return Object.freeze({sourceSha:env.RENDER_GIT_COMMIT,renderServiceId:env.RENDER_SERVICE_ID,serviceId:env.AQC_SERVICE_UUID,
  controlKey:env.AQC_CONTROL_COMMAND_KEY,limitsKey:env.AQC_LIMITS_COMMAND_KEY,
  control:database(env.AQC_CONTROL_DATABASE_URL,'sg2_assistant_quality_controller',controlHosts),
  limits:database(env.AQC_LIMITS_DATABASE_URL,'profitia_limits_quality_controller',limitsHosts)})
}
/** Separate, explicit controller standby. Only the approved repository-limited
 * fine-grained credential is admitted; it never enters the readiness-only mode,
 * executor, publisher, model client or operational telemetry. */
export function readQualityControllerStandbyConfiguration(env,now=Date.now()){
 const expiry=env.AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT
 if(env.AQC_MODE!=='CONTROLLER_STANDBY'||typeof env.AQC_CONTROLLER_GITHUB_TOKEN!=='string'
  ||!/^github_pat_[A-Za-z0-9_]{40,240}$/.test(env.AQC_CONTROLLER_GITHUB_TOKEN)
  ||typeof expiry!=='string'||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString()!==expiry
  ||!Number.isFinite(now)||Date.parse(expiry)<=now||Date.parse(expiry)>Date.parse('2026-11-27T23:59:59.000Z'))
  unavailable('CONTROLLER_CONFIGURATION_INVALID')
 const base=readQualityReadinessConfiguration({...env,AQC_MODE:'TECHNICAL_READINESS',
  AQC_CONTROLLER_GITHUB_TOKEN:undefined,AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:undefined})
 return Object.freeze({...base,githubToken:env.AQC_CONTROLLER_GITHUB_TOKEN,credentialExpiresAt:expiry})
}
export function createQualityControllerStandby({readiness,github,credentialExpiresAt,now=Date.now}){
 if(typeof readiness?.check!=='function'||typeof github?.descriptor!=='function'||typeof github?.qualificationDescriptor!=='function'
  ||typeof now!=='function'||typeof credentialExpiresAt!=='string'||!Number.isFinite(Date.parse(credentialExpiresAt))
  ||new Date(credentialExpiresAt).toISOString()!==credentialExpiresAt||Date.parse(credentialExpiresAt)>Date.parse('2026-11-27T23:59:59.000Z'))
  unavailable('CONTROLLER_CONFIGURATION_INVALID')
 return Object.freeze({async check(){
  const observed=now();if(!Number.isFinite(observed)||Date.parse(credentialExpiresAt)<=observed)unavailable('CONTROLLER_CREDENTIAL_EXPIRED')
  const result=await readiness.check()
  if(result?.status!=='MONITORING_READY'||result.paidRepairsEnabled!==false||result.promotionEnabled!==false||result.pilotStartedAt!==null)unavailable('CONTROLLER_SAFETY_STATE_INVALID')
  const [repository,workflow]=await Promise.all([github.descriptor(),github.qualificationDescriptor()])
  if(repository?.repository!=='profitia/SG-dev'||repository.publisherEnabled!==false||repository.promotionEnabled!==false
   ||!/^[a-f0-9]{40}$/.test(repository.headSha??'')||workflow?.path!=='.github/workflows/assistant-quality-repair.yml'
   ||workflow.state!=='active')unavailable('CONTROLLER_GITHUB_BINDING_INVALID')
  return Object.freeze({...result,controllerGitHub:'CONNECTED_STANDBY',qualificationWorkflow:'CONNECTED_MAIN_ONLY',
   paidRepairsEnabled:false,promotionEnabled:false,pilotStartedAt:null})
 }})
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
async function readinessMain(controllerStandby=false){
 const config=controllerStandby?readQualityControllerStandbyConfiguration(process.env):readQualityReadinessConfiguration(process.env)
 const qaConfig=readQualityQaRolePreflightConfiguration(process.env)
 const [{default:pg},{createQualityStore},{createQualityBudget},{readFileSync},{createHash},{createQualityMonitoring}]=await Promise.all([
  import('pg'),import('./store.mjs'),import('./budget.mjs'),import('node:fs'),import('node:crypto'),import('./monitoring.mjs')])
 const digest=url=>createHash('sha256').update(readFileSync(url)).digest('hex')
 const controlDigest=digest(new URL('../migrations/001-control.sql',import.meta.url))
 const limitsDigest=digest(new URL('../../../apps/package-limits/migrations/005-assistant-quality-usage.sql',import.meta.url))
 const pools=[new pg.Pool({...config.control,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true}),
  new pg.Pool({...config.limits,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true})]
 if(qaConfig)for(const database of [qaConfig.purpose,qaConfig.evidence])pools.push(new pg.Pool({...database,
  max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true}))
 const qaPreflight=qaConfig?createQualityQaRolePreflight({purposeQuery:q=>pools[2].query(q),evidenceQuery:q=>pools[3].query(q)}):null
 const stop=new AbortController(),abort=()=>stop.abort()
 process.once('SIGTERM',abort);process.once('SIGINT',abort)
 // Capture transport failures as metadata only; node-postgres must not emit an
 // uncaught idle-pool error containing connection details into provider logs.
 let poolError=false;for(const p of pools)p.on('error',()=>{poolError=true})
 const store=createQualityStore({query:(q,v)=>pools[0].query(q,v),commandKey:config.controlKey,schemaDigest:controlDigest,serviceId:config.serviceId})
 const budget=createQualityBudget({query:(q,v)=>pools[1].query(q,v),commandKey:config.limitsKey,schemaDigest:limitsDigest,serviceId:config.serviceId,role:'profitia_limits_quality_controller'})
 const nativeReadiness=createQualityReadiness({store,budget,sourceSha:config.sourceSha,serviceId:config.serviceId})
 let readiness=nativeReadiness
 if(controllerStandby){
  const {createQualityGitHub}=await import('./github.mjs')
  const github=createQualityGitHub({token:config.githubToken,publisherEnabled:false,promotionEnabled:false})
  readiness=createQualityControllerStandby({readiness:nativeReadiness,github,credentialExpiresAt:config.credentialExpiresAt})
 }
 const monitoring=createQualityMonitoring({env:process.env,warn:value=>console.warn(JSON.stringify(value)),onDelivery:value=>console.log(JSON.stringify({...value,sourceSha:config.sourceSha}))})
 try{
  while(!stop.signal.aborted){
   if(poolError)unavailable('READINESS_PROVIDER_UNAVAILABLE')
   const result=await readiness.check()
   if(qaPreflight){
    const qa=await qaPreflight.check(),source=await qualityWorkerSourceCapabilities(config.sourceSha)
    console.log(JSON.stringify({event:'aqc.technical.qa.role_preflight',...qa,...source,sourceSha:config.sourceSha,observedAt:result.observedAt}))
   }
   monitoring.heartbeat(result)
   console.log(JSON.stringify({event:'aqc.technical.heartbeat',...result,renderServiceId:config.renderServiceId}))
   // This is technical monitoring only. It is not the regular QA schedule.
   await new Promise(resolve=>{
    const finish=()=>{clearTimeout(timer);stop.signal.removeEventListener('abort',finish);resolve()}
    const timer=setTimeout(finish,15*60000);stop.signal.addEventListener('abort',finish,{once:true})
    if(stop.signal.aborted)finish()
   })
  }
 }catch(error){monitoring.failure(error?.code);throw error}finally{
  process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)
  await Promise.all(pools.map(p=>p.end()))
  await monitoring.shutdown()
 }
}
if(process.argv[1]){
 const {fileURLToPath}=await import('node:url'),path=await import('node:path')
 if(path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==3||!['readiness','controller-standby'].includes(process.argv[2]))unavailable('READINESS_MODE_REQUIRED');await readinessMain(process.argv[2]==='controller-standby')}
  catch(error){console.error(JSON.stringify({event:'aqc.technical.failure',code:/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'READINESS_UNAVAILABLE'}));process.exitCode=1}
 }
}
