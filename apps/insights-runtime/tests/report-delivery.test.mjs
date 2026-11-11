import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {firstPartyFixture,U,V,A,B} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs';
import {recurringSchemaDigest} from '@profitia/platform-current-e1-authority/recurring';
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider';
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('SYNTHETIC_ONLY: cohosted Development report delivery preserves publication, E1 and at-most-one-attempt boundaries',async t=>{
 const f=await firstPartyFixture();t.after(()=>f.close());
 const central=f.databases[0],identity=f.pools[0],owner=(fn)=>f.asOwner(0,fn,'insights_report_owner');
 const binding={...f.bindings[1],projectId:f.bindings[0].projectId,branchId:f.bindings[0].branchId,databaseName:f.bindings[0].databaseName};
 await central.query("DO $fixture$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='insights_report_owner') THEN CREATE ROLE insights_report_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;END IF;END $fixture$");
 await central.query('GRANT CREATE ON DATABASE '+binding.databaseName+' TO insights_report_owner');
 await f.asOwner(0,async q=>{
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/007-insights-authority.sql'));
  await q.query("UPDATE profitia_e1_authority.receivers SET binding=$2::jsonb,resource_id='insights-reports' WHERE application_id=$1",[f.apps[1],JSON.stringify(binding)]);
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql'));
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/008-insights-receiver.sql'));
  await q.query("INSERT INTO profitia_e1_receiver.installation SELECT true,$2,$3::jsonb,$4,'insights-reports',key_id,proof_key,'ACTIVE','SYNTHETIC_ONLY',expires_at FROM profitia_e1_authority.receivers WHERE application_id=$1",[f.apps[1],binding.role,JSON.stringify(binding),f.authorityOrigin]);
  await q.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[binding.role,f.apps[1]]);
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql'));
  await q.query('INSERT INTO profitia_e1_authority.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('authority')]);
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql'));
  await q.query('INSERT INTO profitia_e1_receiver.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('receiver')]);
  await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql'));
  await q.query('INSERT INTO profitia_e1_authority.recurring_delivery_installation VALUES(true,$1)',[hash(load('../../../packages/platform-contracts/current-e1-authority/migrations/014-recurring-delivery.sql'))]);
  await q.query("INSERT INTO profitia_e1_authority.recurring_delivery_policies(application_id,login_role,service_id,app_origin,status,expires_at,source_ref) VALUES($1,$2,'SYNTHETIC_IDENTITY_MAIL','https://dev-sg2.spendguru.app','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[f.apps[1],f.bindings[0].role]);
  for(const schema of['profitia_e1_receiver','profitia_e1_authority'])await q.query('GRANT USAGE ON SCHEMA '+schema+' TO insights_report_owner,'+binding.role+','+f.bindings[0].role);
  await q.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO insights_report_owner,'+binding.role);
  await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.recurring_delivery_descriptor(),profitia_e1_authority.recurring_delivery_identity(jsonb),profitia_e1_authority.recurring_delivery_proof(jsonb,jsonb,text),profitia_e1_authority.recurring_delivery_verify(jsonb),profitia_e1_authority.recurring_delivery_available(text) TO insights_report_owner,'+f.bindings[0].role);
  await q.query("UPDATE profitia_access.product_grants SET features=ARRAY['market','personal_workspace'] WHERE application_id=$1",[f.apps[1]]);
  for(const user of[U,V])await q.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW','insights.report.download','market')",[randomUUID(),f.apps[1],A,user]);
 });
 await central.query('SET ROLE insights_report_owner');try{await central.query(load('../sql/001-report-editions.sql'))}finally{await central.query('RESET ROLE')}
 await owner(async q=>{
  await q.query(load('../sql/002-runtime-binding.sql'));
  await q.query("INSERT INTO insights_private.runtime_bindings(login_role,binding,organisation_id,mode,status,expires_at,source_ref) VALUES($1,$2::jsonb,$3,'RECEIVER','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[binding.role,JSON.stringify(binding),A]);
  for(const[file,table]of[['003-report-subscriptions','subscription_migrations'],['004-recurring-subscriptions','recurring_migrations']]){const sql=load('../sql/'+file+'.sql');await q.query(sql);await q.query('INSERT INTO insights_private.'+table+" VALUES('1.0.0',$1)",[hash(sql)])}
  const sql=load('../sql/005-report-delivery.sql');await q.query(sql);await q.query('INSERT INTO insights_private.delivery_installation VALUES(true,$1)',[hash(sql)]);
  await q.query('GRANT USAGE ON SCHEMA insights_private TO '+f.bindings[0].role);
  await q.query('GRANT EXECUTE ON FUNCTION insights_private.delivery_descriptor(),insights_private.delivery_claim(uuid,text),insights_private.delivery_begin(jsonb,jsonb,text),insights_private.delivery_settle(uuid,uuid,text,text) TO '+f.bindings[0].role);
 });
 const job=randomUUID(),subs=new Map(),command=JSON.parse(load('./fixtures/offline-report.json')).command,pdf=Buffer.from('%PDF-1.7\nSYNTHETIC_ONLY'),md=Buffer.from('# SYNTHETIC_ONLY');
 await(async()=>{
  const q=central; // Disposable fixture operator, never a runtime publisher grant.
  const doc={id:job,editionId:job,organisationId:A,status:'AWAITING_REVIEW',command};
  await q.query("INSERT INTO insights_private.report_jobs(id,organisation_id,business_key,definition_id,period_start,period_end,revision,status,document) VALUES($1,$2,$3,'oil-asphalt',$4,$5,1,'AWAITING_REVIEW',$6::jsonb)",[job,A,'a'.repeat(64),command.period.fromDate,command.period.throughDate,JSON.stringify(doc)]);
  for(const user of[U,V]){
   const id=randomUUID();subs.set(user,id);const definition={contractVersion:'procurement-insights.subscription/1.0.0',name:'SYNTHETIC_ONLY',definitionId:'oil-asphalt',profileVersion:command.profileVersion,subjectRef:null,schedule:{frequency:'WEEKLY',weekday:2,localTime:'08:00',timeZone:'Europe/Warsaw',startDate:'2026-11-10',endDate:null},notifications:{assistant:false,email:user===U}};
   await q.query("INSERT INTO insights_private.report_subscriptions(id,organisation_id,owner_user_id,created_by_actor_id,definition_id,profile_version,name,status,definition,idempotency_digest,request_digest) VALUES($1,$2,$3,$3,'oil-asphalt',$4,'SYNTHETIC_ONLY','ACTIVE',$5::jsonb,$6,$7)",[id,A,user,command.profileVersion,JSON.stringify(definition),hash(id),'b'.repeat(64)]);
   await q.query("INSERT INTO insights_private.subscription_runs(id,subscription_id,organisation_id,owner_user_id,subscription_version,slot_key,producer_job_id,status) VALUES($1,$2,$3,$4,1,'SYNTHETIC_ONLY',$5,'AWAITING_REVIEW')",[randomUUID(),id,A,user,job]);
  }
  for(const[kind,bytes]of[['pdf',pdf],['markdown',md]])await q.query('INSERT INTO insights_private.report_artifacts VALUES($1,$2,$3,$4,$5)',[job,A,kind,hash(bytes),bytes]);
 })();
 const claim=async()=>(await identity.query('SELECT insights_private.delivery_claim($1::uuid,$2) AS claim',[randomUUID(),randomBytes(32).toString('hex')])).rows[0].claim;
 const settle=(c,s)=>identity.query('SELECT insights_private.delivery_settle($1::uuid,$2::uuid,$3,$4)',[c.request.deliveryId,c.request.leaseId,s,s==='ACCEPTED'?'<synthetic@example.test>':null]);
 const prove=async c=>{const id=(await identity.query('SELECT profitia_e1_authority.recurring_delivery_identity($1::jsonb) AS identity',[JSON.stringify(c.request)])).rows[0].identity;if(!id)return null;const observation=await createClerkAccountStatusReader({client:f.client,environment:'development',issuer:f.issuer})(id);return(await identity.query('SELECT profitia_e1_authority.recurring_delivery_proof($1::jsonb,$2::jsonb,$3) AS proof',[JSON.stringify(c.request),JSON.stringify(observation),'d'.repeat(64)])).rows[0].proof};
 const begin=(c,p)=>identity.query('SELECT insights_private.delivery_begin($1::jsonb,$2::jsonb,$3)',[JSON.stringify(c.request),JSON.stringify(p),'d'.repeat(64)]);
 await t.test('review candidate cannot become an email; only a separately published immutable version enters the outbox',async()=>{
  assert.equal(await claim(),null);await central.query("INSERT INTO insights_private.published_editions(producer_job_id,organisation_id,edition_id,definition_id,profile_version,title,period,as_of,published_at,approval_ref,pdf_sha256,markdown_sha256) VALUES($1,$2,$3,'oil-asphalt',$4,'SYNTHETIC_ONLY',$5::jsonb,$6,clock_timestamp(),'SYNTHETIC_ONLY_REVIEW_APPROVAL',$7,$8)",[job,A,job,command.profileVersion,JSON.stringify(command.period),command.asOf,hash(pdf),hash(md)]);
 });
 await t.test('current membership and deny-grant revocation prevent send even after an earlier signed decision',async()=>{
  for(const kind of['membership','grant']){
   const c=await claim(),p=await prove(c);assert(p);
   await f.asOwner(0,q=>kind==='membership'?q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id=$2",[U,A]):q.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE user_id=$1 AND organisation_id=$2 AND operation='insights.report.download'",[U,A]));
   await assert.rejects(begin(c,p));await settle(c,'RELEASE');
   await f.asOwner(0,q=>kind==='membership'?q.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE user_id=$1 AND organisation_id=$2",[U,A]):q.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE user_id=$1 AND organisation_id=$2 AND operation='insights.report.download'",[U,A]));
  }
 });
 await t.test('foreign organisation, recipient and published digest cannot reuse the bound receipt',async()=>{
  const c=await claim(),p=await prove(c);assert(p);
  for(const bad of[{...c.request,organisationId:B},{...c.request,ownerUserId:V},{...c.request,pdfSha256:'e'.repeat(64)},{...c.request,nonce:'f'.repeat(64)}])await assert.rejects(begin({...c,request:bad},p));await settle(c,'RELEASE');
 });
 await t.test('current opt-out and immutable subscription version prevent sending a pending edition',async()=>{
  const c=await claim(),p=await prove(c);assert(p);await owner(q=>q.query("UPDATE insights_private.report_subscriptions SET definition=jsonb_set(definition,'{notifications,email}','false') WHERE id=$1",[subs.get(U)]));await assert.rejects(begin(c,p));await settle(c,'RELEASE');
  await owner(q=>q.query("UPDATE insights_private.report_subscriptions SET definition=jsonb_set(definition,'{notifications,email}','true') WHERE id=$1",[subs.get(U)]));
  // A pre-send claim is released safely; its exact old immutable version must
  // not be silently rebound to the edited order. New delivery is user-visible
  // rejected; a later edition uses the newly consented version.
  assert.equal(await claim(),null);
 });
 await t.test('admitted recipient has one provider attempt and ambiguous SENDING is terminal across restart',async()=>{
  await owner(q=>q.query("UPDATE insights_private.report_subscriptions SET definition=jsonb_set(definition,'{notifications,email}','true') WHERE id=$1",[subs.get(V)]));
  const c=await claim();assert.equal(c.request.ownerUserId,V);const p=await prove(c);assert(p);await begin(c,p);
  await owner(q=>q.query("UPDATE insights_private.report_deliveries SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[c.request.deliveryId]));
  assert.equal(await claim(),null);const row=(await central.query('SELECT state FROM insights_private.report_deliveries WHERE id=$1',[c.request.deliveryId])).rows[0];assert.equal(row.state,'UNKNOWN');await assert.rejects(begin(c,p));
  const states=(await central.query('SELECT state FROM insights_private.report_deliveries')).rows;assert.equal(states.length,2);
  await assert.rejects(identity.query('SELECT * FROM insights_private.report_deliveries'));await assert.rejects(identity.query('SELECT proof_key FROM profitia_e1_authority.receivers'));
 });
});
