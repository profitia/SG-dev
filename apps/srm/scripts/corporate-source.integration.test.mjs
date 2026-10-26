import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSrmCorporateSourceStore, unrequestedCorporateGeneral, CORPORATE_SOURCE, CORPORATE_PUBLICATION_VERSION } from '../src/server/corporate-source-store.ts'
import { mapMgbiFinancialRecords } from '../src/server/mgbi-financial.ts'
import { createPlatformIngestionHost } from '@profitia/platform-contracts/platform-ingestion'
import { createSrmNativePgDriver } from '../src/server/native-pg-driver.ts'
import { writeSharedCompany } from '../src/server/shared-catalog.ts'
const hash = value => createHash('sha256').update(value).digest('hex')
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const common = name => read('../../../packages/platform-contracts/migrations/access/' + name)
const sourceSql = common('008-platform-ingestion.sql'), sourceDigest = hash(sourceSql)
const publicationSql = read('../db/private-store/004-corporate-source.sql'), bridgeSql = read('../db/private-store/005-corporate-source-access.sql')
const financialPublicationSql=read('../db/private-store/018-financial-only-publication.sql')
const scopeProjectionSql=read('../db/private-store/019-corporate-scope-projection.sql')
const shapeText = read('../src/server/corporate-source-shape.json'), shape = JSON.parse(shapeText), publicationDigest = hash(publicationSql + bridgeSql + shapeText)
const DATABASE = 'srm_corporate_' + randomUUID().replaceAll('-', ''), ROLE = 'srm_corporate_source_fixture'
const NIP = '5272443955', KRS = '0000217580'
const key=label=>hash('corporate-fixture-v1:'+label)
const packet = () => {
 const mapped = mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},
  document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},
  content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}],{type:'NIP',value:NIP},'2026-10-19T00:00:00.000Z')
 return {version:CORPORATE_PUBLICATION_VERSION,nip:NIP,preserveGeneral:false,
  general:{status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-wp-record',recordId:'a'.repeat(24)},
   data:{nip:NIP,krs:KRS,legalName:'Synthetic Company',legalForm:'SA',regon:null,registeredAddress:null,registeredAt:null,mainPkd:null},
   retrievedAt:'2026-10-19T00:00:00.000Z',effectiveAt:null,warnings:[]},
  financial:{...mapped.section,source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:'b'.repeat(24)}},facts:mapped.facts}
}

