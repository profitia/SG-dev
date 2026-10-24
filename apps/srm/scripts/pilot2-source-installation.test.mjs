import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pilot2SourceInstallationPlan,pilot2SourceBootstrapPlan,validatePilot2RegistryTarget} from './pilot2-source-installation.mjs'
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
 assert.equal(p.statements.filter(v=>v.startsWith('CREATE ROLE')).length,5)
 assert.doesNotMatch(sql,/PASSWORD|NOSUPERUSER[^\n]*INHERIT TRUE/)
 assert.match(sql,/REVOKE krs_catalog_owner,profitia_ingestion_owner FROM neondb_owner/)
 assert.match(sql,/DROP ROLE pilot2_source_bootstrap/)
 assert(sql.lastIndexOf('RESET ROLE')<sql.lastIndexOf('Temporary PILOT2 membership remains'))
})
