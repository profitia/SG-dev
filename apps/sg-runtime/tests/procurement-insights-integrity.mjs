// Test/build-only exact adoption; cannot authorize runtime, deployment or grants.
import assert from 'node:assert/strict'
import {assistantMarkdownPredecessor} from './assistant-markdown-integrity.mjs'
import {createHash} from 'node:crypto'
export const PROCUREMENT_INSIGHTS_PATHS=Object.freeze([
 ".github/workflows/insights-ci.yml",
 "apps/insights-runtime/package-lock.json",
 "apps/insights-runtime/package.json",
 "apps/insights-runtime/sql/003-report-subscriptions.sql",
 "apps/insights-runtime/src/host.d.mts",
 "apps/insights-runtime/src/host.mjs",
 "apps/insights-runtime/src/subscription-api.mjs",
 "apps/insights-runtime/src/subscription-store.mjs",
 "apps/insights-runtime/src/subscriptions.mjs",
 "apps/insights-runtime/tests/subscriptions.test.mjs",
 "apps/sg-runtime/app/[locale]/dashboard/procurement-insights/page.tsx",
 "apps/sg-runtime/app/api/v1/insights/subscriptions/[[...path]]/route.ts",
 "apps/sg-runtime/app/api/v1/newsfeed/[...path]/route.ts",
 "apps/sg-runtime/components/appshell/appshell-dashboard.tsx",
 "apps/sg-runtime/components/appshell/assistant-conversation-transport.ts",
 "apps/sg-runtime/components/appshell/assistant-screen-context.ts",
 "apps/sg-runtime/components/appshell/assistant-widget.tsx",
 "apps/sg-runtime/components/appshell/platform-appshell.tsx",
 "apps/sg-runtime/components/procurement-insights/inline-item.tsx",
 "apps/sg-runtime/components/procurement-insights/notifications.tsx",
 "apps/sg-runtime/components/procurement-insights/observation-form.tsx",
 "apps/sg-runtime/components/procurement-insights/reports.tsx",
 "apps/sg-runtime/components/procurement-insights/statistics.tsx",
 "apps/sg-runtime/components/procurement-insights/workspace.css",
 "apps/sg-runtime/components/procurement-insights/workspace.tsx",
 "apps/sg-runtime/lib/assistant/context-selection.ts",
 "apps/sg-runtime/lib/assistant/conversation.ts",
 "apps/sg-runtime/lib/insights/subscriptions.ts",
 "apps/sg-runtime/lib/newsfeed/client.ts",
 "apps/sg-runtime/lib/newsfeed/runtime.ts",
 "apps/sg-runtime/package-lock.json",
 "apps/sg-runtime/package.json",
 "apps/sg-runtime/tests/adp-appshell-identity.test.tsx",
 "apps/sg-runtime/tests/appshell-first-entry.test.tsx",
 "apps/sg-runtime/tests/assistant-m2-integrity.mjs",
 "apps/sg-runtime/tests/assistant-multi-source.test.ts",
 "apps/sg-runtime/tests/newsfeed-proxy.test.ts",
 "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-integrity.mjs",
 "apps/sg-runtime/tests/procurement-insights-integrity.test.mjs",
 "apps/sg-runtime/tests/procurement-insights.test.tsx",
 "packages/insights-contracts/package.json",
 "packages/insights-contracts/subscriptions.d.mts",
 "packages/insights-contracts/subscriptions.mjs"
])
const receiptPath='apps/sg-runtime/procurement-insights-integration.json'
const assistantReceipt='apps/sg-runtime/assistant-context-integration.json'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export function procurementInsightsPredecessor(current,historical){
 const markdown=assistantMarkdownPredecessor(current,historical)
 if(markdown)return procurementInsightsPredecessor(markdown.previousBytes,historical)
 let bytes
 try{bytes=current(receiptPath)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&text.includes("'"+receiptPath+"' does not exist in "))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','previousSourceSha','previousAssistantReceiptSha256','newsfeedProducer','sourceDigests','newE1Grant','newProviderPolicy','automaticProviderCalls','publishingWriterGranted','privateSchedulesFailClosed','activationIsSeparate'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-PI-DEVELOPMENT-E2E-20261110');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousSourceSha,'1e0dc1ca4057437805561a841105e291d028df10')
 for(const f of ['newE1Grant','newProviderPolicy','automaticProviderCalls','publishingWriterGranted'])assert.equal(a[f],false,f)
 for(const f of ['privateSchedulesFailClosed','activationIsSeparate'])assert.equal(a[f],true,f)
 const prior=Buffer.from(historical(a.previousSourceSha,assistantReceipt))
 assert.equal(hash(prior),a.previousAssistantReceiptSha256)
 assert.deepEqual(Buffer.from(current(assistantReceipt)),prior,'All M1/M2, Oil, SRM ingress and output receipts remain byte-identical')
 assert.deepEqual(Object.keys(a.newsfeedProducer).sort(),['pullRequest','sourceSha','receiptPath','receiptSha256'].sort())
 assert.equal(a.newsfeedProducer.pullRequest,969);assert.equal(a.newsfeedProducer.sourceSha,'8fa964a159a468968293337c9d0c79c326cb84e5')
 assert.equal(a.newsfeedProducer.receiptPath,'apps/newsfeed-runtime/saved-searches-integration.json')
 assert.equal(hash(historical(a.newsfeedProducer.sourceSha,a.newsfeedProducer.receiptPath)),a.newsfeedProducer.receiptSha256,'Exact Newsfeed candidate, not main/runtime acceptance')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...PROCUREMENT_INSIGHTS_PATHS].sort())
 for(const p of PROCUREMENT_INSIGHTS_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact Procurement Insights source '+p)}
 const mapped=new Set(PROCUREMENT_INSIGHTS_PATHS),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(p===receiptPath)throw Object.assign(Error('Procurement Insights adoption absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(a.previousSourceSha,p)))
  return Buffer.from(cache.get(p))
 }}
}
