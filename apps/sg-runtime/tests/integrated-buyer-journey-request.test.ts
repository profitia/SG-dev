import assert from 'node:assert/strict'
import test from 'node:test'
import {createPciRequester} from '../components/price-change-index/price-change-index-request'

test('PCI uses the existing credential getter once per action, same-origin POST, no cookie or caller identity header',async()=>{
  let issued=0;const calls:RequestInit[]=[]
  const requester=createPciRequester({getToken:async()=>`${++issued}.payload.signature`,fetch:async(path,init)=>{assert.equal(path,'/api/cost-analysis/price-change-index');calls.push(init!);return Response.json({})}})
  await requester('{}');await requester('{}');assert.equal(issued,2)
  for(const [i,call]of calls.entries()){assert.equal(call.method,'POST');assert.equal(call.cache,'no-store');assert.equal(call.credentials,'omit');assert.equal(call.redirect,'error');assert.equal(new Headers(call.headers).get('authorization'),`Bearer ${i+1}.payload.signature`)}
  requester.close();await assert.rejects(requester('{}'))
})
test('closing while credentials or data are pending prevents old session results from publishing',async()=>{
  let resolve!:(value:string)=>void,network=0
  const credential=new Promise<string>(r=>{resolve=r}),requester=createPciRequester({getToken:()=>credential,fetch:async()=>{network++;return Response.json({})}})
  const pending=requester('{}');requester.close();resolve('synthetic.payload.signature');await assert.rejects(pending);assert.equal(network,0)
  let started!:()=>void;const ready=new Promise<void>(r=>{started=r})
  const second=createPciRequester({getToken:async()=>'synthetic.payload.signature',fetch:async(_path,init)=>{started();return new Promise<Response>((_,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))}})
  const request=second('{}');await ready;second.close();await assert.rejects(request)
})

test('category adapter carries explicit seed organisation only as a revalidated server selector',async()=>{
 const {createCategoryOperationRequester}=await import('../components/category-builder/category-operation-request')
 const paths:string[]=[]
 const organisationId='22222222-2222-4222-8222-222222222222'
 const requester=createCategoryOperationRequester({mode:()=> 'clerk',getToken:async()=> 'synthetic.payload.signature',origin:()=> 'https://example.test',organisationId:()=>organisationId,fetch:async(path)=>{paths.push(String(path));return Response.json({})}})
 await requester('/api/category',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
 assert.deepEqual(paths,['/api/category?organisationId='+organisationId])
 await assert.rejects(requester('/api/category?organisationId=forged'))
 const invalid=createCategoryOperationRequester({mode:()=> 'clerk',getToken:async()=> 'synthetic.payload.signature',origin:()=> 'https://example.test',organisationId:()=> 'forged',fetch:async()=>assert.fail('Invalid scope dispatched')})
 await assert.rejects(invalid('/api/category'))
})

 test('availability cancellation aborts only its own request and never a later calculation',async()=>{
 let resolve!:()=>void;const wait=new Promise<void>(r=>resolve=r),signals:AbortSignal[]=[]
 const request=createPciRequester({getToken:async()=> 'synthetic.payload.signature',fetch:async(_url,init)=>{signals.push(init!.signal!);await wait;return Response.json({})}})
 const abort=new AbortController(),old=request('{}',abort.signal).catch(e=>e.name)
 await new Promise(r=>setTimeout(r,0));abort.abort()
 const next=request('{}');await new Promise(r=>setTimeout(r,0));assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false)
 resolve();assert.equal(await old,'AbortError');assert.equal((await next).status,200);request.close()
 })

test('temporary missing credential does not poison the requester or dispatch an unauthorised action',async()=>{
 let token:string|null=null,sent=0
 const requester=createPciRequester({getToken:async()=>token,fetch:async()=>{sent++;return Response.json({})}})
 await assert.rejects(requester('{}'),/SESSION_UNAVAILABLE/);assert.equal(sent,0)
 token='synthetic.refreshed.signature';assert.equal((await requester('{}')).status,200);assert.equal(sent,1);requester.close()
})
