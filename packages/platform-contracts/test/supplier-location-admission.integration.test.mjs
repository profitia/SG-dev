import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {supplierLocationFixture} from './fixtures/supplier-location-postgres.mjs'
import {isOperationDenied} from '../src/operation-context.mjs'
const deny=e=>isOperationDenied(e)||e?.code==='42501'

test('P1 actual PostgreSQL16 ordinary-role CREATE and rolling ledger acceptance',async t=>{
 const f=await supplierLocationFixture(),sql=f.admin.query.bind(f.admin)
 const count=async op=>(await sql("SELECT count(*)::int AS n FROM profitia_requests.intents WHERE operation=$1 AND status='ACCEPTED'",[op])).rows[0].n
 const write='supplier.location.write',sync='supplier.location.sync',h=f.host(),first=f.input()
 const reject=async(host,input)=>assert.rejects(f.execute(host,input),deny)
 try{
  await t.test('no policy or parent permission is default-deny; no location effect',async()=>{
   await reject(h,first);assert.equal(await count(write),0)
   await f.policy(write)
   await reject(h,first);assert.equal(await count(write),0)
  })
  await t.test('NULL wildcard alone cannot enable opt-in CREATE',async()=>{
   await f.grant(write,{resource:null});await reject(h,first)
   await f.controlled(c=>c.query("DELETE FROM profitia_access.permission_grants WHERE resource_id IS NULL"))
  })
  await f.grant(write)
  await t.test('exact parent, signed server-assigned ID, audit and one accepted timestamp',async()=>{
   assert.equal(first.resourceId,f.port(0).locationId({organisationId:f.A,userId:f.U,supplierId:f.S,idempotencyKey:first.idempotencyKey}))
   assert.equal(h.contract.implementation,'1.0.0-candidate.17');assert.equal(h.hostContract.version,'1.12.0')
   const r=await f.execute(h,first);assert.equal(r.decision,'ALLOW')
   assert.equal((await f.execute(h,first)).value.requestId,r.value.requestId)
   assert.equal(await count(write),1)
   const row=(await sql('SELECT * FROM p1_domain.locations')).rows[0];assert.equal(row.organisation_id,f.A);assert.equal(row.created_by,f.U)
   const ledger=(await sql('SELECT accepted_at,created_at,location_admission FROM profitia_requests.intents')).rows[0]
   assert(ledger.accepted_at>=ledger.created_at);assert.equal(ledger.location_admission.action,'CREATE');assert.equal(ledger.location_admission.parent.collectionId,'supplier-locations:'+f.S)
   assert.equal((await sql("SELECT count(*)::int AS n FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'=$1",[write])).rows[0].n,2)
  })
  for(const[name,input]of[
   ['foreign organisation',()=>f.input({org:f.B})],['foreign supplier',()=>f.input({supplier:f.foreignSupplier})],
   ['client child substitution',()=>({...f.input(),resourceId:randomUUID()})],
   ['payload parent substitution',()=>{const i=f.input();i.payload.supplierId=f.foreignSupplier;return i}],
   ['changed-payload replay',()=>({...first,payload:{...first.payload,command:{label:'CHANGED'}}})],
  ])await t.test(name+' denied before accepted effect',()=>reject(h,input()))
  await t.test('missing old descriptor and forged server parent cannot opt into CREATE',async()=>{
   await reject(f.host({legacy:true}),f.input());await reject(f.host({wrongDigest:true}),f.input())
   await reject(f.host({overrideReadParent:async()=>({supplierId:f.S,organisationId:f.B,collectionId:'supplier-locations:'+f.S,version:'1'})}),f.input())
  })
  await t.test('parent CREATE does not grant UPDATE/DEACTIVATE; child CAS remains exact',async()=>{
   const update=f.input({action:'UPDATE',locationId:first.resourceId,expectedVersion:'1'})
   await reject(h,update);await f.grant(write,{resource:first.resourceId});await f.execute(h,update)
   await reject(h,f.input({action:'UPDATE',locationId:first.resourceId,expectedVersion:'1'}))
   await f.execute(h,f.input({action:'DEACTIVATE',locationId:first.resourceId,expectedVersion:'2'}))
   assert.equal((await sql('SELECT active FROM p1_domain.locations WHERE location_id=$1',[first.resourceId])).rows[0].active,false)
  })
  for(const[name,change,restore]of[
   ['membership',c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]),c=>c.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U])],
   ['product',c=>c.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[f.A]),c=>c.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[f.A])],
   ['module',c=>c.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='p1-app-0'"),c=>c.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='p1-app-0'")],
   ['expired identity',c=>c.query("UPDATE profitia_access.external_identities SET expires_at=now()-interval '1 second' WHERE user_id=$1",[f.U]),c=>c.query("UPDATE profitia_access.external_identities SET expires_at=now()+interval '1 hour' WHERE user_id=$1",[f.U])],
  ])await t.test('revoked/expired '+name+' denies even accepted replay',async()=>{await f.controlled(change);try{await reject(h,first)}finally{await f.controlled(restore)}})
  await t.test('DENY on exact child overrides parent CREATE and accepted replay',async()=>{
   await f.grant(write,{resource:first.resourceId,effect:'DENY'});try{await reject(h,first)}finally{await f.controlled(c=>c.query("DELETE FROM profitia_access.permission_grants WHERE effect='DENY'"))}
  })
  await t.test('ordinary role has no raw table DML, key read or forged transaction proof',async()=>{
   const c=await f.pools[0].connect();try{
    const role=(await c.query('SELECT current_user,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0]
    assert.equal(role.current_user,f.roles[0]);assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);assert.equal(role.rolinherit,false)
    await assert.rejects(c.query('SELECT proof_key FROM profitia_requests.location_admission_receivers'),e=>e.code==='42501')
    await assert.rejects(c.query('UPDATE p1_domain.locations SET label=$1',['FORGED']),e=>e.code==='42501')
    await c.query('BEGIN');await c.query("SELECT set_config('profitia.location.admission',$1,true),set_config('profitia.location.admission_signature',$2,true)",[JSON.stringify({action:'CREATE',organisationId:f.A,userId:f.U}),'f'.repeat(64)])
    assert.equal((await c.query('SELECT profitia_requests.bind_location_admission($1,$2) AS ok',['{}','f'.repeat(64)])).rows[0].ok,false)
    await c.query('ROLLBACK')
   }finally{c.release()}
  })
  await t.test('accidental broad ledger table grants fail closed instead of enabling CREATE',async()=>{
   await f.controlled(c=>c.query(`GRANT INSERT,UPDATE,DELETE ON profitia_requests.intents TO ${f.roles[0]}`))
   try{await reject(h,f.input());assert.equal((await f.pools[0].query('UPDATE profitia_requests.intents SET accepted_at=now()')).rowCount,0)}
   finally{await f.controlled(c=>c.query(`REVOKE INSERT,UPDATE,DELETE ON profitia_requests.intents FROM ${f.roles[0]}`))}
  })
  await t.test('business, projection and actual OUTCOME audit failures roll back effect and unit',async()=>{
   const n=await count(write),rows=(await sql('SELECT count(*)::int n FROM p1_domain.locations')).rows[0].n
   await assert.rejects(f.execute(h,f.input(),{fail:true}),deny)
   await reject(f.host({failOutcome:true}),f.input());await reject(f.host({failAudit:true}),f.input())
   assert.equal(await count(write),n);assert.equal((await sql('SELECT count(*)::int n FROM p1_domain.locations')).rows[0].n,rows)
  })
  await t.test('REPEATABLE READ cannot use a stale snapshot for rolling admission',()=>reject(f.host({isolation:'REPEATABLE READ'}),f.input()))
  await f.grant(write,{user:f.V});await f.grant(write,{app:1});await f.policy(write,{app:1})
  let winner
  await t.test('100/101 serialized across two real connections, users and executor applications',async()=>{
   while(await count(write)<99)await f.execute(h,f.input())
   const inputs=[f.input({user:f.V}),f.input({app:1})],hosts=[h,f.host({app:1})]
   const r=await Promise.allSettled(inputs.map((i,k)=>f.execute(hosts[k],i)))
   assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected').length,1)
   assert.equal(await count(write),100);const k=r.findIndex(x=>x.status==='fulfilled');winner={host:hosts[k],input:inputs[k]}
   await reject(h,f.input());assert.equal((await f.execute(winner.host,winner.input)).decision,'ALLOW');assert.equal(await count(write),100)
  })
  await t.test('rotation of policy ID does not reset an organisation quota or break accepted replay',async()=>{
   await f.controlled(c=>c.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE operation=$1 AND application_id='p1-app-0' AND status='ACTIVE'",[write]))
   await f.policy(write);await reject(h,f.input());assert.equal(await count(write),100)
   await f.execute(h,first);assert.equal(await count(write),100)
  })
  await t.test('moving boundary excludes exactly24h;101st lifetime operation is legal once old entries age out',async()=>{
   // Only the isolated test owner controls fixture timestamps; production admission always uses DB clock.
   await f.controlled(async c=>{await c.query('ALTER TABLE profitia_requests.intents DISABLE TRIGGER USER');await c.query("UPDATE profitia_requests.intents SET accepted_at=clock_timestamp()-interval '24 hours' WHERE operation=$1",[write]);await c.query('ALTER TABLE profitia_requests.intents ENABLE TRIGGER USER')})
   await f.execute(h,f.input());assert.equal(await count(write),101)
   assert.equal((await sql("SELECT sum(accepted_count)::text n FROM profitia_requests.policies WHERE operation=$1",[write])).rows[0].n,'101')
  })
  await t.test('historical ACCEPTED without accepted_at blocks rolling mode rather than dropping usage',async()=>{
   const id=(await sql('SELECT request_id FROM profitia_requests.intents WHERE operation=$1 LIMIT 1',[write])).rows[0].request_id
   await f.controlled(async c=>{await c.query('ALTER TABLE profitia_requests.intents DISABLE TRIGGER USER');await c.query('UPDATE profitia_requests.intents SET accepted_at=NULL WHERE request_id=$1',[id]);await c.query('ALTER TABLE profitia_requests.intents ENABLE TRIGGER USER')})
   try{await reject(h,f.input())}finally{await f.controlled(async c=>{await c.query('ALTER TABLE profitia_requests.intents DISABLE TRIGGER USER');await c.query("UPDATE profitia_requests.intents SET accepted_at=now()-interval '25 hours' WHERE request_id=$1",[id]);await c.query('ALTER TABLE profitia_requests.intents ENABLE TRIGGER USER')})}
  })
  await t.test('a policy cannot downgrade to FIXED to fork an established rolling budget',async()=>{
   await f.controlled(c=>c.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE operation=$1 AND application_id='p1-app-0' AND status='ACTIVE'",[write]))
   await f.policy(write,{mode:'FIXED'});await reject(h,f.input())
   await f.controlled(c=>c.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE operation=$1 AND application_id='p1-app-0' AND status='ACTIVE'",[write]));await f.policy(write)
  })
  const sh=f.host({operation:sync})
  await f.grant(sync);await f.grant('supplier.report.read',{resource:'p1-report'});await f.policy(sync)
  await t.test('stable source-version SYNC replay is zero;new version/no physical delta consumes one',async()=>{
   const i=f.input({action:'SYNC'});await f.execute(sh,i);await f.execute(sh,i);assert.equal(await count(sync),1)
   await f.setSourceVersion('v2');await f.execute(sh,f.input({action:'SYNC',sourceVersion:'v2'}));assert.equal(await count(sync),2)
   await reject(sh,f.input({action:'SYNC',sourceVersion:'FORGED_SOURCE'}));assert.equal(await count(sync),2)
  })
  await f.grant(sync,{user:f.V});await f.grant('supplier.report.read',{user:f.V,resource:'p1-report'});await f.grant(sync,{app:1});await f.grant('supplier.report.read',{app:1,resource:'p1-report'});await f.policy(sync,{app:1})
  await t.test('independent SYNC100/101 budget, users/executors, and no duplicate source effect',async()=>{
   let n=await count(sync)
   while(n<99){n++;const v='source-'+n;await f.setSourceVersion(v);await f.execute(sh,f.input({action:'SYNC',sourceVersion:v}))}
   await f.setSourceVersion('source-100')
   const inputs=[f.input({action:'SYNC',sourceVersion:'source-100',user:f.V}),f.input({action:'SYNC',sourceVersion:'source-100',app:1})]
   const hosts=[sh,f.host({operation:sync,app:1})];const r=await Promise.allSettled(inputs.map((i,k)=>f.execute(hosts[k],i)))
   assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(await count(sync),100);assert.equal(await count(write),101)
   const k=r.findIndex(x=>x.status==='fulfilled');await f.execute(hosts[k],inputs[k]);assert.equal(await count(sync),100)
  })
  await t.test('precise moving interval excludes lower boundary and includes next microsecond',async()=>{
   const id=(await sql('SELECT request_id FROM profitia_requests.intents WHERE operation=$1 LIMIT 1',[write])).rows[0].request_id
   const instant=(await sql("SELECT (clock_timestamp()+interval '1 minute')::text AS t")).rows[0].t
   const seed=async delta=>f.controlled(async c=>{await c.query('ALTER TABLE profitia_requests.intents DISABLE TRIGGER USER');await c.query("UPDATE profitia_requests.intents SET accepted_at=$1::timestamptz-interval '25 hours' WHERE operation=$2",[instant,write]);await c.query("UPDATE profitia_requests.intents SET accepted_at=$1::timestamptz-interval '24 hours'+$2::interval WHERE request_id=$3",[instant,delta,id]);await c.query('ALTER TABLE profitia_requests.intents ENABLE TRIGGER USER')})
   await seed('0 microseconds');assert.equal((await sql('SELECT profitia_requests.location_rolling_used($1,$2,$3) AS n',[f.A,write,instant])).rows[0].n,'0')
   await seed('1 microsecond');assert.equal((await sql('SELECT profitia_requests.location_rolling_used($1,$2,$3) AS n',[f.A,write,instant])).rows[0].n,'1')
   await seed('-1 second')
  })
  await t.test('an old reservation accepted now uses acceptance time and immutable timestamp',async()=>{
   await f.controlled(c=>c.query("CREATE FUNCTION p1_domain.old_reservation() RETURNS trigger LANGUAGE plpgsql AS $x$ BEGIN NEW.created_at:=clock_timestamp()-interval '25 hours';RETURN NEW;END $x$;CREATE TRIGGER a_fixture_old_reservation BEFORE INSERT ON profitia_requests.intents FOR EACH ROW EXECUTE FUNCTION p1_domain.old_reservation()"))
   const i=f.input()
   try{await f.execute(h,i)}finally{await f.controlled(c=>c.query('DROP TRIGGER a_fixture_old_reservation ON profitia_requests.intents;DROP FUNCTION p1_domain.old_reservation()'))}
   const r=(await sql('SELECT created_at,accepted_at FROM profitia_requests.intents WHERE resource_id=$1',[i.resourceId])).rows[0]
   assert(r.accepted_at-r.created_at>=25*3600000)
   await assert.rejects(f.pools[0].query("UPDATE profitia_requests.intents SET accepted_at=now()-interval '25 hours' WHERE resource_id=$1",[i.resourceId]),e=>e.code==='42501')
  })
  await t.test('same-key simultaneous calls commit one effect and one accepted unit',async()=>{
   const i=f.input(),n=await count(write),r=await Promise.all([f.execute(h,i),f.execute(h,i)])
   assert.equal(r[0].value.requestId,r[1].value.requestId);assert.equal(await count(write),n+1)
   assert.equal((await sql('SELECT count(*)::int n FROM p1_domain.locations WHERE location_id=$1',[i.resourceId])).rows[0].n,1)
  })
  await t.test('valid server proof cannot move to another transaction or runtime role',async()=>{
   let envelope,signature;const i=f.input()
   await h.execute(i,async(ctx,c)=>{const a=(await c.query("SELECT current_setting('profitia.location.admission') AS envelope,current_setting('profitia.location.admission_signature') AS signature")).rows[0];envelope=a.envelope;signature=a.signature;return{requestId:ctx.requestReservation.requestId,status:'ACCEPTED'}})
   for(const pool of f.pools){const c=await pool.connect();try{await c.query('BEGIN');assert.equal((await c.query('SELECT profitia_requests.bind_location_admission($1::jsonb,$2) AS allowed',[envelope,signature])).rows[0].allowed,false);await c.query('ROLLBACK')}finally{c.release()}}
  })
  await t.test('expired5second server proof rolls back without acceptance or domain effect',async()=>{
   const i=f.input(),n=await count(write)
   await assert.rejects(h.execute(i,async(ctx,c)=>{await c.query('SELECT pg_sleep(5.1)');await c.query('SELECT p1_domain.mutate($1,$2,$3,$4,$5,$6,$7)',[ctx.organisationId,i.payload.supplierId,ctx.resourceId,ctx.actorId,'CREATE',null,i.payload.command.label]);return{requestId:ctx.requestReservation.requestId,status:'ACCEPTED'}}),deny)
   assert.equal(await count(write),n);assert.equal((await sql('SELECT count(*)::int n FROM p1_domain.locations WHERE location_id=$1',[i.resourceId])).rows[0].n,0)
  })
  await t.test('unchanged legacy exact-child FIXED policy accepts2,replays free and denies3',async()=>{
   await f.policy(write,{org:f.B,mode:'FIXED',capacity:2});const legacy=f.host({legacy:true}),one=f.input({org:f.B,supplier:f.foreignSupplier}),two=f.input({org:f.B,supplier:f.foreignSupplier}),three=f.input({org:f.B,supplier:f.foreignSupplier})
   for(const i of[one,two,three])await f.grant(write,{org:f.B,resource:i.resourceId})
   const run=i=>legacy.execute(i,async ctx=>({requestId:ctx.requestReservation.requestId,status:'ACCEPTED'}))
   await run(one);await run(two);await run(one);await assert.rejects(run(three),deny)
   assert.equal((await sql("SELECT accepted_count::text n FROM profitia_requests.policies WHERE organisation_id=$1 AND operation=$2",[f.B,write])).rows[0].n,'2')
  })
  await t.test('new additive migration leaves SQL001-019 provenance and existing FIXED policies intact',async()=>{
   assert.equal((await sql("SELECT data_type FROM information_schema.columns WHERE table_schema='profitia_requests' AND table_name='policies' AND column_name='accepted_count'")).rows[0].data_type,'bigint')
   assert.equal((await sql("SELECT count(*)::int n FROM profitia_requests.policies WHERE accepted_count<0")).rows[0].n,0)
   assert.equal((await sql("SELECT count(*)::int n FROM profitia_requests.intents WHERE operation IN($1,$2) AND accepted_at IS NULL",[write,sync])).rows[0].n,0)
  })
 }finally{await f.close()}
})
