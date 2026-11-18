import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {createHash,generateKeyPairSync,randomUUID} from 'node:crypto'
import {SOURCE_PATHS,documentDigest,publicKeyId,signDocument,verifyBoundManifest} from '../src/manifest.mjs'
import {readRegressionSource,serializeRegression,verifyCandidate,prepareQualityVerificationBundle,assertQualityVerificationBundle,createQualityIsolatedCaseRunner} from '../src/verify.mjs'

const owner=generateKeyPairSync('ed25519'),reviewer=generateKeyPairSync('ed25519')
const keys=k=>new Map([[publicKeyId(k.publicKey),k.publicKey]])
const now=Date.parse('2026-11-12T12:00:00.000Z'),stamp=n=>new Date(n).toISOString(),gate='a'.repeat(64),sha='b'.repeat(40)
const regression=(repairClass='C1',n=0)=>({schemaVersion:'AQC_REGRESSION_V1',repairClass,caseFamily:n===0?'repair_family':'holdout_family_'+n,locale:n%2?'pl':'en',args:[n],expected:n?2*n:1,expectedAnswer:true,refusal:{pointer:'',values:[null]}})
function setup({baseSha=sha}={}){
 const repair=regression(),fixtureDigest=documentDigest(repair)
 const body={id:randomUUID(),version:'1.0.0',applicationId:'spendguru',environment:'development',stage:'E1',issuedAt:stamp(now-1000),expiresAt:stamp(now+86400000),projectKey:'SG2',repository:'profitia/SG-dev',targetServiceId:'srv-fixture',classes:['C1','C2','C3'],sourcePaths:SOURCE_PATHS,gateSetSha256:gate,controlledFixtureOnly:true,maxActiveExecutorsPerRepository:1,maxNewRepairReleasesPer24h:1,maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000,maxPilotMicroUsd:50000000,maxPilotDays:14,minimumHoldoutCases:200,criticalRegressionsAllowed:0,maxPatchBytes:32768,maxChangedLines:300}
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey),id=randomUUID(),exportId=randomUUID()
 const manifest={schemaVersion:'REPAIR_MANIFEST_V1',incidentId:id,repairClass:'C1',projectKey:'SG2',repository:'profitia/SG-dev',baseSha,
  allowedPaths:[SOURCE_PATHS.C1,`apps/sg-runtime/tests/assistant-quality-regressions/${id}.test.ts`],
  mandate:{id:body.id,version:body.version,sha256:documentDigest(body),issuedAt:body.issuedAt,expiresAt:body.expiresAt,attestation:mandate.attestation},gateSetSha256:gate,
  synthetic:{fixtureId:'qa_synthetic_'+fixtureDigest,sha256:fixtureDigest,exportReceiptId:exportId},limits:{maxAttempts:2,maxAttemptSeconds:1800,maxIncidentMicroUsd:5000000},correlationId:randomUUID()}
 const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:exportId,fixtureId:manifest.synthetic.fixtureId,sha256:fixtureDigest,scope:'CONTROLLED_ACCEPTANCE',incidentId:id,repairClass:'C1',issuedAt:body.issuedAt,expiresAt:body.expiresAt,rawQaPayloadIncluded:false},reviewer.privateKey)
 const verified=verifyBoundManifest(manifest,{mandate,fixtureExport,ownerKeys:keys(owner),verifierKeys:keys(reviewer),now,expectedBaseSha:baseSha,expectedServiceId:'srv-fixture',expectedGateSetSha256:gate})
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

const hashCase=v=>createHash('sha256').update(v).digest('hex')

