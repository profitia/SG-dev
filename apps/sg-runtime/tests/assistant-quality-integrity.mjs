import {assistantQualityHostPredecessor,QUALITY_HOST_RECEIPT} from './assistant-quality-host-integrity.mjs'
// Source continuation only: verifies current calendar bytes before projecting
// the immutable earlier acceptance. It grants no source, data or release right.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const QUALITY_RECEIPT='apps/sg-runtime/assistant-quality-integration.json'
export const QUALITY_BASE='765e995ca9b1eacef83a562b46e9c23876992e9b'
export const QUALITY_PATHS=Object.freeze([
 'apps/sg-runtime/lib/assistant/calendar-period.ts',
 'apps/sg-runtime/lib/assistant/context-selection.ts',
 'apps/sg-runtime/lib/assistant/conversation.ts',
 'apps/sg-runtime/lib/assistant/runtime.ts',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/tests/assistant-quality.test.ts',
 'apps/sg-runtime/tests/assistant-quality-integrity.mjs',
 'apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-ecr-integrity.mjs',
 'apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs'
])
export const QUALITY_RECEIPTS=Object.freeze([
 'apps/sg-runtime/operation-integration.json',
 'apps/sg-runtime/assistant-context-integration.json',
 'apps/sg-runtime/assistant-ecr-integration.json',
 'apps/sg-runtime/assistant-ecr-precision-integration.json',
 'apps/sg-runtime/assistant-markdown-integration.json',
 'apps/sg-runtime/assistant-send-arrow-integration.json',
 'apps/sg-runtime/registration-stage-i-integration.json',
 'apps/sg-runtime/procurement-insights-integration.json'
])
const additions=new Set(['apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/tests/assistant-quality.test.ts',
 'apps/sg-runtime/tests/assistant-quality-integrity.mjs','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs'])
const hash=b=>createHash('sha256').update(b).digest('hex')
export function assistantQualityPredecessor(current,historical){
 const host=assistantQualityHostPredecessor(current,historical);if(host){const accepted=assistantQualityPredecessor(host.legacyPreviousBytes??host.previousBytes,historical);assert(accepted,'accepted calendar source retained');return {...accepted,host,previousBytes:host.editorialPackage?p=>p==='apps/sg-runtime/package-lock.json'?host.previousBytes(p):accepted.previousBytes(p):accepted.previousBytes,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...host.manifest.sourceDigests,[QUALITY_HOST_RECEIPT]:hash(current(QUALITY_HOST_RECEIPT))}}}}
 let bytes
 try{bytes=current(QUALITY_RECEIPT)}catch(e){
  const text=String(e?.stderr??e?.message??'')
  if(e?.code==='ENOENT'||e?.status===128&&(text.includes("'"+QUALITY_RECEIPT+"' does not exist in ")||text.includes("'"+QUALITY_RECEIPT+"' exists on disk, but not in ")))return null
  throw e
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','scope','targetEnvironment','previousSourceSha','sourceDigests','previousReceipts','runtimeActivated','privateDataAccessChanged','dependenciesChanged','pilotStarted'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-CIC-QUALITY-TECHNICAL-READY-20261117')
 assert.equal(a.scope,'TRUSTED_CALENDAR_PERIOD_SOURCE');assert.equal(a.targetEnvironment,'development');assert.equal(a.previousSourceSha,QUALITY_BASE)
 for(const k of ['runtimeActivated','privateDataAccessChanged','dependenciesChanged','pilotStarted'])assert.equal(a[k],false,k)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...QUALITY_PATHS].sort())
 for(const p of QUALITY_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact calendar continuation '+p)}
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...QUALITY_RECEIPTS].sort())
 for(const p of QUALITY_RECEIPTS){
  assert.equal(hash(current(p)),a.previousReceipts[p],'unchanged earlier receipt '+p)
  assert.equal(hash(historical(QUALITY_BASE,p)),a.previousReceipts[p],'immutable previous receipt '+p)
 }
 assert.deepEqual(Buffer.from(current('apps/sg-runtime/package-lock.json')),Buffer.from(historical(QUALITY_BASE,'apps/sg-runtime/package-lock.json')),'no dependency artifact change')
 const before=JSON.parse(historical(QUALITY_BASE,'apps/sg-runtime/package.json')),after=JSON.parse(current('apps/sg-runtime/package.json'))
 const expected=structuredClone(before)
 expected.scripts['test:assistant']=expected.scripts['test:assistant'].replace('tests/assistant-economic-calendar.test.ts ','tests/assistant-economic-calendar.test.ts tests/assistant-quality.test.ts ')+' && node --test tests/assistant-quality-integrity.test.mjs'
 assert.deepEqual(after,expected,'only the exact quality test additions are admitted')
 const mapped=new Set(QUALITY_PATHS),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===QUALITY_RECEIPT||additions.has(p))throw Object.assign(Error('Quality continuation absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(QUALITY_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
