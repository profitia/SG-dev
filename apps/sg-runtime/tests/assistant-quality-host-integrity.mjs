import {knowledgeSourcePredecessor} from '../../../apps/architecture-lab/knowledge-source.mjs'
import {assistantReservationPredecessor,RESERVATION_RECORD} from '../../../packages/platform-contracts/test/assistant-reservation-source.mjs'
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
 'apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs',
 'packages/platform-contracts/test/assistant-reservation-source.mjs',
 'apps/architecture-lab/knowledge-source.mjs',
 'apps/architecture-lab/test/knowledge-source.test.mjs'
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
 if(a.acceptedComposition?.knowledgeRecordSha256!==undefined)return composedKnowledgeQualityHost(current,historical,a)
 if(Object.hasOwn(a,'acceptedComposition'))return composedQualityHost(current,historical,a)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','scope','targetEnvironment','previousSourceSha','sourceDigests','previousReceipts','cicPublication','responseProtectionActivated','privateQaActivated','cloudInstallationPerformed','pilotStarted'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-CIC-QUALITY-TECHNICAL-READY-20261117')
 assert.equal(a.scope,'CONTROLLED_CIC18_HOST_AND_PRIVATE_QA_SOURCE');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,QUALITY_HOST_BASE);assert.deepEqual(a.cicPublication,publication)
 for(const k of ['responseProtectionActivated','privateQaActivated','cloudInstallationPerformed','pilotStarted'])assert.equal(a[k],false,k)
 const common='apps/architecture-lab/private-recurring-source.mjs',hasCommon=Object.hasOwn(a.sourceDigests,common)
 const legacyTransport='apps/sg-runtime/tests/procurement-insights-editorial-integrity.mjs',finderTransport='apps/sg-runtime/tests/finder-monitor-source-integrity.mjs'
 const packageTransport='apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs',hasPackageTransport=Object.hasOwn(a.sourceDigests,packageTransport)
 const hasLegacyTransport=Object.hasOwn(a.sourceDigests,legacyTransport),hasFinderTransport=Object.hasOwn(a.sourceDigests,finderTransport)
 assert([hasLegacyTransport,hasFinderTransport,hasPackageTransport].filter(Boolean).length<=1,'one closed CI24 transport profile')
 const hasTransport=hasLegacyTransport||hasFinderTransport||hasPackageTransport,transport=hasPackageTransport?packageTransport:hasFinderTransport?finderTransport:legacyTransport
 const paths=QUALITY_HOST_PATHS.filter(p=>p!=='packages/platform-contracts/test/assistant-reservation-source.mjs'&&p!=='apps/architecture-lab/knowledge-source.mjs'&&p!=='apps/architecture-lab/test/knowledge-source.test.mjs'&&(p!==common||hasCommon)&&(p!==packageTransport||hasPackageTransport))
 if(hasFinderTransport)paths.push(finderTransport)
 if(hasLegacyTransport)paths.push(legacyTransport)
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
 if(hasPackageTransport){
  assert.equal(previous.packages['node_modules/@profitia/insights-runtime'].version,'1.2.0')
  previous.packages['node_modules/@profitia/insights-runtime'].version='1.2.1'
 }
 assert.deepEqual(lock,previous,'only exact accepted CIC and editorial package versions; no other dependency change')
 const beforeCommon=String(historical(QUALITY_HOST_BASE,common)),commonHead="export function recurringSourcePredecessor(current,historical){\n",commonImport=hasTransport?"import {assistantQualityPredecessor,QUALITY_RECEIPT} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n":"import {assistantQualityPredecessor} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n",commonPrefix=hasTransport?" const quality=assistantQualityPredecessor(current,historical);if(quality){const accepted=recurringSourcePredecessor(quality.previousBytes,historical);assert(accepted,'accepted recurring source retained');return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}}\n":" const quality=assistantQualityPredecessor(current,historical);if(quality)return recurringSourcePredecessor(quality.previousBytes,historical)\n"
 assert.equal(beforeCommon.split(commonHead).length,2,'one original recurring source entry')
 assert.equal(String(current(common)),hasCommon?commonImport+beforeCommon.replace(commonHead,commonHead+commonPrefix):beforeCommon,'only exact additive quality dispatch precedes original recurring checks')
 if(hasLegacyTransport){
 const beforeTransport=String(historical('936eaa61087516028564c6aaad2c46912b4729f7',transport)),transportHead="export function procurementInsightsEditorialPredecessor(current,historical){\n",transportImport="import {assistantQualityPredecessor} from './assistant-quality-integrity.mjs'\n",transportPrefix=" const quality=assistantQualityPredecessor(current,historical);if(quality)return procurementInsightsEditorialPredecessor(quality.previousBytes,historical)\n"
 assert.equal(beforeTransport.split(transportHead).length,2,'one original PI editorial acceptance source entry')
 assert.equal(String(current(transport)),hasTransport?transportImport+beforeTransport.replace(transportHead,transportHead+transportPrefix):beforeTransport,'only exact additive quality dispatch precedes original PI editorial acceptance checks')
 }
 if(hasFinderTransport){
 const beforeTransport=String(historical('77369b63888c5fa66d8d8159d5e8f36a23d25c83',finderTransport)),transportBoundary=" const a=JSON.parse(bytes)\n",transportImport="import {assistantQualityPredecessor,QUALITY_RECEIPT} from './assistant-quality-integrity.mjs'\n",transportPrefix=" const quality=assistantQualityPredecessor(current,historical)\n if(quality){\n  const accepted=finderMonitorPredecessor(quality.previousBytes,historical);assert(accepted,'accepted Finder monitor source retained')\n  return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}\n }\n"
 assert.equal(beforeTransport.split(transportBoundary).length,2,'one original Finder monitor parse boundary')
 assert.equal(String(current(finderTransport)),transportImport+beforeTransport.replace(transportBoundary,transportPrefix+transportBoundary),'only exact additive quality dispatch follows original Finder absence and read-error handling')
 }
 if(hasPackageTransport){
  const beforeTransport=String(historical('6b22adbf7fb19d35a66c9ba637383a02224db136',packageTransport)),transportBoundary=" const a=JSON.parse(bytes)\n",transportImport="import {assistantQualityPredecessor,QUALITY_RECEIPT} from './assistant-quality-integrity.mjs'\n",transportPrefix=" const quality=assistantQualityPredecessor(current,historical)\n if(quality){\n  const accepted=procurementInsightsEditorialPackagePredecessor(quality.previousBytes,historical);assert(accepted,'accepted editorial package source retained')\n  return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}\n }\n"
  assert.equal(beforeTransport.split(transportBoundary).length,2,'one original editorial package parse boundary')
  assert.equal(String(current(packageTransport)),transportImport+beforeTransport.replace(transportBoundary,transportPrefix+transportBoundary),'only additive CIC dispatch; all accepted editorial checks retained')
 }
 const mapped=new Set(paths),cache=new Map()
 const previousBytes=p=>{
  if(p===QUALITY_HOST_RECEIPT||added.has(p))throw Object.assign(Error('Quality host absent from predecessor'),{code:'ENOENT'})
  if(hasPackageTransport&&(p===packageTransport||p==='apps/sg-runtime/package-lock.json'))return Buffer.from(historical('6b22adbf7fb19d35a66c9ba637383a02224db136',p))
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(p===finderTransport?'77369b63888c5fa66d8d8159d5e8f36a23d25c83':p===legacyTransport?'936eaa61087516028564c6aaad2c46912b4729f7':QUALITY_HOST_BASE,p)))
  return Buffer.from(cache.get(p))
 }
 return {manifest:a,previousBytes,editorialPackage:hasPackageTransport,
  legacyPreviousBytes:hasPackageTransport?p=>p==='apps/sg-runtime/package-lock.json'?Buffer.from(historical(QUALITY_HOST_BASE,p)):previousBytes(p):previousBytes}
}

