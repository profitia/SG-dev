import {marketCalendarSourcePredecessor} from '../../../apps/architecture-lab/market-calendar-source.mjs'
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
 'organisation-bootstrap-v1':Object.freeze({path:'packages/platform-contracts/test/organisation-sdk-compatibility.json',sha256:'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e',successorSha256s:Object.freeze(['25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c','ccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40','ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d','b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a','b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698','8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059','52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3','49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8'])})
})
// All supplemental reviewed source bytes are verified before exposing0775.
// These pins add no runtime authority and apply only to reconciled1.36 history.
const reconciledSourceOverlay=Object.freeze({
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
  },
  "packages/platform-contracts/test/organisation-bootstrap-postgres.test.mjs": {
    "sha256": "15165c930440ceb7cbe7dbfdd0263637951f31b83c0a33d01a1f065d7dd1fd08",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-bootstrap.test.mjs": {
    "sha256": "ed13fb983ef78aeab7210ebb26a122af8ba96d0529769c1db6fa8458bcfc690d",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-invitations.test.mjs": {
    "sha256": "2deaad88c6b70f57e8cb72d98221f58c976afa1fcf029868d67191289e6e7ed2",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-onboarding-postgres.test.mjs": {
    "sha256": "fd9d06252c3342d956d0db0755a3200660b6db9ac9d458fa1c6162935627248e",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "packages/platform-contracts/test/organisation-profile.test.mjs": {
    "sha256": "3a6ddbf6ee633a7245d14608792ec412d5acd3c72879e0104e3105476990091c",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  }
})

const parallelEcrWeek=Object.freeze({recordSha256:'b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698',receipt:'apps/sg-runtime/assistant-ecr-week-integration.json',receiptSha256:'31ce8f1d7e5ca1d9c3aedf80f92e23fe0f1a93cb8f5fd5d003eb54a244859dd4',sourceSha:'38a9fe371e7993b47e2358d297647086ea999428',guardPins:Object.freeze({"apps/architecture-lab/private-recurring-source.mjs":"9035324816864e64040c1ad3d29e064284ad2e3f8eb626a9b3c1ede55fbb4b28","apps/sg-runtime/tests/pci-smart-integrity.test.mjs":"aa9b2199d5d2cd1554f808a02f7fd63bf397adca045f4d535e7d2af0f158c080"})});
/** Exact source-only composition, not a generic reader or runtime grant.
 * All physical SDK/receiver bytes have already passed verifyRecord and both
 * receiver frames before this authenticates the separately accepted ECR graph.
 * Only two explicitly pinned source-proof paths use actual ECR history. */
