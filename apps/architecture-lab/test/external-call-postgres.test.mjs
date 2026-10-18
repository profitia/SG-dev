import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost} from '../../../packages/platform-contracts/src/platform-ingestion.mjs'
import {createExternalCallHost,externalCallEvidence,ExternalCallUnavailable} from '../../../packages/platform-contracts/src/external-call.mjs'
const {Client}=createRequire(import.meta.url)('pg'),DATABASE='external_'+randomUUID().replaceAll('-',''),ROLE='external_call_fixture'
const SOURCE='external.synthetic',RESOURCE='synthetic-query',hash=v=>createHash('sha256').update(v).digest('hex')
const rootSql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/009-external-call-admission.sql',import.meta.url),'utf8')
const rootDigest=hash(rootSql),digest=hash(sql),paths=[{method:'GET',path:'/data'},{method:'POST',path:'/data'},{method:'GET',path:'/slow'},{method:'GET',path:'/redirect'},{method:'GET',path:'/large'},{method:'GET',path:'/invalid'},{method:'GET',path:'/missing'}]
const issuedKeys=new Set(),key=()=>{const value=randomBytes(32).toString('hex');issuedKeys.add(value);return value},input=(command={})=>({intentKey:key(),command})
const unavailable=e=>e instanceof ExternalCallUnavailable&&e.message==='External result unavailable'&&e.retryAllowed===false