test('corporate source candidate pins its exact native sources without claiming provider acquisition or live activation',()=>{
 const manifest=JSON.parse(read('../operation-integration.json')),current=manifest.corporateSourcePublicationAdoption
 assert.equal(current.version,CORPORATE_PUBLICATION_VERSION)
 assert.equal(current.taskId,'SRM-E1-CORPORATE-SOURCE-PUBLICATION-20261019')
 assert.equal(Object.keys(current.sourceDigests).length,5)
 assert.equal(current.sourceRecordIsHistorical,true)
 const adoption=manifest.fullNativeCompanyCompositionAdoption
 assert.equal(adoption.taskId,'SRM-E1-FULL-NATIVE-COMPANY-20261019')
 assert.equal(manifest.nativeSupplierBusinessWorkAdoption.previousCorporateSourceReceiptPreserved,true)
 assert.equal(adoption.corporateClassification.version,CORPORATE_SOURCE.classificationVersion)
 for(const[path,digest]of Object.entries(current.sourceDigests)){
  const expected=Object.hasOwn(adoption.sourceDigests,path)?adoption.sourceDigests[path]:digest
  assert.equal(hash(execFileSync('git',['show',manifest.boundedIndicatorReadAdoption.previousReceiptSourceSha+':apps/srm/'+path])),expected,'historical '+path)
  assert.equal(hash(read('../'+path)),manifest.diagnosticTelemetryAdoption.applicationSourceDigests[path]??manifest.financialPerformanceAdoption?.applicationSourceDigests[path]??manifest.krsGusFirstPublicationCompatibility.applicationSourceDigests[path]??manifest.krsFinancialTelemetryCompatibility.applicationSourceDigests[path]??manifest.boundedIndicatorReadAdoption.applicationSourceDigests[path]??expected,path)
 }
 for(const name of ['singleExistingCatalogWriter','singleExistingIndicatorCalculator','storedSourceOnly','sameTransactionOutcomeWitness','noTenantOwnerInNewSharedFacts','humanWriteCeilingRetained'])assert.equal(current[name],true,name)
 for(const name of ['providerAcquisitionProvedByThisUnit','fullNativeWorkflowAdopted','liveSqlInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[name],false,name)
})

test('corporate SOURCE uses ordinary native pg, one original writer/calculator and immutable global evidence',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect()
 let owner,pool,auditPool
 const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+DATABASE
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0)
  await root.query(`CREATE DATABASE ${DATABASE}`)
  for(const [role,login] of [['profitia_access_owner',false],['profitia_ingestion_owner',false],['srm_app_runtime',true],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }
  await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
  owner=new pg.Client({connectionString:dbUrl.toString()});await owner.connect()
  await owner.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE};GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner,profitia_ingestion_owner`)
  const controlled=async(role,work)=>{await owner.query('BEGIN;SET LOCAL ROLE '+role);try{const value=await work();await owner.query('COMMIT');return value}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled('profitia_access_owner',async()=>{
   await owner.query(common('001-internal-access.sql'))
   await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','synthetic-corporate-project','synthetic-corporate-branch',$2)",[hash(common('001-internal-access.sql')),DATABASE])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ACTIVE');INSERT INTO profitia_access.organisations(organisation_id,status) VALUES('11111111-1111-4111-8111-111111111111','ACTIVE');INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')")
   await owner.query(common('002-module-scope.sql'))
   await owner.query("INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",[hash(common('002-module-scope.sql'))])
   await owner.query(common('003-module-audit.sql'))
   await owner.query("INSERT INTO profitia_modules.audit_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(common('003-module-audit.sql'))])
   await owner.query('CREATE SCHEMA srm AUTHORIZATION profitia_access_owner')
   const original=read('../db/migrations/0007_shared_financial_catalog.sql')
   await owner.query(original.slice(0,original.indexOf('CREATE TABLE srm.users')))
   await owner.query(read('../db/migrations/0008_financial_indicators.sql'))
   await owner.query(read('../db/migrations/0009_financial_indicator_days.sql'))
   // Exact original three-table restrictive boundary, not a permissive test policy.
   const boundary=read('../db/security/private-operation-boundaries.sql')
   await owner.query(boundary.slice(boundary.indexOf('DO $shared$')))
   await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA srm FROM PUBLIC,srm_app_runtime`)
  })
  await controlled('profitia_ingestion_owner',async()=>{
   await owner.query(sourceSql);await owner.query(publicationSql)
   const original=(await owner.query("SELECT pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc WHERE oid='profitia_srm_catalog.open_publication(uuid,uuid,text)'::regprocedure")).rows
   await owner.query(financialPublicationSql)
   const predicates=async()=>(await owner.query("SELECT oid,pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc WHERE oid IN('profitia_srm_catalog.current_packet(text,boolean)'::regprocedure,'profitia_srm_catalog.scope_allows(text,boolean)'::regprocedure) ORDER BY oid")).rows
   const beforeProjection=await predicates()
   await owner.query('SAVEPOINT projection_rollback')
   await owner.query(scopeProjectionSql)
   await owner.query('ROLLBACK TO SAVEPOINT projection_rollback')
   assert.deepEqual(await predicates(),beforeProjection)
   assert.equal((await owner.query("SELECT to_regprocedure('profitia_srm_catalog.current_publication_effect(text,boolean)') helper")).rows[0].helper,null)
   await owner.query(scopeProjectionSql);const installedProjection=await predicates()
   await owner.query(scopeProjectionSql);assert.deepEqual(await predicates(),installedProjection)
   assert.deepEqual(installedProjection.map(p=>p.acl),beforeProjection.map(p=>p.acl))
   assert.deepEqual((await owner.query("SELECT pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc WHERE oid='profitia_srm_catalog.open_publication(uuid,uuid,text)'::regprocedure")).rows,original)
   await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','synthetic-corporate-project','synthetic-corporate-branch',$2)",[sourceDigest,DATABASE])
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'srm-corporate-source','PLATFORM_INTERNAL','synthetic-corporate','corporate-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(CORPORATE_SOURCE))
   await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,CORPORATE_SOURCE.id,'srm-corporate:'+NIP])
   await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-corporate-source',$2,'SOURCE_TRANSACTION',100,now()-interval '1 minute',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),CORPORATE_SOURCE.id])
   await owner.query('INSERT INTO profitia_srm_catalog.installation(version,schema_digest,field_schema,source_ref) VALUES($1,$2,$3::jsonb,$4)',[CORPORATE_PUBLICATION_VERSION,publicationDigest,JSON.stringify(shape),'a'.repeat(40)])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_srm_catalog TO profitia_access_owner,${ROLE};GRANT USAGE ON SCHEMA profitia_ingestion TO ${ROLE};
    GRANT EXECUTE ON FUNCTION profitia_srm_catalog.scope_allows(text,boolean),profitia_srm_catalog.current_packet(text,boolean),profitia_srm_catalog.known_proof(text,uuid),profitia_srm_catalog.valid_stored_section(text,text,jsonb) TO profitia_access_owner;
    GRANT EXECUTE ON FUNCTION profitia_srm_catalog.runtime_descriptor(),profitia_srm_catalog.open_publication(uuid,uuid,text),profitia_srm_catalog.open_financial_publication(uuid,uuid,text) TO ${ROLE};
    GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb) TO ${ROLE}`)
  })
  await controlled('profitia_access_owner',async()=>{
   await owner.query(bridgeSql)
   await owner.query(`GRANT USAGE ON SCHEMA srm TO ${ROLE},profitia_ingestion_owner;
    GRANT SELECT,INSERT,UPDATE ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${ROLE};
    GRANT EXECUTE ON FUNCTION srm.corporate_catalog_scope(text,boolean) TO ${ROLE};GRANT EXECUTE ON FUNCTION srm.corporate_publication_complete(text,uuid) TO profitia_ingestion_owner`)
   await owner.query(read('../db/private-store/020-corporate-batch-guards.sql'))
  })
  await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_access_owner,profitia_ingestion_owner`)
  const runtimeUrl=new URL(dbUrl);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only'
  pool=new pg.Pool({connectionString:runtimeUrl.toString(),max:3});auditPool=new pg.Pool({connectionString:runtimeUrl.toString(),max:1})
  const application={appId:'srm-corporate-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-corporate',configurationVersion:'corporate-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']}
  const binding={applicationId:application.appId,environment:'development',projectId:'synthetic-corporate-project',branchId:'synthetic-corporate-branch',databaseName:DATABASE,role:ROLE,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion,schemaDigest:sourceDigest}
  const settings={application,binding,publicationSchemaDigest:publicationDigest,pool,auditPool},store=createSrmCorporateSourceStore(settings)
  const counts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM profitia_srm_catalog.publications)publications,(SELECT count(*)::int FROM profitia_ingestion.effects)effects,(SELECT sum(consumed_count)::int FROM profitia_ingestion.budgets)consumed')).rows[0]
  let first
  await t.test('optional packet projection is controlled and its private helper is not a runtime authority',async()=>{
   await assert.rejects(pool.query(scopeProjectionSql))
   await assert.rejects(pool.query("SELECT profitia_srm_catalog.current_publication_effect($1,true)",[NIP]),e=>e.code==='42501')
   assert.equal((await pool.query("SELECT profitia_srm_catalog.scope_allows($1,true) allowed",[NIP]).catch(()=>({rows:[{allowed:false}]}))).rows[0].allowed,false)
  })
  await t.test('real publisher stores shared company/facts, real global lineage and original CURRENT_RATIO',async()=>{
   first=await store.publish(packet(),key('synthetic-corporate-initial'))
   assert.equal(first.status,'COMMITTED')
   assert.deepEqual(await counts(),{publications:1,effects:1,consumed:1})
   const ratio=(await owner.query("SELECT value::text,source_snapshot_ids FROM srm.catalog_financial_indicators WHERE indicator_code='CURRENT_RATIO'")).rows[0]
   assert.equal(ratio.value,'1.500000');assert.deepEqual(ratio.source_snapshot_ids,[first.effectId])
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_financial_facts WHERE source_organization_id IS NOT NULL OR source_snapshot_id<>$1',[first.effectId])).rows[0].n,0)
   const publication=(await owner.query('SELECT nip,packet,body_digest FROM profitia_srm_catalog.publications')).rows[0]
   assert.equal(publication.nip,NIP);assert.deepEqual(publication.packet,JSON.parse(JSON.stringify(packet())));assert.equal(publication.body_digest,hash(JSON.stringify(packet())))
   assert.equal((await pool.query('SELECT * FROM srm.catalog_companies')).rowCount,0)
  })
  await t.test('same intent replays the real receipt without buying or writing twice; changed content conflicts',async()=>{
   const before=await counts();assert.deepEqual(await store.publish(packet(),key('synthetic-corporate-initial')),first)
   const changed=packet();changed.general.data.legalName='Different Company'
   await assert.rejects(store.publish(changed,key('synthetic-corporate-initial')));assert.deepEqual(await counts(),before)
  })
  await t.test('unchanged content retains its original section proof while a fresh check/facts use the current actual effect',async()=>{
   const p=packet();p.general.retrievedAt=p.financial.retrievedAt='2026-10-19T00:01:00.000Z'
   const second=await store.publish(p,key('synthetic-corporate-second'))
   const row=(await owner.query('SELECT general_source_snapshot_id,financial_source_snapshot_id FROM srm.catalog_companies')).rows[0]
   assert.deepEqual(Object.values(row),[first.effectId,first.effectId]);assert.notEqual(second.effectId,first.effectId)
   assert.deepEqual((await owner.query('SELECT DISTINCT source_snapshot_id FROM srm.catalog_financial_facts')).rows.map(r=>r.source_snapshot_id),[second.effectId])
  })
  await t.test('forged scopes and direct domain writes without the actual reserved publication are refused',async()=>{
   const c=await pool.connect();await c.query('BEGIN')
   try{await c.query("SELECT set_config('profitia.srm.catalog.effect',$1,true)",[first.effectId]);assert.equal((await c.query('UPDATE srm.catalog_companies SET updated_at=now() WHERE nip=$1',[NIP])).rowCount,0)
    await assert.rejects(c.query('INSERT INTO srm.catalog_companies(nip) VALUES($1)',['5260250274']))
   }finally{await c.query('ROLLBACK');c.release()}
  })
  await t.test('source role cannot read or change protected source evidence even after an accidental table ACL',async()=>{
   await owner.query(`GRANT SELECT ON profitia_srm_catalog.publications TO ${ROLE}`)
   try{assert.equal((await pool.query('SELECT count(*)::int n FROM profitia_srm_catalog.publications')).rows[0].n,0);assert.equal((await pool.query('SELECT profitia_srm_catalog.runtime_descriptor() d')).rows[0].d,null);await assert.rejects(store.publish(packet(),key('synthetic-unsafe-acl')))}
   finally{await owner.query(`REVOKE SELECT ON profitia_srm_catalog.publications FROM ${ROLE}`)}
   await assert.rejects(pool.query('UPDATE profitia_srm_catalog.publications SET nip=$1',[NIP]))
   await assert.rejects(owner.query('DELETE FROM profitia_srm_catalog.publications'));await assert.rejects(owner.query('TRUNCATE profitia_srm_catalog.publications'))
  })
  await t.test('missing OUTCOME cannot commit catalog, publication or budget consumption',async()=>{
   const before=await counts()
   await owner.query('CREATE SEQUENCE profitia_ingestion.fixture_outcome_attempt;GRANT USAGE ON SEQUENCE profitia_ingestion.fixture_outcome_attempt TO profitia_ingestion_owner')
   await owner.query("CREATE FUNCTION profitia_ingestion.drop_fixture_outcome() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' THEN PERFORM nextval('profitia_ingestion.fixture_outcome_attempt');RETURN NULL;END IF;RETURN NEW;END$$;CREATE TRIGGER drop_fixture_outcome BEFORE INSERT ON profitia_ingestion.security_events FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.drop_fixture_outcome()")
   try{let failure;await assert.rejects(store.publish(packet(),key('synthetic-no-outcome')),error=>{failure=error;return true});assert.deepEqual(await counts(),before);assert.equal((await owner.query('SELECT is_called FROM profitia_ingestion.fixture_outcome_attempt')).rows[0].is_called,true,String(failure?.stack))}
   finally{await owner.query('DROP TRIGGER drop_fixture_outcome ON profitia_ingestion.security_events;DROP FUNCTION profitia_ingestion.drop_fixture_outcome();DROP SEQUENCE profitia_ingestion.fixture_outcome_attempt')}
  })
  await t.test('SOURCE cannot read the private directory even after accidental schema and table read grants',async()=>{
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n,1);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.memberships')).rows[0].n,1)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${ROLE};GRANT SELECT ON profitia_access.accounts,profitia_access.memberships TO ${ROLE}`)
   try{
    assert.equal((await pool.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n,0)
    assert.equal((await pool.query('SELECT count(*)::int n FROM profitia_access.memberships')).rows[0].n,0)
    await assert.rejects(pool.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES(gen_random_uuid(),'ACTIVE')"))
   }finally{await owner.query(`REVOKE SELECT ON profitia_access.accounts,profitia_access.memberships FROM ${ROLE};REVOKE USAGE ON SCHEMA profitia_access FROM ${ROLE}`)}
  })
  await t.test('reserved publication rejects tampered catalog hashes and fabricated fact proof IDs',async()=>{
   const before=await counts(),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   const body=JSON.stringify(packet())
   for(const sql of ["UPDATE srm.catalog_companies SET general_sha256=repeat('0',64) WHERE nip=$1", "UPDATE srm.catalog_financial_facts SET source_snapshot_id=gen_random_uuid() WHERE nip=$1"]){
    let admitted=null,queryError=null
    await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
     admitted=(await c.query('SELECT profitia_srm_catalog.open_publication($1::uuid,$2::uuid,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok
     await writeSharedCompany(c,null,NIP,{...packet(),generalSnapshotId:context.platformReservation.effectId,financialSnapshotId:context.platformReservation.effectId})
     try{await c.query(sql,[NIP])}catch(error){queryError=error.code;throw error}
    }));assert.equal(admitted,true);assert.equal(queryError,'42501')
   }assert.deepEqual(await counts(),before)
  })
  await t.test('wrong physical role, environment, branch and schema digest refuse before domain effects',async()=>{
   const before=await counts()
   const foreign=packet();foreign.nip=foreign.general.data.nip='5260250274';await assert.rejects(store.publish(foreign,key('synthetic-foreign-nip')))
   for(const patch of [{binding:{...binding,role:'foreign_role'}},{application:{...application,environment:'staging'},binding:{...binding,environment:'staging'}},{binding:{...binding,branchId:'foreign-branch'}},{publicationSchemaDigest:'0'.repeat(64)}])await assert.rejects(createSrmCorporateSourceStore({...settings,...patch}).publish(packet(),key('synthetic-wrong-binding')))
   assert.deepEqual(await counts(),before)
  })
  await t.test('current source revocation and exhausted transaction budget refuse without new publication',async()=>{
   const before=await counts()
   await owner.query("UPDATE profitia_ingestion.sources SET status='REVOKED'")
   try{await assert.rejects(store.publish(packet(),key('synthetic-revoked')))}finally{await owner.query("UPDATE profitia_ingestion.sources SET status='ACTIVE'")}
   await owner.query('UPDATE profitia_ingestion.budgets SET capacity=consumed_count')
   try{await assert.rejects(store.publish(packet(),key('synthetic-budget')))}finally{await owner.query('UPDATE profitia_ingestion.budgets SET capacity=100')}
   assert.deepEqual(await counts(),before)
  })
  await t.test('SQL packet guard rejects unknown private fields and duplicate JSON keys even if JS validation is bypassed',async()=>{
   const before=await counts(),driver=createSrmNativePgDriver(pool,auditPool)
   const source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...driver,validateSharedPayload:()=>true})
   const p=packet();p.general.data.privateUserId='never-public'
   for(const body of [JSON.stringify(p),JSON.stringify(packet()).replace('"nip":"'+NIP+'"','"nip":"'+NIP+'","nip":"'+NIP+'"')]){
    let admitted=null
    await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
     admitted=(await c.query('SELECT profitia_srm_catalog.open_publication($1::uuid,$2::uuid,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok
     throw Error('Expected classified packet refusal')
    }));assert.equal(admitted,false)
   }assert.deepEqual(await counts(),before)
  })
  await t.test('reserved source manifest cannot publish another NIP or a different packet body',async()=>{
   const before=await counts(),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   const body=JSON.stringify(packet())
   let admitted=null
   await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:'0'.repeat(64),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
    admitted=(await c.query('SELECT profitia_srm_catalog.open_publication($1::uuid,$2::uuid,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok
    await writeSharedCompany(c,null,NIP,{...packet(),generalSnapshotId:context.platformReservation.effectId,financialSnapshotId:context.platformReservation.effectId})
   }));assert.equal(admitted,false);assert.deepEqual(await counts(),before)
  })
  await t.test('Financial-only publication preserves existing General and works for a new company without General acquisition',async()=>{
   const generalColumns='general_json,general_sha256,general_checked_at,general_source_organization_id,general_source_snapshot_id'
   const before=(await owner.query('SELECT '+generalColumns+' FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows
   const financialOnly={...packet(),preserveGeneral:true,general:unrequestedCorporateGeneral()}
   financialOnly.financial.data.periods[0].facts.find(f=>f.metricCode==='BS_A_CA').amount='400'
   const changedFact=financialOnly.facts.find(f=>f.metricCode==='BS_A_CA');changedFact.amount='400';changedFact.sourceAmount='400'
   const published=await store.publish(financialOnly,key('synthetic-financial-only-existing'))
   assert.equal(published.status,'COMMITTED')
   assert.deepEqual((await owner.query('SELECT '+generalColumns+' FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows,before)
   assert.equal((await owner.query('SELECT financial_source_snapshot_id FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows[0].financial_source_snapshot_id,published.effectId)
   const freshNip='5260250274'
   await controlled('profitia_ingestion_owner',()=>owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,CORPORATE_SOURCE.id,'srm-corporate:'+freshNip]))
   await store.publish({...financialOnly,nip:freshNip},key('synthetic-financial-only-new'))
   const fresh=(await owner.query('SELECT general_json,general_source_snapshot_id,financial_json FROM srm.catalog_companies WHERE nip=$1',[freshNip])).rows[0]
   assert.equal(fresh.general_json,null);assert.equal(fresh.general_source_snapshot_id,null);assert.equal(fresh.financial_json.status,'SUCCESS')
  })
  await t.test('Financial-only SQL refuses General content and the original port still refuses empty General',async()=>{
   const before=await counts(),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   for(const [port,p] of [['open_financial_publication',{...packet(),preserveGeneral:true}],['open_publication',{...packet(),preserveGeneral:true,general:unrequestedCorporateGeneral()}]]){
    const body=JSON.stringify(p);let admitted=null
    await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
     admitted=(await c.query(`SELECT profitia_srm_catalog.${port}($1::uuid,$2::uuid,$3) ok`,[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok
     throw Error('Expected closed port refusal')
    }));assert.equal(admitted,false)
   }
   assert.deepEqual(await counts(),before)
  })
  await t.test('395 synthetic facts over9years publish within the unchanged deadline and preserve General and global provenance',async()=>{
   const sample=packet(),period=sample.financial.data.periods[0],template=sample.facts[0],periods=[],facts=[]
   const generalColumns='general_json,general_sha256,general_checked_at,general_source_organization_id,general_source_snapshot_id'
   const before=(await owner.query('SELECT '+generalColumns+' FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows
   for(let year=2017;year<=2025;year++){
    const selected=[]
    for(let metric=0;metric<44;metric++){
     if(year===2025&&metric===43)continue
     const metricCode=metric===0?'BS_A_CA':metric===1?'BS_LAE_LAPFL_STL':'SYNTHETIC_'+metric
     const fact={...template,metricCode,periodStart:year+'-01-01',periodEnd:year+'-12-31',amount:'100',sourceAmount:'100',sourcePath:'content.standardized_fields.synthetic_'+metric}
     facts.push(fact);selected.push({metricCode,amount:'100',currency:'PLN',unit:'PLN'})
    }
    periods.push({...period,from:year+'-01-01',to:year+'-12-31',documentId:year.toString(16).padStart(24,'0'),facts:selected})
   }
   const result=await store.publish({...sample,preserveGeneral:true,general:unrequestedCorporateGeneral(),financial:{...sample.financial,data:{periods}},facts},key('synthetic-financial-only-395-scale'))
   assert.equal(result.status,'COMMITTED');assert.equal(facts.length,395)
   assert.deepEqual((await owner.query('SELECT '+generalColumns+' FROM srm.catalog_companies WHERE nip=$1',[NIP])).rows,before)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_financial_facts WHERE nip=$1 AND source_snapshot_id=$2 AND source_organization_id IS NULL',[NIP,result.effectId])).rows[0].n,395)
  })

  await t.test('batch admission rejects changed values, paths, periods and global proof after the actual fast RLS scope',async()=>{
   const before=await counts(),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   for(const change of [p=>{p.facts[0].amount='999'},p=>{p.facts[0].sourcePath='content.unaccepted'},p=>{p.facts[0].periodStart='2024-01-01'},p=>{p.facts[0].currencyCode='EUR'}]){
    const accepted=packet(),body=JSON.stringify(accepted),written=structuredClone(accepted);change(written)
    await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
     assert.equal((await c.query('SELECT profitia_srm_catalog.open_publication($1,$2,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok,true)
     await c.query("SELECT set_config('profitia.srm.catalog.nip',$1,true)",[NIP])
     assert.equal((await c.query('SELECT srm.corporate_statement_subject(true) nip')).rows[0].nip,NIP)
     await writeSharedCompany(c,null,NIP,{...written,generalSnapshotId:context.platformReservation.effectId,financialSnapshotId:context.platformReservation.effectId})
    }))
   }
   assert.deepEqual(await counts(),before)
  })

  await t.test('temporary tables cannot replace the actual transition rows checked by the batch trigger',async()=>{
   const before=await counts(),p=packet(),body=JSON.stringify(p),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   await owner.query(`GRANT TEMPORARY ON DATABASE ${DATABASE} TO ${ROLE}`)
   try{await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
    assert.equal((await c.query('SELECT profitia_srm_catalog.open_publication($1,$2,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok,true)
    await c.query("SELECT set_config('profitia.srm.catalog.nip',$1,true)",[NIP])
    await c.query('CREATE TEMP TABLE corporate_written AS SELECT * FROM srm.catalog_financial_facts LIMIT 0')
    const altered=structuredClone(p);altered.facts[0].amount='999'
    await writeSharedCompany(c,null,NIP,{...altered,generalSnapshotId:context.platformReservation.effectId,financialSnapshotId:context.platformReservation.effectId})
   }))}finally{await owner.query(`REVOKE TEMPORARY ON DATABASE ${DATABASE} FROM ${ROLE}`)}
   assert.deepEqual(await counts(),before)
  })
  await t.test('forged selectors and expired Source binding never reuse a previous statement authority',async()=>{
   const c=await pool.connect();await c.query('BEGIN')
   try{await c.query("SELECT set_config('profitia.srm.catalog.nip',$1,true)",[NIP]);assert.equal((await c.query('SELECT srm.corporate_statement_subject(true) nip')).rows[0].nip,null)}
   finally{await c.query('ROLLBACK');c.release()}
   const before=await counts(),p=packet(),body=JSON.stringify(p),source=createPlatformIngestionHost({application,binding,source:CORPORATE_SOURCE,...createSrmNativePgDriver(pool,auditPool),validateSharedPayload:()=>true})
   let first,last
   await owner.query("UPDATE profitia_ingestion.runtime_bindings SET expires_at=clock_timestamp()+interval '800 milliseconds' WHERE login_role=$1",[ROLE])
   try{await assert.rejects(source.ingest({resourceId:'srm-corporate:'+NIP,payload:{bodyDigest:hash(body),nip:NIP,version:CORPORATE_PUBLICATION_VERSION},idempotencyKey:randomUUID()},async(_payload,c,context)=>{
    assert.equal((await c.query('SELECT profitia_srm_catalog.open_publication($1,$2,$3) ok',[context.platformReservation.effectId,context.decisionId,body])).rows[0].ok,true)
    await c.query("SELECT set_config('profitia.srm.catalog.nip',$1,true)",[NIP]);first=(await c.query('SELECT srm.corporate_statement_subject(true) nip')).rows[0].nip
    await writeSharedCompany(c,null,NIP,{...p,generalSnapshotId:context.platformReservation.effectId,financialSnapshotId:context.platformReservation.effectId})
    await new Promise(r=>setTimeout(r,850));last=(await c.query('SELECT srm.corporate_statement_subject(true) nip')).rows[0].nip
   }))}finally{await owner.query("UPDATE profitia_ingestion.runtime_bindings SET expires_at=now()+interval '1 hour' WHERE login_role=$1",[ROLE])}
   assert.equal(first,NIP);assert.equal(last,null);assert.deepEqual(await counts(),before)
  })
 }finally{await pool?.end();await auditPool?.end();await owner?.end();await root.end()}
})
