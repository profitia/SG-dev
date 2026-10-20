import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost} from '../src/platform-ingestion.mjs'
import {createExternalCallHost,externalCallEvidence,externalNativeResponse,nativeExternalTransportSchemaDigest,publicWebTransportSchemaDigest,ExternalCallUnavailable} from '../src/external-call.mjs'
const {Client}=createRequire(new URL('../../../apps/architecture-lab/package.json',import.meta.url))('pg'),DATABASE='external_'+randomUUID().replaceAll('-',''),ROLE='public_web_fixture'
const SOURCE='public.web.synthetic',RESOURCE='synthetic-query',hash=v=>createHash('sha256').update(v).digest('hex')
const rootSql=fs.readFileSync(new URL('../migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../migrations/access/009-external-call-admission.sql',import.meta.url),'utf8')
import {createSafePublicFetch} from '../src/public-web-transport.mjs'
const rootDigest=hash(rootSql),digest=hash(sql),paths=[{method:'GET',path:'/data'},{method:'POST',path:'/data'},{method:'GET',path:'/slow'},{method:'GET',path:'/redirect'},{method:'GET',path:'/large'},{method:'GET',path:'/invalid'},{method:'GET',path:'/missing'}]
const issuedKeys=new Set(),key=()=>{const value=randomBytes(32).toString('hex');issuedKeys.add(value);return value},input=(command={})=>({intentKey:key(),command})
const webInput=(path='/data')=>({intentKey:key(),command:{url:new URL(path,'https://supplier.example').href}})
const unavailable=e=>e instanceof ExternalCallUnavailable&&e.message==='External result unavailable'&&e.retryAllowed===false

