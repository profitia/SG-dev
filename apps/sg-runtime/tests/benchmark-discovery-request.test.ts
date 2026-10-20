import test from 'node:test'
import assert from 'node:assert/strict'
import {createDiscoveryRequester} from '../components/benchmark-finder/discovery-request'
const origin='https://finder.fixture.test'
function fixture(){
 const calls:Array<{input:unknown;init:RequestInit}>=[];let n=0,status=200,fail=false,token:string|null='official-fixture-session'
 const request=createDiscoveryRequester({mode:()=> 'clerk',getToken:async()=>token,origin:()=>origin,newKey:()=> 'finder_'+String(++n).padStart(16,'0'),
  fetch:async(input,init)=>{calls.push({input,init:init!});if(fail)throw Error('fixture lost reply');return Response.json({items:[]},{status})}})
 return {request,calls,status:(v:number)=>status=v,fail:(v:boolean)=>fail=v,token:(v:string|null)=>token=v}
}
test('all six Finder methods use the official credential, private caching and bounded logical keys',async()=>{
 const f=fixture()
 for(const [path,method]of[['/api/benchmark/search?q=steel','GET'],['/api/benchmark/search','POST'],['/api/benchmark/metadata','GET'],['/api/benchmark/metadata/Region/values?q=pol','GET'],['/api/benchmark/context','POST'],['/api/benchmark/ai-search','POST']]){
  await f.request(path,{method,...(method==='POST'?{body:JSON.stringify({query:'original body'}),headers:{'content-type':'application/json'}}:{})})
 }
 assert.equal(f.calls.length,6)
 for(const c of f.calls){const h=new Headers(c.init.headers);assert.equal(h.get('authorization'),'Bearer official-fixture-session');assert.match(h.get('x-profitia-idempotency-key')!,/^finder_\d{16}$/);assert.equal(c.init.cache,'no-store');assert.equal(c.init.redirect,'error');assert.equal(c.init.credentials,'same-origin')}
 assert.equal(f.calls[1].init.body,JSON.stringify({query:'original body'}))
})
test('lost, pending and refused replies keep their key; a successful completed logical request gets a new key',async()=>{
 const f=fixture(),path='/api/benchmark/search?q=private'
 f.fail(true);await assert.rejects(f.request(path));f.fail(false)
 f.status(202);await f.request(path);f.status(503);await f.request(path);f.status(200);await f.request(path);await f.request(path)
 const keys=f.calls.map(c=>new Headers(c.init.headers).get('x-profitia-idempotency-key'))
 assert.equal(new Set(keys.slice(0,4)).size,1);assert.notEqual(keys[3],keys[4])
})
test('cross-origin, lookalike, wrong method, caller credential and missing session never dispatch',async()=>{
 const f=fixture()
 for(const [path,init]of[['https://other.fixture.test/api/benchmark/search',{}],['/api/benchmark/search/extra',{}],['/api/benchmark/selection',{}],['/api/benchmark/search',{method:'DELETE'}],['/api/benchmark/search',{headers:{authorization:'Bearer forged'}}]] as const)await assert.rejects(f.request(path,init))
 f.token(null);await assert.rejects(f.request('/api/benchmark/metadata'));assert.equal(f.calls.length,0)
})
test('closing a user/session instance prevents a delayed credential from issuing work',async()=>{
 let release!:(v:string|null)=>void,hits=0
 const request=createDiscoveryRequester({mode:()=> 'clerk',getToken:()=>new Promise(resolve=>release=resolve),origin:()=>origin,newKey:()=> 'finder_'+ 'a'.repeat(16),fetch:async()=>{hits++;return new Response()}})
 const pending=request('/api/benchmark/metadata');request.close();release('later-session');await assert.rejects(pending);await assert.rejects(request('/api/benchmark/metadata'));assert.equal(hits,0)
})
test('legacy demo forwards the original request without new headers, keys or identity',async()=>{
 const init={cache:'no-store' as const},input='/api/benchmark/metadata';let called=false
 const request=createDiscoveryRequester({mode:()=> 'legacy_demo',getToken:async()=>assert.fail(),origin:()=>assert.fail(),newKey:()=>assert.fail(),fetch:async(i,o)=>{assert.equal(i,input);assert.equal(o,init);called=true;return new Response()}})
 await request(input,init);assert.equal(called,true)
})
