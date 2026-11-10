import test from 'node:test'
import assert from 'node:assert/strict'
import {projectXrayAssistantContext} from '../components/appshell/assistant-screen-context'
import {readContextReference} from '../../../packages/assistant-context-contracts/src/index.mjs'
const rich=()=>({schemaVersion:1,application:'SRM',dashboardInstanceId:'browser-only',source:{kind:'financial-data-module',version:'a'.repeat(64),capturedOn:'2026-11-09',statementScope:'consolidated'},
 supplier:{id:'browser-only-id',name:'Same displayed name',nip:'8650004194',krs:'0000000001',entityType:'COMPANY'},
 view:{page:'supplier-intelligence-dashboard',radar:{year:2025,comparisonYear:2023}},
 financialSummary:[{value:'PRIVATE_BROWSER_FINANCIAL',unit:'PLN'}],credentials:'NEVER_FORWARD',allow:true})
test('rich X-Ray projection retains only a typed supplier/year/scope reference and the existing label',()=>{
 const projected=projectXrayAssistantContext(rich())
 assert.equal(projected?.supplierName,'Same displayed name');assert.equal(projected?.year,2025)
 assert.deepEqual(projected?.reference,{version:'2.0.0',source:'SRM_XRAY',nip:'8650004194',entityType:'COMPANY',krs:'0000000001',
  year:2025,comparisonYear:2023,statementScope:'consolidated',sourceVersion:'a'.repeat(64)})
 const text=JSON.stringify(projected)
 for(const value of ['PRIVATE_BROWSER_FINANCIAL','NEVER_FORWARD','credentials','financialSummary','browser-only-id','capturedOn','allow'])assert(!text.includes(value))
})
test('same-name supplier changes, years and statement scopes have distinct source references',()=>{
 const a=rich(),b=rich();b.supplier.nip='5250001009'
 assert.notDeepEqual(projectXrayAssistantContext(a)?.reference,projectXrayAssistantContext(b)?.reference)
 b.supplier.nip=a.supplier.nip;b.view.radar.year=2024
 assert.notDeepEqual(projectXrayAssistantContext(a)?.reference,projectXrayAssistantContext(b)?.reference)
 b.view.radar.year=2025;b.source.statementScope='standalone'
 assert.notDeepEqual(projectXrayAssistantContext(a)?.reference,projectXrayAssistantContext(b)?.reference)
})
test('JDG remains JDG; unknown legacy entity type cannot silently become a company',()=>{
 const v=rich();v.supplier.entityType='JDG';v.supplier.krs=null as any
 assert.equal(projectXrayAssistantContext(v)?.reference?.entityType,'JDG')
 delete(v.supplier as any).entityType
 assert.equal(projectXrayAssistantContext(v)?.reference,undefined)
 v.supplier.krs='0000000001'
 assert.equal(projectXrayAssistantContext(v)?.reference?.entityType,'COMPANY')
})
test('invalid source identity cannot become a data reference or carry browser authority',()=>{
 const v=rich();v.supplier.nip='same name instead of identifier'
 assert.equal(projectXrayAssistantContext(v)?.reference,undefined)
 assert.throws(()=>readContextReference({...projectXrayAssistantContext(rich())!.reference,allow:true}))
})
