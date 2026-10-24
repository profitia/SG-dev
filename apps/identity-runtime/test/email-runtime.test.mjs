import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createEmailRuntime,verifyEmailAsset} from '../dist/src/email-runtime.js'
import {createHttpHandler} from '../dist/src/http-handler.js'
import {EmailEventRejected} from '../dist/src/email-webhook.js'
function fixture(overrides={}){
  const effects=[],instruction={emailId:'ema_test1234',recipient:'synthetic@example.test',expiresAt:Date.now()+60000},claim={emailId:instruction.emailId,token:'test',instruction}
  const options={autoStart:false,verify:async()=>({status:'ready',instruction}),store:{ready:async()=>{},enqueue:async()=>{effects.push('enqueue');return 'queued'},claim:async()=>{effects.push('claim');return claim},begin:async()=>{effects.push('begin');return {avatar:'female',language:'pl'}},release:async()=>effects.push('release'),settle:async(_,status)=>effects.push(status)},
    recipient:async()=> 'bound', render:async(_,avatar,language)=>{effects.push(avatar);assert.equal(language,avatar==='neutral'?'en':'pl');return {subject:'test',html:'test',text:'test'}},
    send:async()=>{effects.push('send');return {status:'accepted',providerId:'<synthetic@test>'}},diagnostic:code=>effects.push(code),...overrides}
  return {effects,options,runtime:createEmailRuntime(options)}
}
test('intake acknowledges only durable enqueue; DB failure retries webhook; signature failure cannot enqueue',async()=>{
  const f=fixture(),request=()=>new Request('https://identity.test/v1/webhooks/clerk-email',{method:'POST'})
  assert.equal((await f.runtime.handle(request())).status,204);assert.deepEqual(f.effects,['enqueue'])
  f.options.store.enqueue=async()=>{throw Error('sensitive raw database error')}
  assert.equal((await f.runtime.handle(request())).status,503)
  f.options.verify=async()=>{throw new EmailEventRejected()};assert.equal((await f.runtime.handle(request())).status,400)
  f.options.verify=async()=>({status:'ignored',reason:'clerk-delivery'});assert.equal((await f.runtime.handle(request())).status,204)
  assert.ok(!f.effects.join().includes('sensitive'))
})
test('disabled HTTP route stays absent, enabled route enforces exact path and method',async()=>{
  const f=fixture(),request=(suffix='',method='POST')=>new Request('https://identity.test/v1/webhooks/clerk-email'+suffix,{method})
  assert.equal((await createHttpHandler(null)(request())).status,404)
  const h=createHttpHandler(null,null,null,f.runtime)
  assert.equal((await h(request())).status,204);assert.equal((await h(request('?x=1'))).status,404);assert.equal((await h(request('','GET'))).status,405)
})
test('worker marks begin before send, uses canonical avatar, awaits one concurrent tick and stops',async()=>{
  const f=fixture();await Promise.all([f.runtime.tick(),f.runtime.tick()])
  assert.deepEqual(f.effects,['claim','begin','female','send','accepted'])
  await f.runtime.stop();await f.runtime.tick();assert.equal(f.effects.length,5)
})
function gate(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
for(const phase of ['claim','recipient']) test('shutdown during '+phase+' releases the unsent claim without beginning or losing the email',async()=>{
  const entered=gate(),resume=gate(),f=fixture()
  if(phase==='claim') {const claim=f.options.store.claim;f.options.store.claim=async()=>{entered.resolve();await resume.promise;return claim()}}
  else f.options.recipient=async()=>{entered.resolve();await resume.promise;return 'bound'}
  const tick=f.runtime.tick();await entered.promise
  let stopped=false;const stop=f.runtime.stop().then(()=>{stopped=true})
  await f.runtime.tick();assert.equal(stopped,false)
  resume.resolve();await Promise.all([tick,stop]);await f.runtime.tick()
  assert.deepEqual(f.effects,['claim','release'])
})
for(const phase of ['render','send']) test('shutdown during '+phase+' drains one durable attempt and never claims another',async()=>{
  const entered=gate(),resume=gate(),f=fixture(),original=f.options[phase]
  f.options[phase]=async(...args)=>{entered.resolve();await resume.promise;return original(...args)}
  const tick=f.runtime.tick();await entered.promise
  let stopped=false;const stop=f.runtime.stop().then(()=>{stopped=true})
  await f.runtime.tick();assert.equal(stopped,false)
  resume.resolve();await Promise.all([tick,stop]);await f.runtime.tick()
  assert.deepEqual(f.effects,['claim','begin','female','send','accepted'])
})
test('webhook verification finishing after shutdown returns retryable 503 without enqueue',async()=>{
  const entered=gate(),resume=gate(),f=fixture(),verify=f.options.verify
  f.options.verify=async()=>{entered.resolve();await resume.promise;return verify()}
  const response=f.runtime.handle(new Request('https://identity.test/v1/webhooks/clerk-email',{method:'POST'}))
  await entered.promise;await f.runtime.stop();resume.resolve()
  assert.equal((await response).status,503);assert.deepEqual(f.effects,[])
})
test('unbound first signup is neutral, provider errors release before sending, rejected ownership never sends',async()=>{
  for(const [recipient,expected] of [[async()=> 'unbound',['claim','begin','neutral','send','accepted']],
    [async()=>{throw Error('provider error')},['claim','release']], [async()=> 'rejected',['claim','rejected']]]){
    const f=fixture({recipient});await f.runtime.tick();assert.deepEqual(f.effects,expected)
  }
})
test('unknown provider acceptance never retries or exposes raw error; expired instructions never send',async()=>{
  const f=fixture({send:async()=>{throw Error('SECRET OTP recipient')}});await f.runtime.tick()
  assert.deepEqual(f.effects,['claim','begin','female','unknown','worker-unavailable'])
  const expired=fixture({now:()=>Date.now()+300000});await expired.runtime.tick();assert.deepEqual(expired.effects,['claim','rejected'])
})
test('inline assets are digest-pinned and size-bounded',()=>{
  const bytes=Buffer.from([137,80,78,71,13,10,26,10]),asset={filename:'assistant-male.png',sha256:createHash('sha256').update(bytes).digest('hex')}
  assert.deepEqual(verifyEmailAsset(bytes,asset),{filename:asset.filename,bytes})
  assert.throws(()=>verifyEmailAsset(Buffer.from('not png'),asset));assert.throws(()=>verifyEmailAsset(bytes,{...asset,sha256:'0'.repeat(64)}))
})
