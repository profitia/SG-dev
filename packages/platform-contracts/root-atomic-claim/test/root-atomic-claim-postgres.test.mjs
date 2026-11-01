import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createRootAtomicClaimReportHost,createRootAtomicClaimDeliveryHost,rootAtomicClaimSchemaDigest} from '../src/root-atomic-claim.mjs'
import {createDelegatedJobHost} from '@profitia/platform-contracts/private-operation-host'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {createPlatformIngestionHost,createPlatformDeliveryPort} from '@profitia/platform-contracts/platform-ingestion'
const {Client}=createRequire(new URL('../../../../apps/architecture-lab/package.json',import.meta.url))('pg')
const ROLE='atomic_root_fixture',EXECUTOR='atomic_jobs_fixture',SOURCE_RUNTIME='atomic_source_fixture'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const ISSUER='https://identity.fixture.test',ORIGIN='https://srm.fixture.test',PAYLOAD={kind:'SUPPLIER_REPORT',nip:'5272443955'}
const source=n=>fs.readFileSync(new URL('../../migrations/access/'+n,import.meta.url),'utf8')
const hash=v=>createHash('sha256').update(v).digest('hex'),future=()=>new Date(Date.now()+3600000).toISOString()
const migration=source('007-delegated-jobs.sql'),supplierMigration=source('013-supplier-delegation.sql')
const newMigration=fs.readFileSync(new URL('../migrations/001-root-atomic-claim.sql',import.meta.url),'utf8')