const parallelEcrWeekFrames=Object.freeze({
 'b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698':parallelEcrWeek,
 '8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059':Object.freeze({...parallelEcrWeek,recordSha256:'8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3':Object.freeze({...parallelEcrWeek,recordSha256:'52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 '49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba':Object.freeze({...parallelEcrWeek,recordSha256:'49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})}),
 'a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8':Object.freeze({...parallelEcrWeek,recordSha256:'a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8',guardPins:Object.freeze({...parallelEcrWeek.guardPins,"apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":'0787795fdd513113107c3ee7e0b840a588f27186c5adfba92f7d8020aefda46f'})})
})
function verifiedParallelEcrGuards(record,current,historical,profile=parallelEcrWeek){
 const bytes=cloneBytes(current(profile.receipt));assert.equal(hash(bytes),profile.receiptSha256,'exact parallel ECR source record');
 const w=JSON.parse(bytes),guards=new Map();
 for(const[p,h]of Object.entries(profile.guardPins)){
  const b=cloneBytes(historicalSource(historical,profile.sourceSha,p));assert.equal(hash(b),h,'actual immutable parallel ECR guard '+p);guards.set(p,b);
 }
 for(const[p,h]of Object.entries(w.sourceDigests))assert.equal(hash(guards.get(p)??current(p)),h,'current parallel ECR source '+p);
 for(const[p,h]of Object.entries(w.previousReceipts)){
  const b=[receiptPath('SG2'),receiptPath('SRM')].includes(p)?historicalSource(historical,record.previousSourceSha,p):current(p);
  assert.equal(hash(b),h,'preserved parallel ECR receipt '+p);
  assert.equal(hash(historicalSource(historical,w.previousSourceSha,p)),h,'actual immutable parallel ECR receipt '+p);
 }
 return guards;
}

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
// The owner's1041 mandate composes only the two overlapping proof files.
// SDK and both receivers are authenticated first; Calendar source and every
// preserved receipt are authenticated before any Calendar history is exposed.
const acceptedCalendarFrames=Object.freeze({"49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba":{"sourceSha":"877c55c6ef7879c088255284dd852d5cab6d5f44","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"618f9e9643f17c7db385572bdd11e8b8c940504a55b0bae317094352878ca6a1"},"helperSha256":"fb08a9a2d21a59be5422a313663d5191473385a28faa8c253ffdddb166fcbfcd"},"a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8":{"sourceSha":"334273b2b5af0ad41a1489f31bc6bb56f36d3dbf","pins":{"apps/architecture-lab/private-recurring-source.mjs":"7cc45765fb91657a78eba8d48214886664e0648680c4cd3ea19119386e499b4d","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs":"e3b350ed2013c89f6d4215e9b68965685551198fd1463442b50aa0ae2e7e1d99","apps/architecture-lab/test/market-calendar-source.test.mjs":"36772de9ab30b19a07089debefcc01729abf5f125a07fd3f09eef7b5a4226edf"},"helperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","compatibilityReceipt":{"path":"apps/architecture-lab/market-calendar-test-compatibility.json","sha256":"52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078"},"restoreReceipts":true}})
function verifiedCalendarPredecessor(record,current,historical,recordDigest){
 const cfg=acceptedCalendarFrames[recordDigest];if(!cfg)return null
 const cache=new Map()
 assert.equal(hash(current('apps/architecture-lab/market-calendar-source.mjs')),cfg.helperSha256,'accepted Calendar verifier bytes')
 if(cfg.compatibilityReceipt)assert.equal(hash(current(cfg.compatibilityReceipt.path)),cfg.compatibilityReceipt.sha256,'accepted Calendar test-only record')
 for(const[p,h]of Object.entries(cfg.pins)){const b=cloneBytes(historicalSource(historical,cfg.sourceSha,p));assert.equal(hash(b),h,'actual accepted Calendar overlap '+p);cache.set(p,b)}
 if(cfg.restoreReceipts)for(const project of ['SG2','SRM']){const p=receiptPath(project);cache.set(p,cloneBytes(historicalSource(historical,record.previousSourceSha,p)))}
 let reader=p=>cache.has(p)?Buffer.from(cache.get(p)):current(p)
 const acceptedCurrent=reader
 const first=marketCalendarSourcePredecessor(reader,historical);assert(first,'accepted Calendar source is required')
 reader=first.previousBytes
 for(let prior;(prior=marketCalendarSourcePredecessor(reader,historical));)reader=prior.previousBytes
 return {current:acceptedCurrent,previousBytes:reader}
}
function exactKeys(value,keys,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),label)}
function fileMap(value,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert(Object.keys(value).length>0,label);for(const[p,h]of Object.entries(value)){assert(/^[a-zA-Z0-9_./-]+$/.test(p)&&!p.split('/').includes('..')&&!p.startsWith('/'),label);assert(/^[a-f0-9]{64}$/.test(h),label)}}
function cloneBytes(value){assert(value!==null&&value!==undefined,'missing source bytes');return Buffer.from(value)}
function verifyRecord(a,current,historical,recordDigest){
 const complete=['ffe2065f84e7a9808a74f896170588b9ff5fc66973096a15a407a7cbf006808d','b5a228db0a77f4cd7e2235506738a994fffcd741ff942e67717633d858c5b94a','b0b9ceb1799499cb2088ed8be523d6c1758573995e65ca53693b15eeaeafe698','8e3eb5304ba9f3270b8021341a7220dff29acd5bbcf6fcd8c4cb301bf7071059','52f6fbeba63a7585d3b909ca6cb5b91c1b6b2ebdeb118975473f312acc6ba7f3','49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8'].includes(recordDigest)
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
 assert.deepEqual(Object.keys(a.compatibilityTestSourceDigests).sort(),complete?[...compatibilityTests,...["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"],...(['49d746aad0ff4de6d0e910e2e3aaf7c53c9e4e0ab3aed9d86acd94761ec707ba','a8050a2acde67bfc74457dd55824b074d09b26428a43bc1584f9e27916b4edd8'].includes(recordDigest)?['apps/architecture-lab/test/market-calendar-source.test.mjs']:[])].sort():compatibilityTests,'closed compatibility test changes')
 for(const[p,h]of Object.entries(a.sourceDigests)){
  assert(/^packages\/platform-contracts\/(?:src\/[a-z0-9-]+\.(?:mjs|d\.mts)|migrations\/(?:access|profile)\/[a-z0-9-]+\.sql|(?:current-e1-authority\/)?[a-z0-9/.-]+|package\.json)$/.test(p)||/^packages\/platform-contracts\/(?:(?:readonly-miss-report|root-atomic-claim)\/)?README\.md$/.test(p),'SDK source path '+p)
  assert.equal(hash(current(p)),h,'current organisation SDK '+p)
  assert.equal(hash(historicalSource(historical,a.producer.sourceSha,p)),h,'actual immutable SDK producer '+p)
 }
 for(const[p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(current(p)),h,'current compatibility test '+p)
 for(const[p,h]of Object.entries(a.preservedSourceDigests)){
  assert.equal(hash(current(p)),complete&&["apps/architecture-lab/private-recurring-source.mjs","apps/architecture-lab/test/private-recurring-source.test.mjs"].includes(p)?a.compatibilityTestSourceDigests[p]:h,'preserved source '+p)
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
 if(reconciled)for(const[p,pin]of Object.entries(reconciledSourceOverlay)){
  assert.equal(hash(current(p)),pin.sha256,'current reviewed supplemental source '+p)
  assert.equal(hash(historicalSource(historical,pin.producerSha,p)),pin.sha256,'actual immutable supplemental producer '+p)
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
 const record=JSON.parse(recordBytes);verifyRecord(record,current,historical,hash(recordBytes))
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
  ...Object.values(record.consumerSourceDigests).flatMap(v=>Object.keys(v)),...(record.platformVersion==='1.36.0'?Object.keys(reconciledSourceOverlay):[]),file,peerFile])
 const parallelProfile=parallelEcrWeekFrames[hash(recordBytes)]
 const calendar=verifiedCalendarPredecessor(record,current,historical,hash(recordBytes))
 const calendarCurrent=calendar?.previousBytes??current
 const parallel=parallelProfile?verifiedParallelEcrGuards(record,calendarCurrent,historical,parallelProfile):null
 const cache=new Map([[file,priorBytes],...(parallel??[])])
 return {record,prior,...(calendar?{calendarCurrent:calendar.current}:{}),previousBytes:inputPath=>{
  const path=posix.normalize(inputPath)
  assert(!posix.isAbsolute(path)&&path!=='..'&&!path.startsWith('../'),'source path remains inside the repository')
  if(!mapped.has(path))return calendarCurrent(inputPath)
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
