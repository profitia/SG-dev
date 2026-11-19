import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLIER_WORKSPACE_ACCESS_PROPOSAL as proposal,describeSupplierWorkspaceOperation,assertSupplierWorkspaceDescriptorMatches} from '../src/supplier-workspace-access.mjs';
const now=()=>Date.parse('2026-11-19T12:00:00Z');
const descriptor=()=>({applicationId:'srm',environment:'development',runtimeRole:'srm_private_development_runtime',
 databaseName:'platform_private',transactionId:'12',organisationId:'11111111-1111-4111-8111-111111111111',
 actorAccountId:'22222222-2222-4222-8222-222222222222',operation:'supplier.catalog.read',
 nativeUnitId:'SUPPLIER_WORKSPACE_READ',accessMode:'READ',payloadDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64),
 sourceRef:'c'.repeat(40),policyVersion:'1',expiresAt:'2026-11-19T12:01:00Z'});
test('workspace proposal enumerates seven new and two existing operations without an authority result',()=>{
 assert.equal(proposal.status,'PROPOSED_NOT_ADOPTED');assert.equal(proposal.operations.length,9);
 assert.equal(proposal.operations.filter(x=>x.newRootOperation).length,7);
 assert.equal(Object.hasOwn(proposal,'allow'),false);assert.equal(Object.isFrozen(proposal.operations),true);
 for(const row of proposal.operations){assert.equal(row.nativeUnitId,row.accessMode==='READ'?'SUPPLIER_WORKSPACE_READ':'SUPPLIER_WORKSPACE_WRITE');}
});
test('workspace proposal preserves same-member capability with explicit current denies and product admission',()=>{
 assert.match(proposal.capabilities,/CURRENT_ELIGIBLE_ORGANISATION_MEMBERS/);
 assert.ok(proposal.preserves.includes('explicit denies'));assert.ok(proposal.preserves.includes('application product/feature admission'));
 assert.equal(proposal.dataClass,'ORGANISATION_PRIVATE');assert.equal(proposal.sqlBoundary.master,'REUSE_srm.suppliers_NO_SECOND_IDENTITY_MASTER');
 assert.match(proposal.sqlBoundary.runtimeRights,/NO_NEW_GENERAL_TABLE_DML/);
});
test('workspace proposal never borrows report, provider or service authority',()=>{
 for(const op of ['*','supplier.report.refresh','job.execute','supplier.location.write','supplier.catalog.delete']){
  assert.throws(()=>describeSupplierWorkspaceOperation(op),/Unsupported bounded/);
 }
 assert.ok(proposal.exclusions.includes('supplier.report.refresh authority reuse'));
});
test('descriptor comparison accepts the exact current native metadata and returns no grant',()=>{
 const value=descriptor();assert.equal(assertSupplierWorkspaceDescriptorMatches(value,structuredClone(value),{now}),undefined);
});
for(const key of ['organisationId','actorAccountId','transactionId','operation','payloadDigest','schemaDigest','sourceRef','policyVersion','runtimeRole','databaseName']){
 test('descriptor mismatch refuses substituted '+key,()=>{
  const expected=descriptor(),actual={...expected,[key]:'substituted'};
  assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(actual,expected,{now}),/mismatch/);
 });
}
test('descriptor rejects expired metadata and a supplier-report native unit',()=>{
 const expired={...descriptor(),expiresAt:'2026-11-19T11:59:59Z'};
 assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(expired,expired,{now}),/mismatch/);
 const wrongUnit={...descriptor(),nativeUnitId:'SRM_STORE_COMPANY'};
 assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(wrongUnit,wrongUnit,{now}),/mismatch/);
});
test('descriptor rejects extra claimed ALLOW, accessor and non-current environment even when echoed',()=>{
 const extra={...descriptor(),allow:true};assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(extra,extra,{now}),/mismatch/);
 const stage={...descriptor(),environment:'staging'};assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(stage,stage,{now}),/mismatch/);
 const accessor=descriptor();Object.defineProperty(accessor,'organisationId',{get(){throw Error('getter must not run')},enumerable:true});
 assert.throws(()=>assertSupplierWorkspaceDescriptorMatches(accessor,descriptor(),{now}),/mismatch/);
});

