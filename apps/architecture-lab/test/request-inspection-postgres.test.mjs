import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'
import {createDelegatedJobHost,createPrivateOperationHost,createDelegatedPrivateInspectionHost,createDelegatedNativeWorkHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {createClerkAccountStatusReader,createClerkIdentityAuthenticator} from '../../../packages/platform-contracts/src/identity-provider.mjs'
import {createDelegatedJobStore} from '../../../packages/platform-contracts/src/delegated-job.mjs'
import {operationPayloadDigest,OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {createPlatformIngestionHost,createPlatformDeliveryPort} from '../../../packages/platform-contracts/src/platform-ingestion.mjs'
const { Client } = createRequire(import.meta.url)('pg')
const DATABASE = 'private_inspection_' + randomUUID().replaceAll('-', '')
const SOURCE_DATABASE=DATABASE+'_source',SOURCE_RUNTIME='supplier_job_source_fixture'
const FOREGROUND = 'delegated_phase_foreground_fixture', EXECUTOR = 'delegated_phase_executor_fixture'
const hash = value => createHash('sha256').update(value).digest('hex')
const source = name => fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/' + name, import.meta.url), 'utf8')
const migration = source('007-delegated-jobs.sql'), supplierMigration=source('013-supplier-delegation.sql')
const A = '11111111-1111-4111-8111-111111111111', U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAYLOAD={kind:'SUPPLIER_REPORT',nip:'5272443955'},PAYLOAD_DIGEST=operationPayloadDigest(PAYLOAD)
const future = () => new Date(Date.now() + 3600000).toISOString()

test('private inspection reuses accepted phases and canonical physical audit without another effect ledger', async t => {
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
    let failOutcome=false,dropOutcome=false,dropIntent=false,providerActive=true,providerCalls=0,actions=0
    const actualIntents=[]
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
          if(dropIntent&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='INTENT')return{rows:[{recorded:true}]}
          if(dropOutcome&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')return{rows:[{recorded:true}]}
          if(failOutcome&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')throw Error('Synthetic canonical OUTCOME unavailable')
          try{const result=await c.query(sql,args);if(sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='INTENT')actualIntents.push(JSON.parse(args[0]));return result}catch(error){console.error('INSPECTION_SQL_FAILURE',JSON.stringify({code:error.code,message:error.message,query:String(sql).slice(0,140)}));throw error}
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
    const inspectionSql=source('015-delegated-private-inspection.sql')
    await t.test('optional inspection refuses wrong owner and rolls back metadata, index, trigger and writer replacement',async()=>{
      await assert.rejects(owner.query(inspectionSql),e=>e.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(inspectionSql);throw Error('Synthetic inspection installation failure')}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_request_inspection') n")).rows[0].n,null)
    })
    await controlled(async()=>{
      await owner.query(inspectionSql);await owner.query("INSERT INTO profitia_request_inspection.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(inspectionSql)])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_request_inspection TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_inspection.descriptor(uuid,text),profitia_request_inspection.bind_scope(uuid,text,text,uuid,uuid),profitia_request_inspection.scope_allows(uuid,text,uuid,uuid) TO ${EXECUTOR}`)
      await owner.query(`GRANT SELECT ON phase_business.results TO ${EXECUTOR};CREATE POLICY inspected_read ON phase_business.results FOR SELECT TO ${EXECUTOR} USING(profitia_request_inspection.scope_allows(request_id,'REGISTER_LOOKUP',organisation_id,user_id))`)
    })
    const workSql=source('016-delegated-native-work.sql')
    await t.test('optional native unit installation rejects wrong owner and atomically restores existing control functions',async()=>{
      const before=(await owner.query("SELECT pg_get_functiondef('profitia_jobs.claim_dispatch(uuid)'::regprocedure) body")).rows[0].body
      await assert.rejects(owner.query(workSql),e=>e.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(workSql);throw Error('Synthetic native installation rollback')}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_request_work') n")).rows[0].n,null)
      assert.equal((await owner.query("SELECT pg_get_functiondef('profitia_jobs.claim_dispatch(uuid)'::regprocedure) body")).rows[0].body,before)
    })
    await controlled(async()=>{
      await owner.query(workSql);await owner.query("INSERT INTO profitia_request_work.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(workSql)])
      // Exercise the unchanged real Native Work/inspection guards with the
      // additive physical lookup index; no receipt or SDK digest is replaced.
      await owner.query(source('023-current-work-audit-index.sql'))
      for(const[id,mode]of[['NATIVE_READ','READ'],['NATIVE_WRITE','WRITE']])await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('srm',$1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[id,mode,future()])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_request_work TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text) TO ${EXECUTOR}`)
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON phase_business.results TO ${EXECUTOR};CREATE POLICY native_unit_read ON phase_business.results FOR SELECT TO ${EXECUTOR} USING(profitia_request_work.scope_allows(request_id,'NATIVE_READ',organisation_id,user_id,'READ') OR profitia_request_work.scope_allows(request_id,'NATIVE_WRITE',organisation_id,user_id,'READ'));CREATE POLICY native_unit_write ON phase_business.results FOR ALL TO ${EXECUTOR} USING(profitia_request_work.scope_allows(request_id,'NATIVE_WRITE',organisation_id,user_id,'WRITE')) WITH CHECK(profitia_request_work.scope_allows(request_id,'NATIVE_WRITE',organisation_id,user_id,'WRITE'))`)
    })
    const {privateContinuation,...ordinaryOptions}=privateOptions
    const inspector=createDelegatedPrivateInspectionHost({...ordinaryOptions,privateInspection:{schemaDigest:hash(inspectionSql),continuationSchemaDigest:hash(phaseSql),delegatedSchemaDigest:hash(extension)}})
    const inspect=(id=requestId,action=async()=>{},phaseId='REGISTER_LOOKUP')=>inspector.inspectPrivatePhase(input(id),{phaseId},action)
    await t.test('unaccepted phase gives no read action and no dispatch, quota or phase',async()=>{
      let called=false;const before=await counts()
      await assert.rejects(inspect(requestId,async()=>{called=true}),isOperationDenied);assert.equal(called,false);assert.deepEqual(await counts(),before)
    })
    await host.runPrivatePhase(input(),phase(),write)
    await controlled(async()=>{
      for(const[id,org,user]of[['FOREIGN_ORGANISATION','22222222-2222-4222-8222-222222222222',U],['FOREIGN_SUBJECT',A,V]])
        await owner.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[requestId,id,hash(id),org,user])
      await owner.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[randomUUID(),'FOREIGN_PARENT',hash('foreign-parent'),A,U])
    })
    await t.test('actual ordinary Service reads the committed phase under current original subject and physical INTENT',async()=>{
      const before=await counts();let seen
      const receipt=await inspect(requestId,async(context,c)=>{
        assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.notEqual(context.actorId,U)
        assert.equal(context.requestContinuation,undefined);assert.equal(context.requestReservation,undefined);assert.equal(context.dispatchAdmission,undefined)
        assert.notEqual(context.requestInspection.acceptedTransactionId,context.requestInspection.transactionId)
        seen=(await c.query('SELECT request_id,organisation_id,user_id FROM phase_business.results')).rows
      })
      assert.deepEqual(receipt.value,{requestId,status:'ACCEPTED'});assert.deepEqual(seen,[{request_id:requestId,organisation_id:A,user_id:U}]);assert.deepEqual(await counts(),before)
      assert.equal((await owner.query('SELECT attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0].attempt_count,0)
      const events=(await owner.query('SELECT event FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id',[receipt.decisionId])).rows.map(x=>x.event)
      assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert.deepEqual(events[0].requestInspection,events[1].requestInspection)
    })
    await t.test('foreign organization, subject and parent rows exist but the ordinary inspection SELECT excludes them',async()=>{
      assert.equal((await owner.query('SELECT count(*)::int n FROM phase_business.results')).rows[0].n,4)
      await inspect(requestId,async(_context,c)=>{
        const rows=(await c.query('SELECT phase_id FROM phase_business.results')).rows
        assert.deepEqual(rows,[{phase_id:'REGISTER_LOOKUP'}])
      })
      let called=false
      await assert.rejects(inspector.inspectPrivatePhase({...input(),organisationId:'22222222-2222-4222-8222-222222222222'},{phaseId:'REGISTER_LOOKUP'},async()=>{called=true}),isOperationDenied)
      assert.equal(called,false)
    })
    await t.test('ordinary executor cannot read installation metadata or assume the controlled owner',async()=>{
      await assert.rejects(runtime.query('SELECT * FROM profitia_request_inspection.installation'),e=>e.code==='42501')
      await assert.rejects(runtime.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
      await controlled(()=>owner.query(`GRANT SELECT ON profitia_request_inspection.installation TO ${EXECUTOR}`))
      let called=false
      try{await assert.rejects(inspect(requestId,async()=>{called=true}),isOperationDenied);assert.equal(called,false)}
      finally{await controlled(()=>owner.query(`REVOKE SELECT ON profitia_request_inspection.installation FROM ${EXECUTOR}`))}
      await inspect()
    })
    await t.test('inspection has no direct SQL read outside its current transaction and cannot write',async()=>{
      assert.equal((await runtime.query('SELECT * FROM phase_business.results')).rowCount,0)
      const before=await counts();let refused=false
      await assert.rejects(inspect(requestId,async(context,c)=>{
        assert.equal((await c.query("SELECT profitia_request_inspection.scope_allows($1,'REGISTER_LOOKUP',$2,$3) ok",[requestId,A,V])).rows[0].ok,false)
        try{await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[requestId,'STORE_GENERAL',hash('wrong-write'),A,U])}catch(e){refused=e.code==='42501';throw e}
      }),isOperationDenied);assert.equal(refused,true);assert.deepEqual(await counts(),before)
    })
    await t.test('real audit failure and omitted INTENT or OUTCOME cannot return a private read',async()=>{
      for(const kind of['FAIL_OUTCOME','DROP_INTENT','DROP_OUTCOME']){
        let called=false;failOutcome=kind==='FAIL_OUTCOME';dropIntent=kind==='DROP_INTENT';dropOutcome=kind==='DROP_OUTCOME'
        try{await assert.rejects(inspect(requestId,async(_context,c)=>{called=true;await c.query('SELECT * FROM phase_business.results')}),isOperationDenied)}
        finally{failOutcome=false;dropIntent=false;dropOutcome=false}
        assert.equal(called,kind!=='DROP_INTENT')
      }
    })
    await t.test('a callback cannot turn inspection into arbitrary returned private output',async()=>{
      await assert.rejects(inspect(requestId,async()=>({private:'SYNTHETIC_PRIVATE_DATA'})),isOperationDenied)
    })
    await t.test('current explicit denial and external account revocation stop an already committed anchor',async()=>{
      const grant=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[grant,A,U]))
      try{await assert.rejects(inspect(),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))}
      providerActive=false;try{await assert.rejects(inspect(),isOperationDenied)}finally{providerActive=true}
    })
    await t.test('an unaccepted different phase or another unaccepted parent cannot borrow the anchor',async()=>{
      await assert.rejects(inspect(requestId,async()=>{},'STORE_GENERAL'),isOperationDenied)
      await assert.rejects(inspect(await freshJob()),isOperationDenied)
    })
    await t.test('the existing four write phases still commit and replay after SQL015',async()=>{
      for(const p of['STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'])await host.runPrivatePhase(input(),phase(p),write)
      const before=await counts();await host.runPrivatePhase(input(),phase(),async()=>{throw Error('Replay must skip writer')});assert.deepEqual(await counts(),before)
      await inspect(requestId,async(_context,c)=>{assert.equal((await c.query('SELECT * FROM phase_business.results')).rowCount,4)})
    })
    await t.test('the unchanged default Forecast host still admits a real sibling Forecast job after SQL015 installation',async()=>{
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
    await t.test('revoked or changed phase policy never renews the authority of a historical accepted anchor',async()=>{
      await controlled(()=>owner.query("UPDATE profitia_request_phases.policies SET status='REVOKED' WHERE application_id='srm' AND phase_id='REGISTER_LOOKUP'"))
      let called=false
      await assert.rejects(inspect(requestId,async()=>{called=true}),isOperationDenied);assert.equal(called,false)
      await controlled(()=>owner.query("UPDATE profitia_request_phases.policies SET status='ACTIVE' WHERE application_id='srm' AND phase_id='REGISTER_LOOKUP'"))
      await assert.rejects(inspect(requestId,async()=>{called=true}),isOperationDenied);assert.equal(called,false)
      const [anchor]=(await owner.query("SELECT policy_version FROM profitia_request_phases.effects WHERE request_id=$1 AND phase_id='REGISTER_LOOKUP'",[requestId])).rows
      const [policy]=(await owner.query("SELECT version FROM profitia_request_phases.policies WHERE application_id='srm' AND phase_id='REGISTER_LOOKUP'")).rows
      assert.notEqual(anchor.policy_version,policy.version)
    })
    const native=createDelegatedNativeWorkHost({...ordinaryOptions,privateWork:{schemaDigest:hash(workSql)}})
    const sqlUnit=(mode='WRITE')=>({unitId:mode==='WRITE'?'NATIVE_WRITE':'NATIVE_READ',accessMode:mode,inputDigest:hash('SYNTHETIC_NATIVE_INPUT')})
    const runUnit=(id,action=async()=>{},mode='WRITE')=>native.runSqlWork(input(id),sqlUnit(mode),action)
    const unitRequest=await freshJob()
    await controlled(async()=>{
      for(const[name,org,user]of[['FOREIGN_ORGANIZATION','22222222-2222-4222-8222-222222222222',U],['FOREIGN_SUBJECT',A,V]])await owner.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[unitRequest,name,hash(name),org,user])
    })
    await t.test('real ordinary unit commits under original authority without creating an effect, quota or dispatch claim',async()=>{
      const before=await counts(),prior=(await owner.query('SELECT attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[unitRequest])).rows[0].attempt_count
      let calls=0
      for(let i=0;i<2;i++){
        const receipt=await runUnit(unitRequest,async(context,c)=>{
          calls++;assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.notEqual(context.actorId,U)
          assert.equal(context.requestContinuation,undefined);assert.equal(context.requestInspection,undefined);assert.equal(context.requestReservation,undefined);assert.equal(context.dispatchAdmission,undefined)
          assert.equal(context.requestWork.accessMode,'WRITE');assert.equal(context.requestWork.transactionId,(await c.query('SELECT txid_current()::text tx')).rows[0].tx)
          await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[unitRequest,'NATIVE_DOMAIN_RESULT',sqlUnit().inputDigest,A,U])
        })
        assert.deepEqual(receipt.value,{requestId:unitRequest,status:'ACCEPTED'})
        const events=(await owner.query('SELECT event FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id',[receipt.decisionId])).rows.map(x=>x.event)
        assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert.deepEqual(events[0].requestWork,events[1].requestWork)
        assert.equal(events[0].requestWork.policySourceRef,'SYNTHETIC_ONLY');assert(Date.parse(events[0].requestWork.policyExpiresAt)>Date.now())
      }
      assert.equal(calls,2,'The original domain ON CONFLICT owns replay; the authorization unit never skips the callback')
      const after=await counts();assert.equal(after.business,before.business+1);assert.equal(after.effects,before.effects);assert.equal(after.quota,before.quota)
      assert.equal((await owner.query('SELECT attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[unitRequest])).rows[0].attempt_count,prior)
    })
    await t.test('unit READ excludes existing foreign rows and cannot borrow DML ACLs or a forged marker',async()=>{
      assert.equal((await owner.query('SELECT * FROM phase_business.results WHERE request_id=$1',[unitRequest])).rowCount,3)
      await runUnit(unitRequest,async(_context,c)=>{
        assert.deepEqual((await c.query('SELECT phase_id FROM phase_business.results')).rows,[{phase_id:'NATIVE_DOMAIN_RESULT'}])
        assert.equal((await c.query("UPDATE phase_business.results SET input_digest=$1 RETURNING phase_id",[hash('FORBIDDEN')])).rowCount,0)
        assert.equal((await c.query('DELETE FROM phase_business.results RETURNING phase_id')).rowCount,0)
        const marker=(await c.query("SELECT current_setting('profitia.native_work.scope') marker")).rows[0].marker
        const forged=JSON.parse(marker);forged[0]=requestId;await c.query("SELECT set_config('profitia.native_work.scope',$1,true)",[JSON.stringify(forged)])
        assert.equal((await c.query('SELECT * FROM phase_business.results')).rowCount,0)
        await c.query("SELECT set_config('profitia.native_work.scope',$1,true)",[marker])
      },'READ')
      let rls=false
      await assert.rejects(runUnit(unitRequest,async(_context,c)=>{
        try{await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[unitRequest,'FORBIDDEN_READ_INSERT',hash('forbidden'),A,U])}catch(e){rls=e.code==='42501';throw e}
      },'READ'),isOperationDenied);assert.equal(rls,true)
    })
    await t.test('an admitted native unit cannot claim dispatch, rebind its job or reserve another phase even through a savepoint',async()=>{
      const before=await counts()
      await runUnit(unitRequest,async(_context,c)=>{
        await c.query('SAVEPOINT attempted_scope_change')
        const state=(await c.query('SELECT profitia_jobs.current_job($1) state',[unitRequest])).rows[0].state
        assert.equal((await c.query('SELECT profitia_jobs.lock_job($1,$2) state',[unitRequest,state.serviceBindingVersion])).rows[0].state,null)
        assert.equal((await c.query('SELECT profitia_jobs.claim_dispatch($1) value',[unitRequest])).rows[0].value,null)
        const phaseDescriptor=(await c.query("SELECT profitia_request_phases.delegated_descriptor($1,'REGISTER_LOOKUP') d",[unitRequest])).rows[0].d
        assert(phaseDescriptor)
        assert.equal((await c.query("SELECT profitia_request_phases.reserve($1,'REGISTER_LOOKUP',$2,$3,$4) value",[unitRequest,hash('blocked-phase'),randomUUID(),phaseDescriptor.policyVersion])).rows[0].value,null)
        await c.query('ROLLBACK TO SAVEPOINT attempted_scope_change');await c.query('RELEASE SAVEPOINT attempted_scope_change')
      },'READ');assert.deepEqual(await counts(),before)
    })
    await t.test('unit write RLS rejects another owner and permission is rechecked on every separate transaction',async()=>{
      let refused=false
      await assert.rejects(runUnit(unitRequest,async(_context,c)=>{
        try{await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[unitRequest,'WRONG_OWNER',hash('wrong'),A,V])}catch(e){refused=e.code==='42501';throw e}
      }),isOperationDenied);assert.equal(refused,true)
      const deny=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[deny,A,U]))
      try{await assert.rejects(runUnit(unitRequest),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[deny]))}
      providerActive=false;try{await assert.rejects(runUnit(unitRequest),isOperationDenied)}finally{providerActive=true}
      await runUnit(unitRequest)
    })
    await t.test('unknown unit, wrong access mode, foreign organization and unsafe metadata grant refuse before action',async()=>{
      let actions=0;const action=async()=>{actions++}
      for(const unit of[{...sqlUnit(),unitId:'UNKNOWN_PURPOSE'},{...sqlUnit('READ'),accessMode:'WRITE'}])await assert.rejects(native.runSqlWork(input(unitRequest),unit,action),isOperationDenied)
      await assert.rejects(native.runSqlWork({...input(unitRequest),organisationId:'22222222-2222-4222-8222-222222222222'},sqlUnit(),action),isOperationDenied)
      await controlled(()=>owner.query(`GRANT SELECT ON profitia_request_work.policies TO ${EXECUTOR}`))
      try{await assert.rejects(runUnit(unitRequest,action),isOperationDenied)}finally{await controlled(()=>owner.query(`REVOKE SELECT ON profitia_request_work.policies FROM ${EXECUTOR}`))}
      assert.equal(actions,0)
    })
    await t.test('actual domain mutation rolls back on missing physical INTENT or OUTCOME and callback output is not published',async()=>{
      const before=await counts()
      for(const mode of['DROP_INTENT','DROP_OUTCOME','FAIL_OUTCOME']){
        let called=false;dropIntent=mode==='DROP_INTENT';dropOutcome=mode==='DROP_OUTCOME';failOutcome=mode==='FAIL_OUTCOME'
        try{await assert.rejects(runUnit(unitRequest,async(_context,c)=>{called=true;await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[unitRequest,'AUDIT_'+mode,hash(mode),A,U])}),isOperationDenied)}finally{dropIntent=false;dropOutcome=false;failOutcome=false}
        assert.equal(called,mode!=='DROP_INTENT');assert.deepEqual(await counts(),before)
      }
      await assert.rejects(runUnit(unitRequest,async()=>({private:'SYNTHETIC_PRIVATE_RESULT'})),isOperationDenied);assert.deepEqual(await counts(),before)
    })
    await t.test('expiry during actual SQL work rolls back its domain row and records no false success',async()=>{
      const before=await counts()
      await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET expires_at=clock_timestamp()+interval '2 seconds' WHERE application_id='srm' AND unit_id='NATIVE_WRITE'"))
      try{await assert.rejects(runUnit(unitRequest,async(_context,c)=>{
        await c.query('INSERT INTO phase_business.results VALUES($1,$2,$3,$4,$5)',[unitRequest,'EXPIRED_DURING_WORK',hash('expiry'),A,U]);await c.query('SELECT pg_sleep(2.1)')
      }),isOperationDenied)}finally{await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET expires_at=$1 WHERE application_id='srm' AND unit_id='NATIVE_WRITE'",[future()]))}
      assert.deepEqual(await counts(),before)
    })
    await t.test('canonical writer refuses physical inspection/work mode switching in either direction',async()=>{
      const id=await freshJob();await host.runPrivatePhase(input(id),phase(),write)
      const before=await counts();let workToRead=false,readToWork=false
      await assert.rejects(runUnit(id,async(context,c)=>{
        const d=(await c.query("SELECT profitia_request_inspection.descriptor($1,'REGISTER_LOOKUP') d",[id])).rows[0].d;assert(d)
        const e=structuredClone(actualIntents.findLast(e=>e.decisionId===context.decisionId));delete e.requestWork
        e.requestInspection={requestId:id,phaseId:'REGISTER_LOOKUP',inputDigest:d.inputDigest,policyVersion:d.policyVersion,schemaDigest:d.inspectionSchemaDigest,continuationSchemaDigest:d.schemaDigest,delegatedSchemaDigest:d.delegatedSchemaDigest,transactionId:d.transactionId,acceptedTransactionId:d.acceptedTransactionId}
        try{await c.query('SELECT true AS recorded FROM profitia_jobs.append_audit($1::jsonb)',[JSON.stringify(e)])}catch(error){workToRead=/Native work cannot mix/.test(error.message);throw error}
      }),isOperationDenied)
      await assert.rejects(inspect(id,async(context,c)=>{
        const d=(await c.query("SELECT profitia_request_work.descriptor($1,'NATIVE_WRITE') d",[id])).rows[0].d;assert(d)
        const e=structuredClone(actualIntents.findLast(e=>e.decisionId===context.decisionId));delete e.requestInspection
        e.requestWork={requestId:id,unitId:d.unitId,accessMode:d.accessMode,inputDigest:sqlUnit().inputDigest,policyVersion:d.policyVersion,policySourceRef:d.sourceRef,policyExpiresAt:d.policyExpiresAt,transactionId:d.transactionId,schemaDigest:d.schemaDigest}
        try{await c.query('SELECT true AS recorded FROM profitia_jobs.append_audit($1::jsonb)',[JSON.stringify(e)])}catch(error){readToWork=/Native work cannot mix/.test(error.message);throw error}
      }),isOperationDenied)
      assert.equal(workToRead,true);assert.equal(readToWork,true);assert.deepEqual(await counts(),before)
    })
    await t.test('purpose access mode is immutable and disabled or expired policies grant no native unit',async()=>{
      await assert.rejects(controlled(()=>owner.query("UPDATE profitia_request_work.policies SET access_mode='WRITE' WHERE application_id='srm' AND unit_id='NATIVE_READ'")),e=>e.code==='42501')
      await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET status='DISABLED' WHERE application_id='srm' AND unit_id='NATIVE_WRITE'"))
      try{await assert.rejects(runUnit(unitRequest),isOperationDenied)}finally{await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET status='ACTIVE' WHERE application_id='srm' AND unit_id='NATIVE_WRITE'"))}
      await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET expires_at=clock_timestamp()-interval '1 second' WHERE application_id='srm' AND unit_id='NATIVE_WRITE'"))
      try{await assert.rejects(runUnit(unitRequest),isOperationDenied)}finally{await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET expires_at=$1 WHERE application_id='srm' AND unit_id='NATIVE_WRITE'",[future()]))}
      await runUnit(unitRequest)
      await assert.rejects(runtime.query('SELECT * FROM profitia_request_work.installation'),e=>e.code==='42501')
      assert.equal((await runtime.query('SELECT * FROM phase_business.results')).rowCount,0)
    })
  } finally {await runtime?.end();await sourceRuntime?.end();await sourceOwner?.end();await owner?.end();await root.end()}
})
