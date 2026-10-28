import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OperationDenied, type OperationContext, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { CATEGORY_HEADERS, categoryOperation, categoryResourceId, projectCategoryResponse, readCategoryOperation } from '../lib/category/operation-contract'
import { createOperationCategoryCollectionHandlers, createOperationCategoryDetailHandlers } from '../lib/category/operation-handlers'
import { createRuntimeCategoryCollectionHandlers, createRuntimeCategoryDetailHandlers } from '../lib/category/runtime-handlers'
import type { Sg2SelectionRuntime } from '../lib/platform/private-runtime'
import { GET as deployedGET, POST as deployedPOST } from '../app/api/category/route'
import { GET as deployedDetailGET, PATCH as deployedPATCH } from '../app/api/category/[categoryId]/route'

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222'
const category='synthetic-category', correlation='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const now='2026-10-17T00:00:00.000Z', authorization='Bearer synthetic_session'
const input=(method='GET', query='', body?: unknown, headers: Record<string,string>={}) => new NextRequest(`http://localhost:3001/api/category${query}`,{
  method,headers:{authorization,'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
const body=()=>({name:'Synthetic category',components:[{name:'Source',businessBenchmarkId:'synthetic-reference',weightPercent:40}]})
const selected={action:'detail',categoryId:category,body:null}
const context={organisationId:A,operation:'category.read',resourceId:`category:${category}`,payload:selected,correlationId:correlation} as unknown as Readonly<OperationContext>
const record=()=>({id:category,organizationId:A,name:'Synthetic category',status:'DRAFT',componentCount:1,allocatedPercent:40,remainingPercent:60,
  createdAt:now,updatedAt:now,components:[{id:'synthetic-component',name:'Source',position:0,weightPercent:40,benchmark:{businessBenchmarkId:'synthetic-reference',displayName:'Stored reference',
    provider:{providerCode:'MACROBOND',displayName:'Stored provider'},providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Stored provider'},providerSeriesId:'synthetic-series',providerSeriesKey:null},
    frequency:'monthly',currency:'PLN',unit:'PLN',source:'Stored source'}}]})
const response=(value: unknown=record(), status=200)=>Response.json(value,{status,headers:CATEGORY_HEADERS})
function capture() {
  const calls: Parameters<OperationExecutor<Prisma.TransactionClient>['execute']>[0][]=[]
  const executor={execute:async(value: Parameters<OperationExecutor<Prisma.TransactionClient>['execute']>[0])=>{calls.push(value);throw new OperationDenied('PERMISSION_DENIED')}} as unknown as OperationExecutor<Prisma.TransactionClient>
  return {calls,executor}
}

test('category action, resource and body form a closed representation without caller identity or operation overrides',()=>{
  assert.equal(categoryOperation(readCategoryOperation(selected)),'category.read')
  assert.equal(categoryResourceId(readCategoryOperation(selected),A),`category:${category}`)
  assert.equal(categoryResourceId(readCategoryOperation({action:'list',categoryId:null,body:null}),A),`categories:${A}`)
  const parsed=readCategoryOperation({action:'create',categoryId:A,body:{name:'  Category  ',components:[{name:'  Source  ',businessBenchmarkId:' synthetic-reference ',weightPercent:'40'}]}})
  assert.equal(categoryOperation(parsed),'category.write');if(parsed.action==='create'){assert.equal(parsed.body.name,'Category');assert.equal(parsed.body.components[0].businessBenchmarkId,'synthetic-reference');assert.equal(parsed.body.components[0].weightPercent,40)}
  for(const value of [null,[],{...selected,organisationId:B},{...selected,role:'owner'},{...selected,operation:'category.write'},
    {...selected,action:'export'},{action:'create',categoryId:'caller-selected',body:body()},
    {action:'create',categoryId:A,body:{...body(),userId:B}},
    {action:'create',categoryId:A,body:{name:'Bad',components:[{...body().components[0],weightPercent:90},{...body().components[0],weightPercent:40}]}},
    {action:'update',categoryId:'unsafe/path',body:body()}])assert.throws(()=>readCategoryOperation(value))
})
test('native HTTP captures one authentication header and canonical input, while SDK never receives cookies or caller authority',async()=>{
  const {executor,calls}=capture(), collection=createOperationCategoryCollectionHandlers(executor,A), detail=createOperationCategoryDetailHandlers(executor,A)
  const headers={Cookie:'legacy-session','x-clerk-user-id':B,'x-clerk-org-id':B,'x-clerk-org-role':'owner'}
  assert.equal((await collection.GET(input('GET','',undefined,headers))).status,403)
  assert.equal((await collection.POST(input('POST','',body(),headers))).status,403)
  assert.equal((await detail.GET(input(),{params:{categoryId:category}})).status,403)
  assert.equal((await detail.PATCH(input('PATCH','',body()),{params:{categoryId:category}})).status,403)
  assert.equal(calls.length,4);assert.deepEqual(calls.map(x=>x.operation),['category.read','category.write','category.read','category.write'])
  for(const call of calls){assert.equal(call.organisationId,A);assert.deepEqual([...(call.request as Request).headers],[['authorization',authorization]])}
  assert.equal(calls[0].resourceId,`categories:${A}`);assert.equal(calls[2].resourceId,`category:${category}`)
  const created=calls[1].payload as {categoryId:string;action:string};assert.equal(created.action,'create');assert.match(created.categoryId,/^[a-f0-9-]{36}$/);assert.equal(calls[1].resourceId,`category:${created.categoryId}`)
})
test('missing authentication, unknown query, duplicate or invalid organisation, malformed route and oversized input stop before execution',async()=>{
  const {executor,calls}=capture(),collection=createOperationCategoryCollectionHandlers(executor,A),detail=createOperationCategoryDetailHandlers(executor,A)
  assert.equal((await collection.GET(input('GET','',undefined,{authorization:''}))).status,401)
  for(const query of ['?role=owner','?organisationId=',`?organisationId=${A}&organisationId=${B}`])assert.equal((await collection.GET(input('GET',query))).status,400)
  assert.equal((await collection.GET(input('POST'))).status,405)
  assert.equal((await detail.GET(input(),{params:{categoryId:'wrong/path'}})).status,400)
  assert.equal((await detail.PATCH(input('PATCH','',body()))).status,400)
  assert.equal((await collection.POST(input('POST','',{...body(),organizationId:B}))).status,400)
  assert.equal((await collection.POST(input('POST','',{...body(),name:'x'.repeat(33000)}))).status,400)
  assert.equal(calls.length,0)
})
test('category ingress preserves only the actual proxy authority and the common boundary rejects foreign or forged hosts',async()=>{
  const {createPublicIdentityRequestBoundary}=await import('@profitia/platform-contracts/public-request')
  const normalize=createPublicIdentityRequestBoundary({publicOrigins:['https://dev-sg2.spendguru.app'],internalOrigins:['http://localhost:3001']})
  const received:Request[]=[]
  const executor={execute:async(value:Parameters<OperationExecutor<Prisma.TransactionClient>['execute']>[0])=>{
    const normalized=normalize(value.request as Request)
    if(!normalized)throw new OperationDenied('UNVERIFIED_IDENTITY')
    received.push(normalized);throw new OperationDenied('PERMISSION_DENIED')
  }} as unknown as OperationExecutor<Prisma.TransactionClient>
  const collection=createOperationCategoryCollectionHandlers(executor,A),detail=createOperationCategoryDetailHandlers(executor,A)
  const headers={host:'dev-sg2.spendguru.app',origin:'https://dev-sg2.spendguru.app',cookie:'legacy-session',
    'x-forwarded-host':'foreign.example.test','x-forwarded-proto':'http','x-clerk-user-id':B,'x-clerk-org-id':B}
  const proxyDetail=(method:string,value?:unknown)=>new Request(`http://localhost:3001/api/category/${category}`,{
    method,headers:{...headers,authorization,'content-type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})})
  assert.equal((await collection.GET(input('GET','',undefined,headers))).status,403)
  assert.equal((await collection.POST(input('POST','',body(),headers))).status,403)
  assert.equal((await detail.GET(proxyDetail('GET'),{params:{categoryId:category}})).status,403)
  assert.equal((await detail.PATCH(proxyDetail('PATCH',body()),{params:{categoryId:category}})).status,403)
  assert.equal(received.length,4)
  for(const [index,request] of received.entries()){
    assert.equal(request.url,'https://dev-sg2.spendguru.app/api/category'+(index>=2?'/'+category:''))
    assert.deepEqual([...request.headers],[['authorization',authorization],['host','dev-sg2.spendguru.app'],['origin','https://dev-sg2.spendguru.app']])
  }
  for(const invalid of [{...headers,host:'foreign.example.test'},{...headers,origin:'https://foreign.example.test'},
    {'x-forwarded-host':'dev-sg2.spendguru.app','x-forwarded-proto':'https'}])
    assert.equal((await collection.GET(input('GET','',undefined,invalid))).status,401)
  assert.equal(received.length,4)
})
test('actual body stream is bounded and cancelled instead of trusting a short declared length',async()=>{
  const {executor,calls}=capture(), collection=createOperationCategoryCollectionHandlers(executor,A);let cancelled=false
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(20000));controller.enqueue(new Uint8Array(20000))},cancel(){cancelled=true}})
  const request=new Request('http://localhost:3001/api/category',{method:'POST',headers:{authorization,'content-type':'application/json','content-length':'1'},body:stream,duplex:'half'} as RequestInit)
  assert.equal((await collection.POST(request)).status,400);assert.equal(cancelled,true);assert.equal(calls.length,0)
})
test('category output binds its exact owner and resource, sums and status, without private or unexpected nested fields',async()=>{
  const original=response();assert.equal(await projectCategoryResponse(original,context),original)
  const ownList={...context,payload:{action:'list',categoryId:null,body:null},resourceId:`categories:${A}`}
  assert.equal((await projectCategoryResponse(response({items:[]}),ownList)).status,200)
  for(const value of [{...record(),organizationId:B},{...record(),id:'foreign'},{...record(),createdByUserId:B},
    {...record(),status:'READY'},{...record(),allocatedPercent:100},{...record(),remainingPercent:0},
    {...record(),components:[{...record().components[0],privateSnapshot:'unapproved'}]},
    {...record(),components:[{...record().components[0],benchmark:{...record().components[0].benchmark,apiKey:'unapproved'}}]}])await assert.rejects(projectCategoryResponse(response(value),context))
  await assert.rejects(projectCategoryResponse(response({items:[],organizationId:A}),ownList))
  await assert.rejects(projectCategoryResponse(response(),{...context,resourceId:'category:foreign'}))
  for(const headers of [{'cache-control':'public'},{vary:'Cookie'},{'set-cookie':'unapproved'},{'content-type':'text/html'},{'x-upstream':'unapproved'}]){
    const result=response();for(const[key,value]of Object.entries(headers))result.headers.set(key,value);await assert.rejects(projectCategoryResponse(result,context))
  }
  await assert.rejects(projectCategoryResponse(response({error:'Not found'},404),context),'A failed business operation must roll back instead of passing a successful outcome boundary')
})
test('runtime category capability must be explicit; configuration failures never fall back to legacy business code',async()=>{
  let legacyCalls=0
  const legacyCollection={GET:async()=>{legacyCalls++;return NextResponse.json({legacy:true})},POST:async()=>{legacyCalls++;return NextResponse.json({legacy:true})}}
  const legacyDetail={GET:legacyCollection.GET,PATCH:legacyCollection.POST}
  for(const resolve of [()=>{throw Error('hidden private configuration')},()=>({provider:'unknown'} as unknown as Sg2SelectionRuntime),
    ()=>({provider:'clerk',executor:capture().executor,defaultOrganisationId:A} as Sg2SelectionRuntime)]){
    for(const response of [await createRuntimeCategoryCollectionHandlers(resolve,legacyCollection).GET(input()),await createRuntimeCategoryDetailHandlers(resolve,legacyDetail).GET(input(),{params:{categoryId:category}})]){
      assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Operation unavailable'});assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie, Authorization')
    }
  }
  assert.equal(legacyCalls,0)
  assert.equal((await createRuntimeCategoryCollectionHandlers(()=>({provider:'legacy_demo'}),legacyCollection).GET(input())).status,200)
  assert.equal((await createRuntimeCategoryDetailHandlers(()=>({provider:'legacy_demo'}),legacyDetail).GET(input(),{params:{categoryId:category}})).status,200)
  assert.equal(legacyCalls,2)
})
test('the actual four deployed route exports refuse incomplete private configuration without invoking demo or raw diagnostics',async()=>{
  const previous=process.env.PROFITIA_AUTH_PROVIDER;process.env.PROFITIA_AUTH_PROVIDER='clerk'
  try{for(const handler of [deployedGET,deployedPOST,deployedDetailGET,deployedPATCH]){
    const result=await handler(input(),{params:{categoryId:category}});assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'Operation unavailable'})
  }}finally{if(previous===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=previous}
})