test('ordinary public GETs retain the existing Source controls, per-hop accounting and current authority',{skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect()
 let owner,runtime,server,hits=0,credentials=0,ackLoss=null,auditFailure=null,failAuditPhase=null,onSlowRequest=null,onResponse=null
 const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+DATABASE
 try{
  const received=[]
  server=http.createServer(async(req,res)=>{hits++;let body='';for await(const c of req)body+=c
   received.push({path:req.url,body,headers:req.headers});const path=new URL(req.url,'http://127.0.0.1').pathname
   const observed=onResponse;onResponse=null;if(observed)await observed()
   res.setHeader('content-type','application/octet-stream');res.setHeader('set-cookie','never-publish');res.setHeader('x-private','internal')
   if(path==='/redirect'){res.statusCode=307;res.setHeader('location','/data');res.end()}
   else if(path==='/bad-redirect'){res.statusCode=302;res.setHeader('location','https://unapproved.example/file');res.end()}
   else if(path==='/large')res.end(Buffer.alloc(9000,1))
   else if(path==='/slow'){const seen=onSlowRequest;onSlowRequest=null;seen?.();setTimeout(()=>{if(!res.destroyed)res.end(Buffer.from([0,255,12]))},250)}
   else if(path==='/token'){res.setHeader('content-type','application/json');res.end('{"access_token":"fixture-private-response"}')}
   else if(req.method==='POST'&&path==='/data'){res.setHeader('content-type','application/json');res.end('{"value":3,"private":"unprojected"}')}
   else res.end(Buffer.from([0,255,12]))
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
   await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'external-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,1024,4096,45000,'UPSTREAM_ATTEMPT_ADMISSION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),ROLE,SOURCE,RESOURCE,origin,JSON.stringify(paths)])
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
  const nativeSql=fs.readFileSync(new URL('../migrations/access/012-native-external-transport.sql',import.meta.url),'utf8')
  const webSql=fs.readFileSync(new URL('../migrations/access/018-public-web-transport.sql',import.meta.url),'utf8')
  const nativeDigest=await nativeExternalTransportSchemaDigest(),webDigest=await publicWebTransportSchemaDigest()
  await controlled(async()=>{
   await owner.query(nativeSql)
   await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[nativeDigest])
  })
  await t.test('optional public extension rejects actual owner, active Source and wrong prerequisite digest, atomically',async()=>{
   await assert.rejects(owner.query(webSql),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query(webSql)),e=>e.code==='42501')
   await controlled(()=>owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'"))
   await assert.rejects(controlled(()=>owner.query(webSql.replace(digest,'0'.repeat(64)))),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(webSql);throw Error('rollback public extension')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_public_web') AS schema")).rows[0].schema,null)
  })
  const publicPaths=[{method:'GET',path:'/'}],nativeRules=[{method:'GET',prefix:'/',parameter:'PUBLIC_PATH',suffix:'',requestFormat:'NONE'}],publicPolicy=randomUUID()
  await controlled(async()=>{
   await owner.query(webSql)
   await owner.query("INSERT INTO profitia_public_web.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[webDigest])
   await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'public-website','public-v1',NULL,'PUBLIC_WEB',$4::jsonb,8192,8192,1000,'UPSTREAM_ATTEMPT_ADMISSION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[publicPolicy,ROLE,SOURCE,JSON.stringify(publicPaths)])
   await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',8192,'NONE','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[publicPolicy,JSON.stringify(nativeRules)])
   await owner.query("INSERT INTO profitia_public_web.policies(policy_id,base_policy_version,maximum_redirects,synthetic_origin,status,expires_at,source_ref) VALUES($1,1,4,$2,'ACTIVE',now()+interval '20 minutes','SYNTHETIC_ONLY')",[publicPolicy,origin])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_external_native,profitia_public_web TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_external_native.descriptor(text,text),profitia_public_web.descriptor(text,text) TO ${ROLE}`)
   await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
  })
  const native={schemaDigest:nativeDigest,pathRules:nativeRules,redirectOrigins:[],maximumResponseBytes:8192,credentialMode:'NONE',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'}
  const settings={sourceHost,sourceId:SOURCE,resourceId:'public-website',binding:{role:ROLE,configurationVersion:'public-v1',schemaDigest:digest,origin:null,transport:'PUBLIC_WEB',pathRules:publicPaths},
   publicWebTransport:{schemaDigest:webDigest,syntheticOrigin:origin},nativeTransport:native,
   independentQuery:(q,v)=>runtime.query(q,v),query:async(c,q,v)=>{c.externalPhase=JSON.parse(v[2]).content.action;if(auditFailure===c.externalPhase){auditFailure=null;throw Error('synthetic control failure')};return c.query(q,v)},
   parseCommand:v=>{if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).join(',')!=='url'||typeof v.url!=='string')throw Error('closed public command');return v},
   buildRequest:c=>({method:'GET',url:c.url,body:null})}
  const host=createExternalCallHost(settings),counts=async()=>({calls:(await owner.query("SELECT count(*)::int AS n FROM profitia_external_call.calls WHERE resource_id='public-website'")).rows[0].n,
   admissions:(await owner.query('SELECT admitted_count AS n FROM profitia_external_call.policies WHERE policy_id=$1',[publicPolicy])).rows[0].n,
   transactions:(await owner.query('SELECT consumed_count AS n FROM profitia_ingestion.budgets')).rows[0].n})
  await t.test('one public GET commits PLAN, ATTEMPT and SETTLE without credentials or raw URL storage',async()=>{
   const n=hits,b=await counts(),i=webInput('/kontakt?private-query=synthetic'),r=await host.execute(i)
   assert.deepEqual(r.bytes,Uint8Array.of(0,255,12));assert.equal(r.url,i.command.url);assert.equal(hits,n+1)
   assert.equal(externalCallEvidence(r).resourceId,'public-website');assert.equal(externalNativeResponse(r).headers.get('set-cookie'),null)
   for(const name of ['authorization','cookie','x-fixture-key'])assert.equal(received.at(-1).headers[name],undefined)
   assert.equal(received.at(-1).headers['accept-encoding'],'identity')
   assert.deepEqual(await counts(),{calls:b.calls+1,admissions:b.admissions+1,transactions:b.transactions+3})
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
  })
  await t.test('every real redirect hop gets separate three-phase Source admission',async()=>{
   const n=hits,b=await counts(),fetcher=createSafePublicFetch(async(url,{signal})=>externalNativeResponse(await host.execute({intentKey:key(),command:{url}},{signal})))
   const r=await fetcher('https://supplier.example/redirect');assert.deepEqual(r.body,Buffer.from([0,255,12]));assert.equal(hits,n+2)
   assert.deepEqual(await counts(),{calls:b.calls+2,admissions:b.admissions+2,transactions:b.transactions+6})
  })
  await t.test('concurrent duplicate public intents consume at most one upstream attempt',async()=>{
   const i=webInput(),n=hits,r=await Promise.allSettled([host.execute(i),host.execute(i)]);assert.equal(r.filter(v=>v.status==='fulfilled').length,1);assert.equal(hits,n+1)
  })
  await t.test('public descriptor, current role, configuration and server-only opt-in are mandatory before I/O',async()=>{
   const n=hits,b=await counts()
   for(const options of [{...settings,publicWebTransport:{...settings.publicWebTransport,schemaDigest:'0'.repeat(64)}},{...settings,publicWebTransport:{schemaDigest:webDigest}},{...settings,independentQuery:(q,v)=>owner.query(q,v)},{...settings,binding:{...settings.binding,configurationVersion:'other-v1'}}])await assert.rejects(createExternalCallHost(options).execute(webInput()),unavailable)
   for(const patch of [{publicWebTransport:undefined},{getHeaders:async()=>({Authorization:'never-sent'})},{projectResponse:v=>v},{nativeTransport:{...native,credentialMode:'SERVER_HEADERS'}},{binding:{...settings.binding,origin:'https://fake-fixed.example'}}])assert.throws(()=>createExternalCallHost({...settings,...patch}),TypeError)
   for(const url of ['file:///etc/passwd','https://u:p@supplier.example/a','http://metadata.internal/','https://supplier.example:8443/a','https://supplier.example/a#fragment'])await assert.rejects(host.execute({intentKey:key(),command:{url}}),unavailable)
   await owner.query(`ALTER ROLE ${ROLE} INHERIT`);try{await assert.rejects(host.execute(webInput()),unavailable)}finally{await owner.query(`ALTER ROLE ${ROLE} NOINHERIT`)}
   assert.equal(hits,n);assert.deepEqual(await counts(),b)
  })
  await t.test('revocation at ATTEMPT and after actual network response prevents publication and replay',async()=>{
   const n=hits,i=webInput();onResponse=()=>controlled(()=>owner.query("UPDATE profitia_public_web.policies SET status='REVOKED'"))
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   await controlled(()=>owner.query("UPDATE profitia_public_web.policies SET status='ACTIVE'"));await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   let attemptObserved=false;const j=webInput(),h=createExternalCallHost({...settings,query:async(c,q,v)=>{const r=await settings.query(c,q,v);if(JSON.parse(v[2]).content.action==='ATTEMPT')attemptObserved=true;return r},independentQuery:async(q,v)=>{if(attemptObserved&&q.includes('profitia_public_web.descriptor')){attemptObserved=false;await controlled(()=>owner.query("UPDATE profitia_public_web.policies SET status='REVOKED'"))}return runtime.query(q,v)}})
   await assert.rejects(h.execute(j),unavailable);assert.equal(hits,n+1)
   await controlled(()=>owner.query("UPDATE profitia_public_web.policies SET status='ACTIVE'"))
  })
  for(const phase of ['ATTEMPT','SETTLE'])await t.test(phase+' commit acknowledgement loss never sends a second request',async()=>{
   const i=webInput(),n=hits;ackLoss=phase;await assert.rejects(host.execute(i),unavailable);await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+(phase==='SETTLE'?1:0))
  })
  await t.test('OUTCOME audit failure before HTTP rolls back the attempt; deliberate retry uses that same reservation',async()=>{
   const i=webInput(),n=hits;failAuditPhase='ATTEMPT';await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n)
   assert.equal((await host.execute(i)).status,200);assert.equal(hits,n+1)
  })
  await t.test('overflow and cancellation retain uncertain consumed attempts, without automatic resend',async()=>{
   const i=webInput('/large'),n=hits;await assert.rejects(host.execute(i),unavailable);await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   const j=webInput('/slow'),ac=new AbortController();onSlowRequest=()=>ac.abort();await assert.rejects(host.execute(j,{signal:ac.signal}),unavailable);await assert.rejects(host.execute(j),unavailable);assert.equal(hits,n+2)
   const before=await counts();await assert.rejects(host.execute(webInput(),{signal:ac.signal}),unavailable);assert.deepEqual(await counts(),before)
  })
  await t.test('SQL refuses credential/path/parent/fake-origin drift and synthetic privilege outside actual Development',async()=>{
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_public_web.policies SET synthetic_origin='http://127.0.0.1:1'")),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_public_web.policies SET base_policy_version=2")),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_public_web.policies SET maximum_redirects=5")))
   // A real controlled insert with a non-synthetic public source reference may
   // never reuse the fixture override, even on the actual Development database.
   await assert.rejects(controlled(()=>owner.query("INSERT INTO profitia_public_web.policies SELECT policy_id,base_policy_version,maximum_redirects,synthetic_origin,status,version,expires_at,'REAL_PUBLIC_SOURCE' FROM profitia_public_web.policies")),e=>e.code==='42501'&&/Development synthetic-only/.test(e.message))
   await assert.rejects(controlled(async()=>{await owner.query("UPDATE profitia_ingestion.installation SET environment='staging'");await owner.query("INSERT INTO profitia_public_web.policies SELECT * FROM profitia_public_web.policies")}),e=>e.code==='42501'&&/Development synthetic-only/.test(e.message))
   const n=hits;await controlled(()=>owner.query("UPDATE profitia_public_web.policies SET expires_at=now()-interval '1 second'"));await assert.rejects(host.execute(webInput()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query("UPDATE profitia_public_web.policies SET expires_at=now()+interval '15 minutes'"))
  })
  await t.test('ordinary role cannot inherit owner, read metadata or truncate; ACL and column drift close admission',async()=>{
   await assert.rejects(runtime.query('SET ROLE profitia_ingestion_owner'),e=>e.code==='42501')
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA profitia_public_web TO ${ROLE}`)
   assert.equal((await runtime.query('SELECT * FROM profitia_public_web.policies')).rowCount,0)
   await assert.rejects(runtime.query('TRUNCATE profitia_public_web.policies'),e=>e.code==='42501');await assert.rejects(host.execute(webInput()),unavailable)
   await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA profitia_public_web FROM ${ROLE};GRANT SELECT(source_ref) ON profitia_public_web.policies TO ${ROLE}`)
   await assert.rejects(host.execute(webInput()),unavailable);await owner.query(`REVOKE SELECT(source_ref) ON profitia_public_web.policies FROM ${ROLE}`)
   assert.equal((await controlled(()=>owner.query('DELETE FROM profitia_public_web.policies'))).rowCount,0)
   await assert.rejects(controlled(()=>owner.query('TRUNCATE profitia_public_web.policies')),e=>e.code==='42501')
   const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_public_web' AND c.relkind='r'")).rows
   assert.equal(rows.length,2);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
  })
  await t.test('existing fixed native Source mode still works after public extension, without wildcard origins',async()=>{
   const fixedRules=[{method:'GET',path:'/data',requestFormat:'NONE'}]
   await controlled(()=>owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) SELECT policy_id,version,$1::jsonb,'[]',8192,'NONE','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '10 minutes','SYNTHETIC_ONLY' FROM profitia_external_call.policies WHERE resource_id=$2",[JSON.stringify(fixedRules),RESOURCE]))
   const {publicWebTransport,...fixed}=settings
   const h=createExternalCallHost({...fixed,resourceId:RESOURCE,binding:{...settings.binding,origin,transport:'LOCAL_SYNTHETIC_HTTP',configurationVersion:'external-v1',pathRules:paths},nativeTransport:{...native,pathRules:fixedRules},buildRequest:()=>({method:'GET',url:origin+'/data',body:null})})
   assert.equal((await h.execute(webInput())).status,200)
  })
  await t.test('finite Source budget closes before more HTTP; technical records contain only digests',async()=>{
   const raw=JSON.stringify((await owner.query('SELECT to_jsonb(c) AS row FROM profitia_external_call.calls c')).rows)+JSON.stringify((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows)
   for(const value of ['supplier.example','private-query','never-publish','not-persisted-fixture-credential',...issuedKeys])assert(!raw.includes(value))
   assert((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows.every(r=>r.event.organisationId===null&&r.event.subjectUserId===null&&r.event.actorKind!=='HUMAN'))
   await controlled(()=>owner.query('UPDATE profitia_ingestion.budgets SET capacity=consumed_count'))
   const n=hits;await assert.rejects(host.execute(webInput()),unavailable);assert.equal(hits,n)
  })
 }finally{await runtime?.end();await owner?.end();await root.end();if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})}
})
