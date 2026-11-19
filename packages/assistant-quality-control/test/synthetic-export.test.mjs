import assert from 'node:assert/strict'
import test from 'node:test'
import {generateKeyPairSync,randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {ownerMandateBody} from '../src/cli.mjs'
import {signDocument,verifyDocument,documentDigest,publicKeyId} from '../src/manifest.mjs'
import {prepareQualityControllerJobContext} from '../src/job-context.mjs'
import {QUALITY_TECHNICAL_SYNTHETIC_CASES,createQualityTechnicalContextExports,
 readQualityNativeContextExportEnvironment,runQualityNativeContextExport} from '../src/job-runtime.mjs'

const origin=Date.parse('2026-11-19T12:00:00.000Z'),stamp=n=>new Date(n).toISOString(),gate='b'.repeat(64)
function fixture(change={}){
 const owner=generateKeyPairSync('ed25519'),verifier=generateKeyPairSync('ed25519')
 const ownerKeys=new Map([[publicKeyId(owner.publicKey),owner.publicKey]])
 const verifierKeys=new Map([[publicKeyId(verifier.publicKey),verifier.publicKey]])
 const body={...ownerMandateBody({id:randomUUID(),issuedAt:stamp(origin-1000),expiresAt:stamp(origin+599000),
  targetServiceId:'srv-dapa3tid0e5s73f8bc5g',gateSetSha256:gate}),...change}
 const request=JSON.stringify({schemaVersion:'AQC_CONTROLLED_JOB_CONTEXTS_V1',repository:'profitia/SG-dev',
  environment:'development',mandate:signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey),fixtures:[]})
 return {owner,verifier,body,request,ownerKeys,verifierKeys,options:{request,ownerKeys,verifierKeys,
  privateKey:verifier.privateKey,gateSetSha256:gate,now:origin}}
}
test('fixed synthetic exports reconstruct the existing independently bound three-class context contract',async()=>{
 const f=fixture(),bundle=createQualityTechnicalContextExports(f.options)
 assert.deepEqual(bundle.exports.map(d=>d.body.repairClass),['C1','C2','C3'])
 assert.equal(new Set(bundle.exports.map(d=>d.body.incidentId)).size,3)
 assert.equal(new Set(bundle.exports.map(d=>d.body.id)).size,3)
 assert.equal(new Set(QUALITY_TECHNICAL_SYNTHETIC_CASES.map(c=>c.locale)).size,2)
 const registry={...JSON.parse(f.request),fixtures:bundle.exports.map((fixtureExport,i)=>({
  fixtureExport,regression:QUALITY_TECHNICAL_SYNTHETIC_CASES[i]}))}
 for(const document of bundle.exports){
  const body=verifyDocument(document,{kind:'AQC_SYNTHETIC_EXPORT_V1',trustedKeys:f.verifierKeys})
  const value=await prepareQualityControllerJobContext({registry,incidentId:body.incidentId,baseSha:'a'.repeat(40),
   ownerKeys:f.ownerKeys,verifierKeys:f.verifierKeys,expectedServiceId:'srv-dapa3tid0e5s73f8bc5g',
   expectedGateSetSha256:gate,now:origin})
  assert.equal(value.manifest.repairClass,body.repairClass)
  assert.equal(documentDigest(value.regression),body.sha256)
  assert.equal(value.manifest.synthetic.fixtureId,body.fixtureId)
  assert.equal(body.scope,'CONTROLLED_ACCEPTANCE')
  assert.equal(body.rawQaPayloadIncluded,false)
  assert.equal(Object.hasOwn(document.body,'args'),false)
  assert.equal(Object.hasOwn(document.body,'expected'),false)
 }
 assert.equal(Object.isFrozen(QUALITY_TECHNICAL_SYNTHETIC_CASES[0].args[0]),true)
 assert.equal(Object.isFrozen(bundle.exports),true)
})
test('same mandate cannot create new synthetic incidents or extend original authority on repeated export',()=>{
 const f=fixture(),first=createQualityTechnicalContextExports(f.options)
 const later=createQualityTechnicalContextExports({...f.options,now:origin+50000})
 assert.deepEqual(later.exports.map(d=>d.body.incidentId),first.exports.map(d=>d.body.incidentId))
 assert.deepEqual(later.exports.map(d=>d.body.id),first.exports.map(d=>d.body.id))
 for(const d of later.exports)assert.equal(d.body.expiresAt,f.body.expiresAt)
 assert.throws(()=>createQualityTechnicalContextExports({...f.options,now:Date.parse(f.body.expiresAt)}),{code:'MANDATE_EXPIRED'})
})
test('export enforces original one-hour horizon and final owner-approved cutoff',()=>{
 const valid=fixture({issuedAt:stamp(origin),expiresAt:stamp(origin+3600000)})
 assert.equal(createQualityTechnicalContextExports(valid.options).exports.length,3)
 const tooLong=fixture({issuedAt:stamp(origin),expiresAt:stamp(origin+3600001)})
 assert.throws(()=>createQualityTechnicalContextExports(tooLong.options),{code:'NATIVE_EXPORT_MANDATE_HORIZON_INVALID'})
 const cutoff=Date.parse('2026-11-27T23:59:59.000Z')
 const tooLate=fixture({issuedAt:stamp(cutoff-60000),expiresAt:stamp(cutoff+1)})
 assert.throws(()=>createQualityTechnicalContextExports({...tooLate.options,now:cutoff-30000}),
  {code:'NATIVE_EXPORT_MANDATE_HORIZON_INVALID'})
 for(const change of [{targetServiceId:'srv-foreign'}, {gateSetSha256:'c'.repeat(64)},
  {classes:['C1']}, {controlledFixtureOnly:false}, {maxPilotMicroUsd:50000001}])
  assert.throws(()=>createQualityTechnicalContextExports(fixture(change).options))
})
test('export rejects replacement cases completed registries extra fields and untrusted signatures',()=>{
 const f=fixture()
 for(const mutate of [
  r=>{r.fixtures=[{fixtureExport:{},regression:QUALITY_TECHNICAL_SYNTHETIC_CASES[0]}]},
  r=>{r.repository='profitia/foreign'},r=>{r.environment='production'},r=>{r.extraFixture={}},
  r=>{r.mandate.body.maxAttempts=3}
 ]){
  const r=JSON.parse(f.request);mutate(r)
  assert.throws(()=>createQualityTechnicalContextExports({...f.options,request:JSON.stringify(r)}))
 }
 assert.throws(()=>createQualityTechnicalContextExports({...f.options,fixture:{args:['replacement']}}),
  {code:'NATIVE_EXPORT_CONFIGURATION_INVALID'})
 assert.throws(()=>createQualityTechnicalContextExports({...f.options,now:()=>origin}),
  {code:'NATIVE_EXPORT_CONFIGURATION_INVALID'})
})
test('only disjoint installed verifier key can export and option accessors never run',()=>{
 const f=fixture(),stranger=generateKeyPairSync('ed25519')
 assert.throws(()=>createQualityTechnicalContextExports({...f.options,privateKey:stranger.privateKey}),
  {code:'NATIVE_EXPORT_SIGNER_REQUIRED'})
 assert.throws(()=>createQualityTechnicalContextExports({...f.options,ownerKeys:f.verifierKeys}),
  {code:'NATIVE_EXPORT_SEPARATE_TRUST_REQUIRED'})
 let calls=0
 const value={...f.options};Object.defineProperty(value,'request',{enumerable:true,get(){calls++;return f.request}})
 assert.throws(()=>createQualityTechnicalContextExports(value),{code:'NATIVE_EXPORT_CONFIGURATION_INVALID'})
 assert.equal(calls,0)
})
const inputs=()=>({mode:'context-export',nonce:randomUUID(),control_source_sha:'a'.repeat(40)})
const env=()=>({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',
 GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'profitia/SG-dev',GITHUB_REF:'refs/heads/main',
 GITHUB_ACTOR:'profitia',GITHUB_TRIGGERING_ACTOR:'profitia',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',
 GITHUB_WORKFLOW_REF:'profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main',
 GITHUB_SHA:'a'.repeat(40),TARGET_ENVIRONMENT:'development',AQC_PAID_REPAIRS_ENABLED:'false',
 AQC_PROMOTION_ENABLED:'false',GITHUB_TOKEN:'INERT_PUBLIC_TEST_SENTINEL',AQC_CONTROLLER_WORKFLOW_SHA256:'c'.repeat(64)})
