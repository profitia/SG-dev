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
const hash=v=>createHash('sha256').update(v).digest('hex'),source=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const DATABASE='sg2_finder_source_'+randomUUID().replaceAll('-',''),ROLE='sg2_finder_source_fixture'
const rootSql=source('008-platform-ingestion.sql'),callSql=source('009-external-call-admission.sql'),nativeSql=source('012-native-external-transport.sql')
const credentials={macrobondClientId:'fixture-client',macrobondClientSecret:'fixture-secret-not-a-real-credential',openAiKey:'fixture-ai-value',openAiModel:'fixture-model'}
const unavailable=e=>e instanceof Error&&e.name==='ExternalCallUnavailable'&&e.retryAllowed===false

test('actual Finder provider sends use the sole native Source engine, ordinary SQL, per-attempt budget and protected HMAC records',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,prisma,auditPrisma,server,created=false,mode='NORMAL',hits=0,hook=null
 const observed=[]
 try{
  server=http.createServer(async(req,res)=>{
   hits++;let body='';for await(const p of req)body+=p
   observed.push({url:req.url,method:req.method,authorization:req.headers.authorization,body})
   const action=hook;hook=null;if(action)await action()
   if(mode==='DISCONNECT'){req.socket.destroy();return}
   if(mode==='REDIRECT'){res.statusCode=302;res.setHeader('location','https://another.invalid/private');res.end();return}
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
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-benchmark-source','PLATFORM_INTERNAL','synthetic-finder','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   await owner.query(callSql);await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','isolated-finder-source','isolated-finder-branch',$3)",[hash(callSql),hash(rootSql),DATABASE])
   await owner.query(nativeSql);await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(nativeSql)])
   for(const provider of ['MACROBOND_TOKEN','MACROBOND_API','OPENAI']){
    const p=finderSourcePolicy(provider),policy=randomUUID()
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(p.source))
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,p.source.id])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-benchmark-source',$2,'SOURCE_TRANSACTION',2000,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),p.source.id])
    await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'finder-http-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,65536,4000000,20000,'UPSTREAM_ATTEMPT_ADMISSION',300,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[policy,ROLE,p.source.id,p.resourceId,origin,JSON.stringify(p.basePathRules)])
    if(provider==='MACROBOND_TOKEN')await owner.query('UPDATE profitia_external_call.policies SET capacity=5 WHERE policy_id=$1',[policy])
    await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,$4,$2::jsonb,'[]'::jsonb,4000000,$3,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[policy,JSON.stringify(p.pathRules),p.credentialMode,provider==='MACROBOND_TOKEN'?2:1])
   }
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text) TO ${ROLE}`)
  })
  const runtimeUrl=new URL(url);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only';runtimeUrl.searchParams.set('connection_limit','2')
  prisma=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}});auditPrisma=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}})
  const base={prisma,auditPrisma,application:{appId:'spendguru-benchmark-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-finder',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'spendguru-benchmark-source',environment:'development',projectId:'isolated-finder-source',branchId:'isolated-finder-branch',databaseName:DATABASE,role:ROLE,schemaDigest:hash(rootSql),deploymentId:'synthetic-finder',configurationVersion:'source-v1'},external:{configurationVersion:'finder-http-v1',schemaDigest:hash(callSql),nativeSchemaDigest:hash(nativeSql)},credentials,syntheticOrigin:origin}
  const create=operationKey=>createFinderSourceTransport({...base,operationKey:operationKey??randomBytes(32).toString('hex')})
  const token=t=>t.macrobond('https://apiauth.macrobondfinancial.com/mbauth/connect/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.macrobondClientId,client_secret:credentials.macrobondClientSecret})})
  const api=t=>t.macrobond('https://api.macrobondfinancial.com/v1/series/fetchentities',{method:'POST',headers:{authorization:'Bearer fixture-returned-access','content-type':'application/json'},body:JSON.stringify([{name:'PRIVATE_FIXTURE_QUERY'}])})
  const ai=t=>t.openai('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+credentials.openAiKey,'content-type':'application/json','x-stainless-runtime':'node'},body:JSON.stringify({model:credentials.openAiModel,store:false,input:'PRIVATE_FIXTURE_AI_PROMPT'})})
  await t.test('OAuth, API and AI have three independently admitted, settled real HTTP effects',async()=>{
   const transport=create();assert.equal((await token(transport)).status,200);assert.equal((await api(transport)).status,200);assert.equal((await ai(transport)).status,200)
   assert.equal(hits,3);assert.equal(observed[0].authorization,undefined);assert.equal(observed[1].authorization,'Bearer fixture-returned-access');assert.equal(observed[2].authorization,'Bearer '+credentials.openAiKey)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls WHERE status=\'RESPONSE\'')).rows[0].n,3)
   const records=(await owner.query("SELECT jsonb_build_object('calls',(SELECT jsonb_agg(to_jsonb(c)) FROM profitia_external_call.calls c),'audit',(SELECT jsonb_agg(to_jsonb(e)) FROM profitia_ingestion.security_events e))::text AS text")).rows[0].text
   for(const value of [credentials.macrobondClientSecret,credentials.openAiKey,'fixture-returned-access','PRIVATE_FIXTURE_QUERY','PRIVATE_FIXTURE_AI_PROMPT','PRIVATE_FIXTURE_AI_RESPONSE','PRIVATE_FIXTURE_MARKET_RESPONSE'])assert.equal(records.includes(value),false,value)
  })
  await t.test('the original Macrobond client and its concurrent metadata cache use these actual admitted native ports',async()=>{
   process.env.MACROBOND_CLIENT_ID=credentials.macrobondClientId;process.env.MACROBOND_CLIENT_SECRET=credentials.macrobondClientSecret;process.env.OPENAI_API_KEY=credentials.openAiKey;process.env.OPENAI_MODEL=credentials.openAiModel
   const client=await import('../lib/benchmark/macrobond.ts'),transport=create(),before=hits
   await runWithBenchmarkProviderScope({...transport,loadMetadataClient:async()=>assert.fail('Direct provider metadata fixture has no SQL metadata fallback')},async()=>{
    const rows=await client.getMacrobondMetadataDefinitions();assert.equal(rows.length,13)
    assert.deepEqual(await client.getMacrobondMetadataDefinitions(),rows)
    const items=await client.searchMacrobondBenchmarks({query:'fixture series',limit:8})
    assert.equal(items[0].providerSeries.providerSeriesId,'fixture_series')
    assert.equal(observed.slice(before).some(r=>r.url==='/v1/series/fetchentities'),true)
    assert.equal(observed.slice(before).some(r=>r.url==='/v1/series/fetchseries'),false)
   });assert.equal(hits-before,16)
  })
  await t.test('the original AI SDK uses the admitted Responses port with fixed model, no retained input and no hidden retry',async()=>{
   const {runBenchmarkAiSearch}=await import('../lib/benchmark/ai-search.ts'),transport=create(),before=hits
   await assert.rejects(runWithBenchmarkProviderScope({...transport,loadMetadataClient:async()=>assert.fail('Clarification must not read metadata')},()=>runBenchmarkAiSearch('PRIVATE_FIXTURE_AI_PROMPT')),e=>e instanceof Error&&e.code==='AI_NEEDS_CLARIFICATION')
   assert.equal(hits-before,1);const body=JSON.parse(observed.at(-1).body);assert.equal(body.model,credentials.openAiModel);assert.equal(body.store,false)
  })
  await t.test('reconstructing the same logical operation cannot send an already settled exchange again',async()=>{
   const key=randomBytes(32).toString('hex');await token(create(key));const before=hits;await assert.rejects(token(create(key)),unavailable);assert.equal(hits,before)
  })
  await t.test('failed or uncertain upstream exchange cannot be retried after reconstruction',async()=>{
   mode='DISCONNECT';const key=randomBytes(32).toString('hex'),before=hits;await assert.rejects(token(create(key)),unavailable);assert.equal(hits,before+1);mode='NORMAL'
   await assert.rejects(token(create(key)),unavailable);assert.equal(hits,before+1)
  })
  await t.test('missing Source audit or exhausted provider budget prevents HTTP',async()=>{
   const before=hits;await controlled(()=>owner.query(`REVOKE EXECUTE ON FUNCTION profitia_ingestion.append_audit(jsonb) FROM ${ROLE}`));await assert.rejects(token(create()),unavailable);assert.equal(hits,before)
   await controlled(()=>owner.query(`GRANT EXECUTE ON FUNCTION profitia_ingestion.append_audit(jsonb) TO ${ROLE}`))
   // Spend the last real fixture admission; never rewrite an immutable
   // accepted native policy just to simulate exhaustion.
   await token(create());const exhaustedAt=hits;assert.equal(exhaustedAt,before+1)
   const policy=(await owner.query('SELECT capacity,admitted_count FROM profitia_external_call.policies WHERE source_id=$1',[finderSourcePolicy('MACROBOND_TOKEN').source.id])).rows[0];assert.equal(policy.admitted_count,policy.capacity)
   await assert.rejects(token(create()),unavailable);assert.equal(hits,exhaustedAt)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET capacity=consumed_count WHERE source_id=$1",[finderSourcePolicy('OPENAI').source.id]));await assert.rejects(ai(create()),unavailable);assert.equal(hits,exhaustedAt)
   await controlled(()=>owner.query("UPDATE profitia_ingestion.budgets SET capacity=2000 WHERE source_id=$1",[finderSourcePolicy('OPENAI').source.id]))
  })
  await t.test('the original AI error wrapper cannot hide uncertain HTTP, follow redirects or invoke SDK retries',async()=>{
   const {runBenchmarkAiSearch}=await import('../lib/benchmark/ai-search.ts')
   for(const fixtureMode of ['DISCONNECT','REDIRECT']){
    mode=fixtureMode;const before=hits,transport=create()
    await assert.rejects(runWithBenchmarkProviderScope({...transport,loadMetadataClient:async()=>assert.fail('No SQL metadata fallback')},()=>runBenchmarkAiSearch('PRIVATE_FIXTURE_AI_PROMPT')),unavailable)
    assert.equal(hits,before+1)
   }mode='NORMAL'
  })
  await t.test('revocation while HTTP is in flight withholds the response instead of treating the old admission as publication authority',async()=>{
   hook=()=>controlled(()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[finderSourcePolicy('OPENAI').source.id]))
   const before=hits;await assert.rejects(ai(create()),unavailable);assert.equal(hits,before+1)
  })
 }finally{
  if(prisma)await prisma.$disconnect();if(auditPrisma)await auditPrisma.$disconnect();if(server)await new Promise(resolve=>server.close(resolve));if(owner)await owner.end();if(created)await root.query(`DROP DATABASE ${DATABASE} WITH(FORCE)`);await root.end()
 }
})
