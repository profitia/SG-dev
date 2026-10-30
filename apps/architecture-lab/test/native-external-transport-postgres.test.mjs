import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost} from '../../../packages/platform-contracts/src/platform-ingestion.mjs'
import {createExternalCallHost,externalCallEvidence,externalCallFailureEvidence,externalNativeResponse,nativeExternalTransportSchemaDigest,ExternalCallUnavailable} from '../../../packages/platform-contracts/src/external-call.mjs'
const {Client}=createRequire(import.meta.url)('pg'),DATABASE='external_'+randomUUID().replaceAll('-',''),ROLE='native_external_fixture'
const SOURCE='native.external.synthetic',RESOURCE='synthetic-query',hash=v=>createHash('sha256').update(v).digest('hex')
const rootSql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/009-external-call-admission.sql',import.meta.url),'utf8')
const rootDigest=hash(rootSql),digest=hash(sql),paths=[{method:'GET',path:'/data'},{method:'POST',path:'/data'},{method:'GET',path:'/slow'},{method:'GET',path:'/redirect'},{method:'GET',path:'/large'},{method:'GET',path:'/invalid'},{method:'GET',path:'/missing'}]
const issuedKeys=new Set(),key=()=>{const value=randomBytes(32).toString('hex');issuedKeys.add(value);return value},input=(command={})=>({intentKey:key(),command})
const unavailable=e=>e instanceof ExternalCallUnavailable&&e.message==='External result unavailable'&&e.retryAllowed===false

