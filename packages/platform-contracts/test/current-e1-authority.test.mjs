import test from 'node:test'
import assert from 'node:assert/strict'
import {createCurrentE1OperationHost,currentE1SchemaDigest} from '../current-e1-authority/index.mjs'
import {currentE1Fixture,U,V,A,B} from './fixtures/current-e1-authority-postgres.mjs'

test('SYNTHETIC_ONLY: current E1 across three isolated databases; no copied directory',async t=>{
 const f=await currentE1Fixture();t.after(f.close)
 const make=i=>createCurrentE1OperationHost({application:f.application(i),binding:f.bindings[i],independentQuery:f.db(i).query,transact:f.db(i).transact,fetch:f.transport,
  readResources:async({scope,request,query})=>{await query("SELECT set_config('profitia.environment',$1,true),set_config('profitia.application_id',$2,true),set_config('profitia.organisation_id',$3,true),set_config('profitia.user_id',$4,true)",[scope.environment,scope.applicationId,scope.organisationId,scope.userId]);return {resource:{id:request.resourceId,type:'personal_list',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:scope.userId,version:'1',projectionVersion:'fixture-v1',contentRequirements:[{product:'SPENDGURU',feature:'personal_workspace'}]}}},projectOutput:v=>structuredClone(v)})
 const hosts=[null,make(1),make(2)]
 const input=(i,options={})=>({contractId:hosts[i].contract.id,contractVersion:hosts[i].contract.version,operation:'personal.list.read',resourceId:i===1?'source-hub-private':'newsfeed-observations',organisationId:A,payload:null,request:f.request(),...options})
 const execute=(i=2,options={},action=async c=>({owner:c.actorId,organisation:c.organisationId}))=>hosts[i].execute(input(i,options),action)
 await t.test('both physical receivers require the current central authority, with zero local human ACL rows',async()=>{
  for(const i of[1,2]){assert.equal(await hosts[i].ready(),true);const result=await execute(i);assert.equal(result.value.owner,U);assert.equal(result.value.organisation,A);await f.asOwner(i,async c=>{for(const table of['accounts','external_identities','memberships','permission_grants','product_grants'])assert.equal((await c.query('SELECT count(*)::int AS n FROM profitia_access.'+table)).rows[0].n,0)})}
  assert.equal(f.clerkState.calls.filter(x=>x==='session').length,4);assert.equal(f.clerkState.calls.filter(x=>x==='user').length,4)
 })
 await t.test('other users and organisations remain distinct on overlapping operations',async()=>{const results=await Promise.all([execute(2),execute(2,{request:f.request('SYNTHETIC_B'),organisationId:B}),execute(1,{organisationId:B})]);assert.deepEqual(results.map(x=>[x.value.owner,x.value.organisation]),[[U,A],[V,B],[U,B]])})
 for(const [label,sql,params,restore] of[
  ['membership',"UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U],"UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2"],
  ['account',"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[U],"UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1"],
  ['organisation',"UPDATE profitia_access.organisations SET status='SUSPENDED' WHERE organisation_id=$1",[A],"UPDATE profitia_access.organisations SET status='ACTIVE' WHERE organisation_id=$1"],
  ['external identity',"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1",[U],"UPDATE profitia_access.external_identities SET status='ACTIVE' WHERE user_id=$1"],
  ['canonical SPENDGURU product',"UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id=$1 AND organisation_id=$2",['spendguru',A],"UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id=$1 AND organisation_id=$2"],
  ['product',"UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id=$1 AND organisation_id=$2",[f.apps[2],A],"UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id=$1 AND organisation_id=$2"],
 ])await t.test('central '+label+' revocation stops the next request and an already admitted local transaction',async()=>{
  let effects=0
  await f.asOwner(0,c=>c.query(sql,params));await assert.rejects(execute(2,{},()=>{effects++;return {}}));assert.equal(effects,0)
  await f.asOwner(0,c=>c.query(restore,params));assert.equal((await execute()).value.owner,U)
  f.transportState.afterInitial=()=>f.asOwner(0,c=>c.query(sql,params))
  try{await assert.rejects(execute(2,{},async(_,tx)=>{await tx.query('SELECT 1');return {}}))}finally{f.transportState.afterInitial=null;await f.asOwner(0,c=>c.query(restore,params))}
  assert.equal((await execute()).value.owner,U)
 })
 await t.test('new DENY beats ALLOW and removing the DENY enables only the next fresh admission',async()=>{
  const row=await f.asOwner(0,c=>c.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES(gen_random_uuid(),$1,$2,$3,'DENY','personal.list.read','personal_workspace','newsfeed-observations') RETURNING grant_id",[f.apps[2],A,U]));await assert.rejects(execute());await f.asOwner(0,c=>c.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[row.rows[0].grant_id]));assert.equal((await execute()).value.owner,U)
 })
 await t.test('current session revocation and account ban are checked again before outcome',async()=>{
  for(const kind of['session','account']){f.transportState.afterInitial=async()=>{if(kind==='session')f.clerkState.sessionActive=false;else f.clerkState.banned=true};try{await assert.rejects(execute())}finally{f.transportState.afterInitial=null;f.clerkState.sessionActive=true;f.clerkState.banned=false}}
 })
 await t.test('outage cannot fall back to a signed previous ALLOW',async()=>{
  f.transportState.offline=true;try{assert.equal(await hosts[2].ready(),false);await assert.rejects(execute())}finally{f.transportState.offline=false}
  f.transportState.afterInitial=async()=>{f.transportState.offline=true};try{await assert.rejects(execute())}finally{f.transportState.afterInitial=null;f.transportState.offline=false}
 })
 await t.test('actual private observation write is rolled back after central revocation',async()=>{
  const write=async(c,tx)=>{await tx.query("INSERT INTO newsfeed.observations(id,environment,application_id,organisation_id,owner_user_id,created_by_actor_id,updated_by_actor_id,name,subject_kind,subject,filters,status) VALUES(gen_random_uuid(),'development',$1,$2,$3,$3,$3,'SYNTHETIC_ONLY','topic','fixture','{}','ACTIVE')",[f.apps[2],c.organisationId,c.actorId]);return {persisted:true}}
  f.transportState.afterInitial=()=>f.asOwner(0,c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
  try{await assert.rejects(execute(2,{operation:'personal.list.write'},write))}finally{f.transportState.afterInitial=null;await f.asOwner(0,c=>c.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]))}
  await f.asOwner(2,async c=>assert.equal((await c.query('SELECT count(*)::int AS n FROM newsfeed.observations')).rows[0].n,0),'newsfeed_development_owner')
  assert.equal((await execute(2,{operation:'personal.list.write'},write)).value.persisted,true)
 })
 await t.test('manual scope GUCs cannot impersonate a user or expose private observations',async()=>{
  await f.db(2).transact(async({query})=>{await query("SELECT set_config('profitia.environment','development',true),set_config('profitia.application_id',$1,true),set_config('profitia.organisation_id',$2,true),set_config('profitia.user_id',$3,true)",[f.apps[2],A,U]);assert.equal((await query('SELECT * FROM newsfeed.observations')).rows.length,0)})
  for(const i of[1,2])for(const sql of['SELECT proof_key FROM profitia_e1_receiver.installation','SET ROLE profitia_access_owner'])await assert.rejects(f.pools[i].query(sql))
 })
 await t.test('a signed proof cannot transfer to another transaction, organisation, application or environment',async()=>{
  await execute();const original=f.transportState.lastProof
  for(const i of[1,2])await assert.rejects(f.db(i).transact(async({query})=>{await query('SELECT profitia_e1_receiver.challenge($1,$2::uuid,$3,$4,$5)', ['a'.repeat(64),B,'personal.list.read',i===1?'source-hub-private':'newsfeed-observations','b'.repeat(64)]);await query('SELECT profitia_e1_receiver.accept($1::jsonb)',[JSON.stringify(original)])}))
  for(const patch of[{environment:'production'},{applicationId:'foreign-application'},{role:'neondb_owner'}]){const p=structuredClone(original),raw=JSON.parse(p.payload);Object.assign(raw.request.binding,patch);p.payload=JSON.stringify(raw);await assert.rejects(f.db(2).query('SELECT profitia_e1_receiver.accept($1::jsonb)',[JSON.stringify(p)]))}
 })
 await t.test('unrelated SG2/SRM authority changes do not alter the receiver authority fingerprint',async()=>{
  f.transportState.afterInitial=()=>f.asOwner(0,c=>c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('synthetic-unrelated-app','ACTIVE')"));try{assert.equal((await execute()).value.owner,U)}finally{f.transportState.afterInitial=null}
 })
 await t.test('the approved receiving application accepts a current session from the exact SpendGuru frontend',async()=>{f.clerkState.azp='https://spendguru.synthetic.test';try{assert.equal((await execute()).value.owner,U)}finally{f.clerkState.azp=f.origin}})
 await t.test('unsupported operations/resources, absent bearer and client user claims never grant access',async()=>{
  for(const patch of[{operation:'supplier.report.refresh'},{resourceId:'another-resource'},{organisationId:V},{request:new Request(f.origin+'/')}])await assert.rejects(execute(2,patch))
  await assert.rejects(f.authority.authorize(f.request(),{applicationId:f.apps[2],challenge:{},previous:null,requestOrigin:f.origin,userId:U}))
 })
 assert.match(currentE1SchemaDigest('authority'),/^[a-f0-9]{64}$/);assert.match(currentE1SchemaDigest('receiver'),/^[a-f0-9]{64}$/)
})
