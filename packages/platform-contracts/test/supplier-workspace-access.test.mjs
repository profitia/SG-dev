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
