import test from 'node:test';import assert from 'node:assert/strict';
import {createNewsfeedProxy} from '../lib/newsfeed/runtime'
const org='11111111-1111-4111-8111-111111111111',origin='https://dev-sg2.spendguru.app'
test('proxy forwards only bearer and server organisation to the pinned Newsfeed origin',async()=>{
 let seen:Request|null=null
 const proxy=createNewsfeedProxy({organisationId:org,fetcher:async(input,options)=>{seen=new Request(input,options);return Response.json({items:[],nextCursor:null},{headers:{'set-cookie':'MUST_NOT_FORWARD','x-secret':'MUST_NOT_FORWARD'}})}})
 const response=await proxy(new Request(origin+'/api/v1/newsfeed/observations',{headers:{authorization:'Bearer SYNTHETIC_ONLY','x-profitia-organisation-id':'forged'}}))
 assert.equal(response.status,200);assert(seen);const request=seen as Request;assert.equal(request.url,'https://newsfeed-api-development.onrender.com/v1.2/observations');assert.equal(request.headers.get('x-profitia-organisation-id'),org);assert.equal(request.headers.get('authorization'),'Bearer SYNTHETIC_ONLY');assert(!response.headers.has('set-cookie'));assert(!response.headers.has('x-secret'));assert.equal(response.headers.get('cache-control'),'private, no-store')
})
test('proxy denies cookies, missing bearer, wrong origins and arbitrary destinations before network',async()=>{
 let calls=0;const proxy=createNewsfeedProxy({organisationId:org,fetcher:async()=>{calls++;throw Error('MUST_NOT_RUN')}})
 for(const request of [new Request(origin+'/api/v1/newsfeed/observations'),new Request(origin+'/api/v1/newsfeed/observations',{headers:{authorization:'Bearer SYNTHETIC',cookie:'private'}}),new Request('https://foreign.test/api/v1/newsfeed/observations',{headers:{authorization:'Bearer SYNTHETIC'}}),new Request(origin+'/api/v1/newsfeed/https://foreign.test',{headers:{authorization:'Bearer SYNTHETIC'}})])assert((await proxy(request)).status>=400)
 assert.equal(calls,0)
})
test('Render ingress preserves the body and ignores forged forwarded authority',async()=>{
 let seen:Request|null=null;const body='{"name":"SYNTHETIC_ONLY"}'
 const proxy=createNewsfeedProxy({organisationId:org,fetcher:async(input,options)=>{seen=new Request(input,options);return Response.json({id:'SYNTHETIC_ONLY'})}})
 const response=await proxy(new Request('https://localhost:10000/api/v1/newsfeed/observations',{method:'POST',headers:{host:'dev-sg2.spendguru.app',origin,authorization:'Bearer SYNTHETIC_ONLY','content-type':'application/json','x-forwarded-host':'foreign.test'},body}))
 assert.equal(response.status,200);assert(seen);assert.equal(await(seen as Request).text(),body);assert.equal((seen as Request).headers.has('x-forwarded-host'),false)
})
