import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {installationPlan} from '../scripts/install-pilot.mjs'
import {createPlatformIngestionHost,platformReceiptEvidence} from '@profitia/platform-contracts/platform-ingestion'
import {createPrivateOperationHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
import {accessSchemaUrl,moduleAuditSchemaUrl} from '@profitia/platform-contracts/access-store'
import {moduleSchemaUrl} from '@profitia/platform-contracts/module-scope'
import {createNativeRegistryAccess,createNativeCatalogPublication,createOfficialSeed} from '../dist/native.js'
import {createKrsClient,krsResponseEvidence,buildRequest} from '../dist/client.js'
import {normalizeExtract} from '../dist/normalizer.js'
import {storeSnapshot} from '../dist/catalog.js'
import {extract,bytes,fixtureSource} from './fixtures.mjs'

// Called only from the guarded disposable loopback PostgreSQL suite. Real Root,
// SQL role/access/audit are used; Clerk assertions and company bytes are synthetic.
export async function nativeReadTests(t,{owner,reader,catalog,url,Pool}){
 const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 const issuer='https://identity.fixture.test',role='krs_human_test',id='0000099999',expiry=()=>new Date(Date.now()+3600000).toISOString()
 const hash=v=>createHash('sha256').update(v).digest('hex')
 const source=await fs.readFile(new URL(accessSchemaUrl),'utf8'),mod=await fs.readFile(new URL(moduleSchemaUrl),'utf8'),audit=await fs.readFile(new URL(moduleAuditSchemaUrl),'utf8')
 let pool,auditPool,revoked=false
 try{
  await owner.query(`CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT; CREATE ROLE ${role} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT; GRANT CREATE ON DATABASE krs_registry_test TO profitia_access_owner`)
  await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
  await owner.query(source)
  await owner.query("INSERT INTO profitia_access.installation VALUES(true,'1.0.0',$1,'development','isolated-project','isolated-branch','krs_registry_test')",[hash(source)])
  await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE');INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES('krs_human_test','srm','ACTIVE')")
  await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
  await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'fixture-user',$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),issuer,U,expiry()])
  for(const org of [A,B]){
   await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
   await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,U,expiry()])
   await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[org,expiry()])
   await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),org,U])
  }
  await owner.query(mod)
  await owner.query("INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",[hash(mod)])
  await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),expiry()])
  await owner.query(audit)
  await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[hash(audit)])
  await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules TO ${role}; GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor() TO ${role}`)
  await owner.query('COMMIT')
  const u=new URL(url);u.username=role
  pool=new Pool({connectionString:u.href,max:3});auditPool=new Pool({connectionString:u.href,max:1})
  assert.equal((await pool.query('SELECT current_user')).rows[0].current_user,role)
  const clerk={async authenticateRequest(request){const ok=request.headers.get('authorization')==='Bearer fixture-user';return{status:ok?'signed-in':'signed-out',isAuthenticated:ok,toAuth:()=>({isAuthenticated:ok,tokenType:'session_token',userId:'fixture-user',sessionId:'fixture-session',actor:null,sessionClaims:{iss:issuer,sub:'fixture-user',sid:'fixture-session',azp:'http://localhost:3501',exp:Math.floor(Date.now()/1000)+3600}})}},sessions:{async getSession(){return{id:'fixture-session',userId:'fixture-user',status:revoked?'revoked':'active',expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000,actor:null}}},users:{async getUser(){return{id:'fixture-user',banned:false,locked:false,deprovisioned:false}}}}
  const host={application:{appId:'srm',profileId:'PORR_SUITE',environment:'development',deploymentId:'isolated-krs',configurationVersion:'1',identityIssuer:issuer,organisationId:A,features:['supplier_report'],operations:['supplier.report.read']},binding:{applicationId:'srm',environment:'development',projectId:'isolated-project',branchId:'isolated-branch',databaseName:'krs_registry_test',role,schemaDigest:hash(source)},module:{id:'supplier_report',schemaDigest:hash(mod),auditSchemaDigest:hash(audit)},createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:clerk,application:{appId:'srm',environment:'development',issuer,authorizedParties:['http://localhost:3501']},resolveBinding}),independentQuery:async(sql,args)=>({rows:(await auditPool.query(sql,args)).rows}),transact:async(work)=>{const c=await pool.connect();try{await c.query('BEGIN');const value=await work({transaction:c,query:async(sql,args)=>({rows:(await c.query(sql,args)).rows})});await c.query('COMMIT');return value}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}}
  const access=createNativeRegistryAccess({host,catalog,organisationId:A}),request=()=>new Request('http://localhost:3501/',{headers:{authorization:'Bearer fixture-user'}})
  const snapshot=await normalizeExtract(bytes(extract({id,name:'Native Synthetic SA'})),{krs:id,register:'P',extract:'CURRENT',retrievedAt:new Date().toISOString()})
  await owner.query('BEGIN');await storeSnapshot(owner,snapshot,'synthetic-native');await owner.query('COMMIT')
  await t.test('native Root read with actual ordinary PostgreSQL role and paired audit',async()=>{
   assert.equal((await access.search(request(),'Native Synthetic')).candidates[0].krs,id)
   assert.equal((await access.selected(request(),id)).identity.identity.nip,snapshot.nip)
   const events=(await owner.query('SELECT phase FROM profitia_access.security_events ORDER BY event_id')).rows.map(x=>x.phase)
   assert.deepEqual(events,['INTENT','OUTCOME','INTENT','OUTCOME'])
  })
  await t.test('anonymous, revoked session and forged selection deny without upstream or private output',async()=>{
   await assert.rejects(access.search(new Request('http://localhost:3501/'),'Native'))
   revoked=true;await assert.rejects(access.selected(request(),id));revoked=false
   await assert.rejects(access.selected(request(),id,'KRS:'+id+':'+'f'.repeat(64)))
   await assert.rejects(access.search(request(),'x'))
  })
  await t.test('current membership revocation denies an already selected snapshot',async()=>{
   await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1",[A])
   await assert.rejects(access.accepted(request(),snapshot.evidenceRef))
   await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1",[A])
  })
  await t.test('OUTCOME outage releases no accepted result',async()=>{
   await owner.query("CREATE FUNCTION profitia_access.fail_native_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'fixture outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_native_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.fail_native_outcome()")
   try{await assert.rejects(access.selected(request(),id))}finally{await owner.query('DROP TRIGGER fail_native_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.fail_native_outcome()')}
  })
  await t.test('JSON receipts and an offline Source cannot mint native publication authority',async()=>{
   const client=createKrsClient({externalEnabled:true,source:fixtureSource(async({command})=>({status:200,url:buildRequest(command).url,bytes:bytes(extract({id})),headers:{}}))})
   const response=await client.get({operation:'CURRENT',krs:id,register:'P'},'synthetic-source-key')
   assert.equal(krsResponseEvidence(response),null);assert.equal(krsResponseEvidence({...response}),null)
   assert.throws(()=>createOfficialSeed({client,publication:{publish(){assert.fail()}},approvedKrs:[id,id],approvalRef:'fixture'}))
  })
 }finally{
  await pool?.end();await auditPool?.end()
  await owner.query('ROLLBACK');await owner.query('DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE;DROP OWNED BY krs_human_test,profitia_access_owner;DROP ROLE krs_human_test,profitia_access_owner')
 }
}


export async function nativePublicationTests(t,{owner,ingest,url,Pool}){
 const deploymentId='synthetic-controlled-installer',sourceSha='a'.repeat(40)
 const plan=installationPlan({ownerLogin:'krs_test_owner',database:'krs_registry_test',project:'isolated-project',branch:'isolated-branch',deploymentId,sourceSha,approvalRef:'SYNTHETIC_ONLY'})
 const u=new URL(url);u.username='krs_ingest';u.password='isolated_ci_only'
 let auditPool
 try{
  await owner.query('CREATE ROLE krs_catalog_owner NOLOGIN NOINHERIT;CREATE ROLE profitia_ingestion_owner NOLOGIN NOINHERIT;ALTER DATABASE krs_registry_test OWNER TO krs_catalog_owner')
  await t.test('exact empty pilot installation rolls back all Source/catalog DDL atomically',async()=>{
   await owner.query('BEGIN')
   try{for(const sql of plan.statements)await owner.query(sql)}finally{await owner.query('ROLLBACK')}
   assert.equal((await owner.query("SELECT to_regnamespace('krs_registry') AS v")).rows[0].v,null)
   assert.equal((await owner.query("SELECT to_regnamespace('profitia_ingestion') AS v")).rows[0].v,null)
  })
  await owner.query('BEGIN');try{for(const sql of plan.statements)await owner.query(sql);await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
  auditPool=new Pool({connectionString:u.href,max:1})
  const driver={independentQuery:async(sql,args)=>({rows:(await auditPool.query(sql,args)).rows}),transact:async work=>{const c=await ingest.connect();try{await c.query('BEGIN');const result=await work({transaction:c,query:async(sql,args)=>({rows:(await c.query(sql,args)).rows})});await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}}
  const host=createPlatformIngestionHost({...driver,application:{appId:'krs-registry-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId,configurationVersion:'krs-native-pilot-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},binding:{applicationId:'krs-registry-source',environment:'development',projectId:'isolated-project',branchId:'isolated-branch',databaseName:'krs_registry_test',role:'krs_ingest',deploymentId,configurationVersion:'krs-native-pilot-v1',schemaDigest:plan.schemaDigests.ingestion},source:{id:'krs.registry.catalog',payloadSchema:'profitia.krs-report-projection/1.0.0',qualityVersion:'krs-normalizer/1.0.1',classificationVersion:'krs-public-company-v1'},validateSharedPayload:()=>true})
  const id='0000028860',snap=await normalizeExtract(bytes(extract({id})),{krs:id,register:'P',extract:'CURRENT',retrievedAt:new Date().toISOString()})
  const input={resourceId:'krs-catalog:'+id,payload:{fixture:'synthetic classified manifest'},idempotencyKey:'synthetic-native-source-publication-001'}
  await t.test('direct ordinary writes cannot substitute for native Source publication',async()=>{
   await assert.rejects(ingest.query("INSERT INTO krs_registry.companies(krs,entity_key,state) VALUES($1,$2,'UNKNOWN')",[id,'PL:KRS:'+id]),e=>e.code==='42501')
  })
  let writes=0
  const publish=()=>host.ingest(input,async(_payload,tx,context)=>{writes++;await storeSnapshot(tx,snap,context.platformReservation.effectId)})
  await t.test('actual Source reservation, snapshot, OUTCOME and receipt share one commit; replay writes once',async()=>{
   const result=await publish();assert.ok(platformReceiptEvidence(result.value));assert.equal(writes,1)
   assert.equal((await owner.query('SELECT effect_ref FROM krs_registry.snapshots')).rows[0].effect_ref,platformReceiptEvidence(result.value).effectId)
   const replay=await publish();assert.ok(platformReceiptEvidence(replay.value));assert.equal(writes,1)
  })
  await t.test('Source OUTCOME outage rolls back domain write and admission with no receipt',async()=>{
   await owner.query("CREATE FUNCTION profitia_ingestion.fail_catalog_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'fixture outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_catalog_outcome BEFORE INSERT ON profitia_ingestion.security_events FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.fail_catalog_outcome()")
   try{await assert.rejects(host.ingest({...input,idempotencyKey:'synthetic-native-source-publication-002'},async(_p,tx,c)=>{await tx.query('UPDATE krs_registry.metadata SET generation=999');assert.ok(c.platformReservation.effectId)}))}finally{await owner.query('DROP TRIGGER fail_catalog_outcome ON profitia_ingestion.security_events;DROP FUNCTION profitia_ingestion.fail_catalog_outcome()')}
   assert.notEqual((await owner.query('SELECT generation FROM krs_registry.metadata')).rows[0].generation,'999')
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_ingestion.effects')).rows[0].n,1)
  })
 }finally{
  await auditPool?.end();await owner.query('ALTER DATABASE krs_registry_test OWNER TO krs_test_owner;DROP SCHEMA IF EXISTS krs_registry CASCADE;DROP SCHEMA IF EXISTS profitia_external_native CASCADE;DROP SCHEMA IF EXISTS profitia_external_call CASCADE;DROP SCHEMA IF EXISTS profitia_ingestion CASCADE;DROP OWNED BY krs_catalog_owner,profitia_ingestion_owner;DROP ROLE krs_catalog_owner,profitia_ingestion_owner')
 }
}
