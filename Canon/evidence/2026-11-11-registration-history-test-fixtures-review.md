# Stage I — exact history-test fixture correction in the same67 paths

Status: PROPOSED / exact decision required. Inert review packet only.
Task ARCH-REGISTRATION-HISTORY-TEST-FIXTURES-PROPOSAL-20261111.

## What this corrects

The owner-approved1024 source successfully validates the complete current graph:
all8 SDK helper and6 recurring source guard cases pass. NativeIdentity401/401,
typecheck/build/lint pass. The full producer now executes2088 cases,2086 pass,
2 fail,0 skipped. A separate SG2 history test has one wrong expected source.

The remaining failures are three test fixtures:

1. apps/architecture-lab/test/sdk-compatibility.test.mjs stores only manifest,
   then calls recurring.previousBytes. Keep the complete authenticated return
   object. A genuinely absent optional layer uses the same existing current
   reader; exceptions are never caught or bypassed.
2. packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs
   has the identical manifest-only fixture error. Retain the complete view.
3. apps/sg-runtime/tests/organisation-sdk-history.test.mjs expects the intermediate
   SDK predecessor0775. Its M2 API deliberately validates the physical current
   installation and returns the exact older M2 sourcec3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f.
   Compare against that actual immutable contract. Keep the installed-byte
   tampering rejection unchanged.

No assertion is removed, no expected digest is replaced with an actual value,
and no reader is substituted to turn the failing unchanged tests green.

Independent read-only audits using the already-approved APIs confirmed:
SDK1.34 and all exact peer manifests;3 original FRESH producer hashes; both
installed M2 file outputs against actual immutablec3b399b; all27 SDK integration
hashes and26 schedule source hashes. These audits do not replace required tests.
All3 corrections remain unexecuted as a new source set before the exact decision.

## Scope retained

The same67 paths/owners/statuses/modes remain:36 Architecture,17 SG2,14 SRM.
61 source blobs are identical to1024. Six exact versions change: the3 fixtures,
data-only source record, helper's exact-record recognition and a regression
authenticating the complete immutable oldffe record. No new path or component.

The data record differs only in the three fixture hash entries. All165 producer
sources still match actual immutable5a963; all application/SDK production bytes,
48 SDK/3 optional fingerprints,21 old guard hashes,13 supplemental source pins,
receipts, defaultRoot16 and optional21/22 isolation are unchanged.

The helper accepts one additional exact record hash and applies the identical
complete-source checks to it andffe. No parser/schema/guard rule, current source
scope, predecessor, permission or credential boundary changes. Oldffe and every
020/25fea/ccf record remain accepted through their actual immutable source graph.

The source review contains exact sourceRecord and additionalSourceTexts.
Record encoding is JSON.stringify(sourceRecord,null,2) followed by one newline;
additional source strings are exact UTF-8. Existing1024 shared guard/module
and its test are unchanged. The new legacy regression reads actual approved
09cf78d48c85986e4973f13007e32638bf040a2f Git history, not reconstructed fixtures.

## Trusted policy and independent ongoing work