test('ordinary native provider protocol reuses committed source controls and fails closed',async t=>{
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
   else if(path==='/slow'){const seen=onSlowRequest;onSlowRequest=null;seen?.();setTimeout(()=>{if(!res.destroyed)res.end(Buffer.from([0,255,12]))},31000)}
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
  let sourceClockOffsetMs=0
  const sourceHost=createPlatformIngestionHost({now:()=>Date.now()+sourceClockOffsetMs,
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
  const settings={now:()=>Date.now()+sourceClockOffsetMs,sourceHost,sourceId:SOURCE,resourceId:RESOURCE,binding:{role:ROLE,configurationVersion:'external-v1',schemaDigest:digest,origin,transport:'LOCAL_SYNTHETIC_HTTP',pathRules:paths},
   independentQuery:(q,v)=>runtime.query(q,v),query:async(c,q,v)=>{c.externalPhase=JSON.parse(v[2]).content.action;if(auditFailure===c.externalPhase){auditFailure=null;throw Error('synthetic control failure')};return c.query(q,v)},
   parseCommand:v=>{if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).some(k=>!['path','query','method','body'].includes(k)))throw Error('closed command');return v},
   buildRequest:c=>({method:c.method??'GET',url:origin+(c.path??'/data')+(c.query?'?'+new URLSearchParams({q:c.query}):''),body:c.body??null}),
   getHeaders:async()=>{credentials++;return {'x-fixture-key':'not-persisted-fixture-credential'}},
   projectResponse:v=>({value:v.value})}
  const nativeSql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/012-native-external-transport.sql',import.meta.url),'utf8'),nativeDigest=await nativeExternalTransportSchemaDigest()
  const nativeRules=[{method:'GET',path:'/data',requestFormat:'NONE'},{method:'GET',path:'/slow',requestFormat:'NONE'},
   {method:'GET',path:'/large',requestFormat:'NONE'},{method:'GET',path:'/redirect',requestFormat:'NONE'},
   {method:'GET',path:'/bad-redirect',requestFormat:'NONE'},{method:'POST',path:'/token',requestFormat:'FORM'},
   {method:'GET',prefix:'/records/',parameter:'HEX24',suffix:'/files/main_document_uri',requestFormat:'NONE'}]
  await t.test('optional native schema rejects wrong installer and is atomic on failure',async()=>{
   await assert.rejects(owner.query(nativeSql),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(nativeSql);throw Error('rollback optional extension')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_external_native') AS schema")).rows[0].schema,null)
  })
  await controlled(async()=>{
   await owner.query(nativeSql)
   await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[nativeDigest])
   await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) SELECT policy_id,version,$1::jsonb,$2::jsonb,8192,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY' FROM profitia_external_call.policies",[JSON.stringify(nativeRules),JSON.stringify([origin])])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_external_native TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_external_native.descriptor(text,text) TO ${ROLE}`)
  })
  const {projectResponse:unusedProjection,...nativeBase}=settings
  const native={schemaDigest:nativeDigest,pathRules:nativeRules,redirectOrigins:[origin],maximumResponseBytes:8192,credentialMode:'SERVER_HEADERS',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'}
  const host=createExternalCallHost({...nativeBase,nativeTransport:native})
  const counts=async()=>({calls:(await owner.query('SELECT count(*)::int AS n FROM profitia_external_call.calls')).rows[0].n,admissions:(await owner.query('SELECT admitted_count AS n FROM profitia_external_call.policies')).rows[0].n,transactions:(await owner.query('SELECT consumed_count AS n FROM profitia_ingestion.budgets')).rows[0].n})
  await t.test('small database clock lead permits a current settled Source without extending its lease',async()=>{
   sourceClockOffsetMs=-5
   try{const b=await counts(),n=hits,r=await host.execute(input());assert.equal(r.status,200);assert.equal(hits,n+1)
    assert.deepEqual(await counts(),{calls:b.calls+1,admissions:b.admissions+1,transactions:b.transactions+3})
   }finally{sourceClockOffsetMs=0}
  })
  await t.test('database clock divergence outside the bound fails before provider admission',async()=>{
   sourceClockOffsetMs=-1100
   try{const b=await counts(),n=hits;await assert.rejects(host.execute(input()),unavailable);assert.equal(hits,n);assert.deepEqual(await counts(),b)
   }finally{sourceClockOffsetMs=0}
  })
  await t.test('binary result and a reconstructed native Response require three committed controls',async()=>{
   const b=await counts(),r=await host.execute(input());assert.deepEqual(r.bytes,Uint8Array.of(0,255,12));r.bytes[0]=88;assert.equal(r.bytes[0],0)
   assert.equal(r.headers['set-cookie'],undefined);assert.equal(r.headers['x-private'],undefined)
   assert.equal(externalCallEvidence(r).transportProtocol,'profitia.external-native-http')
   assert.deepEqual(new Uint8Array(await externalNativeResponse(r).arrayBuffer()),Uint8Array.of(0,255,12))
   assert.throws(()=>externalNativeResponse({...r}));assert(!JSON.stringify(r).includes(origin))
   assert.deepEqual(await counts(),{calls:b.calls+1,admissions:b.admissions+1,transactions:b.transactions+3})
  })
  await t.test('OAuth form and bounded dynamic source path reach the original native endpoint',async()=>{
   const body='grant_type=client_credentials&client_secret=private-fixture-form'
   const r=await host.execute(input({path:'/token',method:'POST',body}));assert.equal((await externalNativeResponse(r).json()).access_token,'fixture-private-response')
   assert.equal(received.at(-1).body,body);assert.equal(received.at(-1).headers['content-type'],'application/x-www-form-urlencoded')
   assert.equal((await host.execute(input({path:'/records/'+'a'.repeat(24)+'/files/main_document_uri'}))).status,200)
  })
  await t.test('redirect is a real 307 settlement, never an automatic second HTTP call',async()=>{
   const n=hits,r=await host.execute(input({path:'/redirect'}));assert.equal(hits,n+1);assert.equal(r.status,307);assert.equal(r.headers.location,origin+'/data')
   assert.equal((await owner.query('SELECT http_status FROM profitia_external_call.calls WHERE call_id=$1',[externalCallEvidence(r).callId])).rows[0].http_status,307)
   const second=await host.execute(input({path:'/data'}));assert.equal(second.status,200);assert.equal(hits,n+2)
   await assert.rejects(host.execute(input({path:'/bad-redirect'})),unavailable);assert.equal(hits,n+3)
  })
  await t.test('default JSON host still refuses native redirects after extension installation',async()=>{
   const n=hits;await assert.rejects(createExternalCallHost(settings).execute(input({path:'/redirect'})),unavailable);assert.equal(hits,n+1)
   const json=await createExternalCallHost(settings).execute(input({path:'/data',method:'POST',body:'{}'}));assert.deepEqual(json,{status:200,body:{value:3}})
   await assert.rejects(createExternalCallHost(settings).execute(input()),unavailable)
  })
  await t.test('refused native redirect yields only an original error observation after all three committed controls',async()=>{
   const i=input({path:'/bad-redirect'}),n=hits,b=await counts();let failure
   await assert.rejects(host.execute(i),error=>{failure=error;return unavailable(error)})
   assert.equal(hits,n+1)
   const observation=externalCallFailureEvidence(failure)
   assert.deepEqual({...observation,callId:null,attemptEffectId:null,settlementEffectId:null},{
    contractId:'profitia.external-call.failure-observation',contractVersion:'1.0.0',sourceId:SOURCE,resourceId:RESOURCE,
    applicationId:'external-source',environment:'development',callId:null,attemptEffectId:null,settlementEffectId:null,
    status:'UNVERIFIED',reason:'NATIVE_RESPONSE_REJECTED',httpStatus:302,retryAllowed:false,
   })
   assert(Object.isFrozen(observation));assert.notEqual(observation.attemptEffectId,observation.settlementEffectId)
   assert.equal(externalCallFailureEvidence({...failure}),null);assert.equal(externalCallFailureEvidence(JSON.parse(JSON.stringify(observation))),null)
   assert.equal(externalCallEvidence(failure),null);assert.throws(()=>externalNativeResponse(failure))
   assert.deepEqual(await counts(),{calls:b.calls+1,admissions:b.admissions+1,transactions:b.transactions+3})
   const stored=(await owner.query('SELECT status,http_status,response_digest FROM profitia_external_call.calls WHERE call_id=$1',[observation.callId])).rows[0]
   assert.deepEqual(stored,{status:'UNVERIFIED',http_status:null,response_digest:null})
   await assert.rejects(host.execute(i),error=>unavailable(error)&&externalCallFailureEvidence(error)===null);assert.equal(hits,n+1)
   assert(!JSON.stringify(observation).includes('unapproved.example'));assert(!JSON.stringify(failure).includes('302'))
  })
  for(const failureKind of ['control','audit','acknowledgement'])await t.test('refused redirect with '+failureKind+' settlement failure never yields an availability observation',async()=>{
   if(failureKind==='control')auditFailure='SETTLE'
   if(failureKind==='audit')failAuditPhase='SETTLE'
   if(failureKind==='acknowledgement')ackLoss='SETTLE'
   await assert.rejects(host.execute(input({path:'/bad-redirect'})),error=>unavailable(error)&&externalCallFailureEvidence(error)===null)
  })
  await t.test('refused redirect with current Source revocation cannot be reclassified as provider availability',async()=>{
   onResponse=()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'")
   try{await assert.rejects(host.execute(input({path:'/bad-redirect'})),error=>unavailable(error)&&externalCallFailureEvidence(error)===null)}
   finally{await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'")}
  })
  await t.test('wrong policy, path, format, role and owner query cannot admit a request',async()=>{
   const n=hits,b=await counts()
   for(const c of [{path:'/unknown'},{path:'/records/not-hex/files/main_document_uri'},{path:'/token',method:'POST',body:'secret=%0a'},{path:'/data',body:'{}'}])await assert.rejects(host.execute(input(c)),unavailable)
   for(const patch of [{schemaDigest:'0'.repeat(64)},{maximumResponseBytes:8191},{credentialMode:'NONE'}]){
    const {getHeaders,...noHeaders}=nativeBase
    await assert.rejects(createExternalCallHost({...noHeaders,nativeTransport:{...native,...patch}}).execute(input()),unavailable)
   }
   await assert.rejects(createExternalCallHost({...nativeBase,nativeTransport:native,independentQuery:(q,v)=>owner.query(q,v)}).execute(input()),unavailable)
   await owner.query(`ALTER ROLE ${ROLE} INHERIT`);try{await assert.rejects(host.execute(input()),unavailable)}finally{await owner.query(`ALTER ROLE ${ROLE} NOINHERIT`)}
   assert.equal(hits,n);assert.deepEqual(await counts(),b)
  })
  await t.test('replay, conflict and concurrent duplicate never issue a second attempt',async()=>{
   const i=input(),n=hits;const result=await Promise.allSettled([host.execute(i),host.execute(i)])
   assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(hits,n+1)
   await assert.rejects(host.execute(i),unavailable);await assert.rejects(host.execute({...i,command:{path:'/redirect'}}),unavailable);assert.equal(hits,n+1)
  })
  for(const phase of ['ATTEMPT','SETTLE'])await t.test(phase+' acknowledgement loss cannot silently repeat provider work',async()=>{
   const i=input(),n=hits;ackLoss=phase;await assert.rejects(host.execute(i),unavailable)
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+(phase==='SETTLE'?1:0))
  })
  await t.test('OUTCOME audit failure in ATTEMPT rolls back before HTTP or credentials',async()=>{
   const i=input(),n=hits,c=credentials;failAuditPhase='ATTEMPT';await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n);assert.equal(credentials,c)
   assert.equal((await host.execute(i)).status,200);assert.equal(hits,n+1)
  })
  await t.test('oversize native bytes and caller cancellation retain an unresolved consumed attempt',async()=>{
   const i=input({path:'/large'}),n=hits;await assert.rejects(host.execute(i),unavailable);await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   const ac=new AbortController(),j=input({path:'/slow'});onSlowRequest=()=>ac.abort();await assert.rejects(host.execute(j,{signal:ac.signal}),unavailable)
   await assert.rejects(host.execute(j),unavailable);assert.equal(hits,n+2)
   const b=await counts();await assert.rejects(host.execute(input(),{signal:ac.signal}),unavailable);assert.deepEqual(await counts(),b)
  })
  await t.test('current native revocation during credentials denies before send',async()=>{
   const n=hits,h=createExternalCallHost({...nativeBase,nativeTransport:native,getHeaders:async()=>{await controlled(()=>owner.query("UPDATE profitia_external_native.policies SET status='REVOKED'"));return {}}})
   await assert.rejects(h.execute(input()),unavailable);assert.equal(hits,n)
   await controlled(()=>owner.query("UPDATE profitia_external_native.policies SET status='ACTIVE'"))
  })
  await t.test('source revocation after HTTP denies publication and replay',async()=>{
   const i=input(),n=hits;onResponse=()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'")
   await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
   await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'");await assert.rejects(host.execute(i),unavailable);assert.equal(hits,n+1)
  })
  await t.test('explicit native policy completes bounded admitted I/O beyond the 30-second descriptor observation',async()=>{
   const r=await host.execute(input({path:'/slow'}));assert.equal(r.status,200);assert.deepEqual(r.bytes,Uint8Array.of(0,255,12))
  })
  await t.test('real native FORCE RLS, column/table ACL drift and immutable policy history',async()=>{
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA profitia_external_native TO ${ROLE}`)
   assert.equal((await runtime.query('SELECT * FROM profitia_external_native.policies')).rowCount,0)
   await assert.rejects(runtime.query('TRUNCATE profitia_external_native.policies'),e=>e.code==='42501')
   await assert.rejects(host.execute(input()),unavailable)
   await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA profitia_external_native FROM ${ROLE};GRANT UPDATE(status) ON profitia_external_native.policies TO ${ROLE}`)
   await assert.rejects(host.execute(input()),unavailable)
   await owner.query(`REVOKE UPDATE(status) ON profitia_external_native.policies FROM ${ROLE}`)
   assert.equal((await controlled(()=>owner.query('DELETE FROM profitia_external_native.policies'))).rowCount,0)
   await assert.rejects(controlled(()=>owner.query('TRUNCATE profitia_external_native.policies')),e=>e.code==='42501')
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_external_native.policies SET maximum_response_bytes=9000")),e=>e.code==='42501')
   const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_native' AND c.relkind='r'")).rows
   assert.equal(rows.length,2);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
  })
  await t.test('a separately admitted credential-free hop cannot receive original provider headers',async()=>{
   const id=randomUUID(),download='synthetic-download'
   await controlled(async()=>{
    await owner.query(`INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) SELECT $1,login_role,source_id,$2,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref FROM profitia_external_call.policies WHERE resource_id=$3`,[id,download,RESOURCE])
    await owner.query(`INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) SELECT $1,1,path_rules,redirect_origins,maximum_response_bytes,'NONE',completion_mode,status,expires_at,source_ref FROM profitia_external_native.policies WHERE policy_id<>$1`,[id])
   })
   const {getHeaders,...withoutCredentials}=nativeBase
   const downloadHost=createExternalCallHost({...withoutCredentials,resourceId:download,nativeTransport:{...native,credentialMode:'NONE'}})
   assert.equal((await downloadHost.execute(input())).status,200);assert.equal(received.at(-1).headers['x-fixture-key'],undefined)
  })
  await t.test('SELECT-only column drift also closes admission despite restrictive read RLS',async()=>{
   await owner.query(`GRANT SELECT(source_ref) ON profitia_external_native.policies TO ${ROLE}`)
   await assert.rejects(host.execute(input()),unavailable)
   await owner.query(`REVOKE SELECT(source_ref) ON profitia_external_native.policies FROM ${ROLE}`)
  })
  await t.test('native expiry and parent version drift deny before I/O',async()=>{
   const n=hits;await controlled(()=>owner.query("UPDATE profitia_external_native.policies SET expires_at=now()-interval '1 second'"));await assert.rejects(host.execute(input()),unavailable)
   await controlled(()=>owner.query("UPDATE profitia_external_native.policies SET expires_at=now()+interval '30 minutes'"))
   await owner.query("UPDATE profitia_external_call.policies SET configuration_version='external-v2'")
   await assert.rejects(host.execute(input()),unavailable);assert.equal(hits,n)
  })
  await t.test('audit and ledger never store raw form, response, headers, keys or caller identity',async()=>{
   const raw=JSON.stringify((await owner.query('SELECT to_jsonb(c) AS row FROM profitia_external_call.calls c')).rows)+JSON.stringify((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows)
   for(const value of ['private-fixture-form','fixture-private-response','never-publish','not-persisted-fixture-credential',...issuedKeys])assert(!raw.includes(value))
   assert((await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows.every(r=>r.event.organisationId===null&&r.event.subjectUserId===null&&r.event.actorKind!=='HUMAN'))
  })
 }finally{await runtime?.end();await owner?.end();await root.end();if(server)await new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})}
})