test('ordinary real source control commits before bounded local HTTP; ambiguous effects never resend automatically',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect()
 let owner,runtime,server,hits=0,credentials=0,ackLoss=null,auditFailure=null,failAuditPhase=null
 const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+DATABASE
 try{
  server=http.createServer((req,res)=>{hits++;req.resume();res.setHeader('content-type','application/json')
   const path=new URL(req.url,'http://127.0.0.1').pathname
   if(path==='/redirect'){res.statusCode=302;res.setHeader('location','/data');res.end('{}')}
   else if(path==='/slow'){setTimeout(()=>{if(!res.destroyed)res.end('{"value":3}')},350)}
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
  const sourceHost=createPlatformIngestionHost({
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
  })
  const settings={sourceHost,sourceId:SOURCE,resourceId:RESOURCE,binding:{role:ROLE,configurationVersion:'external-v1',schemaDigest:digest,origin,transport:'LOCAL_SYNTHETIC_HTTP',pathRules:paths},
   independentQuery:(q,v)=>runtime.query(q,v),query:async(c,q,v)=>{c.externalPhase=JSON.parse(v[2]).content.action;if(auditFailure===c.externalPhase){auditFailure=null;throw Error('synthetic control failure')};return c.query(q,v)},
   parseCommand:v=>{if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).some(k=>!['path','query','method','body'].includes(k)))throw Error('closed command');return v},
   buildRequest:c=>({method:c.method??'GET',url:origin+(c.path??'/data')+(c.query?'?'+new URLSearchParams({q:c.query}):''),body:c.body??null}),
   getHeaders:async()=>{credentials++;return {'x-fixture-key':'not-persisted-fixture-credential'}},
   projectResponse:v=>({value:v.value})}
  const host=createExternalCallHost(settings),counts=async()=>({calls:(await owner.query('SELECT count(*)::int AS n FROM profitia_external_call.calls')).rows[0].n,
   admissions:(await owner.query('SELECT admitted_count AS n FROM profitia_external_call.policies')).rows[0].n,
   transactions:(await owner.query('SELECT consumed_count AS n FROM profitia_ingestion.budgets')).rows[0].n})
  await t.test('one HTTP response requires three committed source controls; evidence is not serializable authority',async()=>{
   const i=input({query:'private company query'}),before=await counts(),r=await host.execute(i)
   assert.deepEqual(r,{status:200,body:{value:3}});assert(Object.isFrozen(r.body));assert(externalCallEvidence(r));assert.equal(externalCallEvidence({...r}),null)
   assert.deepEqual(await counts(),{calls:before.calls+1,admissions:before.admissions+1,transactions:before.transactions+3})
   const n=hits;await assert.rejects(host.execute(i),e=>unavailable(e)&&e.certainty==='RESULT_NOT_RETAINED');assert.equal(hits,n)
   await assert.rejects(host.execute({...i,command:{query:'different'}}),unavailable);assert.equal(hits,n)
  })
  await t.test('same private intent concurrently admits at most one HTTP invocation',async()=>{
   const i=input(),n=hits,before=await counts(),results=await Promise.allSettled([host.execute(i),host.execute(i)])
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(hits,n+1);assert.equal((await counts()).admissions,before.admissions+1)
  })
  await t.test('PLAN acknowledgement loss may recover a planned control but never duplicates its admission',async()=>{
   const i=input(),n=hits,b=await counts();ackLoss='PLAN';await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n)
   assert.deepEqual(await host.execute(i),{status:200,body:{value:3}});assert.equal(hits,n+1);assert.equal((await counts()).admissions,b.admissions+1)
  })
  for(const phase of ['ATTEMPT','SETTLE'])await t.test(phase+' acknowledgement loss cannot be used to mint another attempt',async()=>{
   const i=input(),n=hits;ackLoss=phase;await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+(phase==='SETTLE'?1:0))
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+(phase==='SETTLE'?1:0))
  })
  await t.test('a failed ATTEMPT control rolls back before any network or credential lookup',async()=>{
   const i=input(),n=hits,c=credentials;auditFailure='ATTEMPT';await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n);assert.equal(credentials,c)
   assert.equal((await host.execute(i)).status,200);assert.equal(hits,n+1)
  })
  await t.test('failed canonical OUTCOME audit rolls back ATTEMPT and its counter before I/O',async()=>{
   const i=input(),n=hits,b=await counts();failAuditPhase='ATTEMPT';await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n)
   assert.deepEqual(await counts(),{calls:b.calls+1,admissions:b.admissions+1,transactions:b.transactions+1})
   assert.equal((await host.execute(i)).status,200);assert.equal(hits,n+1)
  })
  await t.test('bad credential headers or lookup failure settle NOT_SENT without leaking diagnostics',async()=>{
   const n=hits
   for(const getHeaders of [async()=>({'cookie':'private-cookie'}),async()=>{throw Error('private upstream credential detail')}]){
    const i=input();await assert.rejects(createExternalCallHost({...settings,getHeaders}).execute(i),e=>unavailable(e)&&e.certainty==='NOT_SENT')
    await assert.rejects(host.execute(i),unavailable)
   }assert.equal(hits,n)
  })
  await t.test('server-owned POST JSON and query both remain bound to the private intent',async()=>{
   const i=input({method:'POST',body:JSON.stringify({query:'private-post-query'})}),n=hits
   assert.equal((await host.execute(i)).status,200);await assert.rejects(host.execute({...i,command:{...i.command,body:JSON.stringify({query:'changed'})}}),unavailable);assert.equal(hits,n+1)
  })
  await t.test('fixed origin, paths, methods, size and parser deny before a new control or credentials',async()=>{
   const before=await counts(),n=hits,c=credentials
   for(const command of [{path:'/not-installed'},{path:'/../data'},{path:'/%64ata'},{method:'DELETE'},{method:'GET',body:'x'},{method:'POST',body:'x'.repeat(1100)},{method:'POST',body:'not-json'},{organisationId:randomUUID()}])await assert.rejects(host.execute(input(command)),unavailable)
   await assert.rejects(host.execute({...input(),intentKey:'public-short-key'}),unavailable)
   await assert.rejects(createExternalCallHost({...settings,buildRequest:()=>({url:'https://other.invalid/data',method:'GET',body:null})}).execute(input()),unavailable)
   assert.deepEqual(await counts(),before);assert.equal(hits,n);assert.equal(credentials,c)
  })
  await t.test('HTTP failure responses are observed responses, not business success',async()=>{
   const h=createExternalCallHost({...settings,projectResponse:()=>({found:false})}),r=await h.execute(input({path:'/missing'}))
   assert.deepEqual(r,{status:404,body:{found:false}});assert.equal(externalCallEvidence(r).status,'RESPONSE')
  })
  for(const path of ['/slow','/redirect','/large','/invalid'])await t.test(path+' is bounded, never followed or automatically retried',async()=>{
   const i=input({path}),n=hits;await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
  })
  await t.test('caller cancellation after send remains uncertain and does not refund the admission',async()=>{
   const ac=new AbortController(),i=input({path:'/slow'}),b=await counts(),n=hits,p=host.execute(i,{signal:ac.signal});setTimeout(()=>ac.abort(),60)
   await assert.rejects(p,unavailable);assert.equal(hits,n+1);assert.equal((await counts()).admissions,b.admissions+1)
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   const before=await counts();await assert.rejects(host.execute(input(),{signal:ac.signal}),unavailable);assert.deepEqual(await counts(),before)
  })
  await t.test('a stalled credential callback cannot send after the admitted deadline',async()=>{
   const i=input(),n=hits,h=createExternalCallHost({...settings,getHeaders:async()=>{await new Promise(resolve=>setTimeout(resolve,200));return {}}})
   await assert.rejects(h.execute(i),e=>unavailable(e)&&e.certainty==='NOT_SENT')
   await new Promise(resolve=>setTimeout(resolve,220));assert.equal(hits,n)
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n)
  })
  await t.test('same query under different private intent keys has no reusable plain request hash',async()=>{
   const before=(await owner.query('SELECT request_digest FROM profitia_external_call.calls')).rows.map(r=>r.request_digest)
   for(let n=0;n<2;n++)assert.equal((await host.execute(input({query:'same-private-query'}))).status,200)
   const added=(await owner.query('SELECT request_digest FROM profitia_external_call.calls')).rows.filter(r=>!before.includes(r.request_digest))
   assert.equal(added.length,2);assert.notEqual(added[0].request_digest,added[1].request_digest)
  })
  await t.test('actual elevated login flags and actual owner query port both deny before HTTP',async()=>{
   const n=hits;await owner.query(`ALTER ROLE ${ROLE} INHERIT`)
   try{await assert.rejects(host.execute(input()),unavailable)}finally{await owner.query(`ALTER ROLE ${ROLE} NOINHERIT`)}
   await assert.rejects(createExternalCallHost({...settings,independentQuery:(q,v)=>owner.query(q,v)}).execute(input()),unavailable)
   assert.equal(hits,n)
  })
  await t.test('replacing the actual source service binding during credential lookup denies the old intent',async()=>{
   const i=input(),n=hits,h=createExternalCallHost({...settings,getHeaders:async()=>{await owner.query('UPDATE profitia_ingestion.runtime_bindings SET service_id=$1',[randomUUID()]);return {}}})
   await assert.rejects(h.execute(i),unavailable);assert.equal(hits,n);await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n)
  })
  await t.test('configuration rotation cannot replay an already completed private intent',async()=>{
   const i=input(),n=hits;assert.equal((await host.execute(i)).status,200)
   await owner.query("UPDATE profitia_external_call.policies SET configuration_version='external-v2'")
   const next=createExternalCallHost({...settings,binding:{...settings.binding,configurationVersion:'external-v2'}})
   await assert.rejects(next.execute(i),unavailable);assert.equal(hits,n+1)
   await owner.query("UPDATE profitia_external_call.policies SET configuration_version='external-v1'")
  })
  await t.test('current policy revocation during deferred credential acquisition denies before HTTP',async()=>{
   const i=input(),n=hits,h=createExternalCallHost({...settings,getHeaders:async()=>{await owner.query("UPDATE profitia_external_call.policies SET status='REVOKED'");return {}}})
   await assert.rejects(h.execute(i),unavailable);assert.equal(hits,n);await owner.query("UPDATE profitia_external_call.policies SET status='ACTIVE'")
  })
  await t.test('current source revocation after response denies publication and prevents retry',async()=>{
   const i=input(),n=hits,h=createExternalCallHost({...settings,projectResponse:async v=>{await owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'");return {value:v.value}}})
   await assert.rejects(h.execute(i),unavailable);assert.equal(hits,n+1);await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'")
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
  })
  await t.test('wrong actual role, schema identity or configuration cannot dispatch',async()=>{
   const n=hits
   for(const binding of [{role:'other_runtime'},{schemaDigest:'0'.repeat(64)},{configurationVersion:'external-v2'}])await assert.rejects(createExternalCallHost({...settings,binding:{...settings.binding,...binding}}).execute(input()),unavailable)
   await owner.query("UPDATE profitia_external_call.installation SET source_schema_digest=$1",['0'.repeat(64)]);await assert.rejects(host.execute(input()),unavailable)
   await owner.query('UPDATE profitia_external_call.installation SET source_schema_digest=$1',[rootDigest]);assert.equal(hits,n)
  })
  await t.test('remaining finite admission is serialized; no refunds, independent from SQL transaction budget',async()=>{
   const used=(await counts()).admissions;await owner.query('UPDATE profitia_external_call.policies SET capacity=$1',[used+1]);const n=hits
   const results=await Promise.allSettled([host.execute(input()),host.execute(input())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(hits,n+1)
   await assert.rejects(owner.query('UPDATE profitia_external_call.policies SET admitted_count=0'),e=>e.code==='42501')
   await assert.rejects(host.execute(input()),unavailable);assert.equal(hits,n+1)
  })
  await t.test('control and canonical audit contain no private queries, response, headers or raw intent secret',async()=>{
   const data=JSON.stringify((await owner.query('SELECT to_jsonb(c) AS row FROM profitia_external_call.calls c')).rows)
    +JSON.stringify((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows)
   for(const v of ['private company query','same-private-query','private-post-query','private upstream credential detail','private-cookie','different','provider-internal-field','not-persisted-fixture-credential',...issuedKeys])assert(!data.includes(v))
   const events=(await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows.map(r=>r.event)
   assert(events.every(e=>e.organisationId===null&&e.subjectUserId===null&&e.actorKind!=='HUMAN'))
   assert(events.filter(e=>e.phase==='OUTCOME').every(e=>e.sourceId===SOURCE&&e.budgetUnit==='SOURCE_TRANSACTION'))
   assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN('profitia_access','profitia_jobs')")).rows[0].n,0)
  })
  await t.test('accidental ordinary table/column ACLs fail closed; FORCE RLS and history fences remain real',async()=>{
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA profitia_external_call TO ${ROLE}`)
   assert.equal((await runtime.query('SELECT * FROM profitia_external_call.calls')).rowCount,0)
   assert.equal((await runtime.query("UPDATE profitia_external_call.calls SET status='PLANNED'")).rowCount,0)
   await assert.rejects(runtime.query('TRUNCATE profitia_external_call.calls'),e=>e.code==='42501')
   await assert.rejects(runtime.query('TRUNCATE profitia_external_call.installation'),e=>e.code==='42501')
   await assert.rejects(runtime.query('SET ROLE profitia_ingestion_owner'),e=>e.code==='42501')
   await assert.rejects(host.execute(input()),unavailable)
   await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA profitia_external_call FROM ${ROLE};GRANT SELECT(request_digest) ON profitia_external_call.calls TO ${ROLE}`)
   await assert.rejects(host.execute(input()),unavailable)
   await owner.query(`REVOKE SELECT(request_digest) ON profitia_external_call.calls FROM ${ROLE}`)
   await assert.rejects(owner.query('DELETE FROM profitia_external_call.calls'),e=>e.code==='42501')
   const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_call' AND c.relkind='r'")).rows
   assert.equal(rows.length,3);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
  })
 }finally{await runtime?.end();await owner?.end();await root.end();if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})}
})
