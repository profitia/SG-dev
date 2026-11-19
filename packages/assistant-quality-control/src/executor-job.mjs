import {createPublicKey,randomBytes,createHash} from 'node:crypto'
import {readFileSync,realpathSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {documentDigest,publicKeyId} from './manifest.mjs'
import {normalizeQualityControllerJobInputs} from './job-context.mjs'
import {readQualityControllerJobContext,createQualityExecutorJobBudget} from './cli.mjs'
import {createQualityGitHub} from './github.mjs'
import {assertQualityNativeJobState} from './job-state.mjs'
import {createPublicProjection} from './provenance.mjs'
import {assertExecutorHost,verifyLinuxQualification,runIsolatedExecutor,createQualityExecutorPhaseAttestor} from './executor.mjs'
import {createQualityBudget} from './budget.mjs'
import {createCostBroker} from './openai-broker.mjs'

const fail=code=>{throw Object.assign(Error('Native quality executor unavailable'),{code})}
const require=(v,code='NATIVE_EXECUTOR_INPUT_INVALID')=>{if(!v)fail(code)}
function fields(value,required,optional=[]){
 require(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.getOwnPropertySymbols(value).length===0)
 const descriptors=Object.getOwnPropertyDescriptors(value)
 require(required.every(k=>Object.hasOwn(descriptors,k))
  &&Object.keys(descriptors).every(k=>[...required,...optional].includes(k))
  &&Object.values(descriptors).every(d=>d.enumerable&&Object.hasOwn(d,'value')))
}
/** Ordinary broker connection only. Returned credentials belong to the trusted
 * supervisor, never to workflow inputs, the isolated agent or a public result. */
export function readQualityExecutorLimitsConfiguration(options){
 fields(options,['databaseUrl','commandKey','serviceId'])
 require(typeof options.commandKey==='string'&&/^[a-f0-9]{64}$/.test(options.commandKey)
  &&typeof options.serviceId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(options.serviceId),
  'NATIVE_EXECUTOR_LIMITS_BINDING_INVALID')
 let u
 try{require(typeof options.databaseUrl==='string');u=new URL(options.databaseUrl)}catch{fail('NATIVE_EXECUTOR_LIMITS_BINDING_INVALID')}
 require(['postgres:','postgresql:'].includes(u.protocol)
  &&['ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech','ep-muddy-surf-b9vpyy2d-pooler.c-7.eu-central-1.aws.neon.tech'].includes(u.hostname)
  &&(!u.port||u.port==='5432')&&u.username==='profitia_limits_quality_broker'&&u.password&&u.pathname==='/neondb'&&!u.hash
  &&[...u.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k))
  &&u.searchParams.getAll('sslmode').length===1&&u.searchParams.get('sslmode')==='require'
  &&u.searchParams.getAll('channel_binding').length<=1
  &&(!u.searchParams.has('channel_binding')||u.searchParams.get('channel_binding')==='require'),'NATIVE_EXECUTOR_LIMITS_BINDING_INVALID')
 let password
 try{password=decodeURIComponent(u.password)}catch{fail('NATIVE_EXECUTOR_LIMITS_BINDING_INVALID')}
 return Object.freeze({commandKey:options.commandKey,serviceId:options.serviceId,connection:Object.freeze({
  host:u.hostname,port:5432,user:'profitia_limits_quality_broker',password,database:'neondb',
  ssl:Object.freeze({rejectUnauthorized:true}),...(u.searchParams.get('channel_binding')==='require'?{enableChannelBinding:true}:{})})})
}
/** Read-only interpretation of the native STATUS result. The original SQL
 * starts its14-day clock at the first durable DISPATCH, so an enabled but
 * unstarted installation must not be mistaken for a disabled or expired one.
 * This helper issues no command and returns no execution capability. */
export function readQualityExecutorPilotWindow(status){
 const at=Date.now()
 require(status&&Object.getPrototypeOf(status)===Object.prototype&&status.status==='ENABLED'
  &&status.maximumNanoUsd==='50000000000','NATIVE_EXECUTOR_PILOT_UNAVAILABLE')
 if(status.pilotStartedAt===null){
  require(status.pilotExpiresAt===null,'NATIVE_EXECUTOR_PILOT_UNAVAILABLE')
  return Object.freeze({started:false,pilotStartedAt:null,pilotExpiresAt:null})
 }
 const start=Date.parse(status.pilotStartedAt),end=Date.parse(status.pilotExpiresAt)
 require(typeof status.pilotStartedAt==='string'&&typeof status.pilotExpiresAt==='string'
  &&Number.isFinite(start)&&Number.isFinite(end)&&start<=at&&end>at&&end>start&&end-start<=14*86400000,
  'NATIVE_EXECUTOR_PILOT_UNAVAILABLE')
 return Object.freeze({started:true,pilotStartedAt:status.pilotStartedAt,pilotExpiresAt:status.pilotExpiresAt})
}
/** Closed native EXECUTE composition. No caller network/SQL/agent callback,
 * tool command, clock, environment, holdout or result can replace its ports.
 * This is never invoked by readiness or standby. It cannot enable Limits,
 * mint a permit, enable promotion, issue a grant or create an API credential.
 * Only the existing native DISPATCH starts the approved clock on first use. */