const COMPOSITION_BASE='53691e907e4cc9b7fbf683c91bbebf41299e9ccc'
const COMPONENT_BASE='583ea4f780c6a7675e7fde85c33fa7039438eedb'
const RESERVATION_PIN='bfa9287d9a0a17ef0a935ddc2c0f66c46b42d6c415b2b1fda0d237d2e38fc8b8'
function composedQualityHost(current,historical,a){
 const prior=JSON.parse(historical(COMPONENT_BASE,QUALITY_HOST_RECEIPT))
 assert.deepEqual(Object.keys(a).sort(),[...Object.keys(prior),'acceptedComposition'].sort())
 for(const k of Object.keys(prior).filter(k=>k!=='sourceDigests'))assert.deepEqual(a[k],prior[k],'immutable component metadata '+k)
 assert.deepEqual(a.acceptedComposition,{sourceSha:COMPOSITION_BASE,componentSourceSha:COMPONENT_BASE,reservationRecordSha256:RESERVATION_PIN})
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),QUALITY_HOST_PATHS.filter(p=>p!=='apps/architecture-lab/knowledge-source.mjs'&&p!=='apps/architecture-lab/test/knowledge-source.test.mjs').sort(),'closed CI25 source inventory')
 for(const p of QUALITY_HOST_PATHS.filter(p=>p!=='apps/architecture-lab/knowledge-source.mjs'&&p!=='apps/architecture-lab/test/knowledge-source.test.mjs')){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact composed CIC source '+p)}
 for(const p of QUALITY_HOST_PRESERVED){assert.equal(hash(current(p)),a.previousReceipts[p]);assert.equal(hash(historical(QUALITY_HOST_BASE,p)),a.previousReceipts[p])}

 const packagePath='apps/sg-runtime/package.json',lockPath='apps/sg-runtime/package-lock.json'
 const expectedPackage=JSON.parse(historical(COMPOSITION_BASE,packagePath))
 expectedPackage.dependencies['@profitia/cic-core']='1.8.0'
 const marker='tests/assistant-economic-calendar.test.ts ',script=expectedPackage.scripts['test:assistant']
 assert.equal(script.split(marker).length,2,'one accepted calendar test entry')
 expectedPackage.scripts['test:assistant']=script.replace(marker,marker+'tests/assistant-quality.test.ts ')
  +' && node --test tests/assistant-quality-integrity.test.mjs'
  +' && node --import tsx --test tests/assistant-quality-response.test.ts tests/assistant-quality-evidence.test.ts && node --test tests/assistant-quality-host-integrity.test.mjs'
 assert.deepEqual(JSON.parse(current(packagePath)),expectedPackage,'current admitted CIC manifest permits only its exact core pin and QA tests')
 const expectedLock=JSON.parse(historical(COMPOSITION_BASE,lockPath))
 expectedLock.packages[''].dependencies['@profitia/cic-core']='1.8.0'
 Object.assign(expectedLock.packages['node_modules/@profitia/cic-core'],QUALITY_CIC_PIN)
 assert.deepEqual(JSON.parse(current(lockPath)),expectedLock,'current admitted CIC lock permits only the exact published core artifact')
 const previous=p=>Buffer.from(historical(COMPONENT_BASE,p))
 const legacy=assistantQualityHostPredecessor(previous,historical);assert(legacy,'complete original CIC component retained')
 const mapped=new Set([...QUALITY_HOST_PATHS,...QUALITY_HOST_PRESERVED,QUALITY_HOST_RECEIPT,
  'apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/context-selection.ts',
  'apps/sg-runtime/tests/assistant-quality.test.ts','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
  'apps/sg-runtime/tests/assistant-ecr-integrity.mjs','apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs'])
 const compositionPreviousBytes=p=>{
  if(!mapped.has(p))return current(p)
  try{return Buffer.from(historical(COMPOSITION_BASE,p))}catch(e){
   const text=String(e?.stderr??e?.message??'')
   if(e?.status===128&&(text.includes("'"+p+"' does not exist in ")||text.includes("'"+p+"' exists on disk, but not in ")))throw Object.assign(Error('CIC addition absent from accepted ACG'),{code:'ENOENT'})
   throw e
  }
 }

 const unchanged=[
  'apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/context-selection.ts',
  'apps/sg-runtime/tests/assistant-quality.test.ts','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
  'apps/sg-runtime/tests/assistant-ecr-integrity.mjs','apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs']
 for(const p of unchanged)assert.deepEqual(Buffer.from(current(p)),Buffer.from(historical(COMPONENT_BASE,p)),'unchanged current calendar source '+p)
 const packageReceipt='apps/sg-runtime/procurement-insights-editorial-package-integration.json'
 assert.deepEqual(Buffer.from(current(packageReceipt)),Buffer.from(historical(COMPOSITION_BASE,packageReceipt)),'immutable current editorial package receipt')
 const packaged=JSON.parse(current(packageReceipt))
 for(const [p,digest]of Object.entries(packaged.sourceDigests))assert.equal(hash(compositionPreviousBytes(p)),digest,'current accepted editorial package source '+p)
 for(const [p,digest]of Object.entries(packaged.preservedReceipts))assert.equal(hash(current(p)),digest,'current immutable editorial receipt '+p)
 const transport='apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs'
 const oldTransport=String(historical(COMPONENT_BASE,transport))
 assert.equal(oldTransport.split('quality.previousBytes').length,2)
 assert.equal(String(current(transport)),oldTransport.replace('quality.previousBytes','quality.compositionPreviousBytes??quality.previousBytes'),'only additive composition selection before original editorial checks')
 assert.equal(hash(current(RESERVATION_RECORD)),RESERVATION_PIN,'actual accepted ACG record retained')
 const reservation=assistantReservationPredecessor(compositionPreviousBytes,historical,RESERVATION_PIN);assert(reservation,'all accepted ACG checks retained')
 const expectedCommon="import {assistantQualityPredecessor,QUALITY_RECEIPT} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n"+String(historical(COMPOSITION_BASE,'apps/architecture-lab/private-recurring-source.mjs')).replace("export function recurringSourcePredecessor(current,historical){\n","export function recurringSourcePredecessor(current,historical){\n const quality=assistantQualityPredecessor(current,historical);if(quality){const accepted=recurringSourcePredecessor(quality.compositionPreviousBytes??quality.previousBytes,historical);assert(accepted,'accepted recurring source retained');return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}}\n")
 assert.equal(String(current('apps/architecture-lab/private-recurring-source.mjs')),expectedCommon,'only exact additive composition dispatch before accepted ACG')
 const retainCurrent=reader=>p=>{
  if(!mapped.has(p))return current(p)
  try{return reader(p)}catch(e){
   const text=String(e?.stderr??e?.message??'')
   if(e?.status===128&&(text.includes("'"+p+"' does not exist in ")||text.includes("'"+p+"' exists on disk, but not in ")))throw Object.assign(Error('CIC addition absent from component predecessor'),{code:'ENOENT'})
   throw e
  }
 }
 return {...legacy,manifest:a,previousBytes:retainCurrent(legacy.previousBytes),
  legacyPreviousBytes:retainCurrent(legacy.legacyPreviousBytes??legacy.previousBytes),compositionPreviousBytes,acceptedComposition:true}
}

