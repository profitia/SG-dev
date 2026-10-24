import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createReportAdmissionStore,currentReportAdmission,reportAdmissionEvidence,reportAdmissionSchemaDigest,admittedReportObservation} from '../src/report-admission.mjs'
import {isOperationDenied} from '../src/operation-context.mjs'
const binding={applicationId:'srm',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture_db',role:'fixture_runtime'}
const now=Date.now(),schemaDigest='a'.repeat(64),id=randomUUID(),requestId=randomUUID(),userId=randomUUID(),organisationId=randomUUID()
const secret='b'.repeat(64),secretHash=createHash('sha256').update(secret).digest('hex'),nip='7772776017'
const evidence={id,requestId,nip,schemaDigest,applicationId:'srm',environment:'development',userId,organisationId,payloadDigest:'c'.repeat(64),
 status:'PREPARED',readyUntil:new Date(now+120000).toISOString(),expiresAt:new Date(now+180000).toISOString(),identity:{issuer:'https://fixture.accounts.dev',subject:'fixture-user',version:'1'}}
function fixture(){
 let clock=now,changed={}
 const query=async(sql,args)=>({rows:[sql.includes('runtime_descriptor')?{descriptor:{...binding,schemaVersion:'1.0.0',schemaDigest}}:
  sql.includes('.read(')?{admission:args[0]===id&&args[1]===secretHash?{...evidence,...changed}:null}:
  sql.includes('.bind_job(')?{allowed:args[0]===id&&args[1]===secretHash&&args[2]===requestId}:sql.includes('.start(')?{allowed:true}:{}]})
 const store=createReportAdmissionStore({binding,schemaDigest,now:()=>clock})
 return{query,store,load:()=>store.load(query,`fr1.${id}.${secret}`),advance:()=>{clock=now+180001},change:v=>{changed=v}}
}
test('bounded proof is process-owned and isolated between overlapping admitted reports',async()=>{
 const f=fixture(),proof=await f.load(),request=new Request('https://fixture.test/api/xray/search',{method:'POST'})
 assert.equal(currentReportAdmission(),null);assert.equal(reportAdmissionEvidence(structuredClone(proof)),null)
 await assert.rejects(f.store.run(structuredClone(proof),request,async()=>{}),isOperationDenied)
 await assert.rejects(f.store.run(proof,request,async()=>{}),isOperationDenied)
 await f.store.start(f.query,proof)
 await f.store.run(proof,request,async()=>{
  assert.equal(currentReportAdmission(),proof)
  await f.store.bindJob(f.query,proof,requestId)
  await assert.rejects(f.store.bindJob(f.query,proof,randomUUID()),isOperationDenied)
  const d={jobId:requestId,subjectUserId:userId,organisationId,payloadDigest:evidence.payloadDigest,reportAdmission:evidence}
  const observation=f.store.jobObservation({delegation:d})
  assert.equal(admittedReportObservation(observation),observation);assert.equal(admittedReportObservation(structuredClone(observation)),null)
  await assert.rejects(f.store.run(proof,request,async()=>{}),isOperationDenied)
 })
 assert.equal(currentReportAdmission(),null)
  const foreign=createReportAdmissionStore({binding:{...binding,databaseName:'different_db'},schemaDigest,now:()=>now})
  assert.throws(()=>foreign.actor(proof),isOperationDenied)
 f.advance();await assert.rejects(f.store.run(proof,request,async()=>{}),isOperationDenied)
})
for(const patch of[{applicationId:'other'},{environment:'production'},{schemaDigest:'f'.repeat(64)},{expiresAt:new Date(0).toISOString()},{nip:'invalid'}])test('refuses a changed installation or report '+JSON.stringify(patch),async()=>{
 const f=fixture();f.change(patch);await assert.rejects(f.load(),isOperationDenied)
})
test('malformed, altered and expired browser capabilities grant no actor or account observation',async()=>{
 const f=fixture()
 for(const token of['',JSON.stringify(evidence),`fr1.${id}.${'d'.repeat(64)}`])await assert.rejects(f.store.load(f.query,token),isOperationDenied)
 assert.match(await reportAdmissionSchemaDigest(),/^[a-f0-9]{64}$/)
 assert.throws(()=>f.store.actor({id,requestId,nip}),isOperationDenied)
 assert.throws(()=>f.store.jobObservation({delegation:{reportAdmission:evidence}}),isOperationDenied)
})
