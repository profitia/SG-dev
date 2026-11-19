import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,randomUUID,randomBytes,createHash} from 'node:crypto'
import {mkdtempSync,cpSync,copyFileSync,appendFileSync,rmSync,mkdirSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {publicKeyId,SOURCE_PATHS,documentDigest,signDocument,verifyBoundManifest} from '../src/manifest.mjs'
import {spawnSync} from 'node:child_process'
import net from 'node:net'
import pg from 'pg'
import {createQualityBudget,quoteCodeRequest,readCodeUsage} from '../src/budget.mjs'
import {qualificationPolicyDigest} from '../src/acceptance.mjs'
import {runQualityNativeExecutorJob,readQualityExecutorLimitsConfiguration,readQualityExecutorPilotWindow,createQualityExecutorBrokerBudget} from '../src/executor-job.mjs'

const serviceId='b40f45e8-4df0-4377-b80e-2afce4ea3941'
const databaseUrl='postgresql://profitia_limits_quality_broker:test-password@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const configuration=()=>({databaseUrl,commandKey:'a'.repeat(64),serviceId})
function input(action='EXECUTE'){
 const supervisor=generateKeyPairSync('ed25519'),verifier=generateKeyPairSync('ed25519'),publisher=generateKeyPairSync('ed25519')
 const keys=pair=>new Map([[publicKeyId(pair.publicKey),pair.publicKey]])
 return {inputs:{mode:'controller-job',action,nonce:'56bf1afa-8215-4cee-ae89-c0dedc7962aa',
  control_source_sha:'a'.repeat(40),incident_id:'37b9fea1-881a-45e2-ab91-5705cbe1de59',
  manifest_sha256:'b'.repeat(64),base_sha:'c'.repeat(40),state:'{}',
  ...(action==='EXECUTE'?{permit_id:'d9d5e04e-2029-42c7-b0e9-a598fe6e9c1c',permit_expires_at:new Date(Date.now()+60000).toISOString()}: {})},
  token:'inert-unit-reader',controllerWorkflowSha256:'b'.repeat(64),registry:{},ownerKeys:new Map(),
  verifierKeys:keys(verifier),keysByRole:new Map([['INDEPENDENT_VERIFIER',keys(verifier)],
   ['EXECUTOR_SUPERVISOR',keys(supervisor)],['INDEPENDENT_PUBLISHER',keys(publisher)]]),
  expectedServiceId:'srv-fixture',expectedGateSetSha256:'b'.repeat(64),repositoryRoot:'/nonexistent-unit-source',
  qualification:{},qualificationKeys:new Map(),privateKey:supervisor.privateKey,
  limitsDatabaseUrl:databaseUrl,limitsCommandKey:'d'.repeat(64),limitsServiceId:serviceId,openaiKey:'inert-unit-value'}
}
test('native executor admits only the fixed ordinary Limits broker connection with strict TLS',()=>{
 const c=readQualityExecutorLimitsConfiguration(configuration())
 assert.equal(c.connection.user,'profitia_limits_quality_broker');assert.equal(c.connection.database,'neondb')
 assert.equal(c.connection.ssl.rejectUnauthorized,true);assert.equal(Object.isFrozen(c.connection.ssl),true)
 const pooled=readQualityExecutorLimitsConfiguration({...configuration(),databaseUrl:databaseUrl.replace('.c-7.','-pooler.c-7.')+'&channel_binding=require'})
 assert.equal(pooled.connection.enableChannelBinding,true);assert.equal(pooled.connection.ssl.rejectUnauthorized,true)
})
test('executor Limits binding refuses foreign role database endpoint TLS override query and credential getters',()=>{
 for(const value of [databaseUrl.replace('quality_broker','quality_controller'),databaseUrl.replace('/neondb?','/platform_private?'),
  databaseUrl.replace('ep-muddy-surf-b9vpyy2d','ep-foreign'),databaseUrl.replace('sslmode=require','sslmode=disable'),
  databaseUrl+'&sslmode=require',databaseUrl+'&options=-csearch_path=public',databaseUrl+'&ssl=false',
  databaseUrl+'#fragment',databaseUrl.replace('test-password','%FF')])
  assert.throws(()=>readQualityExecutorLimitsConfiguration({...configuration(),databaseUrl:value}),{code:'NATIVE_EXECUTOR_LIMITS_BINDING_INVALID'})
 for(const extra of [{query:()=>{}},{ssl:{rejectUnauthorized:false}},{now:()=>0}])
  assert.throws(()=>readQualityExecutorLimitsConfiguration({...configuration(),...extra}),{code:'NATIVE_EXECUTOR_INPUT_INVALID'})
 let called=0;const c=configuration();Object.defineProperty(c,'databaseUrl',{enumerable:true,get(){called++;throw Error('never read')}})
 assert.throws(()=>readQualityExecutorLimitsConfiguration(c),{code:'NATIVE_EXECUTOR_INPUT_INVALID'});assert.equal(called,0)
})
test('enabled native Limits may remain unstarted until its original first DISPATCH clock rule',()=>{
 const value={status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null}
 const result=readQualityExecutorPilotWindow(value);assert.equal(result.started,false);assert.equal(Object.isFrozen(result),true)
 assert.deepEqual(value,{status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null})
 const started={...value,pilotStartedAt:new Date(Date.now()-60000).toISOString(),pilotExpiresAt:new Date(Date.now()+60000).toISOString()}
 assert.equal(readQualityExecutorPilotWindow(started).started,true)
})
test('disabled partial future expired overlong or increased native pilot status never permits execution',()=>{
 const base={status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null}
 for(const change of [{status:'DISABLED'},{maximumNanoUsd:'50000000001'},{pilotExpiresAt:new Date(Date.now()+60000).toISOString()},
  {pilotStartedAt:new Date(Date.now()+60000).toISOString(),pilotExpiresAt:new Date(Date.now()+120000).toISOString()},
  {pilotStartedAt:new Date(Date.now()-120000).toISOString(),pilotExpiresAt:new Date(Date.now()-60000).toISOString()},
  {pilotStartedAt:new Date(Date.now()-60000).toISOString(),pilotExpiresAt:new Date(Date.now()+15*86400000).toISOString()}])
  assert.throws(()=>readQualityExecutorPilotWindow({...base,...change}),{code:'NATIVE_EXECUTOR_PILOT_UNAVAILABLE'})
})
test('executor cannot accept caller network SQL tool result clock environment or holdout ports',async()=>{
 for(const action of ['QUALIFY','REPRODUCE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'])
  await assert.rejects(runQualityNativeExecutorJob(input(action)),{code:'NATIVE_EXECUTOR_ACTION_FORBIDDEN'})
 for(const extra of [{fetchImpl:()=>{}},{query:()=>{}},{budget:{}},{runCase:()=>{}},{toolPath:'/tmp/untrusted'},
  {result:{result:'PATCH'}},{environment:{AQC_PAID_REPAIRS_ENABLED:'true'}},{now:()=>0},{pack:[]},{publisherEnabled:true}])
  await assert.rejects(runQualityNativeExecutorJob({...input(),...extra}),{code:'NATIVE_EXECUTOR_INPUT_INVALID'})
})
test('executor rejects missing native state accessors or shared role signing keys before provider work',async()=>{
 let called=0;const o=input();Object.defineProperty(o,'token',{enumerable:true,get(){called++;throw Error('never read')}})
 await assert.rejects(runQualityNativeExecutorJob(o),{code:'NATIVE_EXECUTOR_INPUT_INVALID'});assert.equal(called,0)
 const missing=input();delete missing.inputs.state
 await assert.rejects(runQualityNativeExecutorJob(missing),{code:'NATIVE_EXECUTOR_STATE_REQUIRED'})
 const shared=input();shared.keysByRole.set('INDEPENDENT_PUBLISHER',shared.keysByRole.get('INDEPENDENT_VERIFIER'))
 await assert.rejects(runQualityNativeExecutorJob(shared),{code:'NATIVE_EXECUTOR_SEPARATE_TRUST_REQUIRED'})
 const owner=input();const own=owner.keysByRole.get('EXECUTOR_SUPERVISOR');owner.ownerKeys=new Map(own)
 await assert.rejects(runQualityNativeExecutorJob(owner),{code:'NATIVE_EXECUTOR_TRUST_REQUIRED'})
 const wrong=input();wrong.privateKey=generateKeyPairSync('ed25519').privateKey
 await assert.rejects(runQualityNativeExecutorJob(wrong),{code:'NATIVE_EXECUTOR_TRUST_REQUIRED'})
})
test('standby paid-off boundary refuses EXECUTE before any database model or native provider read',async()=>{
 const before=[process.env.AQC_PAID_REPAIRS_ENABLED,process.env.AQC_PROMOTION_ENABLED]
 try{
  process.env.AQC_PAID_REPAIRS_ENABLED='false';process.env.AQC_PROMOTION_ENABLED='false'
  await assert.rejects(runQualityNativeExecutorJob(input()),{code:'NATIVE_EXECUTOR_NOT_ACTIVATED'})
  process.env.AQC_PAID_REPAIRS_ENABLED='true';process.env.AQC_PROMOTION_ENABLED='true'
  await assert.rejects(runQualityNativeExecutorJob(input()),{code:'NATIVE_EXECUTOR_NOT_ACTIVATED'})
  process.env.AQC_PROMOTION_ENABLED='false'
  await assert.rejects(runQualityNativeExecutorJob(input()),error=>
   ['LINUX_ROOT_REQUIRED','TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED','NATIVE_EXECUTOR_SOURCE_MISMATCH'].includes(error?.code))
 }finally{
  for(const [i,key]of ['AQC_PAID_REPAIRS_ENABLED','AQC_PROMOTION_ENABLED'].entries())
   if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i]
 }
})
test('Linux qualification digest also authenticates the complete native executor job source',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(path.join(tmpdir(),'aqc-native-executor-policy-'))
 try{
  cpSync(path.join(root,'src'),path.join(temporary,'src'),{recursive:true})
  for(const file of ['package.json','package-lock.json'])copyFileSync(path.join(root,file),path.join(temporary,file))
  const before=qualificationPolicyDigest(temporary)
  assert.equal(before,qualificationPolicyDigest(root))
  appendFileSync(path.join(temporary,'src/executor-job.mjs'),'\nUNREVIEWED_NATIVE_EXECUTOR_CHANGE')
  assert.notEqual(qualificationPolicyDigest(temporary),before)
 }finally{rmSync(temporary,{recursive:true,force:true})}
})

