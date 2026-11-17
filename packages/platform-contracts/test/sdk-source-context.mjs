// Test/source integrity only. This module grants no runtime permission,
// installation, release, provider access or source-admission authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
export const CURRENT_SDK_SOURCE_RECORD='apps/architecture-lab/current-sdk-source.json'
const sdkManifest='packages/platform-contracts/package.json'
const sha256=/^[a-f0-9]{64}$/,gitSha=/^[a-f0-9]{40}$/
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const plain=v=>v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype
const sourcePath=p=>typeof p==='string'&&p.length<=1024&&/^[A-Za-z0-9_.@/\[\]-]+$/.test(p)
 &&!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'&&!['.git','node_modules','.pmos','.context','.env','.env.local'].includes(x))
export const sdkSourcePathAbsent=(error,p)=>error?.code==='ENOENT'||error?.status===128&&[
 "'"+p+"' does not exist in ","'"+p+"' exists on disk, but not in ",
].some(s=>String(error?.stderr??error?.message??'').includes(s))
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v)}return v}
function coveredPaths(value,result=new Set()){
 if(plain(value))for(const [key,item]of Object.entries(value)){
  if(key.includes('/')&&sourcePath(key)&&typeof item==='string'&&sha256.test(item))result.add(key)
  else if(item&&typeof item==='object')coveredPaths(item,result)
 }
 else if(Array.isArray(value))for(const item of value)coveredPaths(item,result)
 return result
}
/** Verify all current physical inputs first. Historical evidence is then read
 * directly from immutable Git objects, with no per-task code/path projection.
 * CI admission remains the separate decision made by trusted authority main. */
export function sdkSourceContext(current,historical,{recordPath=CURRENT_SDK_SOURCE_RECORD}={}){
 assert.equal(typeof current,'function');assert.equal(typeof historical,'function');assert(sourcePath(recordPath))
 let bytes
 try{bytes=Buffer.from(current(recordPath))}catch(error){if(sdkSourcePathAbsent(error,recordPath))return null;throw error}
 assert(bytes.length<=2*1024*1024,'bounded current SDK source metadata')
 const r=JSON.parse(bytes.toString('utf8'))
 assert(plain(r)&&r.schemaVersion==='1.0'&&r.scope==='CURRENT_SDK_SOURCE_INTEGRITY_ONLY','source integrity scope only')
 assert(/^\d+\.\d+\.\d+$/.test(r.platformVersion))
 for(const flag of ['runtimeActivated','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(r[flag],false,flag)
 // An independently checked older source view keeps its original verifier.
 // This record never makes an older view pass or changes its bytes.
 if(JSON.parse(current(sdkManifest)).version!==r.platformVersion)return null
 assert(plain(r.inputs)&&Object.keys(r.inputs).length>0&&Object.keys(r.inputs).length<=2000)
 assert(sha256.test(r.inputs[sdkManifest]??''),'SDK manifest belongs to current input closure')
 for(const [p,digest]of Object.entries(r.inputs)){
  assert(sourcePath(p)&&p!==recordPath&&sha256.test(digest),'safe complete physical source input')
  assert.equal(hash(current(p)),digest,'current SDK source '+p)
 }
 assert(plain(r.baselines)&&Object.keys(r.baselines).length>0&&Object.keys(r.baselines).length<=8)
 for(const [alias,b]of Object.entries(r.baselines))assert(/^[a-z][a-z0-9-]{0,63}$/.test(alias)&&plain(b)&&gitSha.test(b.sha),'immutable historical baseline')
 const cache=new Map()
 const baseline=alias=>{
  assert(Object.hasOwn(r.baselines,alias),'declared historical baseline')
  const sha=r.baselines[alias].sha
  return p=>{
   assert(sourcePath(p),'historical path stays inside the repository')
   const key=sha+':'+p
   if(!cache.has(key)){
    try{cache.set(key,Buffer.from(historical(sha,p)))}catch(error){
     // A full Git view retains real absence; older filesystem-reader contracts
     // receive ENOENT, while invalid objects or other Git failures stay errors.
     if(sdkSourcePathAbsent(error,p))throw Object.assign(Error('Historical source path absent: '+p),{code:'ENOENT'})
     throw error
    }
   }
   return Buffer.from(cache.get(key))
  }
 }
 assert(Array.isArray(r.coverageRecords)&&r.coverageRecords.length>0&&r.coverageRecords.length<=16)
 for(const ref of r.coverageRecords){
  assert(plain(ref)&&sourcePath(ref.path)&&sha256.test(ref.sha256),'closed predecessor coverage')
  const previous=baseline(ref.baseline)(ref.path)
  assert.equal(hash(previous),ref.sha256,'immutable predecessor source record '+ref.path)
  for(const p of coveredPaths(JSON.parse(previous.toString('utf8'))))assert(sha256.test(r.inputs[p]??''),'retained physical source coverage '+p)
 }
 assert(plain(r.retainedReceipts),'explicit retained historical evidence')
 for(const [p,e]of Object.entries(r.retainedReceipts)){
  assert(sourcePath(p)&&plain(e)&&sha256.test(e.sha256),'closed historical receipt')
  assert.equal(hash(current(p)),e.sha256,'unchanged current historical receipt '+p)
  assert.equal(hash(baseline(e.baseline)(p)),e.sha256,'immutable historical receipt '+p)
 }
 assert(plain(r.metadata)&&plain(r.metadata.sdkDigests)&&plain(r.metadata.optionalPackageDigests),'explicit current fingerprint metadata')
 return Object.freeze({record:freeze(r),metadata:freeze(structuredClone(r.metadata)),
  currentSourceDigests:Object.freeze({...r.inputs}),baseline,recordSha256:hash(bytes)})
}
const root=new URL('../../../',import.meta.url)
export function currentSdkSourceContext(){
 return sdkSourceContext(p=>fs.readFileSync(new URL(p,root)),(sha,p)=>execFileSync('git',['show',sha+':'+p],
  {cwd:fileURLToPath(root),maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}))
}
