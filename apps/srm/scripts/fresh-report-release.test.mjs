import test from 'node:test'
import assert from 'node:assert/strict'
import {freshReportReleasePlan,captureFreshFunctions} from './fresh-report-release.mjs'
test('FRESH release refuses missing, duplicate, fabricated or foreign backup before administration',()=>{
 for(const backup of [undefined,[],[{}],[{id:'srm.foreign()',definition:'SELECT 1',digest:'a'.repeat(32),owner:'profitia_access_owner',prosecdef:true}],Array(3).fill({id:'srm.foreign()'})])
  assert.throws(()=>freshReportReleasePlan({mode:'install-bind',sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40),backup}),/Exact main Development/)
})
test('FRESH schema capture refuses foreign ownership and incomplete function identity',async()=>{
 for(const rows of [[],[{id:'srm.foreign()'}],Array(3).fill({id:'srm.foreign()',owner:'other',prosecdef:true})])
  await assert.rejects(captureFreshFunctions({query:async()=>({rows})}),/Exact main Development/)
})
