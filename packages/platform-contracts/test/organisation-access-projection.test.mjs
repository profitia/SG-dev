import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createOrganisationLifecycleBackend,createOrganisationLifecycleSql,organisationLifecycleSchemaDigest,organisationAccessProjectionSchemaDigest} from '../src/organisation-lifecycle.mjs'
import {ORGANISATION_LIFECYCLE_OPERATIONS,OPERATION_CONTRACT,IMPLEMENTED_OPERATIONS} from '../src/operation-context.mjs'
import {createPrivateOperationHost} from '../src/private-operation-host.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'
import {organisationOnboardingSchemaDigest} from '../src/organisation-profile.mjs'
import {organisationBootstrapSchemaDigest} from '../src/organisation-bootstrap.mjs'

test('genuine Root projection grants only current own scoped package leases and preserves independent rights',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 for(const file of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql','010-organisation-access-projection.sql'])await db.admin.query(fs.readFileSync(new URL('../migrations/profile/'+file,import.meta.url),'utf8'))
 for(const [table,values] of [
 ['organisation_onboarding_installation',[true,'1.0.0',organisationOnboardingSchemaDigest()]],
 ['organisation_bootstrap_installation',[true,'1.0.0',organisationBootstrapSchemaDigest()]],
 ['organisation_lifecycle_installation',[true,'1.0.0',organisationLifecycleSchemaDigest()]],
 ['organisation_access_installation',[true,organisationAccessProjectionSchemaDigest()]]]){
  await db.admin.query('INSERT INTO profitia_profile.'+table+' VALUES('+values.map((_,i)=>'$'+(i+1)).join(',')+')',values)
 }
 const actor=clerkFixture('user_access_projection'),options=db.options(actor)
 const {userId}=await createIdentityProvisioner(options).ensureAccount(actor.request('POST'))
 const org=randomUUID(),otherOrg=randomUUID(),policyId=randomUUID(),op='organisation.access.synchronise'
 await db.admin.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[org,otherOrg])
 await db.admin.query("INSERT INTO profitia_access.applications VALUES('spendguru','ACTIVE',NULL)")
 await db.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','synthetic-member',clock_timestamp()+interval '1 hour')",[org,userId])
 await db.admin.query("INSERT INTO profitia_profile.organisation_profiles(organisation_id,country,nip,slug,company,registry_ref,registry_version,industry,team_range,created_by) VALUES($1,'PL','1234563218','projection-company',$2::jsonb,'synthetic-registry','one','{\"id\":\"construction\",\"label\":\"Budownictwo\"}','{\"id\":\"1-5\",\"label\":\"1–5\"}',$3)",[org,JSON.stringify({entityType:'COMPANY',country:'PL',nip:'1234563218',krs:'0000123456',regon:'123456789',legalName:'Synthetic Projection S.A.',address:'Testowa 1',postalCode:'00-001'}),userId])
 await db.admin.query("INSERT INTO profitia_profile.organisation_user_context VALUES($1,$2)",[userId,org])
 await db.admin.query("INSERT INTO profitia_access.permission_grants VALUES($1,$2,$3,$4,'ALLOW',$5,'organisation_admin',NULL)",[randomUUID(),db.binding.applicationId,org,userId,op])
 const deny=randomUUID()
 await db.admin.query("INSERT INTO profitia_access.permission_grants VALUES($1,'spendguru',$2,$3,'DENY','benchmark.selection.write','benchmark',NULL)",[deny,org,userId])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_policies(login_role,enabled,policy_id,source_ref,expires_at,membership_expires_at,operations) VALUES('identity_b1_runtime',true,$1,'synthetic-lifecycle',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour',$2::jsonb)",[randomUUID(),JSON.stringify(ORGANISATION_LIFECYCLE_OPERATIONS)])
 const mappings=[{capabilityId:'BENCHMARK',applicationId:'spendguru',product:'SPENDGURU',feature:'benchmark',operations:['benchmark.selection.read','benchmark.selection.write']}]
 await db.admin.query("INSERT INTO profitia_profile.organisation_access_policies VALUES('identity_b1_runtime',false,$1,1,'synthetic-package-policy',clock_timestamp()+interval '1 hour',$2::jsonb)",[policyId,JSON.stringify(mappings)])
 const funcs=(await db.admin.query("SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_profile' AND(p.proname LIKE 'organisation_lifecycle_%' OR p.proname='organisation_access_descriptor')")).rows
 for(const {signature}of funcs)await db.admin.query('GRANT EXECUTE ON FUNCTION '+signature+' TO identity_b1_runtime')
 const backend=createOrganisationLifecycleBackend({...options,application:{...options.application,features:['organisation_admin'],operations:[op]}})
 const sql=createOrganisationLifecycleSql({...options,issuer:actor.issuer})
 const assignmentRef='package-assignment:'+randomUUID()+':1'
 const snapshot=()=>({status:'ACTIVE',userId,organisationId:org,applicationId:'spendguru',assignmentRef,capabilities:['BENCHMARK'],expiresAt:new Date(Date.now()+4000).toISOString(),assignmentUntil:new Date(Date.now()+60000).toISOString()})
 const run=(value,rollback=false)=>backend.execute(actor.request('POST'),op,{},async unit=>{
  const body=JSON.stringify(value),proof=await sql.attest(unit.query,{operation:op+'.commit',principal:userId,issuer:createHash('sha256').update(body).digest('hex'),expiresAt:Date.parse(unit.expiresAt)})
  const result=(await unit.query('SELECT profitia_profile.organisation_lifecycle_access_project($1,$2::bigint,$3,$4::uuid) AS result',[body,proof.until,proof.signature,unit.context.decisionId])).rows[0].result
  if(rollback)throw Error('synthetic outcome failure')
  return result
 })
 await t.test('disabled policy and ordinary direct reads/writes fail closed',async()=>{
  await assert.rejects(run(snapshot()))
  for(const q of ["SELECT * FROM profitia_profile.organisation_access_policies","SELECT * FROM profitia_access.product_grants","SELECT profitia_profile.organisation_lifecycle_access_project('{}',1,'forged',gen_random_uuid())"])await assert.rejects(db.pool.query(q))
 })
 await db.admin.query('UPDATE profitia_profile.organisation_access_policies SET enabled=true')
 await t.test('actual Root intent creates a short lease and explicit permissions, retaining DENY',async()=>{
  const before=Date.now(),r=await run(snapshot());assert.equal(r.status,'SYNCHRONISED')
  const g=(await db.admin.query("SELECT * FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=$1",[org])).rows[0]
  assert.equal(g.source_ref,assignmentRef);assert.equal(g.status,'ACTIVE');assert.deepEqual(g.features,['benchmark'])
  assert(g.expires_at.getTime()<=Date.now()+30000);assert(g.expires_at.getTime()>before)
  assert.equal((await db.admin.query("SELECT count(*)::int AS n FROM profitia_access.permission_grants WHERE application_id='spendguru' AND organisation_id=$1 AND user_id=$2 AND effect='ALLOW'",[org,userId])).rows[0].n,2)
  assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM profitia_access.permission_grants WHERE grant_id=$1 AND effect=\'DENY\'',[deny])).rows[0].n,1)
 })
 await t.test('unchanged current leases do not rewrite authority or duplicate member permissions',async()=>{
  const before=(await db.admin.query("SELECT revision::text AS revision FROM profitia_access.installation WHERE singleton")).rows[0].revision
  assert.equal((await run(snapshot())).status,'SYNCHRONISED')
  assert.equal((await db.admin.query("SELECT revision::text AS revision FROM profitia_access.installation WHERE singleton")).rows[0].revision,before)
 })
 await t.test('unchanged application Root enforces the projected product, original DENY and passive expiry',async()=>{
  assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16')
  assert.equal(IMPLEMENTED_OPERATIONS.includes(op),false)
  await db.admin.query('RESET ROLE;CREATE ROLE spendguru_projection_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;SET ROLE profitia_access_owner')
  await db.admin.query("INSERT INTO profitia_access.runtime_bindings VALUES('spendguru_projection_runtime','spendguru','ACTIVE')")
  await db.admin.query('GRANT USAGE ON SCHEMA profitia_access TO spendguru_projection_runtime')
  await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb) TO spendguru_projection_runtime')
  const pool=new db.pool.constructor({...db.config,user:'spendguru_projection_runtime',max:4});t.after(()=>pool.end())
  const transact=async(run,limits)=>{
   const c=await pool.connect();let timer,closed=false
   try{await c.query('BEGIN');const result=await Promise.race([run({query:async(q,v)=>{if(closed)throw Error('closed');return c.query(q,v)},transaction:c}),
    new Promise((_,reject)=>{timer=setTimeout(()=>{closed=true;reject(Error('fixture transaction deadline'))},limits.timeoutMs)})]);if(closed)throw Error('closed');await c.query('COMMIT');return result}
   catch(error){closed=true;await c.query('ROLLBACK');throw error}finally{closed=true;clearTimeout(timer);c.release()}
  }
  const host=createPrivateOperationHost({application:{...options.application,appId:'spendguru',features:['benchmark'],operations:['benchmark.selection.read','benchmark.selection.write']},
   binding:{...db.binding,applicationId:'spendguru',role:'spendguru_projection_runtime'},independentQuery:(q,v)=>pool.query(q,v),transact,
   createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:actor.client,application:{...options.identityApplication,appId:'spendguru'},resolveBinding}),
   readResources:async({scope})=>({resource:{id:'synthetic-selection',type:'benchmark_selection',dataClass:'ORGANISATION_PRIVATE',environment:'development',
    ownerOrganisationId:scope.organisationId,ownerUserId:null,version:'1',projectionVersion:'synthetic-v1'}}),projectOutput:v=>v})
  const request=operation=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,organisationId:org,resourceId:'synthetic-selection',operation,payload:{},request:actor.request('GET')})
  assert.equal((await host.execute(request('benchmark.selection.read'),async()=>({status:'SYNTHETIC_AUTHORISED_READ'}))).value.status,'SYNTHETIC_AUTHORISED_READ')
  let written=false;await assert.rejects(host.execute(request('benchmark.selection.write'),async()=>{written=true;return {}}),e=>e.reasonCode==='PERMISSION_DENIED');assert.equal(written,false)
  await run({...snapshot(),assignmentUntil:new Date(Date.now()+2000).toISOString()})
  await new Promise(resolve=>setTimeout(resolve,2300))
  await assert.rejects(host.execute(request('benchmark.selection.read'),async()=>({})),e=>e.reasonCode==='PRODUCT_UNAVAILABLE')
  await run(snapshot())
 })
 await t.test('foreign, expired, tampered, widened and malformed inputs cannot create authority',async()=>{
  for(const edit of [s=>s.organisationId=otherOrg,s=>s.userId=randomUUID(),s=>s.applicationId='srm',s=>s.expiresAt=new Date(Date.now()-1).toISOString(),s=>s.capabilities=['ADMIN'],s=>s.extra=true,s=>s.status=null]){
   const s=snapshot();edit(s);await assert.rejects(run(s))
  }
  await assert.rejects(backend.execute(actor.request('POST'),op,{organisationId:otherOrg},async()=>{}))
  assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM profitia_access.product_grants WHERE organisation_id=$1',[otherOrg])).rows[0].n,0)
 })
 await t.test('post-effect failure rolls back grant and revision together',async()=>{
  const before=(await db.admin.query("SELECT row_to_json(g) AS data FROM profitia_access.product_grants g WHERE organisation_id=$1",[org])).rows[0].data
  await assert.rejects(run({...snapshot(),assignmentRef:assignmentRef.replace(/:1$/,':2')},true))
  assert.deepEqual((await db.admin.query("SELECT row_to_json(g) AS data FROM profitia_access.product_grants g WHERE organisation_id=$1",[org])).rows[0].data,before)
 })
 await t.test('inactive current assignment revokes the managed lease and cannot renew it',async()=>{
  const r=await run({...snapshot(),status:'INACTIVE',assignmentRef:null,capabilities:[],assignmentUntil:null});assert.equal(r.status,'PENDING_PACKAGE')
  const g=(await db.admin.query('SELECT status,expires_at FROM profitia_access.product_grants WHERE organisation_id=$1',[org])).rows[0]
  assert.equal(g.status,'REVOKED');assert(g.expires_at.getTime()<=Date.now())
  assert.equal((await run(snapshot())).status,'SYNCHRONISED')
 })
 await t.test('independent commercial changes are preserved and require reconciliation',async()=>{
  await db.admin.query("UPDATE profitia_access.product_grants SET source_ref='independent-contract',source='CONTRACT' WHERE organisation_id=$1",[org])
  assert.equal((await run(snapshot())).status,'RECONCILIATION_REQUIRED')
  assert.equal((await db.admin.query('SELECT source_ref FROM profitia_access.product_grants WHERE organisation_id=$1',[org])).rows[0].source_ref,'independent-contract')
 })
 await t.test('revoked current account never reaches projection',async()=>{
  actor.active=false;await assert.rejects(run(snapshot()));actor.active=true
 })
})
