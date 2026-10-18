import assert from 'node:assert/strict'
import test from 'node:test'
import {createRequestContinuationLedger,REQUEST_CONTINUATION_CONTRACT,requestContinuationSchemaDigest} from '../src/request-continuation.mjs'
const binding={applicationId:'srm',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture',role:'ordinary_fixture',schemaDigest:'a'.repeat(64)}
const continuation={requestId:'11111111-1111-4111-8111-111111111111',phaseId:'REGISTER_LOOKUP',inputDigest:'b'.repeat(64),schemaDigest:'c'.repeat(64)}
const ledger={contract:{id:'fixture'},loadPolicy:async()=>{throw Error('No database in constructor test')},reserve:async()=>{},complete:async()=>{}}
test('explicit versioned continuation is private SQL only and constructors never query or authorise',async()=>{
 assert.deepEqual(REQUEST_CONTINUATION_CONTRACT,{id:'profitia.request-continuation',version:'1.0.0',effect:'PRIVATE_SQL_PHASE'})
 const c=createRequestContinuationLedger({ledger,binding,continuation});assert(Object.isFrozen(c));assert.equal(c.contract,ledger.contract)
 assert.match(await requestContinuationSchemaDigest(),/^[a-f0-9]{64}$/)
 assert.throws(()=>c.evidence({}),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})
for(const patch of [{requestId:'forged'},{phaseId:'../provider'},{phaseId:'REMOTE:*'},{phaseId:'x'.repeat(65)},{inputDigest:'raw payload'},{schemaDigest:'wrong'},{authority:true},{requestId:null}])test('refuse malformed or expanded continuation '+JSON.stringify(patch),()=>{
 assert.throws(()=>createRequestContinuationLedger({ledger,binding,continuation:{...continuation,...patch}}),TypeError)
})
for(const patch of [{ledger:null},{ledger:{loadPolicy:()=>{}}},{binding:{...binding,service:{}}},{now:0},{continuation:null}])test('refuse alternate continuation authority '+JSON.stringify(patch),()=>{
 assert.throws(()=>createRequestContinuationLedger({ledger,binding,continuation,...patch}),TypeError)
})
test('non-refresh policy cannot borrow the continuation adapter',async()=>{
 const c=createRequestContinuationLedger({ledger,binding,continuation})
 await assert.rejects(c.loadPolicy(()=>{}, {request:{operation:'forecast.request'}}),e=>e.reasonCode==='PERMISSION_DENIED')
})
