import assert from 'node:assert/strict'
import test from 'node:test'
import type {PoolClient} from 'pg'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import {bindOrganizationTransaction,withOrganization,withNativeCompanyStoreTransaction} from './db'
const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const service='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',requestId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const expires=new Date(Date.now()+3600000).toISOString(),digest='d'.repeat(64)
function context(privateTarget=false):OperationContext{
 const operation=privateTarget?'supplier.private.refresh':'supplier.report.refresh'
 const resourceId=(privateTarget?'supplier-private-request:JDG:jdg:':'supplier-request:')+digest
 return {actorKind:'SERVICE',actorId:service,actor:{kind:'SERVICE',actorId:service,serviceId:service},operation:'job.execute',applicationId:'srm-jobs',subjectUserId:user,organisationId:org,resourceId:requestId,payloadDigest:digest,
 requestWork:{requestId,unitId:'SRM_SENSITIVE_REPLAY',accessMode:'READ',inputDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64),transactionId:'101',policyVersion:'1',policySourceRef:'SYNTHETIC_ONLY',policyExpiresAt:expires},
 delegation:{requestId,subjectUserId:user,organisationId:org,payloadDigest:digest,target:{operation,resourceId,application:{appId:'srm'}}}} as unknown as OperationContext
}
function fixture(c:OperationContext,patch:Record<string,unknown>={},rowPatch:Record<string,unknown>={}){
 let released=false;const queries:string[]=[]
 const w=c.requestWork!,descriptor={role:'srm_native_test',applicationId:'srm-jobs',databaseName:'srm_native_fixture',executorServiceId:service,subjectUserId:user,organisationId:org,requestId,unitId:w.unitId,accessMode:w.accessMode,effect:'PRIVATE_SQL_WORK',schemaDigest:w.schemaDigest,policyVersion:w.policyVersion,sourceRef:w.policySourceRef,policyExpiresAt:expires,transactionId:'101',operation:c.delegation!.target.operation,resourceId:c.delegation!.target.resourceId,...patch}
 const client={query:async(sql:string)=>{queries.push(sql)
  if(sql.includes('FROM pg_roles'))return{rows:[{database_name:'srm_native_fixture',bypass_rls:false,superuser:false,neon_superuser_member:false,
   allowed:true,descriptor,input_digest:w.inputDigest,transaction_id:'101',role:'srm_native_test',login:'srm_native_test',organization_id:org,organization_exists:true,...rowPatch}]}
  if(sql.includes('profitia_request_work.scope_allows'))return{rows:[{allowed:true,descriptor,input_digest:w.inputDigest,transaction_id:'101',role:'srm_native_test',login:'srm_native_test'}]}
  if(sql.includes('current_setting'))return{rows:[{organization_id:org}]}
  if(sql.includes('FROM srm.organizations'))return{rows:[{id:org}]}
  throw Error('Unexpected fixture query')
 },release(){released=true}} as unknown as PoolClient
 return{client,queries,descriptor,released:()=>released}
}
function companyContext():OperationContext{
 const c=context();return {...c,requestWork:{...c.requestWork!,unitId:'SRM_STORE_COMPANY',accessMode:'WRITE'}}
}
test('one company store checks the real transaction at both boundaries without repeating every inner helper',async()=>{
 const c=companyContext(),f=fixture(c),pool=bindOrganizationTransaction(org,f.client,c);
 const result=await withNativeCompanyStoreTransaction(org,async scoped=>{
  let sum=0;
  for(let i=0;i<12;i++)sum+=await withOrganization(org,async client=>{assert.equal(client,f.client);return i},scoped);
  return sum;
 },pool);
 assert.equal(result,66);assert.equal(f.queries.length,2);assert.equal(f.released(),false);
 assert(f.queries.every(q=>q.includes('FROM pg_roles')&&q.includes('scope_allows')&&q.includes('descriptor')));
 await withOrganization(org,async()=>undefined,pool);assert.equal(f.queries.length,3,'The next independent action has its own current proof');
});
test('company store consolidation refuses other Work purposes, modes, targets and unbound pools',async()=>{
 const company=companyContext();
 for(const c of[context(),context(true),{...company,requestWork:{...company.requestWork!,accessMode:'READ' as const}},
  {...company,delegation:{...company.delegation!,target:{...company.delegation!.target,operation:'supplier.private.refresh',resourceId:'supplier-private-request:JDG:jdg:'+digest}}} as OperationContext]){
  const f=fixture(c);let called=false;
  await assert.rejects(withNativeCompanyStoreTransaction(org,async()=>{called=true},bindOrganizationTransaction(org,f.client,c)),/Explicit active native company store/);
  assert.equal(called,false);assert.equal(f.queries.length,0);
 }
 const f=fixture(company);await assert.rejects(withNativeCompanyStoreTransaction(org,async()=>undefined,{connect:async()=>f.client}),/Explicit active native company store/);
 assert.equal(f.queries.length,0);
});
test('company store rechecks current policy, role, organisation and transaction before releasing its result',async()=>{
 const faults=[{allowed:false},{organization_id:service},{organization_exists:false},{transaction_id:'102'},
  {role:'foreign'},{login:'foreign'},{bypass_rls:true},{superuser:true},{neon_superuser_member:true}];
 for(const fault of faults){
  const c=companyContext(),changed:Record<string,unknown>={},f=fixture(c,{},changed),pool=bindOrganizationTransaction(org,f.client,c);
  let performed=false;
  await assert.rejects(withNativeCompanyStoreTransaction(org,async scoped=>{
   await withOrganization(org,async()=>{performed=true},scoped);Object.assign(changed,fault);return 'MUST_NOT_BE_RELEASED';
  },pool));
  assert.equal(performed,true);assert.equal(f.queries.length,2);assert.equal(f.released(),false);
 }
 for(const fault of[{subjectUserId:service},{organisationId:service},{policyVersion:'2'},{transactionId:'102'},{unitId:'SRM_CACHE_READ'}]){
  const c=companyContext(),f=fixture(c),pool=bindOrganizationTransaction(org,f.client,c);
  await assert.rejects(withNativeCompanyStoreTransaction(org,async()=>{Object.assign(f.descriptor,fault);return 'MUST_NOT_BE_RELEASED'},pool),/native work transaction scope mismatch/);
  assert.equal(f.queries.length,2);
 }
});
test('company store capability is organisation-bound and closes after success or failure',async()=>{
 for(const fail of[false,true]){
  const c=companyContext(),f=fixture(c),pool=bindOrganizationTransaction(org,f.client,c);let escaped:Parameters<typeof withNativeCompanyStoreTransaction>[2]|undefined;
  const run=withNativeCompanyStoreTransaction(org,async scoped=>{
   escaped=scoped;
   await assert.rejects(withOrganization(service,async()=>{throw Error('Foreign action must not run')},scoped),/organization mismatch/);
   await assert.rejects(withNativeCompanyStoreTransaction(org,async()=>undefined,scoped),/Explicit active native company store/);
   if(fail)throw Error('Synthetic domain failure');return 42;
  },pool);
  if(fail)await assert.rejects(run,/Synthetic domain failure/);else assert.equal(await run,42);
  assert(escaped);const before=f.queries.length;
  await assert.rejects(withOrganization(org,async()=>42,escaped),/scope is closed/);
  await assert.rejects(escaped.connect(),/scope is closed/);
  assert.equal(f.queries.length,before);assert.equal(f.released(),false);
 }
});
test('unfinished company actions cannot escape the boundary or later release a result',async()=>{
 const c=companyContext(),f=fixture(c),pool=bindOrganizationTransaction(org,f.client,c);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let pending:Promise<unknown>|undefined;
 await assert.rejects(withNativeCompanyStoreTransaction(org,async scoped=>{
  pending=withOrganization(org,async()=>{await gate;return 'MUST_NOT_BE_RELEASED'},scoped);pending.catch(()=>{});
 },pool),/unfinished domain actions/);
 release();assert(pending);await assert.rejects(pending,/scope is closed/);
 assert.equal(f.queries.length,1);assert.equal(f.released(),false);
});
test('native bound transaction admits both exact Supplier targets and retains original client ownership',async()=>{
 for(const privateTarget of[false,true]){
  const c=context(privateTarget),f=fixture(c),pool=bindOrganizationTransaction(org,f.client,c)
  assert.equal(await withOrganization(org,async client=>{assert.equal(client,f.client);return 42},pool),42)
  assert(!f.queries.some(q=>['BEGIN','COMMIT','ROLLBACK'].includes(q)));assert.equal(f.released(),false)
  assert.equal(f.queries.length,1,'fresh role, Work, transaction, organisation and provisioning checks share one statement')
 }
})
test('consolidated query retains every current scope, role, transaction and organisation refusal',async()=>{
 for(const row of [{allowed:false},{transaction_id:'102'},{role:'foreign'},{login:'foreign'},
  {organization_id:service},{organization_exists:false},{bypass_rls:true},{superuser:true},{neon_superuser_member:true}]){
  const c=context(),f=fixture(c,{},row);let actions=0
  await assert.rejects(withOrganization(org,async()=>{actions++},bindOrganizationTransaction(org,f.client,c)))
  assert.equal(actions,0);assert.equal(f.queries.length,1);assert.equal(f.released(),false)
 }
})
test('a current SQL descriptor cannot substitute another target operation or resource',async()=>{
 for(const privateTarget of[false,true])for(const patch of[{operation:'forecast.request'},{operation:privateTarget?'supplier.report.refresh':'supplier.private.refresh'},{resourceId:'supplier-request:'+'e'.repeat(64)},{subjectUserId:service},{organisationId:service}]){
  const c=context(privateTarget),f=fixture(c,patch);let actions=0
  await assert.rejects(withOrganization(org,async()=>{actions++},bindOrganizationTransaction(org,f.client,c)),/native work transaction scope mismatch/)
  assert.equal(actions,0);assert.equal(f.released(),false)
 }
})
test('private transaction reference refuses unsupported targets, malformed selection and changed canonical payload before SQL',()=>{
 const c=context(true),f=fixture(c),target=c.delegation!.target
 for(const t of[{...target,operation:'forecast.request'},{...target,resourceId:'supplier-private-request:COMPANY:jdg:'+digest},{...target,resourceId:'supplier-private-request:JDG:jdg:'+'e'.repeat(64)}])
  assert.throws(()=>bindOrganizationTransaction(org,f.client,{...c,delegation:{...c.delegation!,target:t}} as unknown as OperationContext),/native Supplier work/)
 assert.throws(()=>bindOrganizationTransaction(org,f.client,{...c,subjectUserId:service}),/native Supplier work/)
 assert.equal(f.queries.length,0)
})
