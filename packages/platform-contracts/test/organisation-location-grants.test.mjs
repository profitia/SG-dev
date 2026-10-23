import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {supplierLocationFixture} from './fixtures/supplier-location-postgres.mjs'
const source=fs.readFileSync(new URL('../migrations/access/022-organisation-location-grants.sql',import.meta.url),'utf8')
const hash=createHash('sha256').update(source).digest('hex')
test('optional organisation location authority uses actual PostgreSQL and unchanged E1 host',async t=>{
 const f=await supplierLocationFixture(),write='supplier.location.write',collection='supplier-locations:'+f.S
 const denied=async input=>assert.rejects(f.execute(f.host(),input))
 const rows=async(sql,args=[])=>(await f.admin.query(sql,args)).rows
 const permissions=async(user=f.U,org=f.A,app='p1-app-0')=>rows('SELECT * FROM profitia_access.organisation_location_permissions($1,$2,$3)',[app,org,user])
 let policy,created
 try{
  await t.test('installation rollback restores three original functions and leaves no policy table',async()=>f.controlled(async c=>{
   const old=await c.query("SELECT oid,proowner,proacl,pg_get_functiondef(oid) AS body FROM pg_proc WHERE oid IN('profitia_access.lock_access(uuid,uuid,text,text,text)'::regprocedure,'profitia_requests.location_permission(text,uuid,uuid,text,text)'::regprocedure,'profitia_requests.location_access(text,uuid,uuid,text)'::regprocedure) ORDER BY oid")
   await c.query('SAVEPOINT addon');await c.query(source);await c.query('ROLLBACK TO SAVEPOINT addon')
   assert.equal((await c.query("SELECT to_regclass('profitia_access.organisation_location_policies') AS value")).rows[0].value,null)
   assert.deepEqual((await c.query("SELECT oid,proowner,proacl,pg_get_functiondef(oid) AS body FROM pg_proc WHERE oid=ANY($1::oid[]) ORDER BY oid",[old.rows.map(r=>r.oid)])).rows,old.rows)
   await c.query(source);await c.query("INSERT INTO profitia_access.organisation_location_installation VALUES(true,'1.0.0',$1,$2)",[hash,'a'.repeat(40)])
  }))
  await f.policy(write)
  await t.test('empty opt-in retains default denial',async()=>{assert.equal((await permissions()).length,0);await denied(f.input())})
  await t.test('ordinary role cannot seed policy, child identity or invoke authority helper',async()=>{
   for(const sql of ["SELECT * FROM profitia_access.organisation_location_policies","INSERT INTO profitia_access.organisation_location_children VALUES('p1-app-0',$1,$2,$3)",'SELECT * FROM profitia_access.organisation_location_permissions($1,$2,$3)']){
    await assert.rejects(f.pools[0].query(sql,sql.includes('VALUES')?[f.A,collection,randomUUID()]:sql.includes('permissions')?['p1-app-0',f.A,f.U]:[]))
   }
   const r=await rows("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN('profitia_access.organisation_location_installation'::regclass,'profitia_access.organisation_location_policies'::regclass,'profitia_access.organisation_location_children'::regclass)")
   assert.equal(r.length,3);assert(r.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
  })
  await t.test('exact finite policy requires no user grant, and changes only selected application/org/resource',async()=>{
   policy=randomUUID();await f.controlled(c=>c.query("INSERT INTO profitia_access.organisation_location_policies(policy_id,application_id,organisation_id,operation,resource_id,status,source_ref,expires_at) VALUES($1,'p1-app-0',$2,$3,$4,'ACTIVE','SYNTHETIC_EXPLICIT_OWNER',now()+interval '1 hour')",[policy,f.A,write,collection]))
   assert.deepEqual((await permissions()).map(r=>r.resource_id),[collection]);assert.equal((await permissions(f.U,f.B)).length,0);assert.equal((await permissions(f.U,f.A,'p1-app-1')).length,0)
   assert.equal((await rows("SELECT count(*)::int AS n FROM profitia_access.permission_grants WHERE operation=$1",[write]))[0].n,0)
  })
  await t.test('protected CREATE registers exact child metadata atomically without invalidating E1 lease',async()=>{
   await f.controlled(c=>c.query(`CREATE FUNCTION p1_domain.register_location_child() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN INSERT INTO profitia_access.organisation_location_children VALUES('p1-app-0',NEW.organisation_id,'supplier-locations:'||NEW.supplier_id,NEW.location_id);RETURN NEW;END $fn$; REVOKE ALL ON FUNCTION p1_domain.register_location_child() FROM PUBLIC; CREATE TRIGGER register_child AFTER INSERT ON p1_domain.locations FOR EACH ROW EXECUTE FUNCTION p1_domain.register_location_child()`))
   created=f.input();assert.equal((await f.execute(f.host(),created)).decision,'ALLOW');assert.equal((await f.execute(f.host(),created)).decision,'ALLOW')
   assert((await permissions()).some(r=>r.resource_id===created.resourceId));assert(!(await permissions(f.U,f.B)).some(r=>r.resource_id===created.resourceId))
  })
  await t.test('another current member can update the same organization-owned manual child',async()=>{
   const i=f.input({user:f.V,action:'UPDATE',locationId:created.resourceId,expectedVersion:'1',label:'UPDATED_BY_SECOND_MEMBER'})
   assert.equal((await f.execute(f.host(),i)).decision,'ALLOW')
   const row=(await rows('SELECT created_by,edited_by FROM p1_domain.locations WHERE location_id=$1',[created.resourceId]))[0]
   assert.equal(row.created_by,f.U);assert.equal(row.edited_by,f.V)
  })
  await t.test('a future legally provisioned member inherits without a policy edit',async()=>{
   const user=randomUUID();await f.controlled(async c=>{
    await c.query("INSERT INTO profitia_access.accounts VALUES($1,'ACTIVE',1)",[user]);await c.query("INSERT INTO profitia_access.external_identities VALUES($1,'https://p1.fixture.test',$2,$3,'ACTIVE',1,'SYNTHETIC',now()+interval '1 hour')",[randomUUID(),'subject-'+user,user]);await c.query("INSERT INTO profitia_access.memberships VALUES($1,$2,'ACTIVE',1,'SYNTHETIC',now()+interval '1 hour')",[f.A,user])
   })
   assert((await permissions(user)).some(r=>r.resource_id===created.resourceId))
   assert.equal((await f.execute(f.host(),f.input({user}))).decision,'ALLOW')
   await f.controlled(c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,user]))
   assert.equal((await permissions(user)).length,0);await denied(f.input({user}))
  })
  await t.test('explicit parent DENY also blocks inherited child; exact child DENY blocks only that child',async()=>{
   await f.grant(write,{user:f.V,effect:'DENY'});assert.equal((await permissions(f.V)).length,0)
   await denied(f.input({user:f.V,action:'UPDATE',locationId:created.resourceId,expectedVersion:'2'}))
   await f.controlled(c=>c.query("DELETE FROM profitia_access.permission_grants WHERE effect='DENY'"))
   await f.grant(write,{resource:created.resourceId,effect:'DENY'});await denied(f.input({action:'UPDATE',locationId:created.resourceId,expectedVersion:'2'}))
   await f.controlled(c=>c.query("DELETE FROM profitia_access.permission_grants WHERE effect='DENY'"))
  })
  await t.test('foreign org/supplier, expired policy and revoked policy refuse before effect',async()=>{
   await denied(f.input({org:f.B}));await denied(f.input({supplier:f.foreignSupplier}))
   for(const patch of ["expires_at=now()-interval '1 second'","expires_at=now()+interval '1 hour',status='REVOKED'"]){await f.controlled(c=>c.query('UPDATE profitia_access.organisation_location_policies SET '+patch+' WHERE policy_id=$1',[policy]));assert.equal((await permissions()).length,0);await denied(f.input())}
   await f.controlled(c=>c.query("UPDATE profitia_access.organisation_location_policies SET status='ACTIVE' WHERE policy_id=$1",[policy]))
  })
  await t.test('membership, account, product and module revocation retain the original E1 fences',async()=>{
   for(const [off,on]of [
    ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2"],
    ["UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$2 AND $1::uuid IS NOT NULL","UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$2 AND $1::uuid IS NOT NULL"],
    ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1 AND $2::uuid IS NOT NULL","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1 AND $2::uuid IS NOT NULL"],
    ["UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='p1-app-0' AND $1::uuid IS NOT NULL AND $2::uuid IS NOT NULL","UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='p1-app-0' AND $1::uuid IS NOT NULL AND $2::uuid IS NOT NULL"]
   ]){await f.controlled(c=>c.query(off,[f.A,f.U]));await denied(f.input());await f.controlled(c=>c.query(on,[f.A,f.U]))}
  })
  await t.test('DEACTIVATE works with inherited exact child permission and keeps original author',async()=>{
   assert.equal((await f.execute(f.host(),f.input({action:'DEACTIVATE',locationId:created.resourceId,expectedVersion:'2'}))).decision,'ALLOW')
   const row=(await rows('SELECT active,created_by FROM p1_domain.locations WHERE location_id=$1',[created.resourceId]))[0];assert.equal(row.active,false);assert.equal(row.created_by,f.U)
  })
  await t.test('output or audit failure rolls back new child and metadata together',async()=>{
   for(const h of[f.host({failOutcome:true}),f.host({failAudit:true})]){const i=f.input();await assert.rejects(f.execute(h,i));assert.equal((await rows('SELECT count(*)::int AS n FROM profitia_access.organisation_location_children WHERE location_id=$1',[i.resourceId]))[0].n,0)}
  })
  await t.test('no wildcard/geocode/foreign policy identity mutation is possible',async()=>{
   for(const [op,r]of [[write,null],[write,'*'],['supplier.location.geocode',collection]])await assert.rejects(f.controlled(c=>c.query("INSERT INTO profitia_access.organisation_location_policies(application_id,organisation_id,operation,resource_id,status,source_ref,expires_at) VALUES('p1-app-0',$1,$2,$3,'ACTIVE','SYNTHETIC',now()+interval '1 hour')",[f.A,op,r])))
   await assert.rejects(f.controlled(c=>c.query('UPDATE profitia_access.organisation_location_policies SET organisation_id=$1 WHERE policy_id=$2',[f.B,policy])))
  })
 }finally{await f.close()}
})