test('atomic Root claim: real ordinary roles, physical COMMIT, Source, revocation, opaque proof and recovery',
 {skip:!process.env.OPERATION_FIXTURE_OWNER_URL},async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect()
 const database='atomic_root_'+randomUUID().replaceAll('-',''),sourceDatabase=database+'_source',url=new URL(rootUrl);url.pathname='/'+database
 let owner,foreground,runtime,sourceOwner,sourceRuntime
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0)
  await root.query(`CREATE DATABASE ${database}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const[name,login]of[['profitia_access_owner',false],['profitia_ingestion_owner',false],[ROLE,true],[EXECUTOR,true],[SOURCE_RUNTIME,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)
    await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[name])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }
  await root.query('COMMIT')
  owner=new Client({connectionString:url.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${database} TO profitia_access_owner`)
  const controlled=async action=>{
   await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
   try{const v=await action();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}
  }
  const schemaDigest=await rootAtomicClaimSchemaDigest()
  await controlled(async()=>{
   for(const[file,table]of[
    ['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],
    ['003-module-audit.sql','profitia_modules.audit_installation'],['005-service-read.sql','profitia_services.installation'],
    ['006-request-reservation.sql','profitia_requests.installation'],['007-delegated-jobs.sql','profitia_jobs.installation'],
    ['010-external-request-admission.sql','profitia_requests.external_installation'],['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],
   ]){
    const sql=source(file);await owner.query(sql)
    if(file.startsWith('001'))await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-delegated-project','isolated-delegated-branch',$2)",[hash(sql),database])
    else if(file.startsWith('002'))await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
    else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(sql)])
   }
  })
  await t.test('controlled owner only, partial migration is atomic, nothing live is seeded',async()=>{
   await assert.rejects(owner.query(newMigration),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(newMigration);throw Error('SYNTHETIC_PARTIAL_INSTALL')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_root_claim') value")).rows[0].value,null)
   await controlled(async()=>{await owner.query(newMigration)})
   for(const table of ['installation','receivers','claim_log'])assert.equal((await owner.query(`SELECT count(*)::int n FROM profitia_root_claim.${table}`)).rows[0].n,0)
  })
  const operationBinding=randomUUID(),identityBinding=randomUUID()
  await controlled(async()=>{
   await owner.query("INSERT INTO profitia_root_claim.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[schemaDigest])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
   await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')",[A,B])
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE'),('supplier-jobs','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE'),($2,'supplier-jobs','ACTIVE')",[ROLE,EXECUTOR])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'user_fixture',$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[identityBinding,ISSUER,U,future()])
   await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,U,future()])
   await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[A,future()])
   for(const operation of['supplier.report.read','supplier.report.refresh'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),A,U,operation])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,200)",[randomUUID(),A,future()])
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-worker','worker-fixture-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),randomUUID(),future()])
   await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'srm','supplier.report.refresh',$2,'SUPPLIER_INTELLIGENCE_STANDALONE','request-fixture-v2','supplier-jobs','stored.supplier-command','isolated-source-project','isolated-source-branch',$4,'supplier-source',$5,'supplier-command-v1','quality-v1','shared-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$3)",[operationBinding,ROLE,future(),sourceDatabase,hash(source('008-platform-ingestion.sql'))])
   await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,operationBinding,A,future()])
   await owner.query("INSERT INTO profitia_root_claim.receivers(foreground_role,executor_role,enabled,expires_at,source_ref) VALUES($1,$2,true,$3,'SYNTHETIC_ONLY')",[ROLE,EXECUTOR,future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs,profitia_root_claim TO ${ROLE};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${ROLE};
    GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text),profitia_root_claim.runtime_descriptor(),profitia_root_claim.claim_dispatch(uuid,uuid,text,text) TO ${ROLE};
    GRANT USAGE ON SCHEMA profitia_jobs,profitia_access,profitia_services,profitia_root_claim TO ${EXECUTOR};
    GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.claim_dispatch(uuid),profitia_jobs.delivery_state(uuid,uuid),profitia_jobs.observe_delivery(uuid,uuid,text,uuid,text,text),profitia_jobs.append_audit(jsonb),profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_root_claim.bind_delivery(uuid,uuid,uuid,text) TO ${EXECUTOR};
    CREATE SCHEMA atomic_fixture;
    CREATE TABLE atomic_fixture.metadata(organisation_id uuid NOT NULL,user_id uuid NOT NULL,phase text NOT NULL,request_id uuid);
    ALTER TABLE atomic_fixture.metadata ENABLE ROW LEVEL SECURITY;ALTER TABLE atomic_fixture.metadata FORCE ROW LEVEL SECURITY;
    CREATE POLICY owner_seed ON atomic_fixture.metadata TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY exact_actor ON atomic_fixture.metadata TO ${ROLE} USING(profitia_access.scope_allows('srm',organisation_id,user_id)) WITH CHECK(profitia_access.scope_allows('srm',organisation_id,user_id));
    GRANT USAGE ON SCHEMA atomic_fixture TO ${ROLE};GRANT SELECT,INSERT ON atomic_fixture.metadata TO ${ROLE}`)
  })
  const foregroundUrl=new URL(url);foregroundUrl.username=ROLE;foregroundUrl.password='isolated_ci_only'
  const runtimeUrl=new URL(url);runtimeUrl.username=EXECUTOR;runtimeUrl.password='isolated_ci_only'
  foreground=new Client({connectionString:foregroundUrl.toString()});await foreground.connect()
  runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
      // A physically separate source database. Private actor/membership/job rows
      // never enter it; the fixed SDK port publishes only universal content.
      assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[sourceDatabase])).rowCount,0)
      await root.query(`CREATE database ${sourceDatabase}`)
      await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
      try{for(const[role,login]of[['profitia_ingestion_owner',false],[SOURCE_RUNTIME,true]]){
        if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
          await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
      }await root.query('COMMIT')}catch(error){await root.query('ROLLBACK');throw error}
      const sourceUrl=new URL(rootUrl);sourceUrl.pathname='/'+sourceDatabase
      sourceOwner=new Client({connectionString:sourceUrl.toString()});await sourceOwner.connect()
      await sourceOwner.query(`GRANT CREATE ON database ${sourceDatabase} TO profitia_ingestion_owner;GRANT CREATE ON SCHEMA public TO profitia_ingestion_owner;BEGIN;SET LOCAL ROLE profitia_ingestion_owner`)
      try{
        await sourceOwner.query(source('008-platform-ingestion.sql'))
        await sourceOwner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-source-project','isolated-source-branch',$2)",[hash(source('008-platform-ingestion.sql')),sourceDatabase])
        await sourceOwner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'supplier-source','PLATFORM_INTERNAL','synthetic-source','source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[SOURCE_RUNTIME,randomUUID(),randomUUID()])
        await sourceOwner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES('stored.supplier-command','STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','supplier-command-v1','quality-v1','shared-v1','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')")
        await sourceOwner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,'stored.supplier-command','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),SOURCE_RUNTIME])
        await sourceOwner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'supplier-source','stored.supplier-command','SOURCE_TRANSACTION',200,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID()])
        await sourceOwner.query("CREATE TABLE public.synthetic_delivery(effect_id uuid PRIMARY KEY,resource_id text NOT NULL,payload jsonb NOT NULL);ALTER TABLE public.synthetic_delivery ENABLE ROW LEVEL SECURITY;ALTER TABLE public.synthetic_delivery FORCE ROW LEVEL SECURITY;CREATE POLICY owner_access ON public.synthetic_delivery TO profitia_ingestion_owner USING(true) WITH CHECK(true)")
        await sourceOwner.query(`CREATE POLICY source_write ON public.synthetic_delivery FOR INSERT TO ${SOURCE_RUNTIME} WITH CHECK(profitia_ingestion.scope_allows('stored.supplier-command',resource_id));GRANT INSERT ON public.synthetic_delivery TO ${SOURCE_RUNTIME};GRANT USAGE ON SCHEMA profitia_ingestion TO ${SOURCE_RUNTIME};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb) TO ${SOURCE_RUNTIME}`)
        await sourceOwner.query('COMMIT')
      }catch(error){await sourceOwner.query('ROLLBACK');throw error}
      const sourceRuntimeUrl=new URL(sourceUrl);sourceRuntimeUrl.username=SOURCE_RUNTIME;sourceRuntimeUrl.password='isolated_ci_only'
      sourceRuntime=new Client({connectionString:sourceRuntimeUrl.toString()});await sourceRuntime.connect()
      let sourceWrites=0
      const sourceOptions={application:{appId:'supplier-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-source',configurationVersion:'source-v1',
          identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
        binding:{applicationId:'supplier-source',environment:'development',projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:sourceDatabase,
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

  const count=async(table)=>Number((await owner.query('SELECT count(*) n FROM '+table)).rows[0].n)
  const write=(phase,context,c)=>c.query('INSERT INTO atomic_fixture.metadata VALUES($1,$2,$3,$4)',[context.organisationId,context.actorId,phase,context.requestReservation?.requestId??null])
  function fixture(){
   const f={calls:[],transactions:[],live:0,ready:false,rootCount:0,workCount:0,readCount:0,offset:0,failOutcome:false,omitOutcome:false,commitUnknown:false,beforeWork:null,afterWork:null,beforeCommit:null,claimCalls:0,proof:null}
   const now=()=>Date.now()+f.offset
   f.user={id:'user_fixture',banned:false,locked:false,deprovisioned:false}
   f.session={id:'session_fixture',userId:'user_fixture',status:'active',actor:null,expireAt:Date.now()+120000,abandonAt:Date.now()+120000}
   const auth={isAuthenticated:true,tokenType:'session_token',userId:'user_fixture',sessionId:'session_fixture',sessionClaims:{iss:ISSUER,sub:'user_fixture',sid:'session_fixture',azp:ORIGIN,exp:Math.floor(Date.now()/1000)+120}}
   f.clerk={authenticateRequest:async()=>{f.calls.push('sdk');return{status:'signed-in',isAuthenticated:true,toAuth:()=>auth}},sessions:{getSession:async()=>{f.calls.push('session');return f.session}},users:{getUser:async()=>{f.calls.push('account');return f.user}}}
   const application={appId:'srm',environment:'development',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'synthetic',configurationVersion:'request-fixture-v2',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:['supplier.report.read']}
   const binding={applicationId:'srm',environment:'development',projectId:'isolated-delegated-project',branchId:'isolated-delegated-branch',databaseName:database,role:ROLE,schemaDigest:hash(source('001-internal-access.sql'))}
   const module={id:'supplier_report',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))}
   const driver=runtimeConnection=>({independentQuery:(sql,args)=>runtimeConnection.query(sql,args),transact:async run=>{
    const url_=runtimeConnection===foreground?foregroundUrl:runtimeUrl,c=new Client({connectionString:url_.toString()});await c.connect();f.live++
    let rootClaim=false
    try{
     await c.query('BEGIN');const txid=(await c.query('SELECT txid_current()::text n')).rows[0].n;f.transactions.push(txid)
     const query=async(sql,args)=>{
      if(sql.includes('profitia_root_claim.claim_dispatch')){rootClaim=true;f.claimCalls++}
      if(f.failOutcome&&sql.includes('append_audit')&&JSON.parse(args[0]).phase==='OUTCOME'
       &&['supplier.report.refresh','job.execute'].includes(JSON.parse(args[0]).operation))throw Error('SYNTHETIC_OUTCOME_FAILURE')
      if(f.omitOutcome&&sql.includes('append_audit')&&JSON.parse(args[0]).operation==='supplier.report.refresh'&&JSON.parse(args[0]).phase==='OUTCOME')return{rows:[{recorded:true}]}
      return c.query(sql,args)
     }
     const result=await run({query,transaction:c})
     if(rootClaim&&f.beforeCommit)await f.beforeCommit(c)
     await c.query('COMMIT')
     if(rootClaim&&f.commitUnknown)throw Error('SYNTHETIC_COMMIT_ACK_LOST')
     return result
    }catch(error){await c.query('ROLLBACK');throw error}finally{f.live--;await c.end()}
   }})
   const read={application,binding,module,...driver(foreground),readResources:async({request})=>({resource:{id:request.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'1',projectionVersion:'synthetic-ready-v1',approvedSharedProjection:true}}),projectOutput:v=>v}
   f.options={clerk:f.clerk,identity:{appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},receiverBoundary:{publicOrigins:[ORIGIN],internalOrigins:['http://127.0.0.1:9999']},now,atomicClaim:{schemaDigest},probeReadOnly:{statements:['SELECT 1']},probe:{...read},read:{...read},
    refresh:{...read,application:{...application,operations:['supplier.report.refresh']},requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql'))},
     readResources:async({request,scope})=>({resource:{id:request.resourceId,type:'supplier_report_request',dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:scope.userId,version:'1',projectionVersion:'synthetic-intent-v1'}})}}
   f.deliveryOptions={application:{appId:'supplier-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1',organisationId:null,identityIssuer:'urn:profitia:database-service-runtime:v1',features:['job_execution'],operations:['job.execute']},
    binding:{...binding,applicationId:'supplier-jobs',role:EXECUTOR,service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-fixture-v1'}},
    job:{schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(supplierMigration)},...driver(runtime),
    readExternalAccount:createClerkAccountStatusReader({client:f.clerk,environment:'development',issuer:ISSUER,now}),sourceDelivery,now}
   f.controller=new AbortController()
   f.input={request:new Request(ORIGIN+'/api/search',{method:'POST',headers:{origin:ORIGIN},signal:f.controller.signal}),organisationId:A,nip:PAYLOAD.nip,idempotencyKey:randomUUID().replaceAll('-','')}
   f.operation=selection=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:selection.organisationId,resourceId:selection.requestId,payload:selection.command,request:null})
   f.actions={probe:async()=>f.ready?{status:'READY',value:{report:'cached'}}:{status:'MISS'},ready:async value=>value,
    refresh:async(context,c)=>{f.rootCount++;await write('ROOT',context,c);const store=createDelegatedJobStore({binding,schemaDigest:hash(migration),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(supplierMigration)})
     await store.createDispatch(c.query.bind(c),context);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}},
    work:async selection=>{
     f.workCount++;f.selection=selection;f.proof=selection.rootClaim
     assert.equal(f.live,0,'Actual Root COMMIT completed before work')
     assert.equal((await owner.query('SELECT status FROM profitia_requests.intents WHERE request_id=$1',[selection.requestId])).rows[0].status,'ACCEPTED')
     assert.equal((await owner.query('SELECT root_transaction_id FROM profitia_root_claim.claim_log WHERE request_id=$1',[selection.requestId])).rows.length,1)
     if(f.beforeWork)await f.beforeWork(selection)
     if(selection.rootClaim)await createRootAtomicClaimDeliveryHost(f.deliveryOptions).deliver(f.operation(selection),selection.rootClaim)
     else{
      const host=createDelegatedJobHost(f.deliveryOptions),admission=await host.admit(f.operation(selection))
      if(admission.value.status==='READY')await host.deliver(f.operation(selection),admission.value)
      else assert(['CONFIRMED','BUSY','RECONCILE_REQUIRED'].includes(admission.value.status))
     }
     if(f.afterWork)await f.afterWork(selection)
    },
    read:async(context,c)=>{f.readCount++;await write('DISCLOSURE',context,c);return{status:'READY',value:{report:'fresh'}}}}
   f.run=()=>createRootAtomicClaimReportHost(f.options).execute(f.input,f.actions)
   return f
  }
  await t.test('one new genuine Root claims atomically; current Jobs and separate Source commit, then H4',async()=>{
   const f=fixture(),before=sourceWrites
   const beforeClaims=await count('profitia_root_claim.claim_log')
   f.beforeCommit=async()=>{assert.equal(f.proof,null);assert.equal(f.workCount,0);assert.equal(await count('profitia_root_claim.claim_log'),beforeClaims,'Uncommitted claim is invisible to another actual connection')}
   assert.deepEqual(await f.run(),{report:'fresh'})
   assert.equal(f.claimCalls,1);assert.equal(f.rootCount,1);assert.equal(f.workCount,1);assert.equal(f.readCount,1);assert.equal(sourceWrites,before+1)
   assert.equal(f.calls.filter(c=>c==='session').length,3);assert.equal(f.calls.filter(c=>c==='account').length,4)
   const c=(await owner.query('SELECT * FROM profitia_root_claim.claim_log WHERE request_id=$1',[f.selection.requestId])).rows[0]
   assert.equal(c.attempt,1);assert.equal(c.user_id,U);assert.equal(c.organisation_id,A);assert.equal(c.foreground_role,ROLE);assert.equal(c.executor_role,EXECUTOR)
   const events=(await owner.query('SELECT phase,event FROM profitia_access.security_events WHERE decision_id=$1 ORDER BY event_id',[c.root_decision_id])).rows
   assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert(events.every(e=>e.event.actorKind==='HUMAN'&&e.event.moduleEvidence.transactionId===c.root_transaction_id))
   assert.equal((await owner.query('SELECT status FROM profitia_jobs.dispatches WHERE job_id=$1',[c.request_id])).rows[0].status,'CONFIRMED')
   assert.equal(JSON.stringify(f.proof),'{}');assert(Object.isFrozen(f.proof))
   await assert.rejects(createRootAtomicClaimDeliveryHost(f.deliveryOptions).deliver(f.operation(f.selection),f.proof),isOperationDenied)
  })
  await t.test('READY avoids Root, claim, Work and Source',async()=>{
   const f=fixture();f.ready=true;const before=sourceWrites
   assert.deepEqual(await f.run(),{report:'cached'});assert.equal(f.rootCount,0);assert.equal(f.claimCalls,0);assert.equal(f.workCount,0);assert.equal(sourceWrites,before)
  })
  for(const mode of ['failOutcome','omitOutcome','banAtH3'])await t.test(mode+' rolls back request, claim, domain writes and prohibits Work/Source',async()=>{
   const f=fixture(),before=await count('profitia_requests.intents'),beforeClaims=await count('profitia_root_claim.claim_log'),beforeSource=sourceWrites
   if(mode==='banAtH3'){const action=f.actions.refresh;f.actions.refresh=async(...args)=>{const v=await action(...args);f.user.banned=true;return v}}
   else f[mode]=true
   await assert.rejects(f.run());assert.equal(f.rootCount,1,'Failure exercised actual Root, not the earlier probe');assert.equal(f.workCount,0);assert.equal(sourceWrites,beforeSource);assert.equal(await count('profitia_requests.intents'),before);assert.equal(await count('profitia_root_claim.claim_log'),beforeClaims)
  })
  await t.test('actual Root COMMIT followed by lost acknowledgement issues no proof; replay uses ordinary recovery',async()=>{
   const f=fixture(),before=sourceWrites;f.commitUnknown=true
   await assert.rejects(f.run());assert.equal(f.workCount,0);assert.equal(f.proof,null);assert.equal(sourceWrites,before)
   const receipt=(await owner.query('SELECT request_id FROM profitia_requests.intents WHERE key_digest IS NOT NULL ORDER BY created_at DESC LIMIT 1')).rows[0]
   assert(receipt)
   f.commitUnknown=false;assert.deepEqual(await f.run(),{report:'fresh'});assert.equal(f.proof,null);assert.equal(f.claimCalls,1);assert.equal(f.rootCount,1)
   assert.equal(sourceWrites,before,'BUSY retained claim is not replayed against Source')
  })
  for(const mode of ['forged','json','clone','otherRequest','otherOrg','otherPayload','otherRole','expired','aborted','changedTransport'])await t.test('proof refuses '+mode+' before Source',async()=>{
   const f=fixture(),before=sourceWrites
   f.beforeWork=async selection=>{
    let proof=selection.rootClaim,input=f.operation(selection),options=f.deliveryOptions
    if(mode==='forged')proof={}
    if(mode==='json')proof=JSON.parse(JSON.stringify(proof))
    if(mode==='clone')proof=structuredClone(proof)
    if(mode==='otherRequest')input={...input,resourceId:randomUUID()}
    if(mode==='otherOrg')input={...input,organisationId:B}
    if(mode==='otherPayload')input={...input,payload:{...PAYLOAD,nip:'1234567890'}}
    if(mode==='otherRole')options={...options,binding:{...options.binding,role:'foreign_runtime'}}
    if(mode==='expired')f.offset=31000
    if(mode==='aborted')f.controller.abort()
    if(mode==='changedTransport')f.input.request.headers.set('x-mutated','true')
    await assert.rejects(createRootAtomicClaimDeliveryHost(options).deliver(input,proof),isOperationDenied)
    throw Error('EXPECTED_STOP_AFTER_REFUSAL')
   }
   await assert.rejects(f.run(),/EXPECTED_STOP_AFTER_REFUSAL/);assert.equal(sourceWrites,before);assert.equal(f.readCount,0)
  })
  await t.test('once-only proof cannot be used twice within Work',async()=>{
   const f=fixture()
   f.afterWork=async selection=>{await assert.rejects(createRootAtomicClaimDeliveryHost(f.deliveryOptions).deliver(f.operation(selection),selection.rootClaim),isOperationDenied)}
   assert.deepEqual(await f.run(),{report:'fresh'})
  })
  for(const change of ['receiver','account','membership','product','executorGrant'])await t.test('current '+change+' revocation after Root prevents Source',async()=>{
   const f=fixture(),before=sourceWrites
   const sqls={receiver:["UPDATE profitia_root_claim.receivers SET enabled=false","UPDATE profitia_root_claim.receivers SET enabled=true"],membership:["UPDATE profitia_access.memberships SET status='SUSPENDED'","UPDATE profitia_access.memberships SET status='ACTIVE'"],product:["UPDATE profitia_access.product_grants SET status='REVOKED'","UPDATE profitia_access.product_grants SET status='ACTIVE'"],executorGrant:["UPDATE profitia_jobs.execution_grants SET status='REVOKED'","UPDATE profitia_jobs.execution_grants SET status='ACTIVE'"]}
   f.beforeWork=async()=>{if(change==='account')f.user.banned=true;else await owner.query(sqls[change][0])}
   try{await assert.rejects(f.run(),isOperationDenied);assert.equal(sourceWrites,before);assert.equal(f.readCount,0)}finally{if(change!=='account')await owner.query(sqls[change][1])}
  })
  await t.test('H4 fresh ban prevents disclosure after independently committed Source',async()=>{
   const f=fixture(),before=sourceWrites,beforeWrites=await count('atomic_fixture.metadata');f.afterWork=async()=>{f.user.banned=true}
   await assert.rejects(f.run(),isOperationDenied);assert.equal(sourceWrites,before+1);assert.equal(f.readCount,1)
   assert.equal(await count('atomic_fixture.metadata'),beforeWrites+1,'Final read action runs before fresh H4, but its private writes roll back and no response is disclosed')
  })
  await t.test('Source COMMIT survives private Jobs OUTCOME failure; old recovery reconciles without a repeated Source write',async()=>{
   const f=fixture(),before=sourceWrites
   f.beforeWork=async()=>{f.failOutcome=true}
   await assert.rejects(f.run(),e=>e.reasonCode==='DELIVERY_UNCERTAIN');assert.equal(sourceWrites,before+1);assert.equal(f.readCount,0)
   const requestId=f.selection.requestId
   assert.equal((await owner.query('SELECT status FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0].status,'READY')
   f.failOutcome=false;f.beforeWork=null
   await owner.query("UPDATE profitia_jobs.dispatches SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id=$1",[requestId])
   assert.deepEqual(await f.run(),{report:'fresh'});assert.equal(f.proof,null);assert.equal(sourceWrites,before+1)
   assert.equal((await owner.query('SELECT status,attempt_count FROM profitia_jobs.dispatches WHERE job_id=$1',[requestId])).rows[0].attempt_count,2)
  })
  await t.test('disabled receiver fails closed without fallback or committing Root',async()=>{
   const f=fixture(),before=await count('profitia_requests.intents'),beforeSource=sourceWrites
   await owner.query('UPDATE profitia_root_claim.receivers SET enabled=false')
   try{await assert.rejects(f.run(),isOperationDenied);assert.equal(f.workCount,0);assert.equal(sourceWrites,beforeSource);assert.equal(await count('profitia_requests.intents'),before)}finally{await owner.query('UPDATE profitia_root_claim.receivers SET enabled=true')}
  })
  await t.test('ordinary roles cannot call service claim, inspect or mutate private provenance; default RLS is forced',async()=>{
   await assert.rejects(foreground.query('SELECT profitia_jobs.claim_dispatch($1::uuid)',[randomUUID()]),e=>e.code==='42501')
   await assert.rejects(foreground.query('SELECT * FROM profitia_root_claim.claim_log'),e=>e.code==='42501')
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_root_claim TO ${ROLE}`)
   try{
    assert.equal((await foreground.query('SELECT * FROM profitia_root_claim.claim_log')).rowCount,0)
    assert.equal((await foreground.query('SELECT profitia_root_claim.runtime_descriptor() d')).rows[0].d,null)
    await assert.rejects(foreground.query("UPDATE profitia_root_claim.receivers SET enabled=true"),e=>e.code==='42501')
   }finally{await owner.query(`REVOKE SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_root_claim FROM ${ROLE}`)}
   for(const sql of ["UPDATE profitia_root_claim.installation SET source_ref='forged'",'DELETE FROM profitia_root_claim.claim_log','TRUNCATE profitia_root_claim.claim_log'])await assert.rejects(owner.query(sql),e=>e.code==='42501')
   const tables=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_root_claim' AND c.relkind='r'")).rows
   assert.equal(tables.length,3);assert(tables.every(v=>v.relrowsecurity&&v.relforcerowsecurity))
  })
 }finally{
  for(const c of [foreground,runtime,sourceRuntime,sourceOwner,owner])if(c)await c.end()
  for(const name of [sourceDatabase,database])if((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await root.query(`DROP DATABASE ${name}`)
  await root.end()
 }
})
