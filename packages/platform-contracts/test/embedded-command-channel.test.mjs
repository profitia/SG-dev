import assert from 'node:assert/strict'
import test from 'node:test'
import {MessageChannel} from 'node:worker_threads'
import {readFileSync} from 'node:fs'
import {EMBEDDED_COMMAND_CONTRACT,EMBEDDED_COMMAND_LIMITS,EmbeddedCommandUnavailable,
  openEmbeddedCommandHost,openEmbeddedCommandClient} from '../src/embedded-command-channel.mjs'
import {openEmbeddedReadHost,openEmbeddedReadClient,EmbeddedReadUnavailable} from '../src/embedded-read-channel.mjs'
const instanceId='fixture_command_0001',intentId='11111111-1111-4111-8111-111111111111'
const command={kind:'prepare'},request={intentId,command}
const parseCommand=v=>Object.keys(v).join(',')==='kind'&&v.kind==='prepare'?{kind:v.kind}:null
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}}
const message=(kind,fields={})=>({contract:EMBEDDED_COMMAND_CONTRACT.id,version:EMBEDDED_COMMAND_CONTRACT.version,instanceId,kind,...fields})
const refused={error:'Command observation unavailable.'}
function receive(port,predicate=()=>true){return new Promise(resolve=>{
  const listener=e=>{if(predicate(e.data)){port.removeEventListener('message',listener);resolve(e.data)}}
  port.addEventListener('message',listener);port.start()
})}
function pair(t,accept,limits={}){
  const{port1,port2}=new MessageChannel()
  const host=openEmbeddedCommandHost({port:port1,instanceId,parseCommand,accept,limits:limits.host})
  const client=openEmbeddedCommandClient({port:port2,instanceId,limits:limits.client})
  t.after(()=>{host.close();client.close();port1.close();port2.close()})
  return{host,client,port1,port2}
}
test('explicit requests preserve the same caller intent through real ports; only202 is acceptance',async t=>{
  const seen=[];const body={status:'ACCEPTED',requestId:'22222222-2222-4222-8222-222222222222',values:[0,null]}
  const{client}=pair(t,async(value,{signal})=>{assert(!signal.aborted);seen.push(value);return{status:202,body}})
  assert.deepEqual(await client.submit(request),{status:202,body})
  assert.deepEqual(await client.submit(request),{status:202,body})
  assert.deepEqual(seen,[request,request]);assert.notEqual(seen[0],request)
  // Explicit retries carry the original intent; transport neither invents a
  // new key nor claims that it performed backend deduplication or a compute.
})
test('missing intent or extra identity/destination fields refuse before the application callback',async t=>{
  let calls=0;const{client}=pair(t,async()=>{calls++;return{status:202,body:null}})
  for(const value of[{command},{intentId:'invented',command},{...request,userId:'forged'},{...request,organisationId:'forged'},
    {...request,command:{...command,operation:'knowledge.ingest'}},{...request,command:{...command,url:'https://foreign.test'}}]){
    assert.equal((await client.submit(value)).status,400)
  }
  assert.equal(calls,0)
})
test('READ and COMMAND are mutually refused on real channels without invoking either callback',async t=>{
  for(const side of['read-client','command-client'])await t.test(side,async t=>{
    const{port1,port2}=new MessageChannel();let calls=0
    const host=side==='read-client'?openEmbeddedCommandHost({port:port1,instanceId,parseCommand,accept:async()=>{calls++;return{status:202,body:null}}})
      :openEmbeddedReadHost({port:port1,instanceId,parseSelection:v=>v,read:async()=>{calls++;return{status:200,body:null}}})
    const client=side==='read-client'?openEmbeddedReadClient({port:port2,instanceId}):openEmbeddedCommandClient({port:port2,instanceId})
    t.after(()=>{host.close();client.close();port1.close();port2.close()})
    await assert.rejects(side==='read-client'?client.read(command):client.submit(request),side==='read-client'?EmbeddedReadUnavailable:EmbeddedCommandUnavailable)
    assert.equal(calls,0)
  })
})
test('raw malformed, foreign, replayed or wrong-field command envelopes close before another effect',async t=>{
  for(const patch of[{contract:'profitia.embedded-read'},{kind:'READ'},{version:'unknown'},{instanceId:'foreign_instance_0001'},
    {id:0},{id:1.5},{id:2147483648},{selectionJson:'{}'},{actor:'forged'}])await t.test(JSON.stringify(patch),async t=>{
    const{port1,port2}=new MessageChannel();let calls=0
    const host=openEmbeddedCommandHost({port:port1,instanceId,parseCommand,accept:async()=>{calls++;return{status:202,body:null}}})
    t.after(()=>{host.close();port1.close();port2.close()})
    const closed=receive(port2,v=>v.kind==='CLOSED');port2.postMessage({...message('COMMAND',{id:1,commandJson:JSON.stringify(request)}),...patch})
    await closed;assert.equal(calls,0)
  })
  const{port1,port2}=new MessageChannel();let calls=0
  const host=openEmbeddedCommandHost({port:port1,instanceId,parseCommand,accept:async()=>{calls++;return{status:202,body:null}}})
  t.after(()=>{host.close();port1.close();port2.close()})
  const raw=message('COMMAND',{id:1,commandJson:JSON.stringify(request)})
  let observed=receive(port2);port2.postMessage(raw);assert.equal((await observed).status,202)
  observed=receive(port2);port2.postMessage(raw);assert.equal((await observed).kind,'CLOSED');assert.equal(calls,1)
})
test('200, redirects, diagnostics, malformed or oversized accepted output never become accepted',async t=>{
  const cycle={};cycle.self=cycle
  for(const response of[{status:200,body:{ready:true}},{status:302,body:{location:'https://foreign.test'}},
    {status:403,body:{diagnostic:'private'}},{status:202,body:{value:'😀'.repeat(40)}},{status:202,body:cycle},
    {status:202,body:null,extra:true},new Error('private diagnostic')])await t.test(String(response.status??'error'),async t=>{
    const{client}=pair(t,async()=>{if(response instanceof Error)throw response;return response},{host:{maxResponseBytes:128}})
    assert.deepEqual(await client.submit(request),{status:response.status===403?403:503,body:refused})
  })
})
test('one in-flight command is enforced in the client and host, including noncooperative timed-out work',async t=>{
  const entered=deferred(),release=deferred();let calls=0
  const{client}=pair(t,async()=>{calls++;entered.resolve();await release.promise;return{status:202,body:null}},{host:{timeoutMs:40}})
  t.after(()=>release.resolve())
  const first=client.submit(request);await entered.promise
  await assert.rejects(client.submit(request),e=>e instanceof EmbeddedCommandUnavailable&&e.status===429)
  assert.deepEqual(await first,{status:503,body:refused})
  assert.equal((await client.submit(request)).status,429);assert.equal(calls,1);release.resolve()
})
test('a raw client cannot exceed the host command concurrency limit',async t=>{
  const entered=deferred(),release=deferred();let calls=0
  const{port1,port2}=new MessageChannel()
  const host=openEmbeddedCommandHost({port:port1,instanceId,parseCommand,accept:async()=>{calls++;entered.resolve();await release.promise;return{status:202,body:null}}})
  t.after(()=>{release.resolve();host.close();port1.close();port2.close()})
  port2.postMessage(message('COMMAND',{id:1,commandJson:JSON.stringify(request)}));await entered.promise
  const refused=receive(port2,v=>v.id===2);port2.postMessage(message('COMMAND',{id:2,commandJson:JSON.stringify(request)}))
  assert.equal((await refused).status,429);assert.equal(calls,1)
})
test('client timeout never retries, reports acceptance or rolls back a committed backend effect',async t=>{
  const entered=deferred(),aborted=deferred(),release=deferred();let calls=0,committed=false
  const{client}=pair(t,async(_request,{signal})=>{calls++;committed=true;entered.resolve();signal.addEventListener('abort',()=>aborted.resolve(),{once:true});await release.promise;return{status:202,body:{status:'ACCEPTED'}}},{client:{timeoutMs:40}})
  t.after(()=>release.resolve())
  const result=client.submit(request);await entered.promise
  await assert.rejects(result,e=>e instanceof EmbeddedCommandUnavailable&&e.delivery==='UNVERIFIED')
  await aborted.promise;assert(committed);assert.equal(calls,1);release.resolve()
})
test('abort and close stop observation and late202 cannot resolve an old or replaced session channel',async t=>{
  for(const mode of['abort','host','client'])await t.test(mode,async t=>{
    const entered=deferred(),cancelled=deferred(),release=deferred();let calls=0
    const channel=pair(t,async(_request,{signal})=>{calls++;signal.addEventListener('abort',()=>cancelled.resolve(),{once:true});entered.resolve();await release.promise;return{status:202,body:null}})
    t.after(()=>release.resolve());const controller=new AbortController(),result=channel.client.submit(request,{signal:controller.signal})
    await entered.promise;if(mode==='abort')controller.abort();else channel[mode].close()
    await assert.rejects(result,e=>mode==='abort'?e.name==='AbortError':e instanceof EmbeddedCommandUnavailable&&e.delivery==='UNVERIFIED')
    await cancelled.promise;assert.equal(calls,1);release.resolve()
  })
})
test('JSON bounds reject getters, cycles, sparse structures, non-finite numbers and prototype payloads before acceptance',async t=>{
  let calls=0,getters=0;const{client}=pair(t,async()=>{calls++;return{status:202,body:null}})
  const cycle={};cycle.self=cycle
  const accessor=Object.defineProperty({},'kind',{enumerable:true,get(){getters++;return'prepare'}})
  for(const value of[cycle,accessor,{x:1n},{x:Infinity},{x:new Date()},{x:new Array(1000000)},{x:'😀'.repeat(5000)},JSON.parse('{"__proto__":{}}')]){
    await assert.rejects(client.submit({intentId,command:value}),e=>e instanceof EmbeddedCommandUnavailable&&e.status===400)
  }
  assert.equal(calls,0);assert.equal(getters,0)
})
test('command limits cannot be increased and its imported graph is browser-only without authority, network or storage',()=>{
  const{port1,port2}=new MessageChannel()
  try{
    assert(Object.isFrozen(EMBEDDED_COMMAND_CONTRACT));assert(Object.isFrozen(EMBEDDED_COMMAND_LIMITS))
    for(const limits of[{maxInFlight:2},{maxResponseBytes:65537},{maxRequestBytes:16385},{timeoutMs:15001},{timeoutMs:0},{unknown:true}])assert.throws(()=>openEmbeddedCommandClient({port:port1,instanceId,limits}),TypeError)
    assert.equal(new EmbeddedCommandUnavailable(202).status,503)
    assert.throws(()=>openEmbeddedCommandHost({port:port1,instanceId,accept:async()=>({status:202,body:null})}),TypeError)
  }finally{port1.close();port2.close()}
  const source=readFileSync(new URL('../src/embedded-command-channel.mjs',import.meta.url),'utf8'),core=readFileSync(new URL('../src/embedded-channel-core.mjs',import.meta.url),'utf8')
  assert.deepEqual([...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(v=>v[1]),['./embedded-channel-core.mjs'])
  assert(!/^\s*import\s/m.test(core))
  for(const text of[source,core])assert(!/\b(?:localStorage|sessionStorage|indexedDB)\s*(?:\.|\[)|\b(?:fetch|XMLHttpRequest|createOperationExecutor|createPrivateOperationHost|verifyToken|signToken)\s*\(/m.test(text))
})
