// Operator-only proposal. No product runtime import, SQL installation or protected read.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {spawnSync,execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'

export const D1_CASE_IDS=Object.freeze(['H1','H2','H3','H4','C1'])
const contractId='sg2.dev.five-case-denial-read.v1',producer='64d600192c778b6dc13a3d62b4dd81fd3c008870',consumer='5f745256fecf95ce9043a744333515f0d5ee7be1'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,sha=/^[a-f0-9]{64}$/,gitSha=/^[a-f0-9]{40}$/
const fail=()=>{throw Error('D1_CANONICAL_AUDIT_UNAVAILABLE')}
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex')
function authority(a,now){
 if(!exact(a,['schemaVersion','status','authorizationRef','packetSha256','ownerDecisionRef','operationsDecisionRef','producerSourceSha','consumerSourceSha','pmosSourceSha','issuedAt','expiresAt','operatorAuthority','nativeLogReadinessRef'])
  ||a.schemaVersion!=='1.0'||a.status!=='APPROVED'||!uuid.test(a.authorizationRef)||!sha.test(a.packetSha256)
  ||a.producerSourceSha!==producer||a.consumerSourceSha!==consumer||!gitSha.test(a.pmosSourceSha)
  ||![a.ownerDecisionRef,a.operationsDecisionRef,a.nativeLogReadinessRef].every(v=>typeof v==='string'&&/^[A-Za-z0-9._:-]{3,200}$/.test(v))
  ||!Number.isFinite(now())||!Number.isFinite(Date.parse(a.expiresAt))||!Number.isFinite(Date.parse(a.issuedAt))||Date.parse(a.issuedAt)>now()||Date.parse(a.expiresAt)<=now()
  ||Date.parse(a.expiresAt)-Date.parse(a.issuedAt)>1800000||Date.parse(a.expiresAt)-Date.parse(a.issuedAt)<=0
  ||!exact(a.operatorAuthority,['private','source']))fail()
 for(const store of ['private','source']){const o=a.operatorAuthority[store];if(!exact(o,['identity','loginRole','approvalRef'])
  ||typeof o.identity!=='string'||!/^[A-Za-z0-9@._+-]{3,200}$/.test(o.identity)||!/^sg2_d1_(private|source)_install_operator$/.test(o.loginRole)
  ||o.loginRole!==`sg2_d1_${store}_install_operator`||typeof o.approvalRef!=='string'||!/^[A-Za-z0-9._:-]{3,200}$/.test(o.approvalRef))fail()}
 return structuredClone(a)
}
function intent(v){if(!exact(v,['contractId','executionRef','environment','caseIds','maxRows'])||v.contractId!==contractId||!uuid.test(v.executionRef)||v.environment!=='development'||!same(v.caseIds,D1_CASE_IDS)||v.maxRows!==100)fail();return structuredClone(v)}
function invocations(v,complete){
 if(!Array.isArray(v)||v.length>10||(complete&&v.length!==10))fail()
 const seen=new Set();for(let i=0;i<v.length;i++){const n=v[i],store=i%2?'source':'private';if(!exact(n,['caseId','store','invocationRef','rowCount'])||n.caseId!==D1_CASE_IDS[Math.floor(i/2)]||n.store!==store||!uuid.test(n.invocationRef)||seen.has(n.invocationRef)||!Number.isInteger(n.rowCount)||n.rowCount<0||n.rowCount>100)fail();seen.add(n.invocationRef)}
 return structuredClone(v)
}
/** Internal D1 composition port. Production callers use createCanonicalD1Audit below.
 * Tests may supply a real isolated PostgreSQL port; an injected port is not operational proof. */
