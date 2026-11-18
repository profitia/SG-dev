import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createQualityWorker} from '../src/worker.mjs'

test('Shutdown completes the outstanding durable tick and never starts another incident',async()=>{
 const ids=[randomUUID(),randomUUID()],stop=new AbortController(),events=[];let count=0,resolve,started
 const began=new Promise(r=>{started=r}),pending=new Promise(r=>{resolve=r})
 const worker=createQualityWorker({store:{listDue:async()=>ids},controller:{tick:async id=>{count++;assert.equal(id,ids[0]);started();await pending;return {status:'PATCH_READY'}}},onEvent:e=>events.push(e)})
 const running=worker.run({signal:stop.signal});await began
 await assert.rejects(worker.step(),{code:'WORKER_ALREADY_RUNNING'})
 await assert.rejects(worker.run({signal:stop.signal}),{code:'WORKER_ALREADY_RUNNING'})
 stop.abort();assert.equal(count,1);resolve();assert.deepEqual(await running,{status:'STOPPED'})
 assert.deepEqual(events,[{event:'QUALITY_TICK_COMPLETED',incidentId:ids[0],status:'PATCH_READY'}])
 assert.deepEqual(await worker.step({signal:stop.signal}),{status:'STOPPED',processed:0})
})

test('An unknown dispatch is not retried in memory; restart presents the same native incident for reconciliation',async()=>{
 const id=randomUUID(),nonce=randomUUID(),stop=new AbortController(),events=[];let pending=null,calls=0,dispatches=0
 const store={listDue:async()=>[id]}
 const controller={tick:async actual=>{assert.equal(actual,id);calls++;if(!pending){pending={nonce};dispatches++;throw Error('private input must not reach telemetry')}
  assert.equal(pending.nonce,nonce);stop.abort();return {status:'REPRODUCED'}}}
 const worker=createQualityWorker({store,controller,onEvent:e=>events.push(e)})
 await assert.rejects(worker.run({signal:stop.signal}),{code:'WORKER_TICK_FAILED'})
 assert.equal(calls,1);assert.equal(dispatches,1)
 assert.deepEqual(await worker.run({signal:stop.signal}),{status:'STOPPED'})
 assert.equal(calls,2);assert.equal(dispatches,1)
 assert(!JSON.stringify(events).includes('private input'))
})

test('Queue substitution and duplicate incidents stop before dispatch; telemetry failure does not repeat a tick',async()=>{
 const id=randomUUID();let calls=0
 for(const ids of [[id,id],['foreign-id'],Array.from({length:21},()=>randomUUID())]){
  const worker=createQualityWorker({store:{listDue:async()=>ids},controller:{tick:async()=>{calls++;return {status:'BUSY'}}}})
  await assert.rejects(worker.step(),{code:'WORKER_QUEUE_INVALID'})
 }
 assert.equal(calls,0)
 const worker=createQualityWorker({store:{listDue:async()=>[id]},controller:{tick:async()=>{calls++;return {status:'BUSY'}}},onEvent:()=>{throw Error('monitor unavailable')}})
 assert.deepEqual(await worker.step(),{status:'COMPLETE',processed:1});assert.equal(calls,1)
})

test('The poll is bounded and abortable and requires an explicit shutdown signal',async()=>{
 const stop=new AbortController();let calls=0,pauses=0
 const store={listDue:async()=>{calls++;return []}},controller={tick:async()=>{throw Error('no incident')}}
 const worker=createQualityWorker({store,controller,pollMs:1000,wait:async(ms,signal)=>{assert.equal(ms,1000);assert.equal(signal,stop.signal);pauses++;stop.abort()}})
 await assert.rejects(worker.run(),{code:'WORKER_STOP_SIGNAL_REQUIRED'})
 assert.deepEqual(await worker.run({signal:stop.signal}),{status:'STOPPED'});assert.equal(calls,1);assert.equal(pauses,1)
 for(const pollMs of [0,999,30001,NaN])assert.throws(()=>createQualityWorker({store,controller,pollMs}),{code:'WORKER_CONFIGURATION_REQUIRED'})
})

