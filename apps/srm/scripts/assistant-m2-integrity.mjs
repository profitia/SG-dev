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
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(hash(current(p)),h,'current M2 producer '+p)
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