export function composeD1Audit({port,authorization,now=Date.now,hostConversationId}){
 const a=authority(authorization,now);if(!port||!['register','verifyRegistered','snapshot','closeout','nativeEvidence'].every(k=>typeof port[k]==='function')||!uuid.test(hostConversationId))fail()
 let active,settlement,phase='UNSTARTED'
 const check=()=>authority(a,now)
 const snapshot=async()=>{try{return await port.snapshot(active.taskId)}catch{fail()}}
 const settled=(s,expected)=>s?.registration?.status==='completed'&&s.registration.taskId===active.taskId&&s.registration.conversationId===active.conversationId&&s.registration.project==='SpendGuru 2.0'&&s.registration.workspace==='SG-dev'
  &&s.registration.promptContent===active.originalTaskRequest&&same(s.flightRecord,expected)
 const save=async evidence=>{
  if(settlement&&!same(settlement,evidence))fail();settlement=structuredClone(evidence)
  const record={metadata:{conversationId:active.conversationId,hostConversationId,project:'SpendGuru 2.0',workspace:'SG-dev',taskId:active.taskId,scope:'audit',targetEnvironment:'development',executionEnvironment:'local'},task:{originalTaskRequest:active.originalTaskRequest},analysis:{executionSummary:'Bounded D1 technical execution settlement; no source rows retained.',reasoningSummary:JSON.stringify({d1Execution:evidence})},findings:{findings:['Technical counts/hash and native invocation references only.'],blockers:evidence.executionStatus==='SUCCESS'?[]:['D1 output withheld; reconcile before retry.'],residualRisks:['WINDOW_ONLY is not HTTP causality; firstCheckpoint remains NOT_RECORDED.']},decisions:{decisions:['No arbitrary cases or partial output. No implicit retry of uncertain read.']},actions:{recommendations:['Verify expiry, effective ACL and dedicated sessions; close installation task separately.'],validationsExecuted:['Durable intent readback; fixed five-case invocation boundary.'],validationsNotExecuted:['No business result or raw protected record persisted to PMOS.'],artifactsCreated:[],artifactsModified:[]},result:{finalStatus:evidence.executionStatus==='SUCCESS'?'SUCCESS':'PARTIAL_SUCCESS'}}
  // Reconcile first. Never overwrite an immutable success/failure or resubmit ambiguous closeout.
  const before=await snapshot();if(before.flightRecord){if(!settled(before,record))fail();return before}
  try{await port.closeout(record)}catch{}
  const after=await snapshot();if(!settled(after,record))fail();phase='SETTLED';return after
 }
 return Object.freeze({
  async begin(value){
   check();if(phase!=='UNSTARTED')fail();const v=intent(value);phase='INTENT_PENDING'
   const taskId='SG2-D1-READ-'+v.executionRef,conversationId='pmos-task-v2:'+hash('profitia-pmos-task-conversation-v2\0SG2\0'+taskId)
   active={taskId,conversationId,startedAt:new Date(now()).toISOString(),intent:v,originalTaskRequest:JSON.stringify({d1ExecutionIntent:{taskId,...v,authorizationRef:a.authorizationRef,packetSha256:a.packetSha256,operatorAuthority:a.operatorAuthority,authorizationSource:port.authorizationSource,executionStatus:'INTENT',startedAt:new Date(now()).toISOString(),completedAt:null,rowCount:null,outputSha256:null,nativeLogReferences:[],auditAcknowledgement:'PENDING_READBACK'}})}
   try{await port.register({...active,hostConversationId})}catch{}
   if(await port.verifyRegistered(active)!==true)fail();const s=await snapshot();if(!s?.registration||s.registration.status!=='running'||s.registration.taskId!==taskId||s.registration.conversationId!==conversationId||s.registration.project!=='SpendGuru 2.0'||s.registration.workspace!=='SG-dev'||s.registration.promptContent!==active.originalTaskRequest||s.flightRecord)fail()
   phase='READ_AUTHORIZED';return{durable:true,authorizationRef:a.authorizationRef,expiresAt:a.expiresAt}
  },
  async complete(value){
   check();if(phase!=='READ_AUTHORIZED')fail()
   if(!exact(value,['contractId','executionRef','environment','caseIds','maxRows','authorizationRef','invocations','rowCount','outputSha256','correlationEvidence'])||!same(intent(Object.fromEntries(['contractId','executionRef','environment','caseIds','maxRows'].map(k=>[k,value[k]]))),active.intent)||value.authorizationRef!==a.authorizationRef||!sha.test(value.outputSha256)||value.correlationEvidence!=='WINDOW_ONLY')fail()
   const calls=invocations(value.invocations,true);if(!Number.isInteger(value.rowCount)||value.rowCount<0||value.rowCount>100||calls.reduce((n,c)=>n+c.rowCount,0)!==value.rowCount)fail()
   const logs=await port.nativeEvidence(calls,{startedAt:active.startedAt,completedAt:new Date(now()).toISOString()})
   if(!Array.isArray(logs)||logs.length!==20)fail()
   for(const call of calls)for(const stage of ['INTENT','OUTCOME']){const matches=logs.filter(n=>exact(n,['store','invocationRef','phase','projectId','branchId','database','evidenceRef'])&&n.store===call.store&&n.invocationRef===call.invocationRef&&n.phase===stage&&n.projectId===(call.store==='private'?'spring-bread-28217539':'autumn-waterfall-65938876')&&n.branchId===(call.store==='private'?'br-sparkling-term-b99l107x':'br-dry-hall-b294222f')&&n.database===(call.store==='private'?'platform_private':'neondb')&&typeof n.evidenceRef==='string'&&/^[a-zA-Z0-9._:-]{3,200}$/.test(n.evidenceRef));if(matches.length!==1)fail()}
   check();const evidence={taskId:active.taskId,executionRef:active.intent.executionRef,authorizationRef:a.authorizationRef,contractId,caseIds:D1_CASE_IDS,operatorAuthority:a.operatorAuthority,executionStatus:'SUCCESS',startedAt:active.startedAt,completedAt:new Date(now()).toISOString(),rowCount:value.rowCount,outputSha256:value.outputSha256,nativeLogReferences:structuredClone(logs),auditAcknowledgement:'CANONICAL_PMOS_CLOSEOUT_AND_DATABASE_READBACK',packetSha256:a.packetSha256}
   const s=await save(evidence);check();return{durable:true,outputSha256:JSON.parse(s.flightRecord.analysis.reasoningSummary).d1Execution.outputSha256}
  },
  async failure(value){
   if(!active||phase==='SETTLED')fail()
   if(!exact(value,['contractId','executionRef','environment','caseIds','maxRows','authorizationRef','invocations','status'])||!same(intent(Object.fromEntries(['contractId','executionRef','environment','caseIds','maxRows'].map(k=>[k,value[k]]))),active.intent)||value.authorizationRef!==a.authorizationRef||!['OVERFLOW','AUDIT_UNAVAILABLE'].includes(value.status))fail()
   const calls=invocations(value.invocations,false)
   return save({taskId:active.taskId,executionRef:active.intent.executionRef,authorizationRef:a.authorizationRef,contractId,caseIds:D1_CASE_IDS,operatorAuthority:a.operatorAuthority,executionStatus:value.status,startedAt:active.startedAt,completedAt:new Date(now()).toISOString(),rowCount:calls.reduce((n,c)=>n+c.rowCount,0),outputSha256:null,nativeLogReferences:calls.map(c=>({store:c.store,invocationRef:c.invocationRef,status:'UNVERIFIED'})),auditAcknowledgement:'CANONICAL_PMOS_FAILURE_SETTLEMENT',packetSha256:a.packetSha256})
  },
 })
}

