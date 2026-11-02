/** Test-only additive acceptance. Original receipts and runtime bytes stay immutable. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
const relativeHostPath=file=>posix.relative('apps/srm',file)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const XRAY_APPSHELL_PRESENTATION_FILES=["apps/sg-runtime/components/appshell/xray-module-host.tsx","apps/sg-runtime/docs/xray-appshell-ui.md","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/adp-appshell-preview.mjs","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-appshell-ui.test.tsx","apps/sg-runtime/tests/xray-appshell.test.tsx","apps/sg-runtime/tests/xray-gateway.test.ts","apps/srm/scripts/pilot2-cold-overlay.test.mjs","apps/srm/scripts/xray-style-acceptance.mjs","apps/srm/scripts/xray-workflow-react18.test.tsx","apps/srm/src/server/peer-read-boundary.test.ts","apps/srm/src/server/supplier-location-geocoding-runtime.test.ts","packages/srm-xray/docs/sg2-host-presentation.md","packages/srm-xray/scripts/build-full-report-css.mjs","packages/srm-xray/src/full-report.css","packages/srm-xray/src/full-workflow.tsx","packages/srm-xray/src/sg2-host-theme.css","packages/srm-xray/src/supplier-search.tsx"]
export function assertXrayAppShellPresentation(receipt,current,historical){
 const a=receipt.xrayAppShellPresentation
 assert.equal(a.taskId,'SG2-XRAY-APPSHELL-UI-20261102')
 assert.equal(a.producerTaskId,'SRM-XRAY-SG2-PRESENTATION-20261102')
 assert.equal(a.previousReceiptSourceSha,'6fdc75192275e296a443db2f1c1d8b4a659b084c')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.presentation,'sg2')
 const file='apps/srm/operation-integration.json',bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {xrayAppShellPresentation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every preceding acceptance and digest remains immutable')
 assert.deepEqual(a.changedSourcePaths,XRAY_APPSHELL_PRESENTATION_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),XRAY_APPSHELL_PRESENTATION_FILES)
 for(const[path,digest]of Object.entries(a.sourceDigests)){assert.match(digest,/^[a-f0-9]{64}$/);assert.equal(hash(current(path)),digest,'exact host presentation source '+path)}
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,value])=>[relativeHostPath(file),value])))
 const packageFiles=[...new Set([...prior.fullUiParityAdoption.publicUi.sourceFiles,'src/sg2-host-theme.css','docs/sg2-host-presentation.md'])].sort()
 assert.deepEqual(a.publicUi.sourceFiles,packageFiles);assert.equal(a.publicUi.version,prior.fullUiParityAdoption.publicUi.version)
 const packageHash=createHash('sha256');for(const file of packageFiles)packageHash.update(file).update('\0').update(current('packages/srm-xray/'+file)).update('\0')
 assert.equal(packageHash.digest('hex'),a.publicUi.sourceDigest,'exact current public X-Ray variant')
 for(const flag of ['standaloneDefaultsUnchanged','hostPresentationOnly','canonicalSourceStyles','nameCatalogDisabledInSg2'])assert.equal(a[flag],true,flag)
 for(const flag of ['businessLogicChanged','transportChanged','authorizationChanged','financialEngineChanged','schemaChanged','srmRuntimeDeploymentPerformed','excludedEnvironmentChanges'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:path=>['apps/sg-runtime/operation-integration.json','apps/srm/operation-integration.json'].includes(path)||Object.hasOwn(a.sourceDigests,path)?historical(a.previousReceiptSourceSha,path):current(path)}
}

const FILES=["scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-style-acceptance.mjs","scripts/xray-workflow-contract.test.ts","src/server/full-ui-parity-adoption.test.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"]
const SENTRY_HOST_FILES=["scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-style-acceptance.mjs","scripts/xray-workflow-contract.test.ts","src/server/full-ui-parity-adoption.test.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"]
const MARKET_HISTORY_HOST_FILES=["scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-style-acceptance.mjs","scripts/xray-workflow-contract.test.ts","src/server/full-ui-parity-adoption.test.ts","src/server/peer-read-boundary.test.ts","src/server/root-atomic-claim-adoption.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"]
const MARKET_HISTORY_BASE='76d9738ff73abb3600cf806d5b01c6b23133b451',MARKET_HISTORY_CANDIDATE='dba0204f439e4c150690e4a135f7e11f4587ecdc'
const MARKET_HISTORY_BASE_RECEIPT='0e1e80ee4715e4d1caf40723e4d2ccba524809977fe894865c9acc557c6689fa',MARKET_HISTORY_CANDIDATE_RECEIPT='eb356038f460b0ff486dcdb717e0a05ccfb54fe09371dda7d4c4d28a6edef9f0'
const PRODUCT_ANALYTICS_FLAGS=['runtimeChanged','analyticsAddedToSrm','authorizationChanged','financialEngineChanged','schemaOrRlsChanged','sharedContractsChanged','privatePinsChanged','ciPolicyChanged','providerCallsChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed']
export function assertProductAnalyticsHostContinuation(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertProductAnalyticsHostContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsMainHostCompatibility){const n=assertProductAnalyticsMainHostContinuation(receipt,current,historical);return assertProductAnalyticsHostContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsRootClaimTestContinuation){const n=assertProductAnalyticsRootClaimContinuation(receipt,current,historical);return assertProductAnalyticsHostContinuation(n.productReceipt,n.productBytes,historical)}
 const a=receipt.productAnalyticsHostIntegrityContinuation
 assert.equal(a.taskId,'SRM-SG2-POSTHOG-HOST-INTEGRITY-20261102')
 assert.equal(a.scope,'TEST_ONLY_SG2_POSTHOG_HOST_SOURCE_ACCEPTANCE')
 assert.equal(a.previousReceiptSourceSha,'968443700dea367134e522bb9fe32de75b2e2697')
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {productAnalyticsHostIntegrityContinuation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier SRM receipt and original digest remains immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','previousReceiptSourceSha','previousReceiptSha256','consumerSourceSha','applicationSourceDigests','consumerSourceDigests',...PRODUCT_ANALYTICS_FLAGS].sort(),'closed test-only acceptance metadata')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact SRM PostHog host acceptance test '+file)
 assert.equal(a.consumerSourceSha,'968443700dea367134e522bb9fe32de75b2e2697')
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.productAnalyticsCompatibility.sourceDigests).map(([file,digest])=>['../sg-runtime/'+file.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'exact immutable SG2 Product Analytics host closure')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+file.slice(3))),digest,'exact SG2 Product Analytics host '+file)
 const previousHostSha=host.productAnalyticsCompatibility.previousReceiptSourceSha
 assert.equal(previousHostSha,'76d9738ff73abb3600cf806d5b01c6b23133b451')
 assert.equal(hash(historical(previousHostSha,'apps/sg-runtime/operation-integration.json')),host.productAnalyticsCompatibility.previousReceiptSha256)
 for(const flag of PRODUCT_ANALYTICS_FLAGS)assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))?historical(a.previousReceiptSourceSha,file):Object.hasOwn(a.consumerSourceDigests,'../'+file.slice(5))?historical(previousHostSha,file):current(file)}
}
const PRODUCT_ANALYTICS_ROOT_FLAGS=[...PRODUCT_ANALYTICS_FLAGS,'sdkChanged','businessDataChanged']
export function assertProductAnalyticsMainHostContinuation(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertProductAnalyticsMainHostContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.productAnalyticsMainHostCompatibility,file='apps/srm/operation-integration.json'
 assert.equal(a.taskId,'SRM-SG2-POSTHOG-ROOT-TEST-COMPAT-20261102')
 assert.equal(a.scope,'TEST_ONLY_EXACT_CURRENT_MAIN_PRODUCT_ANALYTICS_HOST')
 assert.equal(a.previousReceiptSourceSha,'c1d251397b34e21d528b76f04eef888d457dc5b1')
 assert.equal(a.consumerSourceSha,'98dc716c872ce38f88301f056e446c2b9b073332')
 assert.equal(a.previousAnalyticsHostSourceSha,'6389283b83ce942a57cd894724d22c03948f27a8')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {productAnalyticsMainHostCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier SRM receipt and both source histories remain immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','previousReceiptSourceSha','previousReceiptSha256','consumerSourceSha','previousAnalyticsHostSourceSha','applicationSourceDigests','consumerSourceDigests',...PRODUCT_ANALYTICS_ROOT_FLAGS].sort())
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),MARKET_HISTORY_HOST_FILES)
 for(const[path,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+path)),digest,'exact current SRM host acceptance test '+path)
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 assert.equal(host.productAnalyticsMainCompatibility.taskId,'SG2-POSTHOG-MAIN-COMPAT-20261102')
 assert.equal(host.productAnalyticsMainCompatibility.testMetadataOnly,true)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.productAnalyticsMainCompatibility.sourceDigests).map(([path,digest])=>['../sg-runtime/'+path.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'closed exact combined SG2 host source')
 for(const[path,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+path.slice(3))),digest,'exact current SG2 host '+path)
 for(const flag of PRODUCT_ANALYTICS_ROOT_FLAGS)assert.equal(a[flag],false,flag)
 const hostFiles=new Set(Object.keys(a.consumerSourceDigests).map(path=>'apps/'+path.slice(3)))
 return {prior,previousBytes:path=>path===file?bytes:Object.hasOwn(a.applicationSourceDigests,path.replace(/^apps\/srm\//,''))?historical(a.previousReceiptSourceSha,path):hostFiles.has(path)?historical(a.previousAnalyticsHostSourceSha,path):current(path)}
}
export function assertProductAnalyticsRootClaimContinuation(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertProductAnalyticsRootClaimContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsMainHostCompatibility){const n=assertProductAnalyticsMainHostContinuation(receipt,current,historical);return assertProductAnalyticsRootClaimContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.productAnalyticsRootClaimTestContinuation,file='apps/srm/operation-integration.json'
 assert.equal(a.taskId,'SRM-SG2-POSTHOG-ROOT-TEST-COMPAT-20261102')
 assert.equal(a.scope,'TEST_ONLY_ROOT_CLAIM_PRODUCT_ANALYTICS_COMPATIBILITY')
 assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'5c5602b0041cd22aa5b9f11cbadf9469e35da58d')
 assert.equal(a.productAnalyticsReceiptSourceSha,'4d2cdd18b7ca3202d2fed6f4f0f602474a489c17')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 const productReceiptBytes=historical(a.productAnalyticsReceiptSourceSha,file),productReceipt=JSON.parse(productReceiptBytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 assert.equal(hash(productReceiptBytes),a.productAnalyticsReceiptSha256)
 const {productAnalyticsRootClaimTestContinuation,productAnalyticsHostIntegrityContinuation,...mainPreserved}=receipt
 assert.deepEqual(mainPreserved,prior,'every accepted main receipt and original digest remains immutable')
 const {productAnalyticsRootClaimTestContinuation:rootContinuation,marketHistoryHostIntegrityContinuation,...productPreserved}=receipt
 assert.deepEqual(productPreserved,productReceipt,'every previous Product Analytics receipt and original digest remains immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','productAnalyticsReceiptSourceSha','productAnalyticsReceiptSha256','applicationSourceDigests',...PRODUCT_ANALYTICS_ROOT_FLAGS].sort())
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),MARKET_HISTORY_HOST_FILES)
 for(const[path,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+path)),digest,'exact combined SRM test source '+path)
 for(const flag of PRODUCT_ANALYTICS_ROOT_FLAGS)assert.equal(a[flag],false,flag)
 const productBytes=path=>path===file?productReceiptBytes:Object.hasOwn(a.applicationSourceDigests,path.replace(/^apps\/srm\//,''))?historical(a.productAnalyticsReceiptSourceSha,path):current(path)
 // Validate the complete immutable analytics branch against today's exact SG2
 // bytes before projecting either accepted history for the older guards.
 assertProductAnalyticsHostContinuation(productReceipt,productBytes,historical)
 const changedHost=new Set(Object.keys(productReceipt.productAnalyticsHostIntegrityContinuation.consumerSourceDigests).map(path=>'apps/'+path.slice(3)))
 return {prior,productReceipt,productBytes,previousBytes:path=>path===file?bytes:Object.hasOwn(a.applicationSourceDigests,path.replace(/^apps\/srm\//,''))?historical(a.previousReceiptSourceSha,path):changedHost.has(path)?historical(MARKET_HISTORY_BASE,path):current(path)}
}
export function marketHistoryHostSourceView(current,historical){
 const receipt=JSON.parse(current('apps/srm/operation-integration.json'))
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return marketHistoryHostSourceView(n.previousBytes,historical)}
 if(receipt.productAnalyticsMainHostCompatibility){const n=assertProductAnalyticsMainHostContinuation(receipt,current,historical);return marketHistoryHostSourceView(n.previousBytes,historical)}
 if(receipt.productAnalyticsRootClaimTestContinuation){const n=assertProductAnalyticsRootClaimContinuation(receipt,current,historical);return marketHistoryHostSourceView(n.previousBytes,historical)}
 const file='apps/sg-runtime/operation-integration.json',old=historical(MARKET_HISTORY_BASE,file),candidate=historical(MARKET_HISTORY_CANDIDATE,file),actual=current(file)
 assert.equal(hash(old),MARKET_HISTORY_BASE_RECEIPT);assert.equal(hash(candidate),MARKET_HISTORY_CANDIDATE_RECEIPT)
 const proposed=hash(actual)===MARKET_HISTORY_CANDIDATE_RECEIPT
 assert(proposed||hash(actual)===MARKET_HISTORY_BASE_RECEIPT,'only exact accepted baseline or proposed history host is allowed')
 const candidateReceipt=JSON.parse(candidate),closure={...candidateReceipt.marketHistoryIngestionCompatibility.sourceDigests,[file]:MARKET_HISTORY_CANDIDATE_RECEIPT}
 const baselineReceipt=JSON.parse(old),active=proposed?closure:baselineReceipt.sentryObservabilityCompatibility.sourceDigests
 for(const[file,digest]of Object.entries(active))assert.equal(hash(current(file)),digest,'exact closed market-history host '+file)
 return {bytes:old,proposed,consumerDigests:proposed?Object.fromEntries(Object.entries(closure).map(([f,h])=>['../sg-runtime/'+f.slice(16),h])):{},candidateConsumerDigests:Object.fromEntries(Object.entries(closure).map(([f,h])=>['../sg-runtime/'+f.slice(16),h]))}
}
export function assertMarketHistoryHostContinuation(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertMarketHistoryHostContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsMainHostCompatibility){const n=assertProductAnalyticsMainHostContinuation(receipt,current,historical);return assertMarketHistoryHostContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsRootClaimTestContinuation){const n=assertProductAnalyticsRootClaimContinuation(receipt,current,historical);return assertMarketHistoryHostContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.marketHistoryHostIntegrityContinuation
 assert.equal(a.taskId,'SRM-MARKET-HISTORY-HOST-INTEGRITY-20261102');assert.equal(a.scope,'TEST_ONLY_EXACT_SG2_MARKET_HISTORY_HOST_COMPATIBILITY')
 assert.equal(a.status,'PROPOSED_COMPATIBILITY_NOT_RUNTIME_ACCEPTANCE')
 assert.equal(a.previousReceiptSourceSha,MARKET_HISTORY_BASE);assert.equal(a.candidateConsumerSourceSha,MARKET_HISTORY_CANDIDATE)
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {marketHistoryHostIntegrityContinuation,...preserved}=receipt;assert.deepEqual(preserved,prior,'every earlier SRM receipt remains immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','status','previousReceiptSourceSha','previousReceiptSha256','candidateConsumerSourceSha','candidateConsumerReceiptSha256','applicationSourceDigests','candidateConsumerSourceDigests','runtimeChanged','authorizationChanged','schemaChanged','monitoringChanged','financialEngineChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'].sort())
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),MARKET_HISTORY_HOST_FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact SRM history compatibility '+file)
 const view=marketHistoryHostSourceView(current,historical)
 assert.equal(a.candidateConsumerReceiptSha256,MARKET_HISTORY_CANDIDATE_RECEIPT);assert.deepEqual(a.candidateConsumerSourceDigests,view.candidateConsumerDigests)
 for(const flag of ['runtimeChanged','authorizationChanged','schemaChanged','monitoringChanged','financialEngineChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const changedHost=new Set(Object.keys(a.candidateConsumerSourceDigests).map(f=>'apps/'+f.slice(3)))
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))||view.proposed&&changedHost.has(file)?historical(MARKET_HISTORY_BASE,file):current(file)}
}
export function assertSentryHostContinuation(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertSentryHostContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.marketHistoryHostIntegrityContinuation){const n=assertMarketHistoryHostContinuation(receipt,current,historical);return assertSentryHostContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.sentryHostIntegrityContinuation
 assert.equal(a.taskId,'SRM-SENTRY-HOST-INTEGRITY-R2-20261101')
 assert.equal(a.scope,'TEST_ONLY_SG2_HOST_SOURCE_ACCEPTANCE')
 assert.equal(a.previousReceiptSourceSha,'019ee20c039fb92b13857e27d2866f7daf13abc3')
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {sentryHostIntegrityContinuation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier SRM receipt and hash remains immutable')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),SENTRY_HOST_FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact SRM test-only Sentry continuation '+file)
 assert.equal(a.consumerSourceSha,'a1503404d7723696706d7b8a176fb2a5d4cafaa7')
 assert.equal(a.priorCandidateSourceSha,'405d0e0dbb72106349cd5597571c56e95f803296')
 assert.equal(hash(historical(a.priorCandidateSourceSha,'apps/srm/operation-integration.json')),a.priorCandidateReceiptSha256)
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.sentryObservabilityCompatibility.sourceDigests).map(([file,digest])=>['../sg-runtime/'+file.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'exact immutable SG2 Sentry host closure')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+file.slice(3))),digest,'exact SG2 Sentry host '+file)
 for(const flag of ['runtimeChanged','monitoringAddedToSrm','authorizationChanged','financialEngineChanged','schemaChanged','sharedContractsChanged','privatePinsChanged','ciPolicyChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))||Object.hasOwn(a.consumerSourceDigests,'../'+file.slice(5))?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertStyleConsumerAcceptance(receipt,current,historical){
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertStyleConsumerAcceptance(n.prior,n.previousBytes,historical)}
 if(receipt.marketHistoryHostIntegrityContinuation){const n=assertMarketHistoryHostContinuation(receipt,current,historical);return assertStyleConsumerAcceptance(n.prior,n.previousBytes,historical)}
 const a=receipt.xrayStyleIsolationConsumerAcceptance
 assert.equal(a.taskId,'SRM-XRAY-STYLE-CONSUMER-ACCEPTANCE-B-20261101-R17')
 assert.equal(a.previousReceiptSourceSha,'b965924a63fafb1a24b84ceb389dfd5e78648f57')
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {xrayStyleIsolationConsumerAcceptance,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all earlier SRM receipts and original hashes stay immutable')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact style acceptance test '+file)
 assert.equal(a.consumerSourceSha,'7b8fd2f030b4966d47535f7ef523df697c790147')
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.xrayStyleIsolationContinuation.sourceDigests).map(([file,digest])=>['../sg-runtime/'+file.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'closed exact consumer set from the immutable accepted checkpoint')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+file.slice(3))),digest,'exact SG2 style consumer '+file)
 for(const flag of ['runtimeChanged','freshOrReadyChanged','authorizationChanged','publicUiChanged','sqlChanged','contractsChanged','privatePinsChanged','ciPolicyChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))||Object.hasOwn(a.consumerSourceDigests,'../'+file.slice(5))?historical(a.previousReceiptSourceSha,file):current(file)}
}
