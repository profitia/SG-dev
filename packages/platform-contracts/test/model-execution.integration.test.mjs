import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost} from '../src/platform-ingestion.mjs'
import {createExternalCallHost,externalNativeResponse,ExternalCallUnavailable} from '../src/external-call.mjs'
import {modelExecutionSchemaDigest} from '../src/model-execution.mjs'
const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg')
const sql=n=>fs.readFileSync(new URL('../migrations/access/'+n,import.meta.url),'utf8'),hash=v=>createHash('sha256').update(v).digest('hex')
const DB='model_'+randomUUID().replaceAll('-',''),ROLE='model_execution_fixture',SOURCE='synthetic.model.openai'
const files=['008-platform-ingestion.sql','009-external-call-admission.sql','012-native-external-transport.sql']
const [rootDigest,baseDigest,nativeDigest]=files.map(n=>hash(sql(n))),extension=sql('028-model-execution.sql'),modelDigest=modelExecutionSchemaDigest()
const body=JSON.stringify({model:'gpt-6.1-sol',store:false,reasoning:{effort:'medium'},service_tier:'default',max_output_tokens:8000,input:[{role:'user',content:'SYNTHETIC FIXTURE ONLY'}],text:{format:{type:'json_schema',name:'fixture',strict:true,schema:{type:'object',properties:{},required:[],additionalProperties:false}}}})
test('SQL028 real Source controls: atomic single-attempt hold, current authority, usage and unknown-cost retention',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect()
 let owner,runtime,hits=0,mode='OK',tokenCount=100;const originalFetch=globalThis.fetch
 const u=new URL(rootUrl);u.pathname='/'+DB
 try{
  await root.query(`CREATE DATABASE ${DB}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const [role,login] of [['profitia_ingestion_owner',false],[ROLE,true]])if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
   await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
  await root.query('COMMIT')
  owner=new Client({connectionString:u.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DB} TO profitia_ingestion_owner`)
  const controlled=async fn=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner');try{const x=await fn();await owner.query('COMMIT');return x}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   await owner.query(sql(files[0]))
   await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','model-test-project','model-test-branch',$2)",[rootDigest,DB])
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'model-test-source','PLATFORM_INTERNAL','synthetic-model','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','quality-v1','control-v1','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[SOURCE])
   await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,SOURCE])
   await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'model-test-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),SOURCE])
   await owner.query(sql(files[1]));await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','model-test-project','model-test-branch',$3)",[baseDigest,rootDigest,DB])
   await owner.query(sql(files[2]));await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[nativeDigest])
  })
  await t.test('installer rejects owner connections and interrupted installation rolls back completely',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(extension);throw Error('interrupted')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_model_execution') v")).rows[0].v,null)
  })
  await controlled(async()=>{
   await owner.query(extension);await owner.query("INSERT INTO profitia_model_execution.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[modelDigest])
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_model_execution.policies')).rows[0].n,0)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native,profitia_model_execution TO ${ROLE};
    GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.read_status(uuid,text,text),profitia_model_execution.descriptor(text,text),profitia_model_execution.apply_control(uuid,uuid,text),profitia_model_execution.record_usage(uuid,jsonb,text,text) TO ${ROLE}`)
  })
  const runtimeUrl=new URL(u);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only'
  runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
  const sourceHost=createPlatformIngestionHost({application:{appId:'model-test-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-model',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'model-test-source',environment:'development',projectId:'model-test-project',branchId:'model-test-branch',databaseName:DB,role:ROLE,deploymentId:'synthetic-model',configurationVersion:'source-v1',schemaDigest:rootDigest},
   source:{id:SOURCE,payloadSchema:'external-call-control-v1',qualityVersion:'quality-v1',classificationVersion:'control-v1'},validateSharedPayload:v=>v&&Object.keys(v).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status',independentQuery:(q,v)=>runtime.query(q,v),
   transact:async work=>{const c=new Client({connectionString:runtimeUrl.toString()});await c.connect();try{await c.query('BEGIN');const r=await work({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}}})
  const configure=async(resource,model=true)=>controlled(async()=>{
   const id=randomUUID()
   await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'model-v1','https://api.openai.com','HTTPS','[{\"method\":\"POST\",\"path\":\"/v1/responses\"}]',65536,4000000,120000,'UPSTREAM_ATTEMPT_ADMISSION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[id,ROLE,SOURCE,resource])
   await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,'[{\"method\":\"POST\",\"path\":\"/v1/responses\",\"requestFormat\":\"JSON\"}]','[]',4000000,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[id])
   if(model)await owner.query("INSERT INTO profitia_model_execution.policies VALUES($1,'oil-test','gpt-6.1-sol',15000,8000,65536,150000,1,'SYNTHETIC_ONLY','SYNTHETIC_ONLY','SYNTHETIC_ONLY','SYNTHETIC_ONLY',$2,now()+interval '30 minutes','ACTIVE',1)",[id,'SYNTHETIC_GO_'+resource]);return id
  })
  const host=(resource,model=true)=>createExternalCallHost({sourceHost,sourceId:SOURCE,resourceId:resource,binding:{role:ROLE,configurationVersion:'model-v1',schemaDigest:baseDigest,origin:'https://api.openai.com',transport:'HTTPS',pathRules:[{method:'POST',path:'/v1/responses'}]},
   nativeTransport:{schemaDigest:nativeDigest,pathRules:[{method:'POST',path:'/v1/responses',requestFormat:'JSON'}],redirectOrigins:[],maximumResponseBytes:4000000,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'},
   ...(model?{modelExecution:{schemaDigest:modelDigest,profileId:'oil-test',model:'gpt-6.1-sol',maximumInputTokens:15000,maximumOutputTokens:8000,maximumBodyBytes:65536,reservationMicroUsd:150000,timeoutMs:120000},countModelInputTokens:()=>tokenCount}:{}),
   independentQuery:(q,v)=>runtime.query(q,v),query:(c,q,v)=>c.query(q,v),parseCommand:v=>v,buildRequest:()=>({method:'POST',url:'https://api.openai.com/v1/responses',body}),getHeaders:()=>({authorization:'Bearer SYNTHETIC_ONLY','x-client-request-id':'synthetic-'+randomUUID()})})
  globalThis.fetch=async(url,init)=>{
   assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(init.headers.get('authorization'),'Bearer SYNTHETIC_ONLY');hits++
   if(mode==='FAIL')throw Error('SYNTHETIC network outcome unknown')
   const r=new Response('{"id":"resp_synthetic","model":"gpt-6.1-sol","status":"completed","output":[],"usage":{"input_tokens":100,"output_tokens":50}}',{headers:{'content-type':'application/json','x-request-id':'req_synthetic','set-cookie':'NEVER_RETAIN'}})
   Object.defineProperty(r,'url',{value:String(url)});return r
  }
  await t.test('no policy means no send, no cost and no fabricated E1/Source proof',async()=>{
   await assert.rejects(host('not-configured').execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable);assert.equal(hits,0)
   await assert.rejects(runtime.query('SELECT profitia_model_execution.apply_control($1,$2,$3)',[randomUUID(),randomUUID(),'{}']))
  })
  const id=await configure('successful')
  await t.test('legacy SDK cannot bypass a model hold even under a base EXECUTE grant; ordinary non-model callers still work',async()=>{
   await controlled(()=>owner.query(`GRANT EXECUTE ON FUNCTION profitia_external_call.apply_control(uuid,uuid,text),profitia_external_native.descriptor(text,text) TO ${ROLE}`))
   try{
    await assert.rejects(host('successful',false).execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable)
    assert.equal(hits,0);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_model_execution.holds')).rows[0].n,0)
    assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls WHERE policy_id=$1',[id])).rows[0].n,0)
    await assert.rejects(host('successful').execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable)
    await configure('legacy-no-model',false)
    const old=await host('legacy-no-model',false).execute({intentKey:randomBytes(32).toString('hex'),command:{}})
    assert.equal(externalNativeResponse(old).status,200);assert.equal(hits,1)
   }finally{await controlled(()=>owner.query(`REVOKE EXECUTE ON FUNCTION profitia_external_call.apply_control(uuid,uuid,text),profitia_external_native.descriptor(text,text) FROM ${ROLE}`))}
  })
  await t.test('over-limit or unknown input token count stops before reservation and provider I/O',async()=>{
   const before=hits
   for(const invalid of [15001,NaN,0]){tokenCount=invalid;await assert.rejects(host('successful').execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable)}
   tokenCount=100;assert.equal(hits,before);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_model_execution.holds')).rows[0].n,0)
  })
  await t.test('missing or disabled SQL cost coupling closes the modern descriptor before any attempt',async()=>{
   const before=hits
   await controlled(()=>owner.query('ALTER TABLE profitia_external_call.calls DISABLE TRIGGER model_call_cost_coupling'))
   try{await assert.rejects(host('successful').execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable);assert.equal(hits,before)}
   finally{await controlled(()=>owner.query('ALTER TABLE profitia_external_call.calls ENABLE TRIGGER model_call_cost_coupling'))}
  })
  await t.test('two concurrent intents admit exactly one provider attempt and one 0.15 USD hold',async()=>{
   const before=hits,h=host('successful'),r=await Promise.allSettled([1,2].map(()=>h.execute({intentKey:randomBytes(32).toString('hex'),command:{}})))
   assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(hits,before+1)
   const response=externalNativeResponse(r.find(x=>x.status==='fulfilled').value);assert.equal(response.headers.get('x-request-id'),'req_synthetic');assert.equal(response.headers.get('set-cookie'),null)
   const holds=(await owner.query('SELECT * FROM profitia_model_execution.holds WHERE policy_id=$1',[id])).rows
   assert.equal(holds.length,1);assert.equal(holds[0].reserved_micro_usd,'150000');assert.equal(holds[0].status,'RESPONSE_USAGE_PENDING')
   await runtime.query('SELECT profitia_model_execution.record_usage($1,$2,$3,$4)',[holds[0].call_id,{inputTokens:100,outputTokens:50,cachedInputTokens:0},'req_synthetic','resp_synthetic'])
   await assert.rejects(runtime.query('SELECT profitia_model_execution.record_usage($1,$2,$3,$4)',[holds[0].call_id,{inputTokens:null,outputTokens:50,cachedInputTokens:0},'req_synthetic','resp_synthetic']))
   await assert.rejects(runtime.query('SELECT profitia_model_execution.record_usage($1,$2,$3,$4)',[holds[0].call_id,{inputTokens:101,outputTokens:50,cachedInputTokens:0},'req_synthetic','resp_synthetic']))
   const settled=(await owner.query('SELECT * FROM profitia_model_execution.holds WHERE call_id=$1',[holds[0].call_id])).rows[0]
   assert.equal(settled.status,'RESPONSE_USAGE_RECORDED');assert.equal(settled.estimated_cost_micro_usd,'750');assert.equal(settled.reserved_micro_usd,'150000')
  })
  await t.test('ordinary role has no direct writes; revoked Source and UNVERIFIED preserve accounting and prevent retry',async()=>{
   await assert.rejects(runtime.query('UPDATE profitia_model_execution.holds SET reserved_micro_usd=0'),e=>e.code==='42501')
   const id2=await configure('uncertain');mode='FAIL'
   await assert.rejects(host('uncertain').execute({intentKey:randomBytes(32).toString('hex'),command:{}}),ExternalCallUnavailable)
   const h=(await owner.query('SELECT * FROM profitia_model_execution.holds WHERE policy_id=$1',[id2])).rows[0]
   assert.equal(h.status,'UNVERIFIED');assert.equal(h.reserved_micro_usd,'150000');assert.equal(h.estimated_cost_micro_usd,null)
   const before=hits;await assert.rejects(host('uncertain').execute({intentKey:randomBytes(32).toString('hex'),command:{}}));assert.equal(hits,before)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[SOURCE]))
   await assert.rejects(host('successful').execute({intentKey:randomBytes(32).toString('hex'),command:{}}));assert.equal(hits,before)
  })
 }finally{
  globalThis.fetch=originalFetch
  await runtime?.end();await owner?.end();await root.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);await root.end()
 }
})
