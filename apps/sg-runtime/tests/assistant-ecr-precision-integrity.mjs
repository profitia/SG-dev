// Build/test-only continuation of the accepted ECR source. No runtime authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const PRECISION_RECEIPT='apps/sg-runtime/assistant-ecr-precision-integration.json'
export const PRECISION_BASE='141cc559063c43cefa991acb9260b32ac5b92615'
export const PRECISION_PATHS=Object.freeze([
 'packages/assistant-context-gateway/src/economic-calendar.mjs',
 'packages/assistant-context-gateway/test/economic-calendar.test.mjs',
 'apps/sg-runtime/tests/assistant-ecr-integrity.mjs',
 'apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
])
export const PRECISION_RECEIPTS=Object.freeze([
 'apps/sg-runtime/operation-integration.json',
 'apps/sg-runtime/assistant-context-integration.json',
 'apps/sg-runtime/procurement-insights-integration.json',
 'apps/sg-runtime/assistant-markdown-integration.json',
 'apps/sg-runtime/registration-stage-i-integration.json',
 'apps/sg-runtime/assistant-send-arrow-integration.json',
 'apps/sg-runtime/assistant-ecr-integration.json',
])
const hash=b=>createHash('sha256').update(b).digest('hex')
export function assistantEcrPrecisionPredecessor(current,historical){
 let bytes
 try{bytes=current(PRECISION_RECEIPT)}catch(error){
  const message=String(error?.stderr??error?.message??'')
  const missing=error?.status===128&&(message.includes("'"+PRECISION_RECEIPT+"' does not exist in ")||message.includes("'"+PRECISION_RECEIPT+"' exists on disk, but not in "))
  if(error?.code==='ENOENT'||missing)return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','producerTaskId','targetEnvironment','scope','previousSourceSha','sourceDigests','previousReceipts','authorisationChanged','schemaChanged','providerAcquisitionAdded','modelChanged','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ACG-ECR-CONTEXT-20261111')
 assert.equal(a.producerTaskId,'ARCHITECTURE-ACG-ECR-TIME-PRECISION-20261111');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.scope,'NATIVE_ECR_SCHEDULE_PRECISION');assert.equal(a.previousSourceSha,PRECISION_BASE)
 for(const key of ['authorisationChanged','schemaChanged','providerAcquisitionAdded','modelChanged','deploymentPerformed'])assert.equal(a[key],false,key)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...PRECISION_PATHS].sort())
 for(const p of PRECISION_PATHS)assert.equal(hash(current(p)),a.sourceDigests[p],'exact ECR precision source '+p)
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...PRECISION_RECEIPTS].sort())
 for(const p of PRECISION_RECEIPTS){
  assert.equal(hash(historical(PRECISION_BASE,p)),a.previousReceipts[p],'accepted predecessor receipt '+p)
  assert.equal(hash(current(p)),a.previousReceipts[p],'immutable ECR receipt '+p)
 }
 const path='apps/sg-runtime/tests/assistant-ecr-integrity.mjs',before=Buffer.from(historical(PRECISION_BASE,path)).toString('utf8')
 const expected=before.replace("import assert from 'node:assert/strict'","import {assistantEcrPrecisionPredecessor} from './assistant-ecr-precision-integrity.mjs'\nimport assert from 'node:assert/strict'")
  .replace('export function assistantEcrPredecessor(current,historical){','export function assistantEcrPredecessor(current,historical){\n const precision=assistantEcrPrecisionPredecessor(current,historical);if(precision)return assistantEcrPredecessor(precision.previousBytes,historical)')
 assert.equal(Buffer.from(current(path)).toString('utf8'),expected,'only additive ECR continuation')
 const scope='apps/sg-runtime/tests/pci-smart-integrity.test.mjs',scopeBefore=Buffer.from(historical(PRECISION_BASE,scope)).toString('utf8')
 const scopeExpected=scopeBefore
  .replace("import {assistantEcrPredecessor,ECR_RECEIPT} from './assistant-ecr-integrity.mjs'","import {assistantEcrPredecessor,ECR_RECEIPT} from './assistant-ecr-integrity.mjs'\nimport {assistantEcrPrecisionPredecessor,PRECISION_RECEIPT} from './assistant-ecr-precision-integrity.mjs'")
  .replace(' const ecr=assistantEcrPredecessor(current,historical)\n const arrow=',' const precision=assistantEcrPrecisionPredecessor(current,historical)\n const ecr=assistantEcrPredecessor(current,historical)\n const arrow=')
  .replace('.filter(file=>(!ecr||file!==ECR_RECEIPT)&&','.filter(file=>(!precision||file!==PRECISION_RECEIPT)&&(!ecr||file!==ECR_RECEIPT)&&')
  .replace('assertSourceCoverage(changed,{...ecr?.manifest.sourceDigests,','assertSourceCoverage(changed,{...precision?.manifest.sourceDigests,...ecr?.manifest.sourceDigests,')
 assert.equal(Buffer.from(current(scope)).toString('utf8'),scopeExpected,'only verified precision bindings extend candidate coverage')
 const tests='apps/sg-runtime/tests/assistant-ecr-integrity.test.mjs'
 assert(Buffer.from(current(tests)).toString('utf8').startsWith(Buffer.from(historical(PRECISION_BASE,tests)).toString('utf8')),'all accepted ECR regressions retained')
 const mapped=new Set(PRECISION_PATHS),added='apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs',cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===PRECISION_RECEIPT||p===added)throw Object.assign(Error('Precision addition absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(PRECISION_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
