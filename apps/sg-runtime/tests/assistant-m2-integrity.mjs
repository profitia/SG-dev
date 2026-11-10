// Test/build-only adoption; this file cannot grant runtime access.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const ASSISTANT_M2_PATHS=Object.freeze([
 'apps/sg-runtime/components/appshell/appshell-dashboard.tsx',
 'apps/sg-runtime/components/appshell/assistant-conversation-transport.ts',
 'apps/sg-runtime/components/appshell/assistant-screen-context.ts',
 'apps/sg-runtime/deployment/assistant-m2-targets.json',
 'apps/sg-runtime/lib/assistant/context-selection.ts',
 'apps/sg-runtime/lib/assistant/conversation.ts',
 'apps/sg-runtime/lib/assistant/history.ts',
 'apps/sg-runtime/lib/assistant/runtime.ts',
 'apps/sg-runtime/lib/assistant/sources.ts',
 'apps/sg-runtime/lib/platform/private-runtime.ts',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/package-lock.json',
 'apps/sg-runtime/tests/assistant-conversation-handler.test.ts',
 'apps/sg-runtime/tests/assistant-m1-integrity.mjs',
 'apps/sg-runtime/tests/assistant-m2-integrity.mjs',
 'apps/sg-runtime/tests/assistant-m2-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-multi-source.test.ts',
 'apps/sg-runtime/tests/assistant-screen-context.test.ts',
 'apps/sg-runtime/tests/assistant-sources.test.ts',
 'apps/sg-runtime/tests/assistant-m2-source-view.mjs',
 'apps/sg-runtime/tests/assistant-m2-source-view.test.mjs',
 'apps/sg-runtime/tests/adp-appshell-preview.mjs',
 'apps/sg-runtime/tests/category-operation.test.ts',
 'apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs',
 'apps/sg-runtime/tests/identity-runtime.test.ts',
 'apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs',
 'apps/sg-runtime/tests/native-sql-roundtrips.test.mjs',
 'apps/sg-runtime/tests/operation-context.test.mjs',
 'apps/sg-runtime/tests/porr-demo-middleware.test.ts',
 'apps/sg-runtime/tests/self-service-account.test.ts',
 'apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs',
 'apps/sg-runtime/tests/xray-gateway.test.ts',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
])
export const ASSISTANT_M2_PRODUCER_PATHS=Object.freeze([
 'packages/assistant-context-contracts/package.json',
 'packages/assistant-context-contracts/src/index.mjs',
 'packages/assistant-context-contracts/src/index.d.mts',
 'packages/assistant-context-gateway/package.json',
 'packages/assistant-context-gateway/src/index.mjs',
 'packages/assistant-context-gateway/src/index.d.mts',
 'packages/assistant-context-gateway/src/multi-source.mjs',
 'apps/newsfeed-runtime/assistant-context-integration.json',
 'apps/srm/assistant-context-integration.json',
])
const file='apps/sg-runtime/assistant-context-integration.json'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export function assistantM2Predecessor(current,historical){
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','configuration','producers','storedReadsOnly','newGrant','acquisitionAllowed','sourceDigests','producerDigests'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-ACG-M2-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f')
 assert.deepEqual(a.configuration,{variable:'PROFITIA_ASSISTANT_M2_CONFIGURATION_VERSION',version:'sg2-assistant-m2-development-v1',enabledByDefault:false})
 assert.deepEqual(a.producers,{architecture:{pullRequest:954,sourceSha:'c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f'},srm:{pullRequest:963,sourceSha:'a2cf089e0620877c0bde2ac7d08292a75d2e8b67'},cic:{pullRequest:22,sourceSha:'967a5775f45408549d7942d727289818212ef506',version:'1.5.1'}})
 assert.equal(a.storedReadsOnly,true);assert.equal(a.newGrant,false);assert.equal(a.acquisitionAllowed,false)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...ASSISTANT_M2_PATHS].sort())
 assert.deepEqual(Object.keys(a.producerDigests).sort(),[...ASSISTANT_M2_PRODUCER_PATHS].sort())
 for(const [p,h]of Object.entries({...a.sourceDigests,...a.producerDigests}))assert.equal(hash(current(p)),h,'exact M2 adoption '+p)
 for(const [p,h]of Object.entries(a.producerDigests))assert.equal(hash(historical(p.startsWith('apps/srm/')?a.producers.srm.sourceSha:a.producers.architecture.sourceSha,p)),h,'immutable producer '+p)
 const manifest=JSON.parse(current('apps/sg-runtime/package.json')),lock=JSON.parse(current('apps/sg-runtime/package-lock.json'))
 assert.equal(manifest.dependencies['@profitia/cic-core'],'1.5.1')
 const installed=lock.packages['node_modules/@profitia/cic-core']
 assert.equal(installed.version,'1.5.1');assert.match(installed.resolved,/^https:\/\/npm\.pkg\.github\.com\/download\/@profitia\/cic-core\/1\.5\.1\/[a-f0-9]+$/)
 assert.match(installed.integrity,/^sha512-[A-Za-z0-9+/]+=*$/)
 const receipt='apps/sg-runtime/operation-integration.json',prior=Buffer.from(historical(a.previousSourceSha,receipt))
 assert.deepEqual(Buffer.from(current(receipt)),prior,'M1, Oil and all preceding acceptance remain byte-identical')
 const mapped=new Set(ASSISTANT_M2_PATHS),cache=new Map([[receipt,prior]])
 return {manifest:a,previousBytes:p=>{
  if(p===file)throw Object.assign(Error('M2 adoption absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
