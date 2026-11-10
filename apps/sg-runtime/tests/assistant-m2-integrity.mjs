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
// Bound the presentation-only continuation before reading historical receipts.
export function assistantMarkdownPredecessor(current,historical){
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const receipt=JSON.parse(bytes),a=receipt.assistantMarkdownPresentationRepair
 if(a===undefined)return null
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','libraries','noAssistantSdkChange','noModelChange','noAccessChange','noProviderCall','noReleaseConfigurationChange'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ASSISTANT-MARKDOWN-UX-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'ce520b5a3d4ca5f2a48156f8d879ff31f3c874c2')
 const expected=['apps/sg-runtime/components/appshell/assistant-conversation-view.tsx','apps/sg-runtime/components/appshell/assistant-message-markdown.tsx','apps/sg-runtime/components/appshell/platform-appshell.css','apps/sg-runtime/package-lock.json','apps/sg-runtime/package.json','apps/sg-runtime/tests/assistant-m2-integrity.mjs','apps/sg-runtime/tests/assistant-m2-integrity.test.mjs','apps/sg-runtime/tests/assistant-markdown.test.tsx']
 assert.deepEqual(a.changedSourcePaths,expected);assert.deepEqual(Object.keys(a.sourceDigests).sort(),expected)
 assert.deepEqual(a.libraries,{'react-markdown':'10.1.0','remark-gfm':'4.0.1'})
 for(const flag of ['noAssistantSdkChange','noModelChange','noAccessChange','noProviderCall','noReleaseConfigurationChange'])assert.equal(a[flag],true,flag)
 const priorBytes=Buffer.from(historical(a.previousSourceSha,file)),prior=JSON.parse(priorBytes),{assistantMarkdownPresentationRepair,...preserved}=receipt
 assert.equal(hash(priorBytes),a.previousReceiptSha256)
 assert.deepEqual(preserved,prior,'All M1, M2, SRM and Oil acceptance remains immutable')
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
 const mapped=new Set([file,...expected]),cache=new Map([[file,priorBytes]])
 return{manifest:a,previousBytes:p=>{
  if(!mapped.has(p))return current(p)
  if(p==='apps/sg-runtime/components/appshell/assistant-message-markdown.tsx'||p==='apps/sg-runtime/tests/assistant-markdown.test.tsx')throw Object.assign(Error('Presentation file absent from predecessor'),{code:'ENOENT'})
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
// Verify this exact native output-fence correction before exposing its
// accepted predecessor. Historical producer and consumer receipts stay intact.
export function assistantOutputFencePredecessor(current,historical){
 const serialization=oilReportSerializationPredecessor(current,historical)
 if(serialization)return assistantOutputFencePredecessor(serialization.previousBytes,historical)
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const receipt=JSON.parse(bytes),a=receipt.srmAssistantOutputFenceRepair
 if(a===undefined)return null
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','owner','changedSourcePaths','sourceDigests','noGrantChange','noContractChange','noAcquisition'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SRM-ACG-M2-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'a10ba000eafed736383d46823f5fc0dbb0981347')
 assert.deepEqual(a.owner,{pullRequest:965,sourceSha:'acd7f2b090365c601e4e0d5d3ec176345a3ae571'})
 const expected=['apps/sg-runtime/tests/assistant-m2-integrity.mjs','apps/sg-runtime/tests/assistant-m2-integrity.test.mjs','apps/srm/src/server/assistant-context-runtime.test.ts','apps/srm/src/server/assistant-context-runtime.ts']
 assert.deepEqual(a.changedSourcePaths,expected);assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...expected].sort())
 for(const flag of ['noGrantChange','noContractChange','noAcquisition'])assert.equal(a[flag],true,flag)
 const priorBytes=Buffer.from(historical(a.previousSourceSha,file)),prior=JSON.parse(priorBytes),{srmAssistantOutputFenceRepair,...preserved}=receipt
 assert.equal(hash(priorBytes),a.previousReceiptSha256)
 assert.deepEqual(preserved,prior,'All accepted ingress, Oil, M1 and M2 receipt fields remain immutable')
 for(const p of expected){
  assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current SRM native output correction '+p)
  if(p.startsWith('apps/srm/'))assert.equal(hash(historical(a.owner.sourceSha,p)),a.sourceDigests[p],'exact SRM owner source '+p)
 }
 const mapped=new Set([file,...expected]),blobs=new Map([[file,priorBytes]])
 return{manifest:a,previousBytes:p=>{if(!mapped.has(p))return current(p);if(!blobs.has(p))blobs.set(p,Buffer.from(historical(a.previousSourceSha,p)));return Buffer.from(blobs.get(p))}}
}
// Verify the exact ingress correction before either accepted Oil or M2 byte view.
export function assistantIngressPredecessor(current,historical){
 const output=assistantOutputFencePredecessor(current,historical)
 if(output)return assistantIngressPredecessor(output.previousBytes,historical)
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const receipt=JSON.parse(bytes),a=receipt.srmAssistantIngressRepair
 if(a===undefined)return null
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','owner','changedSourcePaths','sourceDigests','noGrantChange','noContractChange','noAcquisition'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SRM-ACG-M2-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'7cf1af53cca6f650a3a2025228546ceca3bfd081')
 assert.deepEqual(a.owner,{pullRequest:963,sourceSha:'c29b773d8dd8156cd7ce600f16aa43733286c711'})
 const expected=['apps/sg-runtime/tests/assistant-m2-integrity.mjs','apps/sg-runtime/tests/assistant-m2-integrity.test.mjs','apps/srm/middleware.ts','apps/srm/middleware.test.ts']
 assert.deepEqual(a.changedSourcePaths,expected);assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...expected].sort())
 for(const flag of ['noGrantChange','noContractChange','noAcquisition'])assert.equal(a[flag],true,flag)
 const priorBytes=Buffer.from(historical(a.previousSourceSha,file)),prior=JSON.parse(priorBytes),{srmAssistantIngressRepair,...preserved}=receipt
 assert.equal(hash(priorBytes),a.previousReceiptSha256)
 assert.deepEqual(preserved,prior,'All accepted Oil, M1 and M2 receipt fields remain immutable')
 for(const p of expected){
  assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current SRM ingress correction '+p)
  if(p.startsWith('apps/srm/'))assert.equal(hash(historical(a.owner.sourceSha,p)),a.sourceDigests[p],'exact SRM owner source '+p)
 }
 const mapped=new Set([file,...expected]),blobs=new Map([[file,priorBytes]])
 return{manifest:a,previousBytes:p=>{if(!mapped.has(p))return current(p);if(!blobs.has(p))blobs.set(p,Buffer.from(historical(a.previousSourceSha,p)));return Buffer.from(blobs.get(p))}}
}
// Validate this bounded current Oil correction before exposing any predecessor.
export function oilReportTransportPredecessor(current,historical){
 const ingress=assistantIngressPredecessor(current,historical);if(ingress)return oilReportTransportPredecessor(ingress.previousBytes,historical)
 const receiptFile='apps/sg-runtime/assistant-context-integration.json';let bytes;
 try{bytes=current(receiptFile)}catch(error){
  const text=String(error?.stderr??error?.message??'');
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+receiptFile+"' does not exist in "))return null;
  throw error;
 }
 const receipt=JSON.parse(bytes),a=receipt.oilRuntimeTransportRepair;
 if(a===undefined)return null;
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','noSdkChange','noGrantChange','noAutomaticRetry','humanReviewRequired'].sort());
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-OIL-TRANSPORT-RECOVERY-20261110');assert.equal(a.targetEnvironment,'development');
 assert.equal(a.previousSourceSha,'22ad6f867b9bf30c8f01b326c003ea37fdd11f25');
 const expected=["apps/insights-runtime/src/composer.mjs","apps/insights-runtime/tests/host.test.mjs","apps/sg-runtime/lib/insights/autonomous-runtime.ts","apps/sg-runtime/tests/assistant-m2-integrity.mjs","apps/sg-runtime/tests/assistant-m2-integrity.test.mjs","apps/sg-runtime/tests/insights-host.test.ts"];
 assert.deepEqual(a.changedSourcePaths,[...expected]);assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...expected]);
 for(const flag of ['noSdkChange','noGrantChange','noAutomaticRetry','humanReviewRequired'])assert.equal(a[flag],true,flag);
 const priorBytes=Buffer.from(historical(a.previousSourceSha,receiptFile)),prior=JSON.parse(priorBytes),{oilRuntimeTransportRepair,...preserved}=receipt;
 assert.equal(hash(priorBytes),a.previousReceiptSha256);assert.deepEqual(preserved,prior,'All previous Oil/M1/M2 acceptances remain unchanged');
 for(const p of expected){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current Oil transport repair '+p);}
 const mapped=new Set([receiptFile,...expected]),blobs=new Map([[receiptFile,priorBytes]]);
 return{manifest:a,previousBytes:p=>{if(!mapped.has(p))return current(p);if(!blobs.has(p))blobs.set(p,Buffer.from(historical(a.previousSourceSha,p)));return Buffer.from(blobs.get(p));}};
}