import workspaceTest from 'node:test';
import workspaceAssert from 'node:assert/strict';
import {createOperationExecutor as workspaceExecutor,IMPLEMENTED_OPERATIONS as oldWorkspaceOperations,SUPPLIER_WORKSPACE_ROOT_CONTRACT as workspaceContract} from '../src/operation-context.mjs';
import {SUPPLIER_WORKSPACE_OPERATIONS as workspaceOperations,SUPPLIER_WORKSPACE_NEW_OPERATIONS as newWorkspaceOperations,supplierWorkspaceOperationPolicy as workspacePolicy,createSupplierWorkspaceScopeStore as workspaceScope} from '../src/supplier-workspace-access.mjs';
import {createTestIdentityIssuer as workspaceTestIssuer} from '../../../apps/architecture-lab/src/operation-test-authority.mjs';
const wsTime=Date.parse('2026-11-19T09:00:00Z'),wsOrg='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',wsActor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function workspaceFixture(operation='supplier.catalog.read',payload={kind:'SUPPLIER_BY_NIP',nip:'5213390341'}){
 const issuer=workspaceTestIssuer({applicationId:'srm',now:()=>wsTime}),policy=workspacePolicy(operation),expiresAt=new Date(wsTime+20000).toISOString();
 const application={appId:'srm',profileId:'SPENDGURU_SAAS',deploymentId:'WORKSPACE_UNIT_ONLY',configurationVersion:'fixture-v1',
  environment:'development',identityIssuer:issuer.issuer,organisationId:null,features:['supplier_workspace'],operations:[...workspaceOperations]};
 const state={applicationId:'srm',environment:'development',transactionId:'123',policyVersion:'access-v1:4',usagePolicy:'NOT_APPLICABLE',
  access:{type:'MEMBERSHIP',actorId:wsActor,organisationId:wsOrg,status:'ACTIVE',version:'1:4',sourceRef:'WORKSPACE_SYNTHETIC_ONLY',expiresAt,
   permissions:workspaceOperations.map(operation=>({operation,feature:'supplier_workspace',resourceId:null})),denies:[]},
  products:[{product:'SPENDGURU',features:['supplier_workspace'],organisationId:wsOrg,applicationId:'srm',environment:'development',
   status:'ACTIVE',version:'1',sourceRef:'WORKSPACE_SYNTHETIC_ONLY',source:'EXPLICIT_OFFER',expiresAt}],
  resource:{id:'resource-1',type:policy.resourceType,dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:wsOrg,ownerUserId:null,
   environment:'development',version:'namespace:1',projectionVersion:'1.0.0'}};
 const evidence={moduleId:'supplier_workspace',moduleBindingId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',version:'1',
  sourceRef:'WORKSPACE_SYNTHETIC_ONLY',expiresAt,transactionId:'123',moduleSchemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64)};
 const events=[],committed=[],control={failIntent:false,failOutcome:false};let called=0;
 const options={application,supplierWorkspaceSchemaDigest:'d'.repeat(64),now:()=>wsTime,authenticate:issuer.authenticate,
  recordAudit:async e=>{if(control.failIntent&&e.phase==='INTENT')throw Error('fixture audit down');events.push(e)},
  withTransaction:async(_b,run)=>{
   const pending=[];const v=await run({state,moduleEvidence:evidence,transaction:pending,transactionalEffects:true,
    outputBoundaryVersion:'1.0.0',projectOutput:v=>v,recordOutcome:async e=>{
     if(control.failOutcome)throw Error('fixture outcome down');pending.push(e);
    }});
   committed.push(...pending);return v;
  }};
 const input={contractId:workspaceContract.id,contractVersion:workspaceContract.version,operation,organisationId:wsOrg,resourceId:'resource-1',payload,
  request:new Request('https://workspace.fixture.test',{headers:{authorization:'Bearer '+issuer.issue(wsActor)}})};
 return {options,input,state,evidence,events,committed,control,get called(){return called},
  execute:()=>workspaceExecutor(options).execute(input,async(context,tx)=>{called++;tx.push({actor:context.subjectUserId,org:context.organisationId});return {ok:true}})};
}
workspaceTest('workspace is an isolated explicit Root successor; legacy defaults stay bounded',()=>{
 workspaceAssert.equal(workspaceContract.implementation,'1.0.0-candidate.26');
 for(const op of newWorkspaceOperations)workspaceAssert(!oldWorkspaceOperations.includes(op));
 workspaceAssert(oldWorkspaceOperations.includes('supplier.assignment.read'));
 const f=workspaceFixture();delete f.options.supplierWorkspaceSchemaDigest;
 workspaceAssert.throws(()=>workspaceExecutor(f.options),/explicit schema adoption/);
});
for(const operation of workspaceOperations){
 workspaceTest('workspace '+operation+' requires exact operation and current organisation scope',async()=>{
  const f=workspaceFixture(operation,{});const r=await f.execute();workspaceAssert.equal(r.decision,'ALLOW');
  workspaceAssert.equal(f.called,1);workspaceAssert.equal(f.committed.length,2);workspaceAssert.equal(f.events[0].moduleEvidence.moduleId,'supplier_workspace');
 });
 workspaceTest('workspace '+operation+' refuses a missing explicit permission',async()=>{
  const f=workspaceFixture(operation,{});f.state.access.permissions=f.state.access.permissions.filter(p=>p.operation!==operation);
  await workspaceAssert.rejects(f.execute(),e=>e.reasonCode==='PERMISSION_DENIED');workspaceAssert.equal(f.called,0);
 });
 workspaceTest('workspace '+operation+' preserves an explicit DENY',async()=>{
  const f=workspaceFixture(operation,{});f.state.access.denies.push({operation,feature:'supplier_workspace',resourceId:null});
  await workspaceAssert.rejects(f.execute(),e=>e.reasonCode==='EXPLICIT_DENY');workspaceAssert.equal(f.called,0);
 });
}
for(const[name,change]of [
 ['foreign organisation',f=>f.input.organisationId='dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
 ['foreign actor',f=>f.state.access.actorId='dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
 ['revoked membership',f=>f.state.access.status='REVOKED'],
 ['expired membership',f=>f.state.access.expiresAt=new Date(wsTime-1).toISOString()],
 ['absent module',f=>f.evidence.moduleId='supplier_report'],
 ['expired module',f=>f.evidence.expiresAt=new Date(wsTime-1).toISOString()],
 ['absent product',f=>f.state.products=[]],
 ['foreign resource',f=>f.state.resource.ownerOrganisationId='dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
 ['personal resource',f=>f.state.resource.ownerUserId=wsActor],
 ['role label without grant',f=>{f.state.access.role='ADMIN';f.state.access.permissions=[]}],
 ['mutable command/operation mismatch',f=>f.input.payload={command:'MEMBERSHIP_ADD',data:{}}],
]){
 workspaceTest('workspace rejects '+name+' before action',async()=>{
  const f=workspaceFixture();change(f);await workspaceAssert.rejects(f.execute());workspaceAssert.equal(f.called,0);
 });
}
workspaceTest('occupied lifecycle work independently requires assignment.write',async()=>{
 const f=workspaceFixture('supplier.pipeline.write',{command:'STAGE_REMOVE',data:{expectedCount:4}});
 f.state.access.denies.push({operation:'supplier.assignment.write',feature:'supplier_workspace',resourceId:null});
 await workspaceAssert.rejects(f.execute(),e=>e.reasonCode==='EXPLICIT_DENY');workspaceAssert.equal(f.called,0);
});
workspaceTest('supplier card cannot disclose a separately denied ADP projection',async()=>{
 const f=workspaceFixture('supplier.catalog.read',{kind:'SUPPLIER_CARD'});
 f.state.access.denies.push({operation:'supplier.adp-status.read',feature:'supplier_workspace',resourceId:null});
 await workspaceAssert.rejects(f.execute(),e=>e.reasonCode==='EXPLICIT_DENY');workspaceAssert.equal(f.called,0);
});
workspaceTest('failed INTENT or OUTCOME never commits pending effects',async()=>{
 for(const key of ['failIntent','failOutcome']){
  const f=workspaceFixture();f.control[key]=true;await workspaceAssert.rejects(f.execute());
  workspaceAssert.equal(f.committed.length,0);
 }
});
workspaceTest('JSON descriptor and callback substitution cannot create a native scope lease',async()=>{
 const s=workspaceScope({schemaDigest:'d'.repeat(64),sourceRef:'e'.repeat(40),now:()=>wsTime});
 await workspaceAssert.rejects(s.verify(async()=>({rows:[]}),{},{}));
 await workspaceAssert.rejects(s.execute(async()=>({rows:[{value:{ok:true}}]}),{},{}));
});
workspaceTest('workspace constructor does not absorb another protocol or environment',()=>{
 for(const mutate of [
  f=>f.options.application.environment='production',
  f=>f.options.application.appId='foreign-app',
  f=>f.options.application.operations.push('supplier.report.refresh'),
  f=>f.options.requestQuotaSchemaDigest='e'.repeat(64),
  f=>f.options.knowledgeSchemaDigest='e'.repeat(64),
 ]){
  const f=workspaceFixture();mutate(f);workspaceAssert.throws(()=>workspaceExecutor(f.options));
 }
});

workspaceTest('resource-specific DENY stops complete v1 organization boards and counts',async()=>{
 const f=workspaceFixture('supplier.pipeline.read',{kind:'PIPELINE',pipelineId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});
 f.state.access.denies.push({operation:'supplier.catalog.read',feature:'supplier_workspace',resourceId:'a-different-resource'});
 await workspaceAssert.rejects(f.execute(),e=>e.reasonCode==='EXPLICIT_DENY');workspaceAssert.equal(f.called,0);
});

for (const key of ['organisationBootstrapSchemaDigest','organisationLifecycleSchemaDigest','requestBenchmarkQuotaSchemaDigest']) {
 workspaceTest('SDK1.38 workspace adoption refuses simultaneous '+key+' before identity or SQL',()=>{
  const f=workspaceFixture();let identityCalls=0,transactionCalls=0;
  const options={...f.options,[key]:'a'.repeat(64),
   authenticate:async()=>{identityCalls++;throw Error('identity must not run')},
   withTransaction:async()=>{transactionCalls++;throw Error('SQL must not run')}};
  workspaceAssert.throws(()=>workspaceExecutor(options),TypeError);
  workspaceAssert.equal(identityCalls,0);workspaceAssert.equal(transactionCalls,0);
  workspaceAssert.deepEqual(f.events,[]);workspaceAssert.deepEqual(f.committed,[]);
 });
}