// Fixed read-only bridge into existing PMOS models. No new table or direct write path.
const READBACK=`const {PrismaClient}=require('@prisma/client');const {assertDatabaseIdentity}=require('./src/lib/pmos/execution-registration');const db=new PrismaClient();(async()=>{try{const r=await db.$queryRawUnsafe('SELECT current_database() AS name');assertDatabaseIdentity(r[0].name,'SG2',process.env.DATABASE_URL);const taskId=process.env.D1_READBACK_TASK,conversationId=process.env.D1_READBACK_CONVERSATION;const reg=await db.promptExecution.findUnique({where:taskId?{taskId}:{conversationId},select:{id:true,taskId:true,conversationId:true,project:true,workspace:true,status:true,promptContent:true}});const doc=await db.conversationArtifact.findUnique({where:{conversationId:conversationId||reg?.conversationId||'absent'},select:{flightRecordJson:true}});console.log(JSON.stringify({registration:reg,flightRecord:doc?.flightRecordJson||null}));}finally{await db.$disconnect()}})().catch(()=>{console.error('D1_READBACK_UNAVAILABLE');process.exitCode=1})`
/** Source-level canonical binding. nativeEvidence must be provided by the separately
 * approved Neon log transport/normalizer; empty query metadata is insufficient.
 * No operational invocation is authorized by the existence of this factory. */
