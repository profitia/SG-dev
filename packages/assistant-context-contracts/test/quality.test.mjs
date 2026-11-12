import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readQualityEvidence,readQualityVerdict,readRepairManifest,readReleaseReceipt} from '../src/quality.mjs'

const now=Date.parse('2026-11-12T12:00:00.000Z'),stamp=n=>new Date(n).toISOString(),hash='a'.repeat(64),commit='b'.repeat(40)
const attestation=()=>({keyId:'synthetic-fixture-untrusted-key',signature:'x'.repeat(86)})
// These fixtures prove parsing only. No signer, account, grant or provider exists.
const evidence=()=>({schemaVersion:'QA_EVIDENCE_V1',evidenceId:randomUUID(),interactionId:randomUUID(),accountId:randomUUID(),applicationId:'spendguru',environment:'development',
 occurredAt:stamp(now-1000),earliestInputAt:stamp(now-2000),timeZone:'Europe/Warsaw',interpretedPeriod:{from:'2026-11-15T23:00:00.000Z',to:'2026-11-22T22:59:59.999Z',weekStartsOn:'MONDAY'},
 purpose:{id:'ASSISTANT_QUALITY',policyVersion:'1.0.0',grantId:randomUUID(),validUntil:stamp(now+86400000)},
 versions:{applicationSha:commit,model:'test-model-not-a-live-selection',promptSha256:hash,modelConfigurationSha256:hash,cicVersion:'1.8.0',gatewayVersion:'2.2.0'},
 sourceScopes:[{source:'ECONOMIC_CALENDAR',organisationId:randomUUID(),classification:'SHARED_KNOWLEDGE',sourceVersion:hash,rightsVersion:'fixture-rights-v1',validUntil:stamp(now+3600000),status:'PARTIAL',
  reference:{source:'ECONOMIC_CALENDAR',version:'2.1.0',targetType:null,targetId:null,from:'2026-11-15T23:00:00.000Z',to:'2026-11-22T22:59:59.999Z',asKnownAt:null,after:null}}],
 modelInput:[{role:'developer',content:'Synthetic instructions'},{role:'user',content:'Synthetic question'}],output:{draft:'Synthetic draft',delivered:'Synthetic verified facts',status:'COMPLETE'},expiresAt:stamp(now+3600000)})
const verdict=()=>({schemaVersion:'QUALITY_VERDICT_V1',evidenceId:randomUUID(),rubricVersion:'1.0.0',judgeVersion:'fixture-v1',method:'DETERMINISTIC',result:'FAIL',dimensions:['CONTEXT','LOGIC'],harm:'MAJOR',cause:'APPLICATION_LOGIC',evidencePointers:['/interpretedPeriod/from','/output/draft'],proposedRepairClass:'C1'})
const manifest=()=>({schemaVersion:'REPAIR_MANIFEST_V1',incidentId:randomUUID(),repairClass:'C1',projectKey:'SG2',repository:'profitia/SG-dev',baseSha:commit,allowedPaths:['apps/sg-runtime/lib/assistant/calendar-period.ts'],
 mandate:{id:randomUUID(),version:'1.0.0',sha256:hash,issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),attestation:attestation()},gateSetSha256:hash,
 synthetic:{fixtureId:'qa_synthetic_'+hash,sha256:hash,exportReceiptId:randomUUID()},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId:randomUUID()})
const release=()=>({schemaVersion:'RELEASE_RECEIPT_V1',incidentId:randomUUID(),repairClass:'C1',projectKey:'SG2',repository:'profitia/SG-dev',baseSha:'c'.repeat(40),sourceSha:commit,artifactSha256:hash,
 verification:{runId:'123',commitSha:commit,gateSetSha256:hash,holdoutSha256:hash,result:'PASS'},lastKnownGood:{sourceSha:'c'.repeat(40),artifactSha256:hash,configurationSha256:hash,deployId:'fixture-lkg'},
 deployment:{environment:'development',serviceId:'fixture-service',deployId:'fixture-deploy',sourceSha:commit,configurationSha256:hash},acceptance:{runId:'fixture-readback',result:'PASS',observedAt:stamp(now-1000)},state:'CLOSED',
 rollback:{decisionAt:null,completedAt:null,sourceSha:null,deployId:null,verificationRunId:null},attestation:attestation()})

