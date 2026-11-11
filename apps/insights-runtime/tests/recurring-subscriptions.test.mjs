import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {firstPartyFixture,U,V,A,B} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs';
import {recurringSchemaDigest} from '@profitia/platform-current-e1-authority/recurring';
import {createHumanReportAuthority} from '../src/host.mjs';
import {createReportRunner} from '../src/runner.mjs';
import {PostgresReportStore} from '../src/store.mjs';
import {PostgresSubscriptionStore} from '../src/subscription-store.mjs';
import {createSubscriptionApi} from '../src/subscription-api.mjs';
import {createRecurringSubscriptions} from '../src/recurring.mjs';
import {localParts} from '../src/calendar.mjs';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('SYNTHETIC_ONLY: private recurring orders enqueue the real producer without a browser or a fabricated HUMAN session',async t=>{
 const f=await firstPartyFixture(),original=globalThis.fetch;let afterInitial=null;
 const transport=async(url,options={})=>{
  if(!url.startsWith(f.authorityOrigin+'/v1/e1/recurring/'))return f.transport(url,options);
  const input=JSON.parse(options.body);try{
   const method=url.endsWith('/component-ready')?'recurringComponentReady':url.endsWith('/consent')?'recurringConsent':'authorizeRecurring';
   const answer=await f.authority[method](new Request(url,{method:'POST',headers:options.headers}),input);
   if(method==='authorizeRecurring'&&input.previous===null&&afterInitial)await afterInitial();
   return Response.json(answer);
  }catch(error){return Response.json({error:error.reasonCode??'SYNTHETIC_REFUSAL'},{status:403})}
 };
 globalThis.fetch=transport;t.after(async()=>{globalThis.fetch=original;await f.close()});
 await f.asOwner(0,async q=>{
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql'));
  await q.query("UPDATE profitia_e1_authority.receivers SET resource_id='insights-reports' WHERE application_id=$1",[f.apps[1]]);
  await q.query("UPDATE profitia_access.product_grants SET features=ARRAY['personal_workspace','market','benchmark'] WHERE application_id IN($1,'spendguru')",[f.apps[1]]);
  for(const user of[U,V])for(const op of['start','status','list','download'])await q.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW',$5,'market')",[randomUUID(),f.apps[1],A,user,'insights.report.'+op]);
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql'));
  await q.query('INSERT INTO profitia_e1_authority.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('authority')]);
  await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.recurring_component_ready(text,text,text,text),profitia_e1_authority.recurring_ready(),profitia_e1_authority.recurring_schema_digest(),profitia_e1_authority.recurring_consent(text,jsonb,jsonb),profitia_e1_authority.recurring_identity(text,text,jsonb),profitia_e1_authority.issue_recurring(text,text,text,jsonb,jsonb,jsonb) TO identity_b1_runtime');
  await q.query("INSERT INTO profitia_e1_authority.recurring_executors(component_id,key_id,owner_application_id,operation,status,source_ref,expires_at) VALUES($1,'synthetic-key',$2,'insights.subscription.execute','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[f.components.report.id,f.apps[1]]);
 });
 await f.databases[1].query("DO $fixture$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='insights_report_owner') THEN CREATE ROLE insights_report_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF; END $fixture$");
 await f.databases[1].query('GRANT CREATE ON DATABASE '+f.bindings[1].databaseName+' TO insights_report_owner');
 await f.asOwner(1,async q=>{
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql'));
  await q.query("UPDATE profitia_e1_receiver.installation SET resource_id='insights-reports'");
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql'));
  await q.query('INSERT INTO profitia_e1_receiver.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('receiver')]);
  await q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO insights_report_owner');
  await q.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO insights_report_owner,'+f.bindings[1].role);
 });
 await f.databases[1].query('SET ROLE insights_report_owner');
 try{await f.databases[1].query(load('../sql/001-report-editions.sql'))}finally{await f.databases[1].query('RESET ROLE')}
 await f.asOwner(1,async q=>{
  await q.query(load('../sql/002-runtime-binding.sql'));
  await q.query("INSERT INTO insights_private.runtime_bindings(login_role,binding,organisation_id,mode,status,expires_at,source_ref) VALUES($1,$2::jsonb,$3,'RECEIVER','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[f.bindings[1].role,JSON.stringify(f.bindings[1]),A]);
  await q.query('GRANT USAGE ON SCHEMA insights_private TO '+f.bindings[1].role);
  await q.query('GRANT EXECUTE ON FUNCTION insights_private.runtime_descriptor(),insights_private.scope_allows(text,uuid,boolean) TO '+f.bindings[1].role);
  await q.query('GRANT SELECT,INSERT,UPDATE ON insights_private.report_jobs TO '+f.bindings[1].role);
  await q.query('GRANT SELECT ON insights_private.report_artifacts TO '+f.bindings[1].role);
  for(const[sqlPath,table]of[['../sql/003-report-subscriptions.sql','subscription_migrations'],['../sql/004-recurring-subscriptions.sql','recurring_migrations']]){const sql=load(sqlPath);await q.query(sql);await q.query('INSERT INTO insights_private.'+table+" VALUES('1.0.0',$1)",[hash(sql)])}
 },'insights_report_owner');
 const db=f.db(1),store=new PostgresReportStore(f.pools[1]);
 const producerProfile=JSON.parse(load('../config/development.example.json')).profiles['oil-v05-autonomous-1'];
 const c={organisationId:A,receiverBinding:f.bindings[1],receiverApplication:{...f.application(1),features:['market'],operations:['insights.report.start','insights.report.status','insights.report.list','insights.report.download']},hub:{componentId:f.components.report.id,keyId:'synthetic-key'},profiles:{[producerProfile.version]:producerProfile}};
 const authority={execute:createHumanReportAuthority({configuration:c,receiver:{independentQuery:db.query,transact:db.transact},store})};
 const subscriptions=new PostgresSubscriptionStore(store,{recurring:true});
 const forbidden=new Proxy({},{get(){throw Error('SYNTHETIC_DISPATCH_MUST_NOT_CALL_EXTERNAL_PORTS')}});
 const runner=createReportRunner({store,authority:forbidden,sources:forbidden,canonical:forbidden,composer:forbidden,quality:forbidden,renderer:forbidden});
 const recurring=await createRecurringSubscriptions({configuration:c,receiver:{independentQuery:db.query,transact:db.transact},store,runner,privateKey:f.components.report.key.privateKey,fetch:transport});
 const profile={definitionId:'oil-asphalt',profileVersion:producerProfile.version,availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT']};
 const api=createSubscriptionApi({authority,store:subscriptions,profiles:()=>[profile],recurring,onOrder:()=>assert.fail('Cyclic order must not invoke one-off generation')});
 const slot=new Date(Math.ceil(Date.now()/60000)*60000).toISOString(),parts=localParts(slot),weekday=new Date(parts.date).getUTCDay();
 const input={contractVersion:'procurement-insights.subscription/1.0.0',name:'SYNTHETIC_ONLY',definitionId:profile.definitionId,profileVersion:profile.profileVersion,subjectRef:null,schedule:{frequency:'WEEKLY',weekday,localTime:parts.time,timeZone:'Europe/Warsaw',startDate:parts.date,endDate:null},notifications:{assistant:true,email:false}};
 const req=(suffix='',{method='GET',body,token='SYNTHETIC_A',key=randomUUID()}={})=>new Request(f.origin+'/api/v1/insights/subscriptions'+suffix,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json','idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined});
 const create=async()=>{const r=await api(req('',{method:'POST',body:input}));assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return r.json()};
 await t.test('current private schema, actual key and explicit recurring registration are required for readiness',async()=>{assert.equal(await recurring.ready(),true)});
 let order,job;
 await t.test('HUMAN order consents; SERVICE enqueues and links a genuine producer job at T-3h',async()=>{
  order=await create();assert.equal(order.executionState,'READY');assert.equal(order.version,2);
  const candidate=(await recurring.candidates()).find(x=>x.id===order.id);assert(candidate);job=await recurring.claim(candidate);assert(job);
  const before=f.clerkState.calls.filter(x=>x==='session').length;const result=await recurring.execute(job);assert.equal(result.producerJobId,job.id);assert.equal(f.clerkState.calls.filter(x=>x==='session').length,before);
  const row=(await f.databases[1].query('SELECT document FROM insights_private.report_jobs WHERE id=$1',[job.id])).rows[0].document;
  assert.equal(row.status,'QUEUED');assert.equal(row.author.kind,'SERVICE');assert.equal(row.author.actorId,f.serviceId);assert.notEqual(row.author.actorId,U);
  const run=(await(await api(req('/'+order.id+'/runs'))).json()).items[0];assert.equal(run.producerJobId,job.id);assert.equal(run.status,'QUEUED');
  assert.equal((await api(req('/editions/'+job.id))).status,404,'A queued producer is never presented as published');
 });
 await t.test('restart and duplicate logical slot do not enqueue another edition',async()=>{await recurring.tick();await assert.rejects(recurring.execute(job));assert.equal((await f.databases[1].query('SELECT count(*) FROM insights_private.report_jobs')).rows[0].count,'1')});
 await t.test('another private owner cannot read the subscription or its pending edition',async()=>{assert.equal((await api(req('/'+order.id,{token:'SYNTHETIC_B'}))).status,404);assert.equal((await api(req('/editions/'+job.id,{token:'SYNTHETIC_B'}))).status,404)});
 await t.test('current membership revocation rolls back staged producer writes',async()=>{
  const o=await create(),j=await recurring.claim((await recurring.candidates()).find(x=>x.id===o.id));
  afterInitial=()=>f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
  await assert.rejects(recurring.execute(j));afterInitial=null;
  assert.equal((await f.databases[1].query('SELECT count(*) FROM insights_private.subscription_runs WHERE subscription_id=$1',[o.id])).rows[0].count,'0');
  await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
 });
 await t.test('pause and immutable version fence an already claimed subscription',async()=>{
  const o=await create(),j=await recurring.claim((await recurring.candidates()).find(x=>x.id===o.id));
  const r=await api(req('/'+o.id,{method:'PATCH',body:{contractVersion:input.contractVersion,version:o.version,status:'PAUSED'}}));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
  await assert.rejects(recurring.execute(j));
 });
 await t.test('ordinary receiver has no unscoped private queue or producer access',async()=>{await assert.rejects(f.pools[1].query('SELECT * FROM insights_private.subscription_jobs'));assert.equal((await f.pools[1].query('SELECT count(*) FROM insights_private.report_jobs')).rows[0].count,'0')});
});