Approved1024 policy is preserved in [PR1025](https://github.com/profitia/SG-dev/pull/1025),
head18e0093527c1993aa87de984ecfc24983c16e6cb. Local controller218/218 and
governance/routing/coverage/PK55/55 pass. Static AST comparison preserved156
unrelated prior declarations and all current ECR week code/tests unchanged.

GitHub controlled43097221480 failed before creating any jobs with an internal
startup error, request5d8afc7b-de10-11f1-8eb4-4d427f4e14fa. A same-run retry and
fresh exact-input dispatch are being checked. This is not a source test result;
there is no protected proof and no CI gate is waived. Public/governance/current
main checks and policy/source acceptance remain mandatory.

The inert successor patch retains the entire1024 full67 review andffe provenance,
both earlier65 reviews and every41/48/59/1012/recurring119/123/124 admission.
Its active same67 review binds this exact fixture/data successor. Current
metadata, all21 actual historical guard checks and physical graph validation
remain unchanged. Tests cover both complete67 maps and both old65 maps,
mixed/forged/native/recurring cases and the precise fixture hashes.

## Exact frozen material

[Full review/data/additional source texts](../proposals/registration-history-test-fixtures-20261111/source-review.json),
[helper text](../proposals/registration-history-test-fixtures-20261111/organisation-sdk-compatibility.mjs.txt),
[helper regression text](../proposals/registration-history-test-fixtures-20261111/organisation-sdk-compatibility.test.mjs.txt),
[trusted policy patch](../proposals/registration-history-test-fixtures-20261111/controller-amendment.patch).

Prepared source a791b5f03abdee49c54c03215f8902f39bda1cdf; tree 56875b9cd82555b756a29a4398f4fe874025f2e4; base 4c8f2d98cdb42cde8b8de4d77af5aeef64b025ae.

Exact67 map SHA256 5f69b16e205887419c6662dcd6e407bac622d369ac50204a26b78783c7c4fa92.
New exact record SHA256 b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a.
Trusted policy patch SHA256 65829336069c98f634da2fad6991e74b8b517d23e2e12faf974fec993e595d91.

- apps/architecture-lab/test/sdk-compatibility.test.mjs: Git blob 44f4b10b5a7aae6e9488fbe93471ba8f2a13404a; SHA256 0f1251d1379c5dea23904bbacee89af36393dd100fa75642795158dc10d13d5b.
- packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs: Git blob f3a7fd2b1867f2126e9c9ab633b63c7c8a2eff16; SHA256 edbb99d5ade23ee483587d19352602ec55353932128b523655ddd76b509fe57e.
- apps/sg-runtime/tests/organisation-sdk-history.test.mjs: Git blob 17589d04860513fe43adf6ce9c8404ce55827f1e; SHA256 3661d42f176f07c377f45fa582cf9baab844d9924a2cccd2dc64a8d871827eed.
- packages/platform-contracts/test/organisation-sdk-compatibility.json: Git blob 12e90a641f7c7dde6efa0be9be3d7e41eae27fb4; SHA256 b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a.
- packages/platform-contracts/test/organisation-sdk-compatibility.mjs: Git blob e8443e149ea2e7d09bbb2e21b3e8eab88dad8fd9; SHA256 e67c6f5302e4fa05e97d9f381d9ad343edb1ff4eb2b7db9d75a9a6930fe2e8c4.
- packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs: Git blob b8c80258bb25722ae33d963343f3beaa8ffe7d8b; SHA256 eafcdbd7a98ee08f0a6e13477d1856d54a924fb48ca6e264f0b05ce3c9241e30.

Static validation: same67 exact path/status/mode/owner bindings,61 unchanged
versions; only3 source-record hash fields differ; unchanged165 current/immutable
producer bytes,21 actual historical guards and all fingerprints/receipts;
syntax-only parsing and patch applicability. The new helper/record/controller/
regression has not been imported, evaluated or executed before decision.

The precise future source is prepared as a Git object, not published as an
executable candidate. All durable evidence is GitHub and canonical PMOS/PHR.

## Required next steps after decision

1. Finish approved policy acceptance with exact protected/public/governance/main
   evidence; preserve the complete1024/ffe review in this bounded successor.
2. Run the new old/new/negative helper and policy tests, exact three fixture
   regressions, full producer+PG16/nativeIdentity and actual SG2/SRM owner suites.
3. Obtain actual-owner SOURCE GO, use existing983 joint transport only with all
   reviewed versions, and require full source/head/resulting-main proof.
4. Continue Stage I native organisation/invitation/package/tenant/UAT work.
   No failing source or unproved policy is accepted as product readiness.

The existing integration procedure and frozen1024 decision bind exact67 versions
and recordffe. These precise new versions/record need their own decision.
This approval does not waive CI or activate product SQL, data/roles/grants/
packages, mail, providers/models, DNS or deployments.

## Exact fixture changes

### apps/architecture-lab/test/sdk-compatibility.test.mjs

```javascript
import {recurringSourcePredecessor} from '../private-recurring-source.mjs'
import {acceptedSdkSource,sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {calendarStoragePredecessor} from '../ecr-stage03-sdk-compatibility.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {assistantSdkPredecessor,ASSISTANT_SDK_PRODUCER} from '../assistant-m1-sdk-compatibility.mjs'

const root=new URL('../../../',import.meta.url)
const receipt=JSON.parse(fs.readFileSync(new URL('../sdk-1.33-compatibility.json',import.meta.url)))
const next=JSON.parse(fs.readFileSync(new URL('../sdk-1.34-compatibility.json',import.meta.url)))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const physicalSource=file=>fs.readFileSync(new URL(file,root))
const historicalSource=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
const bootstrapSource=sdkContinuationPredecessor(JSON.parse(physicalSource('apps/sg-runtime/operation-integration.json')),physicalSource,historicalSource)
const readSource=bootstrapSource?.previousBytes??physicalSource
const recurring=recurringSourcePredecessor(readSource,historicalSource)??{manifest:null,previousBytes:readSource}

test('assistant optional source closes the real SDK dependency graph and retains the immutable predecessor',async()=>{
 const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
 const {record:a}=assistantSdkPredecessor(readSource,historical)
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(hash(historical(ASSISTANT_SDK_PRODUCER,'packages/platform-contracts/'+p)),h,'producer source '+p)
 for(const [p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(historical(a.compatibilitySourceSha,'packages/platform-contracts/'+p)),h,'compatibility source '+p)
 const remaining=new Set(Object.keys(a.sdkDigests))
 for(const name of fs.readdirSync(new URL('packages/platform-contracts/src/',root)).filter(n=>n.endsWith('.mjs'))){
  const sdk=await import(new URL('packages/platform-contracts/src/'+name,root))
  for(const key of remaining)if(typeof sdk[key]==='function'){assert.equal(await sdk[key](),acceptedSdkSource().sdkDigests[key]??a.sdkDigests[key],key);remaining.delete(key)}
 }
 assert.equal(remaining.size,0)
 for(const target of ['packages/platform-contracts/src/assistant-usage.mjs','packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/package.json','apps/architecture-lab/assistant-m1-sdk-compatibility.json'])assert.throws(()=>assistantSdkPredecessor(p=>p===target?Buffer.concat([readSource(p),Buffer.from('UNREVIEWED')]):readSource(p),historical),target)
})

function assertIntegratedSourceHistory(readCurrent=readSource){
 const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
 readCurrent=calendarStoragePredecessor(readCurrent,historical,(base,head)=>execFileSync('git',['diff','--name-only',base,head],{cwd:root,encoding:'utf8'}).trim().split('\n')).previousBytes
 const previous=assistantSdkPredecessor(readCurrent,(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})).previousBytes
 let schedule=null
 if(JSON.parse(readCurrent('packages/platform-source-hub-contracts/package.json')).version==='1.5.0'){
  const file='apps/platform-source-hub/operations/publication-schedule-source-acceptance.json',bytes=readCurrent(file)
  assert.equal(hash(bytes),'3f9a3de218368152b86cd4c4efebb831f2033256465248dcf320f362d8c0c422','exact accepted schedule continuation')
  schedule=JSON.parse(bytes)
  assert.equal(schedule.predecessorManifestPath,'apps/architecture-lab/sdk-1.34-compatibility.json')
  assert.equal(hash(readCurrent(schedule.predecessorManifestPath)),schedule.predecessorManifestSha256,'immutable SDK1.34 receipt')
  assert.equal(schedule.sourceCandidateSha,'1ed366d9e1fdac87a549dd891d2b7b53abf13b2c')
  assert.equal(schedule.scope,'SOURCEHUB_PRODUCER_ONLY_OPT_IN_SCHEDULE_CONTRACT')
  assert.equal(schedule.consumerRuntimeAdoption,false)
  assert.equal(Object.keys(schedule.sourceFiles).length,26)
  assert.equal(Object.keys(schedule.replacements).length,9)
  for(const [file,digest]of Object.entries(schedule.sourceFiles))assert.equal(hash(readCurrent(file)),digest,'accepted current schedule source '+file)
  for(const [file,replacement]of Object.entries(schedule.replacements)){
   assert.equal(replacement.previousSha256,next.integrationFiles[file],'preserved integrated predecessor '+file)
   assert.equal(replacement.sha256,schedule.sourceFiles[file],'explicit accepted replacement '+file)
  }
 }
 for(const [file,digest]of Object.entries(next.integrationFiles)){
  // The immutable continuation binds the previous fingerprint and all new
  // source bytes. Other SDK1.34 integration files still require exact bytes.
  const expected=schedule?.replacements[file]?.sha256??digest
  assert.equal(hash(previous(file)),expected,'integrated producer '+file)
 }
}

test('SDK1.34 preserves the complete SDK1.33 receipt and explicit optional peer history',()=>{
 assert.equal(hash(fs.readFileSync(new URL('../sdk-1.33-compatibility.json',import.meta.url))),next.previousReceiptSha256)
 assert.equal(next.previousReceiptSourceSha,'3d660eeaf8b6b7ef914a612b8383514f99e857d3')
 assert.equal(next.producerCandidateSha,'ebf017cae09bf7bd9139af7917534b47ae0c4d4b')
 assert.equal(next.taskId,'ARCH-SOURCE-HUB-TE-MARKETS-ACTIVATION-20261106')
 assert.equal(JSON.parse(recurring.previousBytes('packages/platform-contracts/package.json')).version,next.platformVersion)
 assert.equal(next.platformVersion,'1.34.0');assert.equal(next.marketSymbolContractVersion,'1.0.0')
 assert.deepEqual(next.allowedSdkVersions,['1.32.3','1.33.0','1.34.0'])
 assert.deepEqual(receipt.allowedSdkVersions,['1.32.3','1.33.0'])
 for(const [name,record] of Object.entries(receipt.packages)){
  const prefix='packages/platform-contracts/'+name+'/'
  const installed=recurring.previousBytes(prefix+'package.json')
  const current=Buffer.from(installed.toString().replace('"1.32.3 || 1.33.0 || 1.34.0"','"1.32.3 || 1.33.0"'))
  assert.equal(hash(installed),next.packages[name].manifestSha256)
  assert.equal(hash(current),next.packages[name].previousManifestSha256)
  assert.deepEqual(next.packages[name].unchangedSourceDigests,record.unchangedSourceDigests)
  const metadata=JSON.parse(current)
  assert.equal(metadata.peerDependencies['@profitia/platform-contracts'],'1.32.3 || 1.33.0')
  // Reconstruct only the reviewed peer edit; the frozen predecessor hash still
  // detects every other byte change, including in shallow CI checkouts.
  const previous=Buffer.from(current.toString().replace('"1.32.3 || 1.33.0"','"1.32.3"'))
  assert.equal(hash(previous),record.previousManifestSha256)
  assert.equal(hash(current),record.manifestSha256)
  const expected=JSON.parse(previous)
  assert.equal(expected.peerDependencies['@profitia/platform-contracts'],'1.32.3')
  expected.peerDependencies['@profitia/platform-contracts']='1.32.3 || 1.33.0'
  assert.deepEqual(JSON.parse(current),expected,'only the explicit peer range changes')
  for(const [file,digest] of Object.entries(record.unchangedSourceDigests)){
   assert.equal(hash(fs.readFileSync(new URL(prefix+file,root))),digest)
  }
 }
 for(const name of ['apiPathAdopted','schemaChanged','authorizationChanged','deploymentPerformed'])assert.equal(receipt[name],false)
 for(const name of ['marketSymbolAdopted','schemaChanged','authorizationChanged','deploymentPerformed'])assert.equal(next[name],false)
 assert.equal(Object.keys(next.producerFiles).length,27)
 assert.equal(next.integrationBaseMain,'e07521e7417ed6ce5a995a4ff1c708f32a9731a5')
 assertIntegratedSourceHistory()
 // Standalone producer jobs deliberately use shallow source checkouts. Bind
 // the immutable reviewed fingerprint record here; the full-history Canon
 // foundation suite independently checks every original Git blob at its SHA.
 assert.equal(hash(JSON.stringify(Object.entries(next.producerFiles).sort())),'90b10f1c73672ad8c2f3fc44c73206f7be3977184bbc609b131483a1f76397cf')
})

test('schedule continuation rejects changed source, acceptance, predecessor and unreviewed integration bytes',()=>{
 for(const target of ['apps/platform-source-hub/src/providers/eia-schedules.mjs','apps/platform-source-hub/operations/publication-schedule-source-acceptance.json','apps/architecture-lab/sdk-1.34-compatibility.json','packages/platform-contracts/src/external-call.mjs']){
  assert.throws(()=>assertIntegratedSourceHistory(file=>{
   const bytes=readSource(file)
   return file===target?Buffer.concat([bytes,Buffer.from('\nUNACCEPTED_CHANGE')]):bytes
  }),target)
 }
})
```

### packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs

```javascript
import {recurringSourcePredecessor} from '../../../../apps/architecture-lab/private-recurring-source.mjs'
import {acceptedSdkSource,sdkContinuationPredecessor} from '../../test/organisation-sdk-compatibility.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createReadonlyMissReportHost,READONLY_MISS_REPORT_CONTRACT,readonlyMissReportSourceDigest} from '../src/readonly-miss-report.mjs'
import {currentHumanReadSourceDigest,CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read'
import {privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'
import {CURRENT_FRESH_REPORT_CONTRACT,currentFreshReportSourceDigest} from '@profitia/platform-current-fresh-report'

const sourceRoot=new URL('../../../../',import.meta.url),physicalSource=p=>fs.readFileSync(new URL(p,sourceRoot)),historicalSource=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:sourceRoot})
const bootstrapSource=sdkContinuationPredecessor(JSON.parse(physicalSource('apps/sg-runtime/operation-integration.json')),physicalSource,historicalSource)
const recurring=recurringSourcePredecessor(bootstrapSource?.previousBytes??physicalSource,historicalSource)??{manifest:null,previousBytes:bootstrapSource?.previousBytes??physicalSource}

function fixture(){
 const unexpected=async()=>assert.fail('No external call in constructor or rejected input')
 const application={appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:'https://identity.fixture.test',organisationId:null,operations:['supplier.report.read'],features:['supplier_report']}
 const binding={applicationId:'srm',environment:'development',projectId:'isolated',branchId:'isolated',databaseName:'synthetic',role:'synthetic_runtime',schemaDigest:'a'.repeat(64)}
 const module={id:'supplier_report',schemaDigest:'b'.repeat(64),auditSchemaDigest:'c'.repeat(64)}
 const probe={application,binding,module,independentQuery:unexpected,transact:unexpected,readResources:unexpected,projectOutput:unexpected}
 return {probeReadOnly:{statements:['SELECT 1']},clerk:{authenticateRequest:unexpected,sessions:{getSession:unexpected},users:{getUser:unexpected}},
  identity:{appId:'srm',environment:'development',issuer:application.identityIssuer,authorizedParties:['https://srm.fixture.test']},
  receiverBoundary:{publicOrigins:['https://srm.fixture.test'],internalOrigins:['http://127.0.0.1:9999']},
  probe,refresh:{...probe,application:{...application,operations:['supplier.report.refresh']},requestLedger:{schemaDigest:'d'.repeat(64),externalSchemaDigest:'e'.repeat(64)}},read:{...probe}}
}
test('additive producer has an independent fingerprint and preserves existing READY and host digests',async()=>{
 assert.deepEqual(READONLY_MISS_REPORT_CONTRACT,{id:'profitia.readonly-miss-report',version:'1.0.0'})
 assert.deepEqual(CURRENT_HUMAN_READ_CONTRACT,{id:'profitia.current-human-read',version:'1.1.0'})
 const accepted=JSON.parse(fs.readFileSync(new URL('../../../../apps/srm/operation-integration.json',import.meta.url)))
 assert.equal(await currentHumanReadSourceDigest(),acceptedSdkSource().sdkDigests.currentHumanReadSourceDigest)
 assert.equal(await privateOperationHostSourceDigest(),acceptedSdkSource().sdkDigests.privateOperationHostSourceDigest)
 assert.match(await readonlyMissReportSourceDigest(),/^[a-f0-9]{64}$/)
 assert.equal(createReadonlyMissReportHost(fixture()).hostContract,READONLY_MISS_REPORT_CONTRACT)
})
test('accepted current FRESH 1.0 metadata and fingerprint remain unchanged beside the new package',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../../../../apps/srm/operation-integration.json',import.meta.url)))
 const accepted=receipt.freshCurrentBoundaryAdoption
 assert.deepEqual(CURRENT_FRESH_REPORT_CONTRACT,accepted.contract)
 assert.equal(await currentFreshReportSourceDigest(),acceptedSdkSource().optionalPackageDigests.currentFreshReportSourceDigest)
 const metadata=JSON.parse(fs.readFileSync(new URL('../../current-fresh-report/package.json',import.meta.url)))
 assert.equal(metadata.name,'@profitia/platform-current-fresh-report');assert.equal(metadata.version,'1.0.0')
 for(const [name,digest] of Object.entries(accepted.producerSourceDigests)){
  const {createHash}=await import('node:crypto')
  const current=recurring.previousBytes('packages/platform-contracts/current-fresh-report/'+name)
  let preserved=current
  if(name==='package.json'){
   const peer=JSON.parse(current).peerDependencies['@profitia/platform-contracts']
   assert(['1.32.3','1.32.3 || 1.33.0','1.32.3 || 1.33.0 || 1.34.0',...(recurring.manifest?['1.32.3 || 1.33.0 || 1.34.0 || 1.36.0']:[])].includes(peer))
   if(peer!=='1.32.3')preserved=Buffer.from(current.toString().replace(JSON.stringify(peer),'"1.32.3"'))
  }
  assert.equal(createHash('sha256').update(preserved).digest('hex'),digest)
 }
})
test('the public package entry exposes the same implementation to ESM and CommonJS',()=>{
 const sdk=createRequire(new URL('../package.json',import.meta.url))('@profitia/platform-readonly-miss-report')
 assert.equal(sdk.createReadonlyMissReportHost,createReadonlyMissReportHost)
 assert.equal(sdk.READONLY_MISS_REPORT_CONTRACT,READONLY_MISS_REPORT_CONTRACT)
})
test('packed public install uses exactly one SDK 1.34.0 peer with preserved 1.32.3 compatibility, without credentials, scripts or registry',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'fresh-report-public-install-'))
 const artifacts=path.join(temporary,'packages');fs.mkdirSync(artifacts)
 const userconfig=path.join(temporary,'user.npmrc'),globalconfig=path.join(temporary,'global.npmrc')
 fs.writeFileSync(userconfig,'');fs.writeFileSync(globalconfig,'')
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
 const args=['--userconfig',userconfig,'--globalconfig',globalconfig,'--cache',path.join(temporary,'cache'),'--offline','--ignore-scripts','--no-audit','--no-fund']
 const npm=(arguments_,cwd)=>execFileSync('npm',[...arguments_,...args],{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const sdkRoot=fileURLToPath(new URL('../../',import.meta.url)),leafRoot=path.join(sdkRoot,'readonly-miss-report')
 let passed=false
 try{
  const pack=cwd=>path.join(artifacts,JSON.parse(npm(['pack','--json','--pack-destination',artifacts],cwd))[0].filename)
  const sdk=pack(sdkRoot),leaf=pack(leafRoot),classifier=pack(fs.realpathSync(path.join(sdkRoot,'node_modules/ipaddr.js')))
  fs.writeFileSync(path.join(temporary,'package.json'),JSON.stringify({name:'isolated-fresh-public-consumer',version:'1.0.0',private:true,type:'module',
   dependencies:{'@profitia/platform-contracts':'file:'+sdk,'@profitia/platform-readonly-miss-report':'file:'+leaf,'ipaddr.js':'file:'+classifier}}))
  npm(['install','--omit=dev'],temporary)
  const expected=await readonlyMissReportSourceDigest()
  const script=`import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
   import * as fresh from '@profitia/platform-readonly-miss-report';
   import {CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read';
   const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'));
   assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,${JSON.stringify(recurring.manifest?.platformVersion??'1.34.0')});
   assert.equal(CURRENT_HUMAN_READ_CONTRACT.version,'1.1.0');assert.equal(fresh.READONLY_MISS_REPORT_CONTRACT.version,'1.0.0');
   assert.equal(await fresh.readonlyMissReportSourceDigest(),${JSON.stringify(expected)});
   const require=createRequire(import.meta.url),inside=createRequire(import.meta.resolve('@profitia/platform-readonly-miss-report'));
   assert.equal(require('@profitia/platform-readonly-miss-report').createReadonlyMissReportHost,fresh.createReadonlyMissReportHost);
   assert.equal(inside.resolve('@profitia/platform-contracts/operation-context'),require.resolve('@profitia/platform-contracts/operation-context'));
   console.log('PASS: packed ESM/CommonJS export, exact unchanged peer, one SDK copy, matching complete fingerprint');`
  fs.writeFileSync(path.join(temporary,'verify.mjs'),script)
  const output=execFileSync(process.execPath,['verify.mjs'],{cwd:temporary,env,encoding:'utf8'})
  assert.match(output,/PASS: packed ESM\/CommonJS/);passed=true
 }finally{
  if(passed)fs.rmSync(temporary,{recursive:true,force:true})
  else process.stderr.write('Public-install fixture retained: '+temporary+'\n')
 }
})
for(const key of ['clerk','identity','receiverBoundary','probe','refresh','read','now','probeReadOnly'])test('rejects missing/invalid '+key,()=>{
 const f=fixture();f[key]=null;assert.throws(()=>createReadonlyMissReportHost(f),TypeError)
})
for(const key of ['reportAdmission','cache','authenticate','createAuthenticator','readExternalAccount','allow'])test('does not accept another authorization path '+key,()=>{
 assert.throws(()=>createReadonlyMissReportHost({...fixture(),[key]:()=>true}),TypeError)
})
test('new package cannot fall back to the legacy mode when the read-only policy is omitted',()=>{
 const options=fixture();delete options.probeReadOnly
 assert.throws(()=>createReadonlyMissReportHost(options),TypeError)
})
for(const statements of [[],['COMMIT'],[' SELECT 1'],['SELECT 1; COMMIT'],['SELECT 1','SELECT 1'],[()=>true]])test('read-only policy rejects non-closed statements '+String(statements),()=>{
 assert.throws(()=>createReadonlyMissReportHost({...fixture(),probeReadOnly:{statements}}),TypeError)
})
test('read-only adoption requires a separate READY callback before making external calls',async()=>{
 const host=createReadonlyMissReportHost({...fixture(),probeReadOnly:{statements:['SELECT 1']}}),bad=async()=>assert.fail('No external call')
 await assert.rejects(host.execute({request:new Request('https://srm.fixture.test/api/search'),organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null},
 {probe:bad,refresh:bad,work:bad,read:bad}),e=>e.reasonCode==='CONTEXT_INVALID')
})
for(const key of ['probe','refresh','read'])for(const mutation of ['application','store','service','module','operation','authenticator'])test(key+' rejects foreign '+mutation,()=>{
 const f=fixture(),base={...f[key]};f[key]=base
 if(mutation==='application')base.application={...base.application,appId:'foreign'}
 if(mutation==='store')base.binding={...base.binding,databaseName:'foreign'}
 if(mutation==='service')base.binding={...base.binding,service:{}}
 if(mutation==='module')base.module={...base.module,id:'supplier_private'}
 if(mutation==='operation')base.application={...base.application,operations:['supplier.private.read']}
 if(mutation==='authenticator')base.createAuthenticator=()=>async()=>({kind:'HUMAN'})
 assert.throws(()=>createReadonlyMissReportHost(f),TypeError)
})
test('invalid input and reused factory cannot trigger SQL or identity',async()=>{
 const host=createReadonlyMissReportHost(fixture())
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='CONTEXT_INVALID')
 await assert.rejects(host.execute({},{}),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
})
test('abort refuses the opening before authentication or SQL',async()=>{
 const controller=new AbortController();controller.abort()
 const host=createReadonlyMissReportHost(fixture()),bad=async()=>assert.fail('No action')
 await assert.rejects(host.execute({request:new Request('https://srm.fixture.test/api/search',{signal:controller.signal}),
  organisationId:'11111111-1111-4111-8111-111111111111',nip:'5272443955',idempotencyKey:null},
 {probe:bad,ready:bad,refresh:bad,work:bad,read:bad}),e=>e.name==='AbortError')
})
test('public declarations compile positive calls and reject alternate authority and Work output',async()=>{
 const require=createRequire(new URL('../../../../apps/architecture-lab/package.json',import.meta.url)),ts=require('typescript')
 const file=fileURLToPath(new URL('./types/readonly-miss-report.mts',import.meta.url))
 const program=ts.createProgram([file],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']})
 const errors=ts.getPreEmitDiagnostics(program)
 assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}))
})
```

### apps/sg-runtime/tests/organisation-sdk-history.test.mjs

```javascript
// Real paired receipt, immutable Git history and an isolated installed-copy
// fixture. No database, identity or provider I/O.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {assistantSendArrowPredecessor} from './assistant-send-arrow-integrity.mjs'
import {assertAssistantM1Integrity} from './assistant-m1-integrity.mjs'
import {readM2AcceptedSource} from './assistant-m2-source-view.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),current=p=>fs.readFileSync(path.join(root,p)),history=new Map()
const historical=(sha,p)=>{const key=sha+':'+p;if(!history.has(key))history.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','ignore']}));return Buffer.from(history.get(key))}
const receipt=()=>JSON.parse(current('apps/sg-runtime/operation-integration.json')),hash=b=>createHash('sha256').update(b).digest('hex')
test('current SDK is verified before immutable arrow and M1 receipt views are exposed',()=>{
 const r=receipt(),sdk=sdkContinuationPredecessor(r,current,historical)
 assert(sdk);assert.deepEqual(sdk.prior,JSON.parse(historical(sdk.record.previousSourceSha,'apps/sg-runtime/operation-integration.json')))
 const arrow=assistantSendArrowPredecessor(current,historical);assert(arrow)
 assert.doesNotThrow(()=>assertAssistantM1Integrity(r,current,historical))
 const guard='apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs'
 assert.equal(hash(sdk.previousBytes(guard)),hash(historical(sdk.record.previousSourceSha,guard)))
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(sdk.record[flag],false)
})
test('receipt/view alignment cannot discard caller mutations or accept historical SDK bytes as current',()=>{
 const changed=receipt();changed.operations.push('supplier.private.unreviewed')
 assert.throws(()=>assertAssistantM1Integrity(changed,current,historical))
 const sql='packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql'
 assert.throws(()=>assertAssistantM1Integrity(receipt(),p=>p===sql?historical('f8f6340ab1ac862a584352f86988dde199172b37',p):current(p),historical))
 const guard='apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs'
 assert.throws(()=>assistantSendArrowPredecessor(p=>p===guard?Buffer.concat([current(p),Buffer.from('\n')]):current(p),historical))
})
test('installed SDK aliases validate physical current bytes before returning exact historical views',()=>{
 const sdk=sdkContinuationPredecessor(receipt(),current,historical)
 const fixture=path.join(root,'apps/sg-runtime/node_modules/.registration-sdk-view-'+randomUUID()),installed=path.join(fixture,'node_modules/@profitia/platform-contracts')
 try{
  for(const file of ['package.json','src/operation-context.d.mts']){
   const target=path.join(installed,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,current('packages/platform-contracts/'+file))
   assert.deepEqual(Buffer.from(readM2AcceptedSource(target)),historical('c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f','packages/platform-contracts/'+file))
  }
  const target=path.join(installed,'package.json');fs.appendFileSync(target,'\n')
  assert.throws(()=>readM2AcceptedSource(target),/Actual installed SDK source/)
 }finally{fs.rmSync(fixture,{recursive:true,force:true})}
})
```
