// SYNTHETIC_ONLY: real PostgreSQL RLS/trigger regression; no LIVE publication.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import pg from 'pg'
const load=p=>readFileSync(new URL('../sql/'+p,import.meta.url),'utf8')
const hash=x=>createHash('sha256').update(x).digest('hex')
const owner='insights_report_owner',operator='neondb_owner',runtime='publication_fixture_runtime'
const org='11111111-1111-4111-8111-111111111111',otherOrg='22222222-2222-4222-8222-222222222222'
const password='SYNTHETIC_ONLY',job=randomUUID(),otherJob=randomUUID()
test('Publication owner can validate only its selected candidate under FORCE RLS without acquiring content-write or runtime authority',async()=>{
 let container,url=process.env.INSIGHTS_PUBLICATION_FIXTURE_OWNER_URL
 if(!url){
  container=execFileSync('docker',['run','--rm','--detach','--publish','127.0.0.1::5432','--env','POSTGRES_USER=architecture_test_owner','--env','POSTGRES_PASSWORD='+password,'--env','POSTGRES_DB=sg2_operation_test','postgres:16'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try{
   assert.match(container,/^[a-f0-9]{64}$/)
   const address=execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim();assert.match(address,/^127\.0\.0\.1:[0-9]+$/)
   url='postgresql://architecture_test_owner:'+password+'@'+address+'/sg2_operation_test'
   let ready=false
   for(let n=0;n<60;n++){const c=new pg.Client({connectionString:url,connectionTimeoutMillis:500});try{await c.connect();ready=true;break}catch{await new Promise(r=>setTimeout(r,250))}finally{await c.end().catch(()=>{})}}
   assert(ready,'isolated PostgreSQL must be ready')
  }catch(e){execFileSync('docker',['stop',container],{stdio:'ignore'});throw e}
 }
 const parsed=new URL(url);assert.equal(parsed.protocol,'postgresql:');assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.username,'architecture_test_owner');assert.equal(parsed.pathname,'/sg2_operation_test')
 const admin=new pg.Client({connectionString:url});let db,op,run,created=false
 try{
  await admin.connect();assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname='platform_private'")).rowCount,0,'never adopt an existing database')
  for(const role of [owner,operator,runtime]){
   if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await admin.query('CREATE ROLE '+role+(role===owner?' NOLOGIN':" LOGIN PASSWORD '"+password+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
   const r=(await admin.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcreaterole FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   assert.deepEqual(r,{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreaterole:false})
  }
  await admin.query('GRANT '+owner+' TO '+operator)
  await admin.query('CREATE DATABASE platform_private');created=true
  parsed.pathname='/platform_private';db=new pg.Client({connectionString:parsed.href});await db.connect()
  await db.query('CREATE EXTENSION pgcrypto');await db.query('GRANT CREATE ON DATABASE platform_private TO '+owner)
  // Receiver is deliberately closed. The test exercises actual owner policies,
  // actual SQL001-004 and publication validator, not a synthetic E1 approval.
  await db.query('CREATE SCHEMA profitia_e1_receiver')
  await db.query('CREATE FUNCTION profitia_e1_receiver.report_scope(uuid,uuid,boolean) RETURNS boolean LANGUAGE sql AS $$SELECT false$$')
  await db.query('CREATE FUNCTION profitia_e1_receiver.recurring_scope(uuid,uuid,uuid,bigint,text) RETURNS boolean LANGUAGE sql AS $$SELECT false$$')
  await db.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO '+owner+','+runtime)
  await db.query('SET ROLE '+owner)
  await db.query(load('001-report-editions.sql'));await db.query(load('002-runtime-binding.sql'))
  const binding={role:runtime,environment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private'}
  await db.query("INSERT INTO insights_private.runtime_bindings VALUES($1,$2,$3,'WORKER','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[runtime,binding,org])
  await db.query(load('003-report-subscriptions.sql'))
  await db.query("INSERT INTO insights_private.subscription_migrations VALUES('1.0.0',$1)",[hash(load('003-report-subscriptions.sql'))])
  await db.query(load('004-recurring-subscriptions.sql'))
  await db.query("INSERT INTO insights_private.recurring_migrations VALUES('1.0.0',$1)",[hash(load('004-recurring-subscriptions.sql'))])
  await db.query('GRANT USAGE ON SCHEMA insights_private TO '+runtime)
  await db.query('GRANT SELECT,INSERT,UPDATE ON insights_private.report_jobs TO '+runtime)
  await db.query('GRANT SELECT,INSERT ON insights_private.report_artifacts TO '+runtime)
  await db.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA insights_private TO '+runtime)
  await db.query('RESET ROLE')
  const period={fromDate:'2026-11-03',throughDate:'2026-11-09'},asOf='2026-11-10T17:26:40.463Z'
  for(const [id,organisation] of [[job,org],[otherJob,otherOrg]]){
   const document={id,organisationId:organisation,status:'AWAITING_REVIEW',editionId:id,asOf,command:{definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',period,asOf}}
   await db.query("INSERT INTO insights_private.report_jobs(id,organisation_id,business_key,definition_id,period_start,period_end,revision,status,document) VALUES($1,$2,$3,'oil-asphalt','2026-11-03','2026-11-09',1,'AWAITING_REVIEW',$4)",[id,organisation,hash(id),document])
   for(const kind of ['pdf','markdown']){const bytes=Buffer.from('SYNTHETIC_ONLY_'+kind);await db.query('INSERT INTO insights_private.report_artifacts VALUES($1,$2,$3,$4,$5)',[id,organisation,kind,hash(bytes),bytes])}
  }
  const connect=async role=>{const u=new URL(parsed);u.username=role;u.password=password;const c=new pg.Client({connectionString:u.href});await c.connect();return c}
  op=await connect(operator);run=await connect(runtime)
  const transaction=async(c,action,{role=false,organisation=org,selected=job}={})=>{
   await c.query('BEGIN')
   try{if(role)await c.query('SET LOCAL ROLE '+owner);await c.query("SELECT set_config('insights.organisation_id',$1,true),set_config('insights.publication_job_id',$2,true)",[organisation,selected]);const v=await action(c);await c.query('COMMIT');return v}catch(e){await c.query('ROLLBACK');throw e}
  }
  assert.equal((await transaction(op,c=>c.query('SELECT id FROM insights_private.report_jobs'),{role:true})).rowCount,0,'reproduces the original legitimate-owner read denial')
  const baseline=(await db.query("SELECT c.relname,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='insights_private' ORDER BY c.relname")).rows
  const sql=load('006-publication-owner-read.sql')
  await db.query('BEGIN');await db.query('SET LOCAL ROLE '+owner)
  await db.query(sql.replaceAll('__PUBLICATION_OWNER_READ_SCHEMA_DIGEST__',hash(sql)));await db.query('COMMIT')
  assert.deepEqual((await db.query("SELECT c.relname,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='insights_private' ORDER BY c.relname")).rows,baseline,'no schema/table grants change')
  assert.equal((await transaction(op,c=>c.query('SELECT id FROM insights_private.report_jobs'),{role:true})).rowCount,1,'only the selected org/job is readable')
  assert.equal((await transaction(op,c=>c.query('SELECT job_id FROM insights_private.report_artifacts'),{role:true})).rowCount,2)
  assert.equal((await transaction(op,c=>c.query('SELECT id FROM insights_private.report_jobs'),{role:true,selected:''})).rowCount,0)
  assert.equal((await transaction(op,c=>c.query('SELECT id FROM insights_private.report_jobs'),{role:true,organisation:otherOrg})).rowCount,0,'org and selected job must both match')
  await assert.rejects(()=>transaction(op,c=>c.query('SELECT id FROM insights_private.report_jobs')),e=>e.code==='42501','operator must actually assume the domain owner')
  await assert.rejects(()=>transaction(op,c=>c.query('UPDATE insights_private.report_jobs SET version=version+1 RETURNING id'),{role:true}),e=>e.code==='42501','FOR SHARE visibility must not admit a content update')
  const publish=(c,pdf=hash(Buffer.from('SYNTHETIC_ONLY_pdf')))=>c.query("INSERT INTO insights_private.published_editions(producer_job_id,organisation_id,edition_id,definition_id,profile_version,title,period,as_of,published_at,approval_ref,pdf_sha256,markdown_sha256) VALUES($1::uuid,$2,$1::uuid::text,'oil-asphalt','SYNTHETIC_ONLY','SYNTHETIC TEST ONLY',$3,$4,now(),'SYNTHETIC_ONLY_NOT_A_LIVE_REVIEW',$5,$6) RETURNING producer_job_id",[job,org,period,asOf,pdf,hash(Buffer.from('SYNTHETIC_ONLY_markdown'))])
  await assert.rejects(()=>transaction(op,c=>publish(c,'0'.repeat(64)),{role:true}),e=>e.code==='42501','the actual publication validator still rejects different artifact hashes')
  assert.equal((await transaction(op,c=>publish(c),{role:true})).rowCount,1,'actual original publication trigger acquires its FOR SHARE lock and validates both artifacts')
  await assert.rejects(()=>transaction(op,c=>c.query("UPDATE insights_private.published_editions SET title='CHANGED'"),{role:true}),e=>e.code==='42501','published edition remains immutable')
  assert.equal((await transaction(run,c=>c.query('SELECT id FROM insights_private.report_jobs'))).rowCount,1,'the existing admitted WORKER path still works')
  assert.equal((await transaction(run,c=>c.query('UPDATE insights_private.report_jobs SET version=version+1 RETURNING id'))).rowCount,1)
  await db.query('SET ROLE '+owner);await db.query("UPDATE insights_private.runtime_bindings SET status='REVOKED' WHERE login_role=$1",[runtime]);await db.query('RESET ROLE')
  assert.equal((await transaction(run,c=>c.query('SELECT id FROM insights_private.report_jobs'))).rowCount,0,'runtime cannot gain owner publication authority by spoofing the selected-job GUC')
  assert.equal((await db.query('SELECT count(*)::int AS count FROM insights_private.published_editions')).rows[0].count,1)
 }finally{
  try{await op?.end();await run?.end();await db?.end();if(created)await admin.query('DROP DATABASE platform_private WITH (FORCE)')}finally{await admin.end().catch(()=>{});if(container)execFileSync('docker',['stop',container],{stdio:'ignore'})}
 }
})
