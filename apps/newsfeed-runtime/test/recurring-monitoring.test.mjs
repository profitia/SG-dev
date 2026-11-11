import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {firstPartyFixture,U,V,A,B} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs';
import {recurringSchemaDigest} from '@profitia/platform-current-e1-authority/recurring';
import {createAuthorizer} from '../src/auth.mjs';
import {createSavedSearchRepository} from '../src/repository.mjs';
import {createNewsfeedMonitoring} from '../src/recurring.mjs';
import {createMonitoringWorker} from '../src/worker.mjs';
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('SYNTHETIC_ONLY: durable monitoring runs without a browser and fences private and uncertain effects',async t=>{
 const f=await firstPartyFixture(),original=globalThis.fetch;let afterInitial=null,transportError=null;
 const transport=async(url,options={})=>{
  if(!url.startsWith(f.authorityOrigin+'/v1/e1/recurring/'))return f.transport(url,options);
  if(url.endsWith('/component-ready')){try{return Response.json(await f.authority.recurringComponentReady(new Request(url,{method:'POST',headers:options.headers}),JSON.parse(options.body)))}catch{return Response.json({ready:false},{status:403})}}
  const input=JSON.parse(options.body);
  try{const p=await(url.endsWith('/consent')?f.authority.recurringConsent:f.authority.authorizeRecurring)(new Request(url,{method:'POST',headers:options.headers}),input);
   if(input.previous===null&&afterInitial)await afterInitial();return Response.json(p);
  }catch(error){transportError=error;return Response.json({error:'SYNTHETIC_DENIAL'},{status:403})}
 };
 globalThis.fetch=transport;
 try{
  await f.asOwner(0,async q=>{
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/012-recurring-authority.sql'));
   await q.query('INSERT INTO profitia_e1_authority.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('authority')]);
   await q.query('GRANT EXECUTE ON FUNCTION profitia_e1_authority.recurring_component_ready(text,text,text,text),profitia_e1_authority.recurring_ready(),profitia_e1_authority.recurring_schema_digest(),profitia_e1_authority.recurring_consent(text,jsonb,jsonb),profitia_e1_authority.recurring_identity(text,text,jsonb),profitia_e1_authority.issue_recurring(text,text,text,jsonb,jsonb,jsonb) TO identity_b1_runtime');
   await q.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES('newsfeed_development_runtime',$1,$2,'SPENDGURU_SAAS','SYNTHETIC_ONLY','synthetic-first-party-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),randomUUID()]);
   await q.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,'newsfeed_development_runtime',$2,'knowledge.read','market','api.brave.news-discovery','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),A]);
   await q.query("INSERT INTO profitia_e1_authority.recurring_executors(component_id,key_id,owner_application_id,operation,status,source_ref,expires_at) VALUES($1,'synthetic-key',$2,'newsfeed.monitor.execute','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[f.components.newsfeed.id,f.apps[2]]);
  });
  await f.asOwner(2,async q=>{
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/013-recurring-receiver.sql'));
   await q.query('INSERT INTO profitia_e1_receiver.recurring_installation VALUES(true,$1)',[recurringSchemaDigest('receiver')]);
   await q.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO newsfeed_development_runtime,newsfeed_development_owner');
  });
  await f.asOwner(2,async q=>{
   const saved=load('../migrations/003-saved-searches.sql');await q.query(saved.replaceAll('__OWNER_ROLE__','newsfeed_development_owner').replaceAll('__RUNTIME_ROLE__','newsfeed_development_runtime'));
   await q.query("INSERT INTO newsfeed.saved_search_migrations VALUES('1.2.0',$1,clock_timestamp())",[hash(saved)]);
   const recurring=load('../migrations/004-recurring-monitoring.sql');await q.query(recurring);
   await q.query("INSERT INTO newsfeed.recurring_migrations VALUES('1.0.0',$1)",[hash(recurring)]);
  },'newsfeed_development_owner');
  const slot=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  const c={...f.bindings[2],applicationId:f.apps[2],runtimeRole:f.bindings[2].role,identityIssuer:f.issuer,authorizedParties:[f.origin],requiredProduct:'SPENDGURU',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'fixture-v1',
   recurring:{componentId:f.components.newsfeed.id,keyId:'synthetic-key'},secrets:{recurringPrivateKey:f.components.newsfeed.key.privateKey}};
  const repo=createSavedSearchRepository(c,f.db(2),{now:()=>new Date(Date.parse(slot)-1000).toISOString()}),auth=await createAuthorizer(c,f.db(2),{clerkClient:f.client,currentAuthority:true});
  const execute=(action,{id='newsfeed-observations',token='SYNTHETIC_A',org=A}={})=>auth.execute({request:f.request(token),organisationId:org,resourceId:id,write:true},action);
  const schedule={frequency:'DAILY',timeZone:'UTC',localTime:slot.slice(11,16),startDate:slot.slice(0,10),endDate:null,weekdays:[],monthDay:null};
  const input={contractVersion:'1.2.0',name:'SYNTHETIC_ONLY',subjectKind:'topic',subject:'SYNTHETIC_ONLY',phrases:['synthetic'],schedule,notifications:true,request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'SYNTHETIC_ONLY'}}};
  let upstream=0,failUpstream=false,onUpstream=null;
  const sourceHub={async acquireService(args){upstream++;assert.equal(args.command.criteria.text,'SYNTHETIC_ONLY');assert.equal(args.organisationId,A);assert.match(args.grantId,/^[a-f0-9-]{36}$/);if(onUpstream)await onUpstream();if(failUpstream)throw Error('SYNTHETIC_TIMEOUT');
   return{provider:'brave',items:[{payload:{kind:'WEB_PAGE',url:'https://synthetic.example/article',title:'SYNTHETIC_ONLY',publishedAt:slot,content:'MUST_NOT_PERSIST'},metadata:{sourceRecordRef:'SYNTHETIC_ONLY',licenceRef:'SYNTHETIC_ONLY',retrievedAt:new Date().toISOString(),retentionUntil:slot,privatePayload:'MUST_NOT_PERSIST'}}]};
  }};
  const monitoring=await createNewsfeedMonitoring(c,f.db(2),{binding:f.bindings[2],fetch:transport,sourceHub});
  const create=async()=>{const o=await execute((ctx,q)=>repo.create(q,ctx,input));await execute((ctx,q)=>monitoring.activate(q,f.request(),o.id,o.version,true),{id:o.id});await f.asOwner(2,q=>q.query('UPDATE newsfeed.monitor_delegations SET next_due_at=$2::timestamptz WHERE observation_id=$1::uuid',[o.id,slot]),'newsfeed_development_owner');return execute((ctx,q)=>repo.get(q,ctx,o.id),{id:o.id})};
  await t.test('real schema and current E1 readiness',async()=>{assert.equal(await monitoring.ready(),true)});
  let observation;
  await t.test('HUMAN consents then background SERVICE persists one run and a durable notification',async()=>{
   observation=await create();assert.equal(observation.monitoringState,'ACTIVE');const worker=createMonitoringWorker({monitoring});
   await worker.tick();await worker.stop();assert.equal(upstream,1,transportError?.message);
   const history=await execute((ctx,q)=>repo.history(q,ctx,observation.id,{}),{id:observation.id});assert.equal(history.items.length,1);assert.equal(history.items[0].status,'SUCCEEDED');
   const feed=await execute((ctx,q)=>repo.publications(q,ctx,observation.id,{}),{id:observation.id});assert.equal(feed.items.length,1);assert.equal(feed.items[0].excerpt,null);
   const inbox=await execute((ctx,q)=>repo.inbox(q,ctx,{}));assert.equal(inbox.items.length,1);
  });
  await t.test('restart and duplicate due-slot claim cannot repeat an upstream effect',async()=>{const worker=createMonitoringWorker({monitoring});await worker.tick();await worker.stop();assert.equal(upstream,1);assert.equal((await monitoring.candidates()).length,0)});
  await t.test('another user or organisation cannot activate the private resource',async()=>{
   await assert.rejects(execute((_,q)=>monitoring.activate(q,f.request('SYNTHETIC_B'),observation.id,observation.version,true),{id:observation.id,token:'SYNTHETIC_B'}));
   await assert.rejects(execute((_,q)=>monitoring.activate(q,f.request(),observation.id,observation.version,true),{id:observation.id,org:B}));
  });
  await t.test('an uncertain provider result remains terminal across restart',async()=>{
   const o=await create(),candidate=(await monitoring.candidates()).find(x=>x.id===o.id),job=await monitoring.claim(candidate);failUpstream=true;
   await assert.rejects(monitoring.execute(job));const count=upstream;await createMonitoringWorker({monitoring}).tick();assert.equal(upstream,count);
   const state=(await f.databases[2].query('SELECT state FROM newsfeed.monitor_jobs WHERE id=$1',[job.id])).rows[0];assert.equal(state.state,'UNCERTAIN');failUpstream=false;
  });
  await t.test('current membership revocation prevents the next effect',async()=>{
   const o=await create(),candidate=(await monitoring.candidates()).find(x=>x.id===o.id),job=await monitoring.claim(candidate),before=upstream;
   await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
   await assert.rejects(monitoring.execute(job));assert.equal(upstream,before);await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
  });
  await t.test('restart reconciles a lost completion without repeating an ambiguous provider attempt',async()=>{
   const o=await create(),candidate=(await monitoring.candidates()).find(x=>x.id===o.id),job=await monitoring.claim(candidate);
   const disconnected={...f.db(2),query:(sql,args)=>sql.includes('monitoring_uncertain')?Promise.reject(Error('SYNTHETIC_PROCESS_LOSS')):f.db(2).query(sql,args)};
   const interrupted=await createNewsfeedMonitoring(c,disconnected,{binding:f.bindings[2],fetch:transport,sourceHub});
   failUpstream=true;await assert.rejects(interrupted.execute(job));failUpstream=false;const before=upstream;
   await f.asOwner(2,q=>q.query("UPDATE newsfeed.monitor_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[job.id]),'newsfeed_development_owner');
   await createMonitoringWorker({monitoring:{...monitoring,async candidates(){return(await monitoring.candidates()).filter(x=>x.id===o.id)}}}).tick();assert.equal(upstream,before);
   assert.equal((await f.databases[2].query('SELECT state FROM newsfeed.monitor_jobs WHERE id=$1',[job.id])).rows[0].state,'UNCERTAIN');
  });
  await t.test('version change and pause fence an already claimed job',async()=>{
   const o=await create(),candidate=(await monitoring.candidates()).find(x=>x.id===o.id),job=await monitoring.claim(candidate),before=upstream;
   await execute((ctx,q)=>repo.update(q,ctx,o.id,{contractVersion:'1.2.0',version:o.version,status:'PAUSED'}),{id:o.id});
   await assert.rejects(monitoring.execute(job));assert.equal(upstream,before);
  });
  await t.test('permitted metadata only; no article content or signing key in persisted rows/audit',async()=>{
   const rows=await f.databases[2].query('SELECT to_jsonb(p) AS value FROM newsfeed.publication_index p UNION ALL SELECT to_jsonb(e) FROM profitia_access.security_events e');
   const serialized=JSON.stringify(rows.rows);assert(!serialized.includes('MUST_NOT_PERSIST'));assert(!serialized.includes('BEGIN PRIVATE KEY'));
   await assert.rejects(f.db(2).query('SELECT proof_key FROM profitia_e1_receiver.installation'));
   assert.equal((await f.db(2).query('SELECT count(*) FROM newsfeed.observations')).rows[0].count,'0');
  });
 }finally{globalThis.fetch=original;await f.close()}
});
test('worker coalesces overlapping ticks and drains an in-flight job on stop',async()=>{
 let release,entered;const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);let claims=0,executions=0;
 const worker=createMonitoringWorker({monitoring:{async candidates(){return[{}]},async claim(){claims++;return{}},async execute(){executions++;entered();await waiting}}});
 const a=worker.tick();await started;const b=worker.tick();const stopped=worker.stop();release();await Promise.all([a,b,stopped]);assert.equal(claims,1);assert.equal(executions,1);await worker.tick();assert.equal(claims,1);
});

