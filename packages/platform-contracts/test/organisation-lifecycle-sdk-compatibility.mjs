/** Exact source acceptance only. Never used by product identity or E1. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
const recordPath='packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.json'
const guardPath='packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.mjs'
const reconciledRecordSha256='049acd3d7f50eb426668705b41117526bff4c7d9b705354f5b01c5f578f8109e'
const acceptedRecordSha256='3a7d291e8e6da5ebdae31571d6bb89d664ef5a4c41f32af05de0e161e7f6f7b2'
const previousSourceSha='b18b5eee15aab07c7ff3968cafbfd50ddd5e9b5a'
const acceptedMainSha='68867fe8c54b8f3b2efadf512d37d8925b9657e5'
const originalRecordPath='packages/platform-contracts/test/organisation-sdk-compatibility.json'
const originalRecordSha256='022f0a4c774cc93856c7219518ac99d23712cd3961bab508fa0d2b25c9113ea1'
const projects={ARCHITECTURE:{path:'apps/architecture-lab/organisation-lifecycle-sdk-source-adoption.json',taskId:'ARCH-REGISTRATION-LIFECYCLE-SDK-SOURCE-20261112'},
 SG2:{path:'apps/sg-runtime/organisation-lifecycle-sdk-source-adoption.json',taskId:'SG2-REGISTRATION-LIFECYCLE-SDK-ADOPTION-20261112'},
 SRM:{path:'apps/srm/organisation-lifecycle-sdk-source-adoption.json',taskId:'SRM-REGISTRATION-LIFECYCLE-SDK-ADOPTION-20261112'}}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const safePath=p=>typeof p==='string'&&[...p].every(c=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_./-[]()@'.includes(c))&&!posix.isAbsolute(p)&&posix.normalize(p)===p&&!p.split('/').includes('..')
const missing=error=>error?.code==='ENOENT'||error?.status===128&&/does not exist|exists on disk/.test(String(error.stderr??error.message??''))
const absent=()=>{throw Object.assign(Error('Absent from immutable lifecycle predecessor'),{code:'ENOENT'})}
const historyCache=new WeakMap()
function historicalBytes(reader,sha,path){
 let cache=historyCache.get(reader);if(!cache){cache=new Map();historyCache.set(reader,cache)}
 const key=sha+':'+path
 if(!cache.has(key))cache.set(key,Buffer.from(reader(sha,path)))
 return Buffer.from(cache.get(key))
}
function map(value,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);for(const[p,h]of Object.entries(value)){assert(safePath(p),label);assert(/^[a-f0-9]{64}$/.test(h),label)}}
function equalKeys(value,keys,label){assert(value&&Object.getPrototypeOf(value)===Object.prototype,label);assert.deepEqual(Object.keys(value).sort(),keys.sort(),label)}
/** Verify every current/preserved byte, both receiver adoptions and exact Git
 * predecessor bytes BEFORE offering any historical view. No permissive fallback. */
