import {marketCalendarSourcePredecessor,MARKET_CALENDAR_CONSUMER_RECORD} from '../../architecture-lab/market-calendar-source.mjs'
import {recurringSourcePredecessor} from '../../architecture-lab/private-recurring-source.mjs'
import './assistant-send-arrow-integrity.test.mjs'
import './assistant-ecr-integrity.test.mjs'
import './assistant-ecr-week-integrity.test.mjs'
import {WEEK_RECEIPT} from './assistant-ecr-week-integrity.mjs'
import {assistantEcrPredecessor,ECR_RECEIPT} from './assistant-ecr-integrity.mjs'
import {assistantEcrPrecisionPredecessor,PRECISION_RECEIPT} from './assistant-ecr-precision-integrity.mjs'
import {assistantSendArrowPredecessor,SEND_ARROW_RECEIPT} from './assistant-send-arrow-integrity.mjs'
import '../scripts/denial-audit/d1-reader.test.mjs'
import './xray-style-isolation.test.ts'
import './finder-development-bindings.test.mjs'
import './benchmark-metadata-prefetch.test.ts'
import './registration-stage-i-integrity.test.mjs'
import {registrationStageOnePredecessor,REGISTRATION_ENTRY_PATH} from './registration-stage-i-integrity.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {assertPciSmartIntegrity,digest as digestForTest} from './pci-smart-integrity.mjs'
import {assistantM2Predecessor} from './assistant-m2-integrity.mjs'
import {procurementInsightsPredecessor} from './procurement-insights-integrity.mjs'
import {assistantMarkdownPredecessor} from './assistant-markdown-integrity.mjs'
const receipt=()=>JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
// Git blobs are immutable. Cache only historical reads; every current-file read remains fresh.
const historicalBlobs=new Map()
const historical=(sha,file)=>{const key=sha+':'+file;if(!historicalBlobs.has(key))historicalBlobs.set(key,execFileSync('git',['show',key]));return historicalBlobs.get(key)}

test('metadata pacing continuation binds current input handling and rejects authority or history drift',()=>{
 const r=receipt(),f=r.finderMetadataRequestPacing;assert(f)
 assert.match(JSON.parse(current('apps/sg-runtime/package.json')).scripts['test:operation-context'],/tests\/pci-smart-integrity\.test\.mjs/)
 assert.match(current('apps/sg-runtime/tests/pci-smart-integrity.test.mjs').toString(),/^import '\.\/benchmark-metadata-prefetch\.test\.ts'$/m)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of f.boundSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 for(const mutate of [x=>x.finderMetadataRequestPacing.remoteQueryDelayMs=0,x=>x.finderMetadataRequestPacing.prewarmedQueriesReused=false,
  x=>x.finderMetadataRequestPacing.pendingQueriesCancelled=false,x=>x.finderMetadataRequestPacing.retiredRequestCleanupGuarded=false,
  x=>x.finderMetadataRequestPacing.authorizationChanged=true,x=>x.finderMetadataRequestPacing.providerBudgetsChanged=true,
  x=>x.finderMetadataRequestPacing.previousReceiptSha256='0'.repeat(64),x=>x.finderMetadataDictionaryLookups.searchCriteriaPreserved=false]){
  const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))
 }
})

test('dictionary lookup continuation preserves SEARCH criteria and rejects scope or history tampering',()=>{
 const r=receipt(),f=r.finderMetadataDictionaryLookups;assert(f);assertPciSmartIntegrity(r,current,historical)
 for(const file of f.boundSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 for(const mutate of [x=>x.finderMetadataDictionaryLookups.searchCriteriaPreserved=false,x=>x.finderMetadataDictionaryLookups.emptyDictionaryMatchesStayLocal=false,
  x=>x.finderMetadataDictionaryLookups.authorizationChanged=true,x=>x.finderMetadataDictionaryLookups.providerBudgetsChanged=true,
  x=>x.finderMetadataDictionaryLookups.dictionaryScope='CASCADE',x=>x.finderMetadataDictionaryLookups.previousReceiptSha256='0'.repeat(64),
  x=>x.finderMetadataSingleFlight.cacheScope='GLOBAL']){const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))}
})

