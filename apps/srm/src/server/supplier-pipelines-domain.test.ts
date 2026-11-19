import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNewMembership,planStageRemoval,planSupplierTransfer,planLifecycle,commandDigest,inspectReplay,validateStageConfiguration} from './supplier-pipelines-domain';
import type {PipelineState,MembershipState,EntityState} from './supplier-pipelines-domain';
import {parseWorkspaceCommand,SupplierPipelinesError} from './supplier-pipelines-contract';
const org='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
const supplier:EntityState={id:'company',organisationId:org,version:4,lifecycle:'ACTIVE'};
const pipeline=(id='asfalt',kind:'CATEGORY'|'SUPPLIER'='CATEGORY'):PipelineState=>({id,organisationId:org,kind,categoryId:kind==='CATEGORY'?'category-asfalt':null,version:7,lifecycle:'ACTIVE',
 stages:[{stageId:id+'-new',name:'Nowy',order:0,deletedAt:null},{stageId:id+'-offer',name:'Oferta',order:1,deletedAt:null}]});
const membership=(p:PipelineState):MembershipState=>({membershipId:'member-'+p.id,organisationId:org,supplierId:supplier.id,pipelineId:p.id,stageId:p.stages[0].stageId,kind:p.kind,version:2,endedAt:null});
const error=(f:()=>unknown,code:string)=>assert.throws(f,(e:unknown)=>e instanceof SupplierPipelinesError&&e.code===code);
test('one supplier can enter two independently named CATEGORY processes without a card category',()=>{
 const a=pipeline('asfalt'),b=pipeline('beton');
 assert.doesNotThrow(()=>assertNewMembership(org,supplier,a,a.stages[0].stageId,7,[]));
 assert.doesNotThrow(()=>assertNewMembership(org,supplier,b,b.stages[0].stageId,7,[membership(a)]));
 assert.doesNotThrow(()=>assertNewMembership(org,supplier,pipeline('asfalt-second'),'asfalt-second-new',7,[membership(a),membership(b)]));
 error(()=>assertNewMembership(org,supplier,a,a.stages[0].stageId,7,[membership(a)]),'VERSION_CONFLICT');
});
test('zero or one active SUPPLIER assignment, with historical memberships retained',()=>{
 const a=pipeline('qualification','SUPPLIER'),b=pipeline('onboarding','SUPPLIER');
 assert.doesNotThrow(()=>assertNewMembership(org,supplier,a,a.stages[0].stageId,7,[]));
 error(()=>assertNewMembership(org,supplier,b,b.stages[0].stageId,7,[membership(a)]),'ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS');
 assert.doesNotThrow(()=>assertNewMembership(org,supplier,b,b.stages[0].stageId,7,[{...membership(a),endedAt:'2026-11-19T12:00:00Z'}]));
});
test('occupied stage removal is a complete immutable plan and leaves other pipelines untouched',()=>{
 const a=pipeline(),b=pipeline('beton'),before=structuredClone([a,b]),other=membership(b);
 const plan=planStageRemoval(org,a,{stageId:'asfalt-new',targetStageId:'asfalt-offer',expectedPipelineVersion:7,expectedCount:4},4);
 assert.deepEqual(plan,{stageId:'asfalt-new',targetStageId:'asfalt-offer',movedCount:4,nextPipelineVersion:8});
 assert.deepEqual([a,b],before);assert.equal(other.stageId,'beton-new');
});
test('stage removal refuses stale count/version, last stage and foreign target before an effect',()=>{
 const p=pipeline(),base={stageId:'asfalt-new',targetStageId:'asfalt-offer',expectedPipelineVersion:7,expectedCount:4};
 error(()=>planStageRemoval(org,p,base,5),'PIPELINE_CHANGED');
 error(()=>planStageRemoval(org,p,{...base,expectedPipelineVersion:6},4),'PIPELINE_CHANGED');
 error(()=>planStageRemoval(org,p,{...base,targetStageId:null},4),'FIELD_INVALID');
 error(()=>planStageRemoval(org,p,{...base,targetStageId:'beton-new'},4),'NOT_FOUND');
 error(()=>planStageRemoval(org,{...p,stages:[p.stages[0]]},{...base,expectedCount:0},0),'LAST_STAGE');
 error(()=>planStageRemoval(org,{...p,organisationId:foreign},base,4),'NOT_FOUND');
});
test('explicit SUPPLIER transfer plans both changes together and preserves source on refusal',()=>{
 const a=pipeline('qualification','SUPPLIER'),b=pipeline('onboarding','SUPPLIER'),m=membership(a),before=structuredClone(m);
 const plan=planSupplierTransfer(org,supplier,m,a,b,{sourceVersion:2,expectedTargetVersion:7,targetStageId:'onboarding-new'});
 assert.equal(plan.sourceMembershipId,m.membershipId);assert.equal(plan.targetPipelineId,b.id);assert.deepEqual(m,before);
 error(()=>planSupplierTransfer(org,supplier,m,a,b,{sourceVersion:1,expectedTargetVersion:7,targetStageId:'onboarding-new'}),'VERSION_CONFLICT');
 error(()=>planSupplierTransfer(org,supplier,m,a,b,{sourceVersion:2,expectedTargetVersion:6,targetStageId:'onboarding-new'}),'VERSION_CONFLICT');
 error(()=>planSupplierTransfer(org,supplier,m,a,a,{sourceVersion:2,expectedTargetVersion:7,targetStageId:'qualification-new'}),'FIELD_INVALID');
 error(()=>planSupplierTransfer(org,supplier,m,a,pipeline(),{sourceVersion:2,expectedTargetVersion:7,targetStageId:'asfalt-new'}),'FIELD_INVALID');
});
test('archive closes active memberships; restore never reactivates historical participation',()=>{
 const archived=planLifecycle(org,supplier,{expectedVersion:4,archive:true,expectedCount:2},2);
 assert.equal(archived.endActiveMemberships,true);assert.equal(archived.reactivateMemberships,false);
 const restored=planLifecycle(org,{...supplier,lifecycle:'ARCHIVED',version:5},{expectedVersion:5,archive:false},0);
 assert.equal(restored.lifecycle,'ACTIVE');assert.equal(restored.endActiveMemberships,false);assert.equal(restored.reactivateMemberships,false);
 error(()=>planLifecycle(org,supplier,{expectedVersion:4,archive:true,expectedCount:2},3),'VERSION_CONFLICT');
});
test('immutable history identifiers survive stage rename and configuration validation',()=>{
 const p=pipeline();validateStageConfiguration(p.stages);
 error(()=>validateStageConfiguration([{...p.stages[0]},{...p.stages[1],name:'  NOWY '}]),'FIELD_INVALID');
 error(()=>validateStageConfiguration([{...p.stages[0],deletedAt:'2026-11-19'},{...p.stages[1],deletedAt:'2026-11-19'}]),'LAST_STAGE');
 assert.equal(p.stages[0].stageId,'asfalt-new');
});
test('replay digest is canonical over semantic command, detects changed payload and excludes actor claims',()=>{
 const a=parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'first_key_123',command:'SUPPLIER_CREATE',data:{displayName:'Firma',nip:'526-025-02-74'}});
 const b=parseWorkspaceCommand({command:'SUPPLIER_CREATE',data:{nip:'5260250274',displayName:'Firma'},idempotencyKey:'second_key_123',contractVersion:'1.0.0'});
 assert.equal(commandDigest(a),commandDigest(b));
 const receipt={digest:commandDigest(a),result:{supplierId:'same-original-id'}};
 assert.deepEqual(inspectReplay(a,receipt),{replay:true,result:receipt.result});
 assert.deepEqual(inspectReplay(a,null),{replay:false});
 const changed=parseWorkspaceCommand({...a,data:{...a.data,displayName:'Inna'}});
 error(()=>inspectReplay(changed,receipt),'IDEMPOTENCY_CONFLICT');
});
