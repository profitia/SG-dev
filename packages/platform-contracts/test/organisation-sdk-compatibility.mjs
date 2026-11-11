// Source acceptance and historical verification only. Never imported by a
// product runtime or used as an identity, permission, licence or activation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const root=new URL('../../../',import.meta.url)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const immutableHistory=new WeakMap()
function historicalSource(reader,sha,path){
 assert.equal(typeof reader,'function')
 let cache=immutableHistory.get(reader);if(!cache){cache=new Map();immutableHistory.set(reader,cache)}
 const key=sha+':'+path
 // Git object bytes are immutable. Current workspace bytes are always re-read.
 if(!cache.has(key))cache.set(key,Buffer.from(reader(sha,path)))
 return Buffer.from(cache.get(key))
}
const receiptPath=project=>'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const tasks={SG2:'SG2-REGISTRATION-ORGANISATION-HANDOFF-STAGE-I-20261110',SRM:'SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111'}
const known=Object.freeze({
 'organisation-bootstrap-v1':Object.freeze({path:'packages/platform-contracts/test/organisation-sdk-compatibility.json',sha256:'e1f38699f6198f8e7014b556a7c2525d53f5b8146ce6114487194bc07ed66f2c'})
})
const recordKeys=['schemaVersion','acceptanceId','taskId','targetEnvironment','scope','platformVersion','previousSourceSha','producer','sourceDigests','compatibilityTestSourceDigests','sdkDigests','optionalPackageDigests','consumerSourceDigests','preservedSourceDigests','defaultRootImplementation','optionalRootImplementation','optionalOperations','runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed']
const compatibilityTests=[
 'apps/architecture-lab/test/sdk-compatibility.test.mjs',
 'packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs',
 'packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs',
 'packages/platform-contracts/test/private-operation-host.test.mjs'
].sort()
function exactKeys(value,keys,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),label)}
function fileMap(value,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert(Object.keys(value).length>0,label);for(const[p,h]of Object.entries(value)){assert(/^[a-zA-Z0-9_./-]+$/.test(p)&&!p.split('/').includes('..')&&!p.startsWith('/'),label);assert(/^[a-f0-9]{64}$/.test(h),label)}}
function cloneBytes(value){assert(value!==null&&value!==undefined,'missing source bytes');return Buffer.from(value)}
function verifyRecord(a,current,historical){
 exactKeys(a,recordKeys,'closed organisation SDK source record')
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.acceptanceId,'organisation-bootstrap-v1')
 assert.equal(a.taskId,'ARCH-REGISTRATION-ORGANISATION-STAGE-I-20261110')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'OPTIONAL_ORGANISATION_SDK_SOURCE_ONLY')
 assert.equal(a.platformVersion,'1.34.0');assert.match(a.previousSourceSha,/^[a-f0-9]{40}$/)
 assert.deepEqual(a.producer,{projectKey:'ARCHITECTURE',taskId:a.taskId,pullRequest:983,sourceSha:'1f1d7ae740f5d4ce6204551474789dcba1f4124d'})
 assert.equal(a.defaultRootImplementation,'1.0.0-candidate.16');assert.equal(a.optionalRootImplementation,'1.0.0-candidate.21')
 assert.deepEqual(a.optionalOperations,['organisation.create'])
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const field of ['sourceDigests','compatibilityTestSourceDigests','preservedSourceDigests'])fileMap(a[field],field)
 assert.deepEqual(Object.keys(a.compatibilityTestSourceDigests).sort(),compatibilityTests,'closed compatibility test changes')
 for(const[p,h]of Object.entries(a.sourceDigests)){
  assert(/^packages\/platform-contracts\/(?:src\/[a-z0-9-]+\.(?:mjs|d\.mts)|migrations\/(?:access|profile)\/[a-z0-9-]+\.sql|(?:current-e1-authority\/)?[a-z0-9/.-]+|package\.json)$/.test(p),'SDK source path')
  assert.equal(hash(current(p)),h,'current organisation SDK '+p)
  assert.equal(hash(historicalSource(historical,a.producer.sourceSha,p)),h,'actual immutable SDK producer '+p)
 }
 for(const[p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(current(p)),h,'current compatibility test '+p)
 for(const[p,h]of Object.entries(a.preservedSourceDigests)){
  assert.equal(hash(current(p)),h,'preserved source '+p)
  assert.equal(hash(historicalSource(historical,a.previousSourceSha,p)),h,'actual predecessor guard '+p)
 }
 exactKeys(a.consumerSourceDigests,['SG2','SRM'],'both consumer owners required')
 for(const project of ['SG2','SRM']){
  fileMap(a.consumerSourceDigests[project],project+' consumer closure')
  const pattern=project==='SG2'?/^apps\/sg-runtime\/tests\/[a-z0-9.-]+\.(?:mjs|ts)$/:/^apps\/srm\/scripts\/[a-z0-9.-]+\.(?:mjs|ts)$/
  for(const[p,h]of Object.entries(a.consumerSourceDigests[project])){
   assert(pattern.test(p),'source-only consumer path '+p)
   assert.equal(hash(current(p)),h,'current '+project+' acceptance '+p)
  }
 }
 for(const field of ['sdkDigests','optionalPackageDigests']){assert(a[field]&&Object.keys(a[field]).length);for(const[name,digest]of Object.entries(a[field])){assert(/^[a-zA-Z][a-zA-Z0-9]+Digest$/.test(name));assert.match(digest,/^[a-f0-9]{64}$/)}}
}
/** Validates current producer, both receivers and unchanged guards BEFORE any
 * predecessor bytes are exposed. A source frame does not change product grants.
 */
