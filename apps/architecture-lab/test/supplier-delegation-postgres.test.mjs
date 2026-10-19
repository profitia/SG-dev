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
const DATABASE = 'supplier_execution_' + randomUUID().replaceAll('-', '')
const SOURCE_DATABASE=DATABASE+'_source',SOURCE_RUNTIME='supplier_job_source_fixture'
const FOREGROUND = 'supplier_job_foreground_fixture', EXECUTOR = 'supplier_job_executor_fixture'
const hash = value => createHash('sha256').update(value).digest('hex')
const source = name => fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/' + name, import.meta.url), 'utf8')
const migration = source('007-delegated-jobs.sql'), supplierMigration=source('013-supplier-delegation.sql')
const A = '11111111-1111-4111-8111-111111111111', U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAYLOAD={kind:'SUPPLIER_REPORT',nip:'5272443955'},PAYLOAD_DIGEST=operationPayloadDigest(PAYLOAD)
const future = () => new Date(Date.now() + 3600000).toISOString()

test('optional Supplier target preserves the single private dispatch and source receipt protocol', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new Client({ connectionString: rootUrl }); await root.connect()
  const url = new URL(rootUrl); url.pathname = '/' + DATABASE
  let owner, runtime,sourceOwner,sourceRuntime
  try {
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount, 0, 'Never adopt an existing database')
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN; SET LOCAL lock_timeout='5s'; SELECT pg_advisory_xact_lock(170001,20261017)")
    try {
      for (const [role,login] of [['profitia_access_owner',false],[FOREGROUND,true],[EXECUTOR,true],['supplier_forecast_compat_fixture',true]]) {
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
    await t.test('actual ordinary service checks the current initiating application and both user and service grants',async st=>{
      await controlled(async()=>{
        await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-worker','worker-fixture-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),randomUUID(),future()])
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.refresh','supplier_report')",[randomUUID(),A,U])
        await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
        await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
        await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,binding,A,future()])
        await owner.query(`GRANT USAGE ON SCHEMA profitia_jobs,profitia_access,profitia_services TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.claim_dispatch(uuid),profitia_jobs.delivery_state(uuid,uuid),profitia_jobs.observe_delivery(uuid,uuid,text,uuid,text,text),profitia_jobs.append_audit(jsonb),profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor() TO ${EXECUTOR}`)
      })
      const runtimeUrl=new URL(url);runtimeUrl.username=EXECUTOR;runtimeUrl.password='isolated_ci_only'
      runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
      const ownedRuntime=runtime
      st.after(async()=>{await ownedRuntime.end();if(runtime===ownedRuntime)runtime=null})
      const read=async()=>(await runtime.query('SELECT profitia_jobs.current_job($1::uuid) AS state',[requestId])).rows[0].state
      const state=await read();assert(state);assert.equal(state.access.type,'DELEGATED_USER')
      assert.equal(state.delegation.subjectUserId,U);assert.equal(state.delegation.target.application.appId,'srm')
      assert.equal(state.delegation.target.application.configurationVersion,'request-fixture-v2')
      assert.equal(state.delegation.executorApplicationId,'supplier-jobs');assert.notEqual(state.access.actorId,U)
      assert.equal(state.delegation.payloadDigest,PAYLOAD_DIGEST);assert.equal(state.resource.ownerOrganisationId,A)
      await runtime.query('BEGIN')
      const locked=(await runtime.query('SELECT profitia_jobs.lock_job($1::uuid,$2) AS state',[requestId,state.serviceBindingVersion])).rows[0].state
      assert(locked);assert.equal((await runtime.query('SELECT profitia_jobs.scope_allows($1::uuid) AS ok',[requestId])).rows[0].ok,true)
      assert.equal((await runtime.query('SELECT profitia_jobs.scope_allows($1::uuid) AS ok',[randomUUID()])).rows[0].ok,false)
      await runtime.query('COMMIT')
      assert.equal((await runtime.query('SELECT profitia_jobs.scope_allows($1::uuid) AS ok',[requestId])).rows[0].ok,false)
      let failOutcome=true,providerActive=true,providerCalls=0
      const readExternalAccount=createClerkAccountStatusReader({environment:'development',issuer:'https://identity.fixture.test',
        client:{users:{getUser:async subject=>{providerCalls++;return{id:subject,banned:!providerActive,locked:false,deprovisioned:false}}}}})
      // A physically separate source database. Private actor/membership/job rows
      // never enter it; the fixed SDK port publishes only universal content.
      assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[SOURCE_DATABASE])).rowCount,0)
      await root.query(`CREATE DATABASE ${SOURCE_DATABASE}`)
      await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
      try{for(const[role,login]of[['profitia_ingestion_owner',false],[SOURCE_RUNTIME,true]]){
        if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
          await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
      }await root.query('COMMIT')}catch(error){await root.query('ROLLBACK');throw error}
      const sourceUrl=new URL(rootUrl);sourceUrl.pathname='/'+SOURCE_DATABASE
      sourceOwner=new Client({connectionString:sourceUrl.toString()});await sourceOwner.connect()
      await sourceOwner.query(`GRANT CREATE ON DATABASE ${SOURCE_DATABASE} TO profitia_ingestion_owner;GRANT CREATE ON SCHEMA public TO profitia_ingestion_owner;BEGIN;SET LOCAL ROLE profitia_ingestion_owner`)
      try{
        await sourceOwner.query(source('008-platform-ingestion.sql'))
        await sourceOwner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-source-project','isolated-source-branch',$2)",[hash(source('008-platform-ingestion.sql')),SOURCE_DATABASE])
        await sourceOwner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'supplier-source','PLATFORM_INTERNAL','synthetic-source','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[SOURCE_RUNTIME,randomUUID(),randomUUID()])
        await sourceOwner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES('stored.supplier-command','STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','supplier-command-v1','quality-v1','shared-v1','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')")
        await sourceOwner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,'stored.supplier-command','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),SOURCE_RUNTIME])
        await sourceOwner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'supplier-source','stored.supplier-command','SOURCE_TRANSACTION',1,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID()])
        await sourceOwner.query("CREATE TABLE public.synthetic_delivery(effect_id uuid PRIMARY KEY,resource_id text NOT NULL,payload jsonb NOT NULL);ALTER TABLE public.synthetic_delivery ENABLE ROW LEVEL SECURITY;ALTER TABLE public.synthetic_delivery FORCE ROW LEVEL SECURITY;CREATE POLICY owner_access ON public.synthetic_delivery TO profitia_ingestion_owner USING(true) WITH CHECK(true)")
        await sourceOwner.query(`CREATE POLICY source_write ON public.synthetic_delivery FOR INSERT TO ${SOURCE_RUNTIME} WITH CHECK(profitia_ingestion.scope_allows('stored.supplier-command',resource_id));GRANT INSERT ON public.synthetic_delivery TO ${SOURCE_RUNTIME};GRANT USAGE ON SCHEMA profitia_ingestion TO ${SOURCE_RUNTIME};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb) TO ${SOURCE_RUNTIME}`)
        await sourceOwner.query('COMMIT')
      }catch(error){await sourceOwner.query('ROLLBACK');throw error}
      const sourceRuntimeUrl=new URL(sourceUrl);sourceRuntimeUrl.username=SOURCE_RUNTIME;sourceRuntimeUrl.password='isolated_ci_only'
      sourceRuntime=new Client({connectionString:sourceRuntimeUrl.toString()});await sourceRuntime.connect()
      let sourceWrites=0
      const sourceOptions={application:{appId:'supplier-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-source',configurationVersion:'source-v1',
          identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
        binding:{applicationId:'supplier-source',environment:'development',projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:SOURCE_DATABASE,
          role:SOURCE_RUNTIME,deploymentId:'synthetic-source',configurationVersion:'source-v1',schemaDigest:hash(source('008-platform-ingestion.sql'))},
        source:{id:'stored.supplier-command',payloadSchema:'supplier-command-v1',qualityVersion:'quality-v1',classificationVersion:'shared-v1'},independentQuery:sourceRuntime.query.bind(sourceRuntime),
        validateSharedPayload:value=>value&&Object.keys(value).sort().join(',')==='kind,nip'&&value.nip===PAYLOAD.nip,
        transact:async work=>{
          const c=new Client({connectionString:sourceRuntimeUrl.toString()});await c.connect();await c.query('BEGIN')
          try{const r=await work({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(error){await c.query('ROLLBACK');throw error}finally{await c.end()}
        }}
      const sourceHost=createPlatformIngestionHost(sourceOptions)
      const sourceDelivery=createPlatformDeliveryPort({host:sourceHost,resourceId:p=>p.nip,
        write:async(p,tx,c)=>{sourceWrites++;await tx.query('INSERT INTO public.synthetic_delivery VALUES($1,$2,$3::jsonb)',[c.platformReservation.effectId,p.nip,JSON.stringify(p)])}})
      const privateOptions={
        application:{appId:'supplier-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1',
          organisationId:null,identityIssuer:'urn:profitia:database-service-runtime:v1',features:['job_execution'],operations:['job.execute']},
        binding:{applicationId:'supplier-jobs',environment:'development',projectId:'isolated-delegated-project',branchId:'isolated-delegated-branch',databaseName:DATABASE,
          role:EXECUTOR,schemaDigest:hash(source('001-internal-access.sql')),service:{schemaDigest:hash(source('005-service-read.sql')),
            profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1'}},
        job:{schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(supplierMigration)},independentQuery:async(sql,values)=>{
          const result=await runtime.query(sql,values)
          if(sql.includes('profitia_jobs.append_audit')){
            assert.deepEqual(result.rows,[{recorded:true}]);assert(result.fields.every(field=>field.dataTypeID!==2278),'Audit result must not expose PostgreSQL void to a native Prisma driver')
          }
          return result
        },readExternalAccount,sourceDelivery,
        transact:async work=>{
          const client=new Client({connectionString:runtimeUrl.toString()});await client.connect();await client.query('BEGIN')
          try{const result=await work({transaction:client,query:async(sql,values)=>{
            if(failOutcome&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(values[0]).phase==='OUTCOME')throw Error('synthetic outcome writer failure')
            return client.query(sql,values)
          }});await client.query('COMMIT');return result}
          catch(error){await client.query('ROLLBACK');throw error}finally{await client.end()}
        },
      }
      const host=createDelegatedJobHost(privateOptions)
      const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',
        organisationId:A,resourceId:requestId,payload:PAYLOAD,request:null}
      await assert.rejects(host.admit(input),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE')
      assert.deepEqual((await owner.query('SELECT status,attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0],{status:'PENDING',attempt_count:0})
      assert.deepEqual((await owner.query("SELECT phase FROM profitia_access.security_events ORDER BY event_id")).rows.map(r=>r.phase),['INTENT','FAILURE'])
      failOutcome=false
      await st.test('default Forecast host and foreign optional digest cannot claim the Supplier job',async()=>{
        for(const job of [{schemaDigest:hash(migration)},{schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'0'.repeat(64)}]){
          await assert.rejects(createDelegatedJobHost({...privateOptions,job}).admit(input),isOperationDenied)
          assert.deepEqual((await owner.query('SELECT status,attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0],{status:'PENDING',attempt_count:0})
          assert.equal(sourceWrites,0)
        }
      })
      await st.test('accidental extension table privilege makes the Supplier descriptor unavailable',async()=>{
        await owner.query(`GRANT USAGE ON SCHEMA profitia_supplier_jobs TO ${EXECUTOR};GRANT SELECT ON profitia_supplier_jobs.installation TO ${EXECUTOR}`)
        try{
          assert.equal((await runtime.query('SELECT * FROM profitia_supplier_jobs.installation')).rowCount,0)
          assert.equal((await runtime.query('SELECT profitia_jobs.supplier_runtime_descriptor() descriptor')).rows[0].descriptor,null)
          await assert.rejects(host.admit(input),isOperationDenied)
          assert.equal(sourceWrites,0)
        }finally{await owner.query(`REVOKE SELECT ON profitia_supplier_jobs.installation FROM ${EXECUTOR};REVOKE USAGE ON SCHEMA profitia_supplier_jobs FROM ${EXECUTOR}`)}
      })
      const admitted=await host.admit(input);assert.equal(admitted.value.status,'READY');assert.equal(admitted.value.deliveryKey,'b'.repeat(64))
      assert.equal((await host.admit(input)).value.status,'BUSY')
      assert.equal((await owner.query('SELECT attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0].attempt_count,1)
      let wrongSourceQueries=0
      for(const [area,key,value] of [
        ['binding','projectId','foreign-project'],['binding','branchId','foreign-source-branch'],['binding','databaseName','foreign_database'],
        ['binding','schemaDigest','f'.repeat(64)],['binding','applicationId','foreign-source-app'],['binding','environment','staging'],
        ['source','payloadSchema','foreign-schema'],['source','qualityVersion','unapproved-quality'],['source','classificationVersion','unapproved-classification'],
      ]){
        const wrongOptions={...sourceOptions,application:{...sourceOptions.application},binding:{...sourceOptions.binding},source:{...sourceOptions.source},
          independentQuery:async()=>{wrongSourceQueries++;throw Error('Wrong source must not be queried')}}
        wrongOptions[area][key]=value
        if(key==='applicationId')wrongOptions.application.appId=value
        if(key==='environment')wrongOptions.application.environment=value
        const wrongSource=createPlatformIngestionHost(wrongOptions)
        const wrongPort=createPlatformDeliveryPort({host:wrongSource,resourceId:p=>p.nip,write:async()=>{throw Error('Wrong source effect must not run')}})
        await assert.rejects(createDelegatedJobHost({...privateOptions,sourceDelivery:wrongPort}).deliver(input,admitted.value),e=>isOperationDenied(e)&&e.reasonCode==='DELEGATION_INVALID')
      }
      assert.equal(wrongSourceQueries,0);assert.equal(sourceWrites,0)
      providerActive=false
      await assert.rejects(host.deliver(input,admitted.value),e=>isOperationDenied(e)&&e.reasonCode==='DELEGATION_INVALID')
      providerActive=true;assert.equal(sourceWrites,0,'Current provider revocation is checked again after durable admission and before source effect')
      failOutcome=true
      await assert.rejects(host.deliver(input,admitted.value),e=>isOperationDenied(e)&&e.reasonCode==='DELIVERY_UNCERTAIN')
      failOutcome=false
      assert.deepEqual((await owner.query('SELECT status,attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0],{status:'READY',attempt_count:1})
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.delivery_observations')).rows[0].n,0)
      assert.equal(sourceWrites,1);assert.equal((await sourceOwner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,1)
      assert.equal((await sourceOwner.query('SELECT count(*)::int AS n FROM public.synthetic_delivery')).rows[0].n,1)
      assert.equal((await host.deliver(input,admitted.value)).value.status,'CONFIRMED')
      assert.equal((await host.deliver(input,admitted.value)).value.status,'CONFIRMED')
      assert.equal(sourceWrites,1,'Funded source effect survives private failure and is never performed twice')
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.delivery_observations')).rows[0].n,1)
      assert.equal((await sourceOwner.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN('profitia_access','profitia_jobs')")).rows[0].n,0)
      providerActive=false;await assert.rejects(host.admit(input),e=>isOperationDenied(e)&&e.reasonCode==='DELEGATION_INVALID');providerActive=true
      assert.equal(providerCalls,17)
      const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' ORDER BY event_id")).rows
      assert.equal(events.length,4);assert(events.every(r=>r.event.actorKind==='SERVICE'&&r.event.subjectUserId===U&&r.event.actorId!==U))
      await assert.rejects(runtime.query("SELECT profitia_jobs.append_audit($1::jsonb)",[JSON.stringify({...events[0].event,decisionId:randomUUID(),actorKind:'HUMAN',actorId:U})]),error=>error.code==='42501')
      // Real foreground identity/access/module/request adapters create the
      // delegation in the SAME acceptance transaction, never from an old ALLOW.
      await controlled(async()=>{
        await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs TO ${FOREGROUND};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${FOREGROUND}`)
      })
      const foregroundUrl=new URL(url);foregroundUrl.username=FOREGROUND;foregroundUrl.password='isolated_ci_only'
      const foreground=new Client({connectionString:foregroundUrl.toString()});await foreground.connect();st.after(()=>foreground.end())
      const foregroundBinding={applicationId:'srm',environment:'development',projectId:'isolated-delegated-project',branchId:'isolated-delegated-branch',
        databaseName:DATABASE,role:FOREGROUND,schemaDigest:hash(source('001-internal-access.sql'))}
      const dispatchStore=createDelegatedJobStore({binding:foregroundBinding,schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(supplierMigration)})
      const sessionExpiry=Date.now()+60000,origin='https://foreground.fixture.test',subject='external-'+U
      const identityClient={authenticateRequest:async()=>({status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',
        userId:subject,sessionId:'session_synthetic',sessionClaims:{iss:'https://identity.fixture.test',sub:subject,sid:'session_synthetic',azp:origin,exp:Math.floor(sessionExpiry/1000)}})}),
        sessions:{getSession:async()=>({id:'session_synthetic',userId:subject,status:'active',expireAt:sessionExpiry,abandonAt:sessionExpiry,actor:null})},
        users:{getUser:async()=>({id:subject,banned:false,locked:false,deprovisioned:false})}}
      const foregroundHost=createPrivateOperationHost({application:{appId:'srm',environment:'development',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'synthetic-foreground',
          configurationVersion:'request-fixture-v2',organisationId:null,identityIssuer:'https://identity.fixture.test',operations:['supplier.report.refresh'],features:['supplier_report']},
        binding:foregroundBinding,independentQuery:foreground.query.bind(foreground),
        module:{id:'supplier_report',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))},
        requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql'))},
        createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:identityClient,
          application:{appId:'srm',environment:'development',issuer:'https://identity.fixture.test',authorizedParties:[origin]},resolveBinding}),
        transact:async work=>{const c=new Client({connectionString:foregroundUrl.toString()});await c.connect();await c.query('BEGIN')
          try{const r=await work({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(error){await c.query('ROLLBACK');throw error}finally{await c.end()}},
        readResources:async({request})=>({resource:{id:request.resourceId,type:'supplier_report_request',dataClass:'OPERATION_AUDIT',ownerOrganisationId:A,ownerUserId:U,
          environment:'development',version:'1',projectionVersion:'request-v1'}}),projectOutput:value=>value,
      })
      const foregroundInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.refresh',organisationId:A,
        resourceId:'request:creation-probe',payload:PAYLOAD,idempotencyKey:'synthetic_foreground_delegation_000001',request:new Request(origin+'/request',{method:'POST',headers:{origin}})}
      let creations=0
      const accept=async(context,tx)=>{creations++;const dispatch=await dispatchStore.createDispatch(tx.query.bind(tx),context)
        assert.equal(dispatch.jobId,context.requestReservation.requestId);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}}
      const accepted=await foregroundHost.execute(foregroundInput,accept)
      assert.equal((await foregroundHost.execute(foregroundInput,accept)).value.requestId,accepted.value.requestId);assert.equal(creations,1)
      const created=(await owner.query('SELECT g.*,j.status AS dispatch_status FROM profitia_jobs.delegations g JOIN profitia_jobs.dispatches j USING(delegation_id) WHERE g.request_id=$1',[accepted.value.requestId])).rows[0]
      assert.equal(created.user_id,U);assert.equal(created.organisation_id,A);assert.equal(created.dispatch_status,'PENDING')
      assert.equal(created.identity_binding_id,identity);assert.equal(created.payload_digest,PAYLOAD_DIGEST)
      assert(Date.parse(created.expires_at)>sessionExpiry,'Explicit bounded delegation is independent of browser token lifetime')
      assert.equal(created.issuer,undefined);assert.equal(created.subject,undefined);assert.equal(created.session,undefined)
      assert.equal((await foreground.query('SELECT profitia_jobs.create_dispatch($1::uuid,$2::uuid,$3) AS result',[accepted.value.requestId,randomUUID(),'request-fixture-v2'])).rows[0].result,null)
      for(const [deny,restore] of [
        ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id='"+U+"'","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE user_id='"+U+"'"],
        ["UPDATE profitia_access.organisations SET status='SUSPENDED'","UPDATE profitia_access.organisations SET status='ACTIVE'"],
        ["UPDATE profitia_access.product_grants SET status='REVOKED'","UPDATE profitia_access.product_grants SET status='ACTIVE'"],
        ["UPDATE profitia_modules.application_bindings SET status='REVOKED'","UPDATE profitia_modules.application_bindings SET status='ACTIVE'"],
        ["UPDATE profitia_jobs.execution_grants SET status='REVOKED'","UPDATE profitia_jobs.execution_grants SET status='ACTIVE'"],
        ["UPDATE profitia_access.runtime_bindings SET status='DISABLED' WHERE application_id='srm'","UPDATE profitia_access.runtime_bindings SET status='ACTIVE' WHERE application_id='srm'"],
        ["UPDATE profitia_access.applications SET status='DISABLED' WHERE application_id='srm'","UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'"],
      ]){
        await owner.query(deny);assert.equal(await read(),null);await owner.query(restore);assert(await read())
      }
      const userDeny=randomUUID(),serviceDeny=randomUUID()
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[userDeny,A,U])
      assert.equal(await read(),null);await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[userDeny]);assert(await read())
      await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'DENY','ACTIVE','SYNTHETIC_ONLY',$5)",[serviceDeny,EXECUTOR,binding,A,future()])
      assert.equal(await read(),null);await owner.query('DELETE FROM profitia_jobs.execution_grants WHERE grant_id=$1',[serviceDeny]);assert(await read())
      await owner.query("UPDATE profitia_jobs.operation_bindings SET configuration_version='request-fixture-v3'")
      assert.equal(await read(),null,'An older delegation is not valid for a replacement operation binding')
      const beforeRequests=(await owner.query('SELECT accepted_count FROM profitia_requests.policies')).rows[0].accepted_count
      await assert.rejects(foregroundHost.execute({...foregroundInput,idempotencyKey:'synthetic_foreground_delegation_000002'},accept),e=>isOperationDenied(e)&&e.reasonCode==='DELEGATION_INVALID')
      assert.equal((await owner.query('SELECT accepted_count FROM profitia_requests.policies')).rows[0].accepted_count,beforeRequests,'Changed binding rolls back the new request and its quota')
    })
    await t.test('composite keys reject changed resource or an external identity owned by another user',async()=>{
      // Exact source rows are immutable; a forged reference cannot be inserted
      // even by a statement that bypasses RLS for this synthetic negative case.
      await assert.rejects(owner.query("UPDATE profitia_jobs.delegations SET resource_id='foreign-target'"),error=>error.code==='42501')
      for(const [resource,selectedIdentity] of [['foreign-target',identity],['request:synthetic-target',otherIdentity]]){
        const next=randomUUID()
        await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'srm','development',$4,$5,'supplier.report.refresh','request:synthetic-target',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[next,hash(next),hash('binding:'+next),A,U,PAYLOAD_DIGEST,policy,randomUUID()])
        await assert.rejects(owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) VALUES($1,$2,'srm','development',$3,$4,'supplier.report.refresh',$5,$6,$7,1,$8,1,1,'ACTIVE','SYNTHETIC_ONLY',$9)",[randomUUID(),next,A,U,resource,PAYLOAD_DIGEST,binding,selectedIdentity,future()]),error=>error.code==='23503'
          && (resource==='foreign-target'?error.constraint.includes('request_id_application_id'):error.constraint.includes('identity_binding_id_user_id')))
      }
      await assert.rejects(owner.query("UPDATE profitia_jobs.dispatches SET source_id='foreign-source'"),error=>error.code==='42501')
      await assert.rejects(owner.query('DELETE FROM profitia_jobs.dispatches'),error=>error.code==='42501')
      const before=(await owner.query('SELECT revision FROM profitia_access.installation')).rows[0].revision
      await owner.query("UPDATE profitia_jobs.delegations SET status='REVOKED'")
      assert(BigInt((await owner.query('SELECT revision FROM profitia_access.installation')).rows[0].revision)>BigInt(before))
      assert.equal((await owner.query('SELECT version FROM profitia_jobs.delegations')).rows[0].version,'2')
    })
    await t.test('ordinary direct metadata access and mutation stay fenced after accidental DML grants',async()=>{
      await owner.query(`GRANT USAGE ON SCHEMA profitia_jobs TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_jobs TO ${EXECUTOR}`)
      const runtimeUrl=new URL(url);runtimeUrl.username=EXECUTOR;runtimeUrl.password='isolated_ci_only'
      runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
      assert.equal((await runtime.query('SELECT * FROM profitia_jobs.dispatches')).rows.length,0)
      assert.equal((await runtime.query("UPDATE profitia_jobs.dispatches SET status='CONFIRMED'")).rowCount,0)
      await assert.rejects(runtime.query('DELETE FROM profitia_jobs.delegations'),error=>error.code==='42501')
      await assert.rejects(runtime.query('SET ROLE profitia_access_owner'),error=>error.code==='42501')
      const tables=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_jobs' AND c.relkind='r'")).rows
      assert.equal(tables.length,6);assert(tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity))
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.dispatches')).rows[0].n,2)
    })
    await t.test('the unchanged default Forecast host still admits a real sibling Forecast job after SQL013 installation',async()=>{
      const foreRequest=randomUUID(),forePolicy=randomUUID(),foreBinding=randomUUID(),foreDelegation=randomUUID()
      const payload={kind:'CURRENT',seriesId:'synthetic-compat-series',modelId:'stored',targetSemantics:'CURRENT'},digest=operationPayloadDigest(payload)
      await controlled(async()=>{
        await owner.query(`REVOKE SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_jobs FROM ${EXECUTOR}`)
        await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru-sibling','ACTIVE')")
        await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES('supplier_forecast_compat_fixture','spendguru-sibling','ACTIVE')")
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru-sibling',$2,$3,'ALLOW','forecast.request','forecast')",[randomUUID(),A,U])
        await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru-sibling',$1,'SPENDGURU',ARRAY['benchmark','forecast'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
        await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru-sibling','benchmark',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
        await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru-sibling',$2,'forecast.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 minute',now()+interval '2 hours',$3,10)",[forePolicy,A,future()])
        await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'spendguru-sibling','development',$4,$5,'forecast.request','request:forecast-compat',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[foreRequest,'3'.repeat(64),'4'.repeat(64),A,U,digest,forePolicy,randomUUID()])
        await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'spendguru-sibling','forecast.request','supplier_forecast_compat_fixture','SPENDGURU_SAAS','compat-v1','supplier-jobs','stored.forecast','isolated-source-project','isolated-source-branch',$3,'forecast-source',$4,'forecast-command-v1','quality-v1','shared-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$2)",[foreBinding,future(),SOURCE_DATABASE,hash(source('008-platform-ingestion.sql'))])
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
  } finally {await runtime?.end();await sourceRuntime?.end();await sourceOwner?.end();await owner?.end();await root.end()}
})
