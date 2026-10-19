import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'
import {createDelegatedJobHost,createPrivateOperationHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {createClerkAccountStatusReader,createClerkIdentityAuthenticator} from '../../../packages/platform-contracts/src/identity-provider.mjs'
import {createDelegatedJobStore} from '../../../packages/platform-contracts/src/delegated-job.mjs'
import {operationPayloadDigest,OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {createPlatformIngestionHost,createPlatformDeliveryPort} from '../../../packages/platform-contracts/src/platform-ingestion.mjs'
const { Client } = createRequire(import.meta.url)('pg')
const DATABASE = 'delegated_phase_' + randomUUID().replaceAll('-', '')
const SOURCE_DATABASE=DATABASE+'_source',SOURCE_RUNTIME='supplier_job_source_fixture'
const FOREGROUND = 'delegated_phase_foreground_fixture', EXECUTOR = 'delegated_phase_executor_fixture'
const hash = value => createHash('sha256').update(value).digest('hex')
const source = name => fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/' + name, import.meta.url), 'utf8')
const migration = source('007-delegated-jobs.sql'), supplierMigration=source('013-supplier-delegation.sql')
const A = '11111111-1111-4111-8111-111111111111', U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAYLOAD={kind:'SUPPLIER_REPORT',nip:'5272443955'},PAYLOAD_DIGEST=operationPayloadDigest(PAYLOAD)
const future = () => new Date(Date.now() + 3600000).toISOString()

test('delegated Supplier private phases use actual ordinary services, current authority and the same ledger', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new Client({ connectionString: rootUrl }); await root.connect()
  const url = new URL(rootUrl); url.pathname = '/' + DATABASE
  let owner, runtime,sourceOwner,sourceRuntime
  try {
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount, 0, 'Never adopt an existing database')
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN; SET LOCAL lock_timeout='5s'; SELECT pg_advisory_xact_lock(170001,20261017)")
    try {
      for (const [role,login] of [['profitia_access_owner',false],[FOREGROUND,true],[EXECUTOR,true],['delegated_phase_forecast_fixture',true]]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
      }
      await root.query('COMMIT')
    } catch(error) { await root.query('ROLLBACK'); throw error }
    owner = new Client({ connectionString: url.toString() }); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    const controlled = async work => {
      await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
      try { const value=await work(); await owner.query('COMMIT'); return value }
      catch(error) { await owner.query('ROLLBACK'); throw error }
    }
    await controlled(async()=>{
      const base=source('001-internal-access.sql');await owner.query(base)
      await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-delegated-project','isolated-delegated-branch',$2)",[hash(base),DATABASE])
      const module=source('002-module-scope.sql');await owner.query(module);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(module)])
      const audit=source('003-module-audit.sql');await owner.query(audit);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(audit)])
      const service=source('005-service-read.sql');await owner.query(service);await owner.query("INSERT INTO profitia_services.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(service)])
      const request=source('006-request-reservation.sql');await owner.query(request);await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(request)])
    })
    await t.test('wrong owner and forced failure leave no dispatch schema or altered base constraints',async()=>{
      await assert.rejects(owner.query(migration),error=>error.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(migration);await owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic dispatch migration failure';END$$")}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_jobs') AS jobs")).rows[0].jobs,null)
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conname IN('private_job_target_reference','private_job_identity_owner_reference')")).rows[0].n,0)
    })
    await controlled(async()=>{await owner.query(migration);await owner.query("INSERT INTO profitia_jobs.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(migration)])})
    await controlled(async()=>{
      await owner.query(source('010-external-request-admission.sql'))
      await owner.query("INSERT INTO profitia_requests.external_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(source('010-external-request-admission.sql'))])
    })
    await t.test('optional Supplier extension requires controlled owner and rolls back partial installation',async()=>{
      await assert.rejects(owner.query(supplierMigration),error=>error.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(supplierMigration);throw Error('Synthetic extension rollback')}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_supplier_jobs') x")).rows[0].x,null)
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_jobs.installation")).rows[0].n,1)
    })
    await controlled(async()=>{
      await owner.query(supplierMigration)
      await owner.query("INSERT INTO profitia_supplier_jobs.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(supplierMigration)])
    })
    const policy=randomUUID(), requestId=randomUUID(), binding=randomUUID(), identity=randomUUID(), otherIdentity=randomUUID(), delegation=randomUUID()
    await controlled(async()=>{
      for(const user of[U,V])await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
      await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[A])
      await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE'),('supplier-jobs','ACTIVE')")
      await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE'),($2,'supplier-jobs','ACTIVE')",[FOREGROUND,EXECUTOR])
      for(const[user,id]of[[U,identity],[V,otherIdentity]]){
        await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,'https://identity.fixture.test',$2,$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[id,'external-'+user,user,future()])
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,user,future()])
      }
      await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,10)",[policy,A,future()])
      await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'srm','development',$4,$5,'supplier.report.refresh','request:synthetic-target',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[requestId,'1'.repeat(64),'2'.repeat(64),A,U,PAYLOAD_DIGEST,policy,randomUUID()])
      await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'srm','supplier.report.refresh',$2,'SUPPLIER_INTELLIGENCE_STANDALONE','request-fixture-v2','supplier-jobs','stored.supplier-command','isolated-source-project','isolated-source-branch',$4,'supplier-source',$5,'supplier-command-v1','quality-v1','shared-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$3)",[binding,FOREGROUND,future(),SOURCE_DATABASE,hash(source('008-platform-ingestion.sql'))])
      await owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) VALUES($1,$2,'srm','development',$3,$4,'supplier.report.refresh','request:synthetic-target',$5,$6,1,$7,1,1,'ACTIVE','SYNTHETIC_ONLY',$8)",[delegation,requestId,A,U,PAYLOAD_DIGEST,binding,identity,future()])
      await owner.query("INSERT INTO profitia_jobs.dispatches(job_id,request_id,delegation_id,source_id,delivery_key,status) VALUES($1::uuid,$1::uuid,$2::uuid,'stored.supplier-command',$3,'PENDING')",[requestId,delegation,'b'.repeat(64)])
    })

    const phaseSql=source('011-request-continuation.sql'),extension=source('014-delegated-private-phases.sql')
    await controlled(async()=>{await owner.query(phaseSql);await owner.query("INSERT INTO profitia_request_phases.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(phaseSql)])})
    await t.test('optional migration rejects the wrong owner and rolls back all added columns and metadata',async()=>{
      await assert.rejects(owner.query(extension),e=>e.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(extension);throw Error('Synthetic migration rollback')}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_delegated_phases') x")).rows[0].x,null)
      assert.equal((await owner.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='profitia_request_phases' AND table_name='effects' AND column_name='executor_service_id'")).rows[0].n,0)
    })
    await controlled(async()=>{
      await owner.query(extension);await owner.query("INSERT INTO profitia_delegated_phases.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(extension)])
      const phases=['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST']
      for(const[index,phase]of phases.entries())await owner.query("INSERT INTO profitia_request_phases.policies(application_id,phase_id,sequence,predecessor,operation,effect,status,source_ref,expires_at) VALUES('srm',$1,$2,$3,'supplier.report.refresh','PRIVATE_SQL_PHASE','ACTIVE','SYNTHETIC_ONLY',$4)",[phase,index+1,phases[index-1]??null,future()])
      await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-worker','worker-fixture-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),randomUUID(),future()])
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.refresh','supplier_report')",[randomUUID(),A,U])
      await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
      await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
      await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,binding,A,future()])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_jobs,profitia_access,profitia_services,profitia_request_phases TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.claim_dispatch(uuid),profitia_jobs.delivery_state(uuid,uuid),profitia_jobs.observe_delivery(uuid,uuid,text,uuid,text,text),profitia_jobs.append_audit(jsonb),profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_request_phases.delegated_descriptor(uuid,text),profitia_request_phases.delegated_scope_allows(uuid,text,text,uuid,uuid),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${EXECUTOR}`)
      await owner.query(`CREATE SCHEMA phase_business;CREATE TABLE phase_business.results(request_id uuid NOT NULL,phase_id text NOT NULL,input_digest text NOT NULL,organisation_id uuid NOT NULL,user_id uuid NOT NULL,PRIMARY KEY(request_id,phase_id));ALTER TABLE phase_business.results ENABLE ROW LEVEL SECURITY;ALTER TABLE phase_business.results FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON phase_business.results TO profitia_access_owner USING(true) WITH CHECK(true);CREATE POLICY bounded_phase ON phase_business.results FOR INSERT TO ${EXECUTOR} WITH CHECK(profitia_request_phases.delegated_scope_allows(request_id,phase_id,input_digest,organisation_id,user_id));GRANT USAGE ON SCHEMA phase_business TO ${EXECUTOR};GRANT INSERT ON phase_business.results TO ${EXECUTOR}`)
    })
    const runtimeUrl=new URL(url);runtimeUrl.username=EXECUTOR;runtimeUrl.password='isolated_ci_only'
    runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
    assert.deepEqual((await runtime.query('SELECT current_user::text role,session_user::text login')).rows[0],{role:EXECUTOR,login:EXECUTOR})
    let failOutcome=false,dropOutcome=false,providerActive=true,providerCalls=0,actions=0
    const readExternalAccount=createClerkAccountStatusReader({environment:'development',issuer:'https://identity.fixture.test',client:{users:{getUser:async subject=>{providerCalls++;return{id:subject,banned:!providerActive,locked:false,deprovisioned:false}}}}})
    const privateOptions={
      application:{appId:'supplier-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1',organisationId:null,identityIssuer:'urn:profitia:database-service-runtime:v1',features:['job_execution'],operations:['job.execute']},
      binding:{applicationId:'supplier-jobs',environment:'development',projectId:'isolated-delegated-project',branchId:'isolated-delegated-branch',databaseName:DATABASE,role:EXECUTOR,schemaDigest:hash(source('001-internal-access.sql')),service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1'}},
      job:{schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(supplierMigration)},
      privateContinuation:{schemaDigest:hash(phaseSql),delegatedSchemaDigest:hash(extension)},
      independentQuery:runtime.query.bind(runtime),readExternalAccount,
      transact:async(work,limits)=>{
        const c=new Client({connectionString:runtimeUrl.toString()});await c.connect()
        const timer=setTimeout(()=>{void c.end().catch(()=>{})},limits.timeoutMs)
        try{await c.query('BEGIN');const v=await work({transaction:c,query:async(sql,args)=>{
          if(dropOutcome&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')return{rows:[{recorded:true}]}
          if(failOutcome&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')throw Error('Synthetic canonical OUTCOME unavailable')
          return c.query(sql,args)
        }});await c.query('COMMIT');return v}catch(error){try{await c.query('ROLLBACK')}catch{}throw error}finally{clearTimeout(timer);await c.end()}
      }
    }
    const host=createDelegatedJobHost(privateOptions)
    const input=(id=requestId)=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,resourceId:id,payload:PAYLOAD,request:null})
    const phase=(phaseId='REGISTER_LOOKUP',inputDigest=hash('SYNTHETIC_'+phaseId))=>({phaseId,inputDigest})
    const write=async(context,c)=>{
      actions++;assert.equal(context.actorKind,'SERVICE');assert.notEqual(context.actorId,U);assert.equal(context.subjectUserId,U)
      assert.equal(context.requestReservation,undefined);assert.equal(context.moduleEvidence,undefined)
      assert.equal(context.delegation.target.operation,'supplier.report.refresh');assert.equal(context.requestContinuation.transactionId,(await c.query('SELECT txid_current()::text id')).rows[0].id)
      const v=context.requestContinuation
      await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[v.requestId,v.phaseId,v.inputDigest,context.organisationId,context.subjectUserId])
      return{requestId:v.requestId,status:'ACCEPTED'}
    }
    const counts=async()=>({effects:(await owner.query('SELECT count(*)::int n FROM profitia_request_phases.effects')).rows[0].n,business:(await owner.query('SELECT count(*)::int n FROM phase_business.results')).rows[0].n,quota:(await owner.query('SELECT sum(accepted_count)::int n FROM profitia_requests.policies')).rows[0].n})
    const freshJob=async()=>{
      const next=randomUUID(),g=randomUUID()
      await controlled(async()=>{
        await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) SELECT $1,$2,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,$3,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED') FROM profitia_requests.intents WHERE request_id=$4",[next,hash(next),randomUUID(),requestId])
        await owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) SELECT $1,$2,g.application_id,g.environment,g.organisation_id,g.user_id,g.operation,g.resource_id,g.payload_digest,g.binding_id,b.version,g.identity_binding_id,e.version,a.version,'ACTIVE','SYNTHETIC_ONLY',$3 FROM profitia_jobs.delegations g JOIN profitia_jobs.operation_bindings b USING(binding_id) JOIN profitia_access.external_identities e ON e.binding_id=g.identity_binding_id JOIN profitia_access.accounts a ON a.user_id=g.user_id WHERE g.delegation_id=$4",[g,next,future(),delegation])
        await owner.query("INSERT INTO profitia_jobs.dispatches(job_id,request_id,delegation_id,source_id,delivery_key,status) VALUES($1,$1,$2,'stored.supplier-command',$3,'PENDING')",[next,g,hash('delivery:'+next)])
      });return next
    }
    await t.test('direct writes and wrong organisation cannot precede a current reserved private phase',async()=>{
      await assert.rejects(runtime.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[requestId,'REGISTER_LOOKUP',hash('x'),A,U]),e=>e.code==='42501')
      await assert.rejects(host.runPrivatePhase({...input(),organisationId:'22222222-2222-4222-8222-222222222222'},phase(),write),isOperationDenied)
      await assert.rejects(host.runPrivatePhase({...input(),payload:{...PAYLOAD,nip:'5260250995'}},phase(),write),isOperationDenied)
      assert.equal(actions,0);assert.deepEqual(await counts(),{effects:0,business:0,quota:0})
    })
    await t.test('phase order, canonical audit failure and invalid receipts roll back private effects',async()=>{
      await assert.rejects(host.runPrivatePhase(input(),phase('STORE_FINANCIAL'),write),e=>e.reasonCode==='RESOURCE_SCOPE_MISMATCH')
      assert.equal(actions,0)
      failOutcome=true;await assert.rejects(host.runPrivatePhase(input(),phase(),write),e=>e.reasonCode==='AUDIT_UNAVAILABLE');failOutcome=false
      assert.deepEqual(await counts(),{effects:0,business:0,quota:0})
      await assert.rejects(host.runPrivatePhase(input(),phase(),async(c,tx)=>{await write(c,tx);return{requestId:randomUUID(),status:'ACCEPTED'}}),isOperationDenied)
      assert.deepEqual(await counts(),{effects:0,business:0,quota:0})
    })
    await t.test('concurrent replay writes once, keeps the real service actor and never charges another quota',async()=>{
      const before=actions,observed=providerCalls
      const results=await Promise.all([host.runPrivatePhase(input(),phase(),write),host.runPrivatePhase(input(),phase(),write)])
      assert.deepEqual(results[0].value,{requestId,status:'ACCEPTED'});assert.deepEqual(results[0].value,results[1].value)
      assert.equal(actions,before+1);assert.equal(providerCalls,observed+2);assert.deepEqual(await counts(),{effects:1,business:1,quota:0})
      const effect=(await owner.query('SELECT * FROM profitia_request_phases.effects')).rows[0]
      assert.equal(effect.user_id,U);assert.equal(effect.executor_role,EXECUTOR);assert.equal(effect.executor_application_id,'supplier-jobs');assert.equal(effect.delegation_id,delegation);assert.notEqual(effect.executor_service_id,U)
      const events=(await owner.query('SELECT event FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id',[effect.decision_id])).rows.map(r=>r.event)
      assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert(events.every(e=>e.actorKind==='SERVICE'&&e.subjectUserId===U&&e.actorId===effect.executor_service_id&&e.requestContinuation.phaseId==='REGISTER_LOOKUP'))
      assert.equal(events[0].correlationId,events[1].correlationId)
      await assert.rejects(host.runPrivatePhase(input(),phase('REGISTER_LOOKUP',hash('changed-result')),write),e=>e.reasonCode==='IDEMPOTENCY_CONFLICT')
      assert.equal(actions,before+1)
      assert.equal((await owner.query('SELECT attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0].attempt_count,0)
    })
    await t.test('all four phases preserve the single accepted parent and private SQL scope cannot escape a phase',async()=>{
      for(const id of ['STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'])await host.runPrivatePhase(input(),phase(id),write)
      assert.deepEqual(await counts(),{effects:4,business:4,quota:0})
      await assert.rejects(runtime.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[randomUUID(),'REGISTER_LOOKUP',hash('x'),A,U]),e=>e.code==='42501')
      const before=actions
      await host.runPrivatePhase(input(),phase(),async()=>{throw Error('Replay must not enter arbitrary action')})
      assert.equal(actions,before)
      assert.equal((await runtime.query('SELECT profitia_request_phases.delegated_scope_allows($1,$2,$3,$4,$5) ok',[requestId,phase().phaseId,phase().inputDigest,A,U])).rows[0].ok,false)
    })
    await t.test('same-transaction completion requires a real canonical OUTCOME and rejects a lying adapter',async()=>{
      const id=await freshJob(),before=await counts();dropOutcome=true
      try{await assert.rejects(host.runPrivatePhase(input(id),phase(),write),isOperationDenied)}finally{dropOutcome=false}
      assert.deepEqual(await counts(),before)
    })
    await t.test('a valid Service job cannot write the other organisation or another initiating user',async()=>{
      for(const[org,user]of[['22222222-2222-4222-8222-222222222222',U],[A,V]]){
        const id=await freshJob(),before=await counts()
        await assert.rejects(host.runPrivatePhase(input(id),phase(),async(context,c)=>{
          await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[id,phase().phaseId,phase().inputDigest,org,user])
          return{requestId:id,status:'ACCEPTED'}
        }),isOperationDenied)
        assert.deepEqual(await counts(),before)
      }
    })
    await t.test('expiry after a private write aborts the phase instead of renewing its proof',async()=>{
      const id=await freshJob(),before=await counts();let advance=0
      const expiring=createDelegatedJobHost({...privateOptions,now:()=>Date.now()+advance})
      await assert.rejects(expiring.runPrivatePhase(input(id),phase(),async(context,c)=>{const value=await write(context,c);advance=60000;return value}),isOperationDenied)
      assert.deepEqual(await counts(),before)
    })
    await t.test('an accidentally granted metadata read fails closed rather than weakening the boundary',async()=>{
      await owner.query(`GRANT USAGE ON SCHEMA profitia_delegated_phases TO ${EXECUTOR};GRANT SELECT ON profitia_delegated_phases.installation TO ${EXECUTOR}`)
      try{assert.equal((await runtime.query('SELECT * FROM profitia_delegated_phases.installation')).rowCount,0);await assert.rejects(host.runPrivatePhase(input(),phase(),write),isOperationDenied)}
      finally{await owner.query(`REVOKE SELECT ON profitia_delegated_phases.installation FROM ${EXECUTOR};REVOKE USAGE ON SCHEMA profitia_delegated_phases FROM ${EXECUTOR}`)}
    })
    await t.test('the unchanged default Forecast host still admits a real sibling Forecast job after SQL014 installation',async()=>{
      const foreRequest=randomUUID(),forePolicy=randomUUID(),foreBinding=randomUUID(),foreDelegation=randomUUID()
      const payload={kind:'CURRENT',seriesId:'synthetic-compat-series',modelId:'stored',targetSemantics:'CURRENT'},digest=operationPayloadDigest(payload)
      await controlled(async()=>{
        await owner.query(`REVOKE SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_jobs FROM ${EXECUTOR}`)
        await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru-sibling','ACTIVE')")
        await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES('delegated_phase_forecast_fixture','spendguru-sibling','ACTIVE')")
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru-sibling',$2,$3,'ALLOW','forecast.request','forecast')",[randomUUID(),A,U])
        await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru-sibling',$1,'SPENDGURU',ARRAY['benchmark','forecast'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
        await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru-sibling','benchmark',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
        await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru-sibling',$2,'forecast.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 minute',now()+interval '2 hours',$3,10)",[forePolicy,A,future()])
        await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'spendguru-sibling','development',$4,$5,'forecast.request','request:forecast-compat',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[foreRequest,'3'.repeat(64),'4'.repeat(64),A,U,digest,forePolicy,randomUUID()])
        await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'spendguru-sibling','forecast.request','delegated_phase_forecast_fixture','SPENDGURU_SAAS','compat-v1','supplier-jobs','stored.forecast','isolated-source-project','isolated-source-branch',$3,'forecast-source',$4,'forecast-command-v1','quality-v1','shared-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$2)",[foreBinding,future(),SOURCE_DATABASE,hash(source('008-platform-ingestion.sql'))])
        await owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) SELECT $1,$2,'spendguru-sibling','development',$3,$4,'forecast.request','request:forecast-compat',$5,$6,1,e.binding_id,e.version,a.version,'ACTIVE','SYNTHETIC_ONLY',$7 FROM profitia_access.external_identities e JOIN profitia_access.accounts a USING(user_id) WHERE e.binding_id=$8",[foreDelegation,foreRequest,A,U,digest,foreBinding,future(),identity])
        await owner.query("INSERT INTO profitia_jobs.dispatches(job_id,request_id,delegation_id,source_id,delivery_key,status) VALUES($1,$1,$2,'stored.forecast',$3,'PENDING')",[foreRequest,foreDelegation,'c'.repeat(64)])
        await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,foreBinding,A,future()])
      })
      // The ordinary service and actual account observer are unchanged. Only
      // a default Forecast factory may claim this separately bound target.
      const compatUrl=new URL(url);compatUrl.username=EXECUTOR;compatUrl.password='isolated_ci_only'
      const compatObserver=createClerkAccountStatusReader({environment:'development',issuer:'https://identity.fixture.test',client:{users:{getUser:async subject=>({id:subject,banned:false,locked:false,deprovisioned:false})}}})
      const service=(await runtime.query('SELECT profitia_services.runtime_descriptor() descriptor')).rows[0].descriptor
      const host=createDelegatedJobHost({application:{appId:'supplier-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:service.deploymentId,configurationVersion:service.configurationVersion,organisationId:null,identityIssuer:'urn:profitia:database-service-runtime:v1',features:['job_execution'],operations:['job.execute']},
        binding:{applicationId:'supplier-jobs',environment:'development',projectId:'isolated-delegated-project',branchId:'isolated-delegated-branch',databaseName:DATABASE,role:EXECUTOR,schemaDigest:hash(source('001-internal-access.sql')),service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:service.deploymentId,configurationVersion:service.configurationVersion}},job:{schemaDigest:hash(migration)},
        independentQuery:runtime.query.bind(runtime),readExternalAccount:compatObserver,
        transact:async work=>{const client=new Client({connectionString:compatUrl.toString()});await client.connect();await client.query('BEGIN');try{const result=await work({transaction:client,query:client.query.bind(client)});await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}}})
      const result=await host.admit({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,resourceId:foreRequest,payload,request:null})
      assert.equal(result.value.status,'READY');assert.equal(result.value.requestId,foreRequest)
      const last=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' ORDER BY event_id DESC LIMIT 1")).rows[0].event
      assert.equal(last.actorKind,'SERVICE');assert.equal(last.subjectUserId,U);assert.equal(last.productEvidence[0].product,'SPENDGURU');assert.equal(last.productEvidence[0].feature,'forecast')
    })

    for(const[name,sql,restore]of[
      ['membership',"UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'", "UPDATE profitia_access.memberships SET status='ACTIVE'"],
      ['product',"UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='srm'", "UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='srm'"],
      ['module',"UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='srm'", "UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='srm'"],
      ['execution grant',"UPDATE profitia_jobs.execution_grants SET status='REVOKED' WHERE binding_id='"+binding+"'", "UPDATE profitia_jobs.execution_grants SET status='ACTIVE' WHERE binding_id='"+binding+"'"],
      ['binding',"UPDATE profitia_jobs.operation_bindings SET status='REVOKED' WHERE binding_id='"+binding+"'", "UPDATE profitia_jobs.operation_bindings SET status='ACTIVE' WHERE binding_id='"+binding+"'"],
      ['internal account',"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'", "UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"],
      ['identity binding',"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE binding_id='"+identity+"'", "UPDATE profitia_access.external_identities SET status='ACTIVE' WHERE binding_id='"+identity+"'"],
    ])await t.test('current '+name+' revocation denies a fresh phase before any business write',async()=>{
      const id=await freshJob(),before=actions,countsBefore=await counts()
      await controlled(()=>owner.query(sql))
      try{await assert.rejects(host.runPrivatePhase(input(id),phase(),write),isOperationDenied);assert.equal(actions,before);assert.deepEqual(await counts(),countsBefore)}
      finally{await controlled(()=>owner.query(restore))}
    })
    await t.test('current explicit user denial and official account observation both deny phase execution',async()=>{
      const id=await freshJob(),denyId=randomUUID(),before=actions
      await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[denyId,A,U]))
      try{await assert.rejects(host.runPrivatePhase(input(id),phase(),write),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denyId]))}
      providerActive=false
      try{await assert.rejects(host.runPrivatePhase(input(await freshJob()),phase(),write),isOperationDenied)}finally{providerActive=true}
      assert.equal(actions,before)
    })
  } finally {await runtime?.end();await sourceRuntime?.end();await sourceOwner?.end();await owner?.end();await root.end()}
})