test('QA envelopes preserve private account/per-source organisation scope and freeze a detached copy',()=>{
 const v=evidence(),r=readQualityEvidence(v,{now});assert.notEqual(r,v);assert.equal(r.accountId,v.accountId);assert.equal(r.sourceScopes[0].organisationId,v.sourceScopes[0].organisationId)
 assert(Object.isFrozen(r)&&Object.isFrozen(r.modelInput)&&Object.isFrozen(r.sourceScopes[0].reference));v.modelInput[0].content='changed';assert.notEqual(r.modelInput[0].content,'changed')
 for(const key of ['organisationId','allow','headers','apiKey','chainOfThought'])assert.throws(()=>readQualityEvidence({...evidence(),[key]:'must-not-acquire-authority'},{now}))
 assert.throws(()=>readQualityEvidence(evidence()))
})
test('QA expiry is bounded by original input, interaction, purpose and each source; retry cannot extend it',()=>{
 for(const change of [v=>v.expiresAt=stamp(now),v=>v.expiresAt=stamp(now+3600001),v=>v.earliestInputAt=stamp(now-7*86400000),
  v=>v.purpose.validUntil=stamp(now-1),v=>v.sourceScopes[0].validUntil=stamp(now-1),v=>v.occurredAt=stamp(now+1),v=>v.earliestInputAt=stamp(now+1)]){
  const v=evidence();change(v);assert.throws(()=>readQualityEvidence(v,{now}))
 }
 const v=evidence();v.sourceScopes=[];v.purpose.validUntil=stamp(now+8*86400000);v.expiresAt=stamp(now+7*86400000);assert.throws(()=>readQualityEvidence(v,{now}))
})
test('QA invalid versions, zones, context references, extra source grants and oversized input fail closed',()=>{
 for(const change of [v=>v.schemaVersion='QA_EVIDENCE_V2',v=>v.timeZone='Missing/Zone',v=>v.environment='production',v=>v.sourceScopes[0].reference.allow=true,
  v=>v.sourceScopes[0].organisationId='*',v=>v.sourceScopes[0].source='NEWSFEED',v=>v.sourceScopes.push(structuredClone(v.sourceScopes[0])),
  v=>v.modelInput[0].content='x'.repeat(32768),v=>v.output.headers={Authorization:'must-not-persist'},v=>v.interpretedPeriod.to='2026-02-30T00:00:00.000Z']){
  const v=evidence();change(v);assert.throws(()=>readQualityEvidence(v,{now}))
 }
})
test('Parser refuses getters, array accessors, symbols and prototypes without executing them',()=>{
 let calls=0;const a=evidence();Object.defineProperty(a,'accountId',{get(){calls++;return randomUUID()},enumerable:true});assert.throws(()=>readQualityEvidence(a,{now}))
 const b=evidence();Object.defineProperty(b.modelInput,0,{get(){calls++;return {role:'user',content:'bad'}},enumerable:true});assert.throws(()=>readQualityEvidence(b,{now}))
 const c=evidence();c[Symbol('allow')]=true;assert.throws(()=>readQualityEvidence(c,{now}))
 const d=evidence();Object.setPrototypeOf(d,{allow:true});assert.throws(()=>readQualityEvidence(d,{now}));assert.equal(calls,0)
})
test('Semantic verdict remains explicitly advisory; unknown does not become a repair qualification',()=>{
 assert.equal(readQualityVerdict({...verdict(),method:'SEMANTIC_ADVISORY'}).method,'SEMANTIC_ADVISORY')
 assert.equal(readQualityVerdict({...verdict(),result:'INSUFFICIENT_EVIDENCE',cause:'UNKNOWN',proposedRepairClass:null}).result,'INSUFFICIENT_EVIDENCE')
 for(const change of [v=>v.qualified=true,v=>v.evidencePointers=[],v=>v.proposedRepairClass='FINANCIAL',v=>v.result='UNKNOWN',v=>{v.result='INSUFFICIENT_EVIDENCE'},v=>v.evidencePointers=['https://untrusted.test/command']]){
  const v=verdict();change(v);assert.throws(()=>readQualityVerdict(v))
 }
 assert.equal(readQualityVerdict({...verdict(),result:'PASS',harm:'NONE',cause:null,proposedRepairClass:null}).result,'PASS')
})
test('Repair dispatch carries immutable synthetic references and fixed bounds; no transcript or permission claims',()=>{
 const r=readRepairManifest(manifest(),{now});assert.equal(r.limits.maxIncidentMicroUsd,5000000);assert(Object.isFrozen(r.mandate.attestation))
 for(const change of [v=>v.transcript='private',v=>v.synthetic.url='https://private.test',v=>v.mandate.expiresAt=stamp(now),v=>v.repository='foreign/repo',
  v=>v.limits.maxAttempts=3,v=>v.limits.maxAttemptSeconds=1801,v=>v.limits.maxIncidentMicroUsd=5000001,v=>v.mandate.attestation.signature='unsigned']){
  const v=manifest();change(v);assert.throws(()=>readRepairManifest(v,{now}))
 }
 for(const p of ['/tmp/patch','apps/sg-runtime/../secret','apps/sg-runtime/**','apps/sg-runtime/a\\b','Canon/policy.md','.github/workflows/release.yml','packages/assistant-quality-control/src/controller.mjs','apps/sg-runtime/package.json','apps/sg-runtime/tests/security.test.ts']){
  assert.throws(()=>readRepairManifest({...manifest(),allowedPaths:[p]},{now}))
 }
})
test('Release receipt binds independent test, deployed source, Development, LKG and verified rollback metadata',()=>{
 assert.equal(readReleaseReceipt(release(),{now}).state,'CLOSED')
 for(const change of [v=>v.acceptance.result='FAIL',v=>v.deployment.environment='production',v=>v.verification.commitSha='d'.repeat(40),v=>v.deployment.sourceSha='d'.repeat(40),
  v=>v.lastKnownGood=null,v=>v.attestation=null,v=>v.rollback.sourceSha='d'.repeat(40)]){
  const v=release();change(v);assert.throws(()=>readReleaseReceipt(v,{now}))
 }
 const v=release();v.state='ROLLED_BACK';v.acceptance.result='FAIL';v.rollback={decisionAt:stamp(now-60000),completedAt:stamp(now-1000),sourceSha:v.lastKnownGood.sourceSha,deployId:'fixture-restored-deploy',verificationRunId:'fixture-restored-readback'}
 assert.equal(readReleaseReceipt(v,{now}).state,'ROLLED_BACK');v.rollback.sourceSha='e'.repeat(40);assert.throws(()=>readReleaseReceipt(v,{now}))
})
