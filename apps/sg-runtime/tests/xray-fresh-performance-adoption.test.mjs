import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {CURRENT_HUMAN_READ_CONTRACT,currentHumanReadSourceDigest} from '@profitia/platform-contracts/current-human-read'
const hash=v=>createHash('sha256').update(v).digest('hex')
test('SG2 accepts the verified peer reader without changing its backend or historical receipts',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.freshPerformanceRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,784)
 assert.deepEqual(a.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),a.sdkDigests.currentHumanReadSourceDigest)
 assert.equal(a.backend,'existing shared SRM only');assert.equal(a.peerTransportContractVersion,'1.0.0')
 assert.equal(a.uiOrFinancialBackendChanged,false);assert.equal(a.runtimeDeploymentPerformed,false)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,a.platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,file)
})
