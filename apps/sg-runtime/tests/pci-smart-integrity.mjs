import {assertSourceHubApiPathCompatibility as assertPeerApiPathCompatibility} from '../../srm/scripts/source-hub-sdk-compatibility.mjs'
/** Additive continuation: exact current bytes AND immutable prior evidence, never digest replacement. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
const relativeHostPath=file=>posix.relative('apps/sg-runtime',file)
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex')

const APPSHELL_ASSISTANT_FILES=["apps/sg-runtime/components/appshell/appshell-dashboard.tsx", "apps/sg-runtime/components/appshell/assistant-content.tsx", "apps/sg-runtime/components/appshell/assistant-screen-context.ts", "apps/sg-runtime/components/appshell/assistant-widget.tsx", "apps/sg-runtime/components/appshell/platform-appshell.css", "apps/sg-runtime/components/appshell/platform-appshell.tsx", "apps/sg-runtime/components/appshell/xray-module-host.tsx", "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx", "apps/sg-runtime/tests/category-operation.test.ts", "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs", "apps/sg-runtime/tests/identity-runtime.test.ts", "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs", "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs", "apps/sg-runtime/tests/operation-context.test.mjs", "apps/sg-runtime/tests/pci-smart-integrity.mjs", "apps/sg-runtime/tests/pci-smart-integrity.test.mjs", "apps/sg-runtime/tests/porr-demo-middleware.test.ts", "apps/sg-runtime/tests/self-service-account.test.ts", "apps/sg-runtime/tests/xray-assistant-host.test.tsx", "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs", "apps/sg-runtime/tests/xray-gateway.test.ts"]
const APPSHELL_ASSISTANT_PRESERVED=["apps/sg-runtime/components/appshell/appshell-card-motion.ts", "apps/sg-runtime/components/appshell/use-assistant-window.ts", "apps/sg-runtime/components/appshell/adp-module-host.tsx", "apps/sg-runtime/components/auth/account-landing.tsx", "apps/sg-runtime/components/auth/session-boundary.tsx", "apps/sg-runtime/components/benchmark-finder/benchmark-finder-client.tsx", "packages/srm-xray/src/full-workflow.tsx", "packages/srm-xray/src/financial-scanner.tsx", "packages/srm-xray/src/SpendGuruAssessment.tsx"]
export function assertAppShellAssistantOwnership(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertAppShellAssistantOwnership(n.prior,n.previousBytes,historical)}
 const a=receipt.appShellAssistantOwnership,file='apps/sg-runtime/operation-integration.json'
 // Git blobs are immutable. Cache them only inside this one validation call;
 // current filesystem bytes are never cached or substituted before verification.
 const blobs=new Map(),historicalBytes=(sha,p)=>{const key=sha+'\0'+p;if(!blobs.has(key))blobs.set(key,Buffer.from(historical(sha,p)));return Buffer.from(blobs.get(key))}
 assert(a,'current AppShell assistant source acceptance is required')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','applicationSourceDigests','preservedPaths','design','singleAppShellOwner','contextIsDisplayOnly','contextEngineImplemented','skinRedesigned','fourCardMotionChanged','standaloneRuntimeChanged','backendChanged','authorizationChanged','schemaChanged','privatePinsChanged','ciPolicyChanged','observability','deploymentPerformed'].sort())
 assert.equal(a.taskId,'SG2-APPSHELL-ASSISTANT-OWNERSHIP-20261104');assert.equal(a.scope,'ONE_APPSHELL_ASSISTANT_UI_WITH_VOLATILE_SCREEN_PROJECTION');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'62d21fc81cec846ff58d6f5b6fdac35c777314bc')
 const bytes=historicalBytes(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {appShellAssistantOwnership,...unchanged}=receipt;assert.deepEqual(unchanged,prior,'every accepted receipt, source list and hash remains immutable')
 assert.equal(digest(current(file)),digest(JSON.stringify(receipt,null,2)+'\n'),'exact current receipt bytes')
 assert.deepEqual(a.changedSourcePaths,APPSHELL_ASSISTANT_FILES);assert.deepEqual(Object.keys(a.sourceDigests).sort(),APPSHELL_ASSISTANT_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,h])=>[relativeHostPath(f),h])))
 for(const[f,h]of Object.entries(a.sourceDigests)){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(digest(current(f)),h,'current AppShell assistant source '+f)}
 assert.deepEqual(a.preservedPaths,APPSHELL_ASSISTANT_PRESERVED)
 for(const f of a.preservedPaths)assert.equal(digest(current(f)),digest(historicalBytes(a.previousReceiptSourceSha,f)),'unchanged engine, scope guard or standalone source '+f)
 assert.deepEqual(a.design,{projectId:'460628300646219776',componentId:'460628347660177408',revisionId:'468281328887025664'})
 assert.equal(a.observability,'REUSED')
 for(const f of ['singleAppShellOwner','contextIsDisplayOnly'])assert.equal(a[f],true,f)
 for(const f of ['contextEngineImplemented','skinRedesigned','fourCardMotionChanged','standaloneRuntimeChanged','backendChanged','authorizationChanged','schemaChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'])assert.equal(a[f],false,f)
 return {prior,historicalBytes,previousBytes:p=>p===file||Object.hasOwn(a.sourceDigests,p)?historicalBytes(a.previousReceiptSourceSha,p):current(p)}
}

const PRODUCT_ANALYTICS_MONITORING_FILES=["apps/sg-runtime/app/[locale]/layout.tsx","apps/sg-runtime/app/global-error.tsx","apps/sg-runtime/components/analytics/product-analytics-provider.tsx","apps/sg-runtime/components/appshell/adp-module-host.tsx","apps/sg-runtime/components/appshell/appshell-dashboard.tsx","apps/sg-runtime/components/appshell/platform-appshell.tsx","apps/sg-runtime/components/appshell/xray-module-host.tsx","apps/sg-runtime/components/auth/account-landing.tsx","apps/sg-runtime/components/auth/session-boundary.tsx","apps/sg-runtime/components/category-builder/category-builder-client.tsx","apps/sg-runtime/components/cost-scan/category-cost-scan-client.tsx","apps/sg-runtime/components/supplier-intelligence/supplier-summary-client.tsx","apps/sg-runtime/docs/product-analytics.md","apps/sg-runtime/lib/product-analytics/adapter.ts","apps/sg-runtime/lib/product-analytics/config.ts","apps/sg-runtime/lib/product-analytics/contract.ts","apps/sg-runtime/lib/product-analytics/monitoring.ts","apps/sg-runtime/lib/product-analytics/surfaces.ts","apps/sg-runtime/sentry.client.config.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/product-analytics-monitoring.test.ts","apps/sg-runtime/tests/product-analytics-ui.test.tsx","apps/sg-runtime/tests/product-analytics.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
export function assertProductAnalyticsMonitoringContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertProductAnalyticsMonitoringContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertProductAnalyticsMonitoringContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.productAnalyticsMonitoringCompatibility,file='apps/sg-runtime/operation-integration.json'
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','boundSourcePaths','sourceDigests','applicationSourceDigests','finderExcluded','testConsentRequired','geoipSuppression','automaticSafeInteractions','ordinaryUsersActivated','consentMechanismChanged','rawDomCapture','businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingSentryChanged','privatePinsChanged','ciPolicyChanged','eventDefinitionsChanged','posthogProjectSettingsChanged'].sort())
 assert.equal(a.taskId,'SG2-POSTHOG-FULL-MONITORING-NO-FINDER-20261104')
 assert.equal(a.scope,'DEVELOPMENT_SAFE_APPLICATION_MONITORING_WITHOUT_FINDER')
 assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'55005dbd2c3f357548dc79b49853ab0e9532f320')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {productAnalyticsMonitoringCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier receipt, source digest and authority stays immutable')
 assert.deepEqual(a.boundSourcePaths,PRODUCT_ANALYTICS_MONITORING_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PRODUCT_ANALYTICS_MONITORING_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,h])=>[relativeHostPath(f),h])))
 for(const[f,h]of Object.entries(a.sourceDigests)){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(digest(current(f)),h,'exact application monitoring continuation '+f)}
 assert.match(current('apps/sg-runtime/tests/product-analytics.test.ts').toString(),/import '\.\/product-analytics-monitoring.test'/,'monitoring negatives remain in normal CI')
 for(const flag of ['finderExcluded','testConsentRequired','geoipSuppression','automaticSafeInteractions','eventDefinitionsChanged'])assert.equal(a[flag],true,flag)
 for(const flag of ['ordinaryUsersActivated','consentMechanismChanged','rawDomCapture','businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingSentryChanged','privatePinsChanged','ciPolicyChanged','posthogProjectSettingsChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:p=>p===file||Object.hasOwn(a.sourceDigests,p)?historical(a.previousReceiptSourceSha,p):current(p)}
}

const PRODUCT_ANALYTICS_STAGE_ONE_FILES=["apps/sg-runtime/components/analytics/product-analytics-provider.tsx","apps/sg-runtime/docs/product-analytics.md","apps/sg-runtime/lib/product-analytics/adapter.ts","apps/sg-runtime/lib/product-analytics/config.ts","apps/sg-runtime/lib/product-analytics/contract.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/product-analytics-ui.test.tsx","apps/sg-runtime/tests/product-analytics.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
export function assertProductAnalyticsStageOnePrivacyContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertProductAnalyticsStageOnePrivacyContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertProductAnalyticsStageOnePrivacyContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.productAnalyticsMonitoringCompatibility){const n=assertProductAnalyticsMonitoringContinuation(receipt,current,historical);return assertProductAnalyticsStageOnePrivacyContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.productAnalyticsStageOnePrivacyCompatibility,file='apps/sg-runtime/operation-integration.json'
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','boundSourcePaths','sourceDigests','applicationSourceDigests','finderExcluded','testConsentRequired','geoipSuppression','businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingSentryChanged','privatePinsChanged','ciPolicyChanged','eventDefinitionsChanged','posthogProjectSettingsChanged'].sort())
 assert.equal(a.taskId,'SG2-POSTHOG-STAGE1-NO-FINDER-20261103')
 assert.equal(a.scope,'DEVELOPMENT_EXISTING_ANALYTICS_WITHOUT_FINDER_GEOIP_SUPPRESSION')
 assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'36b07672f572ff7c1c81117e3f3b01fa93ec1e65')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {productAnalyticsStageOnePrivacyCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all accepted stage-one, D1 and earlier source receipts remain immutable')
 assert.deepEqual(a.boundSourcePaths,PRODUCT_ANALYTICS_STAGE_ONE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PRODUCT_ANALYTICS_STAGE_ONE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,h])=>[relativeHostPath(f),h])))
 for(const[f,h]of Object.entries(a.sourceDigests)){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(digest(current(f)),h,'exact GeoIP privacy continuation '+f)}
 for(const flag of ['finderExcluded','testConsentRequired','geoipSuppression'])assert.equal(a[flag],true,flag)
 for(const flag of ['businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingSentryChanged','privatePinsChanged','ciPolicyChanged','eventDefinitionsChanged','posthogProjectSettingsChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:p=>p===file||Object.hasOwn(a.sourceDigests,p)?historical(a.previousReceiptSourceSha,p):current(p)}
}

export function assertProductAnalyticsStageOneContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertProductAnalyticsStageOneContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertProductAnalyticsStageOneContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.productAnalyticsStageOnePrivacyCompatibility){const n=assertProductAnalyticsStageOnePrivacyContinuation(receipt,current,historical);return assertProductAnalyticsStageOneContinuation(n.prior,n.previousBytes,historical)}
 const a=receipt.productAnalyticsStageOneCompatibility,file='apps/sg-runtime/operation-integration.json'
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','applicationSourceDigests','finderExcluded','testConsentRequired','businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingTelemetryChanged','privatePinsChanged','ciPolicyChanged'].sort())
 assert.equal(a.taskId,'SG2-POSTHOG-STAGE1-NO-FINDER-20261103')
 assert.equal(a.scope,'DEVELOPMENT_EXISTING_ANALYTICS_WITHOUT_FINDER')
 assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'9bce78138e1396765ce67b9b1b29841efdb017f2')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {productAnalyticsStageOneCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier acceptance, D1 artifact and original hash stays immutable')
 assert.deepEqual(a.changedSourcePaths,PRODUCT_ANALYTICS_STAGE_ONE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PRODUCT_ANALYTICS_STAGE_ONE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,h])=>[relativeHostPath(f),h])))
 for(const[f,h]of Object.entries(a.sourceDigests)){assert.match(h,/^[a-f0-9]{64}$/);assert.equal(digest(current(f)),h,'exact stage-one analytics source '+f)}
 for(const flag of ['finderExcluded','testConsentRequired'])assert.equal(a[flag],true,flag)
 for(const flag of ['businessRuntimeChanged','authorizationChanged','sourceBindingsChanged','forecastWorkersChanged','schemaChanged','existingTelemetryChanged','privatePinsChanged','ciPolicyChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:path=>path===file||Object.hasOwn(a.sourceDigests,path)?historical(a.previousReceiptSourceSha,path):current(path)}
}

const D1_AUDIT_FILES=["apps/sg-runtime/scripts/denial-audit/INSTALLATION.md","apps/sg-runtime/scripts/denial-audit/adoption.json","apps/sg-runtime/scripts/denial-audit/d1-reader.mjs","apps/sg-runtime/scripts/denial-audit/d1-reader.test.mjs","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
const D1_PRODUCER_FILES=['packages/platform-contracts/src/sg2-denial-audit-reader.mjs','packages/platform-contracts/migrations/denial-audit/private.sql','packages/platform-contracts/migrations/denial-audit/source.sql','packages/platform-contracts/migrations/denial-audit/roles.sql','packages/platform-contracts/migrations/denial-audit/expire.sql'].sort()
export function assertD1AuditReaderPreparation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertD1AuditReaderPreparation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertD1AuditReaderPreparation(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.productAnalyticsStageOneCompatibility){const n=assertProductAnalyticsStageOneContinuation(receipt,current,historical);return assertD1AuditReaderPreparation(n.prior,n.previousBytes,historical)}
 const a=receipt.d1AuditReaderPreparation,file='apps/sg-runtime/operation-integration.json'
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','targetEnvironment','previousReceiptSourceSha','previousReceiptSha256','producerSourceSha','producerTaskId','producerPullRequest','producerSourceDigests','changedSourcePaths','sourceDigests','applicationSourceDigests','addedBoundaryFiles','installationApproved','liveReaderInstalled','historicalReadExecuted','runtimeImported','grantsChanged','authorityRevisionsChanged','providerCallsPerformed','deploymentPerformed','posthogActivated'].sort())
 assert.equal(a.taskId,'SG2-FINDER-D1-AUDIT-READER-20261103');assert.equal(a.scope,'TECHNICAL_DENIAL_READER_SOURCE_PREPARATION_ONLY');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'1d245820f93337a35049b416cb375c1ab5a60183')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {d1AuditReaderPreparation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'D1 preserves every prior accepted source receipt and hash')
 assert.equal(digest(current(file)),digest(JSON.stringify(receipt,null,2)+'\n'),'exact D1 source receipt bytes')
 assert.equal(a.producerSourceSha,'64d600192c778b6dc13a3d62b4dd81fd3c008870');assert.equal(a.producerTaskId,'ARCHITECTURE-SG2-D1-AUDIT-READER-20261103');assert.equal(a.producerPullRequest,874)
 assert.deepEqual(Object.keys(a.producerSourceDigests).sort(),D1_PRODUCER_FILES)
 for(const[file,hash]of Object.entries(a.producerSourceDigests)){assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(historical(a.producerSourceSha,file)),hash,'exact independent D1 producer '+file)}
 assert.deepEqual(a.changedSourcePaths,D1_AUDIT_FILES);assert.deepEqual(Object.keys(a.sourceDigests).sort(),D1_AUDIT_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[relativeHostPath(file),hash])))
 assert.deepEqual(a.addedBoundaryFiles,D1_AUDIT_FILES.filter(f=>f.startsWith('apps/sg-runtime/scripts/denial-audit/')))
 for(const[file,hash]of Object.entries(a.sourceDigests)){assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(file)),hash,'exact D1 consumer '+file)}
 const adoption=JSON.parse(current('apps/sg-runtime/scripts/denial-audit/adoption.json'))
 assert.equal(adoption.producerSourceSha,a.producerSourceSha);assert.deepEqual(adoption.sourceSha256,a.producerSourceDigests);assert.equal(adoption.installationApproved,false);assert.equal(adoption.runtimeImported,false)
 for(const flag of ['installationApproved','liveReaderInstalled','historicalReadExecuted','runtimeImported','grantsChanged','authorityRevisionsChanged','providerCallsPerformed','deploymentPerformed','posthogActivated'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:path=>path===file||Object.hasOwn(a.sourceDigests,path)?historical(a.previousReceiptSourceSha,path):current(path)}
}

const APPSHELL_FOUR_CARD_FILES=["apps/sg-runtime/components/appshell/appshell-card-motion.ts","apps/sg-runtime/components/appshell/assistant-widget.tsx","apps/sg-runtime/components/appshell/platform-appshell.css","apps/sg-runtime/components/appshell/platform-appshell.tsx","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/adp-appshell-identity.test.tsx","apps/sg-runtime/tests/appshell-first-entry.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts","apps/srm/scripts/native-execution-adoption.test.mjs","apps/srm/scripts/rural-location-release.test.mjs","apps/srm/scripts/xray-performance-adoption.test.mjs","apps/srm/scripts/xray-style-acceptance.mjs","apps/srm/scripts/xray-workflow-contract.test.ts","apps/srm/src/server/peer-read-boundary.test.ts","apps/srm/src/server/supplier-location-geocoding-runtime.test.ts"]
export function assertAppShellFourCardCascade(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertAppShellFourCardCascade(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertAppShellFourCardCascade(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.d1AuditReaderPreparation){const n=assertD1AuditReaderPreparation(receipt,current,historical);return assertAppShellFourCardCascade(n.prior,n.previousBytes,historical)}
 const a=receipt.appShellFourCardCascade,file='apps/sg-runtime/operation-integration.json'
 assert.equal(a.taskId,'SG2-APPSHELL-FOUR-CARD-CASCADE-20261103')
 assert.equal(a.scope,'APPSHELL_DESK_PRESENTATION_ONLY');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.previousReceiptSourceSha,'b4023cb02e10fc7045f8b2bc173224ae3da3cb5a')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {appShellFourCardCascade,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every historical acceptance and hash remains immutable')
 assert.equal(digest(current(file)),digest(JSON.stringify(receipt,null,2)+'\n'),'exact current owner receipt bytes')
 assert.deepEqual(a.design,{projectId:'465533749308841984',componentId:'465804082116980736',revision:'468221236900696064',canonProjectId:'460628300646219776',canonComponentId:'460628347660177408',canonRevision:'468221248577622016'})
 assert.deepEqual(a.changedSourcePaths,APPSHELL_FOUR_CARD_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),APPSHELL_FOUR_CARD_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[relativeHostPath(file),hash])))
 assert.deepEqual(a.addedBoundaryFiles,['apps/sg-runtime/components/appshell/appshell-card-motion.ts'])
 for(const[file,hash]of Object.entries(a.sourceDigests)){assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(file)),hash,'exact AppShell desk source '+file)}
 for(const flag of ['moduleRuntimeChanged','backendChanged','authorizationChanged','apiContractsChanged','schemaChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>file==='apps/sg-runtime/operation-integration.json'||Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}

const XRAY_APPSHELL_PRESENTATION_FILES=["apps/sg-runtime/components/appshell/xray-module-host.tsx","apps/sg-runtime/docs/xray-appshell-ui.md","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/adp-appshell-preview.mjs","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-appshell-ui.test.tsx","apps/sg-runtime/tests/xray-appshell.test.tsx","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts","apps/srm/scripts/native-execution-adoption.test.mjs","apps/srm/scripts/pilot2-cold-overlay.mjs","apps/srm/scripts/pilot2-cold-overlay.test.mjs","apps/srm/scripts/pilot2-human-overlay.mjs","apps/srm/scripts/rural-location-release.test.mjs","apps/srm/scripts/xray-performance-adoption.test.mjs","apps/srm/scripts/xray-style-acceptance.mjs","apps/srm/scripts/xray-workflow-contract.test.ts","apps/srm/scripts/xray-workflow-react18.test.tsx","apps/srm/src/server/peer-read-boundary.test.ts","apps/srm/src/server/supplier-location-geocoding-runtime.test.ts","packages/srm-xray/docs/sg2-host-presentation.md","packages/srm-xray/scripts/build-full-report-css.mjs","packages/srm-xray/src/full-report.css","packages/srm-xray/src/full-workflow.tsx","packages/srm-xray/src/sg2-host-theme.css","packages/srm-xray/src/supplier-search.tsx"]
export function assertXrayAppShellPresentation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertXrayAppShellPresentation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertXrayAppShellPresentation(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.appShellFourCardCascade){const n=assertAppShellFourCardCascade(receipt,current,historical);return assertXrayAppShellPresentation(n.prior,n.previousBytes,historical)}
 const a=receipt.xrayAppShellPresentation
 assert.equal(a.taskId,'SG2-XRAY-APPSHELL-UI-20261102')
 assert.equal(a.producerTaskId,'SRM-XRAY-SG2-PRESENTATION-20261102')
 assert.equal(a.previousReceiptSourceSha,'6fdc75192275e296a443db2f1c1d8b4a659b084c')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.presentation,'sg2')
 const file='apps/sg-runtime/operation-integration.json',bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {xrayAppShellPresentation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every preceding acceptance and digest remains immutable')
 assert.equal(digest(current(file)),digest(JSON.stringify(receipt,null,2)+'\n'),'exact current owner receipt bytes')
 const peerFile='apps/srm/operation-integration.json',peerPriorBytes=historical(a.previousReceiptSourceSha,peerFile)
 const peerExpected={...JSON.parse(peerPriorBytes),xrayAppShellPresentation:{...a,
  projectKey:'SRM',previousReceiptSha256:digest(peerPriorBytes),
  applicationSourceDigests:Object.fromEntries(Object.entries(a.sourceDigests).map(([path,value])=>[posix.relative('apps/srm',path),value]))
 }}
 assert.equal(digest(current(peerFile)),digest(JSON.stringify(peerExpected,null,2)+'\n'),'exact reciprocal host receipt bytes')

 assert.deepEqual(a.changedSourcePaths,XRAY_APPSHELL_PRESENTATION_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),XRAY_APPSHELL_PRESENTATION_FILES)
 for(const[path,expected]of Object.entries(a.sourceDigests)){assert.match(expected,/^[a-f0-9]{64}$/);assert.equal(digest(current(path)),expected,'exact host presentation source '+path)}
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,value])=>[relativeHostPath(file),value])))
 const packageFiles=[...new Set([...prior.fullUiParityAdoption.publicUi.sourceFiles,'src/sg2-host-theme.css','docs/sg2-host-presentation.md'])].sort()
 assert.deepEqual(a.publicUi.sourceFiles,packageFiles);assert.equal(a.publicUi.version,prior.fullUiParityAdoption.publicUi.version)
 const packageHash=createHash('sha256');for(const file of packageFiles)packageHash.update(file).update('\0').update(current('packages/srm-xray/'+file)).update('\0')
 assert.equal(packageHash.digest('hex'),a.publicUi.sourceDigest,'exact current public X-Ray variant')
 for(const flag of ['standaloneDefaultsUnchanged','hostPresentationOnly','canonicalSourceStyles','nameCatalogDisabledInSg2'])assert.equal(a[flag],true,flag)
 for(const flag of ['businessLogicChanged','transportChanged','authorizationChanged','financialEngineChanged','schemaChanged','srmRuntimeDeploymentPerformed','excludedEnvironmentChanges'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:path=>['apps/sg-runtime/operation-integration.json','apps/srm/operation-integration.json'].includes(path)||Object.hasOwn(a.sourceDigests,path)?historical(a.previousReceiptSourceSha,path):current(path)}
}

const PCI_INPUT_CORRECTIVE_FILES=["apps/sg-runtime/components/price-change-index/price-change-index-controller.ts","apps/sg-runtime/components/price-change-index/price-change-index-layer.tsx","apps/sg-runtime/components/price-change-index/price-change-index-request.ts","apps/sg-runtime/docs/pci-smart-preparation.md","apps/sg-runtime/lib/cost-analysis/pci-smart-preparation-contracts.ts","apps/sg-runtime/lib/cost-analysis/price-change-index-operation.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-browser.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/pci-smart-operation.test.ts","apps/sg-runtime/tests/pci-smart-preview.mjs","apps/sg-runtime/tests/pci-smart-ui.test.tsx","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-full-ui-adoption.test.ts","apps/sg-runtime/tests/xray-gateway.test.ts"]
const XRAY_STYLE_FILES=["apps/sg-runtime/components/benchmark-finder/visual/magicpath/benchmark-finder.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-dropdown.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-shared.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-theme.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/spacing-bindings.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/srm-interaction-motion.css","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts","apps/sg-runtime/tests/xray-style-isolation.test.ts"]

const SENTRY_OBSERVABILITY_FILES=["apps/sg-runtime/app/global-error.tsx","apps/sg-runtime/instrumentation.ts","apps/sg-runtime/lib/observability/config.ts","apps/sg-runtime/lib/observability/sanitize.ts","apps/sg-runtime/lib/observability/server.ts","apps/sg-runtime/next.config.mjs","apps/sg-runtime/package-lock.json","apps/sg-runtime/package.json","apps/sg-runtime/sentry.client.config.ts","apps/sg-runtime/sentry.edge.config.ts","apps/sg-runtime/sentry.server.config.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/sentry-observability.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
const PRODUCT_ANALYTICS_FILES=["apps/sg-runtime/.env.example","apps/sg-runtime/app/[locale]/layout.tsx","apps/sg-runtime/components/analytics/product-analytics-provider.tsx","apps/sg-runtime/components/appshell/adp-module-host.tsx","apps/sg-runtime/components/appshell/appshell-dashboard.tsx","apps/sg-runtime/components/appshell/xray-module-host.tsx","apps/sg-runtime/components/auth/session-boundary.tsx","apps/sg-runtime/components/benchmark-finder/benchmark-finder-client.tsx","apps/sg-runtime/components/price-change-index/price-change-index-layer.tsx","apps/sg-runtime/docs/product-analytics.md","apps/sg-runtime/lib/product-analytics/adapter.ts","apps/sg-runtime/lib/product-analytics/config.ts","apps/sg-runtime/lib/product-analytics/contract.ts","apps/sg-runtime/package-lock.json","apps/sg-runtime/package.json","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/appshell-product-boundary.test.ts","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/product-analytics-ui.test.tsx","apps/sg-runtime/tests/product-analytics.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
export function assertProductAnalyticsContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertProductAnalyticsContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertProductAnalyticsContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.productAnalyticsCompatibility
 assert.equal(a.taskId,'SG2-POSTHOG-20261102')
 assert.equal(a.scope,'DEVELOPMENT_EXPLICIT_TEST_PRODUCT_ANALYTICS_ONLY')
 assert.equal(a.previousReceiptSourceSha,'76d9738ff73abb3600cf806d5b01c6b23133b451')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {productAnalyticsCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every historical receipt and original hash remains immutable')
 assert.deepEqual(a.changedSourcePaths,PRODUCT_ANALYTICS_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PRODUCT_ANALYTICS_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact product analytics source '+file)
 }
 for(const flag of ['authorizationChanged','financialEngineChanged','schemaChanged','existingTelemetryChanged','srmRuntimeChanged','privatePinsChanged','ciPolicyChanged','newBusinessProviderCalls','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const manifest=JSON.parse(current('apps/sg-runtime/package.json'))
 assert.equal(manifest.dependencies['posthog-js'],'1.444.0')
 assert.match(manifest.scripts['test:operation-context'],/tests\/product-analytics\.test\.ts tests\/product-analytics-ui\.test\.tsx/)
 assert.match(manifest.scripts['test:operation-context'],/&& npm run test:observability$/)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}

const MARKET_HISTORY_FILES=["apps/sg-runtime/deployment/market-history-targets.json","apps/sg-runtime/docs/market-history-ingestion.md","apps/sg-runtime/lib/benchmark/macrobond.ts","apps/sg-runtime/lib/market-data/history-contract.ts","apps/sg-runtime/lib/market-data/history-ingestion.ts","apps/sg-runtime/lib/market-data/history-observability.ts","apps/sg-runtime/lib/market-data/history-runtime.ts","apps/sg-runtime/lib/market-data/history-source.ts","apps/sg-runtime/lib/observability/sanitize.ts","apps/sg-runtime/package.json","apps/sg-runtime/prisma-market-data/private-write/003-market-history-install.sql","apps/sg-runtime/prisma-market-data/private-write/003-market-history.sql","apps/sg-runtime/scripts/run-market-data-hydration.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/market-history.integration.test.mjs","apps/sg-runtime/tests/market-history.test.ts","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/sentry-observability.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
const PRODUCT_ANALYTICS_MAIN_CHANGED_FILES=["apps/sg-runtime/package.json","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/product-analytics-ui.test.tsx","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
const PRODUCT_ANALYTICS_MAIN_BOUND_FILES=[...new Set([...MARKET_HISTORY_FILES,...PRODUCT_ANALYTICS_FILES])].sort()
const PRODUCT_ANALYTICS_MAIN_FLAGS=['analyticsRuntimeChanged','marketHistoryRuntimeChanged','authorizationChanged','schemaChanged','existingTelemetryChanged','srmRuntimeChanged','privatePinsChanged','ciPolicyChanged','newBusinessProviderCalls','deploymentPerformed','productDataChanged']
export function assertProductAnalyticsMainContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertProductAnalyticsMainContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertProductAnalyticsMainContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.productAnalyticsMainCompatibility,file='apps/sg-runtime/operation-integration.json'
 assert.equal(a.taskId,'SG2-POSTHOG-MAIN-COMPAT-20261102');assert.equal(a.scope,'TEST_METADATA_ONLY_ACCEPTED_MAIN_AND_PRODUCT_ANALYTICS')
 assert.equal(a.previousReceiptSourceSha,'7bb65a0c246470a654fb4e4822f8416270a3fe1f')
 assert.equal(a.analyticsReceiptSourceSha,'6389283b83ce942a57cd894724d22c03948f27a8')
 assert.equal(a.sharedBaselineSourceSha,'76d9738ff73abb3600cf806d5b01c6b23133b451')
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes),analyticsReceiptBytes=historical(a.analyticsReceiptSourceSha,file),analyticsReceipt=JSON.parse(analyticsReceiptBytes)
 assert.equal(digest(bytes),a.previousReceiptSha256);assert.equal(digest(analyticsReceiptBytes),a.analyticsReceiptSha256)
 const {productAnalyticsMainCompatibility,productAnalyticsCompatibility,...mainPreserved}=receipt
 assert.deepEqual(mainPreserved,prior,'every accepted market-history and earlier receipt remains immutable')
 const {productAnalyticsMainCompatibility:combined,marketHistoryIngestionCompatibility,...analyticsPreserved}=receipt
 assert.deepEqual(analyticsPreserved,analyticsReceipt,'every prior Product Analytics and earlier receipt remains immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','previousReceiptSourceSha','previousReceiptSha256','analyticsReceiptSourceSha','analyticsReceiptSha256','sharedBaselineSourceSha','changedSourcePaths','sourceDigests','applicationSourceDigests','testMetadataOnly',...PRODUCT_ANALYTICS_MAIN_FLAGS].sort())
 assert.equal(a.testMetadataOnly,true);for(const flag of PRODUCT_ANALYTICS_MAIN_FLAGS)assert.equal(a[flag],false,flag)
 assert.deepEqual(a.changedSourcePaths,PRODUCT_ANALYTICS_MAIN_CHANGED_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PRODUCT_ANALYTICS_MAIN_BOUND_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([path,hash])=>[path.slice(16),hash])))
 for(const[path,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(path)),hash,'exact combined SG2 source '+path)
  if(!PRODUCT_ANALYTICS_MAIN_CHANGED_FILES.includes(path))assert.equal(hash,digest(historical(PRODUCT_ANALYTICS_FILES.includes(path)?a.analyticsReceiptSourceSha:a.previousReceiptSourceSha,path)),'accepted runtime and SQL bytes remain unchanged '+path)
 }
 const mainSource=path=>path===file?bytes:Object.hasOwn(a.sourceDigests,path)?historical(a.previousReceiptSourceSha,path):current(path)
 const analyticsSource=path=>path===file?analyticsReceiptBytes:Object.hasOwn(a.sourceDigests,path)?historical(a.analyticsReceiptSourceSha,path):current(path)
 assertMarketHistoryIngestionContinuation(prior,mainSource,historical)
 assertProductAnalyticsContinuation(analyticsReceipt,analyticsSource,historical)
 const pkg=JSON.parse(current('apps/sg-runtime/package.json')),script=pkg.scripts['test:operation-context']
 assert.equal(pkg.dependencies['posthog-js'],'1.444.0')
 for(const test of ['tests/product-analytics.test.ts','tests/product-analytics-ui.test.tsx','tests/pci-smart-integrity.test.mjs'])assert.equal(script.split(test).length-1,1,test+' remains reachable exactly once')
 assert.match(script,/&& npm run test:observability && npm run test:market-history$/)
 assert.match(current('apps/sg-runtime/tests/pci-smart-integrity.test.mjs').toString(),/^import ['"]\.\/xray-style-isolation\.test\.ts['"]\s*;?$/m)
 return {prior,previousBytes:mainSource,analyticsReceipt,analyticsBytes:analyticsSource}
}
export function assertMarketHistoryIngestionContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertMarketHistoryIngestionContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertMarketHistoryIngestionContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.marketHistoryIngestionCompatibility
 assert.equal(a.taskId,'SG2-MARKET-HISTORY-INGESTION-20261102')
 assert.equal(a.scope,'GENERIC_LICENSED_HISTORY_SOURCE_AND_MARKET_DATA')
 assert.equal(a.previousReceiptSourceSha,'76d9738ff73abb3600cf806d5b01c6b23133b451')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {marketHistoryIngestionCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all accepted source and monitoring receipts remain immutable')
 assert.deepEqual(Object.keys(a).sort(),['taskId','scope','previousReceiptSourceSha','previousReceiptSha256','changedSourcePaths','sourceDigests','applicationSourceDigests','authorizationChanged','schemaAdded','producerChanged','finderBoundaryChanged','forecastMathChanged','ciWorkflowChanged','testEntryExtended','liveInstallationPerformed','deploymentPerformed'].sort())
 assert.deepEqual(a.changedSourcePaths,MARKET_HISTORY_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),MARKET_HISTORY_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact generic market-history source '+file)
 }
 for(const flag of ['authorizationChanged','schemaAdded','testEntryExtended'])assert.equal(a[flag],true,flag)
 for(const flag of ['producerChanged','finderBoundaryChanged','forecastMathChanged','ciWorkflowChanged','liveInstallationPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const pkg=JSON.parse(current('apps/sg-runtime/package.json'))
 assert.match(pkg.scripts['test:operation-context'],/&& npm run test:observability && npm run test:market-history$/)
 assert.equal(pkg.scripts['test:market-history'],'node --import tsx --test tests/market-history.test.ts tests/market-history.integration.test.mjs')
 assert.match(current('apps/sg-runtime/tests/pci-smart-integrity.test.mjs').toString(),/^import ['"]\.\/xray-style-isolation\.test\.ts['"]\s*;?$/m)
 const targets=JSON.parse(current('apps/sg-runtime/deployment/market-history-targets.json'))
 assert.equal(targets.boundaryDigest,digest(current('apps/sg-runtime/prisma-market-data/private-write/003-market-history.sql')))
 assert.equal(targets.applicationId,'spendguru-market-history');assert.equal(targets.quotaMode,'UNMETERED')
 assert.equal(targets.defaultEnabled,false);assert.equal(targets.runtimeRole,'sg2_market_history_development_runtime')
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertSentryObservabilityContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertSentryObservabilityContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertSentryObservabilityContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.sentryObservabilityCompatibility
 assert.equal(a.taskId,'SG2-SENTRY-INTEGRITY-20261101')
 assert.equal(a.scope,'SCOPED_TECHNICAL_OBSERVABILITY_ONLY')
 assert.equal(a.previousReceiptSourceSha,'7b0ec69b9c5bbc504483c734b09b4f8f242dea8f')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {sentryObservabilityCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all earlier accepted receipts and hashes remain immutable')
 assert.deepEqual(a.changedSourcePaths,SENTRY_OBSERVABILITY_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),SENTRY_OBSERVABILITY_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact Sentry receiving source '+file)
 }
 for(const flag of ['authorizationChanged','financialEngineChanged','schemaChanged','existingTelemetryChanged','srmRuntimeChanged','privatePinsChanged','ciPolicyChanged','newBusinessProviderCalls','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const script=JSON.parse(current('apps/sg-runtime/package.json')).scripts['test:operation-context']
 assert.match(script,/&& npm run test:observability$/)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertXrayStyleIsolationContinuation(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertXrayStyleIsolationContinuation(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertXrayStyleIsolationContinuation(n.prior,n.previousBytes,n.historicalBytes)}
 const a=receipt.xrayStyleIsolationContinuation
 assert.equal(a.taskId,'SG2-XRAY-STYLE-ACCEPTANCE-CLOSURE-B-20261101-R16')
 assert.equal(a.previousReceiptSourceSha,'b965924a63fafb1a24b84ceb389dfd5e78648f57')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {xrayStyleIsolationContinuation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every accepted receipt and original digest stays immutable')
 assert.deepEqual(a.changedSourcePaths,XRAY_STYLE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),XRAY_STYLE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact X-Ray style continuation '+file)
 }
 const script=JSON.parse(current('apps/sg-runtime/package.json')).scripts['test:operation-context']
 assert.match(script,/(?:^|\s)tests\/pci-smart-integrity\.test\.mjs(?:\s|$)/)
 assert.match(current('apps/sg-runtime/tests/pci-smart-integrity.test.mjs').toString(),/^import ['"]\.\/xray-style-isolation\.test\.ts['"]\s*;?$/m,'normal CI must directly run the CSS regression')
 for(const flag of ['publicPackageChanged','srmRuntimeChanged','freshOrReadyChanged','authorizationChanged','financialEngineChanged','schemaChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertPciInputCorrective(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.appShellFourCardCascade){const n=assertAppShellFourCardCascade(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsMainCompatibility){const n=assertProductAnalyticsMainContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.productAnalyticsCompatibility){const n=assertProductAnalyticsContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.marketHistoryIngestionCompatibility){const n=assertMarketHistoryIngestionContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.sentryObservabilityCompatibility){const n=assertSentryObservabilityContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.xrayStyleIsolationContinuation){const n=assertXrayStyleIsolationContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 const a=receipt.pciSmartInputCorrective
 assert.equal(a.taskId,'SG2-PCI-SMART-LIVE-400-CORRECTIVE-20261101')
 assert.equal(a.previousReceiptSourceSha,'4040eaf576c6934ede4f9040e52c5c3f9e8bd9fa')
 assert.equal(a.rootCause,'EMPTY_OPTIONAL_PERIOD_BASIS_SENTINEL')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {pciSmartInputCorrective,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier receipt and original digest stays immutable')
 assert.deepEqual(a.changedSourcePaths,PCI_INPUT_CORRECTIVE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PCI_INPUT_CORRECTIVE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact PCI input corrective '+file)
 }
 for(const flag of ['methodologyChanged','cciCoreChanged','indexedPriceChanged','authorizationChanged','srmRuntimeChanged','schemaChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertPciSmartIntegrity(receipt,current,historical){
 if(receipt.sourceHubApiPathCompatibility){const n=assertSourceHubApiPathCompatibility(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,historical)}
 if(receipt.appShellAssistantOwnership){const n=assertAppShellAssistantOwnership(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,n.historicalBytes)}
 if(receipt.appShellFourCardCascade){const n=assertAppShellFourCardCascade(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,historical)}
 if(receipt.xrayAppShellPresentation){const n=assertXrayAppShellPresentation(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,historical)}
 if(receipt.pciSmartInputCorrective){const n=assertPciInputCorrective(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,historical)}
 // The later UI candidate binds every changed current host byte, then exposes
 // the exact accepted PCI predecessor to the unchanged PCI integrity checks.
 if(receipt.fullUiParityAdoption){
  const ui=receipt.fullUiParityAdoption,bytes=historical(ui.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
  assert.equal(ui.projectKey,'SG2');assert.equal(ui.taskId,'SG2-XRAY-FULL-UI-PARITY-B-20261031')
  assert.equal(digest(bytes),ui.previousReceiptDigest)
  const {fullUiParityAdoption,...preserved}=receipt
  assert.deepEqual(preserved,prior,'UI preserves the complete accepted PCI receipt')
  for(const[file,hash]of Object.entries(ui.applicationSourceDigests))assert.equal(digest(current('apps/sg-runtime/'+file)),hash,'current UI continuation '+file)
  const previous=file=>Object.hasOwn(ui.applicationSourceDigests,file.replace(/^apps\/sg-runtime\//,''))?historical(ui.previousReceiptSourceSha,file):current(file)
  return assertPciSmartIntegrity(prior,previous,historical)
 }
 if(Object.hasOwn(receipt,'pciSmartResultingMainScopeCompatibility')){
  const a=receipt.pciSmartResultingMainScopeCompatibility
  assert.equal(a.taskId,'SG2-PCI-SMART-PREPARATION-DEVELOPMENT-RELEASE-20261031')
  assert.equal(a.scope,'EXACT_SOURCE_COVERAGE_ON_CANDIDATE_AND_RESULTING_MAIN')
  assert.equal(a.previousReceiptSourceSha,'10efd606f78cb08ae4fccde84b8c2e958bb54d9d')
  const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
  assert.equal(digest(bytes),a.previousReceiptSha256)
  const {pciSmartResultingMainScopeCompatibility,...preserved}=receipt
  assert.deepEqual(preserved,prior,'all accepted receipts and historical digests stay immutable')
  assert.deepEqual(Object.keys(a.sourceDigests).sort(),["apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"])
  assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,d])=>[f.slice(16),d])))
  for(const[file,hash]of Object.entries(a.sourceDigests))assert.equal(digest(current(file)),hash,'exact resulting-main integrity source '+file)
  for(const flag of ['productChanged','cciCoreChanged','indexedPriceChanged','authorizationChanged','srmRuntimeChanged','sqlChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
  return assertPciSmartIntegrity(prior,file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file),historical)
 }
 const a=receipt.pciSmartPreparationCompatibility
 assert(a,'smart source receipt required')
 assert.equal(a.taskId,'SG2-PCI-SMART-PREPARATION-FULL-IMPLEMENTATION-20261030')
 assert.equal(a.requestVersion,'sg2.price-change-index.smart/1.0.0');assert.equal(a.preparationVersion,'PCI_SMART_PREPARATION_V1')
 assert.equal(a.proxyOutput,'MARKET_INDEX_ONLY_NO_PURCHASE_PRICE_PROJECTION')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {pciSmartPreparationCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all original entries and digests remain immutable')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),a.changedSourcePaths)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).filter(([f])=>f.startsWith('apps/sg-runtime/')).map(([f,d])=>[f.slice(16),d])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert(!file.startsWith('/')&&!file.split('/').includes('..')&&(file.startsWith('apps/sg-runtime/')||file.startsWith('packages/sg2-price-change-index-ui/')||file.startsWith('apps/sg2-price-change-index-demo/test/')||file==='.github/workflows/sg2-price-change-index-ci.yml'))
  assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(file)),hash,'exact smart source '+file)
 }
 assert.deepEqual(a.preservedEnginePaths,prior.bqlPciFirstSourceCompatibility.preservedEnginePaths.filter(file=>file!=='apps/sg-runtime/lib/cost-analysis/price-change-index-operation.ts'))
 for(const file of a.preservedEnginePaths)assert.equal(digest(current(file)),digest(historical(a.previousReceiptSourceSha,file)),'unchanged engine '+file)
 for(const flag of ['cciCoreChanged','indexedPriceChanged','sourceHistoryChanged','authorizationContractChanged','schemaChanged','newPaidProviderCalls','srmRuntimeChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 return{prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}

// Test-only additive compatibility; never imported by a product runtime.
export function assertSourceHubApiPathCompatibility(receipt,current,historical,{validatePeer=true}={}){
 const a=receipt.sourceHubApiPathCompatibility,file='apps/sg-runtime/operation-integration.json'
 assert.equal(a.taskId,'SG2-SOURCE-HUB-API-PATH-COMPATIBILITY-20261103')
 assert.equal(a.platformVersion,'1.33.0');assert.equal(a.apiPathContractVersion,'1.0.0')
 assert.equal(a.previousReceiptSourceSha,'a3e64a93801cb197af856bf2d282a6158b01c71d')
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,885)
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {sourceHubApiPathCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every accepted product, analytics and historical receipt is immutable')
 assert.deepEqual(Object.keys(a.consumerSourceDigests).sort(),["apps/dashboard-preview/package-lock.json", "apps/sg-runtime/package-lock.json", "apps/sg-runtime/tests/adp-appshell-consumer.test.tsx", "apps/sg-runtime/tests/category-operation.test.ts", "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs", "apps/sg-runtime/tests/identity-runtime.test.ts", "apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs", "apps/sg-runtime/tests/native-sql-roundtrips.test.mjs", "apps/sg-runtime/tests/operation-context.test.mjs", "apps/sg-runtime/tests/pci-smart-integrity.mjs", "apps/sg-runtime/tests/pci-smart-integrity.test.mjs", "apps/sg-runtime/tests/porr-demo-middleware.test.ts", "apps/sg-runtime/tests/private-host.integration.test.mjs", "apps/sg-runtime/tests/self-service-account.test.ts", "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs", "apps/sg-runtime/tests/xray-gateway.test.ts"])
 assert.deepEqual(Object.keys(a.peerSourceDigests).sort(),["apps/maps-runtime/platform-integration.json", "apps/maps-runtime/test/embed.test.mjs", "apps/srm/scripts/native-execution-adoption.test.mjs", "apps/srm/scripts/xray-performance-adoption.test.mjs", "apps/srm/scripts/xray-style-acceptance.mjs", "packages/maps-embed/package.json"],'closed read-only dependency metadata, never consumer edit authority')
 for(const [p,h]of Object.entries(a.peerSourceDigests))assert.equal(digest(current(p)),h,'current peer dependency metadata '+p)
 for(const [p,h]of Object.entries(a.consumerSourceDigests))assert.equal(digest(current(p)),h,'current consumer compatibility '+p)
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(digest(current('packages/platform-contracts/'+p)),h,'current SDK '+p)
 for(const [p,h]of Object.entries(a.producerMetadataDigests))assert.equal(digest(current(p)),h,'current optional peer metadata '+p)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests}).map(([p,h])=>[posix.relative('apps/sg-runtime',p),h])))
 for(const flag of ['apiPathOptedIn','sql028Installed','businessLogicChanged','uiChanged','authorizationChanged','sourceBindingsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const mapped=new Set([...Object.keys(a.consumerSourceDigests),...Object.keys(a.peerSourceDigests),...Object.keys(a.sourceDigests).map(p=>'packages/platform-contracts/'+p),...Object.keys(a.producerMetadataDigests)])
 // Validate both current closures before either shared SDK is viewed through its predecessor.
 const peerFile='apps/srm/operation-integration.json'
 const peerReceipt=validatePeer?JSON.parse(current(peerFile)):null
 const peerView=peerReceipt?.sourceHubApiPathCompatibility?assertPeerApiPathCompatibility(peerReceipt,current,historical,{validatePeer:false}):null
 const priorBytes=new Map([[file,bytes]])
 const predecessor=p=>{if(!priorBytes.has(p))priorBytes.set(p,Buffer.from(historical(a.previousReceiptSourceSha,p)));return Buffer.from(priorBytes.get(p))}
 return {prior,previousBytes:p=>p===file||mapped.has(p)?predecessor(p):peerView?.previousBytes(p)??current(p)}
}