export async function runQualityNativeExecutorJob(options){
 const common=['inputs','token','controllerWorkflowSha256','registry','ownerKeys','verifierKeys','keysByRole',
  'expectedServiceId','expectedGateSetSha256','repositoryRoot','qualification','qualificationKeys','privateKey',
  'limitsDatabaseUrl','limitsCommandKey','limitsServiceId','openaiKey']
 fields(options,common,['signal'])
 const o=Object.freeze({...options}),inputs=normalizeQualityControllerJobInputs(o.inputs)
 require(inputs.action==='EXECUTE','NATIVE_EXECUTOR_ACTION_FORBIDDEN')
 require(Object.hasOwn(inputs,'state'),'NATIVE_EXECUTOR_STATE_REQUIRED')
 require(o.signal===undefined||o.signal instanceof AbortSignal)
 require(o.privateKey?.type==='private'&&o.privateKey.asymmetricKeyType==='ed25519','NATIVE_EXECUTOR_SIGNER_REQUIRED')
 require(o.keysByRole instanceof Map&&o.ownerKeys instanceof Map&&o.verifierKeys instanceof Map
  &&o.qualificationKeys instanceof Map,'NATIVE_EXECUTOR_TRUST_REQUIRED')
 const own=o.keysByRole.get('EXECUTOR_SUPERVISOR'),ownId=publicKeyId(createPublicKey(o.privateKey))
 require(own instanceof Map&&own.has(ownId)&&!o.ownerKeys.has(ownId),'NATIVE_EXECUTOR_TRUST_REQUIRED')
 require(o.keysByRole.size===3,'NATIVE_EXECUTOR_TRUST_REQUIRED')
 const used=new Set()
 for(const role of ['INDEPENDENT_VERIFIER','EXECUTOR_SUPERVISOR','INDEPENDENT_PUBLISHER']){
  const keys=o.keysByRole.get(role)
  require(keys instanceof Map&&keys.size>0&&keys.size<=4,'NATIVE_EXECUTOR_TRUST_REQUIRED')
  for(const[id,key]of keys){
   require(!used.has(id)&&!o.ownerKeys.has(id),'NATIVE_EXECUTOR_SEPARATE_TRUST_REQUIRED')
   require(key?.type==='public'&&key.asymmetricKeyType==='ed25519'&&publicKeyId(key)===id,'NATIVE_EXECUTOR_TRUST_REQUIRED')
   used.add(id)
  }
 }
 // Snapshot role trust and registry before the first asynchronous operation.
 const ownerKeys=new Map(o.ownerKeys),verifierKeys=new Map(o.verifierKeys)
 const keysByRole=new Map([...o.keysByRole].map(([role,keys])=>[role,new Map(keys)])),qualificationKeys=new Map(o.qualificationKeys)
 documentDigest(o.registry)
 const registry=typeof o.registry==='string'?o.registry:JSON.stringify(o.registry)
 // An environment flag alone cannot authorise spending: the native ordinary
 // role must also find enabled native Limits and the original live permit.
 // These checks never execute ENABLE, HOLD_INCIDENT or OPEN_ATTEMPT.
 require(process.env.AQC_PAID_REPAIRS_ENABLED==='true'&&process.env.AQC_PROMOTION_ENABLED==='false',
  'NATIVE_EXECUTOR_NOT_ACTIVATED')
 const host=assertExecutorHost()
 require(host.executorSourceSha===inputs.control_source_sha,'NATIVE_EXECUTOR_SOURCE_MISMATCH')
 const moduleRoot=realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
 let actualRoot,head,remote,dirty
 try{
  actualRoot=realpathSync(o.repositoryRoot)
  const git=args=>execFileSync('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',actualRoot,...args],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim()
  head=git(['rev-parse','HEAD']);remote=git(['config','--get','remote.origin.url']);dirty=git(['status','--porcelain','--untracked-files=no'])
 }catch{fail('NATIVE_EXECUTOR_CHECKOUT_INVALID')}
 require(actualRoot===moduleRoot&&head===host.executorSourceSha&&dirty===''
  &&['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(remote),'NATIVE_EXECUTOR_CHECKOUT_INVALID')
 const {qualificationPolicyDigest}=await import('./acceptance.mjs')
 const observedGateSetSha256=qualificationPolicyDigest(fileURLToPath(new URL('../',import.meta.url)))
 require(observedGateSetSha256===o.expectedGateSetSha256,'NATIVE_EXECUTOR_POLICY_MISMATCH')
 const qualified=verifyLinuxQualification(o.qualification,{keys:qualificationKeys,gateSetSha256:observedGateSetSha256})
 const externalId='aqc-job:'+inputs.control_source_sha+':'+inputs.nonce+':EXECUTE'
 const github=createQualityGitHub({token:o.token,controllerWorkflowSha256:o.controllerWorkflowSha256})
 const nativeInvocation=await github.controllerJobInvocation({externalId,runId:process.env.GITHUB_RUN_ID})
 const context=await readQualityControllerJobContext({inputs,nativeInvocation,registry,ownerKeys,verifierKeys,
  expectedServiceId:o.expectedServiceId,expectedGateSetSha256:o.expectedGateSetSha256,now:Date.now()})
 const {manifest,jobState}=context
 const state=assertQualityNativeJobState(jobState,{manifest,externalId})
 require(state.record.status==='REPRODUCED','NATIVE_EXECUTOR_REPRODUCTION_REQUIRED')
 await github.controllerJobHistory({manifest,jobState,externalId,action:'QUALIFY',keysByRole})
 await github.controllerJobHistory({manifest,jobState,externalId,action:'REPRODUCE',keysByRole})
 const config=readQualityExecutorLimitsConfiguration({databaseUrl:o.limitsDatabaseUrl,commandKey:o.limitsCommandKey,serviceId:o.limitsServiceId})
 require(typeof o.openaiKey==='string'&&o.openaiKey.length>0,'NATIVE_EXECUTOR_MODEL_CREDENTIAL_REQUIRED')
 const toolPath='/opt/aqc-tools/codex'
 try{
  const stat=(await import('node:fs')).lstatSync(toolPath)
  require(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===0&&(stat.mode&0o022)===0
   &&createHash('sha256').update(readFileSync(toolPath)).digest('hex')===qualified.codexBinarySha256,'NATIVE_EXECUTOR_TOOL_REQUIRED')
 }catch{fail('NATIVE_EXECUTOR_TOOL_REQUIRED')}
 const {default:pg}=await import('pg')
 const pool=new pg.Pool({...config.connection,max:1,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,
  statement_timeout:5000,query_timeout:8000,allowExitOnIdle:true})
 let poolFailed=false,broker
 pool.on('error',()=>{poolFailed=true})
 try{
  const schemaDigest=createHash('sha256').update(readFileSync(new URL('../../../apps/package-limits/migrations/005-assistant-quality-usage.sql',import.meta.url))).digest('hex')
  const budget=createQualityBudget({query:(q,v)=>{require(!poolFailed,'NATIVE_EXECUTOR_LIMITS_UNAVAILABLE');return pool.query(q,v)},
   commandKey:config.commandKey,schemaDigest,serviceId:config.serviceId,role:'profitia_limits_quality_broker'})
  readQualityExecutorPilotWindow(await budget.status())
  const boundBudget=createQualityExecutorJobBudget({context,budget})
  // CHECK_PERMIT requires the once-only native CLAIM_EXECUTOR. The existing
  // executor performs that claim and the bound adapter rechecks it before any
  // broker request; no pre-claim check can accidentally block the first run.
  require(!o.signal?.aborted,'NATIVE_EXECUTOR_CANCELLED')
  const projection=createPublicProjection({repositoryRoot:actualRoot,manifest}),agentToken=randomBytes(32).toString('hex')
  broker=createCostBroker({budget:boundBudget,permit:context.permit,bearerToken:agentToken,openaiKey:o.openaiKey})
  const brokerUrl=await broker.listen()
  const value=await runIsolatedExecutor({manifest,regression:context.regression,projection,toolPath,budget:boundBudget,
   permit:context.permit,brokerUrl,agentToken,qualification:o.qualification,qualificationKeys,observedGateSetSha256,
   nonce:inputs.nonce,...(o.signal===undefined?{}:{signal:o.signal})})
  // The attestor accepts only the private capability minted after real process
  // termination, cgroup-empty verification and bounded artifact collection.
  const receipts=await createQualityExecutorPhaseAttestor({privateKey:o.privateKey}).attest({value,manifest,jobState,externalId})
  return Object.freeze({schemaVersion:'AQC_NATIVE_EXECUTOR_OUTPUT_V1',action:'EXECUTE',...receipts,rawQaPayloadIncluded:false})
 }finally{
  // Lost provider acknowledgement never becomes a refund or a STOPPED claim.
  // Durable budget closure belongs to the controller with the real stop proof.
  try{if(broker)await broker.close()}finally{await pool.end()}
 }
}
