import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {instrumentSupplierIdentity,measureSupplierStage,measureSupplierWork,withSupplierTelemetry} from './supplier-telemetry'

test('HTTP timing observes a complete real response separately from E1 and never logs request contents',async()=>{
 const logs:string[]=[],previous=console.info;console.info=value=>{logs.push(String(value))}
 const secret='private-query-and-body-never-log',server=http.createServer((request,response)=>{
  assert(request.url?.includes(secret));response.write('first');setTimeout(()=>response.end(secret),25)
 })
 try{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address();assert(address&&typeof address!=='string')
  await withSupplierTelemetry('krs_lookup',async()=>{
   await measureSupplierStage('E1_SOURCE_SCOPE',async()=>undefined)
   const response=await fetch(`http://127.0.0.1:${address.port}/?q=${secret}`)
   assert.equal(await response.text(),'first'+secret)
   return new Response()
  })
  const trace=JSON.parse(logs[0]);assert.equal(trace.stages.NETWORK_HTTP.count,1)
  assert(trace.stages.NETWORK_HTTP.totalMs>=20);assert.equal(trace.stages.NETWORK_HTTP.failed,0)
  assert.equal(trace.stages.E1_SOURCE_SCOPE.count,1);assert(!logs.join().includes(secret))
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));console.info=previous}
})

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

test('only outstanding same-request identity reads join; settled/revoked status, failures and other traces stay fresh',async()=>{
 const logs:string[]=[],previous=console.info;console.info=x=>logs.push(String(x))
 const secret='synthetic-subject-never-log';let calls=0,active=true,fail=false
 let release:()=>void=()=>{};let gate:Promise<void>|undefined
 const failure=new Error('synthetic-private-sdk-detail')
 const client=instrumentSupplierIdentity({authenticateRequest:async()=>null,sessions:{getSession:async()=>null},users:{getUser:async(id:string)=>{
  calls++;if(gate)await gate;if(fail)throw failure;return{id,banned:!active}
 }}})
 try{
  await withSupplierTelemetry('krs_lookup',async()=>{
   gate=new Promise<void>(r=>{release=r})
   const first=client.users.getUser(secret),second=client.users.getUser(secret);assert.equal(calls,1)
   release();const values=await Promise.all([first,second]);assert.equal(values[0],values[1]);gate=undefined
   active=false;assert.equal((await client.users.getUser(secret)).banned,true);assert.equal(calls,2)
   fail=true;gate=new Promise<void>(r=>{release=r});const a=client.users.getUser(secret),b=client.users.getUser(secret);release()
   const errors=await Promise.allSettled([a,b]);assert(errors.every(r=>r.status==='rejected'&&r.reason===failure));assert.equal(calls,3)
   gate=undefined;fail=false;await client.users.getUser(secret);assert.equal(calls,4)
   return new Response()
  })
  gate=new Promise<void>(r=>{release=r})
  const requests=Promise.all(['search','krs_lookup'].map(route=>withSupplierTelemetry(route,async()=>{await client.users.getUser(secret);return new Response()})))
  assert.equal(calls,6);release();await requests
  const trace=JSON.parse(logs[0]);assert.equal(trace.stages.CLERK_ACCOUNT_READ.count,4);assert.equal(trace.stages.CLERK_INFLIGHT_JOIN.count,2)
  assert(!logs.join().includes(secret));assert(!logs.join().includes(failure.message))
 }finally{console.info=previous}
})
