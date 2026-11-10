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
const readSource=file=>fs.readFileSync(new URL(file,root))

test('assistant optional source closes the real SDK dependency graph and retains the immutable predecessor',async()=>{
 const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
 const {record:a}=assistantSdkPredecessor(readSource,historical)
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(hash(historical(ASSISTANT_SDK_PRODUCER,'packages/platform-contracts/'+p)),h,'producer source '+p)
 for(const [p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(historical(a.compatibilitySourceSha,'packages/platform-contracts/'+p)),h,'compatibility source '+p)
 const remaining=new Set(Object.keys(a.sdkDigests))
 for(const name of fs.readdirSync(new URL('packages/platform-contracts/src/',root)).filter(n=>n.endsWith('.mjs'))){
  const sdk=await import(new URL('packages/platform-contracts/src/'+name,root))
  for(const key of remaining)if(typeof sdk[key]==='function'){assert.equal(await sdk[key](),JSON.parse(readSource('apps/sg-runtime/operation-integration.json')).oilAutonomousReportCompatibility?.sdkDigests[key]??a.sdkDigests[key],key);remaining.delete(key)}
 }
 assert.equal(remaining.size,0)
 for(const target of ['packages/platform-contracts/src/assistant-usage.mjs','packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/package.json','apps/architecture-lab/assistant-m1-sdk-compatibility.json'])assert.throws(()=>assistantSdkPredecessor(p=>p===target?Buffer.concat([readSource(p),Buffer.from('UNREVIEWED')]):readSource(p),historical),target)
})

function assertIntegratedSourceHistory(readCurrent=readSource){
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
 assert.equal(JSON.parse(fs.readFileSync(new URL('packages/platform-contracts/package.json',root))).version,next.platformVersion)
 assert.equal(next.platformVersion,'1.34.0');assert.equal(next.marketSymbolContractVersion,'1.0.0')
 assert.deepEqual(next.allowedSdkVersions,['1.32.3','1.33.0','1.34.0'])
 assert.deepEqual(receipt.allowedSdkVersions,['1.32.3','1.33.0'])
 for(const [name,record] of Object.entries(receipt.packages)){
  const prefix='packages/platform-contracts/'+name+'/'
  const installed=fs.readFileSync(new URL(prefix+'package.json',root))
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
