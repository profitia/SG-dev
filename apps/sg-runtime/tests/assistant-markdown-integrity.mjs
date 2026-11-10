// Test/build-only presentation continuation. No runtime authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const file='apps/sg-runtime/assistant-markdown-integration.json'
const assistantReceipt='apps/sg-runtime/assistant-context-integration.json'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
// Bound the presentation-only continuation before reading historical receipts.
export function assistantMarkdownPredecessor(current,historical){
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','libraries','noAssistantSdkChange','noModelChange','noAccessChange','noProviderCall','noReleaseConfigurationChange'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ASSISTANT-MARKDOWN-UX-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'aae0315cd531d4935656d90fc65cf31ad169c34b')
 const expected=["apps/sg-runtime/components/appshell/assistant-conversation-view.tsx", "apps/sg-runtime/components/appshell/assistant-message-markdown.tsx", "apps/sg-runtime/components/appshell/platform-appshell.css", "apps/sg-runtime/lib/assistant/conversation.ts", "apps/sg-runtime/lib/assistant/history.ts", "apps/sg-runtime/package-lock.json", "apps/sg-runtime/package.json", "apps/sg-runtime/tests/assistant-conversation-handler.test.ts", "apps/sg-runtime/tests/assistant-history-postgres.test.mjs", "apps/sg-runtime/tests/assistant-history.test.ts", "apps/sg-runtime/tests/assistant-m2-integrity.mjs", "apps/sg-runtime/tests/assistant-m2-integrity.test.mjs", "apps/sg-runtime/tests/assistant-markdown-integrity.mjs", "apps/sg-runtime/tests/assistant-markdown.test.tsx", "apps/sg-runtime/tests/pci-smart-integrity.test.mjs", "apps/sg-runtime/tests/procurement-insights-integrity.mjs"]
 assert.deepEqual(a.changedSourcePaths,expected);assert.deepEqual(Object.keys(a.sourceDigests).sort(),expected)
 assert.deepEqual(a.libraries,{'react-markdown':'10.1.0','remark-gfm':'4.0.1'})
 for(const flag of ['noAssistantSdkChange','noModelChange','noAccessChange','noProviderCall','noReleaseConfigurationChange'])assert.equal(a[flag],true,flag)
 const priorBytes=Buffer.from(historical(a.previousSourceSha,assistantReceipt))
 assert.equal(hash(priorBytes),a.previousReceiptSha256)
 assert.deepEqual(Buffer.from(current(assistantReceipt)),priorBytes,'All M1, M2, SRM and Oil receipts remain byte-identical')
 for(const p of expected){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current assistant presentation '+p)}
 const manifest=JSON.parse(current('apps/sg-runtime/package.json')),before=JSON.parse(historical(a.previousSourceSha,'apps/sg-runtime/package.json'))
 const dependencies={...manifest.dependencies}
 for(const [name,version]of Object.entries(a.libraries)){assert.equal(dependencies[name],version);delete dependencies[name]}
 assert.deepEqual(dependencies,before.dependencies,'Existing SDK, model client and product dependencies remain unchanged')
 const lock=JSON.parse(current('apps/sg-runtime/package-lock.json')),oldLock=JSON.parse(historical(a.previousSourceSha,'apps/sg-runtime/package-lock.json'))
 for(const [p,value]of Object.entries(oldLock.packages)){
  if(!p)continue
  const previous={...value},next={...lock.packages[p]}
  // The new production dependency uses the existing React type packages.
  if(['node_modules/@types/react','node_modules/@types/prop-types','node_modules/csstype'].includes(p)){delete previous.devOptional;delete next.devOptional}
  assert.deepEqual(next,previous,'Existing locked package remains unchanged: '+p)
 }
 const mapped=new Set(expected),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(p===file)throw Object.assign(Error('Presentation adoption absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(['apps/sg-runtime/components/appshell/assistant-message-markdown.tsx','apps/sg-runtime/tests/assistant-markdown.test.tsx','apps/sg-runtime/tests/assistant-markdown-integrity.mjs','apps/sg-runtime/tests/assistant-history.test.ts'].includes(p))throw Object.assign(Error('Presentation file absent from predecessor'),{code:'ENOENT'})
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
