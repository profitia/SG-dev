/** Metadata-only publisher qualification. No release, CAS mutation, signing,
 * context, QA, cost, Render credential or controller activation is exposed. */
import {createQualityPublisherBindings} from './publisher.mjs'
import {readFileSync,realpathSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const fail=code=>{throw Object.assign(Error('Publisher readiness unavailable'),{code})}
const require=(v,code='PUBLISHER_PREFLIGHT_CONFIGURATION_INVALID')=>{if(!v)fail(code)}
const expiry=Date.parse('2026-11-27T23:59:59.000Z')
const profiles=Object.freeze({
 canonical:Object.freeze({role:'aqc_development_canonical_publisher',database:'platform_private',owner:'profitia_access_owner',
  hosts:Object.freeze(['ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech','ep-late-heart-b9mxo8oi-pooler.c-7.eu-central-1.aws.neon.tech'])}),
 product:Object.freeze({role:'aqc_development_product_publisher',database:'neondb',owner:'profitia_ingestion_owner',
  hosts:Object.freeze(['ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech','ep-muddy-pine-b22pdyqd-pooler.c-6.eu-central-1.aws.neon.tech'])}),
})
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
function fields(v,keys,optional=[]){
 require(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.getOwnPropertySymbols(v).length===0)
 const d=Object.getOwnPropertyDescriptors(v)
 require(keys.every(k=>Object.hasOwn(d,k))&&Object.keys(d).every(k=>[...keys,...optional].includes(k))
  &&Object.values(d).every(p=>p.enumerable&&Object.hasOwn(p,'value')))
}
export function readQualityPublisherConnections(options){
 fields(options,['canonicalUrl','productUrl'])
 const result={}
 for(const profile of Object.keys(profiles)){
  const b=profiles[profile]
  let u,password
  try{require(typeof options[profile+'Url']==='string');u=new URL(options[profile+'Url']);password=decodeURIComponent(u.password)}
  catch{fail('PUBLISHER_PREFLIGHT_DATABASE_INVALID')}
  require(['postgres:','postgresql:'].includes(u.protocol)&&b.hosts.includes(u.hostname)
   &&u.username===b.role&&u.pathname==='/'+b.database&&(!u.port||u.port==='5432')&&!u.hash
   &&password.length>=32&&password.length<=4096&&!password.includes('\0')
   &&[...u.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k))
   &&u.searchParams.getAll('sslmode').length===1&&['require','verify-full'].includes(u.searchParams.get('sslmode'))
   &&u.searchParams.getAll('channel_binding').length<=1
   &&(!u.searchParams.has('channel_binding')||u.searchParams.get('channel_binding')==='require'),'PUBLISHER_PREFLIGHT_DATABASE_INVALID')
  result[profile]=Object.freeze({host:u.hostname,port:5432,user:b.role,password,database:b.database,
   ssl:Object.freeze({rejectUnauthorized:true}),...(u.searchParams.get('channel_binding')==='require'?{enableChannelBinding:true}:{})})
 }
 return Object.freeze(result)
}
export function qualityPublisherRoleQuery(profile){
 require(Object.hasOwn(profiles,profile))
 const b=profiles[profile]
 return "SELECT current_database() AS database_name,current_user AS role,session_user AS login,"+
  "r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,r.rolcanlogin,r.rolconnlimit,r.rolvaliduntil,"+
  "(SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships,"+
  "pg_has_role(session_user,'"+b.owner+"','MEMBER') AS owner_member,"+
  "has_schema_privilege(session_user,'profitia_quality_release','USAGE') AS schema_usage,"+
  "has_schema_privilege(session_user,'profitia_quality_release','CREATE') AS schema_create,"+
  "(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_quality_release' AND c.relkind IN('r','p')) AS schema_tables,"+
  "coalesce((SELECT bool_or(has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_quality_release' AND c.relkind IN('r','p')),false) AS direct_table_access,"+
  "(SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_quality_release') AS schema_functions,"+
  "coalesce((SELECT bool_and(p.prosecdef AND p.proowner='"+b.owner+"'::regrole AND p.proconfig=ARRAY['search_path=pg_catalog']"+
  " AND has_function_privilege(session_user,p.oid,'EXECUTE') AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))"+
  " FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_quality_release'),false) AS functions_confined"+
  " FROM pg_roles r WHERE r.rolname=current_user"
}
export function assertQualityPublisherRole(profile,rows,now=Date.now()){
 require(Object.hasOwn(profiles,profile)&&Number.isFinite(now)&&now<expiry,'PUBLISHER_PREFLIGHT_EXPIRED')
 const b=profiles[profile],r=rows?.[0]
 const until=r?.rolvaliduntil instanceof Date?r.rolvaliduntil.getTime():Date.parse(r?.rolvaliduntil)
 require(Array.isArray(rows)&&rows.length===1&&r.database_name===b.database&&r.role===b.role&&r.login===b.role
  &&['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolinherit','rolreplication','owner_member','schema_create','direct_table_access'].every(k=>r[k]===false)
  &&r.rolcanlogin===true&&r.rolconnlimit===2&&r.memberships===0&&Number.isFinite(until)&&until>now&&until<=expiry
  &&r.schema_usage===true&&r.schema_tables===2&&r.schema_functions===2&&r.functions_confined===true,'PUBLISHER_PREFLIGHT_ROLE_INVALID')
}
const statusSql='SELECT profitia_quality_release.quality_deployment_cas_status($1::uuid) AS result'
/** Low-level read adapter for trusted code/tests. Native entrypoint below fixes
 * the actual pg clients and never accepts query/fetch/clock or result ports. */
