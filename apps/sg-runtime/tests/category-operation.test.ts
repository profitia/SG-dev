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
