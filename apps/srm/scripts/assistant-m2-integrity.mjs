import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
// Test/build-only source continuation. Never imported by a product runtime.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {assistantM2Predecessor} from '../../sg-runtime/tests/assistant-m2-integrity.mjs'
const file='apps/srm/assistant-context-integration.json'
export const SRM_ASSISTANT_M2_PATHS=Object.freeze([
 'apps/srm/app/api/xray/assistant-context/route.ts',
 'apps/srm/deployment/private-runtime-targets.json',
 'apps/srm/scripts/assistant-m2-integrity.mjs',
 'apps/srm/scripts/source-hub-sdk-compatibility.mjs',
 'apps/srm/scripts/xray-workflow-contract.test.ts',
 'apps/srm/src/server/assistant-context-runtime.test.ts',
 'apps/srm/src/server/assistant-context-runtime.ts',
 'apps/srm/src/server/private-runtime.ts',
 'apps/srm/src/server/supplier-api-composition.ts',
 'packages/srm-xray/package.json',
 'packages/srm-xray/src/assistant-context.ts',
 'packages/srm-xray/src/assistant-summary.ts',
 'packages/srm-xray/src/financial-scanner.tsx',
])
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
// Test/build-only consumer of the existing canonical admission mechanism.
// Native ESM preserves synchronous predecessor readers; only source digests cross
// the child boundary. No provider environment or credentials are forwarded.
export function authenticatedSrmSourceDigests(paths){
 const names=[...new Set(paths)]
 assert(names.length===paths.length&&names.every(p=>typeof p==='string'&&/^[A-Za-z0-9_.@/-]+$/.test(p)&&p.split('/').every(v=>v&&v!=='.'&&v!=='..')&&(p.startsWith('apps/')||p.startsWith('packages/srm-xray/'))),'existing consumer app or shared X-Ray source only')
 const root=fileURLToPath(new URL('../../../',import.meta.url))
 const program="import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';const root=process.argv[1],paths=JSON.parse(process.argv[2]),control='apps/srm/scripts/assistant-m2-integrity.mjs',watch=[...new Set([control,...paths.filter(p=>p.startsWith('apps/')&&/\\.(?:tsx?|mjs)$/.test(p))])];const {trustedApplicationContinuity}=await import(new URL('scripts/governance/development-execution.mjs',pathToFileURL(root+'/')));const read=trustedApplicationContinuity(root,watch);if(!read){process.stdout.write('null')}else{const git=args=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']}),main=p=>git(['cat-file','blob','origin/main:'+p]),mode=(ref,p)=>git(['--literal-pathspecs','ls-tree',ref,'--',p]).toString().slice(0,6),physical=p=>{const name=path.join(root,p),st=fs.lstatSync(name),m=mode('HEAD',p);if(!st.isFile()||st.isSymbolicLink()||fs.realpathSync(name)!==name||st.size>1024*1024||!['100644','100755'].includes(m)||Boolean(st.mode&0o111)!==(m==='100755'))throw Error('SRM_SOURCE_PHYSICAL_REJECTED');return fs.readFileSync(name)},same=(p,bytes)=>bytes.equals(main(p))&&mode('HEAD',p)===mode('origin/main',p),appChanged=watch.some(p=>!same(p,read(p))),result={};for(const p of paths){const bytes=physical(p);if(!same(p,bytes)&&!appChanged)throw Error('SRM_CONSUMER_ADOPTION_REQUIRED');result[p]=createHash('sha256').update(bytes).digest('hex')}process.stdout.write(JSON.stringify(result))}"
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',program,root,JSON.stringify(names)],{cwd:root,env:{PATH:process.env.PATH,GIT_NO_LAZY_FETCH:'1'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024}))
 assert(result,'independent current SRM source admission required')
 return result
}
// Accepted admission metadata selects historical SDK bytes; it grants no access.
// Current bytes are independently authenticated before the selected view is used.
export function srmSdkSourceHistories(current,paths){
 assert(paths.every(p=>typeof p==='string'&&p.startsWith('packages/srm-xray/')&&/^[A-Za-z0-9_.@/-]+$/.test(p)&&p.split('/').every(v=>v&&v!=='.'&&v!=='..')),'closed shared X-Ray source only')
 const root=fileURLToPath(new URL('../../../',import.meta.url)),options={cwd:root,env:{PATH:process.env.PATH,GIT_NO_LAZY_FETCH:'1'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024}
 const store=JSON.parse(execFileSync('git',['cat-file','blob','origin/main:Canon/registries/controlled-source-admissions-v1.json'],options))
 assert(store.schemaVersion==='1.0'&&Array.isArray(store.records),'trusted source history metadata required')
 const blobs=new Map(paths.map(p=>{
  const bytes=Buffer.from(current(p)),blob=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex')
  const physical=execFileSync('git',['hash-object','--no-filters','--',p],options).trim()
  return[p,blob===physical?blob:null]
 }))
 return store.records.filter(r=>/^[a-f0-9]{40}$/.test(r.baseSha??'')&&Array.isArray(r.files)).map(r=>({baseSha:r.baseSha,paths:r.files.filter(f=>paths.includes(f.path)&&blobs.get(f.path)===f.blob).map(f=>f.path)})).filter(r=>r.paths.length)
}
// Reconstruct a prior application view only after the canonical admission reader
// authenticates the complete physical source. This selects history, never grants it.
export function srmAdmittedApplicationPredecessors(current,historical){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),options={cwd:root,env:{PATH:process.env.PATH,GIT_NO_LAZY_FETCH:'1'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024}
 const store=JSON.parse(execFileSync('git',['cat-file','blob','origin/main:Canon/registries/controlled-source-admissions-v1.json'],options))
 assert(store.schemaVersion==='1.0'&&Array.isArray(store.records),'trusted application history metadata required')
 const eligible=p=>typeof p==='string'&&p.startsWith('apps/srm/')&&/^[A-Za-z0-9_.@/-]+$/.test(p)&&p.split('/').every(v=>v&&v!=='.'&&v!=='..')&&/\.(?:tsx?|mjs)$/.test(p)
 const matches=store.records.filter(r=>/^[a-f0-9]{40}$/.test(r.baseSha??'')&&Array.isArray(r.files)&&r.files.some(f=>eligible(f.path))&&r.files.every(f=>{
  if(typeof f.path!=='string'||!/^[A-Za-z0-9_.@/-]+$/.test(f.path)||f.path.split('/').some(v=>!v||v==='.'||v==='..'))return false
  try{return execFileSync('git',['hash-object','--no-filters','--',f.path],options).trim()===f.blob}catch{return false}
 }))
 assert(matches.length<=1,'ambiguous application source history')
 const record=matches[0],previous=new Map();if(!record)return previous
 for(const f of record.files.filter(f=>eligible(f.path))){
  let bytes;try{bytes=Buffer.from(current(f.path))}catch{continue} // Files added later are absent from a valid older view.
  const blob=createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex')
  if(blob!==f.blob)continue // An earlier validated reader may already project this file.
  if(!execFileSync('git',['ls-tree',record.baseSha,'--',f.path],options).trim())continue
  const before=historical(record.baseSha,f.path)
  if(hash(bytes)!==hash(before))previous.set(f.path,Buffer.from(before))
 }
 if(previous.size){
  const digests=authenticatedSrmSourceDigests([...previous.keys()])
  for(const p of previous.keys())assert.equal(hash(current(p)),digests[p],'independently admitted application source '+p)
 }
 return previous
}
export function assertSrmHistoricalAnchor(value,file,fields){
 assert(['apps/srm/assistant-context-integration.json','apps/srm/operation-integration.json','apps/sg-runtime/operation-integration.json'].includes(file),'existing immutable consumer receipt only')
 const root=fileURLToPath(new URL('../../../',import.meta.url))
 let accepted=JSON.parse(execFileSync('git',['cat-file','blob','origin/main:'+file],{cwd:root,env:{PATH:process.env.PATH,GIT_NO_LAZY_FETCH:'1'},encoding:'utf8',timeout:30000,maxBuffer:1024*1024}))
 for(const field of fields){assert(accepted&&Object.hasOwn(accepted,field),'immutable receipt field');accepted=accepted[field]}
 assert.deepEqual(value,accepted,'unchanged authority-main receipt values')
}
export function assertSrmHistoricalSources(current,expected,label,anchor){
 const changed=Object.entries(expected).filter(([p,h])=>hash(current(p))!==h)
 if(!changed.length)return
 for(const h of Object.values(expected))assert.match(h,/^[a-f0-9]{64}$/)
 assert(anchor,'immutable receipt anchor required')
 assertSrmHistoricalAnchor(anchor.value,anchor.file,anchor.fields)
 const digests=authenticatedSrmSourceDigests(changed.map(([p])=>p))
 for(const[p]of changed)assert.equal(hash(current(p)),digests[p],label+' '+p)
}
export function srmAssistantM2Predecessor(current,historical){
 // Both current owners are checked before either historical byte view.
 // The integrated SG2 view hides its own manifest, ending this recursion.
 const consumer=assistantM2Predecessor(current,historical)
 if(consumer)return srmAssistantM2Predecessor(consumer.previousBytes,historical)
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SRM-ACG-M2-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.contract.id,'srm-assistant-summary');assert.equal(a.contract.version,'1.0.0')
 assert.equal(a.previousSourceSha,'c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f')
 assert.deepEqual(a.configuration,{variable:'PROFITIA_ASSISTANT_CONTEXT_PEER_READ_VERSION',version:'srm-assistant-context-peer-development-v1',enabledByDefault:false})
 assert.deepEqual(a.operations,['supplier.report.read','supplier.private.read'])
 assert.equal(a.grantsAccess,false);assert.equal(a.storedReadsOnly,true);assert.equal(a.acquisitionAllowed,false)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...SRM_ASSISTANT_M2_PATHS].sort())
 assertSrmHistoricalSources(current,a.sourceDigests,'current M2 producer',{value:a.sourceDigests,file,fields:['sourceDigests']})
 const receipt='apps/srm/operation-integration.json',prior=Buffer.from(historical(a.previousSourceSha,receipt))
 assert.deepEqual(Buffer.from(current(receipt)),prior,'all historical SRM/M1/Oil acceptance bytes remain immutable')
 const mapped=new Set(SRM_ASSISTANT_M2_PATHS),cache=new Map([[receipt,prior]])
 return {manifest:a,previousBytes:p=>{
  if(p===file)throw Object.assign(Error('M2 build manifest is absent from its predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
