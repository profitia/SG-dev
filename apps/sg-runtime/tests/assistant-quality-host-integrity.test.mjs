import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantQualityHostPredecessor,QUALITY_HOST_PATHS,QUALITY_HOST_PRESERVED,QUALITY_HOST_RECEIPT,QUALITY_HOST_BASE} from './assistant-quality-host-integrity.mjs'
import {QUALITY_PATHS,QUALITY_RECEIPT} from './assistant-quality-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
test('CIC1.8 host continuation binds every current file, actual package artifact and immutable earlier source receipt',()=>{
 const v=assistantQualityHostPredecessor(current,historical);assert(v)
 for(const p of [...QUALITY_HOST_PATHS,...QUALITY_HOST_PRESERVED])assert.throws(()=>assistantQualityHostPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)
 assert.deepEqual(v.previousBytes('apps/sg-runtime/lib/assistant/conversation.ts'),historical(QUALITY_HOST_BASE,'apps/sg-runtime/lib/assistant/conversation.ts'))
 assert.throws(()=>v.previousBytes('apps/sg-runtime/lib/assistant/quality-response.ts'),{code:'ENOENT'})
})
test('host source metadata cannot activate private QA, start a pilot, publish another CIC artifact or weaken dependency policy',()=>{
 for(const mutate of [a=>a.responseProtectionActivated=true,a=>a.privateQaActivated=true,a=>a.cloudInstallationPerformed=true,a=>a.pilotStarted=true,
  a=>a.cicPublication.sourceSha='0'.repeat(40),a=>a.cicPublication.artifactZipSha256='0'.repeat(64),a=>a.sourceDigests['apps/srm/unadmitted.ts']='0'.repeat(64),a=>a.unadmitted=true]){
  const a=JSON.parse(current(QUALITY_HOST_RECEIPT));mutate(a)
  assert.throws(()=>assistantQualityHostPredecessor(p=>p===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 assert.equal(assistantQualityHostPredecessor(()=>{throw Object.assign(Error('ABSENT'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>assistantQualityHostPredecessor(()=>{throw Object.assign(Error('DENIED'),{code:'EACCES'})},historical),{code:'EACCES'})
})

test('direct consent transport entry authenticates CIC first and retains all historical transport checks',async()=>{
 const {recurringConsentTransportPredecessor}=await import('../../../packages/platform-contracts/test/recurring-consent-transport-source.mjs')
 const accepted=recurringConsentTransportPredecessor(current,historical);assert(accepted)
 const p='apps/architecture-lab/private-recurring-source.mjs'
 assert.throws(()=>recurringConsentTransportPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical))
 assert.throws(()=>recurringConsentTransportPredecessor(f=>f===QUALITY_HOST_RECEIPT?Buffer.from('{}'):current(f),historical))
})

test('authenticated recurring source graph covers every actual CIC app amendment and no unknown path',async()=>{
 const {recurringSourcePredecessor}=await import('../../architecture-lab/private-recurring-source.mjs')
 const bound=recurringSourcePredecessor(current,historical).manifest.sourceDigests
 const changed=execFileSync('git',['diff','--name-only','origin/main...HEAD','--','apps/sg-runtime'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean)
 // Compare committed candidate source, excluding reproducible Prisma outputs
 // changed by lifecycle installation. On resulting main the PR diff is empty;
 // every closed CIC path must still be independently authenticated.
 const admitted=[...new Set([...QUALITY_PATHS,...QUALITY_HOST_PATHS,QUALITY_RECEIPT,QUALITY_HOST_RECEIPT].filter(p=>p.startsWith('apps/sg-runtime/')))]
 assert.equal(admitted.length,23,'the complete closed CIC app inventory')
 const {createHash}=await import('node:crypto')
 for(const p of new Set([...admitted,...changed]))assert.equal(bound[p],createHash('sha256').update(current(p)).digest('hex'),p)
 assert.equal(Object.hasOwn(bound,'apps/sg-runtime/unreviewed.ts'),false)
})

test('actual notification and live source entry points accept the authenticated CIC successor without changing their receipts',async()=>{
 const {assistantNotificationsPredecessor}=await import('./assistant-notifications-integrity.mjs')
 const {procurementInsightsLiveAcceptancePredecessor}=await import('./procurement-insights-live-acceptance-source.mjs')
 const {finderMonitorPredecessor}=await import('./finder-monitor-source-integrity.mjs')
 const {procurementInsightsEditorialPackagePredecessor}=await import('./procurement-insights-editorial-package-integrity.mjs')
 const composed=procurementInsightsEditorialPackagePredecessor(current,historical);assert(composed)
 assert(finderMonitorPredecessor(composed.previousBytes,historical))
 assert(assistantNotificationsPredecessor(current,historical))
 assert(procurementInsightsLiveAcceptancePredecessor(current,historical))
})

test('accepted editorial F metadata, helper and all prior receipts remain independently authenticated with CIC',async()=>{
 const {procurementInsightsEditorialPackagePredecessor}=await import('./procurement-insights-editorial-package-integrity.mjs')
 const receipt='apps/sg-runtime/procurement-insights-editorial-package-integration.json'
 const a=JSON.parse(current(receipt))
 for(const p of [receipt,...Object.keys(a.sourceDigests),...Object.keys(a.preservedReceipts)])assert.throws(()=>procurementInsightsEditorialPackagePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)
 const lock='apps/sg-runtime/package-lock.json',bad=JSON.parse(current(lock));bad.packages['node_modules/@profitia/insights-runtime'].version='1.2.2'
 assert.throws(()=>procurementInsightsEditorialPackagePredecessor(p=>p===lock?Buffer.from(JSON.stringify(bad)):current(p),historical))
})

test('CI27 composition authenticates current ACG and CIC independently before retaining both frozen predecessor chains',async()=>{
 const {assistantReservationPredecessor,RESERVATION_PATHS,RESERVATION_RECORD,RESERVATION_DERIVED}=await import('../../../packages/platform-contracts/test/assistant-reservation-source.mjs')
 const pin='bfa9287d9a0a17ef0a935ddc2c0f66c46b42d6c415b2b1fda0d237d2e38fc8b8'
 const v=assistantReservationPredecessor(current,historical,pin);assert(v?.quality?.host?.acceptedComposition)
 assert.deepEqual(current(RESERVATION_RECORD),historical('53691e907e4cc9b7fbf683c91bbebf41299e9ccc',RESERVATION_RECORD))
 const {createHash}=await import('node:crypto')
 for(const p of [...new Set([...QUALITY_HOST_PATHS,...RESERVATION_PATHS,RESERVATION_DERIVED,RESERVATION_RECORD])]){
  assert.throws(()=>assistantReservationPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNADMITTED')]):current(f),historical,pin),p)
  if(Object.hasOwn(v.manifest.sourceDigests,p))assert.equal(v.manifest.sourceDigests[p],createHash('sha256').update(current(p)).digest('hex'),p)
 }
 for(const mutate of [a=>a.acceptedComposition.sourceSha='0'.repeat(40),a=>a.acceptedComposition.componentSourceSha='0'.repeat(40),
  a=>a.acceptedComposition.reservationRecordSha256='0'.repeat(64),a=>delete a.sourceDigests['packages/platform-contracts/test/assistant-reservation-source.mjs']]){
  const a=JSON.parse(current(QUALITY_HOST_RECEIPT));mutate(a)
  assert.throws(()=>assistantReservationPredecessor(p=>p===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical,pin))
 }
})

test('self-refreshed current source hashes cannot admit another library, test command or core artifact',async()=>{
 const {assistantReservationPredecessor}=await import('../../../packages/platform-contracts/test/assistant-reservation-source.mjs')
 const {createHash}=await import('node:crypto')
 for(const [path,mutate]of [
  ['apps/sg-runtime/package.json',p=>p.dependencies.openai='0.0.0'],
  ['apps/sg-runtime/package.json',p=>p.scripts['test:assistant']='node -e "process.exit(0)"'],
  ['apps/sg-runtime/package-lock.json',p=>p.packages['node_modules/@profitia/cic-core'].integrity='sha512-unapproved'],
  ['apps/sg-runtime/package-lock.json',p=>p.packages['node_modules/@profitia/insights-runtime'].version='1.2.2']]){
  const changed=JSON.parse(current(path));mutate(changed);const bytes=Buffer.from(JSON.stringify(changed))
  const a=JSON.parse(current(QUALITY_HOST_RECEIPT));a.sourceDigests[path]=createHash('sha256').update(bytes).digest('hex')
  assert.throws(()=>assistantReservationPredecessor(p=>p===path?bytes:p===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical,
   'bfa9287d9a0a17ef0a935ddc2c0f66c46b42d6c415b2b1fda0d237d2e38fc8b8'),
   e=>e?.code==='ERR_ASSERTION'&&String(e.message).includes('current admitted CIC'),path)
 }
})

test('finite CIC projection retains unrelated current inputs and their native access errors',()=>{
 const p='Canon/evidence/aqc-unrelated-current-canary.json',bytes=Buffer.from('current unrelated input')
 const view=assistantQualityHostPredecessor(f=>f===p?bytes:current(f),historical)
 for(const read of [view.previousBytes,view.legacyPreviousBytes,view.compositionPreviousBytes])assert.deepEqual(read(p),bytes)
 const denied=assistantQualityHostPredecessor(f=>{if(f===p)throw Object.assign(Error('DENIED'),{code:'EACCES'});return current(f)},historical)
 for(const read of [denied.previousBytes,denied.legacyPreviousBytes,denied.compositionPreviousBytes])assert.throws(()=>read(p),{code:'EACCES'})
})


test('real SDK entry composes CIC before the complete Knowledge and ACG predecessors',async()=>{
 const {assistantSdkPredecessor}=await import('../../architecture-lab/assistant-m1-sdk-compatibility.mjs')
 const v=assistantSdkPredecessor(current,historical);assert(v?.record?.sdkDigests)
 for(const p of ['apps/sg-runtime/tests/assistant-ecr-integrity.mjs','apps/architecture-lab/private-recurring-source.mjs','apps/architecture-lab/knowledge-source.json',QUALITY_HOST_RECEIPT])
  assert.throws(()=>assistantSdkPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED_SDK_COMPOSITION')]):current(f),historical),p)
 const p='apps/sg-runtime/tests/assistant-ecr-integrity.mjs',changed=Buffer.concat([current(p),Buffer.from('UNREVIEWED_SELF_REFRESH')]),a=JSON.parse(current(QUALITY_HOST_RECEIPT))
 const {createHash}=await import('node:crypto');a.sourceDigests[p]=createHash('sha256').update(changed).digest('hex')
 assert.throws(()=>assistantSdkPredecessor(f=>f===p?changed:f===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(f),historical),e=>e?.code==='ERR_ASSERTION'&&String(e.message).includes('only additive accepted composition selection'))
 const denied=Object.assign(Error('DENIED'),{code:'EACCES'})
 assert.throws(()=>assistantSdkPredecessor(f=>{if(f==='apps/architecture-lab/private-recurring-source.mjs')throw denied;return current(f)},historical),e=>e===denied)
})

test('direct precision entry authenticates the same accepted composition and rejects self-rebound older dispatch',async()=>{
 const {assistantEcrPrecisionPredecessor}=await import('./assistant-ecr-precision-integrity.mjs')
 const value=assistantEcrPrecisionPredecessor(current,historical);assert.equal(value.manifest.scope,'NATIVE_ECR_SCHEDULE_PRECISION')
 const p='apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs',bytes=Buffer.from(String(current(p)).replace('quality.compositionPreviousBytes??quality.previousBytes','quality.previousBytes'))
 assert.notDeepEqual(bytes,current(p))
 const {createHash}=await import('node:crypto'),a=JSON.parse(current(QUALITY_HOST_RECEIPT));a.sourceDigests[p]=createHash('sha256').update(bytes).digest('hex')
 const changed=f=>f===p?bytes:f===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(f)
 assert.throws(()=>assistantQualityHostPredecessor(changed,historical),e=>e?.code==='ERR_ASSERTION'&&String(e.message).includes('only additive accepted precision composition selection'))
 assert.throws(()=>assistantEcrPrecisionPredecessor(changed,historical))
 const denied=Object.assign(Error('DENIED'),{code:'EACCES'})
 assert.throws(()=>assistantEcrPrecisionPredecessor(f=>{if(f===p)throw denied;return current(f)},historical),e=>e===denied)
})
