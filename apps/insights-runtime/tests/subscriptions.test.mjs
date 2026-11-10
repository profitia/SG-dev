import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash,randomUUID} from 'node:crypto';
import {currentE1Fixture,U,V,A} from '../../../packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs';
import {parseSubscription,SUBSCRIPTION_CONTRACT,installedReportProfiles,nextReportOccurrence} from '../src/subscriptions.mjs';
import {createHumanReportAuthority} from '../src/host.mjs';import {PostgresReportStore} from '../src/store.mjs';
import {PostgresSubscriptionStore} from '../src/subscription-store.mjs';import {createSubscriptionApi} from '../src/subscription-api.mjs';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const profile={definitionId:'oil-asphalt',profileVersion:'oil-v05-autonomous-1',availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT']};
const input={contractVersion:SUBSCRIPTION_CONTRACT,name:'SYNTHETIC_ONLY',definitionId:profile.definitionId,profileVersion:profile.profileVersion,subjectRef:null,schedule:{frequency:'WEEKLY',weekday:2,localTime:'08:00',timeZone:'Europe/Warsaw',startDate:'2026-11-10',endDate:null},notifications:{assistant:true,email:false}};
test('subscription input preserves ownership boundaries and only admitted cadence/channels/profiles',()=>{
 assert.equal(parseSubscription(input,profile).schedule.frequency,'WEEKLY');
 for(const v of [{...input,ownerUserId:U},{...input,notifications:{assistant:true,email:true}},{...input,schedule:{...input.schedule,endDate:'2026-01-01'}},{...input,definitionId:'FICTIONAL_MARKET'}])assert.throws(()=>parseSubscription(v,profile));
 assert.equal(nextReportOccurrence(input.schedule,'2026-11-10T06:00:00Z').at,'2026-11-10T07:00:00.000Z');
 assert.equal(nextReportOccurrence({...input.schedule,endDate:'2026-11-10'},'2026-11-10T07:00:00Z'),null);
 assert.deepEqual(installedReportProfiles({environment:'development',enabled:false,definitions:[],profiles:{}}),[]);
});
test('SYNTHETIC_ONLY: report orders use current E1, private SQL, immutable history and an actual queued producer job',async t=>{
 const f=await currentE1Fixture(),original=globalThis.fetch;globalThis.fetch=f.transport;t.after(async()=>{globalThis.fetch=original;await f.close()});
 await f.asOwner(0,async q=>{
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql'));
  await q.query("UPDATE profitia_e1_authority.receivers SET resource_id='insights-reports' WHERE application_id=$1",[f.apps[1]]);
  await q.query("UPDATE profitia_access.product_grants SET features=ARRAY['personal_workspace','market','benchmark'] WHERE application_id IN($1,'spendguru')",[f.apps[1]]);
  for(const user of[U,V])for(const op of ['start','status','list','download'])await q.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW',$5,'market')",[randomUUID(),f.apps[1],A,user,'insights.report.'+op]);
 });
 // PostgreSQL roles belong to the cluster, so the preserved host fixture can
 // already have installed this same non-login owner in another test database.
 await f.databases[1].query("DO $fixture$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='insights_report_owner') THEN CREATE ROLE insights_report_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $fixture$");
 assert.deepEqual((await f.databases[1].query("SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='insights_report_owner'")).rows[0],{rolcanlogin:false,rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false});
 await f.databases[1].query('GRANT CREATE ON DATABASE '+f.bindings[1].databaseName+' TO insights_report_owner');
 await f.asOwner(1,async q=>{
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql'));
  await q.query("UPDATE profitia_e1_receiver.installation SET resource_id='insights-reports'");
  await q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO insights_report_owner');
  await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_receiver.report_scope(uuid,uuid,boolean) TO insights_report_owner,'+f.bindings[1].role);
 });
 // The predecessor migration has its own BEGIN/COMMIT; execute it unchanged.
 await f.databases[1].query('SET ROLE insights_report_owner');
 try{await f.databases[1].query(load('../sql/001-report-editions.sql'));}finally{await f.databases[1].query('RESET ROLE');}
 await f.asOwner(1,async q=>{
  await q.query(load('../sql/002-runtime-binding.sql'));
  await q.query("INSERT INTO insights_private.runtime_bindings(login_role,binding,organisation_id,mode,status,expires_at,source_ref) VALUES($1,$2::jsonb,$3,'RECEIVER','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[f.bindings[1].role,JSON.stringify(f.bindings[1]),A]);
  await q.query('GRANT USAGE ON SCHEMA insights_private TO '+f.bindings[1].role);
  await q.query('GRANT EXECUTE ON FUNCTION insights_private.runtime_descriptor(),insights_private.scope_allows(text,uuid,boolean) TO '+f.bindings[1].role);
  await q.query('GRANT SELECT,INSERT,UPDATE ON insights_private.report_jobs TO '+f.bindings[1].role);
  await q.query('GRANT SELECT ON insights_private.report_artifacts TO '+f.bindings[1].role);
  const sql=load('../sql/003-report-subscriptions.sql');await q.query(sql);await q.query("INSERT INTO insights_private.subscription_migrations VALUES('1.0.0',$1)",[createHash('sha256').update(sql).digest('hex')]);
 },'insights_report_owner');
 const db=f.db(1),store=new PostgresReportStore(f.pools[1]);
 const authority={execute:createHumanReportAuthority({configuration:{organisationId:A,receiverBinding:f.bindings[1],receiverApplication:{...f.application(1),features:['market'],operations:['insights.report.start','insights.report.status','insights.report.list','insights.report.download']}},receiver:{independentQuery:db.query,transact:db.transact},store})};
 const subscriptions=new PostgresSubscriptionStore(store);let producerCalls=0;
 const producerInput=JSON.parse(load('./fixtures/offline-report.json')).command;
 const producerProfile=JSON.parse(load('../config/development.example.json')).profiles[profile.profileVersion];
 const api=createSubscriptionApi({authority,store:subscriptions,profiles:()=>[profile],onOrder:async(ctx,order)=>{producerCalls++;return store.start(ctx,{...producerInput,profileVersion:order.profileVersion},producerProfile,'API')}});
 const req=(suffix='',{method='GET',body,token='SYNTHETIC_A',key='SYNTHETIC-ORDER-1'}={})=>new Request(f.origin+'/api/v1/insights/subscriptions'+suffix,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json','idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined});
 const response=await api(req('',{method:'POST',body:input}));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));const order=await response.json();assert.equal(order.ownerUserId,U);assert.equal(order.executionState,'WAITING_AUTHORIZATION');assert.equal(producerCalls,0);
 const repeat=await(await api(req('',{method:'POST',body:input}))).json();assert.equal(repeat.id,order.id);
 assert.equal((await(await api(req('',{token:'SYNTHETIC_B'}))).json()).items.length,0);
 assert.equal((await api(req('/'+order.id,{token:'SYNTHETIC_B'}))).status,404);
 const updated=await api(req('/'+order.id,{method:'PATCH',body:{...input,version:1,status:'PAUSED'}}));assert.equal(updated.status,200);assert.equal((await updated.json()).status,'PAUSED');
 assert.equal((await api(req('/'+order.id,{method:'PATCH',body:{...input,version:1,status:'ACTIVE'}}))).status,409);
 const once=await api(req('',{method:'POST',key:'SYNTHETIC-ONCE-1',body:{...input,name:'SYNTHETIC_ONCE',schedule:null}}));assert.equal(once.status,201,JSON.stringify(await once.clone().json()));const one=await once.json();assert.equal(one.executionState,'QUEUED');assert.equal(producerCalls,1);
 const runs=await(await api(req('/'+one.id+'/runs'))).json();assert.equal(runs.items.length,1);assert.equal(runs.items[0].status,'QUEUED');assert(runs.items[0].producerJobId);
 const jobId=runs.items[0].producerJobId,pdf=Buffer.from('%PDF-1.7\nSYNTHETIC_ONLY_READ_PORT_FIXTURE'),markdown=Buffer.from('# SYNTHETIC_ONLY\n\nOffline publication read contract.');
 assert.equal((await api(req('/editions/'+jobId+'/pdf'))).status,404);
 assert.deepEqual((await(await api(req('/editions'))).json()).items,[]);
 // The disposable fixture operator seeds an admitted synthetic publication;
 // no runtime publisher grant or real Oil acceptance is implied.
 await(async()=>{const q=f.databases[1];
  await q.query("UPDATE insights_private.report_jobs SET status='AWAITING_REVIEW',document=jsonb_set(document,'{status}','\"AWAITING_REVIEW\"') WHERE id=$1",[jobId]);
  for(const [kind,bytes]of[['pdf',pdf],['markdown',markdown]])await q.query('INSERT INTO insights_private.report_artifacts(job_id,organisation_id,kind,sha256,bytes) VALUES($1,$2,$3,$4,$5)',[jobId,A,kind,createHash('sha256').update(bytes).digest('hex'),bytes]);
 })();
 assert.equal((await api(req('/editions/'+jobId+'/pdf'))).status,404,'A real review candidate still is not a publication');
 await f.databases[1].query("INSERT INTO insights_private.published_editions(producer_job_id,organisation_id,edition_id,definition_id,profile_version,title,period,as_of,published_at,approval_ref,pdf_sha256,markdown_sha256) SELECT id,organisation_id::uuid,document->>'editionId',definition_id,document->'command'->>'profileVersion','SYNTHETIC_ONLY',document->'command'->'period',(document->'command'->>'asOf')::timestamptz,clock_timestamp(),'SYNTHETIC_ONLY_REVIEW_APPROVAL',$2,$3 FROM insights_private.report_jobs WHERE id=$1",[jobId,createHash('sha256').update(pdf).digest('hex'),createHash('sha256').update(markdown).digest('hex')]);
 const published=await api(req('/editions/'+jobId));assert.equal(published.status,200,JSON.stringify(await published.clone().json()));const read=await published.json();assert.equal(read.status,'PUBLISHED');assert.equal(read.markdown,markdown.toString());
 const file=await api(req('/editions/'+jobId+'/pdf'));assert.equal(file.status,200);assert.equal(file.headers.get('x-report-publication'),'PUBLISHED');assert.equal(file.headers.get('etag'),'"'+read.pdfSha256+'"');assert.deepEqual(Buffer.from(await file.arrayBuffer()),pdf);
 assert.equal((await api(req('/editions/'+jobId,{token:'SYNTHETIC_B'}))).status,404,'An organisation permission does not disclose another user’s private order');
 assert.equal((await api(req('/editions/'+jobId+'/pdf',{token:'SYNTHETIC_B'}))).status,404);
 await assert.rejects(f.asOwner(1,q=>q.query("UPDATE insights_private.published_editions SET title='MUTATED' WHERE producer_job_id=$1",[jobId]),'insights_report_owner'));
 await assert.rejects(f.pools[1].query('INSERT INTO insights_private.published_editions(producer_job_id) VALUES($1)',[randomUUID()]));
 assert.equal((await(await api(req('/editions'))).json()).items[0].pdfSha256,read.pdfSha256);
 const notices=await(await api(req('/notifications'))).json();assert.equal(notices.items.length,1);assert.equal(notices.items[0].kind,'REPORT_PUBLISHED');assert.equal(notices.items[0].producerJobId,jobId);assert.equal(notices.items[0].readAt,null);
 assert.equal((await(await api(req('/notifications',{token:'SYNTHETIC_B'}))).json()).items.length,0);
 assert.equal((await api(req('/notifications/'+notices.items[0].id,{method:'PATCH'}))).status,200);assert((await(await api(req('/notifications'))).json()).items[0].readAt);
 assert.equal((await f.pools[1].query('SELECT * FROM insights_private.report_subscriptions')).rowCount,0);
 await assert.rejects(f.pools[1].query("UPDATE insights_private.subscription_versions SET definition='{}'::jsonb"));
 await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
 assert.equal((await api(req())).status,403);
 assert.equal((await api(req('/editions/'+jobId+'/pdf'))).status,403);
});
