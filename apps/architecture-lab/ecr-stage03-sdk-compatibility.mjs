// Exact source compatibility continuation; grants no runtime activation.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
export function calendarStoragePredecessor(readCurrent,historical,changedPaths){
 if(JSON.parse(readCurrent('packages/platform-source-hub-contracts/package.json')).version!=='1.6.0')return {record:null,previousBytes:readCurrent}
 const file='packages/platform-source-hub-contracts/calendar-storage-acceptance-v1.json',bytes=readCurrent(file)
 assert.equal(sha256(bytes),'8f37ea919782ab0814308e9dc801d641628e8be3bdb7021cff4e932e3e5f6cb1','exact Stage03 producer-consumer acceptance')
 const a=JSON.parse(bytes)
 assert.equal(a.schemaVersion,'ECRCalendarStorageSourceAcceptance/1');assert.equal(a.taskId,'ARCHITECTURE-ECR-STAGE03-DURABLE-STORE-20261110')
 assert.equal(a.hubContractsVersion,'1.6.0');assert.equal(a.scheduleProtocolVersion,'1.3.0');assert.equal(a.ecrContractVersion,'1.1.0')
 assert.equal(a.administrativeActivation,'SEPARATE_EXACT_OWNER_GO_REQUIRED');assert.equal(a.liveAcceptance,false)
 const allowed=p=>/^(apps\/(economic-calendar-runtime|platform-source-hub)|packages\/(economic-calendar-contracts|platform-source-hub-contracts))\//.test(p)&&p!==file
 assert.deepEqual(Object.keys(a.sourceFiles),changedPaths(a.baseSha,a.sourceCandidateSha).filter(allowed).sort(),'complete closed producer-consumer closure')
 for(const [p,digest]of Object.entries(a.sourceFiles)){
  assert(allowed(p));assert.equal(sha256(historical(a.sourceCandidateSha,p)),digest,'reviewed Stage03 source '+p)
  assert.equal(sha256(readCurrent(p)),digest,'current Stage03 source '+p)
 }
 for(const [p,digest]of Object.entries(a.preservedReceipts))assert.equal(sha256(readCurrent(p)),digest,'unchanged historical receipt '+p)
 for(const [p,digest]of Object.entries(a.replacements)){
  assert(Object.hasOwn(a.sourceFiles,p));assert.equal(sha256(historical(a.baseSha,p)),digest,'original predecessor '+p)
 }
 return {record:a,previousBytes:p=>Object.hasOwn(a.replacements,p)?historical(a.baseSha,p):readCurrent(p)}
}