test('native export admits only real fixed main metadata and no mutable fixture or paid credential input',()=>{
 assert.equal(readQualityNativeContextExportEnvironment(env(),{...inputs(),action:'',base_sha:''}).role,'INDEPENDENT_VERIFIER')
 for(const [k,v]of Object.entries({GITHUB_ACTOR:'foreign',GITHUB_REF:'refs/heads/repair',GITHUB_RUN_ATTEMPT:'2',
  GITHUB_SHA:'f'.repeat(40),GITHUB_EVENT_NAME:'pull_request',RUNNER_ENVIRONMENT:'self-hosted'}))
  assert.throws(()=>readQualityNativeContextExportEnvironment({...env(),[k]:v},inputs()),{code:'NATIVE_JOB_NATIVE_INVOCATION_REQUIRED'})
 for(const k of ['AQC_PAID_REPAIRS_ENABLED','AQC_PROMOTION_ENABLED'])
  assert.throws(()=>readQualityNativeContextExportEnvironment({...env(),[k]:'true'},inputs()),{code:'NATIVE_JOB_FLAGS_INVALID'})
 for(const k of ['OPENAI_API_KEY','NPM_TOKEN','AQC_QA_EVIDENCE_DATABASE_URL','AQC_HOLDOUT_PACK_JSON',
  'AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY','AQC_OWNER_PRIVATE_KEY','AQC_RUNTIME_OBSERVER_PRIVATE_KEY','AQC_LIMITS_BROKER_COMMAND_KEY'])
  assert.throws(()=>readQualityNativeContextExportEnvironment({...env(),[k]:'INERT_FORBIDDEN_SENTINEL'},inputs()),{code:'NATIVE_JOB_SECRET_SCOPE_REJECTED'})
 for(const change of [{action:'QUALIFY'},{base_sha:'f'.repeat(40)},{state:'payload'},{fixture:'payload'},{mode:'controller-job'}])
  assert.throws(()=>readQualityNativeContextExportEnvironment(env(),{...inputs(),...change}),{code:'NATIVE_EXPORT_INPUTS_INVALID'})
 let calls=0
 const value=inputs();Object.defineProperty(value,'nonce',{enumerable:true,get(){calls++;return randomUUID()}})
 assert.throws(()=>readQualityNativeContextExportEnvironment(env(),value),{code:'NATIVE_JOB_ACCESSORS_FORBIDDEN'})
 assert.equal(calls,0)
})
test('closed native export entry rejects caller result clock environment and network ports before I/O',async()=>{
 for(const option of [{},{environment:env()},{now:()=>origin},{fetch:()=>{}},
  {privateKey:generateKeyPairSync('ed25519').privateKey},{exports:[]}])
  await assert.rejects(runQualityNativeContextExport(option),{code:'NATIVE_JOB_INPUTS_FORBIDDEN'})
})
test('native exporter uses only its verifier signer main-only environment and public metadata artifact',()=>{
 const workflow=readFileSync(new URL('../../../.github/workflows/assistant-quality-repair.yml',import.meta.url),'utf8')
 const job=workflow.slice(workflow.indexOf('\n  native_context_export:\n'))
 assert(job.includes('environment: aqc-verifier-development'))
 assert(job.includes("inputs.mode == 'context-export'"))
 assert(job.includes("github.ref == 'refs/heads/main'"))
 assert(job.includes("github.run_attempt == 1"))
 assert(job.includes('contents: read')&&job.includes('actions: read'))
 const secrets=[...job.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(m=>m[1])
 assert.deepEqual(secrets,['AQC_INDEPENDENT_VERIFIER_PRIVATE_KEY'])
 for(const forbidden of ['NPM_TOKEN','OPENAI_API_KEY','HOLDOUT','QA_EVIDENCE','DATABASE_URL',
  'pull-requests:','checks: write','contents: write','AQC_OWNER_PRIVATE','controller-job'])
  assert.equal(job.includes(forbidden),false,forbidden)
 assert(job.includes('/tmp/aqc-synthetic-exports.json'))
 assert(job.includes('job-runtime.mjs context-export'))
})