export function createQualityPublisherReadiness(options){
 fields(options,['canonicalQuery','productQuery'],['now'])
 require(typeof options.canonicalQuery==='function'&&typeof options.productQuery==='function')
 const clock=options.now??Date.now;require(typeof clock==='function')
 const queries={canonical:options.canonicalQuery,product:options.productQuery}
 return Object.freeze({async check(request){
  fields(request,['sourceSha']);const {sourceSha}=request
  require(sha(sourceSha))
  for(const profile of Object.keys(profiles)){
   const r=await queries[profile](qualityPublisherRoleQuery(profile))
   assertQualityPublisherRole(profile,r?.rows,clock())
  }
  const query=profile=>async(sql,args)=>{
   require(sql===statusSql&&Array.isArray(args)&&args.length===1&&args[0]===null,'PUBLISHER_PREFLIGHT_QUERY_FORBIDDEN')
   const r=await queries[profile](sql,args)
   require(r?.rows?.length===1&&r.rows[0]?.result?.publishingEnabled===false,'PUBLISHER_PREFLIGHT_PROMOTION_ENABLED')
   return r
  }
  const bindings=createQualityPublisherBindings({canonicalQuery:query('canonical'),productQuery:query('product'),promotionEnabled:false,now:clock})
  const checked=await bindings.check({sourceSha})
  require(checked.bindingsFresh===true,'PUBLISHER_PREFLIGHT_BINDINGS_STALE')
  return Object.freeze({schemaVersion:'AQC_PUBLISHER_PREFLIGHT_V1',status:'PUBLISHER_CONNECTED_DISABLED',hostSourceSha:sourceSha,
   profilesVerified:2,bindingsVerified:6,publishingEnabled:false,recoveryEnabled:checked.recoveryEnabled,updatedBindings:0,
   rawQaReadPerformed:false,permissionMutationPerformed:false})
 }})
}
export function readQualityPublisherPreflightEnvironment(env){
 const e={...env}
 require(e.GITHUB_ACTIONS==='true'&&e.RUNNER_ENVIRONMENT==='github-hosted'&&e.RUNNER_OS==='Linux'
  &&e.GITHUB_EVENT_NAME==='workflow_dispatch'&&e.GITHUB_REPOSITORY==='profitia/SG-dev'&&e.GITHUB_REF==='refs/heads/main'
  &&e.GITHUB_ACTOR==='profitia'&&e.GITHUB_TRIGGERING_ACTOR==='profitia'&&e.GITHUB_RUN_ATTEMPT==='1'
  &&e.GITHUB_WORKFLOW_REF==='profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main'
  &&typeof e.GITHUB_RUN_ID==='string'&&/^[1-9][0-9]{0,19}$/.test(e.GITHUB_RUN_ID)&&sha(e.GITHUB_SHA)
  &&e.TARGET_ENVIRONMENT==='development'&&e.AQC_PAID_REPAIRS_ENABLED==='false'&&e.AQC_PROMOTION_ENABLED==='false'
  &&uuid(e.AQC_NONCE)&&sha(e.AQC_HOST_SOURCE_SHA),'PUBLISHER_PREFLIGHT_NATIVE_INVOCATION_REQUIRED')
 require(!['OPENAI_API_KEY','RENDER_API_KEY','AQC_RENDER_PUBLISHER_API_KEY','DATABASE_URL',
  'AQC_OWNER_PRIVATE_KEY','AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY','AQC_QA_STORAGE_KEY','AQC_QA_PURPOSE_COMMAND_KEY',
  'AQC_QA_EVIDENCE_COMMAND_KEY','AQC_LIMITS_BROKER_COMMAND_KEY','AQC_CONTROL_COMMAND_KEY'].some(k=>e[k]),'PUBLISHER_PREFLIGHT_SECRET_SCOPE_REJECTED')
 const connections=readQualityPublisherConnections({canonicalUrl:e.AQC_PUBLISHER_CANONICAL_DATABASE_URL,productUrl:e.AQC_PUBLISHER_PRODUCT_DATABASE_URL})
 return Object.freeze({connections,sourceSha:e.GITHUB_SHA,hostSourceSha:e.AQC_HOST_SOURCE_SHA,runId:e.GITHUB_RUN_ID,nonce:e.AQC_NONCE})
}
/** Read-only native main job. Metadata is not a signed publication proof, a
 * controller result, a repair, or authority to enable any deployment policy. */
