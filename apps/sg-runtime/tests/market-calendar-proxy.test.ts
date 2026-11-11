import test from 'node:test'
import assert from 'node:assert/strict'
import {createCalendarProxy} from '../lib/market-calendar/runtime'
const org='11111111-1111-4111-8111-111111111111',origin='https://dev-sg2.spendguru.app'
const headers={authorization:'Bearer SYNTHETIC_ONLY'},reply=(status=200)=>Response.json({contract:{id:'profitia.economic-calendar',version:'1.1.0'},items:[]},{status,headers:{'cache-control':'no-store'}})
test('calendar relay binds server organisation, forwards only the human bearer and preserves denial/no-store',async()=>{
 let seen:Request|null=null;const proxy=createCalendarProxy({organisationId:org,fetcher:async(input,options)=>{seen=new Request(input,options);return reply(403)}})
 const response=await proxy(new Request(origin+'/api/v1/market-calendar/events?limit=100',{headers:{...headers,'x-user-id':'FORGED','x-organisation-id':'FORGED'}}))
 assert.equal(response.status,403);assert(seen);const r=seen as Request;assert.equal(r.url,'https://economic-calendar-runtime-development.onrender.com/v1/organisations/'+org+'/calendar/events?limit=100');assert.deepEqual([...r.headers],Object.entries(headers));assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Authorization')
})
test('missing session, cookies, foreign origins, user scope substitution and acquisition paths never reach any provider',async()=>{
 let calls=0;const proxy=createCalendarProxy({organisationId:org,fetcher:async()=>{calls++;return reply()}})
 for(const r of [new Request(origin+'/api/v1/market-calendar/events'),new Request(origin+'/api/v1/market-calendar/events',{headers:{...headers,cookie:'SYNTHETIC'}}),new Request('https://foreign.test/api/v1/market-calendar/events',{headers}),new Request(origin+'/api/v1/market-calendar/sync',{method:'POST',headers}),new Request(origin+'/api/v1/market-calendar/events?userId=FORGED',{headers}),new Request(origin+'/api/v1/market-calendar/https://foreign.test',{headers})])assert((await proxy(r)).status>=400,r.url)
 assert.equal(calls,0)
})
test('preference body crosses Render ingress unchanged; oversized/foreign responses and redirect headers fail closed',async()=>{
 const body=JSON.stringify({expectedVersion:4,preferences:{publicationFavourites:[]}});let seen:Request|null=null
 const proxy=createCalendarProxy({organisationId:org,fetcher:async(input,options)=>{seen=new Request(input,options);return reply()}})
 const response=await proxy(new Request('https://localhost:10000/api/v1/market-calendar/preferences',{method:'PUT',headers:{...headers,host:'dev-sg2.spendguru.app',origin,'content-type':'application/json','x-forwarded-host':'forged'},body}))
 assert.equal(response.status,200);assert(seen);assert.equal(await(seen as Request).text(),body);assert.equal((seen as Request).headers.has('x-forwarded-host'),false)
 const bad=createCalendarProxy({organisationId:org,fetcher:async()=>Response.json({},{headers:{'cache-control':'public','set-cookie':'SYNTHETIC'}})})
 assert.equal((await bad(new Request(origin+'/api/v1/market-calendar/events',{headers}))).status,503)
 const big=createCalendarProxy({organisationId:org,fetcher:async()=>new Response('x'.repeat(2*1024*1024+1),{headers:{'cache-control':'no-store','content-type':'application/json'}})})
 assert.equal((await big(new Request(origin+'/api/v1/market-calendar/events',{headers}))).status,502)
})