export function sdkContinuationPredecessor(receipt,current,historical,{projectKey='SG2',validatePeer=true}={}){
 assert(['SG2','SRM'].includes(projectKey))
 const frames=receipt.sdkSourceContinuations
 if(frames===undefined)return null
 assert(Array.isArray(frames)&&frames.length===1,'closed supported source continuation sequence')
 const frame=frames.at(-1);exactKeys(frame,['schemaVersion','acceptanceId','taskId','targetEnvironment','previousReceiptSha256'],'closed receiver source frame')
 assert.equal(frame.schemaVersion,'1.0');assert.equal(frame.taskId,tasks[projectKey]);assert.equal(frame.targetEnvironment,'development')
 const entry=known[frame.acceptanceId];assert(entry,'reviewed SDK continuation required')
 const recordBytes=cloneBytes(current(entry.path));assert.equal(hash(recordBytes),entry.sha256,'exact organisation SDK source acceptance')
 const record=JSON.parse(recordBytes);verifyRecord(record,current,historical)
 assert.equal(frame.acceptanceId,record.acceptanceId)
 const file=receiptPath(projectKey),actual=JSON.parse(current(file));assert.deepEqual(receipt,actual,'receiver metadata must be the current source view')
 const priorBytes=cloneBytes(historicalSource(historical,record.previousSourceSha,file));assert.equal(hash(priorBytes),frame.previousReceiptSha256,'immutable previous receiver bytes')
 const prior=JSON.parse(priorBytes),preserved=structuredClone(receipt);delete preserved.sdkSourceContinuations
 assert.deepEqual(preserved,prior,'all prior acceptance fields remain unchanged')
 const peer=projectKey==='SG2'?'SRM':'SG2',peerFile=receiptPath(peer)
 if(validatePeer){
  const other=JSON.parse(current(peerFile));assert.equal(other.sdkSourceContinuations?.at(-1)?.acceptanceId,frame.acceptanceId,'paired receiver adoption')
  sdkContinuationPredecessor(other,current,historical,{projectKey:peer,validatePeer:false})
 }
 const mapped=new Set([...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),
  ...Object.values(record.consumerSourceDigests).flatMap(v=>Object.keys(v)),file,peerFile])
 const cache=new Map([[file,priorBytes]])
 return {record,prior,previousBytes:path=>{
  if(!mapped.has(path))return current(path)
  if(!cache.has(path))cache.set(path,cloneBytes(historicalSource(historical,record.previousSourceSha,path)))
  return Buffer.from(cache.get(path))
 }}
}
const currentBytes=path=>fs.readFileSync(new URL(path,root))
const historicalBytes=(sha,path)=>execFileSync('git',['show',sha+':'+path],{cwd:root,stdio:['ignore','pipe','ignore']})
/** Exact current digests alongside immutable historical acceptance. Tests must
 * compare actual runtime fingerprint functions to this verified successor.
 */
export function acceptedSdkSource(){
 const receipt=JSON.parse(currentBytes(receiptPath('SG2')))
 const continuation=sdkContinuationPredecessor(receipt,currentBytes,historicalBytes)
 if(continuation)return continuation.record
 const previous=receipt.oilAutonomousReportCompatibility??receipt.assistantM1SourceCompatibility
 assert(previous?.sdkDigests&&previous?.optionalPackageDigests,'existing accepted SDK source required')
 return {sdkDigests:previous.sdkDigests,optionalPackageDigests:previous.optionalPackageDigests}
}
