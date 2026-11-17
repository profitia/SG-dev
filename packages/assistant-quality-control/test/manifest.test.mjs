import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,randomUUID} from 'node:crypto'
import {SOURCE_PATHS,documentDigest,publicKeyId,signDocument,verifyDocument,verifyExecutionMandate,verifyBoundManifest} from '../src/manifest.mjs'

const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519'),outsider=generateKeyPairSync('ed25519')
const keys=k=>new Map([[publicKeyId(k.privateKey),k.publicKey]])
const now=Date.parse('2026-11-12T12:00:00.000Z'),stamp=n=>new Date(n).toISOString(),hash='a'.repeat(64),sha='b'.repeat(40)
function fixture(repairClass='C1'){
 const body={id:randomUUID(),version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',issuedAt:stamp(now-1000),expiresAt:stamp(now+86400000),projectKey:'SG2',repository:'profitia/SG-dev',targetServiceId:'srv-fixture',classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256:hash,controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey),id=randomUUID(),exportId=randomUUID()
 const manifest={schemaVersion:'REPAIR_MANIFEST_V1',incidentId:id,repairClass,projectKey:'SG2',repository:'profitia/SG-dev',baseSha:sha,
  allowedPaths:[SOURCE_PATHS[repairClass],`apps/sg-runtime/tests/assistant-quality-regressions/${id}.test.ts`],
  mandate:{id:body.id,version:body.version,sha256:documentDigest(body),issuedAt:body.issuedAt,expiresAt:body.expiresAt,attestation:mandate.attestation},gateSetSha256:hash,
  synthetic:{fixtureId:'qa_synthetic_'+hash,sha256:hash,exportReceiptId:exportId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId:randomUUID()}
 const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:exportId,fixtureId:manifest.synthetic.fixtureId,sha256:hash,scope:'CONTROLLED_ACCEPTANCE',incidentId:id,repairClass,issuedAt:body.issuedAt,expiresAt:body.expiresAt,rawQaPayloadIncluded:false},reviewer.privateKey)
 return {body,manifest,mandate,fixtureExport,options:{mandate,fixtureExport,ownerKeys:keys(owner),verifierKeys:keys(reviewer),now,expectedBaseSha:sha,expectedServiceId:'srv-fixture',expectedGateSetSha256:hash}}
}
test('Signatures bind kind/body and an installed key, never an artifact-supplied signer',()=>{
 const d=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:randomUUID()},reviewer.privateKey)
 assert(Object.isFrozen(verifyDocument(d,{kind:d.kind,trustedKeys:keys(reviewer)})))
 for(const options of [{kind:d.kind,trustedKeys:new Map()},{kind:d.kind,trustedKeys:keys(outsider)},{kind:'AQC_EXECUTION_MANDATE_V1',trustedKeys:keys(reviewer)}])assert.throws(()=>verifyDocument(d,options))
 const changed=structuredClone(d);changed.body.id=randomUUID();assert.throws(()=>verifyDocument(changed,{kind:d.kind,trustedKeys:keys(reviewer)}))
 const injected=structuredClone(d);injected.publicKey=outsider.publicKey.export({format:'pem',type:'spki'});assert.throws(()=>verifyDocument(injected,{kind:d.kind,trustedKeys:keys(reviewer)}))
})
test('Mandate binds exact Stage1 Development bounds and target; a valid signature cannot widen v1',()=>{
 const f=fixture();assert.equal(verifyExecutionMandate(f.mandate,{...f.options}).stage,'E1')
 for(const change of [b=>b.environment='production',b=>b.stage='E2',b=>b.targetServiceId='srv-other',b=>b.maxAttempts=3,b=>b.maxPilotMicroUsd=50000001,
  b=>b.controlledFixtureOnly=false,b=>b.minimumHoldoutCases=199,b=>b.sourcePaths={...SOURCE_PATHS,C1:'apps/sg-runtime/lib/assistant/model.ts'},b=>b.expiresAt=stamp(now)]){
  const b=structuredClone(f.body);change(b);const d=signDocument('AQC_EXECUTION_MANDATE_V1',b,owner.privateKey)
  assert.throws(()=>verifyExecutionMandate(d,{...f.options}))
 }
})
test('C1-C3 dispatch requires owner mandate plus independent synthetic export and the current base',()=>{
 for(const c of ['C1','C2','C3']){const f=fixture(c);assert.equal(verifyBoundManifest(f.manifest,f.options).repairClass,c)}
 const f=fixture();for(const change of [m=>m.baseSha='c'.repeat(40),m=>m.allowedPaths.push('apps/sg-runtime/lib/assistant/model.ts'),
  m=>m.mandate.sha256='d'.repeat(64),m=>m.synthetic.sha256='e'.repeat(64),m=>m.gateSetSha256='f'.repeat(64),m=>m.transcript='private']){
  const m=structuredClone(f.manifest);change(m);assert.throws(()=>verifyBoundManifest(m,f.options))
 }
 assert.throws(()=>verifyBoundManifest(f.manifest,{...f.options,verifierKeys:keys(owner)}))
 const bad=signDocument('AQC_SYNTHETIC_EXPORT_V1',{...f.fixtureExport.body,rawQaPayloadIncluded:true},reviewer.privateKey)
 assert.throws(()=>verifyBoundManifest(f.manifest,{...f.options,fixtureExport:bad}))
})
