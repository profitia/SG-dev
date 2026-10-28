import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {posix} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.nativeSqlRoundtripAdoption,current=receipt.diagnosticTelemetryAdoption??a
const hash=v=>createHash('sha256').update(v).digest('hex')
test('native SQL adoption preserves complete prior acceptance and pins the exact reviewed producer',async()=>{
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(bytes),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.platformVersion,'1.29.1');assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,729)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/private-operation-host'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,current.platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,file)
  if(file.startsWith('src/')||file==='package.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),current.sourceDigests[file]??digest,file)
 }
 const modules={'private-operation-host':'privateOperationHostSourceDigest','access-store':'accessStoreSourceDigest',
  'delegated-job':'delegatedJobSourceDigest','platform-ingestion':'platformIngestionSourceDigest','request-work':'requestWorkSourceDigest'}
 for(const[module,fn]of Object.entries(modules))assert.equal(await(await import('@profitia/platform-contracts/'+module))[fn](),current.sdkDigests[fn],fn)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const latest=receipt.appShellSourceCompatibility,adp=receipt.adpPresentationSourceCompatibility
  const historicalSha=latest.applicationSourceDigests[file]?latest.previousReceiptSourceSha:adp.applicationSourceDigests[file]?adp.previousReceiptSourceSha:null
  const historical=historicalSha?execFileSync('git',['show',historicalSha+':'+posix.normalize('apps/sg-runtime/'+file)]):fs.readFileSync(new URL('../'+file,import.meta.url))
  assert.equal(hash(historical),current.applicationSourceDigests[file]??digest,'preserved SQL receiver '+file)
  if(adp.applicationSourceDigests[file]||latest.applicationSourceDigests[file])assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.accountProofRenewalSourceCompatibility.applicationSourceDigests[file]??adp.applicationSourceDigests[file]??receipt.assistantWidgetSourceCompatibility.applicationSourceDigests[file]??latest.applicationSourceDigests[file],'current AppShell receiver '+file)
 }
 assert.equal(a.currentAuthorityCheckpointsPreserved,true);assert.equal(a.physicalAuditPreserved,true)
 for(const flag of ['humanGrantsChanged','quotasChanged','runtimeDeploymentPerformed'])assert.equal(a[flag],false,flag)
})
