// Build/test source continuation only. This cannot authorise a runtime read or deployment.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const ECR_RECEIPT='apps/sg-runtime/assistant-ecr-integration.json'
export const ECR_BASE='fa81114d35281693604833f1b7639b3c3b829ce6'
export const ECR_PATHS=Object.freeze([
 'apps/sg-runtime/deployment/assistant-ecr-targets.json',
 'apps/sg-runtime/lib/assistant/context-selection.ts',
 'apps/sg-runtime/lib/assistant/conversation.ts',
 'apps/sg-runtime/lib/assistant/history.ts',
 'apps/sg-runtime/lib/assistant/runtime.ts',
 'apps/sg-runtime/lib/assistant/sources.ts',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/package-lock.json',
 'apps/sg-runtime/tests/assistant-economic-calendar.test.ts',
 'apps/sg-runtime/tests/assistant-conversation-handler.test.ts',
 'apps/sg-runtime/tests/assistant-ecr-integrity.mjs',
 'apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-history-postgres.test.mjs',
 'apps/sg-runtime/tests/assistant-multi-source.test.ts',
 'apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs',
 'apps/sg-runtime/tests/assistant-send-arrow-integrity.test.mjs',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
 'packages/assistant-context-contracts/package.json',
 'packages/assistant-context-contracts/src/index.d.mts',
 'packages/assistant-context-contracts/src/index.mjs',
 'packages/assistant-context-contracts/test/contracts.test.mjs',
 'packages/assistant-context-gateway/package.json',
 'packages/assistant-context-gateway/src/economic-calendar.mjs',
 'packages/assistant-context-gateway/src/index.d.mts',
 'packages/assistant-context-gateway/src/index.mjs',
 'packages/assistant-context-gateway/test/economic-calendar.test.mjs',
])
export const ECR_ADDITIONS=Object.freeze([
 'apps/sg-runtime/deployment/assistant-ecr-targets.json',
 'apps/sg-runtime/tests/assistant-economic-calendar.test.ts',
 'apps/sg-runtime/tests/assistant-ecr-integrity.mjs',
 'apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs',
 'packages/assistant-context-gateway/src/economic-calendar.mjs',
 'packages/assistant-context-gateway/test/economic-calendar.test.mjs',
])
export const ECR_PRESERVED_RECEIPTS=Object.freeze([
 'apps/sg-runtime/operation-integration.json',
 'apps/sg-runtime/assistant-context-integration.json',
 'apps/sg-runtime/procurement-insights-integration.json',
 'apps/sg-runtime/assistant-markdown-integration.json',
 'apps/sg-runtime/registration-stage-i-integration.json',
 'apps/sg-runtime/assistant-send-arrow-integration.json',
])
export const ECR_CIC_PUBLICATION=Object.freeze({
 repository:'profitia/conversational-intelligence-core',sourceSha:'e3b9825e47c9189e808425aa355b94417e124dae',
 workflowRun:42979465366,version:'1.6.0',shasum:'6201251ccac36d5d207f87dfdd40a1547c351753',
 resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.6.0/6201251ccac36d5d207f87dfdd40a1547c351753',
 integrity:'sha512-F2Kkx37hkbqaa8JKkChrrpLsK/9C92lJYwxw5Rl2s97MZZsLfaQCQQmwjwKvwoj34YdIT7tbZ1TOElhf63GckQ==',
})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const json=bytes=>JSON.parse(Buffer.from(bytes).toString('utf8'))
export function assistantEcrPredecessor(current,historical){
 let bytes
 try{bytes=current(ECR_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  const missingGit=error?.status===128&&(text.includes("'"+ECR_RECEIPT+"' does not exist in ")||text.includes("'"+ECR_RECEIPT+"' exists on disk, but not in "))
  if(error?.code==='ENOENT'||missingGit)return null
  throw error
 }
 const a=json(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','producerTaskId','cicTaskId','targetEnvironment','scope','previousSourceSha',
  'sourceDigests','previousReceipts','cicPublication','authorisationChanged','schemaChanged','providerAcquisitionAdded','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ACG-ECR-CONTEXT-20261111')
 assert.equal(a.producerTaskId,'ARCHITECTURE-ACG-ECR-CONTEXT-20261111');assert.equal(a.cicTaskId,'CIC-ACG-ECR-CONTEXT-20261111')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'OPTIONAL_ECR_CONTEXT_SOURCE');assert.equal(a.previousSourceSha,ECR_BASE)
 for(const flag of ['authorisationChanged','schemaChanged','providerAcquisitionAdded','deploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.deepEqual(a.cicPublication,ECR_CIC_PUBLICATION)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...ECR_PATHS].sort(),'closed ECR source inventory')
 for(const p of ECR_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact ECR source '+p)}
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...ECR_PRESERVED_RECEIPTS].sort())
 for(const p of ECR_PRESERVED_RECEIPTS){
  assert.equal(hash(historical(ECR_BASE,p)),a.previousReceipts[p],'original ECR predecessor '+p)
  assert.equal(hash(current(p)),a.previousReceipts[p],'immutable earlier receipt '+p)
 }
 // Only the published CIC dependency and the two real regression entry points may change.
 const manifest='apps/sg-runtime/package.json',lockfile='apps/sg-runtime/package-lock.json'
 const priorPackage=json(historical(ECR_BASE,manifest)),expected=structuredClone(priorPackage)
 expected.dependencies['@profitia/cic-core']=ECR_CIC_PUBLICATION.version
 expected.scripts['test:assistant']=expected.scripts['test:assistant']
  .replace('tests/assistant-history.test.ts','tests/assistant-economic-calendar.test.ts tests/assistant-history.test.ts')
  .replace('tests/assistant-m1-integrity.test.mjs','tests/assistant-ecr-integrity.test.mjs tests/assistant-m1-integrity.test.mjs')
 assert.deepEqual(json(current(manifest)),expected,'only the exact CIC upgrade and real ECR tests')
 const priorLock=json(historical(ECR_BASE,lockfile)),lock=json(current(lockfile)),core=lock.packages['node_modules/@profitia/cic-core']
 assert.equal(core.version,ECR_CIC_PUBLICATION.version);assert.equal(core.integrity,ECR_CIC_PUBLICATION.integrity)
 assert.equal(core.resolved,ECR_CIC_PUBLICATION.resolved)
 const expectedLock=structuredClone(priorLock)
 expectedLock.packages[''].dependencies['@profitia/cic-core']=ECR_CIC_PUBLICATION.version
 expectedLock.packages['node_modules/@profitia/cic-core']={...priorLock.packages['node_modules/@profitia/cic-core'],version:core.version,resolved:core.resolved,integrity:core.integrity}
 assert.deepEqual(lock,expectedLock,'all unrelated packages, scripts and private dependency metadata preserved')
 const mapped=new Set(ECR_PATHS),added=new Set(ECR_ADDITIONS),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(p===ECR_RECEIPT||added.has(p))throw Object.assign(Error('ECR source absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(ECR_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