export function assistantM2Predecessor(current,historical){
 const oil=oilReportTransportPredecessor(current,historical);if(oil)return assistantM2Predecessor(oil.previousBytes,historical);
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
 assert.deepEqual(a.producers,{architecture:{pullRequest:954,sourceSha:'c3b399b13241ae2f4ea8c1b3ae0168fe9a6aac7f'},srm:{pullRequest:958,sourceSha:'25bb13a2a64991c04257bdb5c32d1c14240a0cc4'},cic:{pullRequest:22,sourceSha:'967a5775f45408549d7942d727289818212ef506',version:'1.5.1'}})
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

// Check the current serialization correction before any historical acceptance.
export function oilReportSerializationPredecessor(current,historical){
 const markdown=assistantMarkdownPredecessor(current,historical)
 if(markdown)return oilReportSerializationPredecessor(markdown.previousBytes,historical)
 let bytes
 try{bytes=current(file)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+file+"' does not exist in "))return null
  throw error
 }
 const receipt=JSON.parse(bytes),a=receipt.oilRequestSerializationRepair
 if(a===undefined)return null
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','noSdkChange','noGrantChange','noAutomaticRetry','humanReviewRequired'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-OIL-TRANSPORT-RECOVERY-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'675e97fc6d9387bfe3157e2675d085d0f4f2d070')
 const expected=["apps/insights-runtime/src/composer.mjs","apps/insights-runtime/tests/host.test.mjs","apps/sg-runtime/tests/assistant-m2-integrity.mjs","apps/sg-runtime/tests/assistant-m2-integrity.test.mjs"]
 assert.deepEqual(a.changedSourcePaths,expected);assert.deepEqual(Object.keys(a.sourceDigests).sort(),expected)
 for(const flag of ['noSdkChange','noGrantChange','noAutomaticRetry','humanReviewRequired'])assert.equal(a[flag],true,flag)
 const priorBytes=Buffer.from(historical(a.previousSourceSha,file)),prior=JSON.parse(priorBytes),{oilRequestSerializationRepair,...preserved}=receipt
 assert.equal(hash(priorBytes),a.previousReceiptSha256)
 assert.deepEqual(preserved,prior,'All accepted Oil, SRM, M1 and M2 receipts remain immutable')
 for(const p of expected){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current Oil request serialization '+p)}
 const mapped=new Set([file,...expected]),blobs=new Map([[file,priorBytes]])
 return{manifest:a,previousBytes:p=>{if(!mapped.has(p))return current(p);if(!blobs.has(p))blobs.set(p,Buffer.from(historical(a.previousSourceSha,p)));return Buffer.from(blobs.get(p))}}
}
