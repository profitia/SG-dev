import assert from 'node:assert/strict'
import test from 'node:test'
import { createModuleScopeGuard, MODULE_SCOPE_CONTRACT, moduleSchemaDigest, moduleScopeSourceDigest } from '../src/module-scope.mjs'
import { isOperationDenied } from '../src/operation-context.mjs'
const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const config={applicationId:'approved-host',environment:'development',moduleId:'benchmark',schemaDigest:'a'.repeat(64),now:()=>0}
const row=()=>({module:{applicationId:config.applicationId,environment:'development',moduleId:'benchmark',moduleContractId:MODULE_SCOPE_CONTRACT.id,moduleContractVersion:'1.0.0',moduleSchemaDigest:config.schemaDigest,organisationId:org,userId:user,moduleBindingId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',moduleBindingVersion:'1',moduleSourceRef:'SYNTHETIC',expiresAt:'2030-01-01T00:00:00Z',transactionId:'42'},transaction_id:'42'})
const denied=error=>isOperationDenied(error)&&error.reasonCode==='POLICY_UNAVAILABLE'
test('module scope requires a known module and explicit application/schema binding',()=>{
  for(const change of [{applicationId:''},{environment:'reserved'},{moduleId:'arbitrary'},{schemaDigest:'unknown'}])assert.throws(()=>createModuleScopeGuard({...config,...change}),TypeError)
})
test('binding accepts authoritative transaction evidence and returns immutable metadata',async()=>{
  const guard=createModuleScopeGuard(config)
  const evidence=await guard.bind(async(sql,values)=>{assert.match(sql,/bind_scope/);assert.deepEqual(values,['benchmark']);return{rows:[row()]}},{organisationId:org,userId:user})
  assert(Object.isFrozen(guard));assert(Object.isFrozen(evidence));assert.equal(evidence.transactionId,'42')
})
test('absent module or product binding is an explicit feature denial',async()=>{
  await assert.rejects(createModuleScopeGuard(config).bind(async()=>({rows:[{module:null,transaction_id:'42'}]}),{organisationId:org,userId:user}),error=>isOperationDenied(error)&&error.reasonCode==='APPLICATION_FEATURE_UNAVAILABLE')
})
for(const [name,change] of Object.entries({application:{applicationId:'foreign'},environment:{environment:'staging'},schema:{moduleSchemaDigest:'b'.repeat(64)},version:{moduleContractVersion:'unknown'},module:{moduleId:'supplier_report'},organisation:{organisationId:'22222222-2222-4222-8222-222222222222'},user:{userId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},transaction:{transactionId:'99'},expiry:{expiresAt:'1970-01-01T00:00:00Z'},binding:{moduleBindingId:'unknown'}})){
  test(`module scope rejects mismatched ${name}`,async()=>{
    const r=row();Object.assign(r.module,change)
    await assert.rejects(createModuleScopeGuard(config).bind(async()=>({rows:[r]}),{organisationId:org,userId:user}),denied)
  })
}
test('missing rows and query failures fail closed',async()=>{
  for(const query of [async()=>({rows:[]}),async()=>({rows:[row(),row()]}),async()=>{throw Error('Synthetic unavailable database')}])await assert.rejects(createModuleScopeGuard(config).bind(query,{organisationId:org,userId:user}),denied)
})
test('schema and implementation have separate acceptance fingerprints',async()=>{
  assert.match(await moduleSchemaDigest(),/^[a-f0-9]{64}$/);assert.match(await moduleScopeSourceDigest(),/^[a-f0-9]{64}$/)
  assert.notEqual(await moduleSchemaDigest(),await moduleScopeSourceDigest())
})
