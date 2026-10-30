import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccessStore, DATABASE_SERVICE_ISSUER, serviceReadSchemaDigest } from '../src/access-store.mjs'
import { createPrivateOperationHost, createServiceReadHost } from '../src/private-operation-host.mjs'

function options() {
  const application={appId:'service-test',profileId:'SPENDGURU_SAAS',environment:'development',
    deploymentId:'isolated',configurationVersion:'v1',identityIssuer:DATABASE_SERVICE_ISSUER,
    organisationId:null,features:['forecast'],operations:['forecast.read']}
  const binding={applicationId:application.appId,environment:'development',projectId:'isolated-project',
    branchId:'isolated-branch',databaseName:'platform_service_read_test',role:'service_test_runtime',
    schemaDigest:'a'.repeat(64),service:{schemaDigest:'b'.repeat(64),profileId:application.profileId,
      deploymentId:application.deploymentId,configurationVersion:application.configurationVersion}}
  const unexpected=async()=>assert.fail('Constructor must not perform SQL or network operations')
  return{application,binding,independentQuery:unexpected,transact:unexpected,readResources:unexpected,projectOutput:unexpected}
}
test('service host composes the same operation contract and requires no HTTP identity adapter',async()=>{
  const host=createServiceReadHost(options())
  assert.equal(host.contract.implementation,'1.0.0-candidate.16')
  assert.equal(host.hostContract.version,'1.11.0');assert(Object.isFrozen(host))
  assert.equal(await serviceReadSchemaDigest(),'f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49')
})
for(const operation of ['benchmark.selection.read','category.write','knowledge.ingest','job.execute','supplier.report.refresh','account.settings.read','personal.list.read']){
  test(`read-only service host refuses ${operation} at construction`,()=>{
    const o=options();o.application.operations=[operation];assert.throws(()=>createServiceReadHost(o),TypeError)
  })
}
for(const name of ['createAuthenticator','module','prepareInputs'])test(`service host refuses a second ${name} authority`,()=>{
  assert.throws(()=>createServiceReadHost({...options(),[name]:undefined}),TypeError)
})
for(const key of ['schemaDigest','profileId','deploymentId','configurationVersion'])test(`service binding requires exact ${key}`,()=>{
  const o=options();delete o.binding.service[key];assert.throws(()=>createServiceReadHost(o),TypeError)
})
test('service and human host bindings cannot be interchanged',async()=>{
  const o=options();assert.throws(()=>createPrivateOperationHost({...o,createAuthenticator:async()=>null}),TypeError)
  delete o.binding.service;assert.throws(()=>createServiceReadHost(o),TypeError)
  await assert.rejects(createAccessStore({binding:o.binding}).resolveServiceActor(o.independentQuery),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})
test('database identity cannot use a customer identity issuer or unmatched deployment',()=>{
  const o=options();o.application.identityIssuer='https://customer-identity.invalid';assert.throws(()=>createServiceReadHost(o),TypeError)
  o.application.identityIssuer=DATABASE_SERVICE_ISSUER;o.application.deploymentId='another';assert.throws(()=>createServiceReadHost(o),TypeError)
})
test('even an explicit service binding cannot invoke the human identity/store path',async()=>{
  const o=options(),store=createAccessStore({binding:o.binding})
  await assert.rejects(store.resolveBinding(o.independentQuery,{environment:'development',issuer:'https://fixture.invalid',subject:'forged'}),e=>e.reasonCode==='POLICY_UNAVAILABLE')
  await assert.rejects(store.lockAccess(o.independentQuery,{actor:{},identityBinding:null,organisationId:null}),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})

test('service reads cannot accept private request continuation authority',()=>{const o=options();assert.throws(()=>createServiceReadHost({...o,requestContinuation:{requestId:'11111111-1111-4111-8111-111111111111',phaseId:'REGISTER_LOOKUP',inputDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64)}}),TypeError)})

test('service proof clock lead is conservatively clamped by same-statement database time',async()=>{
 const o=options(),time=Date.now(),clock=()=>time
 const query=async()=>({rows:[{database_name:o.binding.databaseName,role:o.binding.role,login:o.binding.role,
  rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,
  descriptor:{schemaVersion:'1.0.0',schemaDigest:o.binding.schemaDigest,applicationId:o.binding.applicationId,environment:o.binding.environment,projectId:o.binding.projectId,branchId:o.binding.branchId,databaseName:o.binding.databaseName,role:o.binding.role},
  descriptor_observed_ms:String(time+1),service_descriptor:{schemaVersion:'1.0.0',schemaDigest:o.binding.service.schemaDigest,profileId:o.binding.service.profileId,deploymentId:o.binding.service.deploymentId,configurationVersion:o.binding.service.configurationVersion,
   serviceId:'11111111-1111-4111-8111-111111111111',proofRef:'database-service:11111111-1111-4111-8111-111111111111:1',sourceRef:'SYNTHETIC_ONLY',expiresAt:new Date(time+30001).toISOString()}}]})
 const actor=await createAccessStore({binding:o.binding,now:clock}).resolveServiceActor(query)
 assert.equal(Date.parse(actor.expiresAt),time+30000)
 const invalid=async()=>{const r=await query();r.rows[0].descriptor_observed_ms=null;return r}
 await assert.rejects(createAccessStore({binding:o.binding,now:clock}).resolveServiceActor(invalid),e=>e.reasonCode==='POLICY_UNAVAILABLE')
})
