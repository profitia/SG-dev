import test from 'node:test';
import assert from 'node:assert/strict';
import {createHumanReportAuthority,compactContext,packResponse,unpackResponse,pgPorts} from '../src/host.mjs';
import {PostgresReportStore} from '../src/store.mjs';
const org='11111111-1111-4111-8111-111111111111';
const context={environment:'development',organisationId:org,decisionId:'test-only-current-E1',actor:{kind:'HUMAN',userId:'test-user',expiresAt:new Date(Date.now()+60000).toISOString()},productEvidence:[]};
test('HTTP returns actual PDF bytes and headers after the E1 boundary, not a structured-cloned Response',async()=>{
 const bytes=Buffer.from('%PDF-CONTROLLED_TEST_ONLY');
 const restored=unpackResponse(await packResponse(new Response(bytes,{headers:{'content-type':'application/pdf','x-report-status':'HUMAN_REVIEW_REQUIRED'}})));
 assert.deepEqual(Buffer.from(await restored.arrayBuffer()),bytes);assert.equal(restored.headers.get('content-type'),'application/pdf');
});
test('HUMAN uses server tenant and same receiving transaction, including final authority rollback',async()=>{
 const queries=[],tx={query:async(sql,values)=>{queries.push([sql,values]);return{rows:[]}}};
 const store=new PostgresReportStore({connect:()=>assert.fail('must use existing E1 transaction')});
 let failed=false;
 const factory=()=>({contract:{id:'test',version:'1'},async execute(input,action){assert.equal(input.organisationId,org);const value=await action(context,tx);if(failed)throw Error('CURRENT_AUTHORITY_REVOKED');return{value}}});
 const execute=createHumanReportAuthority({configuration:{organisationId:org},receiver:{},store,hostFactory:factory});
 const request=new Request('https://dev-sg2.spendguru.app/api/v1/insights/report-jobs',{method:'POST'});
 const run=()=>execute({request,operation:'insights.report.start',resourceId:'oil-asphalt'},async ctx=>{
  assert.equal(ctx.organisationId,org);await store.transaction(org,db=>{assert.equal(db,tx)});
  await assert.rejects(store.transaction('another-tenant',()=>{}),{code:'ORGANISATION_SCOPE_MISMATCH'});
  return Response.json({jobId:'test'})});
 assert.equal((await run()).status,200);failed=true;await assert.rejects(run(),/CURRENT_AUTHORITY_REVOKED/);
 assert(queries.every(([,v])=>v[0]===org));
});
test('transaction driver rolls back on authority failure and commits only a successful result',async()=>{
 const commands=[];const client={async query(sql){commands.push(sql);return{rows:[]}},release(){commands.push('RELEASE')}};
 const ports=pgPorts({query:client.query,connect:async()=>client});
 await assert.rejects(ports.transact(async()=>{throw Error('REVOKED')}));
 assert(commands.includes('ROLLBACK'));assert(!commands.includes('COMMIT'));
 commands.length=0;await ports.transact(async()=>7);assert(commands.includes('COMMIT'));assert(!commands.includes('ROLLBACK'));
});

