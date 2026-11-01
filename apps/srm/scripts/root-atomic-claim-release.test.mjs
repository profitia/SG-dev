import test from 'node:test'
import assert from 'node:assert/strict'
import {rootClaimReleasePlan,executeRootClaimRelease} from './root-atomic-claim-release.mjs'

const sourceSha='a'.repeat(40),previousSha='b'.repeat(40)
const make=mode=>rootClaimReleasePlan({mode,sourceSha,previousSha})
test('Root activation installs only the pinned optional namespace and one existing main receiver',()=>{
 const p=make('install-bind'),sql=p.statements.map(s=>s.text).join('\n')
 assert.equal(p.target.enabledByDefault,false);assert(Object.isFrozen(p));assert(p.statements.every(Object.isFrozen))
 assert.equal(p.statements.filter(s=>s.text.startsWith('INSERT INTO profitia_root_claim.')).length,2)
 assert.equal(p.statements.filter(s=>s.text.startsWith('UPDATE profitia_services.runtime_bindings')).length,1)
 assert.equal(p.statements.filter(s=>s.text.startsWith('UPDATE profitia_ingestion.runtime_bindings')).length,2)
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);assert.match(sql,/supplier_runtime_descriptor/)
 assert.match(sql,/NOT has_database_privilege\('profitia_access_owner','platform_private','CREATE'\)/)
 assert(!/CREATE ROLE|CREATE DATABASE|DISABLE ROW LEVEL SECURITY|DROP SCHEMA|TRUNCATE TABLE/.test(sql))
 assert(!/UPDATE profitia_(?:external_call|ingestion)\.(?:policies|calls|budgets|effects)/.test(sql))
 assert.match(sql,/NOT EXISTS\(SELECT 1 FROM pg_auth_members/)
 assert(p.statements.findIndex(s=>s.text.startsWith('REVOKE CREATE'))<p.statements.findIndex(s=>s.text.startsWith('REVOKE profitia_access_owner')))
})
test('rollback disables only the exact receiver and restores three bindings without deleting provenance or grants',()=>{
 const p=make('rollback-bind'),sql=p.statements.map(s=>s.text).join('\n')
 assert.equal(p.statements.filter(s=>s.text.startsWith('UPDATE profitia_root_claim.receivers')).length,1)
 assert(!sql.includes('CREATE SCHEMA'));assert(!/DELETE FROM|DROP |TRUNCATE /.test(sql))
 assert(!sql.includes('REVOKE EXECUTE'));assert.equal(p.statements.filter(s=>s.text.startsWith('UPDATE profitia_ingestion.runtime_bindings')).length,2)
 for(const s of p.statements.filter(s=>s.text.startsWith('UPDATE profitia_')&&!s.text.startsWith('UPDATE profitia_root_claim')))
  assert(s.values[0].includes(previousSha)&&s.values.at(-1).includes(sourceSha))
})
for(const args of [{mode:'prepare'},{mode:'install-bind',sourceSha:'main'},{mode:'install-bind',previousSha:sourceSha},{mode:'rollback-bind',previousSha:''}])
 test('release refuses incomplete or ambiguous revisions '+JSON.stringify(args),()=>assert.throws(()=>rootClaimReleasePlan({mode:'install-bind',sourceSha,previousSha,...args})))
function client(failure){
 const queries=[]
 return {queries,query:async(text,values)=>{queries.push({text,values});if(failure?.(text))throw Error('isolated refusal');return {rowCount:1,rows:[]}}}
}
test('default rehearsal rolls back and the operator is revoked before the transaction ends',async()=>{
 const c=client(),result=await executeRootClaimRelease(c,make('install-bind'))
 assert.equal(result.applied,false);assert.equal(c.queries[0].text,'BEGIN');assert.equal(c.queries.at(-1).text,'ROLLBACK')
 const revoke=c.queries.findIndex(s=>s.text.startsWith('REVOKE profitia_access_owner'))
 assert(revoke>0&&revoke<c.queries.length-1);assert.equal(result.newLoginRolesCreated,false);assert.equal(result.expiryOrOriginalProviderCountersReset,false)
})
test('a confirmed apply commits only after the exact operator-restoration assertion',async()=>{
 const c=client(),result=await executeRootClaimRelease(c,make('install-bind'),{apply:true})
 assert.equal(result.applied,true);assert.equal(result.rootClaimReceiverEnabled,true);assert.equal(c.queries.at(-1).text,'COMMIT')
 assert.match(c.queries.at(-2).text,/grantor=session_user::regrole/)
})
test('installation or binding failure rolls back without attempting commit',async()=>{
 for(const prefix of ['INSERT INTO profitia_root_claim.installation','UPDATE profitia_services.runtime_bindings','REVOKE profitia_access_owner']){
  const c=client(text=>text.startsWith(prefix));await assert.rejects(executeRootClaimRelease(c,make('install-bind'),{apply:true}))
  assert.equal(c.queries.at(-1).text,'ROLLBACK');assert(!c.queries.some(s=>s.text==='COMMIT'))
 }
})
test('missing receiver or unexpected binding count refuses the entire transaction',async()=>{
 for(const prefix of ['INSERT INTO profitia_root_claim.receivers','UPDATE profitia_ingestion.runtime_bindings']){
  const c=client(),query=c.query;c.query=async(text,values)=>text.startsWith(prefix)?{rowCount:0,rows:[]}:query(text,values)
  await assert.rejects(executeRootClaimRelease(c,make('install-bind'),{apply:true}));assert.equal(c.queries.at(-1).text,'ROLLBACK')
 }
})
test('a copied or mutable plan cannot execute any SQL',async()=>{
 const c=client(),p=make('install-bind')
 await assert.rejects(executeRootClaimRelease(c,structuredClone(p),{apply:true}));assert.equal(c.queries.length,0)
 assert.throws(()=>{p.statements[0].text='SELECT 1'},TypeError)
 await assert.rejects(executeRootClaimRelease(c,p,{apply:'true'}));assert.equal(c.queries.length,0)
})
