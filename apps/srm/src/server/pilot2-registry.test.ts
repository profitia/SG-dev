import test from 'node:test'
import assert from 'node:assert/strict'
import {pilot2RegistryConnection,readyPilot2RegistryReport,withPilot2RegistrySelection,withPilot2ReadyReport,requirePilot2FinancialAcquisition} from './pilot2-registry'
import {FINANCIAL_QUALITY_RULE} from '@profitia/srm-xray'
import {FINANCIAL_REVISION_RULE} from './financial-revisions'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'
const nip='7820021192',krs='0000046073',oldKrs='0000000123'
const ref='KRS:'+krs+':'+ 'a'.repeat(64)
const report=()=>({general:{status:'SUCCESS',source:{provider:'KRS',recordId:ref},data:{nip,krs,registrySource:{provider:'KRS',evidenceRef:ref},registryHistory:{version:'KRS_CONTINUITY_V1',currentKrs:krs,members:[{krs},{krs:oldKrs}],unlinkedKrs:[]}}},financial:{status:'SUCCESS',source:{provider:'MGBI'},warnings:[] as string[],data:{revisionRule:FINANCIAL_REVISION_RULE,qualityRule:FINANCIAL_QUALITY_RULE,registryHistoryVersion:COMPANY_IDENTITY_VERSION,periods:[{sourceRegistration:{krs}},{sourceRegistration:{krs:oldKrs}}]}}})
test('accepted cached report requires the selected NIP, source evidence and verified issuer chain',()=>{
 const value=report();assert.equal(readyPilot2RegistryReport(value as never,nip),true)
 const before=JSON.stringify(value);readyPilot2RegistryReport(value as never,nip);assert.equal(JSON.stringify(value),before)
 for(const mutate of [
  (v:ReturnType<typeof report>)=>{v.general.data.nip='5272443955'},
  (v:ReturnType<typeof report>)=>{v.general.source.recordId='other'},
  (v:ReturnType<typeof report>)=>{v.general.data.registryHistory.unlinkedKrs=['0000000999'] as never},
  (v:ReturnType<typeof report>)=>{v.financial.data.periods[1].sourceRegistration.krs='0000000999'},
  (v:ReturnType<typeof report>)=>{v.financial.status='ERROR'},
  (v:ReturnType<typeof report>)=>{v.financial.warnings=['MSR_PROCESSING_PENDING']},
 ]){const changed=report();mutate(changed);assert.equal(readyPilot2RegistryReport(changed as never,nip),false)}
})
test('a cached report cannot initiate a new paid effect; ready scope does not leak into another request',async()=>{
 await assert.rejects(withPilot2ReadyReport(async()=>{requirePilot2FinancialAcquisition()}),/Fresh company evidence required/)
 await Promise.all([withPilot2ReadyReport(async()=>{await Promise.resolve();assert.throws(()=>requirePilot2FinancialAcquisition())}),Promise.resolve().then(()=>assert.doesNotThrow(()=>requirePilot2FinancialAcquisition()))])
 assert.doesNotThrow(()=>requirePilot2FinancialAcquisition())
})
test('cached company knowledge cannot be submitted as a fresh acquisition identity',()=>{
 let executed=false
 assert.throws(()=>withPilot2RegistrySelection({general:report().general,identity:{},history:report().general.data.registryHistory} as never,async()=>{executed=true}))
 assert.equal(executed,false)
})
test('Source connection refuses Staging, other roles, databases and weaker TLS',()=>{
 const url='postgresql://krs_ingest:fixture@ep-fragrant-cloud-b1y6i4v8.c-5.eu-central-1.aws.neon.tech/krs_registry_pilot?sslmode=require'
 assert.equal(pilot2RegistryConnection(url,'krs_ingest').ssl.rejectUnauthorized,true)
 for(const value of [url.replace('krs_ingest:','neondb_owner:'),url.replace('/krs_registry_pilot?','/srm_app?'),url.replace('sslmode=require','sslmode=disable'),url+'&options=role%3Downer',url.replace('ep-fragrant-cloud-b1y6i4v8','ep-autumn-wildflower-b1mv0vda')])assert.throws(()=>pilot2RegistryConnection(value,'krs_ingest'))
})
