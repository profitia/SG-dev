import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
// Test/build-only source continuation. Cannot authorize a runtime operation.
import {assistantEcrPredecessor} from './assistant-ecr-integrity.mjs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const SEND_ARROW_RECEIPT='apps/sg-runtime/assistant-send-arrow-integration.json'
export const SEND_ARROW_BASE='ef1d34e82ed6908a8f26103e2d6694e71374985d'
export const SEND_ARROW_VIEW='apps/sg-runtime/components/appshell/assistant-conversation-view.tsx'
export const SEND_ARROW_PATHS=Object.freeze([
 SEND_ARROW_VIEW,
 'apps/sg-runtime/tests/assistant-m2-integrity.mjs',
 'apps/sg-runtime/tests/assistant-markdown-integrity.mjs',
 'apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs',
 'apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
 'apps/sg-runtime/tests/procurement-insights-integrity.mjs',
 'apps/sg-runtime/tests/registration-stage-i-integrity.mjs'
])
export const SEND_ARROW_PRESERVED_RECEIPTS=Object.freeze([
 'apps/sg-runtime/assistant-context-integration.json',
 'apps/sg-runtime/assistant-markdown-integration.json',
 'apps/sg-runtime/operation-integration.json',
 'apps/sg-runtime/procurement-insights-integration.json',
 'apps/sg-runtime/registration-stage-i-integration.json'
])
const originalSubmit=`<button className="as-primary-button" type="submit" disabled={!state.active||!draft.trim()}>{en?'Send':'Wyślij'}</button>`
const canonicalSubmit=`<button className="as-primary-button" type="submit" disabled={!state.active||!draft.trim()} aria-label={en?'Send message':'Wyślij wiadomość'} title={en?'Send message':'Wyślij wiadomość'}>
     <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14"/></svg>
    </button>`
const hash=b=>createHash('sha256').update(b).digest('hex')
export function assistantSendArrowPredecessor(current,historical){
 let bytes
 try{bytes=current(SEND_ARROW_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  const missingGit=error?.status===128&&(text.includes("'"+SEND_ARROW_RECEIPT+"' does not exist in ")||text.includes("'"+SEND_ARROW_RECEIPT+"' exists on disk, but not in "))
  if(error?.code==='ENOENT'||missingGit)return null
  throw error
 }
 // Verify the complete current SDK view before exposing the exact historical
 // algorithm and unchanged receipt. Genuine absence keeps its prior semantics.
 let sdkReceipt
 try{sdkReceipt=JSON.parse(current('apps/sg-runtime/operation-integration.json'))}catch(error){
  const text=String(error?.stderr??error?.message??'')
  const missingGit=error?.status===128&&(text.includes("'apps/sg-runtime/operation-integration.json' does not exist in ")||text.includes("'apps/sg-runtime/operation-integration.json' exists on disk, but not in "))
  if(error?.code!=='ENOENT'&&!missingGit)throw error
 }
 if(sdkReceipt?.sdkSourceContinuations!==undefined){
  const sdk=sdkContinuationPredecessor(sdkReceipt,current,historical,{projectKey:'SG2'})
  if(sdk)return assistantSendArrowPredecessor(sdk.previousBytes,historical)
 }
 const ecr=assistantEcrPredecessor(current,historical);if(ecr)return assistantSendArrowPredecessor(ecr.previousBytes,historical)
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','sourceDigests','previousReceipts','authorisationChanged','sdkChanged','databaseChanged','modelChanged','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ASSISTANT-MARKDOWN-UX-20261110')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'CANONICAL_SEND_ARROW');assert.equal(a.previousSourceSha,SEND_ARROW_BASE)
 for(const flag of ['authorisationChanged','sdkChanged','databaseChanged','modelChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...SEND_ARROW_PATHS].sort())
 for(const p of SEND_ARROW_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact send-arrow source '+p)}
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...SEND_ARROW_PRESERVED_RECEIPTS].sort())
 for(const p of SEND_ARROW_PRESERVED_RECEIPTS){
  assert.equal(hash(historical(SEND_ARROW_BASE,p)),a.previousReceipts[p])
  assert.equal(hash(current(p)),a.previousReceipts[p],'immutable earlier receipt '+p)
 }
 for(const p of ['apps/sg-runtime/package.json','apps/sg-runtime/package-lock.json','apps/sg-runtime/components/appshell/platform-appshell.css'])assert.deepEqual(Buffer.from(current(p)),Buffer.from(historical(SEND_ARROW_BASE,p)),'unchanged dependency or layout '+p)
 const before=Buffer.from(historical(SEND_ARROW_BASE,SEND_ARROW_VIEW)).toString('utf8')
 assert.equal(before.split(originalSubmit).length,2,'one canonical submit replacement')
 assert.equal(Buffer.from(current(SEND_ARROW_VIEW)).toString('utf8'),before.replace(originalSubmit,canonicalSubmit),'only the canonical send icon and accessible name change')
 const mapped=new Set(SEND_ARROW_PATHS),cache=new Map()
 const added=new Set(['apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs','apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs'])
 return{manifest:a,previousBytes:p=>{
  if(p===SEND_ARROW_RECEIPT||added.has(p))throw Object.assign(Error('Send-arrow source absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(SEND_ARROW_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
