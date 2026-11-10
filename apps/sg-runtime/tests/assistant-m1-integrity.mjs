// Test-only receiver continuation. Never imported by a product runtime.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
export const ASSISTANT_M1_RUNTIME_PATHS=Object.freeze([
  "apps/dashboard-preview/components/native-embedded-read-provider.tsx",
  "apps/dashboard-preview/components/raw-data-view/index.tsx",
  "apps/sg-runtime/app/api/assistant/conversation/route.ts",
  "apps/sg-runtime/app/api/assistant/history/[id]/route.ts",
  "apps/sg-runtime/app/api/assistant/history/route.ts",
  "apps/sg-runtime/components/appshell/appshell-dashboard.tsx",
  "apps/sg-runtime/components/appshell/assistant-conversation-session.ts",
  "apps/sg-runtime/components/appshell/assistant-conversation-transport.ts",
  "apps/sg-runtime/components/appshell/assistant-conversation-view.tsx",
  "apps/sg-runtime/components/appshell/assistant-screen-context.ts",
  "apps/sg-runtime/components/appshell/assistant-widget.tsx",
  "apps/sg-runtime/components/appshell/platform-appshell.css",
  "apps/sg-runtime/components/appshell/platform-appshell.tsx",
  "apps/sg-runtime/components/auth/account-landing.tsx",
  "apps/sg-runtime/components/benchmark-finder/benchmark-finder-client.tsx",
  "apps/sg-runtime/components/benchmark-finder/native-analytics-embed.tsx",
  "apps/sg-runtime/deployment/assistant-m1-targets.json",
  "apps/sg-runtime/instrumentation.ts",
  "apps/sg-runtime/lib/assistant/conversation.ts",
  "apps/sg-runtime/lib/assistant/history.ts",
  "apps/sg-runtime/lib/assistant/model.ts",
  "apps/sg-runtime/lib/assistant/runtime.ts",
  "apps/sg-runtime/lib/platform/native-dashboard-embed.ts",
  "apps/sg-runtime/lib/platform/private-runtime.ts",
  "apps/sg-runtime/migrations/assistant/001-history.sql",
  "apps/sg-runtime/package-lock.json",
  "apps/sg-runtime/package.json",
  "apps/sg-runtime/tests/advisory-widget.test.ts",
  "apps/sg-runtime/tests/assistant-conversation-handler.test.ts",
  "apps/sg-runtime/tests/assistant-conversation-transport.test.ts",
  "apps/sg-runtime/tests/assistant-conversation.test.ts",
  "apps/sg-runtime/tests/assistant-history-postgres.test.mjs",
  "apps/sg-runtime/tests/assistant-m1-integrity.mjs",
  "apps/sg-runtime/tests/assistant-m1-integrity.test.mjs",
  "apps/sg-runtime/tests/assistant-model.test.ts",
  "apps/sg-runtime/tests/category-operation.test.ts",
  "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs",
  "apps/sg-runtime/tests/identity-runtime.test.ts",
  "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs",
  "apps/sg-runtime/tests/native-dashboard-embed.test.ts",
  "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs",
  "apps/sg-runtime/tests/operation-context.test.mjs",
  "apps/sg-runtime/tests/pci-smart-integrity.mjs",
  "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
  "apps/sg-runtime/tests/porr-demo-middleware.test.ts",
  "apps/sg-runtime/tests/private-host.integration.test.mjs",
  "apps/sg-runtime/tests/self-service-account.test.ts",
  "apps/sg-runtime/tests/xray-assistant-host.test.tsx",
  "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs",
  "apps/sg-runtime/tests/xray-gateway.test.ts"
])
export const ASSISTANT_M1_PEER_PATHS=Object.freeze(['apps/srm/scripts/source-hub-sdk-compatibility.mjs'])
const priorSha='1f25d37589d0c8e0e0020f014ab9788b4a04417b',file='apps/sg-runtime/operation-integration.json'
const hash=v=>createHash('sha256').update(v).digest('hex')
export const ASSISTANT_M1_CHART_CORRECTIVE_PATHS=Object.freeze([
 'apps/dashboard-preview/components/raw-data-view/magicpath-benchmark-chart.tsx',
 'apps/sg-runtime/tests/assistant-chart-context.test.ts',
 'apps/sg-runtime/tests/assistant-m1-integrity.mjs',
 'apps/sg-runtime/tests/assistant-m1-integrity.test.mjs',
 'apps/sg-runtime/tests/assistant-model.test.ts',
 'apps/sg-runtime/tests/category-operation.test.ts',
 'apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs',
 'apps/sg-runtime/tests/identity-runtime.test.ts',
 'apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs',
 'apps/sg-runtime/tests/native-sql-roundtrips.test.mjs',
 'apps/sg-runtime/tests/operation-context.test.mjs',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs',
 'apps/sg-runtime/tests/porr-demo-middleware.test.ts',
 'apps/sg-runtime/tests/self-service-account.test.ts',
 'apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs',
 'apps/sg-runtime/tests/xray-gateway.test.ts',
])
export function assertAssistantM1ChartCorrective(receipt,current,historical){
 const a=receipt.assistantM1ChartContextCorrective
 assert(a,'explicit chart corrective required');assert.equal(a.schemaVersion,'1.0')
 assert.equal(a.taskId,'SG2-ACG-M1-20261109');assert.equal(a.scope,'ACTUAL_MAGICPATH_CHART_CONTEXT_PRODUCER_ONLY')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.previousReceiptSourceSha,'4a58d6cdc57334aa5c5aa9cba20cad8e7e5e47b5')
 assert.match(a.sourceProducerSha,/^[a-f0-9]{40}$/)
 const bytes=Buffer.from(historical(a.previousReceiptSourceSha,file)),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {assistantM1ChartContextCorrective,...preserved}=receipt
 assert.deepEqual(preserved,prior,'accepted M1 and all earlier acceptance remain immutable')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),ASSISTANT_M1_CHART_CORRECTIVE_PATHS)
 assert.deepEqual(a.addedBoundaryFiles,['apps/sg-runtime/tests/assistant-chart-context.test.ts'])
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([p,h])=>[posix.relative('apps/sg-runtime',p),h])))
 for(const [p,h]of Object.entries(a.sourceDigests)){
  assert.match(h,/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),h,'current chart corrective '+p)
  assert.equal(hash(historical(a.sourceProducerSha,p)),h,'committed chart corrective '+p)
 }
 for(const flag of ['visualDesignChanged','authorizationChanged','schemaChanged','providerConfigurationChanged','pilotLimitsChanged','srmProductChanged','otherEnvironmentsChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:p=>ASSISTANT_M1_CHART_CORRECTIVE_PATHS.includes(p)||p===file?Buffer.from(historical(a.previousReceiptSourceSha,p)):current(p)}
}
export function assertAssistantM1Integrity(receipt,current,historical){
 if(receipt.assistantM1ChartContextCorrective){const n=assertAssistantM1ChartCorrective(receipt,current,historical);return assertAssistantM1Integrity(n.prior,n.previousBytes,historical)}
 const a=receipt.assistantM1RuntimeSourceCompatibility;assert(a,'explicit M1 runtime source receipt required')
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-ACG-M1-20261109');assert.equal(a.scope,'ASSISTANT_M1_SHARED_APPSHELL_SOURCE_ONLY');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,priorSha);assert.match(a.sourceProducerSha,/^[a-f0-9]{40}$/)
 const bytes=Buffer.from(historical(priorSha,file)),prior=JSON.parse(bytes);assert.equal(hash(bytes),a.previousReceiptSha256)
 const {assistantM1RuntimeSourceCompatibility,...preserved}=receipt;assert.deepEqual(preserved,prior,'complete SDK and product acceptance stays immutable')
 assert.deepEqual(Object.keys(a.consumerSourceDigests).sort(),ASSISTANT_M1_RUNTIME_PATHS);assert.deepEqual(Object.keys(a.peerSourceDigests).sort(),ASSISTANT_M1_PEER_PATHS)
 for(const [p,h]of Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests})){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),h,'exact M1 source '+p)}
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests}).map(([p,h])=>[posix.relative('apps/sg-runtime',p),h])))
 assert.equal(a.historyRetentionDays,30);assert.equal(a.maximumPilotUsd,5);assert.equal(a.maximumPilotTokens,200000);assert.equal(a.maximumOutputTokens,2048);assert.equal(a.model,'gpt-5.6-luna')
 for(const flag of ['runtimeActivated','historyInstalled','sql030Installed','grantsChanged','providerCallsPerformed','deploymentPerformed','privateContentInTelemetry','borrowedCredentials','newServiceCreated','otherEnvironmentsChanged','srmProductChanged'])assert.equal(a[flag],false,flag)
 const manifest=JSON.parse(current('apps/sg-runtime/package.json')),lock=JSON.parse(current('apps/sg-runtime/package-lock.json'))
 assert.equal(manifest.dependencies['@profitia/cic-core'],'1.3.0')
 assert.deepEqual(Object.fromEntries(['version','resolved','integrity'].map(k=>[k,lock.packages['node_modules/@profitia/cic-core'][k]])),{version:'1.3.0',resolved:'https://npm.pkg.github.com/download/@profitia/cic-core/1.3.0/b66e166cf5dd698796036ea5ccfedea4fe24ec19',integrity:'sha512-RnA24q7wPkz1cqXUA7g6JfS2uZnLQg3GfXzyihvzvQh2r+DgTwb4z/3v/uCtW63xSvl4GX7ur8pBUuGldEzWBA=='})
 const beforeManifest=JSON.parse(historical(priorSha,'apps/sg-runtime/package.json')),beforeLock=JSON.parse(historical(priorSha,'apps/sg-runtime/package-lock.json'))
 for(const name of ['@profitia/advisory-widget','@profitia/cic-procurement']){assert.equal(manifest.dependencies[name],beforeManifest.dependencies[name]);assert.deepEqual(lock.packages['node_modules/'+name],beforeLock.packages['node_modules/'+name])}
 const changed=new Set([...ASSISTANT_M1_RUNTIME_PATHS,...ASSISTANT_M1_PEER_PATHS,file])
 return {prior,previousBytes:p=>changed.has(p)?Buffer.from(historical(priorSha,p)):current(p)}
}
