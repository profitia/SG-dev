import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createAccessStore,DATABASE_SERVICE_ISSUER,serviceReadSchemaDigest} from '../../../packages/platform-contracts/src/access-store.mjs'
import {createServiceReadHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'

const DATABASE='platform_service_read_test',APP='service-read-fixture'
const ROLE='platform_service_read_runtime',OTHER='platform_service_read_unknown'
const ORG_A='11111111-1111-4111-8111-111111111111',ORG_B='22222222-2222-4222-8222-222222222222'
const SERVICE='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',BINDING='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','004-initial-directory.sql','005-service-read.sql']
const sql=files.map(name=>fs.readFileSync(new URL(`../../../packages/platform-contracts/migrations/access/${name}`,import.meta.url),'utf8'))
const hash=value=>createHash('sha256').update(value).digest('hex')
const deny=e=>isOperationDenied(e)
const operations={'knowledge.read':['market','market_knowledge','SPENDGURU'],'forecast.read':['forecast','market_forecast','SPENDGURU'],'supplier.report.read':['supplier_report','supplier_report','SUPPLIER_INTELLIGENCE']}

test('database service reads use the existing executor with real ordinary SQL identity and current grants',async t=>{
  const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new pg.Client({connectionString:rootUrl});await root.connect()
  let owner,pool,auditPool,otherPool
  try{
    if(!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount)await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
    for(const [role,login]of [['profitia_access_owner',false],[ROLE,true],[OTHER,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN CONNECTION LIMIT 4 PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
      const flags=(await root.query('SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[role])).rows[0]
      assert.deepEqual(flags,{rolcanlogin:login,rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false})
    }
    await root.query('COMMIT');await root.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    const u=new URL(rootUrl);u.pathname=`/${DATABASE}`;owner=new pg.Client({connectionString:u.toString()});await owner.connect()
    assert.equal((await owner.query('SELECT current_database() db')).rows[0].db,DATABASE)
    await owner.query('SET ROLE profitia_access_owner')
    const makePool=(role,max)=>{const p=new URL(u);p.username=role;p.password='isolated_ci_only';return new pg.Pool({connectionString:p.toString(),max,connectionTimeoutMillis:3000})}
    pool=makePool(ROLE,3);auditPool=makePool(ROLE,1);otherPool=makePool(OTHER,1)
    const binding=(role=ROLE)=>({applicationId:APP,environment:'development',projectId:'isolated-service-project',branchId:'isolated-service-branch',databaseName:DATABASE,role,schemaDigest:hash(sql[0]),
      service:{schemaDigest:hash(sql[4]),profileId:'SPENDGURU_SAAS',deploymentId:'isolated-source-v1',configurationVersion:'service-read-v1'}})
    const grant=async(org=ORG_A,operation='forecast.read',effect='ALLOW')=>owner.query(`INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at)
      VALUES($1,$2,$3,$4,$5,'prepared-a',$6,'ACTIVE','SYNTHETIC_SERVICE_GRANT',clock_timestamp()+interval '1 hour')`,[randomUUID(),ROLE,org,operation,operations[operation][0],effect])
    const reset=async()=>{
      await owner.query('DROP SCHEMA IF EXISTS service_read_fixture CASCADE;DROP SCHEMA IF EXISTS profitia_services CASCADE;DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
      await owner.query('BEGIN')
      try{
        await owner.query(sql[0]);await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-service-project','isolated-service-branch',$2)",[hash(sql[0]),DATABASE])
        await owner.query(sql[1]);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql[1])])
        await owner.query(sql[2]);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[hash(sql[2])])
        await owner.query(sql[3]);await owner.query("INSERT INTO profitia_access.directory_installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql[3])])
        await owner.query(sql[4]);await owner.query("INSERT INTO profitia_services.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[hash(sql[4])])
        await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[ORG_A,ORG_B])
        await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[APP])
        for(const role of [ROLE,OTHER])await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[role,APP])
        await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','isolated-source-v1','service-read-v1','ACTIVE','SYNTHETIC_SERVICE_BINDING',clock_timestamp()+interval '1 hour')",[ROLE,BINDING,SERVICE])
        for(const op of Object.keys(operations))await grant(ORG_A,op)
        for(const org of [ORG_A,ORG_B])for(const [product,features]of [['SPENDGURU',['market','forecast']],['SUPPLIER_INTELLIGENCE',['supplier_report']]])await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')",[APP,org,product,features])
        await owner.query('CREATE SCHEMA service_read_fixture;CREATE TABLE service_read_fixture.prepared_values(id text PRIMARY KEY,value integer NOT NULL);INSERT INTO service_read_fixture.prepared_values VALUES(\'prepared-a\',7),(\'prepared-b\',19);ALTER TABLE service_read_fixture.prepared_values ENABLE ROW LEVEL SECURITY;ALTER TABLE service_read_fixture.prepared_values FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON service_read_fixture.prepared_values TO profitia_access_owner USING(true) WITH CHECK(true)')
        const scope=`profitia_services.scope_allows('${APP}',nullif(current_setting('profitia.service.organisation_id',true),'')::uuid,current_setting('profitia.service.operation',true),id)`
        await owner.query(`CREATE POLICY read_scope ON service_read_fixture.prepared_values FOR SELECT TO ${ROLE} USING(${scope});CREATE POLICY read_fence ON service_read_fixture.prepared_values AS RESTRICTIVE FOR SELECT TO ${ROLE} USING(${scope});CREATE POLICY insert_fence ON service_read_fixture.prepared_values AS RESTRICTIVE FOR INSERT TO ${ROLE} WITH CHECK(false);CREATE POLICY update_fence ON service_read_fixture.prepared_values AS RESTRICTIVE FOR UPDATE TO ${ROLE} USING(false) WITH CHECK(false);CREATE POLICY delete_fence ON service_read_fixture.prepared_values AS RESTRICTIVE FOR DELETE TO ${ROLE} USING(false)`)
        await owner.query('CREATE TABLE service_read_fixture.private_records(id text PRIMARY KEY,organisation_id uuid);ALTER TABLE service_read_fixture.private_records ENABLE ROW LEVEL SECURITY;ALTER TABLE service_read_fixture.private_records FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON service_read_fixture.private_records TO profitia_access_owner USING(true) WITH CHECK(true)')
        await owner.query('INSERT INTO service_read_fixture.private_records VALUES(\'private-a\',$1),(\'private-b\',$2)',[ORG_A,ORG_B])
        await owner.query(`CREATE POLICY false_permissive ON service_read_fixture.private_records TO ${ROLE} USING(true) WITH CHECK(true);CREATE POLICY private_fence ON service_read_fixture.private_records AS RESTRICTIVE TO ${ROLE} USING(false) WITH CHECK(false)`)
        for(const role of [ROLE,OTHER]){
          await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_services,service_read_fixture TO ${role};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.append_audit(jsonb),profitia_services.runtime_descriptor(),profitia_services.lock_read(uuid,text,text,text),profitia_services.scope_allows(text,uuid,text,text) TO ${role};GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA service_read_fixture TO ${role}`)
        }
        await owner.query('COMMIT')
      }catch(error){await owner.query('ROLLBACK');throw error}
    }
    const scenario=async(name,fn)=>t.test(name,async()=>{await reset();await fn()})
    const fixture=(overrides={})=>{
      let actions=0,resources=0
      const application={appId:APP,profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated-source-v1',configurationVersion:'service-read-v1',identityIssuer:DATABASE_SERVICE_ISSUER,organisationId:null,operations:Object.keys(operations),features:['market','forecast','supplier_report']}
      const transact=async(work,limits)=>{
        const c=await pool.connect();let ended=false;const timer=setTimeout(()=>{ended=true;void c.end().catch(()=>{})},limits.timeoutMs)
        const query=c.query.bind(c);await query('BEGIN')
        try{const v=await work({query,transaction:c});await query('COMMIT');return v}catch(e){await query('ROLLBACK').catch(()=>{});throw e}finally{clearTimeout(timer);c.release(ended)}
      }
      const options={application,binding:binding(),independentQuery:auditPool.query.bind(auditPool),transact,
        readResources:async({request,scope,actor})=>{resources++;assert.equal(scope.userId,null);assert.equal(scope.serviceId,SERVICE);assert.equal(actor.kind,'SERVICE');return{resource:{id:request.resourceId,type:operations[request.operation][1],dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'prepared-fixture-v1',projectionVersion:'closed-read-v1',approvedSharedProjection:true}}},
        projectOutput:value=>{assert(Array.isArray(value));assert(value.every(r=>Object.keys(r).sort().join(',')==='id,value'&&typeof r.id==='string'&&Number.isInteger(r.value)));return value},...overrides}
      const host=createServiceReadHost(options)
      const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'forecast.read',organisationId:ORG_A,resourceId:'prepared-a',payload:null,request:{userId:'forged',kind:'HUMAN',organisationId:ORG_B,serviceId:'forged'}}
      const action=async(context,c)=>{actions++;assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,null);assert.equal(context.actor.actorId,SERVICE);return(await c.query('SELECT id,value FROM service_read_fixture.prepared_values ORDER BY id')).rows}
      return{host,input,action,options,get actions(){return actions},get resources(){return resources},run:()=>host.execute(input,action)}
    }
    await scenario('three exact normative prepared reads use SERVICE, own org grant/product and common audit',async()=>{
      for(const op of Object.keys(operations)){const f=fixture();f.input.operation=op;assert.deepEqual((await f.run()).value,[{id:'prepared-a',value:7}])}
      const events=(await owner.query('SELECT phase,event FROM profitia_access.security_events ORDER BY event_id')).rows
      assert.equal(events.length,6);assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME','INTENT','OUTCOME','INTENT','OUTCOME'])
      assert(events.every(e=>e.event.actorKind==='SERVICE'&&e.event.actorId===SERVICE&&e.event.subjectUserId===null&&e.event.organisationId===ORG_A&&e.event.accessBasisType==='SERVICE_GRANT'))
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n,0)
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.memberships')).rows[0].n,0)
    })
    await scenario('another ordinary login cannot impersonate the registered SQL service',async()=>{
      const store=createAccessStore({binding:binding(OTHER)});assert.equal(await store.resolveServiceActor(otherPool.query.bind(otherPool)),null)
      await assert.rejects(otherPool.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
      await assert.rejects(otherPool.query('SELECT * FROM profitia_services.runtime_bindings'),e=>e.code==='42501')
    })
    await scenario('three technical authority tables FORCE RLS and identities carry no customer account',async()=>{
      const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='profitia_services'::regnamespace AND relkind='r'")).rows
      assert.equal(rows.length,3);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
      const role=(await owner.query('SELECT rolconnlimit FROM pg_roles WHERE rolname=$1',[ROLE])).rows[0];assert.equal(role.rolconnlimit,4)
      const actor=await createAccessStore({binding:binding()}).resolveServiceActor(auditPool.query.bind(auditPool))
      assert.equal(actor.serviceId,SERVICE);assert.equal(actor.userId,undefined);assert.equal(actor.onBehalfOf,undefined)
      assert(actor.expiresAt&&Date.parse(actor.expiresAt)<=Date.now()+30000)
    })
    for(const [name,mutation]of [
      ['revoked binding',"UPDATE profitia_services.runtime_bindings SET status='REVOKED'"],
      ['expired binding',"UPDATE profitia_services.runtime_bindings SET expires_at=clock_timestamp()-interval '1 second'"],
      ['revoked grant',"UPDATE profitia_services.read_grants SET status='REVOKED' WHERE operation='forecast.read'"],
      ['expired grant',"UPDATE profitia_services.read_grants SET expires_at=clock_timestamp()-interval '1 second' WHERE operation='forecast.read'"],
      ['suspended org',"UPDATE profitia_access.organisations SET status='SUSPENDED'"],
      ['revoked product',"UPDATE profitia_access.product_grants SET status='REVOKED'"],
      ['missing feature',"UPDATE profitia_access.product_grants SET features=ARRAY['market'] WHERE product='SPENDGURU'"],
      ['wrong deployment',"UPDATE profitia_services.runtime_bindings SET deployment_id='foreign-source'"],
      ['wrong installation digest',"UPDATE profitia_services.installation SET schema_digest=repeat('f',64)"],
    ])await scenario(`${name} refuses before resource/action callback`,async()=>{
      await owner.query(mutation);const f=fixture();await assert.rejects(f.run(),deny);assert.equal(f.actions,0);assert.equal(f.resources,0)
    })
    await scenario('organisation, resource, operation and explicit DENY are independent boundaries',async()=>{
      for(const patch of [{organisationId:ORG_B},{organisationId:null},{resourceId:'prepared-b'},{operation:'category.read'},{operation:'job.execute'},{operation:'knowledge.ingest'}]){
        const f=fixture();Object.assign(f.input,patch);await assert.rejects(f.run(),deny);assert.equal(f.actions,0)
      }
      await grant(ORG_A,'forecast.read','DENY');const f=fixture();await assert.rejects(f.run(),deny);assert.equal(f.resources,0)
    })
    await scenario('no ambient scope, no forged human identity and no authority or audit rewrite',async()=>{
      assert.equal((await pool.query('SELECT * FROM service_read_fixture.prepared_values')).rowCount,0)
      for(const q of ['SELECT * FROM profitia_services.read_grants',"UPDATE profitia_services.runtime_bindings SET status='ACTIVE'",'DELETE FROM profitia_access.security_events','SELECT profitia_access.lock_access(NULL,NULL,NULL,NULL,NULL)','SET ROLE profitia_access_owner','CREATE TABLE profitia_services.forged(id integer)'])await assert.rejects(pool.query(q),e=>e.code==='42501')
      await assert.rejects(pool.query('SELECT profitia_access.scope_allows($1,$2::uuid,NULL)',[APP,ORG_A]),e=>e.code==='42501')
      await assert.rejects(pool.query('SELECT profitia_access.append_audit($1::jsonb)',[JSON.stringify({})]),e=>e.code==='42501')
      const forged={applicationId:APP,environment:'development',decisionId:randomUUID(),phase:'DECISION',decision:'DENY',reasonCode:'PERMISSION_DENIED',actorId:SERVICE,actorKind:'HUMAN',subjectUserId:SERVICE}
      await assert.rejects(pool.query('SELECT profitia_services.append_audit($1::jsonb)',[JSON.stringify(forged)]),e=>e.code==='42501')
    })
    await scenario('real SELECT ACL plus a false permissive policy do not grant private records or shared writes',async()=>{
      await owner.query(`CREATE POLICY false_permissive ON service_read_fixture.prepared_values TO ${ROLE} USING(true) WITH CHECK(true)`)
      const f=fixture();const result=await f.host.execute(f.input,async(context,c)=>{
        assert.equal((await c.query('SELECT * FROM service_read_fixture.private_records')).rowCount,0)
        assert.equal((await c.query('DELETE FROM service_read_fixture.prepared_values')).rowCount,0)
        assert.equal((await c.query('UPDATE service_read_fixture.prepared_values SET value=99')).rowCount,0)
        return f.action(context,c)
      });assert.deepEqual(result.value,[{id:'prepared-a',value:7}])
      await assert.rejects(f.host.execute(f.input,async(_context,c)=>c.query("INSERT INTO service_read_fixture.prepared_values VALUES('forged',88)")),deny)
      assert.deepEqual((await owner.query('SELECT value FROM service_read_fixture.prepared_values ORDER BY id')).rows,[{value:7},{value:19}])
    })
    await scenario('audit outage prevents the action; failed outcome withholds output and leaves correlated failure',async()=>{
      await owner.query(`REVOKE EXECUTE ON FUNCTION profitia_services.append_audit(jsonb) FROM ${ROLE}`)
      const f=fixture();await assert.rejects(f.run(),e=>deny(e)&&e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(f.actions,0)
      await owner.query(`GRANT EXECUTE ON FUNCTION profitia_services.append_audit(jsonb) TO ${ROLE}`)
      const g=fixture({projectOutput:()=>{throw Error('synthetic-private-output')}});await assert.rejects(g.run(),deny)
      const events=(await owner.query('SELECT decision_id,phase FROM profitia_access.security_events ORDER BY event_id')).rows
      assert.deepEqual(events.map(e=>e.phase),['INTENT','FAILURE']);assert.equal(events[0].decision_id,events[1].decision_id)
    })
    await scenario('expired real SQL service identity before commit withholds the completed read',async()=>{
      await owner.query("UPDATE profitia_services.runtime_bindings SET expires_at=clock_timestamp()+interval '1 second'")
      const f=fixture();await assert.rejects(f.host.execute(f.input,async(ctx,c)=>{const value=await f.action(ctx,c);await c.query('SELECT pg_sleep(1.1)');return value}),deny)
      const events=(await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows
      assert.deepEqual(events.map(e=>e.phase),['INTENT','FAILURE']);assert.equal(f.actions,1)
    })
    await scenario('resource metadata cannot label private data as the approved shared projection',async()=>{
      const base=fixture(),read=base.options.readResources
      const f=fixture({readResources:async input=>{const r=await read(input);r.resource.ownerOrganisationId=ORG_B;return r}})
      await assert.rejects(f.run(),e=>deny(e)&&e.reasonCode==='RESOURCE_SCOPE_MISMATCH');assert.equal(f.actions,0)
      const g=fixture({readResources:async input=>({...await read(input),access:{type:'MEMBERSHIP'}})})
      await assert.rejects(g.run(),deny);assert.equal(g.actions,0)
    })
    await scenario('fixed dedicated and standalone ceilings remain enforced by the SQL service binding',async()=>{
      await owner.query("UPDATE profitia_access.applications SET fixed_organisation_id=$1",[ORG_A])
      await owner.query("UPDATE profitia_services.runtime_bindings SET profile_id='PORR_SUITE'")
      const base=fixture(),f=fixture({application:{...base.options.application,profileId:'PORR_SUITE',organisationId:ORG_A},binding:{...binding(),service:{...binding().service,profileId:'PORR_SUITE'}}})
      assert.equal((await f.run()).value[0].value,7);await grant(ORG_B);f.input.organisationId=ORG_B;await assert.rejects(f.run(),deny);assert.equal(f.actions,1)
      await owner.query('UPDATE profitia_access.applications SET fixed_organisation_id=NULL')
      await owner.query("UPDATE profitia_services.runtime_bindings SET profile_id='SUPPLIER_INTELLIGENCE_STANDALONE'")
      const b={...binding(),service:{...binding().service,profileId:'SUPPLIER_INTELLIGENCE_STANDALONE'}}
      const actor=await createAccessStore({binding:b}).resolveServiceActor(auditPool.query.bind(auditPool))
      assert.equal((await pool.query('SELECT profitia_services.lock_read($1::uuid,$2,$3,$4) AS state',[ORG_A,'forecast.read','prepared-a',actor.proofRef])).rows[0].state,null)
      const g=fixture({application:{...base.options.application,profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',operations:['supplier.report.read'],features:['supplier_report']},binding:b})
      g.input.operation='supplier.report.read';assert.equal((await g.run()).value[0].value,7)
    })
    await scenario('four concurrent reads fit business3+audit1 and leave no pooled scope',async()=>{
      await grant(ORG_B);const fs=Array.from({length:4},(_,i)=>{const f=fixture();f.input.organisationId=i%2?ORG_A:ORG_B;return f})
      const results=await Promise.all(fs.map(f=>f.run()));assert(results.every(r=>r.value[0].value===7))
      const clients=await Promise.all([pool.connect(),pool.connect(),pool.connect()])
      try{for(const c of clients)assert.equal((await c.query('SELECT * FROM service_read_fixture.prepared_values')).rowCount,0)}finally{clients.forEach(c=>c.release())}
    })
    await scenario('current revocation is serialized against the real effect transaction then enforced on retry',async()=>{
      const f=fixture();let entered,release;const ready=new Promise(r=>{entered=r}),hold=new Promise(r=>{release=r})
      const running=f.host.execute(f.input,async(ctx,c)=>{entered();await hold;return f.action(ctx,c)})
      await ready;await owner.query("BEGIN;SET LOCAL lock_timeout='100ms'")
      try{await assert.rejects(owner.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE operation='forecast.read'"),e=>e.code==='55P03')}finally{await owner.query('ROLLBACK');release()}
      await running;await owner.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE operation='forecast.read'")
      await assert.rejects(f.run(),deny);assert.equal(f.actions,1)
    })
    await scenario('independent INTENT cannot deadlock behind a queued authority change',async()=>{
      const base=fixture();let pending,updateError
      await owner.query("SET lock_timeout='1s'")
      try{
        const f=fixture({readResources:async input=>{
          pending=owner.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE operation='forecast.read'").catch(e=>{updateError=e})
          let waiting=false
          for(let i=0;i<30;i++){
            if((await root.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[owner.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break}
            await new Promise(r=>setTimeout(r,10))
          }
          assert(waiting,'The test must establish an actual queued SQL revocation')
          return base.options.readResources(input)
        }})
        assert.equal((await f.run()).value[0].value,7);await pending;assert.equal(updateError,undefined)
        const next=fixture();await assert.rejects(next.run(),deny);assert.equal(next.actions,0)
      }finally{if(pending)await pending;await owner.query('RESET lock_timeout')}
    })
    await scenario('a lease cannot be serialized or reused in another real transaction',async()=>{
      const store=createAccessStore({binding:binding()}),actor=await store.resolveServiceActor(auditPool.query.bind(auditPool))
      const c=await pool.connect();let lease
      try{await c.query('BEGIN');lease=await store.lockServiceRead(c.query.bind(c),{actor,organisationId:ORG_A,operation:'forecast.read',resourceId:'prepared-a'});await store.verifyScope(c.query.bind(c),lease);await c.query('COMMIT');await c.query('BEGIN');await assert.rejects(store.verifyScope(c.query.bind(c),lease),deny);await c.query('ROLLBACK')}
      finally{c.release()}
      await assert.rejects(store.verifyScope(auditPool.query.bind(auditPool),JSON.parse(JSON.stringify(lease))),deny)
    })
    await scenario('full additive DDL rollback preserves prior authority and the same source can be reapplied',async()=>{
      await owner.query('DROP SCHEMA profitia_services CASCADE');const before=(await owner.query('SELECT count(*)::int n FROM profitia_access.organisations')).rows[0].n
      await owner.query('BEGIN');try{await owner.query(sql[4]);await assert.rejects(owner.query("DO $$BEGIN RAISE EXCEPTION 'forced fixture failure';END$$"))}finally{await owner.query('ROLLBACK')}
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_services') AS schema")).rows[0].schema,null)
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.organisations')).rows[0].n,before)
      await owner.query('BEGIN');try{await owner.query(sql[4]);await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
      assert.equal(await serviceReadSchemaDigest(),hash(sql[4]));assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_services.runtime_bindings')).rows[0].n,0)
    })
  }finally{
    if(owner)await owner.end();if(pool)await pool.end();if(auditPool)await auditPool.end();if(otherPool)await otherPool.end();await root.end()
  }
})