test('Finder recovery binds current source and rejects stale receipts or expanded authority',()=>{
 const r=receipt(),f=r.finderMetadataSingleFlight;assert(f)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of f.boundSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 for(const mutate of [x=>x.finderMetadataSingleFlight.providerBudgetsChanged=true,
  x=>x.finderMetadataSingleFlight.authorizationChanged=true,x=>x.finderMetadataSingleFlight.cacheScope='GLOBAL',
  x=>x.finderMetadataSingleFlight.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),
  x=>x.finderMetadataSingleFlight.previousReceiptSha256='0'.repeat(64),
  x=>x.sourceHubApiPathCompatibility.apiPathOptedIn=true]){
   const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))
 }
})

test('full application monitoring binds every source and rejects consent, Finder, privacy or scope weakening',()=>{
 const r=receipt(),a=r.productAnalyticsMonitoringCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of a.boundSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [r=>r.productAnalyticsMonitoringCompatibility.finderExcluded=false,r=>r.productAnalyticsMonitoringCompatibility.testConsentRequired=false,
  r=>r.productAnalyticsMonitoringCompatibility.geoipSuppression=false,r=>r.productAnalyticsMonitoringCompatibility.ordinaryUsersActivated=true,
  r=>r.productAnalyticsMonitoringCompatibility.consentMechanismChanged=true,r=>r.productAnalyticsMonitoringCompatibility.rawDomCapture=true,
  r=>r.productAnalyticsMonitoringCompatibility.boundSourcePaths.pop(),r=>r.productAnalyticsMonitoringCompatibility.previousReceiptSha256='0'.repeat(64),
  r=>r.productAnalyticsMonitoringCompatibility.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),r=>r.productAnalyticsStageOnePrivacyCompatibility.geoipSuppression=false]){
   const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))
 }
})

test('GeoIP privacy continuation binds current SDK/test bytes and preserves every accepted receipt',()=>{
 const r=receipt(),a=r.productAnalyticsStageOnePrivacyCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const f of a.boundSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===f?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),f)
 for(const mutate of [
  x=>x.productAnalyticsStageOnePrivacyCompatibility.geoipSuppression=false,
  x=>x.productAnalyticsStageOnePrivacyCompatibility.finderExcluded=false,
  x=>x.productAnalyticsStageOnePrivacyCompatibility.testConsentRequired=false,
  x=>x.productAnalyticsStageOnePrivacyCompatibility.previousReceiptSourceSha='0'.repeat(40),
  x=>x.productAnalyticsStageOnePrivacyCompatibility.previousReceiptSha256='0'.repeat(64),
  x=>x.productAnalyticsStageOnePrivacyCompatibility.boundSourcePaths.pop(),
  x=>x.productAnalyticsStageOnePrivacyCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  x=>delete x.productAnalyticsStageOnePrivacyCompatibility.sourceDigests[a.boundSourcePaths[0]],
  x=>x.productAnalyticsStageOnePrivacyCompatibility.posthogProjectSettingsChanged=true,
  x=>x.productAnalyticsStageOneCompatibility.finderExcluded=false,
  x=>x.contract.sourceDigest='0'.repeat(64),
 ]){const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))}
})