test('technical worker exposes connected disabled stores without opening the model ledger',async()=>{
 const {createQualityReadiness}=await import('../src/cli.mjs')
 let calls=0
 const readiness=createQualityReadiness({store:{descriptor:async()=>{calls++;return{enabled:false}}},
  budget:{status:async()=>{calls++;return{status:'DISABLED',pilotStartedAt:null,pilotExpiresAt:null,maximumNanoUsd:'50000000000',committedNanoUsd:'0'}}},
  sourceSha:'a'.repeat(40),serviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now:()=>Date.parse('2026-11-17T08:00:00Z')})
 const r=await readiness.check();assert.equal(r.status,'MONITORING_READY');assert.equal(r.paidRepairsEnabled,false)
 assert.equal(r.promotionEnabled,false);assert.equal(r.pilotStartedAt,null);assert.equal(calls,2)
})
test('technical readiness cannot reset an existing pilot, allow spending or accept enabled stores',async()=>{
 const {createQualityReadiness}=await import('../src/cli.mjs')
 for(const change of [{control:true},{status:'ENABLED'},{pilotStartedAt:'2026-11-17T08:00:00Z'},{pilotExpiresAt:'2026-12-01T08:00:00Z'},{committedNanoUsd:'1'},{maximumNanoUsd:'100000000000'}]){
  const readiness=createQualityReadiness({store:{descriptor:async()=>({enabled:change.control??false})},
   budget:{status:async()=>({status:'DISABLED',pilotStartedAt:null,pilotExpiresAt:null,maximumNanoUsd:'50000000000',committedNanoUsd:'0',...change})},
   sourceSha:'a'.repeat(40),serviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})
  await assert.rejects(()=>readiness.check(),{code:'READINESS_SAFETY_STATE_INVALID'})
 }
})
test('worker requires exact Development database roles, strict TLS, no model/publisher key and disabled switches',async()=>{
 const {readQualityReadinessConfiguration}=await import('../src/cli.mjs')
 const env={TARGET_ENVIRONMENT:'development',AQC_MODE:'TECHNICAL_READINESS',AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',
  RENDER_SERVICE_ID:'srv-aaaaaaaaaaaaaaaaaaaa',RENDER_GIT_COMMIT:'a'.repeat(40),AQC_SERVICE_UUID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  AQC_CONTROL_COMMAND_KEY:'b'.repeat(64),AQC_LIMITS_COMMAND_KEY:'c'.repeat(64),
  AQC_CONTROL_DATABASE_URL:'postgresql://sg2_assistant_quality_controller:synthetic@ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  AQC_LIMITS_DATABASE_URL:'postgresql://profitia_limits_quality_controller:synthetic@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}
 const c=readQualityReadinessConfiguration(env)
 assert.equal(c.control.ssl.rejectUnauthorized,true);assert.equal(c.control.user,'sg2_assistant_quality_controller')
 assert.equal(c.limits.user,'profitia_limits_quality_controller')
 for(const change of [{TARGET_ENVIRONMENT:'production'},{AQC_PAID_REPAIRS_ENABLED:'true'},{AQC_PROMOTION_ENABLED:'true'},{AQC_MODE:'repair'},
  {OPENAI_API_KEY:'synthetic'},{RENDER_API_KEY:'synthetic'},{GITHUB_TOKEN:'synthetic'},
  {AQC_CONTROL_COMMAND_KEY:env.AQC_LIMITS_COMMAND_KEY},{AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('sg2_assistant_quality_controller','sg2_assistant_history_owner')},
  {AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech','example.test')},
  {AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('sslmode=require','sslmode=disable')},
  {AQC_LIMITS_DATABASE_URL:env.AQC_LIMITS_DATABASE_URL+'&options=-csuperuser=on'}])
  assert.throws(()=>readQualityReadinessConfiguration({...env,...change}),{code:'READINESS_CONFIGURATION_INVALID',...(!['TARGET_ENVIRONMENT','AQC_PAID_REPAIRS_ENABLED','AQC_PROMOTION_ENABLED','AQC_MODE','OPENAI_API_KEY','RENDER_API_KEY','GITHUB_TOKEN','AQC_CONTROL_COMMAND_KEY'].some(k=>Object.hasOwn(change,k))?{code:'READINESS_DATABASE_BINDING_INVALID'}:{})})
})

function standbyEnvironment(){
 return {TARGET_ENVIRONMENT:'development',AQC_MODE:'CONTROLLER_STANDBY',AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',
 RENDER_SERVICE_ID:'srv-aaaaaaaaaaaaaaaaaaaa',RENDER_GIT_COMMIT:'a'.repeat(40),AQC_SERVICE_UUID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 AQC_CONTROL_COMMAND_KEY:'b'.repeat(64),AQC_LIMITS_COMMAND_KEY:'c'.repeat(64),
 AQC_CONTROL_DATABASE_URL:'postgresql://sg2_assistant_quality_controller:synthetic@ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
 AQC_LIMITS_DATABASE_URL:'postgresql://profitia_limits_quality_controller:synthetic@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require',
 AQC_CONTROLLER_GITHUB_TOKEN:'github_pat_'+ 's'.repeat(60),AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:'2026-11-26T23:59:59.000Z'}
}
test('Controller credential has a separate explicit mode, fixed expiry bound and never enters the readiness-only configuration',async()=>{
 const {readQualityControllerStandbyConfiguration,readQualityReadinessConfiguration}=await import('../src/cli.mjs')
 const env=standbyEnvironment(),now=Date.parse('2026-11-17T12:00:00Z')
 const config=readQualityControllerStandbyConfiguration(env,now);assert.equal(config.githubToken,env.AQC_CONTROLLER_GITHUB_TOKEN)
 assert.equal(config.control.user,'sg2_assistant_quality_controller');assert.equal(config.limits.user,'profitia_limits_quality_controller')
 assert.throws(()=>readQualityReadinessConfiguration({...env,AQC_MODE:'TECHNICAL_READINESS'}),{code:'READINESS_CONFIGURATION_INVALID'})
 for(const change of [{AQC_MODE:'TECHNICAL_READINESS'},{AQC_CONTROLLER_GITHUB_TOKEN:'ghp_classic_synthetic'},{AQC_CONTROLLER_GITHUB_TOKEN:''},
  {AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:'2026-11-17T00:00:00.000Z'},{AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:'2026-11-28T00:00:00.000Z'},
  {AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:'2026-11-26'},{AQC_CONTROLLER_CREDENTIAL_EXPIRES_AT:'invalid'}])
  assert.throws(()=>readQualityControllerStandbyConfiguration({...env,...change},now),{code:'CONTROLLER_CONFIGURATION_INVALID'})
 for(const change of [{OPENAI_API_KEY:'synthetic'},{GITHUB_TOKEN:'synthetic'},{GH_TOKEN:'synthetic'},{RENDER_API_KEY:'synthetic'},
  {AQC_PAID_REPAIRS_ENABLED:'true'},{AQC_PROMOTION_ENABLED:'true'}])
  assert.throws(()=>readQualityControllerStandbyConfiguration({...env,...change},now),{code:'READINESS_CONFIGURATION_INVALID'})
})
test('Standby connects only disabled native stores and the exact main-only workflow; it has no dispatch or publisher side effect',async()=>{
 const {createQualityControllerStandby}=await import('../src/cli.mjs');let reads=0,writes=0
 const github={descriptor:async()=>{reads++;return{repository:'profitia/SG-dev',headSha:'a'.repeat(40),publisherEnabled:false,promotionEnabled:false}},
  qualificationDescriptor:async()=>{reads++;return{path:'.github/workflows/assistant-quality-repair.yml',state:'active'}},
  dispatchQualification:async()=>{writes++;throw Error('forbidden')},propose:async()=>{writes++;throw Error('forbidden')}}
 const readiness={check:async()=>({status:'MONITORING_READY',paidRepairsEnabled:false,promotionEnabled:false,pilotStartedAt:null})}
 const check=options=>createQualityControllerStandby({readiness,github,credentialExpiresAt:'2026-11-26T23:59:59.000Z',now:()=>Date.parse('2026-11-17T12:00:00Z'),...options})
 const result=await check().check();assert.equal(result.controllerGitHub,'CONNECTED_STANDBY');assert.equal(result.promotionEnabled,false);assert.equal(reads,2);assert.equal(writes,0)
 await assert.rejects(check({now:()=>Date.parse('2026-11-27T00:00:00Z')}).check(),{code:'CONTROLLER_CREDENTIAL_EXPIRED'});assert.equal(reads,2)
 for(const change of [{repository:'profitia/foreign'},{publisherEnabled:true},{promotionEnabled:true},{headSha:'invalid'}]){
  const client={...github,descriptor:async()=>({...await github.descriptor(),...change})}
  await assert.rejects(check({github:client}).check(),{code:'CONTROLLER_GITHUB_BINDING_INVALID'})
 }
 await assert.rejects(check({github:{...github,qualificationDescriptor:async()=>({path:'.github/workflows/foreign.yml',state:'active'})}}).check(),{code:'CONTROLLER_GITHUB_BINDING_INVALID'})
 await assert.rejects(check({readiness:{check:async()=>{throw Object.assign(Error('disabled state changed'),{code:'READINESS_SAFETY_STATE_INVALID'})}}}).check(),{code:'READINESS_SAFETY_STATE_INVALID'})
 for(const change of [{status:'READY'},{paidRepairsEnabled:true},{promotionEnabled:true},{pilotStartedAt:'2026-11-17T00:00:00Z'}]){
  await assert.rejects(check({readiness:{check:async()=>({...await readiness.check(),...change})}}).check(),{code:'CONTROLLER_SAFETY_STATE_INVALID'})
 }
 assert.equal(writes,0)
})


function qaRoleEnvironment(){
 return {...standbyEnvironment(),AQC_QA_ROLE_PREFLIGHT_VERSION:'1.0.0',
  AQC_QA_PURPOSE_DATABASE_URL:'postgresql://sg2_assistant_quality_authority:synthetic@ep-late-heart-b9mxo8oi-pooler.c-7.eu-central-1.aws.neon.tech/platform_private?sslmode=require',
  AQC_QA_EVIDENCE_DATABASE_URL:'postgresql://sg2_assistant_quality_reader:synthetic@ep-muddy-pine-b22pdyqd-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require'}
}
function qaRoleRow(kind){
 return {database_name:kind==='purpose'?'platform_private':'neondb',role:kind==='purpose'?'sg2_assistant_quality_authority':'sg2_assistant_quality_reader',
  login:kind==='purpose'?'sg2_assistant_quality_authority':'sg2_assistant_quality_reader',rolsuper:false,rolbypassrls:false,rolcreatedb:false,
  rolcreaterole:false,rolinherit:false,rolreplication:false,rolcanlogin:true,rolconnlimit:3,rolvaliduntil:'2026-11-27T23:00:00.000Z',
  owner_member:false,schema_usage:true,schema_create:false,installed:true,schema_tables:3,direct_table_access:false}
}
test('QA role preflight opts into exact ordinary roles and databases with strict TLS and no QA content key',async()=>{
 const {readQualityQaRolePreflightConfiguration}=await import('../src/cli.mjs'),env=qaRoleEnvironment()
 assert.equal(readQualityQaRolePreflightConfiguration(standbyEnvironment()),null)
 const v=readQualityQaRolePreflightConfiguration(env)
 assert.equal(v.purpose.database,'platform_private');assert.equal(v.evidence.database,'neondb')
 assert.equal(v.purpose.ssl.rejectUnauthorized,true);assert.equal(v.evidence.user,'sg2_assistant_quality_reader')
 const bound=readQualityQaRolePreflightConfiguration({...env,AQC_QA_PURPOSE_DATABASE_URL:env.AQC_QA_PURPOSE_DATABASE_URL+'&channel_binding=require',
  AQC_QA_EVIDENCE_DATABASE_URL:env.AQC_QA_EVIDENCE_DATABASE_URL+'&channel_binding=require'})
 assert.equal(bound.purpose.enableChannelBinding,true);assert.equal(bound.evidence.enableChannelBinding,true)
 assert.equal(bound.purpose.ssl.rejectUnauthorized,true)
 for(const change of [{TARGET_ENVIRONMENT:'production'},{AQC_PROMOTION_ENABLED:'true'},{AQC_PAID_REPAIRS_ENABLED:'true'},
  {AQC_QA_ROLE_PREFLIGHT_VERSION:undefined},{AQC_QA_ROLE_PREFLIGHT_VERSION:'unknown'},{AQC_QA_EVIDENCE_DATABASE_URL:''},
  {AQC_QA_PURPOSE_COMMAND_KEY:'synthetic'},{AQC_QA_STORAGE_KEY:'synthetic'},
  {AQC_QA_PURPOSE_DATABASE_URL:env.AQC_QA_PURPOSE_DATABASE_URL.replace('/platform_private','/neondb')},
  {AQC_QA_EVIDENCE_DATABASE_URL:env.AQC_QA_EVIDENCE_DATABASE_URL.replace('quality_reader','history_owner')},
  {AQC_QA_EVIDENCE_DATABASE_URL:env.AQC_QA_EVIDENCE_DATABASE_URL.replace('sslmode=require','sslmode=disable')},
  {AQC_QA_EVIDENCE_DATABASE_URL:env.AQC_QA_EVIDENCE_DATABASE_URL+'&options=-csuperuser=on'}])
  assert.throws(()=>readQualityQaRolePreflightConfiguration({...env,...change}))
})
test('QA role preflight performs only two fixed catalog SELECTs and never returns credentials or a QA payload',async()=>{
 const {createQualityQaRolePreflight,qualityQaRolePreflightQuery}=await import('../src/cli.mjs'),calls=[]
 const query=kind=>async sql=>{calls.push({kind,sql});return{rows:[qaRoleRow(kind)]}}
 const result=await createQualityQaRolePreflight({purposeQuery:query('purpose'),evidenceQuery:query('evidence'),now:()=>Date.parse('2026-11-18T04:00:00Z')}).check()
 assert.equal(result.status,'QA_ROLES_VERIFIED');assert.equal(result.rawQaReadPerformed,false);assert.equal(result.permissionMutationPerformed,false)
 assert.equal(calls.length,2);assert(calls.every(c=>c.sql.startsWith('SELECT ')&&!c.sql.includes(';')))
 assert.equal(calls[0].sql,qualityQaRolePreflightQuery('purpose'));assert.equal(calls[1].sql,qualityQaRolePreflightQuery('evidence'))
 assert.equal(Object.keys(result).sort().join(','),'permissionMutationPerformed,qaAuthority,qaEvidence,rawQaReadPerformed,schemaVersion,status')
 assert.throws(()=>qualityQaRolePreflightQuery('__proto__'))
})
test('QA role preflight rejects privilege, ownership, schema, expiry and connection drift, and sanitizes provider failures',async()=>{
 const {createQualityQaRolePreflight}=await import('../src/cli.mjs'),now=()=>Date.parse('2026-11-18T04:00:00Z')
 const changes=['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolinherit','rolreplication','owner_member','schema_create','direct_table_access']
  .map(key=>({[key]:true}))
 changes.push({role:'neondb_owner'},{login:'neondb_owner'},{database_name:'foreign'},{rolcanlogin:false},{rolconnlimit:4},
  {schema_usage:false},{installed:false},{schema_tables:0},{rolvaliduntil:null},{rolvaliduntil:'2026-11-18T04:00:00Z'},
  {rolvaliduntil:'2026-11-28T00:00:00Z'},{rolsuper:undefined})
 for(const change of changes){
  const probe=createQualityQaRolePreflight({purposeQuery:async()=>({rows:[{...qaRoleRow('purpose'),...change}]}),
   evidenceQuery:async()=>({rows:[qaRoleRow('evidence')]}),now})
  await assert.rejects(probe.check(),{code:'QA_ROLE_PREFLIGHT_BINDING_INVALID'})
 }
 const failed=createQualityQaRolePreflight({purposeQuery:async()=>{throw Error('synthetic-password-must-not-escape')},evidenceQuery:async()=>({rows:[]}),now})
 await assert.rejects(failed.check(),e=>e.code==='QA_ROLE_PREFLIGHT_UNAVAILABLE'&&!e.message.includes('synthetic-password'))
})
