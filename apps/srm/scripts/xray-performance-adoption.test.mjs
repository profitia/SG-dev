import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {posix} from 'node:path'
import {currentHumanReadSourceDigest,CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read'
import {PREPARED_REPORT_RULES} from '../src/server/ready-report.ts'
const hash=value=>createHash('sha256').update(value).digest('hex')
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url))
test('complete X-Ray architecture adopts the exact producer and consumer closure without rewriting history or claiming deployment',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.xrayPerformanceRecoveryV2,xray=receipt.appshellXraySourceCompatibility,rural=receipt.ruralLocationAddressRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[key],value,key)
 assert.equal(a.taskId,'SRM-XRAY-PERFORMANCE-RECOVERY-V2-IMPLEMENT-20261028');assert.equal(a.platformVersion,'1.30.0')
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,772)
 assert.deepEqual(a.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),a.sdkDigests.currentHumanReadSourceDigest)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),xray.sourceDigests[file]??digest,'installed '+file)
 }
 assert(Object.keys(a.applicationSourceDigests).length>=30)
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)])),digest,'historical consumer '+file)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(Object.hasOwn(xray.applicationSourceDigests,file)?execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):rural?.applicationSourceDigests[file]?execFileSync('git',['show',rural.authorityBaseSha+':'+posix.normalize('apps/srm/'+file)]):read(file)),digest,'historical '+file)
 for(const[file,digest]of Object.entries({...xray.applicationSourceDigests,...rural?.applicationSourceDigests}))assert.equal(hash(read(file)),digest,file)
 const config=JSON.parse(read('deployment/ready-report-targets.json'))
 assert.equal(config.schemaDigest,hash(Buffer.concat([read('db/private-store/024-ready-report-history.sql'),read('db/private-store/025-ready-report-history.sql'),
  read('src/server/ready-report-shape.json'),Buffer.from(JSON.stringify(PREPARED_REPORT_RULES))])))
 assert.equal(config.workSchemaDigest,hash(read('db/private-store/026-ready-company-work.sql')))
 assert.equal(a.companyWorkSchemaDigest,config.workSchemaDigest);assert.equal(a.preparedSchemaDigest,config.schemaDigest)
 assert.equal(config.serviceId,'srv-db1vu6gm7kps73d0e3r0');assert.equal(config.enabledByDefault,false)
 assert.equal(a.standardSharedReadRequiresCurrentModule,true);assert.equal(a.readyRetainsQualifiedRadar,true)
 assert.equal(a.noPrivateDocumentsInSharedProjection,true);assert.equal(a.noPositiveAuthorizationCache,true)
 assert.equal(a.freshUsesOriginalFinancialCalculatorOnce,true);assert.equal(a.historyUsesImmutableSourceReferences,true)
 for(const flag of ['runtimeDeploymentPerformed','livePerformanceThresholdsAchieved','stagingOrProductionChanged','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 const scripts=JSON.parse(read('package.json')).scripts['test:operation-context']
 assert(scripts.includes('xray-performance-adoption.test.mjs'));assert(scripts.includes('ready-report.integration.test.mjs'))
})
