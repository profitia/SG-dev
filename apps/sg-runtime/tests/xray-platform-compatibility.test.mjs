import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const hash=value=>createHash('sha256').update(value).digest('hex')
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
test('SRM-required additive platform1.30 compatibility retains all SG2 history and unchanged current execution',async()=>{
 const a=receipt.xrayPlatform130SourceCompatibility
 assert.equal(a.taskId,'SG2-XRAY-PLATFORM130-SOURCE-COMPAT-20261028');assert.equal(a.platformVersion,'1.30.0')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[key],value,key)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/private-operation-host'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,a.platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
 assert.deepEqual(a.sdkDigests,receipt.diagnosticTelemetryAdoption.sdkDigests)
 for(const module of ['operation-context','private-operation-host','access-store','request-ledger','delegated-job','request-continuation','request-inspection','request-work','request-operations','external-call','supplier-location','report-admission','platform-ingestion','diagnostic-phase']){
  const sdk=await import('@profitia/platform-contracts/'+module)
  for(const[name,digest]of Object.entries(a.sdkDigests))if(typeof sdk[name]==='function')assert.equal(await sdk[name](),digest,name)
 }
 for(const flag of ['currentHumanReadOptedIn','sharedSqlInstalled','sg2FeatureChanged','providerConfigurationChanged','runtimeDeploymentPerformed'])assert.equal(a[flag],false,flag)
})