function brokerFixtureContext({incidentId=randomUUID(),permitId=randomUUID(),attemptId=randomUUID(),expiresAt=new Date(Date.now()+60000).toISOString()}={}){
 const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519'),at=Date.now()
 const hash='b'.repeat(64),sha='c'.repeat(40),stamp=n=>new Date(n).toISOString()
 const body={id:randomUUID(),version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',
  issuedAt:stamp(at-1000),expiresAt:stamp(at+3600000),projectKey:'SG2',repository:'profitia/SG-dev',
  targetServiceId:'srv-fixture',classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256:hash,
  controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,
  maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,
  minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey),exportId=randomUUID()
 const value={schemaVersion:'REPAIR_MANIFEST_V1',incidentId,repairClass:'C1',projectKey:'SG2',repository:'profitia/SG-dev',
  baseSha:sha,allowedPaths:[SOURCE_PATHS.C1,`apps/sg-runtime/tests/assistant-quality-regressions/${incidentId}.test.ts`],
  mandate:{id:body.id,version:body.version,sha256:documentDigest(body),issuedAt:body.issuedAt,expiresAt:body.expiresAt,
   attestation:mandate.attestation},gateSetSha256:hash,
  synthetic:{fixtureId:'qa_synthetic_'+hash,sha256:hash,exportReceiptId:exportId},
  limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId:randomUUID()}
 const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:exportId,fixtureId:value.synthetic.fixtureId,sha256:hash,
  scope:'CONTROLLED_ACCEPTANCE',incidentId,repairClass:'C1',issuedAt:body.issuedAt,expiresAt:body.expiresAt,
  rawQaPayloadIncluded:false},reviewer.privateKey)
 const keys=pair=>new Map([[publicKeyId(pair.publicKey),pair.publicKey]])
 const manifest=verifyBoundManifest(value,{mandate,fixtureExport,ownerKeys:keys(owner),verifierKeys:keys(reviewer),
  now:at,expectedBaseSha:sha,expectedServiceId:'srv-fixture',expectedGateSetSha256:hash})
 return {manifest,externalId:'aqc-job:'+sha+':'+attemptId+':EXECUTE',
  permit:Object.freeze({incidentId,attemptId,permitId,expiresAt})}
}
function brokerFixtureCommand(command,args){
 const result=spawnSync(command,args,{encoding:'utf8',timeout:60000})
 if(result.error||result.status!==0)throw Error('Isolated broker PostgreSQL fixture command failed')
 return result.stdout.trim()
}
async function brokerDatabaseFixture(){
 // This harness creates its own loopback cluster and admits no external URL,
 // connection, credentials or existing database. Only its synthetic row may be enabled.
 const bin=process.env.AQC_TEST_POSTGRES_BIN??brokerFixtureCommand('pg_config',['--bindir'])
 assert(path.isAbsolute(bin)&&path.resolve(bin)===bin)
 const root=mkdtempSync(path.join(tmpdir(),'aqc-executor-broker-contract-'))
 const data=path.join(root,'data'),socket=path.join(root,'socket');mkdirSync(socket)
 const probe=net.createServer()
 await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve))
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 const pools=[],connections=new Set();let started=false
 const close=async()=>{
  await Promise.all(pools.map(p=>p.end()))
  await Promise.all([...connections].map(s=>s.closed?undefined:new Promise(resolve=>s.once('close',resolve))))
  if(started){brokerFixtureCommand(path.join(bin,'pg_ctl'),['-D',data,'-w','stop','-m','fast']);started=false}
  rmSync(root,{recursive:true,force:true})
 }
 try{
  brokerFixtureCommand(path.join(bin,'initdb'),['-D',data,'-U','aqc_fixture_owner',
   '--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale'])
  brokerFixtureCommand(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(root,'server.log'),
   '-o',`-h 127.0.0.1 -p ${port} -k ${socket}`,'-w','start']);started=true
  const pool=(user,database)=>{
   const p=new pg.Pool({host:'127.0.0.1',port,user,database,max:1})
   p.on('connect',c=>{const s=c.connection.stream;connections.add(s);s.once('close',()=>connections.delete(s))})
   pools.push(p);return p
  }
  const bootstrap=pool('aqc_fixture_owner','postgres');await bootstrap.query('CREATE DATABASE neondb')
  const admin=pool('aqc_fixture_owner','neondb')
  await admin.query('CREATE EXTENSION pgcrypto;CREATE ROLE profitia_limits_owner NOLOGIN NOINHERIT')
  for(const name of ['controller','broker','capture'])await admin.query('CREATE ROLE profitia_limits_quality_'+name+
   " LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION CONNECTION LIMIT 3 VALID UNTIL '2026-11-27T23:59:59Z'")
  await admin.query('CREATE SCHEMA profitia_limits AUTHORIZATION profitia_limits_owner;SET ROLE profitia_limits_owner;SET search_path=profitia_limits,pg_catalog')
  // Minimal synthetic pre-existing installation/product tables: the complete
  // original quality migration and its own role/HMAC/spend rules run unchanged.
  await admin.query(`CREATE TABLE installation(singleton boolean,environment text,project_id text,branch_id text,database_name text);
   INSERT INTO installation VALUES(true,'development','lingering-thunder-05075810','br-green-hall-b9s837k0','neondb');
   CREATE TABLE assistant_executions(execution_id uuid PRIMARY KEY,actor_id uuid,organisation_id uuid,policy_id uuid,
    policy_version bigint,assignment_id uuid,assignment_revision bigint,status text,dispatch_before timestamptz,
    reserved_nano_usd bigint,input_digest text,input_bound integer,output_bound integer,usage jsonb);
   CREATE TABLE assistant_policy(singleton boolean,actor_id uuid,organisation_id uuid,policy_id uuid,version bigint,
    assignment_id uuid,assignment_revision bigint,enabled boolean)`)
  const baseline=readFileSync(new URL('../../../apps/package-limits/migrations/001-limits.sql',import.meta.url),'utf8')
  const immutable=baseline.match(/CREATE FUNCTION immutable_history\(\)[\s\S]*?END \$fn\$;/)?.[0]
  assert(immutable);await admin.query(immutable)
  const migration=readFileSync(new URL('../../../apps/package-limits/migrations/005-assistant-quality-usage.sql',import.meta.url),'utf8')
  const schemaDigest=createHash('sha256').update(migration).digest('hex')
  await admin.query(migration.replaceAll('__QUALITY_USAGE_SCHEMA_DIGEST__',schemaDigest))
  await admin.query(`INSERT INTO quality_installation(singleton,schema_digest,service_id,gate_set_sha256,authorised_until,
    test_account_id,test_organisation_id,source_ref) VALUES(true,$1,$2,$3,clock_timestamp()+interval '1 hour',$4,$5,'loopback-only-broker-contract')`,
   [schemaDigest,serviceId,'b'.repeat(64),randomUUID(),randomUUID()])
  const commandKeys={}
  for(const name of ['controller','broker','capture']){
   commandKeys[name]=randomBytes(32).toString('hex')
   await admin.query("INSERT INTO quality_credentials VALUES($1,$2,decode($3,'hex'))",
    ['profitia_limits_quality_'+name,serviceId,commandKeys[name]])
  }
  await admin.query('RESET ROLE')
  const actions=[],controllerPool=pool('profitia_limits_quality_controller','neondb'),brokerPool=pool('profitia_limits_quality_broker','neondb')
  const query=(role,p)=>async(sql,args)=>{actions.push({role,action:JSON.parse(args[0]).action});return p.query(sql,args)}
  const controller=createQualityBudget({query:query('controller',controllerPool),commandKey:commandKeys.controller,
   schemaDigest,serviceId,role:'profitia_limits_quality_controller'})
  const brokerOptions={query:query('broker',brokerPool),commandKey:commandKeys.broker,schemaDigest,serviceId}
  return {admin,controller,brokerOptions,actions,close}
 }catch(error){await close();throw error}
}
test('original SQL refuses broker STATUS and disabled CLAIM without expanding executor capability',async()=>{
 const f=await brokerDatabaseFixture()
 try{
  const status=await f.controller.status();assert.equal(status.status,'DISABLED');assert.equal(status.pilotStartedAt,null)
  const raw=createQualityBudget({...f.brokerOptions,role:'profitia_limits_quality_broker'})
  await assert.rejects(raw.status(),{code:'POLICY_UNAVAILABLE'})
  const context=brokerFixtureContext(),options={...f.brokerOptions,context}
  const budget=createQualityExecutorBrokerBudget(options)
  assert.deepEqual(Object.keys(budget),['claimExecutor','assertPermit','reserveRequest','dispatchRequest','settleRequest','markUnknown','releaseUndispatched'])
  assert(Object.isFrozen(budget));assert.equal(budget.status,undefined);assert.equal(budget.ensureIncident,undefined)
  for(const extra of [{now:()=>0},{role:'profitia_limits_quality_controller'}])
   assert.throws(()=>createQualityExecutorBrokerBudget({...options,...extra}),{code:'NATIVE_EXECUTOR_INPUT_INVALID'})
  await assert.rejects(budget.claimExecutor(context.permit,{runId:'12345',runAttempt:1,
   executorSourceSha:'c'.repeat(40),gateSetSha256:'b'.repeat(64),nonce:context.permit.attemptId}),{code:'LIMIT_EXCEEDED'})
  assert.equal((await f.controller.status()).pilotStartedAt,null)
 }finally{await f.close()}
})
test('ordinary broker completes native once-only CLAIM and original DISPATCH clock without STATUS or a provider',async()=>{
 const f=await brokerDatabaseFixture()
 try{
  await f.admin.query('UPDATE profitia_limits.quality_installation SET enabled=true')
  const incidentId=randomUUID(),attemptId=randomUUID()
  await f.controller.ensureIncident(incidentId,{repairClass:'C1',causeFingerprint:'d'.repeat(64),acceptanceRequired:true})
  const permit=await f.controller.openAttempt(incidentId,{attemptId,ordinal:1,expiresAt:new Date(Date.now()+60000).toISOString()})
  const context=brokerFixtureContext(permit),budget=createQualityExecutorBrokerBudget({...f.brokerOptions,context})
  await assert.rejects(budget.assertPermit(context.permit),{code:'POLICY_UNAVAILABLE'})
  const identity={runId:'12345',runAttempt:1,executorSourceSha:'c'.repeat(40),gateSetSha256:'b'.repeat(64),nonce:attemptId}
  assert.equal((await budget.claimExecutor(context.permit,identity)).status,'CLAIMED')
  await assert.rejects(budget.claimExecutor(context.permit,identity),{code:'IDEMPOTENCY_CONFLICT'})
  const quote=quoteCodeRequest(100,10)
  const reservation=await budget.reserveRequest(context.permit,{requestId:randomUUID(),inputDigest:'e'.repeat(64),quote})
  assert.equal((await f.controller.status()).pilotStartedAt,null,'CLAIM and RESERVE do not start any clock')
  await budget.dispatchRequest(reservation)
  const start=await f.controller.status()
  assert.equal(Date.parse(start.pilotExpiresAt)-Date.parse(start.pilotStartedAt),336*3600000)
  const actual=readCodeUsage({input_tokens:100,output_tokens:10,total_tokens:110,
   input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}},
   {model:quote.model,serviceTier:'default',quote})
  await budget.settleRequest(reservation,actual)
  assert.equal((await f.controller.status()).pilotStartedAt,start.pilotStartedAt)
  await f.admin.query('UPDATE profitia_limits.quality_installation SET enabled=false')
  await assert.rejects(budget.assertPermit(context.permit),{code:'LIMIT_EXCEEDED'})
  assert(!f.actions.some(a=>a.role==='broker'&&a.action==='STATUS'))
  const rows=(await f.admin.query('SELECT status FROM profitia_limits.quality_requests')).rows
  assert.deepEqual(rows,[{status:'SETTLED'}])
 }finally{await f.close()}
})
