// SYNTHETIC_ONLY: actual ingress normalization; no session, E1 grant or provider call.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createPublishedReportReadRequest} from '../lib/assistant/published-report-request'
import {createPublicIdentityRequestBoundary} from '../../../packages/platform-contracts/src/public-request.mjs'
const normalize=createPublicIdentityRequestBoundary({publicOrigins:['https://dev-sg2.spendguru.app'],internalOrigins:['https://localhost:10000']})
const job='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
test('a consumed CIC POST becomes a bodyless report GET retaining the real Render ingress authority',async()=>{
 const request=new Request('https://localhost:10000/api/assistant/converse',{method:'POST',headers:{host:'dev-sg2.spendguru.app',origin:'https://dev-sg2.spendguru.app',authorization:'Bearer SYNTHETIC_ONLY','content-type':'application/json',cookie:'SYNTHETIC_COOKIE_ONLY','x-forwarded-host':'untrusted.example','x-forwarded-proto':'http'},body:JSON.stringify({message:'SYNTHETIC_ONLY'})})
 await request.json()
 const local=createPublishedReportReadRequest(request,job),publicRequest=normalize(local)
 assert.equal(local.method,'GET');assert.equal(local.body,null);assert(publicRequest)
 assert.equal(publicRequest.url,'https://dev-sg2.spendguru.app/api/v1/insights/subscriptions/editions/'+job)
 assert.equal(publicRequest.headers.get('authorization'),'Bearer SYNTHETIC_ONLY')
 assert.deepEqual([...local.headers.keys()].sort(),['authorization','host','origin'])
 assert.equal(local.headers.has('cookie'),false);assert.equal(local.headers.has('x-forwarded-host'),false)
})
test('unknown host, absent internal host and conflicting origin remain denied; forwarding cannot supply authority',()=>{
 for(const headers of [{authorization:'Bearer SYNTHETIC_ONLY','x-forwarded-host':'dev-sg2.spendguru.app'},{host:'untrusted.example','x-forwarded-host':'dev-sg2.spendguru.app'},{host:'dev-sg2.spendguru.app',origin:'https://untrusted.example'}])assert.equal(normalize(createPublishedReportReadRequest(new Request('https://localhost:10000/api/assistant/converse',{headers}),job)),null)
})
test('direct public requests and cancellation preserve the existing boundary behavior',()=>{
 const request=new Request('https://dev-sg2.spendguru.app/api/assistant/converse',{headers:{authorization:'Bearer SYNTHETIC_ONLY'}})
 assert.equal(normalize(createPublishedReportReadRequest(request,job))?.url,'https://dev-sg2.spendguru.app/api/v1/insights/subscriptions/editions/'+job)
 const cancelled=new AbortController(),local=createPublishedReportReadRequest(request,job,cancelled.signal);cancelled.abort();assert(local.signal.aborted);assert.equal(normalize(local),null)
})
