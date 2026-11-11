import {posix} from 'node:path'
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
 'organisation-bootstrap-v1':Object.freeze({path:'packages/platform-contracts/test/organisation-sdk-compatibility.json',sha256:'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e',successorSha256s:Object.freeze(['25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c','ccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40'])})
})
// Already reviewed Identity source bytes are verified before exposing0775.
// These pins add no runtime authority and apply only to reconciled1.36 history.
const reconciledIdentitySources=Object.freeze({
  "apps/identity-runtime/src/organisation-onboarding.ts": {
    "sha256": "2bd52ce90cbb522cf465298228524ba7f51e87646e3dcbcbbd8ae49a2203ad53",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
    "sha256": "8e63ae4b5b21724f13fa29659f546424804bf63e2ea0568a238a26f365506e8b",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/src/organisation-draft.ts": {
    "sha256": "bba7165ae3bbd799778312722725e888b7a33347918f393618c67ca4026b3a4f",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/main.ts": {
    "sha256": "5396d018303d3356c73523ee4edfc06ab8725d29c42125c7c8e60087e4345fd4",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/http-handler.ts": {
    "sha256": "362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/test/organisation-draft.test.mjs": {
    "sha256": "128683cefed1ba9ee0dadf271a66320678a2d5babbb4f69c794e8b643a1c0328",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/README.md": {
    "sha256": "f5b66a9294e6c74d2973911779e1ac9b7a3bd898ccd330581885e05e081aa30b",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "Canon/evidence/2026-11-11-registration-native-draft-http.md": {
    "sha256": "9baa883a9af8beb2e658a351ce022c57fa8c869f126e35e0da95b4400c626c7a",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  }
})
const recordKeys=['schemaVersion','acceptanceId','taskId','targetEnvironment','scope','platformVersion','previousSourceSha','producer','sourceDigests','compatibilityTestSourceDigests','sdkDigests','optionalPackageDigests','consumerSourceDigests','preservedSourceDigests','defaultRootImplementation','optionalRootImplementation','optionalOperations','runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed']
const compatibilityTests=[
 'apps/platform-source-hub/scripts/ci-routing.mjs',
 'apps/platform-source-hub/test/ci-routing.test.mjs',
 'apps/newsfeed-runtime/test/runtime.test.mjs',
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
 const reconciled=a.platformVersion==='1.36.0'
 assert.equal(a.platformVersion,reconciled?'1.36.0':'1.34.0')
 assert.equal(a.previousSourceSha,reconciled?'0775f8a18d2fbeca462bb0a9d654914b15c53dad':'b2fccbb8b9132a63c2c39507a1ebc838cf6228e1')
 assert.deepEqual(a.producer,{projectKey:'ARCHITECTURE',taskId:a.taskId,pullRequest:983,sourceSha:reconciled?'5a963f313317d57e1946e1d7aabd28192db9c7bd':'c373be45a5bf52c93034f5a1b6878e531c81b2ca'})
 assert.equal(a.defaultRootImplementation,'1.0.0-candidate.16');assert.equal(a.optionalRootImplementation,'1.0.0-candidate.21')
 assert.deepEqual(a.optionalOperations,['organisation.create'])
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const field of ['sourceDigests','compatibilityTestSourceDigests','preservedSourceDigests'])fileMap(a[field],field)
 assert.deepEqual(Object.keys(a.compatibilityTestSourceDigests).sort(),compatibilityTests,'closed compatibility test changes')
 for(const[p,h]of Object.entries(a.sourceDigests)){
  assert(/^packages\/platform-contracts\/(?:src\/[a-z0-9-]+\.(?:mjs|d\.mts)|migrations\/(?:access|profile)\/[a-z0-9-]+\.sql|(?:current-e1-authority\/)?[a-z0-9/.-]+|package\.json)$/.test(p)||/^packages\/platform-contracts\/(?:(?:readonly-miss-report|root-atomic-claim)\/)?README\.md$/.test(p),'SDK source path '+p)
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
  const pattern=project==='SG2'?/^apps\/sg-runtime\/tests\/[a-z0-9.-]+\.(?:mjs|ts)$/:/^apps\/srm\/(?:app\/login\/porr-account\.tsx|scripts\/[a-z0-9.-]+\.(?:mjs|ts)|src\/server\/(?:root-atomic-claim-adoption|peer-read-boundary|supplier-location-geocoding-runtime)\.test\.ts)$/
  for(const[p,h]of Object.entries(a.consumerSourceDigests[project])){
   assert(pattern.test(p),'source-only consumer path '+p)
   assert.equal(hash(current(p)),h,'current '+project+' acceptance '+p)
  }
 }
 if(reconciled)for(const[p,pin]of Object.entries(reconciledIdentitySources)){
  assert.equal(hash(current(p)),pin.sha256,'current reviewed Identity source '+p)
  assert.equal(hash(historicalSource(historical,pin.producerSha,p)),pin.sha256,'actual immutable Identity producer '+p)
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
 const recordBytes=cloneBytes(current(entry.path));assert([entry.sha256,...(entry.successorSha256s??[])].includes(hash(recordBytes)),'exact organisation SDK source acceptance')
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
  ...Object.values(record.consumerSourceDigests).flatMap(v=>Object.keys(v)),...(record.platformVersion==='1.36.0'?Object.keys(reconciledIdentitySources):[]),file,peerFile])
 const cache=new Map([[file,priorBytes]])
 return {record,prior,previousBytes:inputPath=>{
  const path=posix.normalize(inputPath)
  assert(!posix.isAbsolute(path)&&path!=='..'&&!path.startsWith('../'),'source path remains inside the repository')
  if(!mapped.has(path))return current(inputPath)
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