export async function createCanonicalD1Audit({pmosRoot,authorizationConversationId,authorizationPacketSha256,hostConversationId,nativeEvidence,now=Date.now}){
 if(!/^pmos-task-v2:[a-f0-9]{64}$/.test(authorizationConversationId)||!sha.test(authorizationPacketSha256)||typeof nativeEvidence!=='function')fail()
 const root=fs.realpathSync(pmosRoot),app=path.join(root,'apps/pmos')
 const run=(command,args,extra={})=>{const r=spawnSync(command,args,{cwd:app,env:{...process.env,...extra},encoding:'utf8',maxBuffer:16*1024*1024,timeout:300000});if(r.status!==0)fail();return r.stdout}
 const inspect=(taskId,conversationId)=>JSON.parse(run(path.join(app,'node_modules/.bin/dotenv'),['-e','.env.local','--',path.join(app,'node_modules/.bin/tsx'),'-e',READBACK],{D1_READBACK_TASK:taskId||'',D1_READBACK_CONVERSATION:conversationId||''}))
 const approval=inspect(null,authorizationConversationId),document=approval.flightRecord
 if(approval.registration?.status!=='completed'||approval.registration.project!=='SpendGuru 2.0'||approval.registration.conversationId!==authorizationConversationId)fail()
 if(document?.metadata?.project!=='SpendGuru 2.0'||document?.metadata?.targetEnvironment!=='development'||document?.result?.finalStatus!=='SUCCESS')fail()
 let approved;try{approved=JSON.parse(document.analysis.reasoningSummary).d1OperationalAuthorization}catch{fail()}
 const a=authority(approved,now);if(a.packetSha256!==authorizationPacketSha256||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()!==a.pmosSourceSha)fail()
 const {resolveDevelopmentBridge,buildBridgePreflight}=await import(pathToFileURL(root+'/scripts/governance/development-bridge.mjs'))
 const {runGovernancePreflight}=await import(pathToFileURL(root+'/scripts/governance/governance-preflight.mjs'))
 const plan=resolveDevelopmentBridge('SG2',root),targets=['apps/sg-runtime/scripts/denial-audit/d1-reader.mjs','apps/sg-runtime/scripts/denial-audit/adoption.json']
 if(plan.projectKey!=='SG2'||plan.workspace!=='SG-dev')fail()
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'d1-canonical-pmos-'));fs.chmodSync(temp,0o700)
 const input=(name,data)=>{const file=path.join(temp,name+'.json');fs.writeFileSync(file,JSON.stringify(data),{mode:0o600,flag:'wx'});return file}
 const port={authorizationSource:authorizationConversationId,nativeEvidence,snapshot:async taskId=>inspect(taskId,null),
  async verifyRegistered(v){const args=buildBridgePreflight(plan,{taskId:v.taskId,title:'D1 separately authorized five-case evidence read',scope:'audit',targets,hostConversationId,requireBegin:true},root);return runGovernancePreflight(args).verdict==='PASS'},
  async register(v){const args=buildBridgePreflight(plan,{taskId:v.taskId,title:'D1 separately authorized five-case evidence read',scope:'audit',targets,hostConversationId,requireBegin:false},root);const gates=runGovernancePreflight(args);if(gates.verdict!=='PASS')fail();const file=input('begin',{schemaVersion:'2.0',taskId:v.taskId,title:args.title,hostConversationId,project:plan.projectName,workspace:plan.workspace,executionEnvironment:args.execution_environment,targetEnvironment:'development',scope:'audit',originalTaskRequest:v.originalTaskRequest,declaredTargetPaths:targets,gates:Object.fromEntries(Object.entries(gates.gates).map(([k,g])=>[k,g.status]))});run('npm',['run','pmos:begin','--','--input',file]);const after=runGovernancePreflight({...args,requireBegin:true});if(after.verdict!=='PASS')fail()},
  async closeout(record){const file=input('closeout',record);run('npm',['run','pmos:save','--','--bootstrap-input',file])},
 }
 // Input files remain on ambiguous ACK for ordinary canonical recovery. No automatic
 // replay, alternate event ledger, deletion of history or fake durable:true callback.
 return composeD1Audit({port,authorization:a,now,hostConversationId})
}
