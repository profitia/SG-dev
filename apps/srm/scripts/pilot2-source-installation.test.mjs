import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pilot2SourceInstallationPlan,pilot2SourceBootstrapPlan,validatePilot2RegistryTarget,applyPilot2SourceBootstrap} from './pilot2-source-installation.mjs'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-registry-targets.json',import.meta.url)))
const sourceSha='a'.repeat(40)
test('Source target cannot select Staging, Pilot1, another database or broader role',()=>{
 assert.equal(validatePilot2RegistryTarget(target),target)
 for(const [section,key,value]of [['catalog','branchId','br-broad-butterfly-b11t4v01'],['catalog','databaseName','srm_app'],['catalog','operatorRole','other'],['catalog','sourceRole','neondb_owner'],['render','serviceId','srv-dbd5hlcipgvc73d98ukg'],['approval','additionalCompute',true],['dataBoundary','newHumanAccountsOrGrants',true]]){
  const changed=structuredClone(target);changed[section][key]=value;assert.throws(()=>pilot2SourceInstallationPlan(changed,sourceSha))
 }
 assert.throws(()=>pilot2SourceInstallationPlan(target,'main'))
})
test('immutable producer SQL and catalog fences survive; only free exact transports are admitted',()=>{
 const p=pilot2SourceInstallationPlan(target,sourceSha),sql=p.statements.join('\n')
 for(const name of ['008-platform-ingestion.sql','009-external-call-admission.sql','012-native-external-transport.sql','021-native-soap-transport.sql','024-unmetered-public-sources.sql'])
  assert(p.statements.includes(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+name,import.meta.url),'utf8')),name)
 assert.match(sql,/require_native_source/);assert.match(sql,/UNMETERED/);assert.match(sql,/SERVER_HEADERS/)
 assert.match(sql,/reserve_gus_slot/);assert.match(sql,/OdpisAktualny/);assert.match(sql,/OdpisPelny/)
 assert.doesNotMatch(sql,/api\.mgbi|MGBI|INSERT INTO profitia_access/);assert.doesNotMatch(sql,/UPDATE (?:profitia_ingestion\.budgets|profitia_external_call\.policies) SET (?:consumed_count|admitted_count)\s*=\s*0/)
 const grants=p.statements.filter(v=>v.startsWith('INSERT INTO profitia_ingestion.grants'))
 assert.equal(grants.length,3);assert(grants.some(v=>v.includes("'krs.registry.catalog',NULL")))
 assert(p.statements.findIndex(v=>v.includes('ALTER TABLE profitia_ingestion.budgets'))<p.statements.findIndex(v=>v.startsWith('INSERT INTO profitia_ingestion.runtime_bindings')))
})
test('bootstrap contains no credential and cleans every new operator membership in the same transaction',()=>{
 const p=pilot2SourceBootstrapPlan(target,sourceSha),sql=p.statements.join('\n')
 assert.equal(p.requiresOneOuterTransaction,true);assert.equal(p.newHumanAccountsOrGrants,false)
 assert.equal(p.requiresInitialCredentials,true)
 assert(p.initialCredentialIndex< p.statements.findIndex(v=>v.startsWith('DROP ROLE')))
 assert.equal(p.statements.filter(v=>v.startsWith('CREATE ROLE')).length,5)
 assert.doesNotMatch(sql,/PASSWORD|NOSUPERUSER[^\n]*INHERIT TRUE/)
 assert.match(sql,/REVOKE krs_catalog_owner,profitia_ingestion_owner FROM neondb_owner/)
 assert.match(sql,/DROP ROLE pilot2_source_bootstrap/)
 assert(sql.lastIndexOf('RESET ROLE')<sql.lastIndexOf('Temporary PILOT2 membership remains'))
})
test('a native installer initializes both credentials before cleanup and never returns them',async()=>{
 const credentials={krs_reader:'FixtureReaderOnly09_0123456789abcdef0123456789abcdef',krs_ingest:'FixtureSourceOnly09_0123456789abcdef0123456789abcdef'}
 const statements=[],client={query:async sql=>{statements.push(sql);return {rows:[]}}}
 const result=await applyPilot2SourceBootstrap(client,target,sourceSha,credentials)
 assert.equal(result.credentialsInitializedBeforeCleanup,true);assert.equal(result.transaction,'COMMITTED')
 assert(statements.indexOf("SELECT set_config('profitia.install.initial_credentials_ready','true',true)")<statements.findIndex(v=>v.startsWith('DROP ROLE')))
 assert(statements.findIndex(v=>v.startsWith('ALTER ROLE krs_reader PASSWORD'))>statements.indexOf('SET ROLE pilot2_source_bootstrap'))
 assert.equal(statements.at(-1),'COMMIT')
 for(const password of Object.values(credentials))assert(!JSON.stringify(result).includes(password))
})
test('credential initialization failure rolls back and discards SQL/error context',async()=>{
 const credentials={krs_reader:'FixtureReaderOnly09_0123456789abcdef0123456789abcdef',krs_ingest:'FixtureSourceOnly09_0123456789abcdef0123456789abcdef'},statements=[]
 const client={query:async sql=>{statements.push(sql);if(sql.startsWith('ALTER ROLE krs_ingest PASSWORD'))throw Object.assign(Error(credentials.krs_ingest),{code:'42501',where:sql});return {rows:[]}}}
 await assert.rejects(applyPilot2SourceBootstrap(client,target,sourceSha,credentials),error=>{
  assert.equal(error.message,'PILOT2_SOURCE_BOOTSTRAP_FAILED');assert.equal(error.sqlState,'42501')
  for(const password of Object.values(credentials))assert(!JSON.stringify(error).includes(password))
  return true
 })
 assert.equal(statements.at(-1),'ROLLBACK');assert(!statements.includes('COMMIT'))
})