test('category presentation uses a fresh credential for every exact native operation without forwarding cookies', async () => {
  const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
  let issued=0;const calls:Array<{path:string;init:RequestInit}>=[]
  const request=createCategoryOperationRequester({mode:()=> 'clerk',origin:()=> 'https://dev-sg2.spendguru.app',
    getToken:async()=> `${++issued}.payload.signature`,fetch:async(path,init)=>{calls.push({path:String(path),init:init!});return Response.json({ok:true})}})
  for(const path of ['/api/category','/api/category/one','/api/benchmark/selection'])await request(path)
  for(const [path,method]of [['/api/category','POST'],['/api/category/one','PATCH']])
    await request(path,{method,headers:{'Content-Type':'application/json'},body:'{}'})
  assert.equal(issued,5);assert.equal(calls.length,5)
  for(const [i,{init}]of calls.entries()){
    assert.equal(new Headers(init.headers).get('authorization'),`Bearer ${i+1}.payload.signature`)
    assert.equal(new Headers(init.headers).get('cookie'),null);assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store')
    assert.equal(init.redirect,'manual');assert.equal(init.referrerPolicy,'no-referrer')
  }
  request.close()
})

test('category transport refuses foreign, unadopted and credential-tainted selections before reading the session', async () => {
  const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
  let issued=0,network=0
  const request=createCategoryOperationRequester({mode:()=> 'clerk',origin:()=> 'https://dev-sg2.spendguru.app',
    getToken:async()=>{issued++;return 'synthetic.payload.signature'},fetch:async()=>{network++;return Response.json({ok:true})}})
  for(const path of ['https://foreign.example.test/api/category','//foreign.example.test/api/category','/api/category?organisationId=other',
    '/api/category#fragment','/api/category/ai-suggestions','/api/category/a/child','/api/category/%2e%2e','/api/category/../category','/api/category?x=1'])
    await assert.rejects(request(path))
  for(const init of [{method:'DELETE'},{headers:{Authorization:'Bearer synthetic_session'}},{headers:{Cookie:'synthetic_session'}},
    {headers:{'x-organisation-id':'forged'}},{method:'POST',body:'{}'},{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(32769)}])
    await assert.rejects(request('/api/category',init))
  assert.equal(issued,0);assert.equal(network,0);request.close()
})

