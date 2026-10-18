import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPlatformIngestionHost,platformReceiptEvidence} from '../../../packages/platform-contracts/src/platform-ingestion.mjs'
import {isOperationDenied,operationPayloadDigest} from '../../../packages/platform-contracts/src/operation-context.mjs'
const {Client}=createRequire(import.meta.url)('pg'),DATABASE='ingestion_'+randomUUID().replaceAll('-','')
const RUNTIME='platform_ingestion_fixture',SOURCE='stored.forecast',RESOURCE='synthetic-series'
const migration=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8')
const hash=v=>createHash('sha256').update(v).digest('hex'),digest=hash(migration)
const payload={seriesId:RESOURCE,modelId:'stored',targetSemantics:'CURRENT',kind:'CURRENT'}

test('real ordinary source transactions retain one funded receipt and never adopt private authority',async t=>{
  const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new Client({connectionString:rootUrl});await root.connect()
  const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+DATABASE
  let owner,runtime
  try{
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0)
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
    try{for(const[role,login]of[['profitia_ingestion_owner',false],[RUNTIME,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
        await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
    }await root.query('COMMIT')}catch(error){await root.query('ROLLBACK');throw error}
    owner=new Client({connectionString:dbUrl.toString()});await owner.connect()
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner;GRANT CREATE ON SCHEMA public TO profitia_ingestion_owner`)
    const controlled=async work=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
      try{const r=await work();await owner.query('COMMIT');return r}catch(e){await owner.query('ROLLBACK');throw e}}
    await t.test('wrong owner and failed migration leave no source authority',async()=>{
      await assert.rejects(owner.query(migration),e=>e.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(migration);throw Error('synthetic migration failure')}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_ingestion') AS schema")).rows[0].schema,null)
    })
    const serviceId=randomUUID(),bindingId=randomUUID()
    await controlled(async()=>{
      await owner.query(migration)
      await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-source-project','isolated-source-branch',$2)",[digest,DATABASE])
      await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'stored-source','PLATFORM_INTERNAL','synthetic-source','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[RUNTIME,bindingId,serviceId])
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','forecast-command-v1','quality-v1','shared-v1','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[SOURCE])
      await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),RUNTIME,SOURCE])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'stored-source',$2,'SOURCE_TRANSACTION',2,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),SOURCE])
      await owner.query("CREATE TABLE public.synthetic_stored_effects(effect_id uuid PRIMARY KEY,resource_id text NOT NULL,payload jsonb NOT NULL);ALTER TABLE public.synthetic_stored_effects ENABLE ROW LEVEL SECURITY;ALTER TABLE public.synthetic_stored_effects FORCE ROW LEVEL SECURITY;CREATE POLICY owner_access ON public.synthetic_stored_effects TO profitia_ingestion_owner USING(true) WITH CHECK(true)")
      await owner.query(`CREATE POLICY source_write ON public.synthetic_stored_effects FOR INSERT TO ${RUNTIME} WITH CHECK(profitia_ingestion.scope_allows('${SOURCE}',resource_id));GRANT INSERT ON public.synthetic_stored_effects TO ${RUNTIME}`)
      await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion TO ${RUNTIME};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb) TO ${RUNTIME}`)
    })
    const runtimeUrl=new URL(dbUrl);runtimeUrl.username=RUNTIME;runtimeUrl.password='isolated_ci_only'
    runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
    let failOutcome=false,writes=0
    const host=createPlatformIngestionHost({
      application:{appId:'stored-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-source',configurationVersion:'source-v1',
        identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
      binding:{applicationId:'stored-source',environment:'development',projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,
        role:RUNTIME,deploymentId:'synthetic-source',configurationVersion:'source-v1',schemaDigest:digest},
      source:{id:SOURCE,payloadSchema:'forecast-command-v1',qualityVersion:'quality-v1',classificationVersion:'shared-v1'},independentQuery:async(sql,values)=>{
        const result=await runtime.query(sql,values)
        if(sql.includes('profitia_ingestion.append_audit')){
          assert.deepEqual(result.rows,[{recorded:true}]);assert(result.fields.every(field=>field.dataTypeID!==2278),'No unsupported void result may cross the native query port')
        }
        return result
      },
      validateSharedPayload:value=>value&&Object.keys(value).sort().join(',')==='kind,modelId,seriesId,targetSemantics'&&value.seriesId===RESOURCE,
      transact:async(work,limits)=>{
        assert.equal(limits.timeoutMs,15000)
        const c=new Client({connectionString:runtimeUrl.toString()});await c.connect();await c.query('BEGIN')
        try{const result=await work({transaction:c,query:async(sql,values)=>{
          if(failOutcome&&sql.includes('profitia_ingestion.append_audit')&&JSON.parse(values[0]).phase==='OUTCOME')throw Error('synthetic audit outage')
          return c.query(sql,values)
        }});await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}
      },
    })
    const key='synthetic_source_delivery_00000001',input={resourceId:RESOURCE,payload,idempotencyKey:key}
    const write=async(content,transaction,context)=>{writes++;await transaction.query('INSERT INTO public.synthetic_stored_effects VALUES($1,$2,$3::jsonb)',[context.platformReservation.effectId,RESOURCE,JSON.stringify(content)])}
    const counts=async()=>({effects:(await owner.query('SELECT count(*)::int AS n FROM profitia_ingestion.effects')).rows[0].n,
      stored:(await owner.query('SELECT count(*)::int AS n FROM public.synthetic_stored_effects')).rows[0].n,
      used:(await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count})
    await t.test('OUTCOME failure rolls back stored write, receipt and budget while preserving independent INTENT/FAILURE',async()=>{
      failOutcome=true;await assert.rejects(host.ingest(input,write),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE');failOutcome=false
      assert.deepEqual(await counts(),{effects:0,stored:0,used:0})
      assert.deepEqual((await owner.query('SELECT phase FROM profitia_ingestion.security_events ORDER BY event_id')).rows.map(r=>r.phase),['INTENT','FAILURE'])
    })
    let committed
    await t.test('source commit has one funded effect; retry and a later caller failure cannot refund or repeat it',async()=>{
      committed=await host.ingest(input,write);assert.equal(committed.value.status,'COMMITTED');assert(Object.isFrozen(committed.value))
      const proof=platformReceiptEvidence(committed.value);assert(proof);assert.equal(proof.sourceId,SOURCE);assert.equal(proof.contentDigest,operationPayloadDigest(payload))
      assert.equal(platformReceiptEvidence({...committed.value}),null,'Serialisation is not a source observation')
      const before=writes
      await assert.rejects(async()=>{await host.ingest(input,write);throw Error('synthetic private confirmation failed')})
      assert.equal(writes,before);assert.deepEqual(await counts(),{effects:1,stored:1,used:1})
      assert.equal((await host.ingest(input,write)).value.effectId,committed.value.effectId);assert.equal(writes,before)
    })
    await t.test('one remaining finite budget slot admits one concurrent effect; funded replay still succeeds at capacity',async()=>{
      const results=await Promise.allSettled(['02','03'].map(suffix=>host.ingest({...input,idempotencyKey:'synthetic_source_delivery_000000'+suffix},write)))
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
      assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.reasonCode==='LIMIT_EXCEEDED').length,1)
      assert.deepEqual(await counts(),{effects:2,stored:2,used:2})
      const before=writes;assert.equal((await host.ingest(input,write)).value.effectId,committed.value.effectId);assert.equal(writes,before)
      await assert.rejects(host.ingest({...input,payload:{...payload,modelId:'different'}},write),e=>e.reasonCode==='IDEMPOTENCY_CONFLICT')
    })
    await t.test('private fields, wrong source classification and current revocations deny before any stored effect',async()=>{
      const before=writes
      await assert.rejects(host.ingest({...input,payload:{...payload,organisationId:randomUUID()}},write),e=>e.reasonCode==='DATA_CLASSIFICATION_UNKNOWN')
      await assert.rejects(host.ingest({...input,organisationId:randomUUID()},write),e=>e.reasonCode==='CONTEXT_INVALID')
      await owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'")
      await assert.rejects(host.ingest(input,write),e=>e.reasonCode==='PERMISSION_DENIED')
      await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'")
      const deny=randomUUID();await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'DENY','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[deny,RUNTIME,SOURCE])
      await assert.rejects(host.ingest(input,write),e=>e.reasonCode==='PERMISSION_DENIED');await owner.query('DELETE FROM profitia_ingestion.grants WHERE grant_id=$1',[deny])
      assert.equal(writes,before)
      const journals=(await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows.map(r=>r.event)
      assert(journals.every(e=>e.organisationId===null&&e.subjectUserId===null&&e.actorKind!=='HUMAN'))
      assert(journals.filter(e=>e.phase==='OUTCOME').every(e=>e.sourceId===SOURCE&&e.budgetUnit==='SOURCE_TRANSACTION'))
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN('profitia_access','profitia_jobs')")).rows[0].n,0)
    })
    await t.test('ordinary direct metadata DML stays fenced; history cannot be changed or truncated',async()=>{
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA profitia_ingestion TO ${RUNTIME}`)
      assert.equal((await runtime.query('SELECT * FROM profitia_ingestion.effects')).rowCount,0)
      assert.equal((await runtime.query("UPDATE profitia_ingestion.effects SET status='RESERVED'")).rowCount,0)
      await assert.rejects(runtime.query('TRUNCATE profitia_ingestion.security_events'),e=>e.code==='42501')
      await assert.rejects(runtime.query('TRUNCATE profitia_ingestion.effects'),e=>e.code==='42501')
      await assert.rejects(runtime.query('SET ROLE profitia_ingestion_owner'),e=>e.code==='42501')
      await assert.rejects(owner.query('UPDATE profitia_ingestion.budgets SET consumed_count=0'),e=>e.code==='42501')
      await assert.rejects(owner.query('DELETE FROM profitia_ingestion.effects'),e=>e.code==='42501')
      const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_ingestion' AND c.relkind='r'")).rows
      assert.equal(rows.length,7);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity))
      assert.deepEqual(await counts(),{effects:2,stored:2,used:2})
    })
    await t.test('an explicit new budget preserves prior usage and funded receipt instead of resetting history',async()=>{
      const previous=(await owner.query('SELECT policy_id,consumed_count FROM profitia_ingestion.budgets')).rows[0]
      await owner.query("UPDATE profitia_ingestion.budgets SET status='REVOKED'")
      const next=randomUUID()
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'stored-source',$2,'SOURCE_TRANSACTION',1,now()-interval '1 second',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_NEXT_WINDOW')",[next,SOURCE])
      const before=writes;assert.equal((await host.ingest(input,write)).value.effectId,committed.value.effectId);assert.equal(writes,before)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets WHERE policy_id=$1',[next])).rows[0].consumed_count,0)
      await host.ingest({...input,idempotencyKey:'synthetic_source_delivery_next_window_01'},write)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets WHERE policy_id=$1',[previous.policy_id])).rows[0].consumed_count,2)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets WHERE policy_id=$1',[next])).rows[0].consumed_count,1)
    })
  }finally{await runtime?.end();await owner?.end();await root.end()}
})
