import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import pg from 'pg';
import {currentE1Fixture,U,V,A,B} from '../../../packages/platform-contracts/test/fixtures/current-e1-authority-postgres.mjs';
import {createAuthorizer} from '../src/auth.mjs';import {createSavedSearchRepository,createRepository} from '../src/repository.mjs';
import {migrateSavedSearches,migrateReaderInvitation} from '../scripts/migrate.mjs';import {createApplication} from '../src/server.mjs';
const digest=name=>createHash('sha256').update(readFileSync(new URL('../migrations/'+name,import.meta.url))).digest('hex');
const input={contractVersion:'1.2.0',name:'Read-only invitation',subjectKind:'topic',subject:'oil',phrases:['oil'],schedule:null,notifications:false,request:{contractVersion:'1.0.0',family:'news-discovery',provider:'brave',operation:'search',criteria:{text:'oil'}}};
test('SYNTHETIC_ONLY: a read-only recipient claims one owner invitation under real native current-E1 without acquiring write rights',async t=>{
 const f=await currentE1Fixture(),original=globalThis.fetch;let migrator;globalThis.fetch=f.transport;t.after(async()=>{await migrator?.end();globalThis.fetch=original;await f.close()});
 const configuration={...f.bindings[2],runtimeRole:f.bindings[2].role,identityIssuer:f.issuer,authorizedParties:[f.origin],requiredProduct:'SPENDGURU',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'fixture-v1'};
 await f.databases[2].query("SELECT pg_advisory_lock(hashtextextended('stage2a-test-role-setup',0))");
 try{
  if(!(await f.databases[2].query("SELECT 1 FROM pg_roles WHERE rolname='newsfeed_development_migrator'")).rowCount)await f.databases[2].query("CREATE ROLE newsfeed_development_migrator LOGIN PASSWORD 'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION");
  await f.databases[2].query('GRANT newsfeed_development_owner TO newsfeed_development_migrator');
 }finally{await f.databases[2].query("SELECT pg_advisory_unlock(hashtextextended('stage2a-test-role-setup',0))")}
 await f.asOwner(2,q=>q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO newsfeed_development_owner;GRANT EXECUTE ON FUNCTION profitia_e1_receiver.scope_allows(text,uuid,uuid,boolean) TO newsfeed_development_owner'));
 migrator=new pg.Client({...f.databases[2].connectionParameters,user:'newsfeed_development_migrator',password:'SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL',connectionTimeoutMillis:3000});await migrator.connect();
 await migrateSavedSearches(migrator,configuration,digest('003-saved-searches.sql'));
 await f.asOwner(0,q=>q.query("DELETE FROM profitia_access.permission_grants WHERE application_id=$1 AND user_id=$2 AND operation='personal.list.write'",[f.apps[2],V]));
 const repo=createSavedSearchRepository(configuration,f.db(2)),auth=await createAuthorizer(configuration,f.db(2),{clerkClient:f.client,currentAuthority:true});let acquisitions=0;
 const app=createApplication({authorizer:{...auth,assistantReadEnabled:true},repository:createRepository(configuration,f.db(2)),savedSearches:repo,sourceHub:{async acquire(){acquisitions++;throw Error('UNAUTHORISED_PROVIDER_CALL')}},log:()=>{}});
 async function api(path,{method='GET',body,token='SYNTHETIC_A',org=A}={}){
  const response=await app.handle(new Request(f.origin+path,{method,headers:{authorization:'Bearer '+token,'x-profitia-organisation-id':org,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,body:await response.json()};
 }
 const created=await api('/v1.2/observations',{method:'POST',body:input});assert.equal(created.status,201);const id=created.body.id,path='/v1.2/observations/'+id;
 const invite=async()=>{const r=await api(path+'/shares',{method:'POST',body:{contractVersion:'1.2.0',version:1,mode:'USER_LINK'}});assert.equal(r.status,201);return r.body};
 const invitation=await invite(),claim=(token,options={})=>api('/v1.2/invitations',{method:'POST',body:{token},token:'SYNTHETIC_B',...options});
 await t.test('the actual previous SQL rejects a read proof; migration is exact, Development-only and idempotent',async()=>{
  assert.equal((await api('/v1.2/feed',{token:'SYNTHETIC_B'})).status,200);
  assert.notEqual((await claim(invitation.token)).status,200);
  await assert.rejects(()=>migrateReaderInvitation(migrator,configuration,'wrong'),/EXACT_MIGRATION_DIGEST_REQUIRED/);
  await assert.rejects(()=>migrateReaderInvitation(migrator,{...configuration,environment:'production'},digest('005-reader-invitation.sql')),/ENVIRONMENT_NOT_ACTIVATED/);
  await migrateReaderInvitation(migrator,configuration,digest('005-reader-invitation.sql'));await migrateReaderInvitation(migrator,configuration,digest('005-reader-invitation.sql'));
 });
 await t.test('owner, other organisation and missing current read permission cannot consume the invitation',async()=>{
  assert.equal((await claim(invitation.token,{token:'SYNTHETIC_A'})).status,404);
  assert.equal((await claim(invitation.token,{org:B})).status,404);
  await f.asOwner(0,q=>q.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id=$1 AND organisation_id=$2 AND user_id=$3 AND operation='personal.list.read'",[f.apps[2],A,V]));
  assert.equal((await claim(invitation.token)).status,403);
  await f.asOwner(0,q=>q.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE application_id=$1 AND organisation_id=$2 AND user_id=$3 AND operation='personal.list.read'",[f.apps[2],A,V]));
 });
 await t.test('the real read-only recipient receives only this resource; replay, edits, sharing and discovery remain refused',async()=>{
  const accepted=await claim(invitation.token);assert.equal(accepted.status,200);assert.equal(accepted.body.id,id);assert.equal(accepted.body.ownerUserId,U);assert.equal(accepted.body.readOnly,true);
  assert.equal((await claim(invitation.token)).status,404);
  const shared=await api('/v1.2/observations?access=shared',{token:'SYNTHETIC_B'});assert.equal(shared.status,200);assert.deepEqual(shared.body.items.map(x=>x.id),[id]);
  assert.equal((await api(path+'/history',{token:'SYNTHETIC_B'})).status,200);
  assert.equal((await api(path,{method:'PATCH',body:{contractVersion:'1.2.0',version:1,name:'NOT_ALLOWED'},token:'SYNTHETIC_B'})).status,403);
  assert.equal((await api(path+'/discover',{method:'POST',token:'SYNTHETIC_B'})).status,403);assert.equal(acquisitions,0);
  assert.equal((await api(path+'/shares',{token:'SYNTHETIC_B'})).status,404);
  assert.equal((await api('/v1/assistant-context?observationId='+id,{token:'SYNTHETIC_B'})).status,200);
 });
 await t.test('resource revocation removes later reads and CIC source context without invoking a provider',async()=>{
  const shares=await api(path+'/shares');assert.equal(shares.body.grants.length,1);const grant=shares.body.grants[0];assert.equal(grant.mode,'USER');
  const actual=await f.databases[2].query('SELECT recipient_user_id FROM newsfeed.observation_shares WHERE id=$1',[grant.id]);assert.equal(actual.rows[0].recipient_user_id,V);
  assert.equal((await api(path+'/shares?kind=SHARE&shareId='+grant.id,{method:'DELETE'})).status,200);
  assert.equal((await api(path,{token:'SYNTHETIC_B'})).status,404);
  assert.equal((await api('/v1/assistant-context?observationId='+id,{token:'SYNTHETIC_B'})).status,404);assert.equal(acquisitions,0);
 });
 await t.test('membership revocation before final E1 observation rolls back the claim; its unused link remains claimable afterwards',async()=>{
  const other=await invite();f.transportState.afterInitial=()=>f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,V]));
  try{assert.equal((await claim(other.token)).status,403)}finally{f.transportState.afterInitial=null;await f.asOwner(0,q=>q.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,V]))}
  const accepted=await claim(other.token);assert.equal(accepted.status,200);assert.equal(accepted.body.readOnly,true);
 });
 assert.equal((await f.databases[0].query("SELECT 1 FROM profitia_access.permission_grants WHERE application_id=$1 AND user_id=$2 AND operation='personal.list.write'",[f.apps[2],V])).rowCount,0);
 assert.equal(acquisitions,0);
});
