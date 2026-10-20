import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {OPERATION_CONTRACT} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {createSg2DiscoveryRequestHost,createSg2DiscoveryReadHost} from '../lib/benchmark/discovery-host.ts'
import {createDiscoveryRequestPersister,createSg2DiscoveryNativeStore} from '../lib/benchmark/discovery-native.ts'
import {readDiscoveryCommand,discoveryRequestResourceId,discoveryResultResourceId,readPrivateDiscovery} from '../lib/benchmark/discovery-operation.ts'
import {createDiscoveryMetadataLoader} from '../lib/benchmark/discovery-metadata.ts'
import {runWithBenchmarkProviderScope} from '../lib/benchmark/provider-scope.ts'
import {getStoredBenchmarkMetadataDefinitions,getStoredBenchmarkMetadataValues} from '../lib/benchmark/metadata-store.ts'
const require=createRequire(import.meta.url),{Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg'),{PrismaClient}=require('@prisma/client')
const hash=v=>createHash('sha256').update(v).digest('hex'),source=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const DATABASE='sg2_discovery_'+randomUUID().replaceAll('-',''),F='sg2_discovery_foreground_fixture',W='sg2_discovery_work_fixture'
const A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),ISSUER='https://identity.fixture.test',ORIGIN='http://localhost:3001',future=()=>new Date(Date.now()+3600000).toISOString()
const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql','010-external-request-admission.sql','011-request-continuation.sql','013-supplier-delegation.sql','014-delegated-private-phases.sql','015-delegated-private-inspection.sql','016-delegated-native-work.sql','017-additional-request-operations.sql']
const tables=['profitia_access.installation','profitia_modules.installation','profitia_modules.audit_installation','profitia_services.installation','profitia_requests.installation','profitia_jobs.installation','profitia_requests.external_installation','profitia_request_phases.installation','profitia_supplier_jobs.installation','profitia_delegated_phases.installation','profitia_request_inspection.installation','profitia_request_work.installation','profitia_requests.operation_installation']
const business=fs.readFileSync(new URL('../prisma/private-store/006-benchmark-discovery.sql',import.meta.url),'utf8'),boundary=hash(business)
const refused=e=>e instanceof Error&&e.name==='OperationDenied'

