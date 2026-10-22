import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,REGISTRY_READ_OPERATIONS,registryReadResource,registryReadSelection} from '../src/operation-context.mjs'
import {createTestIdentityIssuer} from '../../../apps/architecture-lab/src/operation-test-authority.mjs'
const time=Date.parse('2026-10-22T15:00:00Z'),expiresAt=new Date(time+60000).toISOString(),ref='KRS:0000000001:'+ 'a'.repeat(64)
function fixture(operation='supplier.registry.search'){
  const issuer=createTestIdentityIssuer({applicationId:'registry-test',now:()=>time})
  const payload=operation==='supplier.registry.search'?{query:'Private query phrase',limit:10,cursor:null}:{selectedKrs:'0000000001'}
  const application={appId:'registry-test',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',deploymentId:'synthetic',configurationVersion:'v1',environment:'development',identityIssuer:issuer.issuer,organisationId:null,operations:[...REGISTRY_READ_OPERATIONS],features:['supplier_report']}
  const state={policyVersion:'synthetic-policy',applicationId:application.appId,environment:'development',usagePolicy:'NOT_APPLICABLE',
    access:{type:'MEMBERSHIP',actorId:'user-a',organisationId:'org-a',status:'ACTIVE',version:'1',sourceRef:'synthetic-membership',expiresAt,permissions:[{operation,feature:'supplier_report',resourceId:null}],denies:[]},
    resource:registryReadResource(operation,payload,{environment:'development',generation:'1',snapshotRef:operation==='supplier.registry.search'?null:ref}),
    products:[{product:'SUPPLIER_INTELLIGENCE',features:['supplier_report'],organisationId:'org-a',environment:'development',applicationId:application.appId,status:'ACTIVE',version:'1',sourceRef:'synthetic-product',source:'CONTRACT',expiresAt}]}
  const module={moduleId:'supplier_report',moduleBindingId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',version:'1',sourceRef:'synthetic-module',expiresAt,transactionId:'1',moduleSchemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64)}
  const controls={intent:false,outcome:false,module},events=[];let calls=0
  const options={application,now:()=>time,authenticate:issuer.authenticate,
    recordAudit:async event=>{if(controls.intent)throw Error('Unavailable');events.push(event)},
    withTransaction:async(_request,run)=>run({state,moduleEvidence:controls.module,transaction:{},transactionalEffects:true,outputBoundaryVersion:'profitia.krs-registry-read/1.0.0',
      recordOutcome:async event=>{if(controls.outcome)throw Error('Unavailable');events.push(event)},projectOutput:value=>value})}
  const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:'org-a',resourceId:state.resource.id,payload,
    request:new Request('https://registry.example',{headers:{authorization:'Bearer '+issuer.issue('user-a')}})}
  return {options,state,controls,events,input,run:()=>createOperationExecutor(options).execute(input,()=>{calls++;return {safeProjection:true}}),get calls(){return calls}}
}
for(const operation of REGISTRY_READ_OPERATIONS){
  test(operation+': current HUMAN/module/product/permission and distinct public registry projection',async()=>{
    const f=fixture(operation),r=await f.run();assert.equal(r.decision,'ALLOW');assert.equal(f.calls,1);
    assert.deepEqual(f.events.map(e=>e.phase),['INTENT','OUTCOME']);assert.ok(f.events.every(e=>e.effect==='READ'));
    assert.doesNotMatch(JSON.stringify(f.events),/Private query phrase/)
  })
  const denies=[
    ['unauthenticated',f=>f.input.request=new Request('https://registry.example'),'UNVERIFIED_IDENTITY'],
    ['forged actor',f=>f.input.request={verified:true,userId:'user-a',organisationId:'org-a'},'UNVERIFIED_IDENTITY'],
    ['revoked membership',f=>f.state.access.status='REVOKED','ACCESS_BASIS_INVALID'],
    ['expired membership',f=>f.state.access.expiresAt=new Date(time).toISOString(),'ACCESS_BASIS_INVALID'],
    ['another organisation',f=>f.input.organisationId='org-b','CONTEXT_INVALID'],
    ['missing permission',f=>f.state.access.permissions=[],'PERMISSION_DENIED'],
    ['explicit deny',f=>f.state.access.denies=structuredClone(f.state.access.permissions),'PERMISSION_DENIED'],
    ['missing product',f=>f.state.products=[],'PRODUCT_UNAVAILABLE'],
    ['missing module',f=>f.controls.module=undefined,'APPLICATION_FEATURE_UNAVAILABLE'],
    ['foreign module',f=>f.controls.module={...f.controls.module,moduleId:'benchmark'},'APPLICATION_FEATURE_UNAVAILABLE'],
    ['cross environment',f=>f.state.environment='staging','POLICY_UNAVAILABLE'],
    ['private organisation owner',f=>f.state.resource={...f.state.resource,ownerOrganisationId:'org-a'},'RESOURCE_SCOPE_MISMATCH'],
    ['private user owner',f=>f.state.resource={...f.state.resource,ownerUserId:'user-a'},'RESOURCE_SCOPE_MISMATCH'],
    ['unapproved projection',f=>f.state.resource={...f.state.resource,approvedSharedProjection:false},'RESOURCE_SCOPE_MISMATCH'],
    ['MGBI label substitution',f=>f.state.resource={...f.state.resource,registry:{...f.state.resource.registry,provider:'MGBI'}},'RESOURCE_SCOPE_MISMATCH'],
    ['client authority in selection',f=>f.input.payload={...f.input.payload,organisationId:'org-a'},'RESOURCE_SCOPE_MISMATCH'],
  ]
  for(const [name,mutate,reason]of denies)test(operation+': '+name+' denies before data access',async()=>{
    const f=fixture(operation);mutate(f);await assert.rejects(f.run,e=>e.reasonCode===reason);assert.equal(f.calls,0)
  })
  test(operation+': audit unavailable denies before read; failed outcome cannot publish',async()=>{
    const f=fixture(operation);f.controls.intent=true;await assert.rejects(f.run,e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(f.calls,0)
    const g=fixture(operation);g.controls.outcome=true;await assert.rejects(g.run,e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(g.calls,1)
  })
  test(operation+': read permission never admits a paid refresh or platform ingestion',async()=>{
    const f=fixture(operation);for(const op of ['supplier.report.refresh','supplier.private.refresh','knowledge.ingest']){
      f.input.operation=op;await assert.rejects(f.run,e=>e.reasonCode==='PERMISSION_DENIED')
    }assert.equal(f.calls,0)
  })
}
test('registry collection discovery cannot be relabeled as an existing report or market read',async()=>{
  for(const operation of ['supplier.report.read','knowledge.read']){
    const f=fixture();f.options.application.profileId='SPENDGURU_SAAS';f.options.application.features.push('market');f.options.application.operations.push(operation)
    f.state.access.permissions.push({operation,feature:operation==='knowledge.read'?'market':'supplier_report',resourceId:null});f.input.operation=operation
    await assert.rejects(f.run,e=>e.reasonCode==='RESOURCE_SCOPE_MISMATCH');assert.equal(f.calls,0)
  }
})
test('selected KRS is bound to the actual snapshot reference and resource incarnation',async()=>{
  const f=fixture('supplier.registry.resolve');f.input.payload={selectedKrs:'0000000002'};await assert.rejects(f.run,e=>e.reasonCode==='RESOURCE_SCOPE_MISMATCH');assert.equal(f.calls,0)
  assert.throws(()=>registryReadResource('supplier.registry.resolve',{selectedKrs:'0000000001'},{environment:'development',generation:'1',snapshotRef:'KRS:0000000002:'+ 'a'.repeat(64)}))
})
test('closed bounded selectors reject getters, prototypes and unsupported operations',()=>{
  const valid={query:'Firma',limit:10,cursor:null}
  for(const value of [{...valid,query:'F'},{...valid,query:' Firma'},{...valid,limit:11},{...valid,limit:0},{...valid,cursor:'../x'},{...valid,userId:'forged'},Object.assign(Object.create(null),valid)])assert.throws(()=>registryReadSelection('supplier.registry.search',value))
  let invoked=0;assert.throws(()=>registryReadSelection('supplier.registry.search',{...valid,get query(){invoked++;return 'Firma'}}));assert.equal(invoked,0)
  assert.throws(()=>registryReadSelection('supplier.registry.refresh',{selectedKrs:'0000000001'}))
})