function bundleFixture({cic=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-case-bundle-'))
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
 put(SOURCE_PATHS.C1,'export function calendarReference(x:number){return x}\n')
 put(SOURCE_PATHS.C2,(cic?"import {resolveAssistantQualityPolicy} from '@profitia/cic-core'\n":'')+'export function renderGroundedFacts(x:number){return x*2}\nexport function applyQualityPolicy(x:number){return '+(cic?'resolveAssistantQualityPolicy(x)':'x*3')+'}\n')
 put('packages/assistant-context-contracts/src/index.mjs','export const syntheticContract=true\n')
 if(cic)put('apps/sg-runtime/package-lock.json',JSON.stringify({packages:{'node_modules/@profitia/cic-core':{version:'1.8.0',integrity:'sha512-tuun88+cfOHFeCafBw1a8gnExgeDyWBgY7Zd9OPkKk2/Eef0YBP49vzDcXKVpFoCNJGh/CYbeR9B+M2ZXctNsg=='}}}))
 const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 git('init','--quiet');git('add','.');git('-c','user.name=AQC fixture','-c','user.email=aqc@example.invalid','commit','--quiet','-m','Inert verifier unit fixture')
 const {options}=setup({baseSha:git('rev-parse','HEAD')})
 const primary={path:SOURCE_PATHS.C1,beforeSha256:hashCase(options.beforeSource),afterSha256:hashCase(options.afterSource),content:options.afterSource}
 const test={path:options.manifest.allowedPaths.find(p=>p!==SOURCE_PATHS.C1),beforeSha256:null,afterSha256:hashCase(options.regressionSource),content:options.regressionSource}
 const body={schemaVersion:'AQC_PATCH_V1',incidentId:options.manifest.incidentId,baseSha:options.manifest.baseSha,gateSetSha256:gate,manifestSha256:documentDigest(options.manifest),files:[primary,test]}
 const artifact={body,artifactSha256:documentDigest(body)}
 return {root,options,artifact,close:()=>fs.rmSync(root,{recursive:true,force:true})}
}
test('Concrete verifier compiles exact Git objects and bounded patch without loading candidate or mounting labels',async()=>{
 const f=bundleFixture()
 try{
  const b=await prepareQualityVerificationBundle({manifest:f.options.manifest,repositoryRoot:f.root,artifact:f.artifact})
  assert.equal(b.sourceSha256.base,hashCase(f.options.beforeSource));assert.equal(b.sourceSha256.candidate,hashCase(f.options.afterSource))
  assert.match(b.files['base/calendar.mjs'],/return x;/);assert.match(b.files['candidate/calendar.mjs'],/return x \+ 1;/)
  assert.equal(b.files['contracts/index.mjs'],'export const syntheticContract=true\n')
  assert(!Object.keys(b.files).some(p=>p.includes('test')||p.includes('regression')||p.includes('holdout')||p.includes('.git')))
  assert(Object.isFrozen(b)&&Object.isFrozen(b.files)&&Object.isFrozen(b.sourceSha256))
  assert.throws(()=>assertQualityVerificationBundle(structuredClone(b)),{code:'VERIFIED_SOURCE_BUNDLE_REQUIRED'})
  await assert.rejects(createQualityIsolatedCaseRunner({bundle:b,observedGateSetSha256:'f'.repeat(64)}),{code:'GATE_POLICY_CHANGED'})
  const runner=await createQualityIsolatedCaseRunner({bundle:b,observedGateSetSha256:gate})
  await assert.rejects(runner.runCase({version:'candidate',sourceSha256:'f'.repeat(64),repairClass:'C1',args:[0],repeat:0}),{code:'VERIFIER_CASE_BINDING_INVALID'})
  await assert.rejects(runner.runCase({version:'candidate',sourceSha256:b.sourceSha256.candidate,repairClass:'C1',args:[0],repeat:3}),{code:'VERIFIER_CASE_BINDING_INVALID'})
 }finally{f.close()}
})
test('Concrete verifier rejects source/patch substitution, executable regression and missing exact private artifact',async()=>{
 const f=bundleFixture()
 try{
  for(const mode of ['artifactDigest','base','before','path','executable','nonlocal','lineLimit','byteLimit','duplicate']){
   const a=structuredClone(f.artifact)
   if(mode==='artifactDigest')a.artifactSha256='f'.repeat(64)
   if(mode==='base')a.body.baseSha='a'.repeat(40)
   if(mode==='before')a.body.files[0].beforeSha256='f'.repeat(64)
   if(mode==='path')a.body.files[0].path='apps/sg-runtime/other.ts'
   if(mode==='executable')a.body.files[1].content+='process.exit(0)'
   if(mode==='lineLimit')a.body.files[0].content='export function calendarReference(x:number){'+'\n'.repeat(301)+'return x+1}\n'
   if(mode==='byteLimit')a.body.files[0].content='export function calendarReference(x:number){/*'+'x'.repeat(33000)+'*/return x+1}\n'
   if(mode==='duplicate')a.body.files[0].path=a.body.files[1].path
   if(mode==='nonlocal')a.body.files[0].content='export function calendarReference(x:number){return process.env.KEY}\n'
   if(mode!=='artifactDigest'){for(const p of a.body.files)p.afterSha256=hashCase(p.content);a.artifactSha256=documentDigest(a.body)}
   await assert.rejects(prepareQualityVerificationBundle({manifest:f.options.manifest,repositoryRoot:f.root,artifact:a}),undefined,mode)
  }
 }finally{f.close()}
 const c=bundleFixture({cic:true})
 try{
  for(const cicArchive of [undefined,Buffer.from('not the pinned private package')]){
   await assert.rejects(prepareQualityVerificationBundle({manifest:c.options.manifest,repositoryRoot:c.root,artifact:c.artifact,cicArchive}),{code:'VERIFIER_CIC_ARTIFACT_REQUIRED'})
  }
 }finally{c.close()}
})