test('Finder uses actual ordinary native roles, durable private ownership and the one Root/job/audit contract',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 const clients=[];let owner,created=false,externalActive=true
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0);await root.query(`CREATE DATABASE ${DATABASE}`);created=true
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const[role,login]of[['profitia_access_owner',false],[F,true],[W,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const value=await action();await owner.query('COMMIT');return value}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   for(let i=0;i<files.length;i++){
    const sql=source(files[i]);await owner.query(sql)
    if(i===0)await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-discovery-project','isolated-discovery-branch',$2)",[hash(sql),DATABASE])
    else if(i===1)await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
    else await owner.query(`INSERT INTO ${tables[i]} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY_NOT_RELEASE')`,[hash(sql)])
   }
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','DISABLED'),('spendguru-benchmark-dispatch','DISABLED')")
  })
  await t.test('migration refuses the administrative login and an interruption leaves no partial application schema',async()=>{
   await assert.rejects(owner.query(business),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(business);throw Error('fixture interruption')}))
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_benchmark_discovery') AS n")).rows[0].n,null)
  })
  await controlled(async()=>{
   await owner.query(business);await owner.query("INSERT INTO profitia_benchmark_discovery.installation VALUES(true,'1.0.0',$1,$2,3600,$3)",[boundary,'a'.repeat(40),future()])
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE'),($2,'spendguru-benchmark-dispatch','ACTIVE')",[F,W])
   for(const user of[U,V]){
    await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
    await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,future()])
   }
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    for(const user of[U,V]){
     await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,future()])
     for(const op of['benchmark.discovery.request','benchmark.discovery.read'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW',$4,'benchmark')",[randomUUID(),org,user,op])
    }
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['benchmark'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[org,future()])
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru',$2,'benchmark.discovery.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,20)",[randomUUID(),org,future()])
   }
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru','benchmark',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-dispatch','dispatch-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[W,randomUUID(),randomUUID(),future()])
   for(const[unit,mode]of[['SG2_DISCOVERY_READ','READ'],['SG2_DISCOVERY_SAVE','WRITE']])await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('spendguru',$1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[unit,mode,future()])
   const bindingId=randomUUID()
   await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'spendguru','benchmark.discovery.request',$2,'SPENDGURU_SAAS','request-v1','spendguru-benchmark-dispatch','sg2.discovery.control','isolated-source-project','isolated-source-branch','isolated_source','spendguru-benchmark-source',$3,'technical-command-v1','quality-v1','technical-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$4)",[bindingId,F,hash(source('008-platform-ingestion.sql')),future()])
   for(const org of[A,B])await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),W,bindingId,org,future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs,profitia_benchmark_discovery TO ${F};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_benchmark_discovery TO ${F};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${F};GRANT SELECT,INSERT ON profitia_benchmark_discovery.commands TO ${F};GRANT SELECT ON profitia_benchmark_discovery.results TO ${F};
    GRANT USAGE ON SCHEMA profitia_access,profitia_services,profitia_requests,profitia_jobs,profitia_request_work,profitia_benchmark_discovery TO ${W};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_benchmark_discovery TO ${W};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_requests.operation_runtime_descriptor(),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text) TO ${W};GRANT SELECT ON profitia_benchmark_discovery.commands,profitia_benchmark_discovery.results TO ${W};GRANT INSERT ON profitia_benchmark_discovery.results TO ${W};UPDATE profitia_access.applications SET status='ACTIVE'`)
  })
  await controlled(()=>owner.query(`GRANT EXECUTE ON FUNCTION profitia_requests.scope_allows(text,uuid,uuid,text) TO ${W}`))
  const runtimeUrl=role=>{const u=new URL(url);u.username=role;u.password='isolated_ci_only';u.searchParams.set('connection_limit','2');return u.toString()}
  const pool=role=>{const p=new PrismaClient({datasources:{db:{url:runtimeUrl(role)}}});clients.push(p);return p}
  const prisma=pool(F),auditPrisma=pool(F),workPrisma=pool(W),workAudit=pool(W)
  const clerk={authenticateRequest:async request=>{
   const user=request.headers.get('authorization')?.replace(/^Bearer external-/,'');const ok=[U,V].includes(user)
   return{status:ok?'signed-in':'signed-out',isAuthenticated:ok,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'external-'+user,sessionId:'session-'+user,actor:null,sessionClaims:{iss:ISSUER,sub:'external-'+user,sid:'session-'+user,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600}})}
  },sessions:{getSession:async id=>({id,userId:id.replace('session-','external-'),status:'active',expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000,actor:null})},users:{getUser:async id=>({id,banned:!externalActive,locked:false,deprovisioned:false})}}
  const binding=role=>({applicationId:role===F?'spendguru':'spendguru-benchmark-dispatch',environment:'development',projectId:'isolated-discovery-project',branchId:'isolated-discovery-branch',databaseName:DATABASE,role,schemaDigest:hash(source(files[0]))})
  const application=operation=>({appId:'spendguru',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'synthetic-foreground',configurationVersion:'request-v1',identityIssuer:ISSUER,organisationId:null,operations:[operation],features:['benchmark']})
  const common={prisma,auditPrisma,clerk,binding:binding(F),identity:{appId:'spendguru',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},module:{id:'benchmark',schemaDigest:hash(source(files[1])),auditSchemaDigest:hash(source(files[2]))},boundaryDigest:boundary}
  const requestHost=createSg2DiscoveryRequestHost({...common,application:application('benchmark.discovery.request'),requestLedger:{schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql')),operationSchemaDigest:hash(source('017-additional-request-operations.sql'))}})
  const readHost=createSg2DiscoveryReadHost({...common,application:application('benchmark.discovery.read')})
  const job={schemaDigest:hash(source('007-delegated-jobs.sql')),targetOperation:'benchmark.discovery.request',supplierSchemaDigest:hash(source('013-supplier-delegation.sql')),operationSchemaDigest:hash(source('017-additional-request-operations.sql'))}
  const persist=createDiscoveryRequestPersister(binding(F),job)
  const work=createSg2DiscoveryNativeStore({prisma:workPrisma,auditPrisma:workAudit,clerk,binding:{...binding(W),service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-dispatch',configurationVersion:'dispatch-v1'}},
   application:{appId:'spendguru-benchmark-dispatch',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-dispatch',configurationVersion:'dispatch-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']},job,workSchemaDigest:hash(source('016-delegated-native-work.sql')),boundaryDigest:boundary,accountIdentity:{environment:'development',issuer:ISSUER}})
  const command=readDiscoveryCommand({kind:'SEARCH',query:'private steel procurement'}),key='discovery_'+randomUUID()
  const request=(user=U)=>new Request(ORIGIN+'/api/benchmark/search',{headers:{authorization:'Bearer external-'+user}})
  const admit=(user=U,org=A,idempotencyKey=key)=>requestHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.discovery.request',organisationId:org,resourceId:discoveryRequestResourceId(command),payload:command,idempotencyKey,request:request(user)},persist)
  const accepted=await(await admit()).value.json(),selected={requestId:accepted.requestId,organisationId:A,command}
  const read=(user=U,org=A)=>readHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.discovery.read',organisationId:org,resourceId:discoveryResultResourceId(selected.requestId),payload:{requestId:selected.requestId},request:request(user)},readPrivateDiscovery)
  await t.test('one canonical request and dispatch, private empty state and stable replay',async()=>{
   assert.deepEqual(await(await admit()).value.json(),accepted);assert.equal(await work.read(selected),null)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_benchmark_discovery.commands')).rows[0].n,1)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_jobs.delegations')).rows[0].n,1)
  })
  await t.test('private body persists only through the current native save and a fresh HUMAN read',async()=>{
   await work.save(selected,{items:[]});const value=await work.read(selected);assert.equal(value.requestId,selected.requestId)
   assert.deepEqual(await(await read()).value.json(),{items:[]})
   await assert.rejects(work.save(selected,{items:[]}))
  })
  await t.test('another organisation and another member cannot read the same private result',async()=>{
   await assert.rejects(read(V),refused);await assert.rejects(read(U,B),refused)
   await assert.rejects(work.read({...selected,organisationId:B}),refused)
   assert.equal((await prisma.$queryRawUnsafe('SELECT count(*)::int n FROM profitia_benchmark_discovery.results'))[0].n,0)
   assert.equal((await workPrisma.$queryRawUnsafe('SELECT count(*)::int n FROM profitia_benchmark_discovery.results'))[0].n,0)
  })
  await t.test('expired membership, revoked read grant and unavailable current external account fail closed',async()=>{
   await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id='spendguru' AND organisation_id=$1 AND user_id=$2 AND operation='benchmark.discovery.read'",[A,U]));await assert.rejects(read(),refused)
   await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE application_id='spendguru' AND organisation_id=$1 AND user_id=$2 AND operation='benchmark.discovery.read'",[A,U]))
   externalActive=false;await assert.rejects(work.read(selected),refused);externalActive=true
   await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]));await assert.rejects(read(),refused);await assert.rejects(work.read(selected),refused)
   await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
  })
  await t.test('forged context markers and a failed required audit cannot disclose the result',async()=>{
   await prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT set_config('profitia.user_id',$1,true),set_config('profitia.organisation_id',$2,true)",U,A);assert.equal((await tx.$queryRawUnsafe('SELECT count(*)::int n FROM profitia_benchmark_discovery.results'))[0].n,0)})
   await controlled(()=>owner.query(`REVOKE EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) FROM ${F}`));await assert.rejects(read(),refused)
   await controlled(()=>owner.query(`GRANT EXECUTE ON FUNCTION profitia_access.append_audit(jsonb) TO ${F}`))
  })
  await t.test('revocation after admission and unavailable native audit roll back a new result',async()=>{
   const another=await(await admit(U,A,'discovery_'+randomUUID())).value.json(),pending={...selected,requestId:another.requestId}
   await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id='spendguru' AND organisation_id=$1 AND user_id=$2 AND operation='benchmark.discovery.request'",[A,U]))
   await assert.rejects(work.save(pending,{items:[]}),refused)
   await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE application_id='spendguru' AND organisation_id=$1 AND user_id=$2 AND operation='benchmark.discovery.request'",[A,U]))
   await controlled(()=>owner.query(`REVOKE EXECUTE ON FUNCTION profitia_jobs.append_audit(jsonb) FROM ${W}`));await assert.rejects(work.save(pending,{items:[]}),refused)
   await controlled(()=>owner.query(`GRANT EXECUTE ON FUNCTION profitia_jobs.append_audit(jsonb) TO ${W}`))
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_benchmark_discovery.results WHERE request_id=$1',[pending.requestId])).rows[0].n,0)
  })
  await t.test('physical FORCE-RLS or TRUNCATE drift blocks both read and native work',async()=>{
   await controlled(()=>owner.query('ALTER TABLE profitia_benchmark_discovery.results NO FORCE ROW LEVEL SECURITY'));await assert.rejects(read(),refused);await assert.rejects(work.read(selected),refused)
   await controlled(()=>owner.query('ALTER TABLE profitia_benchmark_discovery.results FORCE ROW LEVEL SECURITY'))
   await controlled(()=>owner.query(`GRANT TRUNCATE ON profitia_benchmark_discovery.results TO ${F}`));await assert.rejects(read(),refused)
   await controlled(()=>owner.query(`REVOKE TRUNCATE ON profitia_benchmark_discovery.results FROM ${F}`));assert.deepEqual(await(await read()).value.json(),{items:[]})
  })
 }finally{
  await Promise.all(clients.map(p=>p.$disconnect()));if(owner)await owner.end()
  if(created)await root.query(`DROP DATABASE ${DATABASE} WITH(FORCE)`);await root.end()
 }
})

test('the original metadata ORM reads only approved shared views through its actual ordinary one-connection role',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const db='sg2_metadata_'+randomUUID().replaceAll('-',''),url=new URL(rootUrl);url.pathname='/'+db
 const role='sg2_metadata_read_fixture',ownerRole='profitia_market_read_owner'
 const sql=fs.readFileSync(new URL('../prisma-market-data/private-read/003-metadata-discovery.sql',import.meta.url),'utf8')
 let owner,prisma,created=false
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[db])).rowCount,0);await root.query(`CREATE DATABASE ${db}`);created=true
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const[name,login]of[[ownerRole,false],[role,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[name])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query(`ALTER ROLE ${role} CONNECTION LIMIT 1`);await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${db} TO ${ownerRole};
   CREATE TABLE public.benchmark_metadata_facets("providerCode" text,"key" text,"label" text,"description" text,"searchable" boolean,"featured" boolean,"category" text,"controlType" text,"allowMultipleValues" boolean,"providerKey" text,"active" boolean);
   CREATE TABLE public.benchmark_metadata_values("providerCode" text,"facetKey" text,"providerValueId" text,"label" text,"normalizedLabel" text,"active" boolean);
   INSERT INTO public.benchmark_metadata_facets VALUES('MACROBOND','Region','Region',NULL,true,true,'business','multi-select',true,'Region',true),('OTHER','Region','Not shared by this source',NULL,true,true,'business','single-select',false,'Region',true);
   INSERT INTO public.benchmark_metadata_values VALUES('MACROBOND','Region','PL','Poland','poland',true),('MACROBOND','Region','DE','Germany','germany',true),('OTHER','Region','PRIVATE','Never expose','never expose',true),('MACROBOND','Region','RETIRED','Retired','retired',false);
   ALTER TABLE public.benchmark_metadata_facets ADD COLUMN "id" text NOT NULL DEFAULT gen_random_uuid()::text;
   ALTER TABLE public.benchmark_metadata_values ADD COLUMN "id" text NOT NULL DEFAULT gen_random_uuid()::text;
   GRANT USAGE ON SCHEMA public TO ${ownerRole};GRANT SELECT ON public.benchmark_metadata_facets,public.benchmark_metadata_values TO ${ownerRole}`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE '+ownerRole);try{const v=await action();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   await owner.query(sql);await owner.query("INSERT INTO profitia_metadata_read.installation VALUES(true,'1.0.0',$1,'isolated-metadata-project','isolated-metadata-branch',$2,$3,$4,$5)",[hash(sql),db,role,'a'.repeat(40),future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_metadata_read TO ${role};GRANT SELECT ON ALL TABLES IN SCHEMA profitia_metadata_read TO ${role}`)
  })
  const {PrismaClient:MarketClient}=await import('../generated/market-data-client/index.js')
  const runtimeUrl=new URL(url);runtimeUrl.username=role;runtimeUrl.password='isolated_ci_only';runtimeUrl.searchParams.set('schema','profitia_metadata_read');runtimeUrl.searchParams.set('connection_limit','1')
  prisma=new MarketClient({datasources:{db:{url:runtimeUrl.toString()}}})
  const binding={projectId:'isolated-metadata-project',branchId:'isolated-metadata-branch',databaseName:db,role,schemaDigest:hash(sql)}
  const load=createDiscoveryMetadataLoader(prisma,binding)
  const noNetwork=async()=>assert.fail('Stored metadata must not invoke a provider')
  await t.test('unchanged real business ORM returns shared facets, sorting and filtered counts',async()=>{
   await runWithBenchmarkProviderScope({macrobond:noNetwork,openai:noNetwork,loadMetadataClient:load},async()=>{
    const definitions=await getStoredBenchmarkMetadataDefinitions();assert.equal(definitions.length,1);assert.equal(definitions[0].key,'Region')
    const values=await getStoredBenchmarkMetadataValues('Region',[],{query:'pol',limit:20});assert.deepEqual(values,{items:[{value:'PL',label:'Poland'}],totalCount:2,filteredCount:1,query:'pol',limited:false})
   })
   await assert.rejects(prisma.$queryRawUnsafe('SELECT * FROM public.benchmark_metadata_values'))
  })
  await t.test('a substituted receipt binding, raw-table grant or writable view permission is refused',async()=>{
   await assert.rejects(createDiscoveryMetadataLoader(prisma,{...binding,branchId:'another-branch'})(),refused)
   await owner.query(`GRANT SELECT ON public.benchmark_metadata_values TO ${role}`);await assert.rejects(load(),refused);await owner.query(`REVOKE SELECT ON public.benchmark_metadata_values FROM ${role}`)
   await controlled(()=>owner.query(`GRANT INSERT ON profitia_metadata_read.benchmark_metadata_values TO ${role}`));await assert.rejects(load(),refused)
   await controlled(()=>owner.query(`REVOKE INSERT ON profitia_metadata_read.benchmark_metadata_values FROM ${role}`))
  })
  await t.test('expired receipt withholds shared rows in SQL as well as the loader',async()=>{
   await controlled(()=>owner.query("UPDATE profitia_metadata_read.installation SET expires_at=now()-interval '1 second'"))
   await assert.rejects(load(),refused)
   assert.equal((await prisma.$queryRawUnsafe('SELECT count(*)::int n FROM profitia_metadata_read.benchmark_metadata_values'))[0].n,0)
  })
 }finally{
  if(prisma)await prisma.$disconnect();if(owner)await owner.end();if(created)await root.query(`DROP DATABASE ${db} WITH(FORCE)`);await root.end()
 }
})
