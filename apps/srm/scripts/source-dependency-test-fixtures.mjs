// Test-only fixtures for historical assertions after exact current-source validation.
// Current bytes are authenticated by the existing trusted-main admission data.
// This module grants no runtime access and is never imported by product code.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const LEDGER='Canon/registries/controlled-source-admissions-v1.json'
const ROOT='apps/srm/operation-integration.json'
const missing=p=>Object.assign(Error('Source fixture absent from predecessor: '+p),{code:'ENOENT'})
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')
export function sourceDependencyTestFixtures(current,historical,id){
 let bytes
 try{bytes=current(LEDGER)}catch(e){
  const message=String(e?.stderr??e?.message??'')
  if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>message.includes("'"+LEDGER+s)))return {previousBytes:current}
  throw e
 }
 const ledger=JSON.parse(bytes);assert.equal(ledger.schemaVersion,'1.0')
 const matches=ledger.records.filter(a=>a.id===id);assert(matches.length<=1,'one exact source admission')
 if(!matches.length)return {previousBytes:current}
 const a=matches[0];assert.equal(a.status,'ACTIVE');assert.equal(a.repository,'profitia/SG-dev')
 assert.equal(a.actor,'profitia');assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'SOURCE_VALIDATION_ONLY')
 assert(a.approvalRef&&a.taskId);assert.match(a.sourceSha,/^[a-f0-9]{40}$/);assert.match(a.baseSha,/^[a-f0-9]{40}$/)
 assert(Date.parse(a.validFrom)<=Date.now()&&Date.parse(a.validUntil)>Date.now(),'current source validation window')
 assert(Array.isArray(a.files)&&a.files.length>0&&a.files.length<=300)
 const entries=new Map()
 for(const f of a.files){
  assert(/^apps\/(srm|sg-runtime)\/[a-zA-Z0-9_.@/-]+$/.test(f.path)&&!f.path.split('/').includes('..'))
  assert(!entries.has(f.path),'unique source path');assert.equal(f.mode,'100644')
  assert(['added','modified'].includes(f.status));assert(['SRM','SG2'].includes(f.projectKey))
  const b=Buffer.from(current(f.path));assert.equal(blob(b),f.blob,'exact current dependency '+f.path)
  entries.set(f.path,f)
 }
 const root=Buffer.from(historical(a.baseSha,ROOT))
 assert.deepEqual(Buffer.from(current(ROOT)),root,'historical root receipt remains immutable')
 return {admission:a,prior:JSON.parse(root),previousBytes:p=>{
  if(p===LEDGER)return historical(a.baseSha,p)
  const f=entries.get(p)
  if(!f)return current(p)
  if(f.status==='added')throw missing(p)
  return historical(a.baseSha,p)
 }}
}