const KNOWLEDGE_COMPOSITION_BASE='2f77dcd19a5ba0bb4dd4c30ed375f4c1d3213586'
const KNOWLEDGE_RECORD='apps/architecture-lab/knowledge-source.json'
const KNOWLEDGE_PIN='7bde334dda3ec7068d3cb532ccd8a94f3477cea707abe250431ee16c3b044bf4'
const KNOWLEDGE_BRIDGE='apps/architecture-lab/knowledge-source.mjs'
function composedKnowledgeQualityHost(current,historical,a){
 const prior=JSON.parse(historical(COMPONENT_BASE,QUALITY_HOST_RECEIPT))
 assert.deepEqual(Object.keys(a).sort(),[...Object.keys(prior),'acceptedComposition'].sort())
 for(const k of Object.keys(prior).filter(k=>k!=='sourceDigests'))assert.deepEqual(a[k],prior[k],'immutable original CIC component '+k)
 assert.deepEqual(a.acceptedComposition,{sourceSha:KNOWLEDGE_COMPOSITION_BASE,componentSourceSha:COMPONENT_BASE,
  reservationRecordSha256:RESERVATION_PIN,knowledgeRecordSha256:KNOWLEDGE_PIN})
 const ecrBridge='apps/sg-runtime/tests/assistant-ecr-integrity.mjs',compositionPaths=[...QUALITY_HOST_PATHS,ecrBridge]
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),compositionPaths.sort(),'closed CI27 source inventory')
 for(const p of compositionPaths){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact CIC and Knowledge composition '+p)}
 for(const p of QUALITY_HOST_PRESERVED){assert.equal(hash(current(p)),a.previousReceipts[p]);assert.equal(hash(historical(QUALITY_HOST_BASE,p)),a.previousReceipts[p])}
 const packagePath='apps/sg-runtime/package.json',lockPath='apps/sg-runtime/package-lock.json'
 const expectedPackage=JSON.parse(historical(KNOWLEDGE_COMPOSITION_BASE,packagePath))
 expectedPackage.dependencies['@profitia/cic-core']='1.8.0'
 const marker='tests/assistant-economic-calendar.test.ts ',script=expectedPackage.scripts['test:assistant']
 assert.equal(script.split(marker).length,2)
 expectedPackage.scripts['test:assistant']=script.replace(marker,marker+'tests/assistant-quality.test.ts ')
  +' && node --test tests/assistant-quality-integrity.test.mjs'
  +' && node --import tsx --test tests/assistant-quality-response.test.ts tests/assistant-quality-evidence.test.ts && node --test tests/assistant-quality-host-integrity.test.mjs'
 assert.deepEqual(JSON.parse(current(packagePath)),expectedPackage,'current admitted CIC manifest permits only its exact core pin and QA tests')
 const expectedLock=JSON.parse(historical(KNOWLEDGE_COMPOSITION_BASE,lockPath))
 expectedLock.packages[''].dependencies['@profitia/cic-core']='1.8.0'
 Object.assign(expectedLock.packages['node_modules/@profitia/cic-core'],QUALITY_CIC_PIN)
 assert.deepEqual(JSON.parse(current(lockPath)),expectedLock,'current admitted CIC lock permits only the exact published core artifact')
 const legacy=assistantQualityHostPredecessor(p=>Buffer.from(historical(COMPONENT_BASE,p)),historical)
 assert(legacy,'complete original CIC component retained')
 const mapped=new Set([...QUALITY_HOST_PATHS,...QUALITY_HOST_PRESERVED,QUALITY_HOST_RECEIPT,
  'apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/context-selection.ts',
  'apps/sg-runtime/tests/assistant-quality.test.ts','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
  'apps/sg-runtime/tests/assistant-ecr-integrity.mjs','apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs'])
 const compositionPreviousBytes=p=>{
  if(!mapped.has(p))return current(p)
  try{return Buffer.from(historical(KNOWLEDGE_COMPOSITION_BASE,p))}catch(e){
   const text=String(e?.stderr??e?.message??'')
   if(e?.status===128&&(text.includes("'"+p+"' does not exist in ")||text.includes("'"+p+"' exists on disk, but not in ")))throw Object.assign(Error('CIC addition absent from accepted Knowledge'),{code:'ENOENT'})
   throw e
  }
 }
 for(const p of ['apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/context-selection.ts',
  'apps/sg-runtime/tests/assistant-quality.test.ts','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
  'apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs'])
  assert.deepEqual(Buffer.from(current(p)),Buffer.from(historical(COMPONENT_BASE,p)),'original controlled calendar source retained '+p)
 const ecrBefore=String(historical(COMPONENT_BASE,ecrBridge)),ecrEntry='if(quality)return assistantEcrPredecessor(quality.previousBytes,historical)'
 assert.equal(ecrBefore.split(ecrEntry).length,2,'one original ECR quality entry')
 assert.equal(String(current(ecrBridge)),ecrBefore.replace(ecrEntry,'if(quality)return assistantEcrPredecessor(quality.compositionPreviousBytes??quality.previousBytes,historical)'),'only additive accepted composition selection; every original ECR assertion retained')
 assert.equal(hash(current(KNOWLEDGE_RECORD)),KNOWLEDGE_PIN,'immutable accepted Knowledge record')
 const k=JSON.parse(current(KNOWLEDGE_RECORD))
 for(const [p,digest]of Object.entries(k.sourceDigests))assert.equal(hash(compositionPreviousBytes(p)),digest,'all accepted Knowledge inputs retained '+p)
 for(const [p,digest]of Object.entries({...k.preservedReceipts,...k.retainedSuccessorReceipts})){
  assert.equal(hash(current(p)),digest,'immutable Knowledge receipt '+p)
  assert.equal(hash(historical(k.previousSourceSha,p)),digest,'original Knowledge receipt '+p)
 }
 const knowledge=knowledgeSourcePredecessor(compositionPreviousBytes,historical);assert(knowledge,'complete original Knowledge checks retained')
 const reservation=assistantReservationPredecessor(knowledge.previousBytes,historical,RESERVATION_PIN);assert(reservation,'complete original ACG checks retained')
 const common='apps/architecture-lab/private-recurring-source.mjs',entry="export function recurringSourcePredecessor(current,historical){\n"
 const beforeCommon=String(historical(KNOWLEDGE_COMPOSITION_BASE,common))
 const prefix=" const quality=assistantQualityPredecessor(current,historical);if(quality){const accepted=recurringSourcePredecessor(quality.compositionPreviousBytes??quality.previousBytes,historical);assert(accepted,'accepted recurring source retained');return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}}\n"
 assert.equal(beforeCommon.split(entry).length,2)
 assert.equal(String(current(common)),"import {assistantQualityPredecessor,QUALITY_RECEIPT} from '../sg-runtime/tests/assistant-quality-integrity.mjs'\n"+beforeCommon.replace(entry,entry+prefix),'only additive CIC dispatch before complete Knowledge chain')
 const transport='apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs',oldTransport=String(historical(COMPONENT_BASE,transport))
 assert.equal(oldTransport.split('quality.previousBytes').length,2)
 const expectedTransport=oldTransport.replace('quality.previousBytes','quality.host?.editorialPreviousBytes??quality.compositionPreviousBytes??quality.previousBytes').replace("sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,","sourceDigests:{...Object.fromEntries(Object.entries(accepted.manifest.sourceDigests).map(([p,digest])=>[p,quality.host?.knowledgeManifest?.sourceDigests[p]??digest])),...quality.manifest.sourceDigests,")
 assert.equal(String(current(transport)),expectedTransport,'all original editorial checks retained')
 const knowledgeTest='apps/architecture-lab/test/knowledge-source.test.mjs'
 const acceptedTest=String(historical(KNOWLEDGE_COMPOSITION_BASE,knowledgeTest))
 const testReader="const root=new URL('../../../',import.meta.url),read=p=>readFileSync(new URL(p,root));",testHistory="const cache=new Map(),history=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key);};"
 assert.equal(acceptedTest.split(testReader).length,2);assert.equal(acceptedTest.split(testHistory).length,2)
 const expectedTest="import {assistantQualityPredecessor} from '../../sg-runtime/tests/assistant-quality-integrity.mjs';\n"+acceptedTest.replace(testReader,testReader.replace(',read=',',physical=')).replace(testHistory,testHistory+"\n// Authenticate the complete current CIC graph before the unchanged accepted PK fixture.\nconst quality=assistantQualityPredecessor(physical,history),read=quality?.compositionPreviousBytes??physical;")
 assert.equal(String(current(knowledgeTest)),expectedTest,'exact additive fixture adapter; every accepted Knowledge assertion unchanged')
 const packageReceipt='apps/sg-runtime/procurement-insights-editorial-package-integration.json',packaged=JSON.parse(current(packageReceipt))
 assert.deepEqual(Buffer.from(current(packageReceipt)),Buffer.from(historical(KNOWLEDGE_COMPOSITION_BASE,packageReceipt)))
 for(const [p,digest]of Object.entries(packaged.sourceDigests)){
  const actual=hash(compositionPreviousBytes(p))
  if(actual===digest)continue
  const replacement=k.replacements[p]
  assert(replacement,'explicit immutable Knowledge replacement required '+p)
  assert.equal(replacement.currentSha256,actual,'exact accepted current Knowledge replacement '+p)
  assert.equal(replacement.previousSha256,digest,'unchanged original editorial expected digest '+p)
  assert.equal(hash(historical(k.previousSourceSha,p)),digest,'exact original editorial predecessor bytes '+p)
 }
 for(const [p,digest]of Object.entries(packaged.preservedReceipts))assert.equal(hash(current(p)),digest,'immutable editorial receipt '+p)
 const retainCurrent=reader=>p=>{
  if(!mapped.has(p))return current(p)
  try{return reader(p)}catch(e){
   const text=String(e?.stderr??e?.message??'')
   if(e?.status===128&&(text.includes("'"+p+"' does not exist in ")||text.includes("'"+p+"' exists on disk, but not in ")))throw Object.assign(Error('CIC addition absent from component'),{code:'ENOENT'})
   throw e
  }
 }
 return {...legacy,manifest:a,previousBytes:retainCurrent(legacy.previousBytes),legacyPreviousBytes:retainCurrent(legacy.legacyPreviousBytes??legacy.previousBytes),
  compositionPreviousBytes,reservationPreviousBytes:knowledge.previousBytes,editorialPreviousBytes:knowledge.previousBytes,knowledgeManifest:knowledge.manifest,acceptedComposition:true,knowledgeComposition:true}
}