export async function runQualityNativePublisherPreflight(){
 require(arguments.length===0,'PUBLISHER_PREFLIGHT_INPUTS_FORBIDDEN')
 const config=readQualityPublisherPreflightEnvironment(process.env)
 const root=realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
 let event,head,remote,dirty
 try{
  require(typeof process.env.GITHUB_EVENT_PATH==='string'&&typeof process.env.GITHUB_WORKSPACE==='string')
  require(realpathSync(process.env.GITHUB_WORKSPACE)===root)
  event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'))
  const git=args=>execFileSync('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',root,...args],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim()
  head=git(['rev-parse','HEAD']);remote=git(['config','--get','remote.origin.url']);dirty=git(['status','--porcelain','--untracked-files=no'])
 }catch{fail('PUBLISHER_PREFLIGHT_CHECKOUT_INVALID')}
 require(head===config.sourceSha&&dirty===''&&['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(remote)
  &&event?.repository?.full_name==='profitia/SG-dev'&&event?.sender?.login==='profitia'
  &&event?.inputs?.mode==='publisher-preflight'&&event.inputs.nonce===config.nonce&&event.inputs.base_sha===config.hostSourceSha,
  'PUBLISHER_PREFLIGHT_CHECKOUT_INVALID')
 const {default:pg}=await import('pg')
 const pools=[],clients=[]
 let poolFailed=false
 try{
  for(const profile of Object.keys(profiles)){
   const p=new pg.Pool({...config.connections[profile],max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,
    statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true})
   p.on('error',()=>{poolFailed=true});pools.push(p)
   const client=await p.connect();clients.push(client);await client.query('BEGIN READ ONLY')
  }
  const query=i=>(sql,args)=>{require(!poolFailed,'PUBLISHER_PREFLIGHT_CONNECTION_UNAVAILABLE');return clients[i].query(sql,args)}
  const readiness=createQualityPublisherReadiness({canonicalQuery:query(0),productQuery:query(1)})
  const result=await readiness.check({sourceSha:config.hostSourceSha})
  return Object.freeze({...result,sourceSha:config.sourceSha,runId:config.runId,nonce:config.nonce,
   observedAt:new Date().toISOString(),nativeOperationalInvocationVerified:false,paidRepairsEnabled:false,promotionEnabled:false})
 }catch(error){
  if(/^PUBLISHER_(?:PREFLIGHT|BINDING)_[A-Z_]+$/.test(error?.code??''))throw error
  fail('PUBLISHER_PREFLIGHT_CONNECTION_UNAVAILABLE')
 }finally{
  for(const c of clients){try{await c.query('ROLLBACK')}catch{}c.release()}
  await Promise.all(pools.map(p=>p.end()))
 }
}
