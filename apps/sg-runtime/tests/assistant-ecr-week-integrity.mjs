// Test/build-only source continuation. Never imported by product code.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const WEEK_RECEIPT="apps/sg-runtime/assistant-ecr-week-integration.json"
export const WEEK_BASE="b6df3533750d0278440b0a432e412731bff47a42"
export const WEEK_PATHS=Object.freeze([
 "apps/sg-runtime/components/appshell/assistant-conversation-session.ts",
 "apps/sg-runtime/lib/assistant/context-selection.ts",
 "apps/sg-runtime/lib/assistant/conversation.ts",
 "apps/sg-runtime/lib/assistant/model.ts",
 "apps/sg-runtime/lib/assistant/runtime.ts",
 "apps/sg-runtime/tests/assistant-conversation-handler.test.ts",
 "apps/sg-runtime/tests/assistant-conversation.test.ts",
 "apps/sg-runtime/tests/assistant-economic-calendar.test.ts",
 "apps/sg-runtime/tests/assistant-model.test.ts",
 "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
 "apps/sg-runtime/tests/assistant-ecr-week-integrity.mjs",
 "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs"
])
export const WEEK_RECEIPTS=Object.freeze([
 "apps/sg-runtime/operation-integration.json",
 "apps/sg-runtime/assistant-context-integration.json",
 "apps/sg-runtime/procurement-insights-integration.json",
 "apps/sg-runtime/assistant-markdown-integration.json",
 "apps/sg-runtime/registration-stage-i-integration.json",
 "apps/sg-runtime/assistant-send-arrow-integration.json",
 "apps/sg-runtime/assistant-ecr-integration.json",
 "apps/sg-runtime/assistant-ecr-precision-integration.json",
 "apps/sg-runtime/private-recurring-source-adoption.json",
 "apps/architecture-lab/private-recurring-source.json",
 "apps/architecture-lab/private-recurring-source-adoption.json",
 "apps/srm/private-recurring-source-adoption.json"
])
const ARCH="apps/architecture-lab/private-recurring-source.mjs",ADDITIONS=new Set(["apps/sg-runtime/tests/assistant-ecr-week-integrity.mjs","apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs"])
const hash=b=>createHash('sha256').update(b).digest('hex')
export function weekArchitectureSource(before,pin){
 const marker="import assert from 'node:assert/strict'",entry='export function recurringSourcePredecessor(current,historical){'
 assert.equal(before.split(marker).length,2);assert.equal(before.split(entry).length,2)
 return before.replace(marker,"import {assistantEcrWeekPredecessor} from '../sg-runtime/tests/assistant-ecr-week-integrity.mjs'\nexport const ECR_WEEK_SOURCE_SHA='"+pin+"'\n"+marker)
  .replace(entry,entry+"\n const successor=assistantEcrWeekPredecessor(current,historical,ECR_WEEK_SOURCE_SHA)\n if(successor){const accepted=recurringSourcePredecessor(successor.previousBytes,historical);assert(accepted,'accepted recurring source retained');return {...accepted,successor}}")
}
export function weekScopeSource(before){
 return before.replace("import './assistant-ecr-integrity.test.mjs'","import './assistant-ecr-integrity.test.mjs'\nimport './assistant-ecr-week-integrity.test.mjs'\nimport {WEEK_RECEIPT} from './assistant-ecr-week-integrity.mjs'")
  .replace(' const recurring=recurringSourcePredecessor(current,historical)',' const recurring=recurringSourcePredecessor(current,historical)\n const week=recurring?.successor')
  .replace("(!recurring||file!=='apps/sg-runtime/private-recurring-source-adoption.json')","(!week||file!==WEEK_RECEIPT)&&(!recurring||file!=='apps/sg-runtime/private-recurring-source-adoption.json')")
  .replace('assertSourceCoverage(changed,{','assertSourceCoverage(changed,{...week?.manifest.sourceDigests,')
}
export function assistantEcrWeekPredecessor(current,historical,expectedDigest){
 let bytes
 try{bytes=current(WEEK_RECEIPT)}catch(e){
  const message=String(e?.stderr??e?.message??'')
  if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>message.includes("'"+WEEK_RECEIPT+s)))return null
  throw e
 }
 assert.match(expectedDigest??'',/^[a-f0-9]{64}$/);assert.equal(hash(bytes),expectedDigest,'exact reviewed ECR week source record')
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','producerTaskId','targetEnvironment','scope','previousSourceSha','sourceDigests','previousReceipts','authorisationChanged','schemaChanged','modelChanged','limitsChanged','providerAcquisitionAdded','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-ACG-ECR-INCOMPLETE-20261111');assert.equal(a.producerTaskId,'ARCH-ACG-ECR-WEEK-ADOPTION-20261111')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'ASSISTANT_ECR_WEEKS_AND_ADMISSION_CORRECTION');assert.equal(a.previousSourceSha,WEEK_BASE)
 for(const k of ['authorisationChanged','schemaChanged','modelChanged','limitsChanged','providerAcquisitionAdded','deploymentPerformed'])assert.equal(a[k],false,k)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...WEEK_PATHS].sort())
 for(const p of WEEK_PATHS)assert.equal(hash(current(p)),a.sourceDigests[p],'exact current ECR correction '+p)
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...WEEK_RECEIPTS].sort())
 for(const p of WEEK_RECEIPTS){assert.equal(hash(current(p)),a.previousReceipts[p],'immutable receipt '+p);assert.equal(hash(historical(WEEK_BASE,p)),a.previousReceipts[p],'accepted receipt '+p)}
 assert.equal(String(current(ARCH)),weekArchitectureSource(String(historical(WEEK_BASE,ARCH)),expectedDigest),'only a bounded source continuation may extend the shared guard')
 const scope='apps/sg-runtime/tests/pci-smart-integrity.test.mjs'
 assert.equal(String(current(scope)),weekScopeSource(String(historical(WEEK_BASE,scope))),'strict candidate scope coverage retained')
 const mapped=new Set([...WEEK_PATHS,ARCH]),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===WEEK_RECEIPT||ADDITIONS.has(p))throw Object.assign(Error('ECR correction absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(WEEK_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
