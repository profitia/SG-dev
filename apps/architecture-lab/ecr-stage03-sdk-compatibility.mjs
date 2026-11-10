// Exact source compatibility continuation; grants no runtime activation.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
export function calendarStoragePredecessor(readCurrent,historical,changedPaths){
 if(JSON.parse(readCurrent('packages/platform-source-hub-contracts/package.json')).version==='1.7.0'){
  const file='packages/platform-source-hub-contracts/semantic-continuous-acceptance-v1.json',bytes=readCurrent(file)
  assert.equal(sha256(bytes),'8c104ea4d20fa2ec2918e3c5d91f8b3ed1a749c24bbd0476aae742ea64fefb5f','exact Stage04–05 source adoption')
  const a=JSON.parse(bytes)
  assert.equal(a.schemaVersion,'ECRSemanticContinuousSourceAcceptance/1');assert.equal(a.taskId,'ARCHITECTURE-ECR-STAGE04-05-SEMANTIC-CONTINUOUS-20261110')
  assert.equal(a.hubContractsVersion,'1.7.0');assert.equal(a.durableResultProtocolVersion,'1.4.0');assert.equal(a.ecrContractVersion,'1.2.0');assert.equal(a.semanticProtocolVersion,'1.0.0')
  assert.equal(a.administrativeActivation,'SEPARATE_EXACT_OWNER_GO_REQUIRED');assert.equal(a.liveAcceptance,false)
  assert.deepEqual(Object.keys(a.sourceFiles),changedPaths(a.baseSha,a.sourceCandidateSha).sort(),'complete exact Stage04–05 source closure')
  for(const [p,digest]of Object.entries(a.sourceFiles)){
   assert.equal(sha256(historical(a.sourceCandidateSha,p)),digest,'reviewed Stage04–05 source '+p)
   assert.equal(sha256(readCurrent(p)),digest,'current Stage04–05 source '+p)
  }
  for(const [p,digest]of Object.entries(a.preservedReceipts))assert.equal(sha256(readCurrent(p)),digest,'immutable predecessor receipt '+p)
  for(const [p,digest]of Object.entries(a.replacements)){
   assert(Object.hasOwn(a.sourceFiles,p));assert.equal(sha256(historical(a.baseSha,p)),digest,'Stage04–05 predecessor '+p)
  }
  const prior=p=>Object.hasOwn(a.replacements,p)?historical(a.baseSha,p):readCurrent(p)
  return calendarStoragePredecessor(prior,historical,changedPaths)
 }
 if(JSON.parse(readCurrent('packages/platform-source-hub-contracts/package.json')).version!=='1.6.0')return {record:null,previousBytes:readCurrent}
 const file='packages/platform-source-hub-contracts/calendar-storage-acceptance-v1.json',bytes=readCurrent(file)
 assert.equal(sha256(bytes),'bd57c9bc76749ef116e5b9bc703e3a92315a79767e754abffe4629b12cafbdab','exact Stage03 producer-consumer acceptance')
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
