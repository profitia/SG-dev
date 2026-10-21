import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import test from 'node:test'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPrivateOperationHost,createDelegatedNativeWorkHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {createDelegatedJobStore} from '../../../packages/platform-contracts/src/delegated-job.mjs'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
import {requestOperationPolicy} from '../../../packages/platform-contracts/src/request-operations.mjs'
import {createClerkAccountStatusReader} from '../../../packages/platform-contracts/src/identity-provider.mjs'
const {Client}=createRequire(import.meta.url)('pg')
const hash=v=>createHash('sha256').update(v).digest('hex'),source=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const F='location_foreground_fixture',W='location_work_fixture',A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),serviceId=randomUUID()
const DATABASE='supplier_locations_'+randomUUID().replaceAll('-',''),future=()=>new Date(Date.now()+3600000).toISOString(),ISSUER='https://identity.fixture.test'
const files=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql','010-external-request-admission.sql','011-request-continuation.sql','013-supplier-delegation.sql','014-delegated-private-phases.sql','015-delegated-private-inspection.sql','016-delegated-native-work.sql','017-additional-request-operations.sql']
const tables=['profitia_access.installation','profitia_modules.installation','profitia_modules.audit_installation','profitia_services.installation','profitia_requests.installation','profitia_jobs.installation','profitia_requests.external_installation','profitia_request_phases.installation','profitia_supplier_jobs.installation','profitia_delegated_phases.installation','profitia_request_inspection.installation','profitia_request_work.installation','profitia_requests.operation_installation']
const extension=source('019-supplier-location-operations.sql'),extensionHash=hash(extension),baseHash=hash(source(files[0]))

