import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '@profitia/platform-contracts/identity-provisioning'
import {moduleSchemaDigest,moduleSchemaUrl} from '@profitia/platform-contracts/module-scope'
import {moduleAuditSchemaDigest,moduleAuditSchemaUrl} from '@profitia/platform-contracts/access-store'
import {OPERATION_CONTRACT} from '@profitia/platform-contracts/operation-context'
import {createSrmPrivateOperationHost} from '../src/server/private-operation-host.ts'
import {organisationRegistrationSchemaDigest,organisationRegistrationPlan} from '../db/private-store/organisation-registration.mjs'
const sqlUrl=new URL('../db/private-store/035-organisation-registration.sql',import.meta.url)
test('registered organisations initialize inside actual SRM HUMAN Root with no direct runtime insert right',{timeout:60000},async t=>{
 const db=await postgresFixture();let audit
 t.after(async()=>{await audit?.end();await db.close()})
 const actor=clerkFixture('user_srm_registration'),other=clerkFixture('user_srm_foreign')
 const {userId}=await createIdentityProvisioner(db.options(actor)).ensureAccount(actor.request('POST'))
 const foreign=await createIdentityProvisioner(db.options(other)).ensureAccount(other.request('POST'))
 for(const f of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql'])
  await db.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+f,import.meta.url),'utf8'))
 await db.admin.query(fs.readFileSync(new URL(moduleSchemaUrl),'utf8'))
 await db.admin.query("INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",[await moduleSchemaDigest()])
 await db.admin.query(fs.readFileSync(new URL(moduleAuditSchemaUrl),'utf8'))
 await db.admin.query("INSERT INTO profitia_modules.audit_installation VALUES(true,'1.0.0',$1,'synthetic-registration-test')",[await moduleAuditSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_access.applications VALUES('srm','ACTIVE',NULL)")
 await db.admin.query("UPDATE profitia_access.runtime_bindings SET application_id='srm' WHERE login_role=$1",[db.binding.role])
 await db.admin.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','synthetic-module',clock_timestamp()+interval '1 hour')",[randomUUID()])
 await db.admin.query("GRANT USAGE ON SCHEMA profitia_modules TO identity_b1_runtime; GRANT EXECUTE ON FUNCTION profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor() TO identity_b1_runtime")
 const foundation=fs.readFileSync(new URL('../db/migrations/0001_xray_foundation.sql',import.meta.url),'utf8')
 const table=foundation.slice(foundation.indexOf('CREATE TABLE srm.organizations ('),foundation.indexOf('CREATE TABLE srm.suppliers ('))
 await db.admin.query('CREATE SCHEMA srm AUTHORIZATION profitia_access_owner;'+table)
 await db.admin.query("ALTER TABLE srm.organizations ENABLE ROW LEVEL SECURITY; ALTER TABLE srm.organizations FORCE ROW LEVEL SECURITY; CREATE POLICY controlled_owner ON srm.organizations TO profitia_access_owner USING(true) WITH CHECK(true); CREATE POLICY private_scope ON srm.organizations TO identity_b1_runtime USING(profitia_modules.scope_allows('supplier_report',id)) WITH CHECK(profitia_modules.scope_allows('supplier_report',id)); GRANT USAGE ON SCHEMA srm TO identity_b1_runtime; GRANT SELECT ON srm.organizations TO identity_b1_runtime")
 await db.admin.query(fs.readFileSync(sqlUrl,'utf8'))
 await db.admin.query('INSERT INTO srm.organisation_registration_installation VALUES(true,$1)',[organisationRegistrationSchemaDigest()])
 await db.admin.query('GRANT EXECUTE ON FUNCTION srm.ensure_registered_organisation(uuid,text,uuid) TO identity_b1_runtime')
 const [a,b,c]=[randomUUID(),randomUUID(),randomUUID()]
 for(const [org,nip,uid]of [[a,'1234563218',userId],[b,'5260250274',userId],[c,'5252248481',foreign.userId]]){
  await db.admin.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE')",[org])
  await db.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','synthetic-member',clock_timestamp()+interval '1 hour')",[org,uid])
  await db.admin.query("INSERT INTO profitia_profile.organisation_profiles(organisation_id,country,nip,slug,company,registry_ref,registry_version,industry,team_range,created_by) VALUES($1,'PL',$2,$3,'{}','synthetic','v1','{}','{}',$4)",[org,nip,'synthetic-'+org,uid])
  await db.admin.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','synthetic-offer',clock_timestamp()+interval '1 hour')",[org])
  await db.admin.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.project','supplier_report')",[randomUUID(),org,uid])
  await db.admin.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),org,uid])
 }
 const base=db.options(actor),binding={...db.binding,applicationId:'srm'}
 audit=new pg.Pool({...db.config,user:db.binding.role,max:1})
 const host=createSrmPrivateOperationHost({pool:db.pool,auditPool:audit,clerk:actor.client,binding,
  application:{...base.application,appId:'srm',features:['supplier_report'],operations:['supplier.report.read','supplier.report.project']},
  identity:{...base.identityApplication,appId:'srm'},
  module:{id:'supplier_report',schemaDigest:await moduleSchemaDigest(),auditSchemaDigest:await moduleAuditSchemaDigest()},
  readResources:async({scope})=>({resource:{id:'supplier-report:COMPANY:1234563218',type:'supplier_projection',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:null,version:'1',projectionVersion:'synthetic-v1'},inputs:[{id:'stored-financial-view:COMPANY:1234563218',type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'synthetic-public-v1',projectionVersion:'synthetic-public-v1',approvedSharedProjection:true}]}),
  projectOutput:value=>value})
 const executed=[]
 const run=(org,fail=false)=>host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.project',organisationId:org,resourceId:'supplier-report:COMPANY:1234563218',payload:{nip:'1234563218',entityType:'COMPANY'},request:actor.request('POST')},async()=>{executed.push(org);if(fail)throw Error('synthetic-business-rollback');return {ok:true}})
 const rows=async()=> (await db.admin.query('SELECT id,slug FROM srm.organizations ORDER BY id')).rows
 await t.test('raw queries and a caller-selected organisation cannot initialize any tenant',async()=>{
  await assert.rejects(db.pool.query('SELECT srm.ensure_registered_organisation($1,$2,$3)',[a,organisationRegistrationSchemaDigest(),randomUUID()]))
  await assert.rejects(db.pool.query("INSERT INTO srm.organizations(id,slug) VALUES($1,'forged')",[a]))
  await assert.rejects(run(c));assert.deepEqual(await rows(),[])
 })
 await t.test('first actual Root initializes exactly its canonical ID, and a later business failure rolls back initialization',async()=>{
  assert.deepEqual((await run(a)).value,{ok:true});assert.deepEqual(await rows(),[{id:a,slug:'org-'+a}])
  await assert.rejects(run(b,true));assert(executed.includes(b),'business callback ran before rollback');assert.deepEqual(await rows(),[{id:a,slug:'org-'+a}])
 })
 await t.test('concurrent retries are idempotent and preserve existing internal domain labels',async()=>{
  await Promise.all([run(b),run(b)])
  await db.admin.query("UPDATE srm.organizations SET slug='existing-label' WHERE id=$1",[a])
  await run(a);const all=await rows();assert.equal(all.length,2);assert.equal(all.find(r=>r.id===a).slug,'existing-label');assert.equal(all.find(r=>r.id===b).slug,'org-'+b)
 })
 await t.test('revoked membership, product and installation digest prevent preparation',async()=>{
  const before=await rows()
  await db.admin.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1",[b]);await assert.rejects(run(b))
  await db.admin.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[a]);await assert.rejects(run(a))
  await db.admin.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[a])
  await db.admin.query("UPDATE srm.organisation_registration_installation SET schema_digest=$1",['0'.repeat(64)]);await assert.rejects(run(a))
  assert.deepEqual(await rows(),before)
 })
})
test('installation plan rejects a foreign or non-Development destination and grants only the bounded function',()=>{
 const target=JSON.parse(fs.readFileSync(new URL('../deployment/private-runtime-targets.json',import.meta.url))).environments.development
 const binding={environment:'development',projectId:target.projectId,branchId:target.branchId,databaseName:target.databaseName,role:target.runtimeRole}
 const plan=organisationRegistrationPlan({binding,sourceSha:'a'.repeat(40)})
 assert.equal(plan.schemaDigest,organisationRegistrationSchemaDigest());assert.equal(plan.sql.length,3)
 assert(!plan.sql.some(s=>/GRANT INSERT|GRANT UPDATE/.test(s)))
 for(const change of [{environment:'production'},{role:'neondb_owner'},{projectId:'foreign'},{branchId:'foreign'},{databaseName:'foreign'}])
  assert.throws(()=>organisationRegistrationPlan({binding:{...binding,...change},sourceSha:'a'.repeat(40)}))
})
