import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {PoolClient} from 'pg'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import {bindOrganizationTransaction,withOrganization} from './db'
const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',service='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',request='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
function context(){return{actorKind:'SERVICE',actorId:service,actor:{kind:'SERVICE',actorId:service,serviceId:service},operation:'job.execute',applicationId:'srm-jobs',subjectUserId:user,organisationId:org,resourceId:request,requestContinuation:{requestId:request,phaseId:'REGISTER_LOOKUP',inputDigest:'a'.repeat(64),schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64),policyVersion:'1',transactionId:'101'},delegation:{requestId:request,subjectUserId:user,organisationId:org,target:{operation:'supplier.report.refresh',application:{appId:'srm'}}}} as unknown as OperationContext}
function fixture(options:{database?:string;allowed?:boolean;actual?:Record<string,string>;superuser?:boolean;transaction?:string;login?:string;org?:string}={}){
 const calls:Array<{sql:string;values?:unknown[]}>=[];let released=0
 const client={query:async(sql:string,values?:unknown[])=>{
  calls.push({sql,values})
  if(sql.includes('FROM pg_roles'))return{rows:[{database_name:options.database??'isolated_private_fixture',bypass_rls:false,superuser:options.superuser??false,neon_superuser_member:false}]}
  if(sql.includes('profitia_request_phases.delegated_scope_allows'))return{rows:[{allowed:options.allowed??true,role:'ordinary_fixture',login:options.login??'ordinary_fixture',transaction_id:options.transaction??'101',descriptor:{role:'ordinary_fixture',applicationId:'srm-jobs',databaseName:options.database??'isolated_private_fixture',executorServiceId:service,subjectUserId:user,organisationId:org,requestId:request,phaseId:'REGISTER_LOOKUP',schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64),transactionId:'101',...options.actual}}]}
  if(sql.includes("current_setting('srm.organization_id'"))return{rows:[{organization_id:options.org??org}]}
  if(sql.includes('SELECT id FROM srm.organizations'))return{rows:[{id:org}]}
  throw Error('Unexpected helper SQL')
 },release:()=>{released++}} as unknown as PoolClient
 return{client,calls,get released(){return released}}
}
test('bound Service provenance is snapshotted but actual SQL authority remains mandatory',async()=>{
 const f=fixture(),c=context(),pool=bindOrganizationTransaction(org,f.client,c)
 c.requestContinuation={...c.requestContinuation!,inputDigest:'f'.repeat(64)}
 const result=await withOrganization(org,async client=>{assert.equal(client,f.client);return'private-result'},pool)
 assert.equal(result,'private-result');assert.equal(f.released,0)
 const proof=f.calls.find(x=>x.sql.includes('delegated_scope_allows'));assert.deepEqual(proof?.values,[request,'REGISTER_LOOKUP','a'.repeat(64),org,user])
 assert(!f.calls.some(x=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(x.sql)))
})
test('database name srm_app never bypasses the explicit delegated phase check',async()=>{
 const f=fixture({database:'srm_app',allowed:false});let actions=0
 await assert.rejects(withOrganization(org,async()=>{actions++},bindOrganizationTransaction(org,f.client,context())),/delegated private transaction scope mismatch/)
 assert.equal(actions,0);assert(f.calls.some(x=>x.sql.includes('delegated_scope_allows')))
})
const deniedCases:NonNullable<Parameters<typeof fixture>[0]>[]=[{allowed:false},{actual:{executorServiceId:user}},{actual:{subjectUserId:service}},{actual:{applicationId:'foreign-app'}},{actual:{schemaDigest:'f'.repeat(64)}},{actual:{delegatedSchemaDigest:'f'.repeat(64)}},{transaction:'102'},{login:'another-login'},{org:'22222222-2222-4222-8222-222222222222'},{superuser:true}]
for(const patch of deniedCases)test('current physical scope or context mismatch refuses business action '+JSON.stringify(patch),async()=>{
 const f=fixture(patch);let actions=0
 await assert.rejects(withOrganization(org,async()=>{actions++},bindOrganizationTransaction(org,f.client,context())))
 assert.equal(actions,0);assert.equal(f.released,0)
})
test('foreign organisation fails before connecting and another actor cannot borrow Service metadata',async()=>{
 const f=fixture(),c=context(),pool=bindOrganizationTransaction(org,f.client,c)
 await assert.rejects(withOrganization('22222222-2222-4222-8222-222222222222',async()=>{},pool),/organization mismatch/);assert.equal(f.calls.length,0)
 assert.throws(()=>bindOrganizationTransaction(org,f.client,{...c,actorKind:'HUMAN'}),/delegated Supplier phase/)
 assert.throws(()=>bindOrganizationTransaction(org,f.client,{...c,requestContinuation:{...c.requestContinuation!,phaseId:'FETCH_PROVIDER'}}),/delegated Supplier phase/)
})
test('an outer transaction remains responsible for rollback when the domain action fails',async()=>{
 const f=fixture();await assert.rejects(withOrganization(org,async()=>{throw Error('Synthetic domain failure')},bindOrganizationTransaction(org,f.client,context())),/Synthetic domain failure/)
 assert.equal(f.released,0);assert(!f.calls.some(x=>/^(BEGIN|COMMIT|ROLLBACK)$/.test(x.sql)))
})
