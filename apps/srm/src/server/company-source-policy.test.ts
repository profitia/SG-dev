import test from 'node:test'
import assert from 'node:assert/strict'
import targets from '../../deployment/supplier-native-targets.json'
import {readCompanySourcePolicy,mgbiCompanyCache,isKnownMgbiCompany,isEmptyMgbiCompany} from './company-source-policy'
import {mapMgbiGeneralRecords} from './mgbi-general'
import {emptyCard} from '../demo/fixture'
import {IdentityConfigurationUnavailable} from './identity-runtime'
import type {SharedCompany} from './shared-catalog'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../operation-integration.json'

test('MGBI recovery preserves the full prior acceptance and pins every current consumer change',()=>{
  const a=receipt.mgbiDevelopmentRecoveryAdoption
  const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
  const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
  assert.equal(hash(previous),a.previousReceiptDigest)
  for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
  for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
    const next:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.mgbiDevelopmentSessionFreshnessRepair.applicationSourceDigests[file as keyof typeof receipt.mgbiDevelopmentSessionFreshnessRepair.applicationSourceDigests]?receipt.mgbiDevelopmentSessionFreshnessRepair:receipt.supplierMapStartupRepair
    const latest:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapGeocodingActivation
    const routing=receipt.stagingCompanyRoutingAdoption
    const repair=receipt.companyAbsenceRoutingRepair
    const bytes=next?.applicationSourceDigests[file]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):latest?.applicationSourceDigests[file]?execFileSync('git',['show',latest.previousReceiptSourceSha+':apps/srm/'+file]):routing.applicationSourceDigests[file as keyof typeof routing.applicationSourceDigests]?execFileSync('git',['show',routing.previousReceiptSourceSha+':apps/srm/'+file]):repair.applicationSourceDigests[file as keyof typeof repair.applicationSourceDigests]?execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/'+file]):receipt.cachedReportE1Optimization.applicationSourceDigests[file as keyof typeof receipt.cachedReportE1Optimization.applicationSourceDigests]?execFileSync('git',['show',receipt.cachedReportE1Optimization.previousReceiptSourceSha+':apps/srm/'+file]):receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests[file as keyof typeof receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests]?execFileSync('git',['show',receipt.readyCompanyMetadataCredentialReuse.previousReceiptSourceSha+':apps/srm/'+file]):receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file as keyof typeof receipt.xrayPerformanceRecoveryV2.applicationSourceDigests]?execFileSync('git',['show',receipt.xrayPerformanceRecoveryV2.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.appshellXraySourceCompatibility.applicationSourceDigests,file)?execFileSync('git',['show',receipt.appshellXraySourceCompatibility.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.freshInventoryReuseRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.freshInventoryReuseRecovery.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.supplierLocationCacheAdoption.applicationSourceDigests,file)?execFileSync('git',['show',receipt.supplierLocationCacheAdoption.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.runtimePreparationRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.runtimePreparationRecovery.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url))
    assert.equal(hash(bytes),digest,file)
  }
  assert.equal(a.companySourcePolicy,'MGBI_ONLY');assert.equal(a.sharedSdkChanged,false);assert.equal(a.humanEntitlementsChanged,false)
  assert.equal(a.historicalCountersReset,false);assert.equal(a.paidExternalPoliciesChanged,false)
})

test('routing adoption preserves accepted contracts and pins the bounded current consumer change',()=>{
  const a=receipt.stagingCompanyRoutingAdoption,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
  const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
  assert.equal(hash(previous),a.previousReceiptDigest)
  for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
  for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
    const repair=receipt.companyAbsenceRoutingRepair
    const bytes=repair.applicationSourceDigests[file as keyof typeof repair.applicationSourceDigests]?execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/'+file]):receipt.cachedReportE1Optimization.applicationSourceDigests[file as keyof typeof receipt.cachedReportE1Optimization.applicationSourceDigests]?execFileSync('git',['show',receipt.cachedReportE1Optimization.previousReceiptSourceSha+':apps/srm/'+file]):receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests[file as keyof typeof receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests]?execFileSync('git',['show',receipt.readyCompanyMetadataCredentialReuse.previousReceiptSourceSha+':apps/srm/'+file]):receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file as keyof typeof receipt.xrayPerformanceRecoveryV2.applicationSourceDigests]?execFileSync('git',['show',receipt.xrayPerformanceRecoveryV2.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.appshellXraySourceCompatibility.applicationSourceDigests,file)?execFileSync('git',['show',receipt.appshellXraySourceCompatibility.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.freshInventoryReuseRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.freshInventoryReuseRecovery.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.supplierLocationCacheAdoption.applicationSourceDigests,file)?execFileSync('git',['show',receipt.supplierLocationCacheAdoption.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.runtimePreparationRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.runtimePreparationRecovery.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url))
    assert.equal(hash(bytes),digest,file)
  }
  for(const key of ['freshnessRulesChanged','humanAuthorityChanged','sharedSdkChanged','financialWorkflowChanged','providerLimitsChanged','sqlOrInfrastructureChanged','uiChatMapsChanged'])assert.equal(a[key as keyof typeof a],false,key)
})

