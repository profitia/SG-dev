import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {createFinderSourceTransport,finderSourcePolicy} from '../lib/benchmark/discovery-source.ts'
import {runWithBenchmarkProviderScope} from '../lib/benchmark/provider-scope.ts'
const {Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg'),{PrismaClient}=createRequire(import.meta.url)('@prisma/client')
const hash=v=>createHash('sha256').update(v).digest('hex'),source=n=>fs.readFileSync(new URL('../migrations/access/'+n,import.meta.resolve('@profitia/platform-contracts/platform-ingestion')),'utf8')
const DATABASE='sg2_finder_unmetered_'+randomUUID().replaceAll('-',''),ROLE='sg2_finder_unmetered_fixture'
const rootSql=source('008-platform-ingestion.sql'),callSql=source('009-external-call-admission.sql'),nativeSql=source('012-native-external-transport.sql')
const credentials={macrobondClientId:'fixture-client',macrobondClientSecret:'fixture-secret-not-a-real-credential',openAiKey:'fixture-ai-value',openAiModel:'fixture-model'}
const unavailable=e=>e instanceof Error&&e.name==='ExternalCallUnavailable'&&e.retryAllowed===false

test('Finder UNMETERED uses actual E1 Source, local provider, audited counters, revocable leases and provider 429',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,prisma,auditPrisma,server,created=false,mode='NORMAL',hits=0,hook=null,clock=Date.now(),clockAnchor=Date.now(),retryAfter='120'
 const observed=[]
 try{
  server=http.createServer(async(req,res)=>{
   hits++;let body='';for await(const p of req)body+=p
   observed.push({url:req.url,method:req.method,authorization:req.headers.authorization,body})
   const action=hook;hook=null;if(action)await action()
   if(mode==='DISCONNECT'){req.socket.destroy();return}
   if(mode==='REDIRECT'){res.statusCode=302;res.setHeader('location','https://another.invalid/private');res.end();return}
   if(mode==='RATE_TOKEN'&&req.url==='/mbauth/connect/token'||mode==='RATE_API'&&req.url!=='/mbauth/connect/token'){res.statusCode=429;res.setHeader('retry-after',retryAfter);res.end('{}');return}
   res.setHeader('content-type','application/json')
   if(req.url==='/mbauth/connect/token')res.end(JSON.stringify({access_token:'fixture-returned-access',expires_in:3600}))
   else if(req.url==='/v1/responses'){
    const intent={concept:'PRIVATE_FIXTURE_AI_RESPONSE',searchTerms:['steel'],region:null,market:null,instrumentType:null,currency:null,frequency:null,useCase:null,industryContext:null,interpretation:'Requires clarification',confidence:0.1}
    res.end(JSON.stringify({id:'resp_fixture',object:'response',created_at:Math.floor(Date.now()/1000),model:credentials.openAiModel,status:'completed',output:[{id:'msg_fixture',type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:JSON.stringify(intent),annotations:[]}]}]}))
   }
   else if(req.url.startsWith('/v1/search/'))res.end(JSON.stringify({results:[{Name:'fixture_series',Title:'Fixture series'}]}))
   else if(req.url.startsWith('/v1/metadata/getattributeinformation'))res.end(JSON.stringify([{description:'Original fixture metadata',canListValues:true,appliesTo:['TimeSeries']}]))
   else res.end(JSON.stringify([{metadata:{Title:'PRIVATE_FIXTURE_MARKET_RESPONSE'}}]))
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const origin='http://127.0.0.1:'+server.address().port
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0);await root.query(`CREATE DATABASE ${DATABASE}`);created=true
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const[role,login]of[['profitia_ingestion_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner');try{const v=await action();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   await owner.query(rootSql);await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-finder-source','isolated-finder-branch',$2)",[hash(rootSql),DATABASE])
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-benchmark-source','PLATFORM_INTERNAL','synthetic-finder','source-v1','REVOKED','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   await owner.query(callSql);await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','isolated-finder-source','isolated-finder-branch',$3)",[hash(callSql),hash(rootSql),DATABASE])
   await owner.query(nativeSql);await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(nativeSql)])
   await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(source('024-unmetered-public-sources.sql'))]);await owner.query(source('024-unmetered-public-sources.sql'));
   await owner.query("SELECT set_config('profitia.install.source_continuity_digest',$1,true)",[hash(source('035-source-technical-continuity.sql'))]);await owner.query(source('035-source-technical-continuity.sql'));
   for(const provider of ['MACROBOND_TOKEN','MACROBOND_API','OPENAI']){
    const p=finderSourcePolicy(provider),policy=randomUUID()
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(p.source))
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,p.source.id])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-benchmark-source',$2,'SOURCE_TRANSACTION',2000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),p.source.id])
    await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'finder-http-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,65536,4000000,20000,'UPSTREAM_ATTEMPT_ADMISSION',1000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[policy,ROLE,p.source.id,p.resourceId,origin,JSON.stringify(p.basePathRules)])
    if(provider==='MACROBOND_TOKEN')await owner.query('UPDATE profitia_external_call.policies SET capacity=50 WHERE policy_id=$1',[policy])
    await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,$4,$2::jsonb,'[]'::jsonb,4000000,$3,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[policy,JSON.stringify(p.pathRules),p.credentialMode,provider==='MACROBOND_TOKEN'?2:1])
   }
   await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE' WHERE login_role=$1",[ROLE]);
   await owner.query(`GRANT EXECUTE ON FUNCTION profitia_ingestion.maintain_source_technical_access(text) TO ${ROLE}`);
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text) TO ${ROLE}`)
  })
  const runtimeUrl=new URL(url);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only';runtimeUrl.searchParams.set('connection_limit','2')
  prisma=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}});auditPrisma=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}})
  const base={prisma,auditPrisma,application:{appId:'spendguru-benchmark-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-finder',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'spendguru-benchmark-source',environment:'development',projectId:'isolated-finder-source',branchId:'isolated-finder-branch',databaseName:DATABASE,role:ROLE,schemaDigest:hash(rootSql),unmeteredSchemaDigest:hash(source('024-unmetered-public-sources.sql')),deploymentId:'synthetic-finder',configurationVersion:'source-v1'},external:{configurationVersion:'finder-http-v1',schemaDigest:hash(callSql),nativeSchemaDigest:hash(nativeSql)},credentials,syntheticOrigin:origin}
  const create=(operationKey,legacy=false)=>createFinderSourceTransport({...base,binding:{...base.binding,...(legacy?{}:{requiredQuotaMode:'UNMETERED'})},now:()=>clock+Date.now()-clockAnchor,operationKey:operationKey??randomBytes(32).toString('hex')})
  const token=t=>t.macrobond('https://apiauth.macrobondfinancial.com/mbauth/connect/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.macrobondClientId,client_secret:credentials.macrobondClientSecret})})
  const api=t=>t.macrobond('https://api.macrobondfinancial.com/v1/series/fetchentities',{method:'POST',headers:{authorization:'Bearer fixture-returned-access','content-type':'application/json'},body:JSON.stringify([{name:'PRIVATE_FIXTURE_QUERY'}])})
  const ai=t=>t.openai('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+credentials.openAiKey,'content-type':'application/json','x-stainless-runtime':'node'},body:JSON.stringify({model:credentials.openAiModel,store:false,input:'PRIVATE_FIXTURE_AI_PROMPT'})})
  clock=Date.parse((await owner.query('SELECT clock_timestamp() value')).rows[0].value);clockAnchor=Date.now()
  await t.test('controlled owner activation preserves an exhausted 50-token policy and all earlier accounting',async()=>{
   const untouched=hits;await assert.rejects(token(create()),unavailable);assert.equal(hits,untouched);
   for(let i=0;i<50;i++)assert.equal((await token(create(undefined,true))).status,200);const beforeHits=hits;await assert.rejects(token(create(undefined,true)),unavailable);assert.equal(hits,beforeHits);
   const counts=async()=>(await owner.query("SELECT source_id,admitted_count::text n FROM profitia_external_call.policies WHERE status='ACTIVE' ORDER BY source_id")).rows;const before=await counts();
   await controlled(async()=>{const ids=['sg2.provider.macrobond_token','sg2.provider.macrobond_api'];const rows=(await owner.query('SELECT profitia_ingestion.continuity_controls($1,$2,$3) value',[ROLE,'spendguru-benchmark-source',ids])).rows[0].value;const version=(await owner.query('SELECT version FROM profitia_ingestion.runtime_bindings WHERE login_role=$1',[ROLE])).rows[0].version;
    assert.equal((await owner.query('SELECT profitia_ingestion.activate_unmetered_sources($1,$2,$3,$4,$5,$6) value',[ROLE,'spendguru-benchmark-source',ids,'owner-decision:sha256:'+'a'.repeat(64),Object.fromEntries(rows.map(r=>[r.id,String(r.definition.version)])),version])).rows[0].value.status,'ACTIVATED');});
   assert.deepEqual(await counts(),before);assert.equal(before.find(p=>p.source_id==='sg2.provider.macrobond_token').n,'50');
  })
  await t.test('renewal keeps both Macrobond sources usable beyond the old technical deadline',async()=>{
   const result=(await prisma.$queryRawUnsafe('SELECT profitia_ingestion.maintain_source_technical_access($1) AS value',hash(source('035-source-technical-continuity.sql'))))[0].value
   assert.equal(result.status,'RENEWED');assert.ok(Date.parse(result.leaseUntil)>Date.parse('2026-11-19T00:00:00Z'))
   if(process.env.FINDER_TEST_CLOCK_FILE){
    const path=process.env.FINDER_TEST_CLOCK_FILE;assert.match(path,/^\/tmp\/finder-unmetered-clock/)
    fs.writeFileSync(path+'.next','@2026-11-19 00:00:01\n');fs.renameSync(path+'.next',path)
    clock=Date.parse((await owner.query('SELECT clock_timestamp() value')).rows[0].value)
    assert.ok(clock>=Date.parse('2026-11-19T00:00:01Z'));assert.ok(clock<Date.parse('2026-11-19T00:10:00Z'))
   }
   clock=Date.parse((await owner.query('SELECT clock_timestamp() value')).rows[0].value);clockAnchor=Date.now()
   const transport=create();assert.equal((await token(transport)).status,200);assert.equal((await api(transport)).status,200)
  })
  await t.test('real ordinary Source transactions cross 50 token attempts and 1000 API attempts against the local simulated provider',async()=>{
   for(let i=0;i<51;i++)assert.equal((await token(create())).status,200)
   for(let batch=0;batch<5;batch++){const transport=create();await token(transport);for(let i=0;i<201;i++)assert.equal((await api(transport)).status,200)}
   const counts=(await owner.query("SELECT source_id,quota_mode,capacity,admitted_count::text n FROM profitia_external_call.policies WHERE status='ACTIVE' ORDER BY source_id")).rows
   const tokenPolicy=counts.find(p=>p.source_id==='sg2.provider.macrobond_token'),apiPolicy=counts.find(p=>p.source_id==='sg2.provider.macrobond_api'),openAi=counts.find(p=>p.source_id==='sg2.provider.openai')
   assert.equal(tokenPolicy.quota_mode,'UNMETERED');assert.ok(Number(tokenPolicy.n)>50);assert.equal(tokenPolicy.capacity,null)
   assert.equal(apiPolicy.quota_mode,'UNMETERED');assert.ok(Number(apiPolicy.n)>1000);assert.equal(apiPolicy.capacity,null)
   assert.equal(openAi.quota_mode,'METERED');assert.equal(openAi.n,'0');assert.equal(openAi.capacity,1000)
   const budgets=(await owner.query("SELECT source_id,quota_mode,capacity,consumed_count::text n FROM profitia_ingestion.budgets WHERE source_id LIKE 'sg2.provider.macrobond_%'")).rows
   assert.equal(budgets.length,2);assert.ok(budgets.every(p=>p.quota_mode==='UNMETERED'&&p.capacity===null&&Number(p.n)>0));assert.ok(Number(budgets.find(p=>p.source_id.endsWith('_api')).n)>1000)
  })
  await t.test('provider 429 and Retry-After preserve their meaning for token and API; no hidden retry occurs',async()=>{
   process.env.MACROBOND_CLIENT_ID=credentials.macrobondClientId;process.env.MACROBOND_CLIENT_SECRET=credentials.macrobondClientSecret
   const client=await import('../lib/benchmark/macrobond.ts')
   for(const status of ['RATE_TOKEN','RATE_API'])for(const value of ['120','Thu, 19 Nov 2026 01:00:00 GMT']){
    mode=status;retryAfter=value;const before=hits,transport=create()
    await assert.rejects(runWithBenchmarkProviderScope({...transport,loadMetadataClient:async()=>assert.fail('No metadata SQL fallback')},()=>client.fetchMacrobondEntityMetadata('fixture_series')),e=>e.code==='RATE_LIMITED'&&e.status===429&&e.retryAfter===value)
    assert.equal(hits-before,status==='RATE_TOKEN'?1:2)
   }
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_external_call.calls WHERE status='RESPONSE' AND http_status=429")).rows[0].n,4)
   mode='NORMAL'
   const {discoveryFailure}=await import('../lib/benchmark/discovery-api.ts'),response=discoveryFailure(429,'RATE_LIMITED','Macrobond rate limit exceeded.','120')
   assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'120');assert.equal(response.headers.get('cache-control'),'private, no-store')
  })
 }finally{
  if(prisma)await prisma.$disconnect();if(auditPrisma)await auditPrisma.$disconnect();if(owner)await owner.end()
  if(server)await new Promise(resolve=>server.close(resolve));if(created)await root.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH(FORCE)`);await root.end()
 }
})
