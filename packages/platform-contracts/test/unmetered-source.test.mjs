import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost} from '../src/platform-ingestion.mjs'
import {createExternalCallHost,externalCallEvidence,ExternalCallUnavailable} from '../src/external-call.mjs'
const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg'),DATABASE='external_'+randomUUID().replaceAll('-',''),ROLE='unmetered_source_fixture'
const SOURCE='external.synthetic',RESOURCE='synthetic-query',hash=v=>createHash('sha256').update(v).digest('hex')
const rootSql=fs.readFileSync(new URL('../migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../migrations/access/009-external-call-admission.sql',import.meta.url),'utf8')
const rootDigest=hash(rootSql),digest=hash(sql),paths=[{method:'GET',path:'/data'},{method:'POST',path:'/data'},{method:'GET',path:'/slow'},{method:'GET',path:'/redirect'},{method:'GET',path:'/large'},{method:'GET',path:'/invalid'},{method:'GET',path:'/missing'}]
const issuedKeys=new Set(),key=()=>{const value=randomBytes(32).toString('hex');issuedKeys.add(value);return value},input=(command={})=>({intentKey:key(),command})
const unavailable=e=>e instanceof ExternalCallUnavailable&&e.message==='External result unavailable'&&e.retryAllowed===false

test('explicit unmetered Source keeps current E1, audit, history and independent paid metering',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect()
 let owner,runtime,server,hits=0,credentials=0,ackLoss=null,auditFailure=null,failAuditPhase=null,onSlowRequest=null
 const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+DATABASE
 try{
  server=http.createServer((req,res)=>{hits++;req.resume();res.setHeader('content-type','application/json')
   const path=new URL(req.url,'http://127.0.0.1').pathname
   if(path==='/redirect'){res.statusCode=302;res.setHeader('location','/data');res.end('{}')}
   else if(path==='/slow'){const observed=onSlowRequest;onSlowRequest=null;observed?.();setTimeout(()=>{if(!res.destroyed)res.end('{"value":3}')},350)}
   else if(path==='/large')res.end(JSON.stringify({private:'x'.repeat(20000)}))
   else if(path==='/invalid')res.end('{"__proto__":{"private":true}}')
   else{if(path==='/missing')res.statusCode=404;res.end(JSON.stringify({value:3,private:'provider-internal-field'}))}
  });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const origin='http://127.0.0.1:'+server.address().port
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0);await root.query(`CREATE DATABASE ${DATABASE}`)
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const [role,login]of[['profitia_ingestion_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:dbUrl.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner;GRANT CREATE ON SCHEMA public TO profitia_ingestion_owner`)
  const controlled=async work=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner');try{const v=await work();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   await owner.query(rootSql)
   await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','external-project','external-branch',$2)",[rootDigest,DATABASE])
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'external-source','PLATFORM_INTERNAL','synthetic-source','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','quality-v1','control-v1','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[SOURCE])
   await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,SOURCE])
   await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'external-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),SOURCE])
  })
  await t.test('optional schema requires actual owner; rollback leaves no partial extension',async()=>{
   await assert.rejects(owner.query(sql),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(sql);throw Error('synthetic installation failure')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_external_call') AS schema")).rows[0].schema,null)
  })
  await controlled(async()=>{
   await owner.query(sql)
   await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','external-project','external-branch',$3)",[digest,rootDigest,DATABASE])
   await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'external-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,1024,4096,120,'UPSTREAM_ATTEMPT_ADMISSION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),ROLE,SOURCE,RESOURCE,origin,JSON.stringify(paths)])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text) TO ${ROLE}`)
  })
  const runtimeUrl=new URL(dbUrl);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only'
  runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
  const sourceHostOptions={
   application:{appId:'external-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-source',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'external-source',environment:'development',projectId:'external-project',branchId:'external-branch',databaseName:DATABASE,role:ROLE,deploymentId:'synthetic-source',configurationVersion:'source-v1',schemaDigest:rootDigest},
   source:{id:SOURCE,payloadSchema:'external-call-control-v1',qualityVersion:'quality-v1',classificationVersion:'control-v1'},
   validateSharedPayload:v=>v&&Object.keys(v).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status',
   independentQuery:(q,v)=>runtime.query(q,v),
   transact:async work=>{
    const c=new Client({connectionString:runtimeUrl.toString()});await c.connect();await c.query('BEGIN');let phase
    try{
     const r=await work({transaction:c,query:async(q,v)=>{
      if(failAuditPhase===c.externalPhase&&q.includes('profitia_ingestion.append_audit')&&JSON.parse(v[0]).phase==='OUTCOME'){failAuditPhase=null;throw Error('synthetic OUTCOME audit outage')}
      return c.query(q,v)
     }})
     await c.query('COMMIT')
     phase=c.externalPhase
     if(ackLoss===phase){ackLoss=null;throw Error('synthetic commit response lost')}
     return r
    }catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}
   },
  }
  const sourceHost=createPlatformIngestionHost(sourceHostOptions)
  const settings={sourceHost,sourceId:SOURCE,resourceId:RESOURCE,binding:{role:ROLE,configurationVersion:'external-v1',schemaDigest:digest,origin,transport:'LOCAL_SYNTHETIC_HTTP',pathRules:paths},
   independentQuery:(q,v)=>runtime.query(q,v),query:(c,q,v)=>c.query(q,v),parseCommand:v=>v,
   buildRequest:()=>({method:'GET',url:origin+'/data',body:null}),projectResponse:v=>({value:v.value})}
  const host=createExternalCallHost(settings)
  const counts=async()=>({http:Number((await owner.query('SELECT admitted_count AS n FROM profitia_external_call.policies')).rows[0].n),
   source:Number((await owner.query('SELECT consumed_count AS n FROM profitia_ingestion.budgets')).rows[0].n)})
  await host.execute(input());assert.deepEqual(await counts(),{http:1,source:3})
  await controlled(()=>owner.query('UPDATE profitia_ingestion.budgets SET capacity=consumed_count'))
  await assert.rejects(host.execute(input()),unavailable)
  const extension=fs.readFileSync(new URL('../migrations/access/024-unmetered-public-sources.sql',import.meta.url),'utf8'),extensionDigest=hash(extension)
  await controlled(async()=>{await owner.query(fs.readFileSync(new URL('../migrations/access/012-native-external-transport.sql',import.meta.url),'utf8'))})
  await t.test('extension requires owner, disabled bindings and atomic installation',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[extensionDigest]);await owner.query(extension)}),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{
    await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
    await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[extensionDigest]);await owner.query(extension);throw Error('rollback fixture')
   }),/rollback fixture/)
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='profitia_ingestion' AND table_name='budgets' AND column_name='quota_mode'")).rows[0].n,0)
  })
  await controlled(async()=>{
   await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
   await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[extensionDigest]);await owner.query(extension)
   await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
  })
  await t.test('install alone neither activates unmetered nor resets historical counters',async()=>{
   assert.deepEqual(await counts(),{http:1,source:3});await assert.rejects(host.execute(input()),unavailable)
   assert.equal((await owner.query('SELECT quota_mode,capacity FROM profitia_ingestion.budgets')).rows[0].quota_mode,'METERED')
  })
  await controlled(async()=>{
   await owner.query("UPDATE profitia_ingestion.budgets SET quota_mode='UNMETERED',capacity=NULL,window_start=NULL,window_end=NULL,expires_at=NULL")
   await owner.query("UPDATE profitia_external_call.policies SET quota_mode='UNMETERED',capacity=NULL,window_start=NULL,window_end=NULL,expires_at=NULL")
  })
  const acceptedHost=createPlatformIngestionHost({...sourceHostOptions,binding:{...sourceHostOptions.binding,unmeteredSchemaDigest:extensionDigest}})
  const accepted=createExternalCallHost({...settings,sourceHost:acceptedHost})
  await t.test('unaccepted or wrong extension cannot send despite an unmetered database policy',async()=>{
   const n=hits;await assert.rejects(host.execute(input()),unavailable)
   const bad=createPlatformIngestionHost({...sourceHostOptions,binding:{...sourceHostOptions.binding,unmeteredSchemaDigest:'0'.repeat(64)}})
   await assert.rejects(createExternalCallHost({...settings,sourceHost:bad}).execute(input()),unavailable);assert.equal(hits,n)
  })
  await t.test('actual PLAN/ATTEMPT/SETTLE continue past old quotas with null capacity and windows',async()=>{
   const before=await counts(),n=hits
   for(let i=0;i<5;i++)assert.equal((await accepted.execute(input())).status,200)
   assert.deepEqual(await counts(),{http:before.http+5,source:before.source+15});assert.equal(hits,n+5)
   const row=(await owner.query('SELECT quota_mode,capacity,window_start,window_end,expires_at FROM profitia_ingestion.budgets')).rows[0]
   assert.deepEqual(row,{quota_mode:'UNMETERED',capacity:null,window_start:null,window_end:null,expires_at:null})
  })
  await t.test('history and counter decrease stay forbidden; mode is explicit',async()=>{
   await assert.rejects(controlled(()=>owner.query('UPDATE profitia_ingestion.budgets SET consumed_count=0')),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query('UPDATE profitia_external_call.policies SET admitted_count=0')),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET quota_mode='METERED'")),e=>e.code==='23514')
   await assert.rejects(owner.query('DELETE FROM profitia_ingestion.effects'),e=>e.code==='42501')
  })
  await t.test('finite paid-style policy remains metered independently from unmetered Source units',async()=>{
   const before=await counts();await controlled(()=>owner.query("UPDATE profitia_external_call.policies SET quota_mode='METERED',capacity=admitted_count+1,window_start=now()-interval '1 hour',window_end=now()+interval '1 hour',expires_at=now()+interval '1 hour'"))
   assert.equal((await accepted.execute(input())).status,200);const n=hits
   await assert.rejects(accepted.execute(input()),unavailable);assert.equal(hits,n);assert.equal((await counts()).http,before.http+1)
   await controlled(()=>owner.query("UPDATE profitia_external_call.policies SET quota_mode='UNMETERED',capacity=NULL,window_start=NULL,window_end=NULL,expires_at=NULL"))
  })
  await t.test('current revocation and authorization expiry still deny without sending',async()=>{
   const n=hits;await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'"));await assert.rejects(accepted.execute(input()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE';UPDATE profitia_ingestion.sources SET expires_at=now()-interval '1 second'"))
   await assert.rejects(accepted.execute(input()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.sources SET expires_at=now()+interval '1 hour'"))
   assert.equal((await accepted.execute(input())).status,200)
  })
  await t.test('login-scoped unmetered policy leaves another runtime default and counters intact',async()=>{
   const roleSql=fs.readFileSync(new URL('../migrations/access/026-role-source-quotas.sql',import.meta.url),'utf8'),roleDigest=hash(roleSql)
   await assert.rejects(owner.query(roleSql),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query("SELECT set_config('profitia.install.role_source_quota_digest',$1,true)",[roleDigest]);await owner.query(roleSql)}),e=>e.code==='42501')
   const before=await counts()
   await controlled(async()=>{
    await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
    await owner.query("SELECT set_config('profitia.install.role_source_quota_digest',$1,true)",[roleDigest]);await owner.query(roleSql)
    await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
    await owner.query("UPDATE profitia_ingestion.budgets SET quota_mode='METERED',capacity=consumed_count,window_start=now()-interval '1 hour',window_end=now()+interval '1 hour',expires_at=now()+interval '1 hour'")
   })
   await assert.rejects(accepted.execute(input()),unavailable)
   const scopedId=randomUUID()
   await controlled(()=>owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,login_role,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'external-source',$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[scopedId,SOURCE,ROLE]))
   for(let i=0;i<3;i++)assert.equal((await accepted.execute(input())).status,200)
   const policies=(await owner.query('SELECT login_role,quota_mode,consumed_count FROM profitia_ingestion.budgets ORDER BY login_role NULLS FIRST')).rows
   assert.deepEqual(policies,[{login_role:null,quota_mode:'METERED',consumed_count:String(before.source)},{login_role:ROLE,quota_mode:'UNMETERED',consumed_count:'9'}])
   // An unrelated login override is never selected by this runtime.
   await controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET login_role='unrelated_runtime' WHERE policy_id=$1",[scopedId]))
   const n=hits;await assert.rejects(accepted.execute(input()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query('UPDATE profitia_ingestion.budgets SET login_role=$1 WHERE policy_id=$2',[ROLE,scopedId]))
   // Explicit metering can be restored for future packages without a code edit.
   await controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET quota_mode='METERED',capacity=consumed_count,window_start=now()-interval '1 hour',window_end=now()+interval '1 hour',expires_at=now()+interval '1 hour' WHERE policy_id=$1",[scopedId]))
   await assert.rejects(accepted.execute(input()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET quota_mode='UNMETERED',capacity=NULL,window_start=NULL,window_end=NULL,expires_at=NULL WHERE policy_id=$1",[scopedId]))
   assert.equal((await accepted.execute(input())).status,200)
  })
  await t.test('an unmetered intent is not a retry token',async()=>{
   const i=input();await accepted.execute(i);const n=hits;await assert.rejects(accepted.execute(i),unavailable);assert.equal(hits,n)
  })
 }finally{await runtime?.end();await owner?.end();if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve)});await root.query(`DROP DATABASE IF EXISTS ${DATABASE}`);await root.end()}
})