test('stage-one analytics receipt preserves all history and rejects Finder-exclusion or scope tampering',()=>{
 const r=receipt(),a=r.productAnalyticsStageOneCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [r=>r.productAnalyticsStageOneCompatibility.finderExcluded=false,r=>r.productAnalyticsStageOneCompatibility.testConsentRequired=false,
  r=>r.productAnalyticsStageOneCompatibility.sourceBindingsChanged=true,r=>r.productAnalyticsStageOneCompatibility.changedSourcePaths.pop(),
  r=>r.productAnalyticsStageOneCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.productAnalyticsStageOneCompatibility.previousReceiptSha256='0'.repeat(64),r=>r.d1AuditReaderPreparation.producerSourceSha='0'.repeat(40)]){
  const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))
 }
})
function candidateSourcePaths(root){
 // The receipt's historical baseline remains immutable. Scope coverage uses the
 // actual PR merge-base, so already accepted parallel work is not attributed to PCI.
 const base=execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8',cwd:root}).trim()
 return execFileSync('git',['diff','--name-only',base,'HEAD','--','apps/sg-runtime','packages/sg2-price-change-index-ui','apps/sg2-price-change-index-demo'],{encoding:'utf8',cwd:root}).trim().split('\n').filter(f=>f&&f!=='apps/sg-runtime/operation-integration.json').sort()
}
function assertSourceCoverage(changed,bound){
 assert.deepEqual(changed,changed.filter(file=>Object.hasOwn(bound,file)),'every actual candidate amendment requires an exact source binding')
}
test('smart preparation strictly binds all new/current sources while retaining every historical acceptance and engine',()=>assertPciSmartIntegrity(receipt(),current,historical))
test('tampered current file, receipt, historical digest, engine and rollback evidence are rejected',()=>{
 const r=receipt(),file=r.pciSmartPreparationCompatibility.changedSourcePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartPreparationCompatibility.sourceDigests[file]='0'.repeat(64),r=>r.pciSmartPreparationCompatibility.srmRuntimeChanged=true,r=>r.bqlPciFirstSourceCompatibility.rulesetVersion='tampered',r=>{if(r.fullUiParityAdoption)r.fullUiParityAdoption.previousReceiptDigest='0'.repeat(64);else r.pciSmartPreparationCompatibility.previousReceiptSha256='0'.repeat(64)}]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
 assert.throws(()=>assertPciSmartIntegrity(r,current,(sha,f)=>Buffer.concat([historical(sha,f),Buffer.from('tamper')])))
 const engine=r.pciSmartPreparationCompatibility.preservedEnginePaths[0]
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===engine?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
})
test('every changed SG2 source in the candidate or resulting main has an exact additive binding',()=>{
 const r=receipt(),a=r.pciSmartPreparationCompatibility
 const calendar=marketCalendarSourcePredecessor(current,historical)
 const recurring=recurringSourcePredecessor(current,historical)
 const week=recurring?.successor
 const precision=assistantEcrPrecisionPredecessor(current,historical)
 const ecr=assistantEcrPredecessor(current,historical)
 const arrow=assistantSendArrowPredecessor(current,historical)
 const registration=registrationStageOnePredecessor(current,historical)
 const m2=assistantM2Predecessor(current,historical)
 const pi=procurementInsightsPredecessor(current,historical)
 const markdown=assistantMarkdownPredecessor(current,historical)
 // Like the original receipt, the closed, validated build manifest declares
 // the source graph rather than containing a self-referential file hash.
 const changed=candidateSourcePaths(new URL('../../../',import.meta.url)).filter(file=>(!calendar||file!==MARKET_CALENDAR_CONSUMER_RECORD)&&(!week||file!==WEEK_RECEIPT)&&(!recurring||file!=='apps/sg-runtime/private-recurring-source-adoption.json')&&(!precision||file!==PRECISION_RECEIPT)&&(!ecr||file!==ECR_RECEIPT)&&(!arrow||file!==SEND_ARROW_RECEIPT)&&(!registration||file!==REGISTRATION_ENTRY_PATH)&&(!m2||file!=='apps/sg-runtime/assistant-context-integration.json')&&(!pi||file!=='apps/sg-runtime/procurement-insights-integration.json')&&(!markdown||file!=='apps/sg-runtime/assistant-markdown-integration.json'))
 // Prisma lifecycle output is independently generated, never an authored source change.
 // A published receipt retains its original source set after merge. Current
 // bytes are strictly verified above; an accepted main has no new amendments.
 assertSourceCoverage(changed,{...calendar?.manifest.sourceDigests,...week?.manifest.sourceDigests,...recurring?.manifest.sourceDigests,...precision?.manifest.sourceDigests,...ecr?.manifest.sourceDigests,...arrow?.manifest.sourceDigests,...markdown?.manifest.sourceDigests,...registration?.manifest.sourceDigests,...pi?.manifest.sourceDigests,...m2?.manifest.sourceDigests,...a.sourceDigests,...r.xrayAppShellPresentation?.sourceDigests,...r.appShellFourCardCascade?.sourceDigests,...r.d1AuditReaderPreparation?.sourceDigests,...r.productAnalyticsStageOneCompatibility?.sourceDigests,...r.xrayStyleIsolationContinuation?.sourceDigests,...r.sentryObservabilityCompatibility?.sourceDigests,...r.marketHistoryIngestionCompatibility?.sourceDigests,...r.pciSmartInputCorrective?.sourceDigests,...r.pciSmartResultingMainScopeCompatibility?.sourceDigests,...Object.fromEntries(Object.entries(r.fullUiParityAdoption?.applicationSourceDigests??{}).map(([f,d])=>['apps/sg-runtime/'+f,d])),...r.productAnalyticsMainCompatibility?.sourceDigests,...r.appShellFourCardCascade?.sourceDigests,...r.d1AuditReaderPreparation?.sourceDigests,...r.productAnalyticsStageOneCompatibility?.sourceDigests,...r.productAnalyticsMonitoringCompatibility?.sourceDigests,...r.appShellAssistantOwnership?.sourceDigests,...r.sourceHubApiPathCompatibility?.consumerSourceDigests,...r.finderMetadataSingleFlight?.sourceDigests,...r.finderMetadataDictionaryLookups?.sourceDigests,...r.finderMetadataRequestPacing?.sourceDigests,...r.sourceHubMarketSymbolCompatibility?.sourceDigests,...r.assistantM1SourceCompatibility?.sourceDigests,...r.assistantM1RuntimeSourceCompatibility?.consumerSourceDigests,...r.oilAutonomousReportCompatibility?.consumerSourceDigests,...r.assistantM1ChartContextCorrective?.sourceDigests,...r.oilAutonomousReportCompatibility?.sourceDigests})

})
test('scope coverage retains accepted parallel files but rejects any unbound candidate amendment',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg2-pci-source-scope-'))
 const git=(...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,encoding:'utf8'})
 const write=(file,text)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text)}
 const parallel='apps/sg-runtime/docs/accepted-maps.md',pci='apps/sg-runtime/lib/pci-candidate.ts'
 const commit=()=>{git('add','.');git('-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','-qm','isolated fixture')}
 try{
  git('init','-q','-b','main');write('README.md','fixture');commit()
  write(parallel,'accepted independent owner source');commit();git('update-ref','refs/remotes/origin/main','HEAD')
  git('switch','-qc','candidate');write(pci,'PCI source');commit()
  assert.deepEqual(candidateSourcePaths(root),[pci])
  assertSourceCoverage(candidateSourcePaths(root),{[pci]:'exact digest checked by the integrity verifier'})
  git('update-ref','refs/remotes/origin/main','HEAD')
  assert.deepEqual(candidateSourcePaths(root),[])
  assertSourceCoverage(candidateSourcePaths(root),{[pci]:'retained published binding'})
  write(parallel,'unapproved amendment');commit()
  assert.deepEqual(candidateSourcePaths(root),[parallel])
  assert.throws(()=>assertSourceCoverage(candidateSourcePaths(root),{[pci]:'retained published binding'}),'An amendment to accepted parallel work must remain detectable')
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
test('resulting-main continuation rejects every amended current source and prior-receipt manipulation',()=>{
 const r=receipt(),a=r.pciSmartResultingMainScopeCompatibility
 assert(a)
 for(const file of Object.keys(a.sourceDigests))assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartResultingMainScopeCompatibility.previousReceiptSha256='0'.repeat(64),r=>r.pciSmartResultingMainScopeCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),r=>r.pciSmartResultingMainScopeCompatibility.productChanged=true,r=>r.unapprovedReceipt={}]){
  const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))
 }
})

