import test from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {middleware} from './middleware'
import {PRESENTATION_ROUTES} from '@profitia/srm-xray/full-report-operations'

test('only exact presentation routes and methods reach their signed current HUMAN backend in Clerk mode',async()=>{
 const before=process.env.PROFITIA_AUTH_PROVIDER
 try{
  process.env.PROFITIA_AUTH_PROVIDER='clerk'
  for(const route of Object.values(PRESENTATION_ROUTES)){
   const admitted=await middleware(new NextRequest('https://srm.fixture.test'+route.path,{method:route.method}))
   assert.equal(admitted.headers.get('x-middleware-next'),'1',route.path)
   assert.equal(admitted.headers.get('cache-control'),'private, no-store')
   for(const [path,method] of [[route.path+'/extra',route.method],[route.path+'-extra',route.method],[route.path,route.method==='GET'?'POST':'GET']] as const){
    const denied=await middleware(new NextRequest('https://srm.fixture.test'+path,{method}))
    assert.equal(denied.status,401,path+' '+method)
    assert.equal(denied.headers.get('x-middleware-next'),null)
   }
  }
  for(const path of ['/api/xray/presentation','/api/xray/presentation/unknown','/api/xray/presentation/locations/','/api/xray/presentation/%6cocations']){
   assert.equal((await middleware(new NextRequest('https://srm.fixture.test'+path,{method:'POST'}))).status,401,path)
  }
  delete process.env.PROFITIA_AUTH_PROVIDER
  for(const route of Object.values(PRESENTATION_ROUTES))assert.equal((await middleware(new NextRequest('https://srm.fixture.test'+route.path,{method:route.method}))).status,401)
 }finally{if(before===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=before}
})

test('Clerk location entry delegates to its backend E1 boundary and admits no adjacent legacy entry',async()=>{
 const before=process.env.PROFITIA_AUTH_PROVIDER
 try{
  process.env.PROFITIA_AUTH_PROVIDER='clerk'
  const response=await middleware(new NextRequest('https://srm.fixture.test/api/supplier-locations',{method:'POST'}))
  assert.equal(response.headers.get('x-middleware-next'),'1')
  assert.equal(response.headers.get('cache-control'),'private, no-store')
  for(const path of ['/api/supplier-locations/extra','/api/supplier-locations-v2','/api/unadmitted']){
   const denied=await middleware(new NextRequest('https://srm.fixture.test'+path,{method:'POST'}))
   assert.equal(denied.status,401,path);assert.equal(denied.headers.get('x-middleware-next'),null,path)
  }
 }finally{if(before===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=before}
})
test('location entry does not enable Clerk admission in another authentication mode',async()=>{
 const before=process.env.PROFITIA_AUTH_PROVIDER
 try{delete process.env.PROFITIA_AUTH_PROVIDER;assert.equal((await middleware(new NextRequest('https://srm.fixture.test/api/supplier-locations',{method:'POST'}))).status,401)}
 finally{if(before===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=before}
})


test('report preparation reaches its own current HUMAN boundary only at the exact admitted entry',async()=>{
 const before=process.env.PROFITIA_AUTH_PROVIDER;try{
  process.env.PROFITIA_AUTH_PROVIDER='clerk';assert.equal((await middleware(new NextRequest('https://srm.fixture.test/api/xray/admission',{method:'POST'}))).headers.get('x-middleware-next'),'1');
  for(const path of ['/api/xray/admission/extra','/api/xray/admission-v2'])assert.equal((await middleware(new NextRequest('https://srm.fixture.test'+path,{method:'POST'}))).status,401);
  delete process.env.PROFITIA_AUTH_PROVIDER;assert.equal((await middleware(new NextRequest('https://srm.fixture.test/api/xray/admission',{method:'POST'}))).status,401);
 }finally{if(before===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=before}
});
