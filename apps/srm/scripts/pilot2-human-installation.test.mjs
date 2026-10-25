import test from 'node:test'
import assert from 'node:assert/strict'
import {pilot2HumanInstallationPlan,pilot2PublicReaderPlan,applyPilot2TechnicalPlan} from './pilot2-human-installation.mjs'
const sha='a'.repeat(40)
test('receiver plans add only ordinary technical roles and preserve human rights, policy state and existing administrative membership',()=>{
 assert.throws(()=>pilot2HumanInstallationPlan('main',{operatorMembership:'EXISTING'}))
 assert.throws(()=>pilot2HumanInstallationPlan(sha))
 assert.throws(()=>pilot2HumanInstallationPlan(sha,{operatorMembership:'guessed'}))
 const old=pilot2HumanInstallationPlan(sha,{operatorMembership:'EXISTING'}),temporary=pilot2HumanInstallationPlan(sha,{operatorMembership:'TEMPORARY'})
 assert(old.beforeCredentials.some(s=>s==='SET LOCAL ROLE profitia_access_owner'))
 assert(!old.beforeCredentials.some(s=>s.startsWith('GRANT profitia_access_owner TO ')))
 assert(!old.afterCredentials.some(s=>s.startsWith('REVOKE profitia_access_owner FROM ')))
 assert(temporary.beforeCredentials.some(s=>s.startsWith('GRANT profitia_access_owner TO ')))
 assert(temporary.afterCredentials.some(s=>s.startsWith('REVOKE profitia_access_owner FROM ')))
 for(const plan of[old,temporary]){
  const sql=[...plan.beforeCredentials,...plan.afterCredentials].join('\n')
  assert(!/UPDATE |DELETE FROM|TRUNCATE |DROP |PASSWORD |INSERT INTO profitia_access\.(accounts|memberships|permission_grants|product_grants)|UPDATE.*(policies|budgets)/.test(sql))
  assert.match(sql,/NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 4/)
  assert.equal(plan.humanEntitlementsChanged,false)
 }
 const reader=pilot2PublicReaderPlan(sha),sql=reader.beforeCredentials.join('\n')
 assert.match(sql,/GRANT CONNECT,TEMPORARY ON DATABASE srm_app TO srm_app_runtime/)
 assert(!/GRANT SELECT.* ON srm\.(mgbi_source_archives|financial_source_documents|lookup_requests|source_snapshots)/.test(sql))
 assert(!/GRANT SELECT\(/.test(sql.replaceAll(/GRANT SELECT\([^\n]+ ON srm\.(catalog_companies|catalog_financial_facts|catalog_financial_indicators) TO srm_pilot2_catalog_reader/g,'')))
 assert.equal(reader.privateDataCopied,false)
})
function client(plan,fail){
 const calls=[]
 return {calls,connectionParameters:{host:plan.host,database:plan.databaseName,user:'neondb_owner'},async query(sql){calls.push(sql);if(fail?.(sql))throw Error('Synthetic rejected step');return{rows:[]}}}
}
test('initial credentials and role cleanup must finish before the same transaction commits',async()=>{
 const plan=pilot2HumanInstallationPlan(sha,{operatorMembership:'TEMPORARY'}),c=client(plan)
 const result=await applyPilot2TechnicalPlan(c,plan,async(_client,roles)=>{assert.deepEqual(roles,plan.roles);c.calls.push('INITIAL_CREDENTIALS');return true})
 assert.equal(result.committed,true);assert.equal(c.calls[0],'BEGIN');assert.equal(c.calls.at(-1),'COMMIT')
 assert(c.calls.indexOf('RESET ROLE')<c.calls.indexOf('INITIAL_CREDENTIALS'))
 assert(c.calls.indexOf('INITIAL_CREDENTIALS')<c.calls.findIndex(s=>s.startsWith('REVOKE profitia_access_owner FROM ')))
 assert(!JSON.stringify(result).includes('INITIAL_CREDENTIALS'))
 for(const initialize of[async()=>false,async()=>{throw Error('Synthetic credential failure')}]){
  const c=client(plan);await assert.rejects(applyPilot2TechnicalPlan(c,plan,initialize));assert.equal(c.calls.at(-1),'ROLLBACK');assert(!c.calls.includes('COMMIT'))
 }
 const cleanup=client(plan,s=>s.startsWith('REVOKE profitia_access_owner FROM '))
 await assert.rejects(applyPilot2TechnicalPlan(cleanup,plan,async()=>true));assert.equal(cleanup.calls.at(-1),'ROLLBACK');assert(!cleanup.calls.includes('COMMIT'))
})
test('a different endpoint, database or operator is rejected before SQL or secret initialization',async()=>{
 const plan=pilot2PublicReaderPlan(sha)
 for(const patch of[{host:'staging.neon.tech'},{database:'other'},{user:'owner'}]){
  const c=client(plan);Object.assign(c.connectionParameters,patch)
  await assert.rejects(applyPilot2TechnicalPlan(c,plan,async()=>assert.fail()))
  assert.deepEqual(c.calls,[])
 }
})
