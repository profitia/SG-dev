import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import pg from 'pg';
import {currentE1Fixture,U,V,A,B} from '../../../packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs';
import {createAuthorizer} from '../src/auth.mjs';import {createSavedSearchRepository} from '../src/repository.mjs';import {migrateSavedSearches} from '../scripts/migrate.mjs';
import {createApplication,createHttpServer} from '../src/server.mjs';import {createRepository} from '../src/repository.mjs';import {request as httpRequest} from 'node:http';
const sql=readFileSync(new URL('../migrations/003-saved-searches.sql',import.meta.url),'utf8'),digest=createHash('sha256').update(sql).digest('hex');
const input={contractVersion:'1.2.0',name:'Oil market',subjectKind:'topic',subject:'oil',phrases:['oil','asphalt'],schedule:null,notifications:true,request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'oil asphalt'}}};
const result=title=>({provider:'brave',items:[{payload:{kind:'WEB_PAGE',url:'https://example.test/news#top',title,publishedAt:new Date(Date.now()-3600000).toISOString()},metadata:{sourceRecordRef:'SYNTHETIC_PAGE',licenceRef:'SYNTHETIC_ONLY_ALLOWED_METADATA',retrievedAt:new Date().toISOString(),retentionUntil:new Date(Date.now()-1000).toISOString(),privatePayload:'MUST_NOT_PERSIST'}}]});
test('SYNTHETIC_ONLY: saved searches persist immutable runs and permitted metadata under real current-E1 transactions',async t=>{
 const f=await currentE1Fixture(),original=globalThis.fetch;globalThis.fetch=f.transport;t.after(async()=>{globalThis.fetch=original;await f.close();});
 const configuration={...f.bindings[2],runtimeRole:f.bindings[2].role,identityIssuer:f.issuer,authorizedParties:[f.origin],requiredProduct:'SPENDGURU',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'fixture-v1'};
 await f.databases[2].query("SELECT pg_advisory_lock(hashtextextended('stage2a-test-role-setup',0))");
 try{if(!(await f.databases[2].query("SELECT 1 FROM pg_roles WHERE rolname='newsfeed_development_migrator'")).rowCount)await f.databases[2].query('CREATE ROLE newsfeed_development_migrator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION');await f.databases[2].query('GRANT newsfeed_development_owner TO newsfeed_development_migrator');}
 finally{await f.databases[2].query("SELECT pg_advisory_unlock(hashtextextended('stage2a-test-role-setup',0))");}
 const migrator=new pg.Client({...f.databases[2].connectionParameters,user:'newsfeed_development_migrator'});await migrator.connect();
 try{
  await assert.rejects(()=>migrateSavedSearches(migrator,configuration,'wrong'),/EXACT_MIGRATION_DIGEST_REQUIRED/);
  await assert.rejects(()=>migrateSavedSearches(migrator,configuration,digest),/SHARED_READ_PROOF_VALIDATOR_GRANT_REQUIRED/);
  await f.asOwner(2,q=>q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO newsfeed_development_owner;GRANT EXECUTE ON FUNCTION profitia_e1_receiver.scope_allows(text,uuid,uuid,boolean) TO newsfeed_development_owner'));
  await migrateSavedSearches(migrator,configuration,digest);await migrateSavedSearches(migrator,configuration,digest);
  await assert.rejects(()=>migrateSavedSearches(migrator,{...configuration,environment:'production'},digest),/ENVIRONMENT_NOT_ACTIVATED/);
 }finally{await migrator.end();}
 const repo=createSavedSearchRepository(configuration,f.db(2)),auth=await createAuthorizer(configuration,f.db(2),{clerkClient:f.client,currentAuthority:true});
 const execute=(action,{id='newsfeed-observations',write=true,token='SYNTHETIC_A',org=A}={})=>auth.execute({request:f.request(token),organisationId:org,resourceId:id,write},action);
 assert.equal(await repo.ready(),true);
 const o=await execute((c,q)=>repo.create(q,c,input));assert.equal(o.ownerUserId,U);assert.equal(o.version,1);
 const started=await execute((c,q)=>repo.beginRun(q,c,o.id,'SYNTHETIC-FIRST'),{id:o.id});
 const first=await execute((c,q)=>repo.completeRun(q,c,started,result('Oil and asphalt')), {id:o.id});assert.equal(first.publications.items.length,1);assert.equal(first.publications.items[0].excerpt,null);
 await t.test('zero-content retention does not erase the permitted metadata index or retain payloads',async()=>{
  const page=await execute((c,q)=>repo.publications(q,c,o.id),{id:o.id,write:false});assert.equal(page.items[0].url,'https://example.test/news');assert.equal(page.items[0].headline,'Oil and asphalt');assert(!JSON.stringify(page).includes('MUST_NOT_PERSIST'));
  assert.equal(page.items[0].provider,'brave');assert.equal(page.items[0].kind,'WEB_PAGE');assert.equal(page.items[0].licenceRef,'SYNTHETIC_ONLY_ALLOWED_METADATA');
  assert.equal((await execute((c,q)=>repo.publications(q,c,o.id,{q:'no matching text'}),{id:o.id,write:false})).items.length,0);
  const feed=await execute((c,q)=>repo.feed({...q,query:async(...args)=>{try{return await q.query(...args)}catch(error){t.diagnostic('Isolated feed SQL: '+error.code+' '+error.message);throw error}}},c),{write:false});assert.equal(feed.items.length,1);assert.equal(feed.items[0].topics[0].id,o.id);
  assert.equal((await execute((c,q)=>repo.feed(q,c),{write:false,token:'SYNTHETIC_B'})).items.length,0);
 });
 const changed=await execute((c,q)=>repo.update(q,c,o.id,{contractVersion:'1.2.0',version:o.version,name:'Edited',phrases:['oil'],request:{...input.request,criteria:{text:'oil'}}}),{id:o.id});assert.equal(changed.version,2);
 const second=await execute((c,q)=>repo.beginRun(q,c,o.id,'SYNTHETIC-SECOND'),{id:o.id});await execute((c,q)=>repo.completeRun(q,c,second,result('Oil update')),{id:o.id});
 await t.test('old runs preserve criteria and metadata; URL identity and notification events are deduplicated',async()=>{
  const h=await execute((c,q)=>repo.history(q,c,o.id),{id:o.id,write:false});assert.equal(h.items.length,2);assert.equal(h.items.find(x=>x.id===started.id).criteriaSnapshot.request.criteria.text,'oil asphalt');
  const old=await execute((c,q)=>repo.publications(q,c,o.id,{runId:started.id}),{id:o.id,write:false});assert.equal(old.items[0].headline,'Oil and asphalt');
  const newer=await execute((c,q)=>repo.publications(q,c,o.id,{runId:second.id}),{id:o.id,write:false});assert.equal(newer.items[0].headline,'Oil update');assert.equal(old.items[0].id,newer.items[0].id);
  const inbox=await execute((c,q)=>repo.inbox(q,c),{write:false});assert.equal(inbox.items.length,1);
  const page=await execute((c,q)=>repo.history(q,c,o.id,{limit:1}),{id:o.id,write:false});assert(page.nextCursor);const next=await execute((c,q)=>repo.history(q,c,o.id,{limit:1,cursor:page.nextCursor}),{id:o.id,write:false});assert.equal(next.items.length,1);assert.notEqual(page.items[0].id,next.items[0].id);
 });
 await t.test('different users and organisations cannot read the private observation or raw index',async()=>{
  for(const options of[{token:'SYNTHETIC_B'},{org:B}])await assert.rejects(()=>execute((c,q)=>repo.get(q,c,o.id),{id:o.id,write:false,...options}),{code:'OBSERVATION_NOT_FOUND'});
  assert.equal((await f.db(2).query('SELECT * FROM newsfeed.publication_index')).rowCount,0);
  await assert.rejects(()=>execute((c,q)=>q.query('UPDATE newsfeed.observation_versions SET definition=\'{}\'::jsonb'),{id:o.id}));
 });
 await t.test('a single-use resource invitation identifies its real recipient through E1, not a directory copy',async()=>{
  const invitation=await execute((c,q)=>repo.share(q,c,o.id,{contractVersion:'1.2.0',mode:'USER_LINK',version:2}),{id:o.id});assert.match(invitation.token,/^[a-f0-9]{64}$/);
  const accepted=await execute((c,q)=>repo.claimInvitation(q,c,{token:invitation.token}),{token:'SYNTHETIC_B'});assert.equal(accepted.id,o.id);assert.equal(accepted.readOnly,true);assert.equal(accepted.ownerUserId,U);
  await assert.rejects(()=>execute((c,q)=>repo.claimInvitation(q,c,{token:invitation.token}),{token:'SYNTHETIC_B'}),{code:'INVITATION_UNAVAILABLE'});
  const list=await execute((c,q)=>repo.list(q,c,{access:'shared'}),{token:'SYNTHETIC_B',write:false});assert.equal(list.items.length,1);assert.equal(list.items[0].readOnly,true);
  assert.equal((await execute((c,q)=>repo.feed(q,c),{write:false,token:'SYNTHETIC_B'})).items[0].topics[0].id,o.id);
  assert.equal((await execute((c,q)=>repo.publications(q,c,o.id,{runId:first.run.id}),{token:'SYNTHETIC_B',write:false,id:o.id})).items[0].headline,'Oil and asphalt');
  assert.equal((await execute((c,q)=>repo.history(q,c,o.id,{limit:1}),{token:'SYNTHETIC_B',write:false,id:o.id})).items.length,1);
  const context=await execute((c,q)=>repo.assistantContext(q,c,{observationId:o.id}),{token:'SYNTHETIC_B',write:false,id:o.id});assert.equal(context.observations[0].id,o.id);assert.equal(context.observations[0].publications[0].provider,'brave');assert(!JSON.stringify(context).includes('MUST_NOT_PERSIST'));assert(!JSON.stringify(context).includes(U));
  const ownStats=await execute((c,q)=>repo.statistics(q,c,o.id),{write:false,id:o.id}),sharedStats=await execute((c,q)=>repo.statistics(q,c,o.id),{token:'SYNTHETIC_B',write:false,id:o.id});assert.deepEqual(sharedStats.days,ownStats.days);assert.equal(sharedStats.total,1);assert.equal(sharedStats.total,ownStats.total);
  for(const action of[(c,q)=>repo.update(q,c,o.id,{contractVersion:'1.2.0',version:2,name:'UNAUTHORISED'}),(c,q)=>repo.beginRun(q,c,o.id,'SYNTHETIC-NOT-OWNER')])await assert.rejects(()=>execute(action,{id:o.id,token:'SYNTHETIC_B'}),{code:'OBSERVATION_NOT_FOUND'});
  const grants=await execute((c,q)=>repo.shares(q,c,o.id),{id:o.id,write:false});assert(!JSON.stringify(grants).includes(invitation.token));
  await execute((c,q)=>repo.revokeShare(q,c,o.id,grants.grants[0].id,'SHARE'),{id:o.id});
  await assert.rejects(()=>execute((c,q)=>repo.publications(q,c,o.id),{id:o.id,write:false,token:'SYNTHETIC_B'}),{code:'OBSERVATION_NOT_FOUND'});
  assert.equal((await execute((c,q)=>repo.feed(q,c),{write:false,token:'SYNTHETIC_B'})).items.length,0);
  assert.equal((await f.db(2).query('SELECT * FROM newsfeed.observation_shares')).rowCount,0);
  await assert.rejects(()=>f.db(2).query("SELECT newsfeed.read_shared($1,'observation')",[o.id]));
 });
 await t.test('organisation sharing is read-only, tenant isolated and revocable',async()=>{
  await execute((c,q)=>repo.share(q,c,o.id,{contractVersion:'1.2.0',mode:'ORG',version:2}),{id:o.id});
  assert.equal((await execute((c,q)=>repo.list(q,c,{access:'organisation'}),{write:false,token:'SYNTHETIC_B'})).items.length,1);
  await assert.rejects(()=>execute((c,q)=>repo.get(q,c,o.id),{id:o.id,write:false,org:B,token:'SYNTHETIC_B'}),{code:'OBSERVATION_NOT_FOUND'});
  const grants=await execute((c,q)=>repo.shares(q,c,o.id),{id:o.id,write:false});await execute((c,q)=>repo.revokeShare(q,c,o.id,grants.grants.find(x=>x.mode==='ORG').id,'SHARE'),{id:o.id});
  assert.equal((await execute((c,q)=>repo.list(q,c,{access:'organisation'}),{write:false,token:'SYNTHETIC_B'})).items.length,0);
 });
 await t.test('revocation before final current-E1 observation rolls back the write',async()=>{
  f.transportState.afterInitial=async()=>f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
  await assert.rejects(()=>execute((c,q)=>repo.update(q,c,o.id,{contractVersion:'1.2.0',version:2,name:'MUST_ROLL_BACK'}),{id:o.id}));f.transportState.afterInitial=null;
  await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]));
  assert.equal((await execute((c,q)=>repo.get(q,c,o.id),{id:o.id,write:false})).name,'Edited');
 });
 await t.test('v1.2 real HTTP flow distinguishes explicit acquisition, immutable replay, a shared stream and permanent event references',async tt=>{
  let upstream=0;const logs=[],app=createApplication({authorizer:{...auth,assistantReadEnabled:true},repository:createRepository(configuration,f.db(2)),savedSearches:repo,sourceHub:{async acquire({command}){assert.equal(command.provider,'brave');upstream++;return result('SYNTHETIC_ONLY HTTP acquisition')}},log:line=>logs.push(line)});
  const server=createHttpServer(app,{publicOrigin:f.origin});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));tt.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});
  const api=(path,{method='GET',body,token='SYNTHETIC_A',key}={})=>new Promise((resolve,reject)=>{
   const call=httpRequest({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:new URL(f.origin).host,'x-profitia-organisation-id':A,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})}},response=>{const bytes=[];response.on('data',chunk=>bytes.push(chunk));response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(Buffer.concat(bytes).toString())}));response.on('error',reject)});call.on('error',reject);call.end(body?JSON.stringify(body):undefined);
  });
  assert.equal((await api('/ready')).status,200);
  const created=await api('/v1.2/observations',{method:'POST',body:{...input,name:'SYNTHETIC_HTTP'}});assert.equal(created.status,201);const id=created.body.id;
  const path='/v1.2/observations/'+id;
  const discovered=await api(path+'/discover',{method:'POST',key:'SYNTHETIC_HTTP_ONCE'});assert.equal(discovered.status,200);assert.equal(upstream,1);const runId=discovered.body.run.id,publicationId=discovered.body.publications.items[0].id;
  assert.equal((await api(path+'/discover',{method:'POST',key:'SYNTHETIC_HTTP_ONCE'})).status,200);assert.equal(upstream,1);
  assert.equal((await api(path+'/publications?publicationId='+publicationId)).body.items.length,1);
  assert.equal((await api(path+'/publications?runId='+runId)).body.items[0].headline,'SYNTHETIC_ONLY HTTP acquisition');
  assert.equal((await api(path+'/history')).body.items[0].criteriaSnapshot.version,1);
  const invite=await api(path+'/shares',{method:'POST',body:{contractVersion:'1.2.0',version:1,mode:'USER_LINK'}});assert.equal(invite.status,201);
  assert.equal((await api('/v1.2/invitations',{method:'POST',token:'SYNTHETIC_B',body:{token:invite.body.token}})).status,200);
  assert((await api('/v1.2/feed',{token:'SYNTHETIC_B'})).body.items.some(p=>p.topics.some(topic=>topic.id===id)));
  assert.equal((await api(path+'/discover',{method:'POST',token:'SYNTHETIC_B',key:'SYNTHETIC_NOT_OWNER'})).status,404);assert.equal(upstream,1);
  const shares=(await api(path+'/shares')).body;assert.equal((await api(path+'/shares?kind=SHARE&shareId='+shares.grants[0].id,{method:'DELETE'})).status,200);
  assert.equal((await api(path+'/publications',{token:'SYNTHETIC_B'})).status,404);
  assert((await api('/v1.2/notifications')).body.items.some(x=>x.observationId===id));
  assert.equal((await api('/v1/assistant-context?observationId='+id)).status,200);assert.equal(upstream,1);
  assert.equal((await api(path,{token:null})).status,403);assert.equal((await api('/v1.2/observations?ownerUserId='+V)).status,400);
  assert(!logs.join('\n').includes(invite.body.token));assert(!logs.join('\n').includes('SYNTHETIC_ONLY HTTP acquisition'));assert.equal(upstream,1);
 });
});
