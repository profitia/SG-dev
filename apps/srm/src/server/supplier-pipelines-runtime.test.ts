import test from 'node:test';
import assert from 'node:assert/strict';
import {OperationDenied} from '@profitia/platform-contracts/operation-context';
import {createSupplierPipelinesPort} from './supplier-pipelines-store';
import {supplierWorkspaceConfiguration} from './supplier-pipelines-runtime';
import {parseWorkspaceCommand} from './supplier-pipelines-contract';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const request=()=>new Request('https://srm.example.test/api/adp/v1/suppliers',{method:'POST'});
const command=parseWorkspaceCommand({contractVersion:'1.0.0',idempotencyKey:'adapter_fixture_1',command:'SUPPLIER_CREATE',data:{nip:'5213390341',displayName:'Fixture'}});
const result={decision:'ALLOW' as const,decisionId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',value:{ok:true,status:201,result:{supplierId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',version:1},replayed:false}};
const port=(execute:any)=>createSupplierPipelinesPort({host:{execute},defaultOrganisationId:org,acceptsMutationOrigin:()=>true});
test('API response waits for the closed host and keeps domain idempotency out of Root request-admission fields',async()=>{
 let release!:(v:typeof result)=>void,seen:any,finished=false;
 const p=port((input:any)=>{seen=input;return new Promise(resolve=>{release=resolve})});
 const pending=p.write(request(),'supplier.catalog.write',command,'request-fixture').then(v=>{finished=true;return v});
 await Promise.resolve();assert.equal(finished,false);assert.equal(seen.organisationId,org);assert.equal(seen.resourceId,'supplier-workspace:'+org);
 assert.equal(seen.idempotencyKey,undefined);assert.equal(seen.payload.idempotencyKey,command.idempotencyKey);
 release(result);const response=await pending;assert.equal(response.status,201);assert.equal((await response.json()).result.version,1);
 assert.equal(response.headers.get('x-profitia-decision-id'),result.decisionId);
});
test('current identity/access failures and a late audit failure disclose no business value or native error text',async()=>{
 for(const [reason,status]of [['UNVERIFIED_IDENTITY',401],['PERMISSION_DENIED',403],['EXPLICIT_DENY',403],['CONTEXT_INVALID',403],['AUDIT_UNAVAILABLE',503]]as const){
  const response=await port(async()=>{throw new OperationDenied(reason)}).write(request(),'supplier.catalog.write',command,'r');
  assert.equal(response.status,status);assert.equal((await response.json()).result,undefined);
 }
 const response=await port(async()=>{throw Error('SELECT secret_native_payload')}).write(request(),'supplier.catalog.write',command,'r');
 assert.equal(response.status,503);assert(!(await response.text()).includes('secret_native_payload'));
});
test('coded duplicates preserve only the public existing-supplier target and unsupported receiver values fail closed',async()=>{
 const existing={supplierId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',displayName:'Existing fixture',lifecycle:'ACTIVE'};
 const response=await port(async()=>({...result,value:{ok:false,status:409,code:'DUPLICATE_NIP',fieldErrors:{nip:'Firma istnieje.'},existingSupplier:existing}})).write(request(),'supplier.catalog.write',command,'r');
 assert.equal(response.status,409);assert.deepEqual((await response.json()).error.existingSupplier,existing);
 for(const value of [null,{ok:true,status:200,result:{private:'unexpected'}},{ok:false,code:'UNSAFE_NATIVE_ERROR',message:'native text'}]){
  const denied=await port(async()=>({...result,value})).write(request(),'supplier.catalog.write',command,'r');assert.equal(denied.status,503);
 }
});
test('workspace configuration is disabled by default and cannot be enabled without exact admitted metadata and binding',()=>{
 assert.equal(supplierWorkspaceConfiguration({},{} as any),null);
 for(const enabled of ['true','yes','TRUE','1'])assert.throws(()=>supplierWorkspaceConfiguration({PROFITIA_SUPPLIER_WORKSPACE_ENABLED:enabled},{} as any),e=>(e as any).code==='UNAVAILABLE');
});