test('unavailable mode or absent/invalid session never falls back to demo authentication', async () => {
  const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
  let network=0
  for(const mode of ['unavailable','clerk'] as const)for(const token of [null,'not-a-session','x'.repeat(8193)]){
    const request=createCategoryOperationRequester({mode:()=>mode,origin:()=> 'https://dev-sg2.spendguru.app',getToken:async()=>token,
      fetch:async()=>{network++;return Response.json({ok:true})}})
    await assert.rejects(request('/api/category'));request.close()
  }
  assert.equal(network,0)
})

test('closing category presentation during session acquisition prevents a stale request from being sent', async () => {
  const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
  let finish!:(token:string)=>void,network=0
  const credential=new Promise<string>(resolve=>{finish=resolve})
  const request=createCategoryOperationRequester({mode:()=> 'clerk',origin:()=> 'https://dev-sg2.spendguru.app',getToken:()=>credential,
    fetch:async()=>{network++;return Response.json({ok:true})}})
  const pending=request('/api/category');request.close();finish('synthetic.payload.signature')
  await assert.rejects(pending,error=>error instanceof Error&&error.name==='AbortError')
  await assert.rejects(request('/api/category'));assert.equal(network,0)
})

test('closing category presentation aborts an in-flight native operation; legacy transport remains explicit', async () => {
  const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
  let started!:()=>void;const sent=new Promise<void>(resolve=>{started=resolve})
  const request=createCategoryOperationRequester({mode:()=> 'clerk',origin:()=> 'https://dev-sg2.spendguru.app',getToken:async()=> 'synthetic.payload.signature',
    fetch:async(_path,init)=>{started();return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('Synthetic abort','AbortError')),{once:true}))}})
  const pending=request('/api/category');await sent;request.close();await assert.rejects(pending,error=>error instanceof Error&&error.name==='AbortError')
  let issued=0;const init={method:'GET'},legacy=createCategoryOperationRequester({mode:()=> 'legacy_demo',origin:()=> 'https://dev-sg2.spendguru.app',
    getToken:async()=>{issued++;return null},fetch:async(path,options)=>{assert.equal(path,'/api/category');assert.strictEqual(options,init);return Response.json({legacy:true})}})
  assert.deepEqual(await(await legacy('/api/category',init)).json(),{legacy:true});assert.equal(issued,0);legacy.close()
})