test('input corrective rejects altered current bytes, omitted bindings and rewritten history',()=>{
 const r=receipt(),a=r.pciSmartInputCorrective;assert(a)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
 for(const mutate of [r=>r.pciSmartInputCorrective.previousReceiptSha256='0'.repeat(64),r=>r.pciSmartInputCorrective.changedSourcePaths.pop(),r=>r.pciSmartInputCorrective.methodologyChanged=true,r=>r.fullUiParityAdoption.publicUi.version='changed']){
  const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))
 }
})


test('X-Ray style continuation strictly binds every amended source and preserves accepted history',()=>{
 const r=receipt(),a=r.xrayStyleIsolationContinuation;assert(a)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [
  r=>delete r.xrayStyleIsolationContinuation.sourceDigests[r.xrayStyleIsolationContinuation.changedSourcePaths[0]],
  r=>r.xrayStyleIsolationContinuation.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.xrayStyleIsolationContinuation.changedSourcePaths.pop(),
  r=>r.xrayStyleIsolationContinuation.previousReceiptSourceSha='0'.repeat(40),
  r=>r.xrayStyleIsolationContinuation.previousReceiptSha256='0'.repeat(64),
  r=>r.xrayStyleIsolationContinuation.authorizationChanged=true,
  r=>r.fullUiParityAdoption.publicUi.sourceDigest='0'.repeat(64),
  r=>r.unapprovedReceipt={}
 ]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})
