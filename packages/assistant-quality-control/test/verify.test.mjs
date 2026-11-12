import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,randomUUID} from 'node:crypto'
import {SOURCE_PATHS,documentDigest,publicKeyId,signDocument,verifyBoundManifest} from '../src/manifest.mjs'
import {readRegressionSource,serializeRegression,verifyCandidate} from '../src/verify.mjs'

const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519')
const keys=k=>new Map([[publicKeyId(k.publicKey),k.publicKey]])
const now=Date.parse('2026-11-12T12:00:00.000Z'),stamp=n=>new Date(n).toISOString(),gate='a'.repeat(64),sha='b'.repeat(40)
const regression=(repairClass='C1',n=0)=>({schemaVersion:'AQC_REGRESSION_V1',repairClass,caseFamily:n===0?'repair_family':'holdout_family_'+n,locale:n%2?'pl':'en',args:[n],expected:n?2*n:1,expectedAnswer:true,refusal:{pointer:'',values:[null]}})
function setup(){
 const repair=regression(),fixtureDigest=documentDigest(repair)
 const body={id:randomUUID(),version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',issuedAt:stamp(now-1000),expiresAt:stamp(now+86400000),projectKey:'SG2',repository:'profitia/SG-dev',targetServiceId:'srv-fixture',classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256:gate,controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey),id=randomUUID(),exportId=randomUUID()
 const manifest={schemaVersion:'REPAIR_MANIFEST_V1',incidentId:id,repairClass:'C1',projectKey:'SG2',repository:'profitia/SG-dev',baseSha:sha,
  allowedPaths:[SOURCE_PATHS.C1,`apps/sg-runtime/tests/assistant-quality-regressions/${id}.test.ts`],
  mandate:{id:body.id,version:body.version,sha256:documentDigest(body),issuedAt:body.issuedAt,expiresAt:body.expiresAt,attestation:mandate.attestation},gateSetSha256:gate,
  synthetic:{fixtureId:'qa_synthetic_'+fixtureDigest,sha256:fixtureDigest,exportReceiptId:exportId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId:randomUUID()}
 const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:exportId,fixtureId:manifest.synthetic.fixtureId,sha256:fixtureDigest,scope:'CONTROLLED_ACCEPTANCE',incidentId:id,repairClass:'C1',issuedAt:body.issuedAt,expiresAt:body.expiresAt,rawQaPayloadIncluded:false},reviewer.privateKey)
 const verified=verifyBoundManifest(manifest,{mandate,fixtureExport,ownerKeys:keys(owner),verifierKeys:keys(reviewer),now,expectedBaseSha:sha,expectedServiceId:'srv-fixture',expectedGateSetSha256:gate})
 const pack=Array.from({length:200},(_,i)=>({id:documentDigest(i),critical:i<60,fixture:regression(['C1','C2','C3'][i%3],i+1)}))
 const approve=pack=>signDocument('AQC_REFERENCE_PACK_V1',{sha256:documentDigest(pack),gateSetSha256:gate,rubricVersion:'rubric-v1',issuedAt:stamp(now-1000),expiresAt:stamp(now+86400000),repairFamilies:['repair_family'],minimumCases:200,labelSource:'INDEPENDENT_REVIEWED_REFERENCE',split:'HOLDOUT'},reviewer.privateKey)
 const options={manifest:verified,beforeSource:'export function calendarReference(x:number){return x}\n',afterSource:'export function calendarReference(x:number){return x+1}\n',regressionSource:serializeRegression(repair),pack,packAttestation:approve(pack),reviewerKeys:keys(reviewer),gateSetSha256:gate,artifactSha256:'f'.repeat(64),now}
 // A fake execution port tests the proof gate. This is not execution of the
 // calendar, a calibrated holdout, or product quality evidence.
 const runCase=async r=>({status:'COMPLETE',sourceSha256:r.sourceSha256,output:r.args[0]===0?(r.version==='base'?0:1):r.args[0]*2})
 return {options,runCase,approve}
}
test('Regression artifact is inert canonical JSON, never an executable test from the agent',()=>{
 const source=serializeRegression(regression());assert.deepEqual(readRegressionSource(source),regression())
 for(const bad of ['import fs from "node:fs";\n'+source,source+'process.exit(0)',source.replace('export default ','export default (process.env,'),source.replace('"expected": 1','"expected": 1,"expected": 2')])assert.throws(()=>readRegressionSource(bad))
})
test('OFFLINE proof gate independently compares baseline, candidate and paired frozen reference cases',async()=>{
 const {options,runCase}=setup(),r=await verifyCandidate({...options,runCase})
 assert.equal(r.result,'PASS');assert.equal(r.baseTest,'FAIL');assert.equal(r.candidateTest,'PASS');assert.equal(r.holdoutCases,200);assert.equal(r.stable,true)
 assert.equal(r.correctnessDeltaPp,0);assert.equal(r.unjustifiedRefusalDeltaPp,0)
 assert(!JSON.stringify(r).includes('holdout_family'),'proof does not disclose labels or inputs')
})
test('Self-reported PASS, green baseline, source mismatch, critical instability and access violations do not authorise release',async()=>{
 for(const mode of ['unfixed','greenBase','critical','unstable','access','decline','unknown']){
  const {options,runCase}=setup()
  const r=await verifyCandidate({...options,runCase:async input=>{
   const out=await runCase(input),n=input.args[0]
   if(mode==='unfixed'&&n===0)out.output=0
   if(mode==='greenBase'&&n===0)out.output=1
   if(mode==='critical'&&n===1&&input.version==='candidate')out.output=999
   if(mode==='unstable'&&n===1&&input.repeat===2&&input.version==='candidate')out.output=999
   if(mode==='access'&&n===100&&input.version==='candidate')out.accessViolation=true
   if(mode==='unknown'&&n===100&&input.version==='candidate')out.status='FAILED'
   if(mode==='decline'&&n>=100&&n<110&&input.version==='candidate')out.output=null
   return {...out,agentSays:'PASS'}
  }})
  assert.equal(r.result,'FAIL',mode)
 }
 const {options,runCase}=setup()
 await assert.rejects(verifyCandidate({...options,runCase:async input=>({...await runCase(input),sourceSha256:'e'.repeat(64)})}),{code:'EXECUTION_SOURCE_MISMATCH'})
})
test('A forged manifest, modified pack, absent critical coverage or repair-family leakage fails before execution',async()=>{
 const {options,runCase,approve}=setup();let calls=0
 const run=async input=>{calls++;return runCase(input)}
 await assert.rejects(verifyCandidate({...options,manifest:structuredClone(options.manifest),runCase:run}),{code:'VERIFIED_MANIFEST_REQUIRED'})
 const changed=structuredClone(options.pack);changed[0].fixture.expected=123
 await assert.rejects(verifyCandidate({...options,pack:changed,runCase:run}),{code:'REFERENCE_NOT_FROZEN_OR_APPROVED'})
 const noCritical=options.pack.map(p=>({...p,critical:false}))
 await assert.rejects(verifyCandidate({...options,pack:noCritical,packAttestation:approve(noCritical),runCase:run}),{code:'REFERENCE_COVERAGE_INSUFFICIENT'})
 const leak=structuredClone(options.pack);leak[0].fixture.caseFamily='repair_family'
 await assert.rejects(verifyCandidate({...options,pack:leak,packAttestation:approve(leak),runCase:run}),{code:'REFERENCE_FAMILY_LEAK'})
 assert.equal(calls,0)
})
