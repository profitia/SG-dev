import test from 'node:test'
import assert from 'node:assert/strict'
import {readyReportReleasePlan,executeReadyReportRelease} from './ready-report-release.mjs'
const revisions={sourceSha:'a'.repeat(40),previousSha:'b'.repeat(40)}
test('release scopes the additive installation, preserves paid controls and removes administration before commit',async()=>{
 const p=readyReportReleasePlan({...revisions,mode:'prepare'})
 assert.equal(p.target.serviceId,'srv-db1vu6gm7kps73d0e3r0')
 assert(p.statements.some(s=>s.text.includes('CREATE TABLE srm.ready_company_reports')))
 assert(!p.statements.some(s=>/UPDATE profitia_(access|ingestion|external)/.test(s.text)))
 assert(!p.statements.some(s=>/DELETE FROM|TRUNCATE TABLE/.test(s.text)))
 const seen=[]
 await executeReadyReportRelease({query:async(text)=>{seen.push(text);return {rowCount:1}}},p,{apply:true})
 assert(seen.at(-1)==='COMMIT');assert(seen.at(-3).startsWith('REVOKE profitia_access_owner'))
 const cutover=readyReportReleasePlan({...revisions,mode:'bind'}),rollback=readyReportReleasePlan({...revisions,mode:'rollback-bind'})
 assert.equal(cutover.statements.filter(s=>s.text.startsWith('UPDATE ')).length,3)
 assert.equal(rollback.statements.filter(s=>s.text.startsWith('UPDATE ')).length,3)
 const bad=[]
 await assert.rejects(executeReadyReportRelease({query:async(text)=>{bad.push(text);return {rowCount:0}}},cutover,{apply:true}),/single deployment/)
 assert.equal(bad.at(-1),'ROLLBACK');assert(!bad.includes('COMMIT'))
 assert.throws(()=>readyReportReleasePlan({...revisions,mode:'staging'}))
 assert.throws(()=>readyReportReleasePlan({...revisions,sourceSha:revisions.previousSha,mode:'prepare'}))
})