test('X-Ray style regression remains reachable from the unchanged normal CI entry',()=>{
 const r=receipt(),file='apps/sg-runtime/tests/pci-smart-integrity.test.mjs'
 // Even a matching replacement digest cannot remove the actual regression import.
 const bytes=Buffer.from(current(file).toString().replace("import './xray-style-isolation.test.ts'",'// removed'))
 r.xrayStyleIsolationContinuation.sourceDigests[file]=digestForTest(bytes)
 r.xrayStyleIsolationContinuation.applicationSourceDigests['tests/pci-smart-integrity.test.mjs']=digestForTest(bytes)
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?bytes:current(f),historical))
 const pkg='apps/sg-runtime/package.json'
 assert.throws(()=>assertPciSmartIntegrity(receipt(),f=>f===pkg?Buffer.from(current(f).toString().replace('tests/pci-smart-integrity.test.mjs','tests/unlisted.test.mjs')):current(f),historical))
})


test('Sentry receiving continuation rejects changed bytes, missing scope and rewritten earlier evidence',()=>{
 const r=receipt(),a=r.sentryObservabilityCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [
  r=>delete r.sentryObservabilityCompatibility.sourceDigests[r.sentryObservabilityCompatibility.changedSourcePaths[0]],
  r=>r.sentryObservabilityCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.sentryObservabilityCompatibility.changedSourcePaths.pop(),
  r=>r.sentryObservabilityCompatibility.previousReceiptSourceSha='0'.repeat(40),
  r=>r.sentryObservabilityCompatibility.previousReceiptSha256='0'.repeat(64),
  r=>r.sentryObservabilityCompatibility.authorizationChanged=true,
  r=>r.sentryObservabilityCompatibility.existingTelemetryChanged=true,
  r=>r.fullUiParityAdoption.publicUi.sourceDigest='0'.repeat(64),
  r=>r.unapprovedReceipt={}
 ]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})


test('market-history continuation rejects altered sources, unbound scope, rewritten history and inaccurate authority claims',()=>{
 const r=receipt(),a=r.marketHistoryIngestionCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [
  r=>delete r.marketHistoryIngestionCompatibility.sourceDigests[r.marketHistoryIngestionCompatibility.changedSourcePaths[0]],
  r=>r.marketHistoryIngestionCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.marketHistoryIngestionCompatibility.changedSourcePaths.pop(),
  r=>r.marketHistoryIngestionCompatibility.previousReceiptSourceSha='0'.repeat(40),
  r=>r.marketHistoryIngestionCompatibility.previousReceiptSha256='0'.repeat(64),
  r=>r.marketHistoryIngestionCompatibility.authorizationChanged=false,
  r=>r.marketHistoryIngestionCompatibility.liveInstallationPerformed=true,
  r=>r.marketHistoryIngestionCompatibility.deploymentPerformed=true,
  r=>r.marketHistoryIngestionCompatibility.unapprovedFlag=true,
  r=>r.sentryObservabilityCompatibility.existingTelemetryChanged=true,
  r=>r.unapprovedReceipt={}
 ]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})
test('market-history normal CI entry cannot be removed even with a matching replacement digest',()=>{
 for(const [file,remove] of [['apps/sg-runtime/package.json',' && npm run test:market-history'],['apps/sg-runtime/tests/pci-smart-integrity.test.mjs',"import './xray-style-isolation.test.ts'"]]){
  const r=receipt(),bytes=Buffer.from(current(file).toString().replace(remove,'')),a=r.marketHistoryIngestionCompatibility
  a.sourceDigests[file]=digestForTest(bytes);a.applicationSourceDigests[file.slice(16)]=digestForTest(bytes)
  assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?bytes:current(f),historical))
 }
})

