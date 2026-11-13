/** Exact source acceptance only. Never used by product identity or E1. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
const recordPath='packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.json'
const guardPath='packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.mjs'
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
export function organisationLifecycleSdkPredecessor(current,historical,{projectKey='SG2'}={}){
 assert(Object.hasOwn(projects,projectKey),'explicit lifecycle source owner')
 let bytes
 try{bytes=Buffer.from(current(recordPath))}catch(error){if(missing(error))return null;throw error}
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
