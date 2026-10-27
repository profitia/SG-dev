import assert from 'node:assert/strict'
import test from 'node:test'
import {readSrmLocationGeocodingConfiguration,LOCATION_GEOCODING_VERSION,querySrmGeocodingTransaction} from './supplier-location-geocoding-runtime'
import type {PoolClient} from 'pg'
import type {Configuration} from './supplier-native-runtime'
import targets from '../../deployment/supplier-location-targets.json'
import {createSupplierLocationHandler,type SupplierLocationRuntime} from './supplier-locations'
const config={base:{application:{appId:'srm',environment:'development'},binding:{projectId:targets.projectId,branchId:targets.branchId}},referenceSecret:'synthetic-reference-'.repeat(3)} as Configuration
const env={RENDER_SERVICE_ID:targets.serviceId,PROFITIA_SUPPLIER_LOCATION_GEOCODING_VERSION:LOCATION_GEOCODING_VERSION,GOOGLE_GEOCODING_API_KEY:'synthetic-only'}
test('Source control writes stay on the exact admitted transaction and preserve its failure',async()=>{
 const sql='SELECT profitia_external_call.apply_control($1::uuid,$2::uuid,$3) AS control',values=['effect','decision','envelope']
 const failure=new Error('admitted transaction rolled back')
 let first=0,second=0
 const a={query:async(statement:string,parameters:unknown[])=>{first++;assert.equal(statement,sql);assert.equal(parameters,values);return{rows:[{control:'first'}]}}} as unknown as PoolClient
 const b={query:async(statement:string,parameters:unknown[])=>{second++;assert.equal(statement,sql);assert.equal(parameters,values);throw failure}} as unknown as PoolClient
 assert.deepEqual(await querySrmGeocodingTransaction(a,sql,values),{rows:[{control:'first'}]})
 await assert.rejects(querySrmGeocodingTransaction(b,sql,values),error=>error===failure)
 assert.equal(first,1);assert.equal(second,1)
})
test('a key alone cannot activate geocoding, and only the main registered Development target is eligible',()=>{
 assert.equal(readSrmLocationGeocodingConfiguration({GOOGLE_GEOCODING_API_KEY:'synthetic-only'},true,config),undefined)
 assert.equal(readSrmLocationGeocodingConfiguration(env,true,config)?.apiKey,'synthetic-only')
 for(const candidate of[{...env,GOOGLE_GEOCODING_API_KEY:''},{...env,RENDER_SERVICE_ID:'pilot-or-stage'},{...env,PROFITIA_SUPPLIER_LOCATION_GEOCODING_VERSION:'unaccepted'}])assert.throws(()=>readSrmLocationGeocodingConfiguration(candidate,true,config))
 assert.throws(()=>readSrmLocationGeocodingConfiguration(env,false,config));assert.throws(()=>readSrmLocationGeocodingConfiguration(env,true,{...config,runtimeRoles:{} as NonNullable<Configuration['runtimeRoles']>}))
})
test('the protected same-origin route accepts IDs only and cannot become a public address/key proxy',async()=>{
 const org='11111111-1111-4111-8111-111111111111',supplier='22222222-2222-4222-8222-222222222222',location='33333333-3333-4333-8333-333333333333'
 let calls=0
 const handler=createSupplierLocationHandler({} as SupplierLocationRuntime,org,{resolve:async input=>{calls++;assert.equal(input.organisationId,org);assert.equal(input.locationId,location);return{status:'UNRESOLVED'}}})
 const send=(body:unknown,origin='https://srm.fixture.test')=>handler(new Request('https://srm.fixture.test/api/supplier-locations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}))
 const body={action:'GEOCODE',supplierId:supplier,locationId:location}
 assert.equal((await send(body)).status,200)
 for(const extra of[{address:'arbitrary'},{apiKey:'arbitrary'},{organisationId:org},{expectedVersion:'1'}])assert.equal((await send({...body,...extra})).status,400)
 assert.equal((await send(body,'https://foreign.fixture.test')).status,403);assert.equal(calls,1)
 const disabled=createSupplierLocationHandler({} as SupplierLocationRuntime,org)
 const response=await disabled(new Request('https://srm.fixture.test/api/supplier-locations',{method:'POST',headers:{Origin:'https://srm.fixture.test','Content-Type':'application/json'},body:JSON.stringify(body)}))
 assert.deepEqual(await response.json(),{status:'WAITING_OWNER',paidCalls:0})
})

test('geocoding adoption preserves all previous receipts and pins the exact unchanged Maps producer',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{createHash}=await import('node:crypto')
 const receipt=JSON.parse(readFileSync(new URL('../../operation-integration.json',import.meta.url),'utf8')),a=receipt.supplierMapGeocodingActivation
 const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual(receipt[key],value,key)
 const current=receipt.supplierMapGeocodingTransactionRepair??a
 if(current!==a){
  const prior=execFileSync('git',['show',current.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
  assert.equal(hash(prior),current.previousReceiptDigest)
  for(const[key,value]of Object.entries(JSON.parse(prior.toString())))assert.deepEqual(receipt[key],value,key)
  assert.equal(current.sourceControlQuery,'EXACT_ADMITTED_TRANSACTION');assert.equal(current.automaticUncertainRetry,false)
 }
 for(const[file,digest]of Object.entries({...a.applicationSourceDigests,...current.applicationSourceDigests}))assert.equal(hash(readFileSync(new URL('../../'+file,import.meta.url))),digest,file)
 for(const[file,digest]of Object.entries(a.mapsProducerDigests))assert.equal(hash(readFileSync(new URL('../../../maps-runtime/'+file,import.meta.url))),digest,file)
 assert.equal(a.googlePersistence,'ACTIVE_VIEW_MEMORY_ONLY');assert.equal(a.mgbiOrSearchChanged,false);assert.equal(a.sharedSdkChanged,false)
})