test('main Development selects MGBI without a new environment flag and refuses every alternate company activation',()=>{
  const main={RENDER_SERVICE_ID:targets.serviceId}
  assert.equal(readCompanySourcePolicy(main),'MGBI_ONLY')
  for(const key of ['SRM_KRS_NIP_ENABLED','SRM_KRS_NAME_SEARCH_ENABLED','SRM_DEVELOPMENT_PILOT2_LOOKUP']){
    assert.equal(readCompanySourcePolicy({...main,[key]:'false'}),'MGBI_ONLY')
    for(const value of ['true','1','TRUE',''])assert.throws(()=>readCompanySourcePolicy({...main,[key]:value}),IdentityConfigurationUnavailable)
  }
  for(const provider of ['GUS','KRS','MGBI',''])assert.throws(()=>readCompanySourcePolicy({...main,SRM_PILOT2_REGISTRY_PROVIDER:provider}),IdentityConfigurationUnavailable)
})
test('independent pilot and Staging configurations are outside the main Development policy',()=>{
  for(const service of ['srv-dbeh6srrjlhs73fmikrg','srv-dbd5hlcipgvc73d98ukg','srv-db496b3tqb8s73eh5sfg',undefined])
    assert.equal(readCompanySourcePolicy({RENDER_SERVICE_ID:service,SRM_KRS_NIP_ENABLED:'true',SRM_PILOT2_REGISTRY_PROVIDER:'GUS'}),undefined)
})
test('fresh acquisition reuses MGBI evidence only and never relabels or edits historical KRS provenance',()=>{
  const value={general:{source:{provider:'MGBI'}},financial:{source:{provider:'MGBI'}}} as SharedCompany
  assert.equal(mgbiCompanyCache(value),value)
  for(const section of ['general','financial'] as const){
    const historical=structuredClone(value);historical[section].source.provider='KRS' as never
    const before=JSON.stringify(historical)
    assert.equal(mgbiCompanyCache(historical),null);assert.equal(JSON.stringify(historical),before)
  }
  assert.equal(mgbiCompanyCache(null),null)
})

