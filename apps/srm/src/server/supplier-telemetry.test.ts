import test from 'node:test'
import assert from 'node:assert/strict'
import {instrumentSupplierIdentity,measureSupplierStage,measureSupplierWork,withSupplierTelemetry} from './supplier-telemetry'

test('concurrent traces separate identity, SQL and business time without logging authority or payloads',async()=>{
 const logs:string[]=[],previous=console.info;console.info=(value)=>{logs.push(String(value))}
 const sensitive='synthetic-never-log-user-token-report-value'
 let users=0,sessions=0,authentications=0
 const user={secret:sensitive},session={secret:sensitive},authentication={secret:sensitive}
 const original={tag:'retained SDK API',users:{marker:17,async getUser(id:string){assert.equal(this.marker,17);assert.equal(id,sensitive);users++;return user}},
  sessions:{async getSession(id:string){assert.equal(id,sensitive);sessions++;return session}},
  async authenticateRequest(request:Request){assert.equal(request.headers.get('authorization'),sensitive);authentications++;return authentication}}
 const client=instrumentSupplierIdentity(original)
 try{
  await Promise.all(['search','krs_lookup'].map(route=>withSupplierTelemetry(route,async()=>{
   assert.equal(await client.authenticateRequest(new Request('https://example.test',{headers:{authorization:sensitive}})),authentication)
   assert.equal(await client.sessions.getSession(sensitive),session)
   await measureSupplierWork('SRM_STORE_FINANCIAL',async()=>{
    await measureSupplierStage('DOMAIN_ACTION',async()=>{await measureSupplierStage('FINANCIAL_FACTS_INSERT',async()=>undefined)})
    assert.equal(await client.users.getUser(sensitive),user)
   })
   return Response.json({secret:sensitive})
  })))
  assert.equal(users,2);assert.equal(sessions,2);assert.equal(authentications,2);assert.equal(client.tag,original.tag)
  const traces=logs.map(x=>JSON.parse(x));assert.equal(traces.length,2);assert.notEqual(traces[0].traceId,traces[1].traceId)
  for(const trace of traces){assert.equal(trace.work.length,1);assert.equal(trace.work[0].unit,'SRM_STORE_FINANCIAL');assert.equal(trace.stages.CLERK_ACCOUNT_READ.count,1);assert.equal(trace.work[0].stages.FINANCIAL_FACTS_INSERT.count,1);assert.equal(trace.httpStatus,200)}
  assert(!logs.join().includes(sensitive));assert(!logs.join().includes('authorization'))
 }finally{console.info=previous}
})

test('metrics preserve original failures and failed logging cannot invalidate a committed response',async()=>{
 const logs:string[]=[],previous=console.info;console.info=(value)=>{logs.push(String(value))}
 const failure=new Error('synthetic-secret-error-detail')
 try{
  await assert.rejects(withSupplierTelemetry('krs_lookup',()=>measureSupplierWork('SRM_STORE_FINANCIAL',()=>measureSupplierStage('DOMAIN_ACTION',async()=>{throw failure}))),e=>e===failure)
  const trace=JSON.parse(logs[0]);assert.equal(trace.httpStatus,500);assert.equal(trace.work[0].status,'ERROR');assert.equal(trace.stages.DOMAIN_ACTION.failed,1);assert(!logs[0].includes(failure.message))
  console.info=()=>{throw new Error('unavailable diagnostics')}
  const response=Response.json({accepted:true});assert.equal(await withSupplierTelemetry('search',async()=>response),response)
 }finally{console.info=previous}
})
