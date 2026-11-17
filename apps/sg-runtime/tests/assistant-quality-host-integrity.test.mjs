import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantQualityHostPredecessor,QUALITY_HOST_PATHS,QUALITY_HOST_PRESERVED,QUALITY_HOST_RECEIPT,QUALITY_HOST_BASE} from './assistant-quality-host-integrity.mjs'
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
 const changed=execFileSync('git',['diff','--name-only','origin/main','--','apps/sg-runtime'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean)
 assert(changed.length>=22)
 const {createHash}=await import('node:crypto')
 for(const p of changed)assert.equal(bound[p],createHash('sha256').update(current(p)).digest('hex'),p)
 assert.equal(Object.hasOwn(bound,'apps/sg-runtime/unreviewed.ts'),false)
})

test('actual notification and live source entry points accept the authenticated CIC successor without changing their receipts',async()=>{
 const {assistantNotificationsPredecessor}=await import('./assistant-notifications-integrity.mjs')
 const {procurementInsightsLiveAcceptancePredecessor}=await import('./procurement-insights-live-acceptance-source.mjs')
 assert(assistantNotificationsPredecessor(current,historical))
 assert(procurementInsightsLiveAcceptancePredecessor(current,historical))
})
