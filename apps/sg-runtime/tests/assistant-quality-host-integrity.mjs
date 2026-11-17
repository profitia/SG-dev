// Source-test continuation only; this cannot grant a QA purpose or activation.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const QUALITY_HOST_BASE='d9413b1945d54cbbf730a3437f9b2d368095e98e'
export const QUALITY_HOST_RECEIPT='apps/sg-runtime/assistant-quality-host-integration.json'
export const QUALITY_HOST_PATHS=Object.freeze([
 'apps/sg-runtime/lib/assistant/conversation.ts',
 'apps/sg-runtime/lib/assistant/runtime.ts',
 'apps/sg-runtime/lib/assistant/quality-response.ts',
 'apps/sg-runtime/lib/assistant/quality-evidence.ts',
 'apps/sg-runtime/migrations/002-assistant-quality-evidence.sql',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/package-lock.json',
 'apps/sg-runtime/tests/assistant-conversation-handler.test.ts',
 'apps/sg-runtime/tests/assistant-quality-response.test.ts',
 'apps/sg-runtime/tests/assistant-quality-evidence.test.ts',
 'apps/sg-runtime/tests/assistant-quality-integrity.mjs',
 'apps/sg-runtime/tests/assistant-quality-host-integrity.mjs',
 'apps/sg-runtime/tests/assistant-quality-host-integrity.test.mjs',
 'apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs',
 'apps/architecture-lab/private-recurring-source.mjs',
 'packages/platform-contracts/test/recurring-consent-transport-source.mjs'
])
export const QUALITY_HOST_PRESERVED=Object.freeze([
 'apps/sg-runtime/assistant-quality-integration.json',
 'apps/sg-runtime/operation-integration.json',
 'apps/sg-runtime/assistant-context-integration.json',
 'apps/sg-runtime/assistant-ecr-integration.json',
 'apps/sg-runtime/assistant-ecr-precision-integration.json',
 'apps/sg-runtime/assistant-markdown-integration.json',
 'apps/sg-runtime/assistant-send-arrow-integration.json',
 'apps/sg-runtime/registration-stage-i-integration.json',
 'apps/sg-runtime/procurement-insights-integration.json',
 'apps/sg-runtime/procurement-insights-completion-integration.json',
 'apps/sg-runtime/procurement-insights-shell-integration.json'
])
export const QUALITY_CIC_PIN=Object.freeze({version:'1.8.0',
 resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.8.0/797fccee13eb0ce11f7130793218c80d7d542d7a',
 integrity:'sha512-tuun88+cfOHFeCafBw1a8gnExgeDyWBgY7Zd9OPkKk2/Eef0YBP49vzDcXKVpFoCNJGh/CYbeR9B+M2ZXctNsg=='})
const publication={repository:'profitia/conversational-intelligence-core',sourceSha:'c0053dcd55a3ed9f74584733627f6e9c130d4b49',
 runId:'43282280865',artifactId:'13973416582',artifactZipSha256:'6302e2182bee731bbb771b2c55da0a2fdbe2d023e512492f7f478a9f966616cc',
 tag:'development',latestUnchanged:'1.6.0'}