test('supplier locations use actual ordinary-role admission, organisation sharing and delegated SQL',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new Client({connectionString:rootUrl});await root.connect();const url=new URL(rootUrl);url.pathname='/'+DATABASE
 let owner,audit,workerAudit
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0)
  await root.query(`CREATE DATABASE ${DATABASE}`)
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const[role,login]of[['profitia_access_owner',false],[F,true],[W,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:url.toString()});await owner.connect();await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const r=await action();await owner.query('COMMIT');return r}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled(async()=>{
   for(let i=0;i<files.length;i++){
    const sql=source(files[i]);await owner.query(sql)
    if(i===0)await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-additional-project','isolated-additional-branch',$2)",[hash(sql),DATABASE])
    else if(i===1)await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(sql)])
    else await owner.query(`INSERT INTO ${tables[i]} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY_NOT_RELEASE')`,[hash(sql)])
   }
  })
  const oldReceipts=await owner.query('SELECT schema_digest FROM profitia_requests.external_installation UNION ALL SELECT schema_digest FROM profitia_supplier_jobs.installation UNION ALL SELECT schema_digest FROM profitia_request_work.installation')
  await t.test('wrong installer and interrupted migration preserve old constraints and receipts',async()=>{
   await assert.rejects(owner.query(extension),e=>e.code==='42501')
   await assert.rejects(controlled(async()=>{await owner.query(extension);throw Error('Synthetic installation interruption')}))
   assert.equal((await owner.query("SELECT to_regclass('profitia_requests.location_installation') AS value")).rows[0].value,null)
   assert.deepEqual((await owner.query('SELECT schema_digest FROM profitia_requests.external_installation UNION ALL SELECT schema_digest FROM profitia_supplier_jobs.installation UNION ALL SELECT schema_digest FROM profitia_request_work.installation')).rows,oldReceipts.rows)
  })
  await controlled(async()=>{await owner.query(extension);await owner.query("INSERT INTO profitia_requests.location_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_EXTENSION_NOT_RELEASE')",[extensionHash])})
  await t.test('installation is immutable, forced RLS and introduces no business grant or activation',async()=>{
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.applications')).rows[0].n,0)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.permission_grants')).rows[0].n,0)
   assert.deepEqual((await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='profitia_requests.location_installation'::regclass")).rows[0],{relrowsecurity:true,relforcerowsecurity:true})
   await assert.rejects(controlled(()=>owner.query("UPDATE profitia_requests.location_installation SET source_ref='forged'")),e=>e.code==='42501')
  })
  await controlled(async()=>{
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('consumer','ACTIVE'),('worker','ACTIVE')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'consumer','ACTIVE'),($2,'worker','ACTIVE')",[F,W])
   for(const user of[U,V]){
    await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
    await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,future()])
   }
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    for(const user of[U,V])await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,future()])
    for(const product of['SPENDGURU','SUPPLIER_INTELLIGENCE'])await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('consumer',$1,$2,ARRAY['benchmark','supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)",[org,product,future()])
   }
   for(const module of['benchmark','supplier_report'])await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('consumer',$1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[module,randomUUID(),future()])
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-worker','worker-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[W,randomUUID(),serviceId,future()])
   await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('consumer','SAVE_RESULT','WRITE','ACTIVE','SYNTHETIC_ONLY',$1)",[future()])
   await owner.query(`CREATE SCHEMA acquisition_fixture;CREATE TABLE acquisition_fixture.results(request_id uuid PRIMARY KEY REFERENCES profitia_requests.intents(request_id),organisation_id uuid NOT NULL,user_id uuid NOT NULL,body text NOT NULL);ALTER TABLE acquisition_fixture.results ENABLE ROW LEVEL SECURITY;ALTER TABLE acquisition_fixture.results FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON acquisition_fixture.results TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY runtime_write ON acquisition_fixture.results TO ${W} WITH CHECK(profitia_request_work.scope_allows(request_id,'SAVE_RESULT',organisation_id,user_id,'WRITE'));
    CREATE POLICY runtime_read ON acquisition_fixture.results TO ${F} USING(profitia_access.scope_allows('consumer',organisation_id,user_id) AND profitia_modules.scope_allows('benchmark',organisation_id,user_id));
    GRANT USAGE ON SCHEMA acquisition_fixture TO ${F},${W};GRANT INSERT ON acquisition_fixture.results TO ${W};GRANT SELECT ON acquisition_fixture.results TO ${F};
    GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs TO ${F};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules,profitia_requests TO ${F};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${F};
    GRANT USAGE ON SCHEMA profitia_access,profitia_services,profitia_requests,profitia_jobs,profitia_request_work TO ${W};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_requests.operation_runtime_descriptor(),profitia_requests.location_runtime_descriptor(),profitia_requests.location_evidence_current(jsonb,text,uuid,uuid),profitia_requests.location_permission(text,uuid,uuid,text,text),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text) TO ${W}`)
  })
  const ordinaryUrl=role=>{const u=new URL(url);u.username=role;u.password='isolated_ci_only';return u.toString()}
  const connect=async role=>{const c=new Client({connectionString:ordinaryUrl(role)});await c.connect();return c}
  audit=await connect(F);workerAudit=await connect(W)
  const transact=role=>async(work,limits)=>{const c=await connect(role);const timer=setTimeout(()=>{void c.end().catch(()=>{})},limits.timeoutMs);try{await c.query('BEGIN');const r=await work({query:c.query.bind(c),transaction:c});await c.query('COMMIT');return r}catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{clearTimeout(timer);await c.end()}}
  const binding=role=>({applicationId:role===F?'consumer':'worker',environment:'development',projectId:'isolated-additional-project',branchId:'isolated-additional-branch',databaseName:DATABASE,role,schemaDigest:baseHash})
  let providerActive=true
  const readExternalAccount=createClerkAccountStatusReader({environment:'development',issuer:ISSUER,client:{users:{getUser:async subject=>({id:subject,banned:!providerActive,locked:false,deprovisioned:false})}}})
  const supplier=randomUUID(),location=randomUUID()
  const authenticate=({resolveBinding})=>async request=>{const b=await resolveBinding({environment:'development',issuer:ISSUER,subject:'external-'+request.user});return b?{kind:'HUMAN',actorId:b.userId,userId:b.userId,proofRef:'SYNTHETIC_VERIFIED_BOUNDARY',issuer:ISSUER,audience:'consumer',environment:'development',expiresAt:b.expiresAt}:null}
  const app=operation=>({appId:'consumer',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic-foreground',configurationVersion:'request-v1',identityIssuer:ISSUER,organisationId:null,operations:[operation,'supplier.report.read','supplier.private.read'],features:['supplier_report']})
  const module={id:'supplier_report',schemaDigest:hash(source('002-module-scope.sql')),auditSchemaDigest:hash(source('003-module-audit.sql'))}
  const requestLedger={schemaDigest:hash(source('006-request-reservation.sql')),externalSchemaDigest:hash(source('010-external-request-admission.sql')),operationSchemaDigest:hash(source('017-additional-request-operations.sql')),locationSchemaDigest:extensionHash}
  const grant=async(operation,user=U,resource=null)=>controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,'consumer',$2,$3,'ALLOW',$4,'supplier_report',$5)",[randomUUID(),A,user,operation,resource]))
  await grant('supplier.report.read');await grant('supplier.location.read');await grant('supplier.location.read',V);await grant('supplier.location.write')
  await controlled(async()=>{
   await owner.query(`CREATE SCHEMA location_domain_fixture;CREATE TABLE location_domain_fixture.suppliers(organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,PRIMARY KEY(organisation_id,supplier_id));
    CREATE TABLE location_domain_fixture.locations(organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,location_id uuid NOT NULL,created_by uuid NOT NULL,version integer NOT NULL,label text NOT NULL,PRIMARY KEY(organisation_id,supplier_id,location_id),FOREIGN KEY(organisation_id,supplier_id) REFERENCES location_domain_fixture.suppliers);
    ALTER TABLE location_domain_fixture.locations ENABLE ROW LEVEL SECURITY;ALTER TABLE location_domain_fixture.locations FORCE ROW LEVEL SECURITY;
    CREATE POLICY owner ON location_domain_fixture.locations TO profitia_access_owner USING(true) WITH CHECK(true);
    CREATE POLICY org_read ON location_domain_fixture.locations FOR SELECT TO ${F} USING(profitia_requests.location_access('supplier.location.read',organisation_id,nullif(current_setting('profitia.user_id',true),'')::uuid,location_id::text));
    CREATE POLICY manual_write ON location_domain_fixture.locations FOR INSERT TO ${F} WITH CHECK(profitia_requests.location_access('supplier.location.write',organisation_id,nullif(current_setting('profitia.user_id',true),'')::uuid,location_id::text) AND profitia_requests.location_bound_current('supplier.location.write',organisation_id,nullif(current_setting('profitia.user_id',true),'')::uuid,location_id::text) AND current_setting('profitia.location.scope',true)::jsonb->>'supplierId'=supplier_id::text AND created_by=nullif(current_setting('profitia.user_id',true),'')::uuid);
    GRANT USAGE ON SCHEMA location_domain_fixture TO ${F};GRANT SELECT ON location_domain_fixture.locations TO ${F};GRANT INSERT ON location_domain_fixture.locations TO ${F};
    INSERT INTO location_domain_fixture.suppliers VALUES('${A}','${supplier}'),('${B}','${supplier}');`)
  })
  const manualPayload={action:'CREATE',supplierId:supplier,locationId:location,addressVersion:'1',expectedVersion:null,command:{label:'SYNTHETIC PRIVATE MANUAL SITE'}}
  const evidence=(payload,{origin='MANUAL',group='USER_LOCATIONS',sources=[],exists=false,version='0',executorApplicationId=null}={})=>({supplierId:supplier,locationId:payload.locationId,group,origin,addressVersion:payload.addressVersion,targetVersion:version,exists,serverAssignedId:true,commandDigest:operationPayloadDigest(payload.command),executorApplicationId,sources})
  const manual=createPrivateOperationHost({application:app('supplier.location.write'),binding:binding(F),module,requestLedger,independentQuery:audit.query.bind(audit),transact:transact(F),createAuthenticator:authenticate,readResources:async({request})=>({resource:{id:location,type:'supplier_location',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:A,ownerUserId:null,version:'0',projectionVersion:'location-write-v1',supplierLocation:evidence(request.payload)}}),projectOutput:value=>value})
  const manualInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.location.write',organisationId:A,resourceId:location,idempotencyKey:'manual_location_'+randomUUID(),payload:manualPayload,request:{user:U}}
  let manualCalls=0
  const add=(patch={})=>manual.execute({...manualInput,...patch},async(context,c)=>{manualCalls++;await c.query('INSERT INTO location_domain_fixture.locations VALUES($1,$2,$3,$4,1,$5)',[A,supplier,location,context.actorId,context.payload.command.label]);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
  await t.test('missing policy is zero allowance, before manual SQL and before any provider effect',async()=>{await assert.rejects(add(),isOperationDenied);assert.equal(manualCalls,0)})
  await controlled(()=>owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'consumer',$2,'supplier.location.write','ACTIVE','SYNTHETIC_LOCAL_REQUEST_COUNT',now()-interval '1 hour',now()+interval '2 hours',$3,5)",[randomUUID(),A,future()]))
  await t.test('manual record and idempotent request commit once, with creator separate from organisation owner',async()=>{const r=await add();assert.equal(manualCalls,1);assert.equal((await add()).value.requestId,r.value.requestId);assert.equal(manualCalls,1);const row=(await owner.query('SELECT * FROM location_domain_fixture.locations')).rows[0];assert.equal(row.organisation_id,A);assert.equal(row.created_by,U);assert.equal((await audit.query('SELECT * FROM location_domain_fixture.locations')).rowCount,0)})
  const read=createPrivateOperationHost({application:app('supplier.location.read'),binding:binding(F),module,independentQuery:audit.query.bind(audit),transact:transact(F),createAuthenticator:authenticate,readResources:async()=>({resource:{id:'collection:'+supplier,type:'supplier_location_collection',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:A,ownerUserId:null,version:'1',projectionVersion:'location-read-v1',supplierLocation:{...evidence({locationId:null,addressVersion:null,command:null},{origin:'COLLECTION',group:'ALL',exists:true,version:'1'}),serverAssignedId:false}}}),projectOutput:value=>value})
  const readInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.location.read',organisationId:A,resourceId:'collection:'+supplier,payload:{action:'READ',supplierId:supplier,locationId:null,addressVersion:null,expectedVersion:null,command:null},request:{user:U}}
  const list=(patch={})=>read.execute({...readInput,...patch},async(_context,c)=>(await c.query('SELECT location_id,label,created_by FROM location_domain_fixture.locations')).rows)
  await t.test('two members share saved manual records, other organisation and revoked membership are denied',async()=>{assert.equal((await list()).value.length,1);assert.equal((await list({request:{user:V}})).value[0].created_by,U);await assert.rejects(list({organisationId:B}),isOperationDenied);await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,V]));await assert.rejects(list({request:{user:V}}),isOperationDenied)})
  await t.test('forged resource, changed idempotency payload and unaudited direct write cannot bypass actual RLS',async()=>{await assert.rejects(add({resourceId:randomUUID()}),isOperationDenied);await assert.rejects(add({payload:{...manualPayload,command:{label:'CHANGED'}}}),isOperationDenied);assert.equal(manualCalls,1);await assert.rejects(audit.query('INSERT INTO location_domain_fixture.locations VALUES($1,$2,$3,$4,1,$5)',[A,supplier,randomUUID(),U,'FORGED']),e=>e.code==='42501')})
  await t.test('ordinary SQL requires current private COMPANY source, organisation, grant and retention',async()=>{
   const snapshot=randomUUID(),retention=future(),grantId=randomUUID()
   const privateSource={kind:'KYS',accepted:true,entityType:'COMPANY',retentionUntil:retention,resource:{id:'private-report',type:'supplier_private_report',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:A,ownerUserId:null,version:snapshot,projectionVersion:'private-v1',privateSupplier:{nip:'1234567890',entityType:'COMPANY',snapshotId:snapshot,retentionUntil:retention}}}
   const selected=evidence(manualPayload,{origin:'SOURCE',group:'RELATED_ENTITIES',sources:[privateSource],exists:true,version:'1'})
   const current=async(org=A)=>(await audit.query('SELECT profitia_requests.location_evidence_current($1::jsonb,$2,$3::uuid,$4::uuid) AS allowed',[JSON.stringify(selected),'consumer',org,U])).rows[0].allowed
   assert.equal(await current(),false)
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW','supplier.private.read','supplier_report')",[grantId,A,U]))
   assert.equal(await current(),true);assert.equal(await current(B),false)
   privateSource.resource.privateSupplier.entityType='JDG';assert.equal(await current(),false);privateSource.resource.privateSupplier.entityType='COMPANY'
   privateSource.retentionUntil=privateSource.resource.privateSupplier.retentionUntil=new Date(Date.now()-1000).toISOString();assert.equal(await current(),false)
   privateSource.retentionUntil=privateSource.resource.privateSupplier.retentionUntil=retention
   await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grantId]));assert.equal(await current(),false)
  })
  for(const operation of['supplier.location.sync','supplier.location.geocode'])await t.test(operation,async st=>{
   const target=requestOperationPolicy(operation),isGeo=operation==='supplier.location.geocode',policyId=randomUUID(),bindingId=randomUUID(),permissionId=randomUUID()
   await controlled(async()=>{
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'consumer',$2,$3,'ACTIVE','SYNTHETIC_FINITE_REQUEST_POLICY',now()-interval '1 hour',now()+interval '2 hours',$4,10)",[policyId,A,operation,future()])
    await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'consumer',$2,$3,'SUPPLIER_INTELLIGENCE_STANDALONE','request-v1','worker','stored.technical-command','isolated-source-project','isolated-source-branch','isolated_source','source-app',$4,'technical-command-v1','quality-v1','technical-v1',300,3,'ACTIVE','SYNTHETIC_ONLY',$5)",[bindingId,operation,F,'a'.repeat(64),future()])
    await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),W,bindingId,A,future()])
   })
   const job={schemaDigest:hash(source('007-delegated-jobs.sql')),targetOperation:operation,supplierSchemaDigest:hash(source('013-supplier-delegation.sql')),operationSchemaDigest:hash(source('017-additional-request-operations.sql')),locationSchemaDigest:extensionHash}
   const store=createDelegatedJobStore({binding:binding(F),...job})
   const payload={action:isGeo?'GEOCODE':'SYNC',supplierId:supplier,locationId:isGeo?location:null,addressVersion:isGeo?'1':null,expectedVersion:'1',command:isGeo?{address:'SYNTHETIC ADDRESS',executorApplicationId:'worker'}:{sources:[{id:'report',version:'1'}]}}
   const sourceResource={id:'report',type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'1',projectionVersion:'source-v1',approvedSharedProjection:true}
   const loc=evidence(payload,{origin:isGeo?'MANUAL':'COLLECTION',group:isGeo?'USER_LOCATIONS':'ALL',sources:isGeo?[]:[{kind:'MGBI',accepted:true,entityType:'COMPANY',retentionUntil:future(),resource:sourceResource}],exists:true,version:'1',executorApplicationId:isGeo?'worker':null})
   const host=createPrivateOperationHost({application:app(operation),binding:binding(F),module,requestLedger,independentQuery:audit.query.bind(audit),transact:transact(F),createAuthenticator:authenticate,readResources:async()=>({resource:{id:'request:'+operation,type:target.resourceType,dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:A,ownerUserId:U,version:'1',projectionVersion:target.projectionVersion,supplierLocation:loc}}),projectOutput:value=>value})
   const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:A,resourceId:'request:'+operation,idempotencyKey:'fixture_location_'+randomUUID(),payload,request:{user:U}}
   let calls=0
   const admit=(patch={})=>host.execute({...input,...patch},async(context,c)=>{calls++;await store.createDispatch(c.query.bind(c),context);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
   await st.test('no inherited request permission',async()=>{await assert.rejects(admit(),isOperationDenied);assert.equal(calls,0)})
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW',$4,'supplier_report')",[permissionId,A,U,operation]))
   if(isGeo)await st.test('ordinary admission rejects a target executor different from the registered binding',async()=>{loc.executorApplicationId='wrong-worker';try{await assert.rejects(admit(),isOperationDenied);assert.equal(calls,0)}finally{loc.executorApplicationId='worker'}})
   const result=await admit(),requestId=result.value.requestId
   await st.test('one admitted request, immutable evidence and one delegation; replay has no duplicate',async()=>{assert.equal((await admit()).value.requestId,requestId);assert.equal(calls,1);const row=(await owner.query('SELECT location_scope FROM profitia_requests.intents WHERE request_id=$1',[requestId])).rows[0];assert.equal(row.location_scope.supplierId,supplier);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_jobs.delegations WHERE request_id=$1',[requestId])).rows[0].n,1)})
   const worker=createDelegatedNativeWorkHost({application:{appId:'worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-worker',configurationVersion:'worker-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding:{...binding(W),service:{schemaDigest:hash(source('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-v1'}},job,privateWork:{schemaDigest:hash(source('016-delegated-native-work.sql'))},independentQuery:workerAudit.query.bind(workerAudit),transact:transact(W),readExternalAccount})
   const workInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,resourceId:requestId,payload,request:null},unit={unitId:'SAVE_RESULT',accessMode:'WRITE',inputDigest:operationPayloadDigest({requestId})}
   let workCalls=0
   const work=(patch={})=>worker.runSqlWork({...workInput,...patch},unit,async(context,c)=>{workCalls++;assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.equal(context.delegation.target.operation,operation);await c.query('INSERT INTO acquisition_fixture.results VALUES($1,$2,$3,$4)',[requestId,A,U,'SYNTHETIC_LOCAL_SQL_NO_PROVIDER_CALL'])})
   await st.test('actual SERVICE retains initiating human and bounded SQL/audit, with no network or Google call',async()=>{assert.deepEqual((await work()).value,{requestId,status:'ACCEPTED'});assert.equal(workCalls,1);assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->'requestWork'->>'requestId'=$1",[requestId])).rows[0].n,1)})
   if(!isGeo)await st.test('accepted work cannot outlive revoked source read authority',async()=>{await controlled(()=>owner.query("DELETE FROM profitia_access.permission_grants WHERE operation='supplier.report.read'"));try{await assert.rejects(work(),isOperationDenied);assert.equal(workCalls,1)}finally{await grant('supplier.report.read')}})
   await st.test('wrong organisation, revoked source/operation and deactivated external account refuse callbacks',async()=>{await assert.rejects(work({organisationId:B}),isOperationDenied);await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[permissionId]));await assert.rejects(work(),isOperationDenied);await assert.rejects(admit(),isOperationDenied);assert.equal(workCalls,1);await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'consumer',$2,$3,'ALLOW',$4,'supplier_report')",[permissionId,A,U,operation]));providerActive=false;try{await assert.rejects(work(),isOperationDenied)}finally{providerActive=true}})
  })
 }finally{
  for(const c of[audit,workerAudit,owner])if(c)await c.end()
  await root.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[DATABASE])
  await root.query(`DROP DATABASE IF EXISTS ${DATABASE}`);await root.end()
 }
})
