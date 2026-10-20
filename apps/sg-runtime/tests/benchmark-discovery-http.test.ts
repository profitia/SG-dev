import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createDiscoveryHttpHandler} from '../lib/benchmark/discovery-http'
const org=randomUUID(),key='finder_'+randomUUID(),base='https://finder.fixture.test'
const rows=[['SEARCH','GET','/api/benchmark/search?q=steel&limit=8',null,{kind:'SEARCH',query:'steel',filters:[],limit:8}],
 ['SEARCH','POST','/api/benchmark/search',{query:'steel'},{kind:'SEARCH',query:'steel',filters:[],limit:8}],
 ['METADATA','GET','/api/benchmark/metadata',null,{kind:'METADATA'}],
 ['METADATA_VALUES','GET','/api/benchmark/metadata/Region/values?q=pol&limit=12',null,{kind:'METADATA_VALUES',metadataKey:'Region',query:'pol',filters:[],limit:12}],
 ['CONTEXT','POST','/api/benchmark/context',{seriesIds:['fixture']},{kind:'CONTEXT',seriesIds:['fixture']}],
 ['AI_SEARCH','POST','/api/benchmark/ai-search',{prompt:'steel price'},{kind:'AI_SEARCH',prompt:'steel price'}]] as const
function request(path:string,method:string,body:unknown=null,headers:Record<string,string>={}){
 return new Request(base+path,{method,headers:{authorization:'Bearer official-fixture','x-profitia-idempotency-key':key,...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})})
}
for(const[kind,method,path,body,expected]of rows)test(`exact original ${method} ${path} maps to a closed ${kind} command`,async()=>{
 let calls=0
 const handle=createDiscoveryHttpHandler(kind,method,()=>({provider:'clerk',defaultOrganisationId:org,benchmarkDiscovery:async()=>({execute:async(r,o,c,k)=>{calls++;assert.equal(r.url,base+path);assert.equal(o,org);assert.equal(k,key);assert.deepEqual(c,expected);return Response.json({items:[]})}})}),async()=>assert.fail('No demo fallback'))
 assert.equal((await handle(request(path,method,body))).status,200);assert.equal(calls,1)
})
test('wrong route, methods, identity, context injection and unbounded inputs are rejected before composition',async()=>{
 let calls=0
 const handler=createDiscoveryHttpHandler('SEARCH','POST',()=>({provider:'clerk',defaultOrganisationId:org,benchmarkDiscovery:async()=>{calls++;throw Error('Should not initialise')}}),async()=>assert.fail())
 for(const r of [request('/api/benchmark/search/extra','POST',{query:'steel'}),request('/api/benchmark/search','GET'),request('/api/benchmark/search','POST',{query:'steel'},{authorization:''}),request('/api/benchmark/search?actorId=forged','POST',{query:'steel'}),request('/api/benchmark/search?organisationId='+org+'&organisationId='+org,'POST',{query:'steel'}),request('/api/benchmark/search','POST',{query:'steel',organisationId:org}),request('/api/benchmark/search','POST',{kind:'SEARCH',query:'steel'}),request('/api/benchmark/search','POST',{query:'x'.repeat(20000)})])assert.ok((await handler(r)).status>=400)
 assert.equal(calls,0)
})
test('cookie-only metered GET and a substituted route parameter are refused',async()=>{
 let calls=0
 const handler=createDiscoveryHttpHandler('METADATA_VALUES','GET',()=>({provider:'clerk',defaultOrganisationId:org,benchmarkDiscovery:async()=>{calls++;throw Error()}}),async()=>assert.fail())
 assert.equal((await handler(request('/api/benchmark/metadata/Region/values','GET',null,{authorization:'',cookie:'ambient=session'}))).status,401)
 assert.equal((await handler(request('/api/benchmark/metadata/Region/values','GET'),{params:{metadataKey:'Other'}})).status,400);assert.equal(calls,0)
})
test('only explicit demo dispatches the old handler; incomplete individual mode remains private and unavailable',async()=>{
 let calls=0;const legacy=async()=>{calls++;return new Response('demo')}
 const r=request('/api/benchmark/metadata','GET')
 assert.equal(await(await createDiscoveryHttpHandler('METADATA','GET',()=>({provider:'legacy_demo'}),legacy)(r)).text(),'demo')
 const denied=await createDiscoveryHttpHandler('METADATA','GET',()=>({provider:'clerk',defaultOrganisationId:org}),legacy)(r)
 assert.equal(denied.status,503);assert.equal(denied.headers.get('cache-control'),'private, no-store');assert.equal(calls,1)
})
test('disabled configuration is lazy; enabled configuration pins actual environment, service, roles and endpoints',async()=>{
 const {readDiscoveryConfiguration}=await import('../lib/benchmark/discovery-runtime')
 assert.equal(readDiscoveryConfiguration({}),undefined)
 assert.throws(()=>readDiscoveryConfiguration({PROFITIA_BENCHMARK_DISCOVERY_ENABLED:'TRUE'}))
 const targets=(await import('../deployment/benchmark-discovery-targets.json')).default
 const connection=(target:{hosts:string[];databaseName:string;runtimeRole:string})=>`postgresql://${target.runtimeRole}:fixture-password@${target.hosts[0]}/${target.databaseName}?sslmode=require`
 const env={PROFITIA_BENCHMARK_DISCOVERY_ENABLED:'true',TARGET_ENVIRONMENT:'development',RENDER_SERVICE_ID:targets.serviceId,
  PROFITIA_BENCHMARK_DISCOVERY_CONFIGURATION_VERSION:targets.configurationVersion,
  PROFITIA_BENCHMARK_WORK_DATABASE_URL:connection({...targets.privateStore,runtimeRole:targets.nativeWork.runtimeRole}),
  PROFITIA_BENCHMARK_SOURCE_DATABASE_URL:connection(targets.source),PROFITIA_BENCHMARK_METADATA_DATABASE_URL:connection(targets.metadataRead)}
 assert.equal(readDiscoveryConfiguration(env)?.configurationVersion,targets.configurationVersion)
 for(const altered of[{TARGET_ENVIRONMENT:'staging'},{RENDER_SERVICE_ID:'another-service'},
  {PROFITIA_BENCHMARK_WORK_DATABASE_URL:env.PROFITIA_BENCHMARK_WORK_DATABASE_URL.replace(targets.nativeWork.runtimeRole,'neondb_owner')},
  {PROFITIA_BENCHMARK_METADATA_DATABASE_URL:env.PROFITIA_BENCHMARK_METADATA_DATABASE_URL.replace(targets.metadataRead.hosts[0],'attacker.invalid')},
  {MACROBOND_BASE_URL:'https://other.invalid'},{MACROBOND_CLIENT_ID:'unpaired'},
  {PROFITIA_BENCHMARK_DISCOVERY_CONFIGURATION_VERSION:'unaccepted-version'}])assert.throws(()=>readDiscoveryConfiguration({...env,...altered}))
})