const added=new Set(QUALITY_HOST_PATHS.filter(p=>p.includes('/quality-response.')||p.includes('/quality-evidence.')||p.includes('/002-assistant-quality-evidence.')||p.includes('/assistant-quality-response.')||p.includes('/assistant-quality-evidence.')||p.includes('/assistant-quality-host-integrity.')))
const hash=b=>createHash('sha256').update(b).digest('hex')
export function assistantQualityHostPredecessor(current,historical){
 let bytes
 try{bytes=current(QUALITY_HOST_RECEIPT)}catch(e){
  const text=String(e?.stderr??e?.message??'')
  if(e?.code==='ENOENT'||e?.status===128&&(text.includes("'"+QUALITY_HOST_RECEIPT+"' does not exist in ")||text.includes("'"+QUALITY_HOST_RECEIPT+"' exists on disk, but not in ")))return null
  throw e
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','scope','targetEnvironment','previousSourceSha','sourceDigests','previousReceipts','cicPublication','responseProtectionActivated','privateQaActivated','cloudInstallationPerformed','pilotStarted'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-CIC-QUALITY-TECHNICAL-READY-20261117')
 assert.equal(a.scope,'CONTROLLED_CIC18_HOST_AND_PRIVATE_QA_SOURCE');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,QUALITY_HOST_BASE);assert.deepEqual(a.cicPublication,publication)
 for(const k of ['responseProtectionActivated','privateQaActivated','cloudInstallationPerformed','pilotStarted'])assert.equal(a[k],false,k)
 const common='apps/architecture-lab/private-recurring-source.mjs',hasCommon=Object.hasOwn(a.sourceDigests,common)
 const transport='packages/platform-contracts/test/recurring-consent-transport-source.mjs',hasTransport=Object.hasOwn(a.sourceDigests,transport)
 const paths=QUALITY_HOST_PATHS.filter(p=>(p!==common||hasCommon)&&(p!==transport||hasTransport))
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...paths].sort())
 for(const p of paths){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact quality host source '+p)}
 assert.deepEqual(Object.keys(a.previousReceipts).sort(),[...QUALITY_HOST_PRESERVED].sort())
 for(const p of QUALITY_HOST_PRESERVED){assert.equal(hash(current(p)),a.previousReceipts[p]);assert.equal(hash(historical(QUALITY_HOST_BASE,p)),a.previousReceipts[p],'immutable previous receipt '+p)}
 const manifest=JSON.parse(current('apps/sg-runtime/package.json')),before=JSON.parse(historical(QUALITY_HOST_BASE,'apps/sg-runtime/package.json'))
 const expected=structuredClone(before);expected.dependencies['@profitia/cic-core']='1.8.0'
 expected.scripts['test:assistant']+=' && node --import tsx --test tests/assistant-quality-response.test.ts tests/assistant-quality-evidence.test.ts && node --test tests/assistant-quality-host-integrity.test.mjs'
 assert.deepEqual(manifest,expected,'only the published core version and exact QA tests change')
 const lock=JSON.parse(current('apps/sg-runtime/package-lock.json')),previous=JSON.parse(historical(QUALITY_HOST_BASE,'apps/sg-runtime/package-lock.json'))
 previous.packages[''].dependencies['@profitia/cic-core']='1.8.0'
 Object.assign(previous.packages['node_modules/@profitia/cic-core'],QUALITY_CIC_PIN)
 assert.deepEqual(lock,previous,'no other registry, local package or dependency change')
 const beforeCommon=String(historical(QUALITY_HOST_BASE,common)),commonHead="export function recurringSourcePredecessor(current,historical){\n",commonImport=hasTransport?"import {assistantQualityPredecessor,QUALITY_RECEIPT} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n":"import {assistantQualityPredecessor} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n",commonPrefix=hasTransport?" const quality=assistantQualityPredecessor(current,historical);if(quality){const accepted=recurringSourcePredecessor(quality.previousBytes,historical);assert(accepted,'accepted recurring source retained');return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}}\n":" const quality=assistantQualityPredecessor(current,historical);if(quality)return recurringSourcePredecessor(quality.previousBytes,historical)\n"
 assert.equal(beforeCommon.split(commonHead).length,2,'one original recurring source entry')
 assert.equal(String(current(common)),hasCommon?commonImport+beforeCommon.replace(commonHead,commonHead+commonPrefix):beforeCommon,'only exact additive quality dispatch precedes original recurring checks')
 const beforeTransport=String(historical(QUALITY_HOST_BASE,transport)),transportHead="export function recurringConsentTransportPredecessor(current,historical){\n",transportImport="import {assistantQualityPredecessor} from '../../../apps/sg-runtime/tests/assistant-quality-integrity.mjs'\n",transportPrefix=" const quality=assistantQualityPredecessor(current,historical);if(quality)return recurringConsentTransportPredecessor(quality.previousBytes,historical)\n"
 assert.equal(beforeTransport.split(transportHead).length,2,'one original consent transport source entry')
 assert.equal(String(current(transport)),hasTransport?transportImport+beforeTransport.replace(transportHead,transportHead+transportPrefix):beforeTransport,'only exact additive quality dispatch precedes original consent transport checks')
 const mapped=new Set(paths),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===QUALITY_HOST_RECEIPT||added.has(p))throw Object.assign(Error('Quality host absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(QUALITY_HOST_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