test('routing requires a complete exact MGBI company after the existing freshness read',()=>{
  const nip='9511855233',krs='0000007163'
  const general=mapMgbiGeneralRecords([{id:'a'.repeat(24),identifiers:{pl_nip:nip,pl_krs:krs},
    content:{current_excerpt:{naglowekA:{},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic Known Company',formaPrawna:'SA'}}}}}}],
    {type:'NIP',value:nip},new Date().toISOString()).section
  const value:SharedCompany={general,financial:structuredClone(emptyCard.financial)}
  assert.equal(isKnownMgbiCompany(value,nip),true)
  assert.equal(isKnownMgbiCompany(null,nip),false)
  assert.equal(isKnownMgbiCompany(value,'5272443955'),false)
  for(const change of [
    (v:SharedCompany)=>{v.general.source.provider='KRS'},
    (v:SharedCompany)=>{v.general.status='ERROR'},
    (v:SharedCompany)=>{v.general.data!.krs=null},
    (v:SharedCompany)=>{v.general.data!.legalName=' '},
    (v:SharedCompany)=>{v.general.data!.registryHistory=undefined},
    (v:SharedCompany)=>{v.general.data!.registryHistory!.currentKrs='0000000001'},
    (v:SharedCompany)=>{v.general.data!.registryHistory!.members=[]},
  ]){const invalid=structuredClone(value);change(invalid);assert.equal(isKnownMgbiCompany(invalid,nip),false)}
})


test('company absence repair retains all earlier receipts and pins current bounded adapters',()=>{
  const a=receipt.companyAbsenceRoutingRepair,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
  const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
  assert.equal(hash(prior),a.previousReceiptDigest)
  for(const[key,value]of Object.entries(JSON.parse(prior.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
  for(const[file,digest]of Object.entries(a.applicationSourceDigests)){const next=receipt.cachedReportE1Optimization;const bytes=next.applicationSourceDigests[file as keyof typeof next.applicationSourceDigests]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests[file as keyof typeof receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests]?execFileSync('git',['show',receipt.readyCompanyMetadataCredentialReuse.previousReceiptSourceSha+':apps/srm/'+file]):receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file as keyof typeof receipt.xrayPerformanceRecoveryV2.applicationSourceDigests]?execFileSync('git',['show',receipt.xrayPerformanceRecoveryV2.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.appshellXraySourceCompatibility.applicationSourceDigests,file)?execFileSync('git',['show',receipt.appshellXraySourceCompatibility.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.freshInventoryReuseRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.freshInventoryReuseRecovery.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.supplierLocationCacheAdoption.applicationSourceDigests,file)?execFileSync('git',['show',receipt.supplierLocationCacheAdoption.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.runtimePreparationRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.runtimePreparationRecovery.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url));assert.equal(hash(bytes),digest,file)}
  assert.equal(a.positiveSourceContractChanged,false);assert.equal(a.authorityOrProviderLimitsChanged,false)
})

test('neutral absence requires exact MGBI EMPTY evidence, never errors or an incomplete identity',()=>{
  const at='2026-10-28T10:00:00.000Z'
  const value:SharedCompany={
    general:{...structuredClone(emptyCard.general),status:'EMPTY',retrievedAt:at,warnings:['MGBI_NO_RECORD'],source:{provider:'MGBI',model:'pl-krs-wp-record',recordId:null}},
    financial:{...structuredClone(emptyCard.financial),status:'EMPTY',retrievedAt:at,warnings:['MGBI_NO_STRUCTURED_FINANCIAL_DATA'],source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:null}},
  }
  assert.equal(isEmptyMgbiCompany(value.general,value.financial),true)
  for(const section of ['general','financial'] as const)for(const mutate of [
    (v:SharedCompany)=>{v[section].status='ERROR'},
    (v:SharedCompany)=>{v[section].status='NOT_REQUESTED'},
    (v:SharedCompany)=>{v[section].source.provider='KRS' as never},
    (v:SharedCompany)=>{v[section].source.model='different-model'},
    (v:SharedCompany)=>{v[section].source.recordId='a'.repeat(24)},
    (v:SharedCompany)=>{v[section].retrievedAt=null},
    (v:SharedCompany)=>{v[section].retrievedAt='2026-02-31T10:00:00Z'},
    (v:SharedCompany)=>{v[section].warnings=['MGBI_MAPPING_FAILED']},
    (v:SharedCompany)=>{v[section].effectiveAt='2026-01-01'},
  ]){const invalid=structuredClone(value);mutate(invalid);assert.equal(isEmptyMgbiCompany(invalid.general,invalid.financial),false)}
})


test('cached main report optimization preserves all prior acceptances and current account and publication checks',()=>{
 const a=receipt.cachedReportE1Optimization,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){const next=receipt.readyCompanyMetadataCredentialReuse;const bytes=next.applicationSourceDigests[file as keyof typeof next.applicationSourceDigests]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file as keyof typeof receipt.xrayPerformanceRecoveryV2.applicationSourceDigests]?execFileSync('git',['show',receipt.xrayPerformanceRecoveryV2.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.appshellXraySourceCompatibility.applicationSourceDigests,file)?execFileSync('git',['show',receipt.appshellXraySourceCompatibility.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.freshInventoryReuseRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.freshInventoryReuseRecovery.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.supplierLocationCacheAdoption.applicationSourceDigests,file)?execFileSync('git',['show',receipt.supplierLocationCacheAdoption.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.runtimePreparationRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.runtimePreparationRecovery.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url));assert.equal(hash(bytes),digest,file)}
 assert.equal(a.transactionTimeoutMs,15000);assert.equal(a.externalAccountRecheckedBeforeOutcome,true);assert.equal(a.finalHumanReadRetained,true)
 for(const key of ['authorizationCacheIntroduced','sharedSdkChanged','sqlOrInfrastructureChanged','providerAcquisitionOrLimitsChanged','routingChanged','financialFormulasChanged','uiChatMapsChanged','freshAndPilotPathChanged'])assert.equal(a[key as keyof typeof a],false,key)
})


test('ready company metadata credential hint preserves every prior receipt and every current server authority gate',()=>{
 const a=receipt.readyCompanyMetadataCredentialReuse,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file as keyof typeof receipt.xrayPerformanceRecoveryV2.applicationSourceDigests]?execFileSync('git',['show',receipt.xrayPerformanceRecoveryV2.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.appshellXraySourceCompatibility.applicationSourceDigests,file)?execFileSync('git',['show',receipt.appshellXraySourceCompatibility.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.freshInventoryReuseRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.freshInventoryReuseRecovery.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.supplierLocationCacheAdoption.applicationSourceDigests,file)?execFileSync('git',['show',receipt.supplierLocationCacheAdoption.previousReceiptSourceSha+':apps/srm/'+file]):Object.hasOwn(receipt.runtimePreparationRecovery.applicationSourceDigests,file)?execFileSync('git',['show',receipt.runtimePreparationRecovery.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url))),digest,file)
 assert.equal(a.dataHintLifetimeMs,15000);assert.equal(a.minimumBearerHeadroomMs,30000)
 for(const key of ['expiryHintIsAuthority','serverAuthorityChecksChanged','authorizationDecisionCacheIntroduced','credentialPersistedByApplication','searchCredentialRefreshChanged','providerAcquisitionChanged','tokenLifetimeChanged','providerRetriesAdded','uiChatMapsChanged'])assert.equal(a[key as keyof typeof a],false,key)
})
