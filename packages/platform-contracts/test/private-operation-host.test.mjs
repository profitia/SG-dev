import assert from 'node:assert/strict'
import test from 'node:test'
import { createPrivateOperationHost, PRIVATE_OPERATION_HOST_CONTRACT, privateOperationHostSourceDigest } from '../src/private-operation-host.mjs'
import { operationSourceDigest } from '../src/operation-context.mjs'
import { identitySourceDigest } from '../src/identity-provider.mjs'
import { accessStoreSourceDigest, accessSchemaDigest } from '../src/access-store.mjs'

function options() {
  const application = { appId:'sg2-test',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated',configurationVersion:'1',identityIssuer:'https://identity.fixture.test',organisationId:null,features:['benchmark'],operations:['benchmark.selection.read'] }
  const binding = { applicationId:'sg2-test',environment:'development',projectId:'isolated-project',branchId:'isolated-branch',databaseName:'platform_access_test',role:'platform_access_sg2_test',schemaDigest:'a'.repeat(64) }
  const unexpected = async () => assert.fail('Constructor must not perform an external operation')
  return { application,binding,independentQuery:unexpected,transact:unexpected,createAuthenticator:unexpected,readResources:unexpected,projectOutput:unexpected }
}
test('the versioned host pins the additive candidate and preserves the base SQL',async()=>{
  const host=createPrivateOperationHost(options())
  assert.equal(Object.isFrozen(host),true)
  assert.equal(host.hostContract,PRIVATE_OPERATION_HOST_CONTRACT)
  assert.equal(host.contract.implementation,'1.0.0-candidate.14')
  assert.equal(host.hostContract.version,'1.11.0')
  assert.match(await privateOperationHostSourceDigest(),/^[a-f0-9]{64}$/)
  assert.equal(await operationSourceDigest(),'8f87ac5c4411a22070960452b14927cdc42d01a1d7ffef1afd7a44cc52de964e')
  assert.equal(await identitySourceDigest(),'9e1ced6498e8a127dd17fee81c5f4485a032c133bf85c08a72488e7909a0a299')
  assert.equal(await accessStoreSourceDigest(),'fc588b2575bc6346f465faa20a7b21e8585068ed8d56db9cadd3ebca9e980f10')
  assert.equal(await accessSchemaDigest(),'356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
})
for(const module of [null,false,{},[],{id:'benchmark',schemaDigest:'a'.repeat(64)},{id:'unknown',schemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64)},{id:'benchmark',schemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64),extra:'untrusted'}]){
  test(`an explicit incomplete module boundary cannot silently disable protection ${JSON.stringify(module)}`,()=>{
    assert.throws(()=>createPrivateOperationHost({...options(),module}),TypeError)
  })
}
for (const name of ['independentQuery','transact','createAuthenticator','readResources','projectOutput','now']) {
  test(`host requires server-owned ${name}`,()=>assert.throws(()=>createPrivateOperationHost({...options(),[name]:null}),TypeError))
}
for (const limit of [null,0,99,15001,Infinity,100.5,'1000']) {
  test(`invalid transaction timeout ${limit} is rejected`,()=>assert.throws(()=>createPrivateOperationHost({...options(),transactionTimeoutMs:limit}),TypeError))
}
test('host rejects another application or environment before any database access',()=>{
  for(const change of [{applicationId:'srm-test'},{environment:'staging'}]) {
    const o=options();o.binding={...o.binding,...change}
    assert.throws(()=>createPrivateOperationHost(o),TypeError)
  }
})
test('unsupported policy configuration is rejected at construction',()=>{
  const o=options();o.application.operations=['billing.webhook.apply']
  assert.throws(()=>createPrivateOperationHost(o),TypeError)
})
for (const name of ['prepareInputs','describeOutcome']) {
  for (const value of [null, false, {}, 'client callback']) {
    test(`host rejects malformed optional ${name}: ${JSON.stringify(value)}`, () => {
      assert.throws(() => createPrivateOperationHost({ ...options(), [name]: value }), TypeError)
    })
  }
}
test('export cannot be enabled without a server-owned preparation adapter', () => {
  const o = options()
  o.application.features = ['supplier_report']
  o.application.operations = ['supplier.report.read', 'supplier.report.project', 'supplier.report.export']
  assert.throws(() => createPrivateOperationHost(o), TypeError)
  assert.equal(createPrivateOperationHost({ ...o, prepareInputs: async () => {} }).hostContract.version, '1.11.0')
})

for(const continuation of [null,{}, {requestId:'forged',phaseId:'REGISTER_LOOKUP',inputDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64)}])test('non-request hosts cannot borrow private continuation authority '+JSON.stringify(continuation),()=>{assert.throws(()=>createPrivateOperationHost({...options(),requestContinuation:continuation}),TypeError)})