test('installed product boundary rejects a forged tenant GUC and a revoked ordinary runtime', {skip:!process.env.INSIGHTS_TEST_OWNER_DATABASE_URL},async()=>{
 const {Pool,Client}=await import('pg');const {readFile}=await import('node:fs/promises');const {randomUUID}=await import('node:crypto');
 const {CANON_SHA256}=await import('../../../packages/insights-contracts/index.mjs');
 const u=new URL(process.env.INSIGHTS_TEST_OWNER_DATABASE_URL);
 assert(['localhost','127.0.0.1'].includes(u.hostname));
 assert(['insights_test_owner','tomaszuscinski'].includes(u.username));
 if(u.searchParams.has('host'))assert.equal(u.searchParams.get('host'),'/private/tmp/sg2-oil-runner-pg-20261109');
 const root=new Client({connectionString:u.toString()});await root.connect();
 const name='insights_binding_'+randomUUID().replaceAll('-',''),role='insights_binding_test_runtime';
 let db,pool;
 try{
  for(const [roleName,login] of [['insights_report_owner',false],[role,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[roleName])).rowCount)
    await root.query(`CREATE ROLE ${roleName} ${login?'LOGIN':'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  }
  await root.query(`ALTER ROLE ${role} PASSWORD 'isolated_binding_only'`);
  await root.query('CREATE DATABASE '+name);u.pathname='/'+name;
  db=new Client({connectionString:u.toString()});await db.connect();
  await db.query('GRANT CREATE ON DATABASE '+name+' TO insights_report_owner');
  await db.query('SET ROLE insights_report_owner');
  await db.query(await readFile(new URL('../sql/001-report-editions.sql',import.meta.url),'utf8'));
  await db.query(await readFile(new URL('../sql/002-runtime-binding.sql',import.meta.url),'utf8'));
  const binding={role,databaseName:name,environment:'development',projectId:'TEST_ONLY',branchId:'TEST_ONLY'};
  await db.query("INSERT INTO insights_private.runtime_bindings VALUES($1,$2,$3,'WORKER','ACTIVE',now()+interval '1 hour','TEST_ONLY')",[role,binding,org]);
  await db.query(`GRANT USAGE ON SCHEMA insights_private TO ${role};GRANT EXECUTE ON FUNCTION insights_private.runtime_descriptor(),insights_private.scope_allows(text,uuid,boolean) TO ${role};GRANT SELECT,INSERT,UPDATE ON insights_private.report_jobs TO ${role};GRANT SELECT,INSERT ON insights_private.report_artifacts TO ${role}`);
  const runtimeUrl=new URL(u);runtimeUrl.username=role;runtimeUrl.password='isolated_binding_only';pool=new Pool({connectionString:runtimeUrl.toString(),max:2});
  assert.deepEqual((await pool.query('SELECT insights_private.runtime_descriptor() AS descriptor')).rows[0].descriptor,binding);
  const store=new PostgresReportStore(pool);
  const profile={canonSha256:CANON_SHA256,version:'test',environment:'development',model:'gpt-6.1-sol'};
  const input={definitionId:'oil-asphalt',profileVersion:'test',revision:1,period:{fromDate:'2026-11-03',throughDate:'2026-11-09'},asOf:'2026-11-10T08:00:00Z',allowPartial:false};
  const job=await store.start(compactContext(context),input,profile,'API');assert(job.id);
  assert.equal(await store.get('22222222-2222-4222-8222-222222222222',job.id),null);
  await db.query("UPDATE insights_private.runtime_bindings SET status='REVOKED'");
  assert.equal((await pool.query('SELECT insights_private.runtime_descriptor() AS descriptor')).rows[0].descriptor,null);
  assert.equal(await store.get(org,job.id),null);
 }finally{await pool?.end();await db?.end();await root.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await root.end()}
});


test('bounded model context keeps exact facts and references without full canonical histories',async()=>{
 const {composerEvidence}=await import('../src/composer.mjs');
 const bundle={fingerprint:'test-bundle',evidence:[{id:'raw-eia',provider:'eia',facts:{columns:'large'}},{id:'CI_STOCKS',provider:'eia',facts:{rows:[{value:123,weeklyChange:-7}]}},{id:'TE',provider:'trading-economics',facts:{price:99}}],
  market:{series:[{seriesId:'cl_c1_cl',value:123,history:Array(10000).fill({value:123})}]},forecast:{status:'NOT_AVAILABLE'},asOf:'2026-11-09T12:00:00Z'};
 const projection=composerEvidence(bundle);
 assert.deepEqual(projection.metadata.evidenceIds,['CI_STOCKS','TE']);
 assert.equal(projection.context.evidence[0].facts.rows[0].value,123);
 assert.equal(projection.context.market.series[0].history,undefined);
 assert.equal(bundle.market.series[0].history.length,10000);
 assert.equal(projection.metadata.sourceBundleFingerprint,bundle.fingerprint);
});


test('historical TE observations stay in lineage, and an older weekly delta never becomes the newer snapshot change',async()=>{
 const {buildEvidence}=await import('../src/evidence.mjs');
 const {CANON_SHA256}=await import('../../../packages/insights-contracts/index.mjs');
 const record=(id,date,price,mode)=>({id,provider:'trading-economics',family:'market-observations',availableAt:null,publishedAt:null,retrievedAt:'2026-11-10T09:00:00Z',receiptRef:'CONTROLLED_TEST',licenceRef:'CONTROLLED_TEST',projectionBasisRef:'CONTROLLED_TEST',facts:{symbol:'CL1:COM',label:'CONTROLLED_TEST_NOT_MARKET_DATA',currency:'USD',unit:'BBL',instrumentType:'CFD',quoteBasis:'CLOSE',observationAt:date,price,mode}});
 const projections=[record('h1','2026-11-02T00:00:00Z',100,'historical'),record('h2','2026-11-09T00:00:00Z',110,'historical'),record('s','2026-11-10T00:00:00Z',120,'snapshot')];
 const bundle=buildEvidence({profile:{id:'TEST_ONLY',canonSha256:CANON_SHA256},command:{asOf:'2026-11-10T09:00:00Z',period:{fromDate:'2026-11-03',throughDate:'2026-11-09'}}},[{projection:projections,status:'SUCCEEDED'}],{market:{series:[]}});
 assert.equal(bundle.marketEvidenceHistory.length,3);
 assert.deepEqual(bundle.evidence.filter(e=>e.family==='market-observations').map(e=>e.id),['s']);
 assert.equal(bundle.evidence.find(e=>e.id==='s').facts.weeklyChange,undefined);
 const comparison=bundle.evidence.find(e=>e.id==='TE_WEEKLY_COMPARISON').facts.rows[0];
 assert.equal(comparison.weeklyChange.to,'2026-11-09T00:00:00Z');
 assert(Math.abs(comparison.weeklyChange.percent-10)<1e-9);
});
