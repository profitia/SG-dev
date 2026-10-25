import test from 'node:test'
import assert from 'node:assert/strict'
import {createPilot2PrivateRoutes} from './pilot2-private-runtime'
import type {SrmSupplierApi} from './supplier-api-composition'
const org='11111111-1111-4111-8111-111111111111'
test('Private PILOT2 entrances reject captured report grants and remain closed before explicit stage activation',async()=>{
 let calls=0
 const api={reveal:async()=>{calls++;return Response.json({})}} as unknown as SrmSupplierApi
 const request=(extra:Record<string,string>={})=>new Request('http://localhost/api/xray/kys/pesel',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json',...extra},body:JSON.stringify({token:'opaque'})})
 assert.throws(()=>createPilot2PrivateRoutes(api,org,()=>false)('reveal',request()))
 assert.throws(()=>createPilot2PrivateRoutes(api,org,()=>true)('reveal',request({'X-SRM-Report-Admission':'captured-company-grant'})))
 const response=await createPilot2PrivateRoutes(api,org,()=>true)('reveal',request())
 assert.equal(response.status,200);assert.equal(calls,1)
})