test('category transport adoption preserves earlier acceptance and pins its complete receiver closure', async () => {
  const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{createHash}=await import('node:crypto')
  const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url),'utf8')),current=receipt.categoryTransportAdoption
  assert.equal(current.taskId,'SG2-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020');assert.equal(current.previousApplicationAuthority,'44f5868316981192b0d09f452d627d8d306d90bd')
  const previous=JSON.parse(execFileSync('git',['show',current.previousApplicationAuthority+':apps/sg-runtime/operation-integration.json'],{encoding:'utf8'}))
  for(const[key,value]of Object.entries(previous))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
  for(const path of Object.keys(previous.categoryShellAdoption.sourceDigests))assert(path in current.sourceDigests,path)
  for(const path of ['components/category-builder/category-operation-request.ts','components/category-builder/category-builder-client.tsx','tests/category-operation.test.ts'])assert(path in current.sourceDigests,path)
  for(const[path,digest]of Object.entries(current.sourceDigests)){
    const bytes=receipt.categoryIngressAdoption?execFileSync('git',['show',receipt.categoryIngressAdoption.previousApplicationAuthority+':apps/sg-runtime/'+path]):readFileSync(new URL('../'+path,import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,path)
  }
  assert.equal(current.productDeploymentPerformed,false)
})

