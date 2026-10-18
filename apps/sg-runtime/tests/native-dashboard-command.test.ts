import assert from 'node:assert/strict'
import test from 'node:test'
import {MessageChannel} from 'node:worker_threads'
import {createHash} from 'node:crypto'
import {openEmbeddedCommandClient,EmbeddedCommandUnavailable} from '@profitia/platform-contracts/embedded-command-channel'
import {openNativeDashboardCommandHost} from '../lib/platform/native-dashboard-command'
import placement from '../../dashboard-preview/deployment/native-forecast-targets.json'
const target=placement.environments.development.embedding,publication=target.commands
const A='11111111-1111-4111-8111-111111111111',instanceId='native_command_fixture_0001',intentId='22222222-2222-4222-8222-222222222222'
const context={parentOrigin:target.parentOrigins[0],childOrigin:target.childOrigin,seriesId:'shared_series',organisationId:A}
const request={intentId,command:{kind:'CURRENT',modelId:'naive',targetSemantics:'MONTHLY_AVERAGE'}}
const token='fixture_header.fixture_payload.fixture_signature'
function response(body:string,patch:Record<string,string>={},status=202,payload:unknown={requestId:A,status:'ACCEPTED'}){
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json','x-profitia-operation-contract':placement.operationContract,
    'x-profitia-application':'spendguru','x-profitia-environment':'development','x-profitia-forecast-projection':publication.projection,
    'x-profitia-forecast-resource':`forecast-request:${createHash('sha256').update(body).digest('hex')}`,
    'x-profitia-forecast-configuration':publication.configurationVersion,'x-profitia-forecast-delivery':'DELEGATED',...patch}})
}
function pair(t:test.TestContext,fetch:typeof globalThis.fetch,getToken:()=>Promise<string|null>=async()=>token){
  const{port1,port2}=new MessageChannel()
  const host=openNativeDashboardCommandHost({port:port1 as unknown as MessagePort,instanceId,context,getToken,fetch})
  const client=openEmbeddedCommandClient({port:port2 as unknown as MessagePort,instanceId})
  t.after(()=>{client.close();host.close();port1.close();port2.close()});return client
}
test('parent derives only its own scope and canonical original command, keeps credentials outside the real port and strips private receipt ID',async t=>{
  let calls=0
  const client=pair(t,async(input,init)=>{
    calls++;const url=new URL(String(input)),headers=new Headers(init?.headers),body=String(init?.body)
    assert.equal(url.origin,context.parentOrigin);assert.equal(url.pathname,'/api/benchmark/forecast/requests');assert.equal(url.searchParams.get('organisationId'),A)
    assert.equal(init?.method,'POST');assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'manual');assert.equal(init?.cache,'no-store')
    assert.equal(headers.get('authorization'),`Bearer ${token}`);assert.equal(headers.get('idempotency-key'),`native_${intentId}`)
    assert.equal(headers.get('x-profitia-forecast-command'),publication.contract)
    assert.equal(body,JSON.stringify({kind:'CURRENT',modelId:'naive',seriesId:context.seriesId,targetSemantics:'MONTHLY_AVERAGE'}))
    return response(body)
  })
  assert.deepEqual(await client.submit(request),{status:202,body:{status:'ACCEPTED'}});assert.equal(calls,1)
  for(const patch of[{organisationId:A},{userId:'forged'},{seriesId:'another'},{authorization:token},{url:'https://foreign.test'}])assert.equal((await client.submit({...request,command:{...request.command,...patch}})).status,400)
  assert.equal(calls,1)
})
test('old acceptance-only, foreign publication, unbound command and extra private fields never become accepted',async t=>{
  for(const patch of[{'x-profitia-forecast-configuration':'sg2-private-forecast-request-e1-v1'},{'x-profitia-forecast-delivery':'ACCEPTANCE_ONLY'},
    {'x-profitia-environment':'staging'},{'x-profitia-application':'another'},{'x-profitia-forecast-resource':'foreign'},
    {'x-profitia-operation-contract':'unknown'},{'x-profitia-forecast-projection':'unknown'},{'content-type':'text/html'}]){
    const client=pair(t,async(_input,init)=>response(String(init?.body),patch))
    assert.equal((await client.submit(request)).status,503)
  }
  const extra=pair(t,async(_input,init)=>response(String(init?.body),{},202,{requestId:A,status:'ACCEPTED',userId:'private'}))
  assert.equal((await extra.submit(request)).status,503)
})
test('missing official session, foreign origin and cancellation cannot use legacy or another destination',async t=>{
  let calls=0
  const client=pair(t,async()=>{calls++;throw Error('No call')},async()=>null)
  assert.equal((await client.submit(request)).status,401);assert.equal(calls,0)
  const{port1,port2}=new MessageChannel();t.after(()=>{port1.close();port2.close()})
  for(const patch of[{parentOrigin:'https://foreign.test'},{childOrigin:'https://foreign.test'},{seriesId:'bad?scope=1'},{organisationId:'forged'}])assert.throws(()=>openNativeDashboardCommandHost({port:port1 as unknown as MessagePort,instanceId,context:{...context,...patch},getToken:async()=>token}),EmbeddedCommandUnavailable)
  let release!:()=>void,entered!:()=>void
  const wait=new Promise<void>(r=>{release=r}),ready=new Promise<void>(r=>{entered=r})
  const delayed=pair(t,async()=>{calls++;throw Error('Must not submit after close')},async()=>{entered();await wait;return token})
  t.after(()=>release())
  const pending=delayed.submit(request);await ready;delayed.close()
  await assert.rejects(pending,EmbeddedCommandUnavailable);release()
  await new Promise<void>(r=>setImmediate(r));assert.equal(calls,0)
})
