// Source acceptance only. Never imported by an application runtime.
// The reviewed current graph is verified before any immutable predecessor is read.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const RECURRING_SOURCE_RECORD='apps/architecture-lab/private-recurring-source.json'
export const RECURRING_SOURCE_BASE='141cc559063c43cefa991acb9260b32ac5b92615'
const RECORD_SHA256='92b7ad887e64811219ba9b1d7fd8f7a5c0cf7dddd02ef3270a5fc9782016ed41'
const hash=b=>createHash('sha256').update(b).digest('hex')
const absent=error=>error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>String(error?.stderr??error?.message??'').includes("'"+RECURRING_SOURCE_RECORD+s))
export function recurringSourcePredecessor(current,historical){
 let bytes;try{bytes=current(RECURRING_SOURCE_RECORD)}catch(error){if(absent(error))return null;throw error}
 assert.equal(hash(bytes),RECORD_SHA256,'exact reviewed recurring source record')
 const a=JSON.parse(bytes)
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'PRIVATE_RECURRING_SOURCE_ACCEPTANCE');assert.equal(a.previousSourceSha,RECURRING_SOURCE_BASE)
 assert.equal(a.platformVersion,'1.36.0');assert.equal(a.legacyImplementation,'1.0.0-candidate.16');assert.equal(a.optionalImplementation,'1.0.0-candidate.22')
 assert.deepEqual(a.taskIds,{ARCHITECTURE:'ARCH-PI-RECURRING-E1-20261111',SG2:'SG2-PI-RECURRING-E2E-20261111',SRM:'SRM-PI-RECURRING-SDK-20261111'})
 for(const flag of ['runtimeActivated','newGrantsInstalled','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const[p,h]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),h,'current recurring source '+p)
 for(const[p,h]of Object.entries(a.preservedReceipts)){
  assert.equal(hash(current(p)),h,'immutable receipt '+p);assert.equal(hash(historical(RECURRING_SOURCE_BASE,p)),h,'original receipt '+p)
 }
 for(const project of ['ARCHITECTURE','SG2','SRM']){
  const file=project==='ARCHITECTURE'?'apps/architecture-lab/private-recurring-source-adoption.json':'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/private-recurring-source-adoption.json'
  assert.deepEqual(JSON.parse(current(file)),{schemaVersion:'1.0.0',projectKey:project,taskId:a.taskIds[project],targetEnvironment:'development',scope:'SOURCE_ONLY_NO_RUNTIME_ACTIVATION',sourceRecord:RECURRING_SOURCE_RECORD,sourceRecordSha256:RECORD_SHA256})
 }
 const additions=new Set(a.addedPaths),mapped=new Set(a.changedPaths),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===RECURRING_SOURCE_RECORD||p.endsWith('/private-recurring-source-adoption.json')||additions.has(p))throw Object.assign(Error('Recurring source absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(RECURRING_SOURCE_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