test('category ingress reception preserves the accepted transport and pins the current complete receiver closure',async()=>{
  const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{createHash}=await import('node:crypto')
  const receipt=JSON.parse(readFileSync(new URL('../operation-integration.json',import.meta.url),'utf8')),current=receipt.categoryIngressAdoption
  assert.equal(current.taskId,'SG2-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020');assert.equal(current.previousApplicationAuthority,'b9d4e15b34751dd56596aa71a8b9e1e8fe8228db')
  const previous=JSON.parse(execFileSync('git',['show',current.previousApplicationAuthority+':apps/sg-runtime/operation-integration.json'],{encoding:'utf8'}))
  for(const[key,value]of Object.entries(previous))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
  for(const path of Object.keys(previous.categoryTransportAdoption.sourceDigests))assert(path in current.sourceDigests,path)
  for(const path of ['lib/category/operation-handlers.ts','tests/category-operation.test.ts'])assert(path in current.sourceDigests,path)
  for(const[path,digest]of Object.entries({...current.sourceDigests,...receipt.platform125SourceCompatibility.applicationSourceDigests, ...receipt.selfServiceAccountSourceCompatibility.applicationSourceDigests, ...receipt.accountRecheckSourceCompatibility.applicationSourceDigests, ...receipt.krsSoapSourceCompatibility?.applicationSourceDigests,...receipt.assistantAvatarSourceCompatibility.applicationSourceDigests, ...receipt.unmeteredSourceCompatibility.applicationSourceDigests,...receipt.formReportSourceCompatibility.applicationSourceDigests,...receipt.requestQuotaSourceCompatibility.applicationSourceDigests,...receipt.benchmarkPresentationSourceCompatibility.applicationSourceDigests,...receipt.nativeSqlRoundtripAdoption.applicationSourceDigests,...receipt.diagnosticTelemetryAdoption.applicationSourceDigests,...receipt.appShellSourceCompatibility.applicationSourceDigests,...receipt.assistantWidgetSourceCompatibility.applicationSourceDigests,...receipt.adpPresentationSourceCompatibility.applicationSourceDigests,...receipt.integratedBuyerJourneySourceCompatibility.applicationSourceDigests}))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),digest,path)
  assert.equal(current.productDeploymentPerformed,false)
})
