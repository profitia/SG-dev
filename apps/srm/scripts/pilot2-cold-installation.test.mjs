import test from 'node:test'
import assert from 'node:assert/strict'
import {pilot2ColdInstallationPlan} from './pilot2-cold-installation.mjs'
test('Cold adoption declares only bounded ordinary receivers, preserves old rows and cleans temporary owner capability before commit',()=>{
 const plan=pilot2ColdInstallationPlan('a'.repeat(40),{ingestionMembership:'TEMPORARY'})
 const sql=plan.beforeCredentials.join('\n')+'\n'+plan.afterCredentials.join('\n')
 assert.deepEqual(plan.roles,['srm_pilot2_source','srm_pilot2_corporate'])
 assert.equal(plan.databaseName,'platform_private')
 assert.match(sql,/NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 4/)
 assert.match(sql,/GRANT SELECT ON profitia_supplier_requests\.commands TO srm_pilot2_jobs/)
 assert.match(sql,/RESET ROLE\nREVOKE profitia_ingestion_owner FROM neondb_owner/)
 assert.doesNotMatch(sql,/DELETE FROM|UPDATE profitia_access\.|UPDATE profitia_ingestion\.|TRUNCATE|ALTER ROLE|PASSWORD/)
 assert.doesNotMatch(sql,/CREATE DATABASE|GRANT profitia_access_owner TO/)
 const existing=pilot2ColdInstallationPlan('a'.repeat(40),{ingestionMembership:'EXISTING'}).beforeCredentials.join('\n')
 assert.doesNotMatch(existing,/GRANT profitia_ingestion_owner TO|REVOKE profitia_ingestion_owner FROM/)
 for(const sha of['main','a'.repeat(39),'A'.repeat(40)])assert.throws(()=>pilot2ColdInstallationPlan(sha,{ingestionMembership:'TEMPORARY'}))
 assert.throws(()=>pilot2ColdInstallationPlan('a'.repeat(40)))
})
