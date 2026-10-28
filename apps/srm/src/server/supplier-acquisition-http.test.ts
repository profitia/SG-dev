import assert from 'node:assert/strict'
import {test} from 'node:test'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierOperationHandler,createRuntimeSupplierOperationHandler} from './supplier-acquisition-http'
import {supplierChildIdempotencyKey,type SrmSupplierApi} from './supplier-api-composition'
import {readSrmNativeSupplierConfiguration} from './supplier-native-runtime'
import {readSrmPrivateReportConfiguration} from './private-runtime'
import {IdentityConfigurationUnavailable} from './identity-runtime'
import targets from '../../deployment/supplier-native-targets.json'
import privateTargets from '../../deployment/private-runtime-targets.json'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',nip='8650004194',origin='http://localhost:3400'
const key='synthetic-logical-http-request-001'
const section={status:'EMPTY',retrievedAt:new Date().toISOString(),effectiveAt:null,data:null,warnings:[]}
function fixture(){
 const calls:{kind:string;input:unknown}[]=[]
 let known=false,deny:string|null=null
 const capture=(kind:string,input:unknown)=>{calls.push({kind,input});if(deny)throw new OperationDenied(deny as 'PERMISSION_DENIED')}
 const api={
  known:async(input:unknown)=>{capture('known',input);return known},
  company:async(input:unknown)=>{capture('company',input);return Response.json({identity:{nip,krs:null,name:null},general:section,financial:section,kys:{...section,status:'NOT_REQUESTED'}})},
  jdg:async(input:unknown)=>{capture('jdg',input);return Response.json({section,privateReport:null})},
  kys:async(input:unknown,entityType:string)=>{capture('kys:'+entityType,input);return Response.json({section,privateReport:null})},
  reveal:async(input:unknown,token:string)=>{capture('reveal',{input,token});return Response.json({pesel:null})},
  pdf:async(input:unknown,body:unknown)=>{capture('pdf',{input,body});return new Response('%PDF-SYNTHETIC',{headers:{'content-type':'application/pdf'}})},
 } as unknown as SrmSupplierApi
 return {api,calls,setKnown:(value:boolean)=>{known=value},setDeny:(value:string)=>{deny=value}}
}
function request(body:unknown={identifier:nip},changes:Record<string,string>={},query=''){
 return new Request(origin+'/api/xray/test'+query,{method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':key,...changes},body:JSON.stringify(body)})
}
test('MGBI routing reads the protected catalog first and does not reclassify a selected company',async()=>{
 const f=fixture(),handler=createSrmSupplierOperationHandler('search',f.api,A)
 assert.equal((await handler(request())).status,404);assert.deepEqual(f.calls.map(v=>v.kind),['known','jdg','company'])
 f.calls.length=0;f.setKnown(true)
 assert.equal((await handler(request())).status,503);assert.deepEqual(f.calls.map(v=>v.kind),['known','company'])
})
test('server-selected KRS routing runs only after existing HTTP fences and preserves the logical command',async()=>{
 const f=fixture();let overrides=0
 const handler=createSrmSupplierOperationHandler('search',f.api,A,undefined,async input=>{
  overrides++;assert.equal(input.organisationId,A);assert.equal(input.command.nip,nip);assert.equal(input.idempotencyKey,key)
  return Response.json({entityType:'COMPANY',card:{identity:{nip}}})
 })
 assert.equal((await handler(request({identifier:nip,provider:'KRS'}))).status,400)
 assert.equal((await handler(request(undefined,{origin:'https://foreign.example'}))).status,403)
 assert.equal(overrides,0);assert.equal((await handler(request())).status,200);assert.equal(overrides,1);assert.deepEqual(f.calls,[])
})
test('all fixed private entry selections preserve organisation and logical retry key',async()=>{
 for(const [route,kind]of [['company-kys','kys:COMPANY'],['jdg-kys','kys:JDG'],['jdg','jdg']] as const){
  const f=fixture(),handler=createSrmSupplierOperationHandler(route,f.api,A),r=await handler(request(undefined,{},'?organisationId='+B))
  assert.equal(r.status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0].kind,kind)
  const input=f.calls[0].input as {organisationId:string;idempotencyKey:string;command:unknown}
  assert.equal(input.organisationId,B);assert.equal(input.idempotencyKey,key);assert.deepEqual(input.command,{kind:'SUPPLIER_REPORT',nip})
 }
 assert.equal(supplierChildIdempotencyKey(key,'JDG:jdg'),supplierChildIdempotencyKey(key,'JDG:jdg'))
 assert.notEqual(supplierChildIdempotencyKey(key,'JDG:jdg'),supplierChildIdempotencyKey(key,'JDG:kys'))
})
test('closed bounded bodies, origin, tenant and retry keys reject before any domain call',async()=>{
 const f=fixture(),handler=createSrmSupplierOperationHandler('jdg',f.api,A)
 for(const r of[request({identifier:nip,userId:A}),request({identifier:nip,organisationId:A}),request({identifier:nip,role:'OWNER'}),request({identifier:nip,provider:'CEIDG'}),request({identifier:'bad'}),request({identifier:'x'.repeat(3000)}),request(undefined,{origin:'https://foreign.example'}),request(undefined,{'idempotency-key':''}),request(undefined,{},'?organisationId=bad'),request(undefined,{},'?organisationId='+A+'&organisationId='+B),request(undefined,{},'?actorId='+A),request(undefined,{'content-type':'text/plain'})]){
  assert([400,403].includes((await handler(r)).status))
 }
 assert.equal(f.calls.length,0)
})
test('denials keep refusal status and private caching at every entry',async()=>{
 for(const [reason,status]of [['UNVERIFIED_IDENTITY',401],['PERMISSION_DENIED',403],['AUDIT_UNAVAILABLE',503],['DELIVERY_UNCERTAIN',503],['IDEMPOTENCY_CONFLICT',409],['LIMIT_EXCEEDED',429]] as const){
  const f=fixture();f.setDeny(reason);const r=await createSrmSupplierOperationHandler('company',f.api,A)(request())
  assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie, Authorization')
 }
})
test('private reveal and PDF use their distinct current operation paths and refuse identity fields',async()=>{
 const f=fixture(),reveal=createSrmSupplierOperationHandler('reveal',f.api,A)
 assert.equal((await reveal(request({token:'opaque-reference'}))).status,200)
 assert.equal((await reveal(request({token:'opaque-reference',userId:A}))).status,400)
 const pdf=createSrmSupplierOperationHandler('pdf',f.api,A),selection={nip,entityType:'COMPANY',retrievedAt:new Date().toISOString(),exportRef:'a'.repeat(64)}
 assert.equal((await pdf(request(selection))).headers.get('content-type'),'application/pdf')
 assert.equal((await pdf(request({...selection,snapshotId:A}))).status,400)
 assert.deepEqual(f.calls.map(v=>v.kind),['reveal','pdf'])
})
test('explicit Clerk runtime errors or missing native configuration never invoke legacy',async()=>{
 let legacy=0;const old=async()=>{legacy++;return new Response('legacy')}
 const unavailable=createRuntimeSupplierOperationHandler('jdg',old,()=>{throw Error('Bad explicit config')})
 assert.equal((await unavailable(request())).status,503)
 const incomplete=createRuntimeSupplierOperationHandler('jdg',old,()=>({provider:'clerk',defaultOrganisationId:A} as never))
 assert.equal((await incomplete(request())).status,503);assert.equal(legacy,0)
 assert.equal(await(await createRuntimeSupplierOperationHandler('jdg',old,()=>({provider:'legacy_demo'}))(request())).text(),'legacy');assert.equal(legacy,1)
})
function nativeEnvironment(){
 const issuer='https://identity-fixture.accounts.dev',base=privateTargets.environments.development
 const url=(role:string)=>'postgresql://'+role+':synthetic_fixture_only@'+base.hosts[0]+'/'+base.databaseName+'?sslmode=require&channel_binding=require'
 return {PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',APP_ENV:'development',
  PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from(new URL(issuer).host+'$').toString('base64url'),
  PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:'["https://app.fixture.test"]',
  PROFITIA_PRIVATE_DATABASE_URL:url(base.runtimeRole),PROFITIA_FIXED_ORGANISATION_ID:A,
  PROFITIA_OPERATION_CONFIGURATION_VERSION:privateTargets.configurationVersion,RENDER_SERVICE_ID:base.serviceId,
  RENDER_GIT_COMMIT:'a'.repeat(40),SRM_DEMO_SESSION_SECRET:'synthetic_native_reference_secret_32_characters',
  PROFITIA_SUPPLIER_API_ENABLED:'true',PROFITIA_SUPPLIER_API_CONFIGURATION_VERSION:targets.configurationVersion,
  PROFITIA_SUPPLIER_JOBS_DATABASE_URL:url(targets.runtimeRoles.jobs),PROFITIA_SUPPLIER_SOURCE_DATABASE_URL:url(targets.runtimeRoles.providerSource),
  PROFITIA_CORPORATE_SOURCE_DATABASE_URL:url(targets.runtimeRoles.corporateSource),
  MGBI_API_KEY:'synthetic-native-mgbi',CEIDG_API_KEY:'synthetic-native-ceidg',VERCLY_API_KEY:'synthetic-native-vercly',VERCLY_API_BASE_URL:'https://provider.fixture.test'}
}
test('native supplier runtime is explicit Development intent with three distinct ordinary role connections',()=>{
 const env=nativeEnvironment(),base=readSrmPrivateReportConfiguration(env);assert.equal(base.provider,'clerk');if(base.provider!=='clerk')throw Error('Invalid fixture')
 const c=readSrmNativeSupplierConfiguration(base,env);assert(c)
 assert.equal(c.configurationVersion,targets.configurationVersion);assert.equal(new URL(c.jobsUrl).username,targets.runtimeRoles.jobs)
 assert.equal(new URL(c.providerSourceUrl).username,targets.runtimeRoles.providerSource);assert.equal(new URL(c.corporateSourceUrl).username,targets.runtimeRoles.corporateSource)
 assert.equal(readSrmNativeSupplierConfiguration(base,{...env,PROFITIA_SUPPLIER_API_ENABLED:'false'}),undefined)
 assert.equal(readSrmNativeSupplierConfiguration(base,{...env,PROFITIA_SUPPLIER_API_ENABLED:undefined}),undefined)
 assert.throws(()=>readSrmPrivateReportConfiguration({PROFITIA_SUPPLIER_API_ENABLED:'true'}),IdentityConfigurationUnavailable)
 for(const patch of[
  {PROFITIA_SUPPLIER_API_ENABLED:'TRUE'},{PROFITIA_SUPPLIER_API_CONFIGURATION_VERSION:'unknown'},
  {RENDER_SERVICE_ID:'foreign-service'},{RENDER_GIT_COMMIT:'main'},
  {PROFITIA_SUPPLIER_JOBS_DATABASE_URL:env.PROFITIA_PRIVATE_DATABASE_URL},
  {PROFITIA_SUPPLIER_SOURCE_DATABASE_URL:env.PROFITIA_CORPORATE_SOURCE_DATABASE_URL},
  {PROFITIA_CORPORATE_SOURCE_DATABASE_URL:env.PROFITIA_SUPPLIER_SOURCE_DATABASE_URL},
  {PROFITIA_SUPPLIER_JOBS_DATABASE_URL:env.PROFITIA_SUPPLIER_JOBS_DATABASE_URL.replace('sslmode=require','sslmode=disable')},
  {PROFITIA_SUPPLIER_JOBS_DATABASE_URL:env.PROFITIA_SUPPLIER_JOBS_DATABASE_URL+'&options=-c%20role%3Dneondb_owner'},
  {PROFITIA_SUPPLIER_JOBS_DATABASE_URL:env.PROFITIA_SUPPLIER_JOBS_DATABASE_URL.replace('platform_private','srm_pmos')},
  {VERCLY_API_BASE_URL:'http://127.0.0.1'},{VERCLY_API_BASE_URL:'https://provider.fixture.test/private-path'},{MGBI_API_KEY:''},{CEIDG_API_KEY:''},
 ]){
  assert.throws(()=>readSrmNativeSupplierConfiguration(base,{...env,...patch}),e=>e instanceof IdentityConfigurationUnavailable&&!e.message.includes('synthetic'))
 }
})