test('product analytics binds only the exact amended sources and rejects changed payload gates or rewritten historical receipts',()=>{
 const r=receipt(),a=r.productAnalyticsCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [
  r=>delete r.productAnalyticsCompatibility.sourceDigests[r.productAnalyticsCompatibility.changedSourcePaths[0]],
  r=>r.productAnalyticsCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.productAnalyticsCompatibility.changedSourcePaths.pop(),
  r=>r.productAnalyticsCompatibility.previousReceiptSourceSha='0'.repeat(40),
  r=>r.productAnalyticsCompatibility.previousReceiptSha256='0'.repeat(64),
  r=>r.productAnalyticsCompatibility.authorizationChanged=true,
  r=>r.productAnalyticsCompatibility.existingTelemetryChanged=true,
  r=>r.productAnalyticsCompatibility.deploymentPerformed=true,
  r=>r.sentryObservabilityCompatibility.sourceDigests['apps/sg-runtime/package.json']='0'.repeat(64),
  r=>r.unapprovedReceipt={}
 ]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})

test('product analytics and accepted main preserve both histories and reject source, scope and runtime substitutions',()=>{
 const r=receipt(),a=r.productAnalyticsMainCompatibility;assert(a)
 assertPciSmartIntegrity(r,current,historical)
 for(const file of Object.keys(a.sourceDigests))assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [
  r=>delete r.productAnalyticsMainCompatibility.sourceDigests['apps/sg-runtime/tests/product-analytics-ui.test.tsx'],
  r=>r.productAnalyticsMainCompatibility.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  r=>r.productAnalyticsMainCompatibility.changedSourcePaths.pop(),
  r=>r.productAnalyticsMainCompatibility.previousReceiptSourceSha='0'.repeat(40),
  r=>r.productAnalyticsMainCompatibility.previousReceiptSha256='0'.repeat(64),
  r=>r.productAnalyticsMainCompatibility.analyticsReceiptSourceSha='0'.repeat(40),
  r=>r.productAnalyticsMainCompatibility.analyticsReceiptSha256='0'.repeat(64),
  r=>r.productAnalyticsMainCompatibility.sharedBaselineSourceSha='0'.repeat(40),
  r=>r.productAnalyticsMainCompatibility.testMetadataOnly=false,
  r=>r.productAnalyticsMainCompatibility.unapprovedField=true,
  r=>r.marketHistoryIngestionCompatibility.authorizationChanged=false,
  r=>r.productAnalyticsCompatibility.authorizationChanged=true,
  r=>r.sentryObservabilityCompatibility.existingTelemetryChanged=true,
  r=>r.unapprovedReceipt={},
  ...['analyticsRuntimeChanged','marketHistoryRuntimeChanged','authorizationChanged','schemaChanged','existingTelemetryChanged','srmRuntimeChanged','privatePinsChanged','ciPolicyChanged','newBusinessProviderCalls','deploymentPerformed','productDataChanged'].map(flag=>r=>r.productAnalyticsMainCompatibility[flag]=true),
 ]){const changed=structuredClone(r);mutate(changed);assert.throws(()=>assertPciSmartIntegrity(changed,current,historical))}
 for(const sha of [a.previousReceiptSourceSha,a.analyticsReceiptSourceSha])assert.throws(()=>assertPciSmartIntegrity(r,current,(s,file)=>s===sha&&file==='apps/sg-runtime/operation-integration.json'?Buffer.concat([historical(s,file),Buffer.from(' ')]):historical(s,file)))
 for(const entry of ['tests/product-analytics.test.ts','tests/product-analytics-ui.test.tsx','tests/pci-smart-integrity.test.mjs',' && npm run test:market-history']){
  const file='apps/sg-runtime/package.json',bytes=Buffer.from(current(file).toString().replace(entry,'')),changed=structuredClone(r),hash=digestForTest(bytes)
  changed.productAnalyticsMainCompatibility.sourceDigests[file]=hash;changed.productAnalyticsMainCompatibility.applicationSourceDigests['package.json']=hash
  assert.throws(()=>assertPciSmartIntegrity(changed,f=>f===file?bytes:current(f),historical),entry)
 }
})