function reconciledLifecycleSource(bytes,current,historical,projectKey){
 assert.equal(hash(bytes),reconciledRecordSha256,'exact reconciled lifecycle source record')
 const a=JSON.parse(bytes),r=a.sourceReconciliation
 equalKeys(r,['schemaVersion','acceptanceId','scope','predecessorSha','predecessorRecordSha256','predecessorGuardSha256','currentMainSha','predecessorAbsentPaths','taskIds','currentSourceDigests','currentMainSourceDigests','correctedOwnerInputs'],'closed lifecycle test reconciliation')
 assert.equal(r.schemaVersion,'1.0');assert.equal(r.acceptanceId,'organisation-lifecycle-sdk-1.37-test-reconciliation-20261113-v1')
 assert.equal(r.scope,'SOURCE_TEST_CONTINUITY_ONLY')
 assert.equal(r.predecessorSha,'8aee0665f20f16ae66455f8d15d336bac59711f0')
 assert.equal(r.predecessorRecordSha256,acceptedRecordSha256)
 assert.equal(r.predecessorGuardSha256,'bc4bbcb13dbf4a254af18814de9b6a6d1a9a5358c6d0f42a78189a32a575fa6d')
 assert.equal(r.currentMainSha,'80875d8f0e9451cd9afd34e8baf2a8f6059bc064')
 equalKeys(r.taskIds,Object.keys(projects),'separate current owner registrations')
 for(const owner of Object.keys(projects))assert.equal(r.taskIds[owner],owner+'-REGISTRATION-STAGE-I-RESUME-V2-20261113')
 map(r.currentSourceDigests,'complete reconciled physical graph')
 const hidden=new Set([recordPath,guardPath,...Object.values(projects).map(v=>v.path)])
 for(const[p,h]of Object.entries(r.currentSourceDigests)){
  assert(!hidden.has(p),'no circular reconciliation hash')
  assert.equal(hash(current(p)),h,'current reconciled lifecycle source '+p)
 }
 // Read immutable Git only after every current physical input authenticated.
 const previousRecord=historicalBytes(historical,r.predecessorSha,recordPath)
 assert.equal(hash(previousRecord),acceptedRecordSha256,'unchanged original lifecycle source record')
 assert.equal(hash(historicalBytes(historical,r.predecessorSha,guardPath)),r.predecessorGuardSha256,'unchanged original lifecycle guard')
 const {sourceReconciliation,...unchanged}=a,previous=JSON.parse(previousRecord)
 assert.deepEqual(unchanged,previous,'all original fields, seven owner inputs and historical receipts remain unchanged')
 const previousFiles={...a.sourceDigests,...a.compatibilityTestSourceDigests,...a.preservedSourceDigests,...a.consumerSourceDigests.ARCHITECTURE,...a.consumerSourceDigests.SG2,...a.consumerSourceDigests.SRM}
 for(const p of Object.keys(previousFiles))assert(Object.hasOwn(r.currentSourceDigests,p),'complete original physical closure retained')
 map(r.currentMainSourceDigests,'current main continuity')
 assert.deepEqual(Object.keys(r.currentMainSourceDigests).sort(),["apps/sg-runtime/assistant-notifications-integration.json","apps/sg-runtime/components/procurement-insights/notifications.tsx","apps/sg-runtime/tests/assistant-notifications-integrity.mjs","apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs","apps/sg-runtime/tests/assistant-widget.test.tsx","apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs","apps/sg-runtime/tests/procurement-insights.test.tsx"])
 for(const[p,h]of Object.entries(r.currentMainSourceDigests)){
  assert.equal(r.currentSourceDigests[p],h,'main input belongs to complete current graph')
  assert.equal(hash(historicalBytes(historical,r.currentMainSha,p)),h,'actual newer main input preserved')
 }
 assert(Array.isArray(r.correctedOwnerInputs)&&r.correctedOwnerInputs.length===2,'bounded ARCHITECTURE and SRM test corrections')
 assert.deepEqual(r.correctedOwnerInputs.map(v=>v.projectKey).sort(),['ARCHITECTURE','SRM'],'one input per actual correction owner')
 const corrections={}
 for(const input of r.correctedOwnerInputs){
  equalKeys(input,['projectKey','taskId','sourceSha','sourceDigests'],'closed test correction input')
  assert(['ARCHITECTURE','SRM'].includes(input.projectKey),'actual correction owner')
  assert.equal(input.taskId,r.taskIds[input.projectKey]);assert(/^[a-f0-9]{40}$/.test(input.sourceSha))
  map(input.sourceDigests,'exact owned test corrections')
  for(const[p,h]of Object.entries(input.sourceDigests)){
   assert.equal(r.currentSourceDigests[p],h,'correction belongs to current graph')
   assert.equal(hash(historicalBytes(historical,input.sourceSha,p)),h,'actual independent owner correction')
   corrections[p]=h
  }
 }
 const additional=['packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.test.mjs']
 for(const[p,h]of Object.entries(r.currentSourceDigests)){
  assert(Object.hasOwn(previousFiles,p)||Object.hasOwn(corrections,p)||Object.hasOwn(r.currentMainSourceDigests,p)||additional.includes(p),'bounded added test input')
  if(Object.hasOwn(previousFiles,p)&&previousFiles[p]!==h)assert(Object.hasOwn(corrections,p)||Object.hasOwn(r.currentMainSourceDigests,p)||additional.includes(p),'no unrelated source replacement')
 }
 for(const[owner,binding]of Object.entries(projects)){
  const receipt=JSON.parse(current(binding.path))
  assert.deepEqual(receipt,{schemaVersion:'1.0',projectKey:owner,taskId:r.taskIds[owner],acceptanceId:r.acceptanceId,sourceRecordSha256:reconciledRecordSha256,platformVersion:'1.37.0',scope:r.scope,runtimeOptedIn:false},'current paired owner reconciliation '+owner)
 }
 const absentAtPredecessor=new Set(r.predecessorAbsentPaths)
 assert.deepEqual([...absentAtPredecessor].sort(),['apps/sg-runtime/assistant-notifications-integration.json','apps/sg-runtime/tests/assistant-notifications-integrity.mjs','apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs'])
 for(const p of absentAtPredecessor){assert(Object.hasOwn(r.currentSourceDigests,p),'current main addition authenticated');let absent=false;try{historicalBytes(historical,r.predecessorSha,p)}catch(error){if(missing(error))absent=true;else throw error}assert(absent,'actual absence before main notification successor')}
 const projected=p=>{if(absentAtPredecessor.has(p))return absent();return hidden.has(p)||Object.hasOwn(r.currentSourceDigests,p)?historicalBytes(historical,r.predecessorSha,p):current(p)}
 const original=organisationLifecycleSdkPredecessor(projected,historical,{projectKey})
 assert(original,'complete immutable original lifecycle graph is still mandatory')
 return Object.freeze({...original,currentSourceDigests:Object.freeze(r.currentSourceDigests),sourceReconciliation:Object.freeze(r)})
}
export function organisationLifecycleSdkPredecessor(current,historical,{projectKey='SG2'}={}){
 assert(Object.hasOwn(projects,projectKey),'explicit lifecycle source owner')
 let bytes
 try{bytes=Buffer.from(current(recordPath))}catch(error){if(missing(error))return null;throw error}
 if(hash(bytes)===reconciledRecordSha256)return reconciledLifecycleSource(bytes,current,historical,projectKey)
 assert.equal(hash(bytes),acceptedRecordSha256,'exact lifecycle SDK source record')
 const a=JSON.parse(bytes)
 equalKeys(a,['schemaVersion','acceptanceId','taskId','targetEnvironment','scope','platformVersion','previousSourceSha','producer','sourceDigests','compatibilityTestSourceDigests','sdkDigests','optionalPackageDigests','consumerSourceDigests','preservedSourceDigests','defaultRootImplementation','optionalRootImplementation','optionalOperations','runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed','previousSourceDigests','previousAbsentPaths','ownerInputs','acceptedMainSha','acceptedMainSourceDigests','acceptedMainAbsentPaths'],'closed lifecycle source record')
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.acceptanceId,'organisation-lifecycle-sdk-1.37-development-v1')
 assert.equal(a.taskId,projects.ARCHITECTURE.taskId);assert.equal(a.targetEnvironment,'development')
 assert.equal(a.scope,'OPTIONAL_ORGANISATION_LIFECYCLE_SOURCE_ONLY');assert.equal(a.platformVersion,'1.37.0');assert.equal(a.previousSourceSha,previousSourceSha)
 assert.equal(a.defaultRootImplementation,'1.0.0-candidate.16');assert.equal(a.optionalRootImplementation,'1.0.0-candidate.23')
 assert.deepEqual(a.optionalOperations,['organisation.onboarding.read','organisation.company.lookup','organisation.slug.check','organisation.procurement.write','organisation.invitation.create','organisation.invitation.accept','organisation.activation.read','organisation.access.synchronise'])
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,'source only '+flag)
 equalKeys(a.producer,['projectKey','taskId','pullRequest','sourceSha'],'closed lifecycle source producer')
 map(a.sdkDigests,'current SDK digests');map(a.optionalPackageDigests,'optional package digests')
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.taskId,a.taskId);assert(Number.isSafeInteger(a.producer.pullRequest)&&a.producer.pullRequest>0,'actual lifecycle source PR');assert(/^[a-f0-9]{40}$/.test(a.producer.sourceSha))
 equalKeys(a.consumerSourceDigests,['ARCHITECTURE','SG2','SRM'],'joint current consumers')
 const all={}
 for(const[label,files]of Object.entries({sdk:a.sourceDigests,tests:a.compatibilityTestSourceDigests,...a.consumerSourceDigests,preserved:a.preservedSourceDigests})){
  map(files,'closed '+label+' paths')
  for(const[p,h]of Object.entries(files)){
   assert(p!==guardPath&&p!==recordPath&&!Object.values(projects).some(v=>v.path===p),'no circular source acceptance')
   if(Object.hasOwn(all,p))assert.equal(all[p],h,'same physical source digest')
   all[p]=h;assert.equal(hash(current(p)),h,'current lifecycle source '+p)
  }
 }
 assert.equal(hash(current(originalRecordPath)),originalRecordSha256,'unchanged original SDK record')
 assert.equal(hash(historicalBytes(historical,previousSourceSha,originalRecordPath)),originalRecordSha256,'actual original Git SDK record')
 assert.equal(JSON.parse(current('packages/platform-contracts/package.json')).version,'1.37.0')
 map(a.previousSourceDigests,'immutable previous source paths')
 const cache=new Map()
 for(const[p,h]of Object.entries(a.previousSourceDigests)){
  const b=historicalBytes(historical,previousSourceSha,p);assert.equal(hash(b),h,'actual immutable lifecycle predecessor '+p);cache.set(p,b)
 }
 assert(Array.isArray(a.previousAbsentPaths)&&new Set(a.previousAbsentPaths).size===a.previousAbsentPaths.length,'closed previous absence set')
 const absentPaths=new Set(a.previousAbsentPaths)
 for(const p of absentPaths){assert(safePath(p),'bounded absent path');assert(!cache.has(p),'disjoint previous source');let absentAtSource=false;try{historicalBytes(historical,previousSourceSha,p)}catch(error){if(missing(error))absentAtSource=true;else throw error}assert(absentAtSource,'actual previous source absence '+p)}
 for(const p of Object.keys(all))assert(cache.has(p)||absentPaths.has(p),'every current source has an exact predecessor or proven absence')
 for(const[owner,binding]of Object.entries(projects)){
  const receipt=JSON.parse(current(binding.path))
  equalKeys(receipt,['schemaVersion','projectKey','taskId','acceptanceId','sourceRecordSha256','platformVersion','scope','runtimeOptedIn'],'closed '+owner+' source adoption')
  assert.deepEqual(receipt,{schemaVersion:'1.0',projectKey:owner,taskId:binding.taskId,acceptanceId:a.acceptanceId,sourceRecordSha256:acceptedRecordSha256,platformVersion:'1.37.0',scope:a.scope,runtimeOptedIn:false},'paired lifecycle receiver '+owner)
 }
 assert(Array.isArray(a.ownerInputs)&&a.ownerInputs.length>=3,'actual owner inputs')
 assert.deepEqual([...new Set(a.ownerInputs.map(i=>i.projectKey))].sort(),Object.keys(projects).sort(),'all actual owner inputs')
 for(const input of a.ownerInputs){
  equalKeys(input,['projectKey','taskId','sourceSha','sourceDigests'],'closed owner input')
  assert(Object.hasOwn(projects,input.projectKey)&&typeof input.taskId==='string'&&/^[a-f0-9]{40}$/.test(input.sourceSha),'actual producer input')
  map(input.sourceDigests,'owner source input')
  for(const[p,h]of Object.entries(input.sourceDigests)){assert.equal(all[p],h,'owner input belongs to current closed source '+p);assert.equal(hash(historicalBytes(historical,input.sourceSha,p)),h,'published owner source '+p)}
 }
 assert.equal(a.acceptedMainSha,acceptedMainSha,'exact preserved accepted PI main')
 map(a.acceptedMainSourceDigests,'immutable accepted main source')
 const mainCache=new Map()
 for(const[p,h]of Object.entries(a.acceptedMainSourceDigests)){
  const b=historicalBytes(historical,acceptedMainSha,p);assert.equal(hash(b),h,'actual accepted main source '+p);mainCache.set(p,b)
 }
 assert(Array.isArray(a.acceptedMainAbsentPaths)&&new Set(a.acceptedMainAbsentPaths).size===a.acceptedMainAbsentPaths.length,'closed accepted main absence set')
 const mainAbsent=new Set(a.acceptedMainAbsentPaths)
 for(const p of mainAbsent){
  assert(safePath(p)&&!mainCache.has(p),'bounded disjoint accepted main absence')
  let absentAtMain=false;try{historicalBytes(historical,acceptedMainSha,p)}catch(error){if(missing(error))absentAtMain=true;else throw error}
  assert(absentAtMain,'actual accepted main absence '+p)
 }
 for(const p of Object.keys(all))assert(mainCache.has(p)||mainAbsent.has(p),'every current source has an exact accepted main predecessor or absence')
 const hidden=new Set([recordPath,guardPath,...Object.values(projects).map(v=>v.path)])
 return Object.freeze({currentRecord:a,currentSourceDigests:Object.freeze(all),acceptedMainBytes:path=>{
  assert(safePath(path),'bounded accepted main lookup')
  if(hidden.has(path)||mainAbsent.has(path))return absent()
  return mainCache.has(path)?Buffer.from(mainCache.get(path)):current(path)
 },previousBytes:path=>{
  assert(safePath(path),'bounded predecessor lookup')
  if(hidden.has(path)||absentPaths.has(path))return absent()
  return cache.has(path)?Buffer.from(cache.get(path)):current(path)
 }})
}
