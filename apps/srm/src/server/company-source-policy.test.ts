import test from 'node:test'
import assert from 'node:assert/strict'
import targets from '../../deployment/supplier-native-targets.json'
import {readCompanySourcePolicy,mgbiCompanyCache} from './company-source-policy'
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
    const bytes=next?.applicationSourceDigests[file]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):latest?.applicationSourceDigests[file]?execFileSync('git',['show',latest.previousReceiptSourceSha+':apps/srm/'+file]):readFileSync(new URL('../../'+file,import.meta.url))
    assert.equal(hash(bytes),digest,file)
  }
  assert.equal(a.companySourcePolicy,'MGBI_ONLY');assert.equal(a.sharedSdkChanged,false);assert.equal(a.humanEntitlementsChanged,false)
  assert.equal(a.historicalCountersReset,false);assert.equal(a.paidExternalPoliciesChanged,false)
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