test('X-Ray host presentation rejects modified current sources and false standalone guarantees',()=>{
 const r=receipt(),a=r.xrayAppShellPresentation;assert(a);assertPciSmartIntegrity(r,current,historical);
 for(const f of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===f?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical));
 for(const change of [x=>x.xrayAppShellPresentation.standaloneDefaultsUnchanged=false,x=>x.xrayAppShellPresentation.changedSourcePaths.pop(),x=>x.xrayAppShellPresentation.sourceDigests[a.changedSourcePaths[0]]='0'.repeat(64)]){const x=structuredClone(r);change(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})


test('four-card desk continuation rejects changed current bytes, omitted scope and rewritten accepted history',()=>{
 const r=receipt(),a=r.appShellFourCardCascade;assert(a);assertPciSmartIntegrity(r,current,historical)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 for(const mutate of [r=>r.appShellFourCardCascade.changedSourcePaths.pop(),r=>delete r.appShellFourCardCascade.sourceDigests[a.changedSourcePaths[0]],r=>r.appShellFourCardCascade.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),r=>r.appShellFourCardCascade.previousReceiptSha256='0'.repeat(64),r=>r.appShellFourCardCascade.design.revision='unapproved',r=>r.appShellFourCardCascade.authorizationChanged=true,r=>r.xrayAppShellPresentation.standaloneDefaultsUnchanged=false,r=>r.unapprovedReceipt={}]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})

test('D1 source preparation binds every amendment and preserves immutable accepted history',()=>{
 const r=receipt(),a=r.d1AuditReaderPreparation;assert(a)
 for(const file of a.changedSourcePaths)assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [r=>r.d1AuditReaderPreparation.previousReceiptSha256='0'.repeat(64),r=>r.d1AuditReaderPreparation.producerSourceSha='0'.repeat(40),r=>r.d1AuditReaderPreparation.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),r=>r.d1AuditReaderPreparation.changedSourcePaths.pop(),r=>r.d1AuditReaderPreparation.liveReaderInstalled=true,r=>r.appShellFourCardCascade.scope='rewritten-history']){
  const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))
 }
})

test('SDK1.33 compatibility accepts current bytes and rejects metadata, scope and predecessor tampering',()=>{
 const r=receipt(),a=r.sourceHubApiPathCompatibility;assert(a);assertPciSmartIntegrity(r,current,historical)
 for(const file of Object.keys(a.consumerSourceDigests))assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),file)
 for(const mutate of [r=>r.sourceHubApiPathCompatibility.apiPathOptedIn=true,r=>r.sourceHubApiPathCompatibility.previousReceiptSha256='0'.repeat(64),r=>r.sourceHubApiPathCompatibility.consumerSourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64)]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))}
})

test('paired SDK adoption rejects tampering with the current SRM continuation before exposing history',()=>{
 const r=receipt(),file='apps/srm/scripts/native-execution-adoption.test.mjs'
 assert.throws(()=>assertPciSmartIntegrity(r,f=>f===file?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical))
})


test('SDK1.34 market-symbol compatibility preserves history and rejects current scope, metadata and peer tampering',()=>{
 const r=receipt(),a=r.sourceHubMarketSymbolCompatibility;assert(a);assertPciSmartIntegrity(r,current,historical)
 const prior=JSON.parse(historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'))
 assert.deepEqual(r.sourceHubApiPathCompatibility,prior.sourceHubApiPathCompatibility,'the historical API_PATH adoption remains immutable')
 for(const file of [...Object.keys(a.consumerSourceDigests),...Object.keys(a.peerSourceDigests),...Object.keys(a.sourceDigests).map(p=>'packages/platform-contracts/'+p),...Object.keys(a.producerMetadataDigests)]){
  assert.throws(()=>assertPciSmartIntegrity(r,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical),file)
 }
 for(const mutate of [x=>x.sourceHubMarketSymbolCompatibility.marketSymbolOptedIn=true,x=>x.sourceHubMarketSymbolCompatibility.sql029Installed=true,x=>x.sourceHubMarketSymbolCompatibility.previousReceiptSha256='0'.repeat(64),x=>x.sourceHubMarketSymbolCompatibility.consumerSourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),x=>x.sourceHubApiPathCompatibility.apiPathOptedIn=true]){
  const x=structuredClone(r);mutate(x);assert.throws(()=>assertPciSmartIntegrity(x,current,historical))
 }
})
