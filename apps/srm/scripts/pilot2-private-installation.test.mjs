import test from 'node:test'
import assert from 'node:assert/strict'
import {pilot2PrivateInstallationPlan} from './pilot2-private-installation.mjs'
test('Private transport plan is bounded, contains no credential or identity/old-counter mutation and requires exact accepted source',()=>{
 assert.throws(()=>pilot2PrivateInstallationPlan('main'))
 const plan=pilot2PrivateInstallationPlan('a'.repeat(40)),sql=plan.statements.join('\n')
 assert.match(sql,/SET LOCAL ROLE profitia_ingestion_owner/);assert.match(sql,/RESET ROLE/)
 assert.doesNotMatch(sql,/CREATE ROLE|PASSWORD|UPDATE profitia_|DELETE FROM|INSERT INTO profitia_ingestion\.budgets|GRANT profitia_.* TO neondb_owner/)
 assert.match(sql,/THEN 5 ELSE 20 END/)
 assert.equal(plan.digest.length,64)
})
